import { estLigneLibre } from "@/lib/fusion-import";
import { accorder, lireCategorie, type Categorie } from "@/lib/genre";
import { normaliserPoste, type Poste } from "@/lib/postes";
import type { CompPlayer } from "@/types";

// ============================================
// Rattacher une équipe de compétition aux équipes de son manager.
//
// DEUX SORTES D'ÉQUIPES. Celle d'une compétition (`comp_teams`) n'existe que
// dans son tournoi ; celle d'un manager (`teams`) est la sienne, celle que
// liste « Mes équipes ». Le lien de l'une à l'autre est
// `comp_teams.claimed_by_team_id`. Une inscription le pose ; l'invitation à
// diriger une équipe créée par l'organisateur ne le posait pas : le manager
// en devenait propriétaire, mais l'équipe restait prisonnière du tournoi et
// n'apparaissait jamais dans « Mes équipes ».
//
// DÉCIDÉ LE 2026-10-22 : à l'acceptation, le manager choisit — lier à une de
// ses équipes, ou créer l'équipe dans ses équipes. Lier ne recopie pas
// l'effectif : la page de l'équipe de compétition le propose ensuite
// (« Rattachée à… · Resynchroniser », lib/club-import-server), avec les
// rapprochements à confirmer.
//
// CRÉER REPREND L'EFFECTIF (2026-11-01). L'équipe créée naissait vide : les
// joueurs que l'organisateur avait tapés, sans compte, restaient dans le
// tournoi seul, et le manager devait les ressaisir un par un avant de
// resynchroniser. Chacun devient désormais une fiche sans compte de l'équipe,
// rapprochée de sa ligne (`club_ghost_id`) : l'état exact où la laisserait un
// import confirmé, ses matchs compris. Voir `effectifDepuisCompetition` et
// docs/superpowers/specs/2026-11-01-effectif-a-la-reprise-design.md.
//
// Module pur : aucun SDK.
// ============================================

export type Rattachement =
  | { type: "aucun" }
  | { type: "nouvelle" }
  | { type: "existante"; equipeId: string };

/**
 * Ce que le corps de la demande choisit : rien (l'ancien comportement),
 * « nouvelle », ou l'identifiant d'une équipe. `null` pour une valeur
 * bricolée : la route répond 400.
 */
export function lireRattachement(brut: unknown): Rattachement | null {
  if (brut === undefined || brut === null) return { type: "aucun" };
  if (brut === "nouvelle") return { type: "nouvelle" };
  if (typeof brut === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(brut)) return { type: "existante", equipeId: brut };
  return null;
}

/** L'appelant gère-t-il cette équipe : son manager, ou un adjoint à qui il a délégué ? */
export function gereLEquipe(
  equipe: { manager_id?: string | null; staff_manager_ids?: string[] | null },
  uid: string,
): boolean {
  return equipe.manager_id === uid || (equipe.staff_manager_ids ?? []).includes(uid);
}

/** Sans ville connue, celle où joue presque toute la plateforme ; le manager la corrige ensuite. */
const VILLE_PAR_DEFAUT = "Lomé";

/**
 * L'équipe à créer dans les équipes du manager, depuis son équipe de
 * compétition : le document que POST /api/teams écrirait, sans les dates.
 * Personne n'y est membre : les joueurs de l'effectif de compétition
 * rejoignent l'équipe comme toujours, par invitation, et pas à leur insu.
 */
export function equipeDepuisCompetition(
  e: { nom: string; logo: string | null; ville: string | null; categorie: unknown },
  uid: string,
): Record<string, unknown> {
  const categorie = lireCategorie(e.categorie);
  return {
    name: e.nom.trim().slice(0, 80),
    manager_id: uid,
    city: (e.ville ?? "").trim().slice(0, 80) || VILLE_PAR_DEFAUT,
    description: "",
    level: "amateur",
    looking_for: [],
    member_ids: [],
    max_members: 25,
    color: "emerald",
    logo_url: e.logo ?? null,
    wins: 0, losses: 0, draws: 0, matches_played: 0,
    is_recruiting: true,
    ...(categorie ? { category: categorie } : {}),
  };
}

const nomCompare = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// ---- L'effectif repris à la création ------------------------------------------

/**
 * Au plus autant de fiches créées d'un coup. La création tient en une
 * transaction, et une transaction Firestore plafonne à 500 écritures ; un
 * effectif réel en est très loin. Au-delà, les lignes restent dans le tournoi
 * et se reprennent par « Resynchroniser ».
 */
export const FICHES_REPRISES_MAX = 100;

/** Une fiche sans compte à créer (`teams/{id}/ghost_players/{id}`), sans les dates. */
export interface FicheReprise {
  id: string;
  first_name: string;
  last_name: string;
  position: Poste;
  squad_number: string | null;
  goals: number;
  assists: number;
  matches_played: number;
}

export interface EffectifRepris {
  /** L'effectif de compétition, chaque ligne reprise rapprochée de sa fiche. */
  effectif: CompPlayer[];
  fiches: FicheReprise[];
  /** Les lignes qui portent un compte : ces joueurs rejoignent l'équipe par invitation. */
  comptes: number;
}

/** Ce que l'écran dit de la reprise, une fois l'équipe créée. */
export interface ResumeReprise {
  fiches: number;
  comptes: number;
  categorie: Categorie | null;
}

/**
 * Un nom d'effectif en prénom et nom de fiche : le premier mot, puis le reste.
 * L'affichage les recolle (`${prenom} ${nom}`), et retrouve le nom tapé par
 * l'organisateur, dans son ordre, espaces superflus en moins.
 */
function enDeux(nom: string): { first_name: string; last_name: string } {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  return { first_name: (mots[0] ?? "").slice(0, 80), last_name: mots.slice(1).join(" ").slice(0, 80) };
}

/**
 * Les fiches sans compte à créer depuis l'effectif d'une équipe de compétition.
 *
 * SEULES LES LIGNES LIBRES (lib/fusion-import) : tapées à la main, sans compte
 * ni fiche de club derrière elles. Une ligne qui porte un compte n'a pas
 * besoin de fiche — ses stats suivent déjà le joueur —, et le joueur rejoint
 * l'équipe par invitation, pas à son insu : on la compte, pour le dire.
 *
 * LA LIGNE GARDE SON IDENTIFIANT ET SON NOM, comme à l'import : ce sont eux
 * que portent les feuilles de match. Elle reçoit seulement `club_ghost_id`.
 *
 * LE POSTE : celui de la ligne quand il se lit, sinon milieu, le choix par
 * défaut du formulaire d'une fiche ; le manager le corrige ensuite. Les
 * compteurs partent de zéro, comme pour une fiche rapprochée à la main :
 * les matchs de compétition se lisent par la ligne, et les recopier ici les
 * compterait deux fois. La photo d'une ligne ne passe pas sur la fiche : elle
 * est rangée sous la compétition, et effacer la fiche l'effacerait.
 *
 * `nouvelId` donne l'identifiant de chaque fiche (celui d'un document neuf,
 * côté serveur). L'entrée n'est pas modifiée.
 */
export function effectifDepuisCompetition(lignes: CompPlayer[], nouvelId: () => string): EffectifRepris {
  const fiches: FicheReprise[] = [];
  let comptes = 0;
  const effectif = lignes.map((ligne) => {
    if (ligne.user_id) {
      comptes += 1;
      return ligne;
    }
    if (!estLigneLibre(ligne) || fiches.length >= FICHES_REPRISES_MAX) return ligne;
    const noms = enDeux(ligne.name ?? "");
    if (!noms.first_name) return ligne;
    const id = nouvelId();
    fiches.push({
      id,
      ...noms,
      position: normaliserPoste(ligne.position) ?? "midfielder",
      squad_number: (ligne.number ?? "").trim() || null,
      goals: 0,
      assists: 0,
      matches_played: 0,
    });
    return { ...ligne, club_ghost_id: id };
  });
  return { effectif, fiches, comptes };
}

/** La phrase qui suit la création : ce qui a été repris, et ce qui reste à faire. */
export function messageDeReprise(nomEquipe: string, r: ResumeReprise): string {
  // Une équipe féminine parle de joueuses ; une mixte, comme la langue, au masculin.
  const genre = r.categorie === "women" ? "female" : "male";
  const joueurs = (n: number) =>
    `${n} ${n > 1 ? accorder(genre, "joueurs", "joueuses") : accorder(genre, "joueur", "joueuse")}`;
  const phrases = [
    r.fiches > 0
      ? `« ${nomEquipe} » est maintenant dans tes équipes, avec ${joueurs(r.fiches)} de l'effectif.`
      : `« ${nomEquipe} » est maintenant dans tes équipes.`,
  ];
  if (r.comptes > 1) {
    phrases.push(
      `${joueurs(r.comptes)} ont un compte KoppaFoot : invite-les depuis ton équipe pour qu'${accorder(genre, "ils", "elles")} la rejoignent.`,
    );
  } else if (r.comptes === 1) {
    phrases.push(
      `${joueurs(1)} a un compte KoppaFoot : invite-${accorder(genre, "le", "la")} depuis ton équipe pour qu'${accorder(genre, "il", "elle")} la rejoigne.`,
    );
  }
  return phrases.join(" ");
}

/**
 * Le choix proposé d'abord : une équipe du manager qui porte le même nom
 * (accents, casse et ponctuation mis à part), sinon créer l'équipe.
 */
export function choixParDefaut(equipes: { id: string; name: string }[], nomCompetition: string): string {
  const cible = nomCompare(nomCompetition);
  return equipes.find((e) => nomCompare(e.name) === cible)?.id ?? "nouvelle";
}
