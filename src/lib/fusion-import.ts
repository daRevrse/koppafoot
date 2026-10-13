import { PREFIXE_LIGNE_DU_CLUB, ligneDuClub } from "@/lib/photos-sans-compte";
import type { CompPlayer, FirestoreLineupEntry, LinkedCompPlayer } from "@/types";

// ============================================
// Importer un club dans une équipe de compétition SANS DOUBLER SES JOUEURS.
//
// L'organisateur qui ajoute une équipe tape souvent son effectif à la main.
// Quand le manager importait ensuite son club, chaque joueur arrivait comme
// une ligne de plus : « Koffi » saisi à la main gardait ses quatre buts, et
// « Koffi » importé, rattaché à son compte, restait à zéro. Les stats étaient
// là, et personne ne pouvait les revendiquer.
//
// LA LIGNE GARDE SON IDENTIFIANT, C'EST TOUT LE PRINCIPE. Buts, cartons,
// feuilles de match, homme du match : tout désigne une ligne d'effectif par
// son `id`. Rapprocher un joueur du club d'une ligne existante, c'est donc
// poser le compte SUR cette ligne — jamais la remplacer —, et ce qu'elle a
// joué le suit sans qu'un seul match soit réécrit.
//
// LE MANAGER CONFIRME, LE CODE PROPOSE. `proposerImport` rapproche par le nom
// (et le dossard) ; `planifierImport` n'applique que ce qui lui est confirmé.
// Deux « Koffi » dans un même club existent, et un rapprochement fait tout
// seul donnerait les buts de l'un à l'autre.
//
// Module pur : la route, l'écran et les vérifications le partagent (voir
// scripts/test-passes-changements-fusion.ts). Les lectures et les écritures
// vivent dans lib/club-import-server.
// ============================================

/** Le préfixe des lignes créées par l'import pour un membre qui a un compte. */
const PREFIXE_LIGNE_DU_COMPTE = "u_";

/** Un joueur du club, tel que l'import le voit : un compte, ou une fiche sans compte. */
export interface JoueurDuClub {
  genre: "compte" | "sans_compte";
  /** L'uid du compte, ou l'identifiant de la fiche dans `teams/{club}/ghost_players`. */
  id: string;
  nom: string;
  numero: string;
  poste?: string | null;
}

/** Ce que le manager a confirmé : pour chaque joueur, la ligne qu'il reprend, ou null pour une nouvelle. */
export type Correspondances = Record<string, string | null>;

export interface Proposition {
  /** Voir `cleDuJoueur`. */
  cle: string;
  joueur: JoueurDuClub;
  /**
   * « nouveau » : il n'est pas encore dans l'effectif. « doublon » : il y a
   * déjà sa ligne importée, restée vide, à côté d'une ligne saisie à la main
   * qui lui ressemble — l'état que laissait l'import d'avant. « delie » : il a
   * sa ligne importée, mais le manager en a retiré le compte.
   */
  etat: "nouveau" | "doublon" | "delie";
  /**
   * La ligne qu'on lui propose : une ligne saisie à la main à reprendre, ou,
   * pour un « delie », la sienne à rattacher de nouveau. Celle-là se PROPOSE
   * sans se présélectionner : le manager l'a déliée exprès, et une
   * synchronisation ne doit pas le défaire s'il ne le demande pas.
   */
  suggestion: string | null;
}

/** Ce que l'écran de confirmation reçoit (GET /api/competitions/club-import). */
export interface ApercuImport {
  propositions: Proposition[];
  /** Les lignes saisies à la main, avec ce qu'elles ont joué : de quoi choisir. */
  libres: LigneChiffree[];
  /** Les lignes importées que le manager a déliées : celles des propositions « delie ». */
  deliees: LigneChiffree[];
  /** Les joueurs du club déjà dans l'effectif, pour lesquels il n'y a rien à décider. */
  aJour: number;
}

/** Une ligne d'effectif et ce qu'elle a joué : de quoi la reconnaître. */
export interface LigneChiffree {
  id: string;
  nom: string;
  numero: string;
  matchs: number;
  buts: number;
  passes: number;
}

export interface PlanDImport {
  effectif: CompPlayer[];
  /** Les comptes à rattacher : la ligne qu'ils portent désormais. */
  liens: { uid: string; ligne: string; nom: string }[];
  /** Les rattachements à défaire : la ligne importée vide qu'une fusion retire. */
  liensRetires: { uid: string; ligne: string }[];
  /** Les lignes saisies à la main qui viennent de recevoir un compte. Voir `recopierLesComptes`. */
  comptesParLigne: Record<string, string>;
  /** Les photos que l'organisateur avait posées sur ces lignes (voir `CompPlayer.photo_url`). */
  photosRetirees: string[];
  ajoutes: number;
  fusionnes: number;
  /** Les lignes déliées qui retrouvent leur compte. */
  rattaches: number;
}

/** Une correspondance qu'on ne peut pas appliquer. Le message se dit tel quel au manager. */
export class ImportRefuse extends Error {}

export const cleDuJoueur = (j: Pick<JoueurDuClub, "genre" | "id">): string => `${j.genre}:${j.id}`;

/** La ligne que l'import crée pour ce joueur quand il n'en reprend aucune. */
const ligneImportee = (j: JoueurDuClub): string =>
  j.genre === "compte" ? `${PREFIXE_LIGNE_DU_COMPTE}${j.id}` : ligneDuClub(j.id);

/**
 * Une ligne LIBRE : tapée à la main, sans compte ni fiche de club derrière
 * elle. Ce sont les seules qu'un joueur du club peut reprendre.
 */
export function estLigneLibre(l: CompPlayer): boolean {
  return !l.user_id
    && !l.club_ghost_id
    && !l.id.startsWith(PREFIXE_LIGNE_DU_COMPTE)
    && !l.id.startsWith(PREFIXE_LIGNE_DU_CLUB);
}

/** Les mots d'un nom, sans accents ni casse. */
function mots(nom: string): string[] {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** « MENSAH  Koffi » et « Koffi Mensah » : le même nom. */
const cleDeNom = (nom: string): string => mots(nom).sort().join(" ");

/** La ligne sous laquelle ce joueur figure déjà dans l'effectif, s'il y figure. */
function ligneActuelle(effectif: CompPlayer[], j: JoueurDuClub): CompPlayer | undefined {
  if (j.genre === "compte") {
    return effectif.find((l) => l.user_id === j.id) ?? effectif.find((l) => l.id === ligneImportee(j));
  }
  return effectif.find((l) => l.id === ligneImportee(j) || l.club_ghost_id === j.id);
}

/**
 * Sa ligne est-elle le doublon vide que laissait l'import d'avant ?
 *
 * VIDE, et c'est la condition : une ligne qui a joué ne se supprime pas, ses
 * matchs disparaîtraient avec elle. Deux lignes qui ont chacune leur histoire
 * ne se fusionnent pas ici — il faudrait réécrire les matchs.
 *
 * Une ligne `u_…` que le manager a déliée à la main n'en est pas un : il l'a
 * voulu ainsi.
 */
function estDoublonVide(actuelle: CompPlayer, j: JoueurDuClub, actives: Set<string>): boolean {
  return actuelle.id === ligneImportee(j)
    && !actives.has(actuelle.id)
    && (j.genre === "sans_compte" || actuelle.user_id === j.id);
}

/**
 * Sa ligne importée, dont le manager a retiré le compte ? Un joueur sans
 * compte n'a rien qu'on puisse délier.
 */
function estSaLigneDeliee(actuelle: CompPlayer, j: JoueurDuClub): boolean {
  return j.genre === "compte" && actuelle.id === ligneImportee(j) && !actuelle.user_id;
}

/**
 * Ce qu'on montre au manager avant d'importer : les joueurs du club qui ne
 * sont pas encore dans l'effectif (ou qui y sont en double), chacun avec la
 * ligne saisie à la main qui lui ressemble.
 *
 * Deux passes, le nom entier d'abord : sans cela, un dossard partagé pourrait
 * prendre à un joueur la ligne qui porte exactement son nom. Une ligne n'est
 * proposée qu'à un seul joueur.
 */
export function proposerImport(
  effectif: CompPlayer[],
  club: JoueurDuClub[],
  actives: Set<string>,
): { propositions: Proposition[]; libres: CompPlayer[]; aJour: number } {
  const libres = effectif.filter(estLigneLibre);
  let aJour = 0;

  const aTraiter: { joueur: JoueurDuClub; etat: Proposition["etat"] }[] = [];
  const suggestion = new Map<string, string>();
  for (const joueur of club) {
    const actuelle = ligneActuelle(effectif, joueur);
    if (!actuelle) aTraiter.push({ joueur, etat: "nouveau" });
    else if (estDoublonVide(actuelle, joueur, actives)) aTraiter.push({ joueur, etat: "doublon" });
    else if (estSaLigneDeliee(actuelle, joueur)) {
      // Sa ligne est connue, il n'y a rien à chercher par le nom.
      aTraiter.push({ joueur, etat: "delie" });
      suggestion.set(cleDuJoueur(joueur), actuelle.id);
    } else aJour += 1;
  }

  const prises = new Set<string>();
  const chercher = (ressemble: (l: CompPlayer, j: JoueurDuClub) => boolean) => {
    for (const { joueur } of aTraiter) {
      const cle = cleDuJoueur(joueur);
      if (suggestion.has(cle)) continue;
      const ligne = libres.find((l) => !prises.has(l.id) && ressemble(l, joueur));
      if (!ligne) continue;
      suggestion.set(cle, ligne.id);
      prises.add(ligne.id);
    }
  };
  chercher((l, j) => cleDeNom(l.name) !== "" && cleDeNom(l.name) === cleDeNom(j.nom));
  // Le dossard seul ne suffit pas, un prénom seul non plus : il faut les deux.
  chercher((l, j) => {
    if (!l.number || l.number !== j.numero) return false;
    const siens = new Set(mots(j.nom).filter((m) => m.length >= 3));
    return mots(l.name).some((m) => siens.has(m));
  });

  const propositions: Proposition[] = [];
  for (const { joueur, etat } of aTraiter) {
    const cle = cleDuJoueur(joueur);
    const proposee = suggestion.get(cle) ?? null;
    // Un doublon sans ligne à lui proposer n'a rien à fusionner : il est à jour.
    if (etat === "doublon" && !proposee) aJour += 1;
    else propositions.push({ cle, joueur, etat, suggestion: proposee });
  }
  return { propositions, libres, aJour };
}

/**
 * Le nouvel effectif, et tout ce qu'il faut écrire à côté.
 *
 * Un joueur absent de `correspondances` arrive comme une nouvelle ligne s'il
 * n'est pas déjà là : c'est l'import d'origine, celui d'une inscription
 * acceptée, où l'équipe naît vide et où il n'y a rien à rapprocher.
 *
 * Lève `ImportRefuse` sur une correspondance inapplicable. L'écran ne les
 * propose pas ; elles n'arrivent que si l'effectif a bougé entre l'aperçu et
 * la confirmation, et on refuse alors tout plutôt que d'en appliquer la moitié.
 */
export function planifierImport(
  effectif: CompPlayer[],
  club: JoueurDuClub[],
  correspondances: Correspondances,
  actives: Set<string>,
): PlanDImport {
  const lignes = effectif.map((l) => ({ ...l }));
  const plan: PlanDImport = {
    effectif: lignes, liens: [], liensRetires: [], comptesParLigne: {}, photosRetirees: [],
    ajoutes: 0, fusionnes: 0, rattaches: 0,
  };
  // La ligne a un compte : c'est à lui de choisir sa photo, celle qu'on y
  // avait posée s'en va (voir `CompPlayer.photo_url`).
  const poserLeCompte = (ligne: CompPlayer, uid: string) => {
    ligne.user_id = uid;
    if (ligne.photo_url) plan.photosRetirees.push(ligne.photo_url);
    delete ligne.photo_url;
    plan.liens.push({ uid, ligne: ligne.id, nom: ligne.name });
    plan.comptesParLigne[ligne.id] = uid;
  };
  const perime = "L'effectif a changé depuis l'aperçu. Relance l'import.";

  for (const joueur of club) {
    const choisie = correspondances[cleDuJoueur(joueur)] ?? null;
    const actuelle = ligneActuelle(lignes, joueur);

    if (!choisie) {
      if (actuelle) continue;
      const id = ligneImportee(joueur);
      lignes.push({
        id,
        name: joueur.nom,
        number: joueur.numero,
        ...(joueur.poste ? { position: joueur.poste } : {}),
        user_id: joueur.genre === "compte" ? joueur.id : null,
      });
      if (joueur.genre === "compte") plan.liens.push({ uid: joueur.id, ligne: id, nom: joueur.nom });
      plan.ajoutes += 1;
      continue;
    }

    // Rattacher à nouveau : sa propre ligne, que le manager avait déliée.
    // Elle n'est pas « libre » — personne d'autre ne peut la reprendre.
    if (actuelle && actuelle.id === choisie && estSaLigneDeliee(actuelle, joueur)) {
      poserLeCompte(actuelle, joueur.id);
      plan.rattaches += 1;
      continue;
    }

    const cible = lignes.find((l) => l.id === choisie);
    // Une ligne déjà donnée plus haut porte désormais un compte ou une fiche :
    // elle n'est plus libre, et le même test refuse les deux cas.
    if (!cible || !estLigneLibre(cible)) throw new ImportRefuse(perime);

    if (actuelle) {
      if (!estDoublonVide(actuelle, joueur, actives)) {
        throw new ImportRefuse(
          `${joueur.nom} a déjà une ligne qui a joué : les deux ne peuvent pas être fusionnées.`,
        );
      }
      lignes.splice(lignes.indexOf(actuelle), 1);
      if (joueur.genre === "compte") plan.liensRetires.push({ uid: joueur.id, ligne: actuelle.id });
    }

    // Le nom reste celui que l'organisateur a tapé : c'est celui des feuilles
    // de match déjà écrites. Le dossard et le poste ne comblent que des vides.
    if (!cible.number && joueur.numero) cible.number = joueur.numero;
    if (!cible.position && joueur.poste) cible.position = joueur.poste;

    if (joueur.genre === "compte") {
      poserLeCompte(cible, joueur.id);
    } else {
      cible.club_ghost_id = joueur.id;
    }
    plan.fusionnes += 1;
  }

  return plan;
}

// ---- Les matchs déjà joués ---------------------------------------------------

/** Ce qu'on lit d'un match de compétition, tel qu'il est stocké. */
export interface MatchStocke {
  home_lineup?: FirestoreLineupEntry[] | null;
  away_lineup?: FirestoreLineupEntry[] | null;
  home_on_pitch?: string[] | null;
  away_on_pitch?: string[] | null;
  mvp_player_id?: string | null;
  mvp_user_id?: string | null;
  live_state?: {
    events?: {
      player_id?: string | null;
      assist_player_id?: string | null;
      victim_player_id?: string | null;
      out_player_id?: string | null;
    }[] | null;
  } | null;
}

/**
 * Les lignes d'effectif qu'un match au moins désigne : sur une feuille, sur
 * la pelouse, dans un événement, ou comme homme du match. Ce sont celles
 * qu'on ne supprime pas.
 */
export function lignesActives(matchs: MatchStocke[]): Set<string> {
  const actives = new Set<string>();
  const noter = (id: string | null | undefined) => { if (id) actives.add(id); };
  for (const m of matchs) {
    for (const e of [...(m.home_lineup ?? []), ...(m.away_lineup ?? [])]) noter(e.player_id);
    for (const id of [...(m.home_on_pitch ?? []), ...(m.away_on_pitch ?? [])]) noter(id);
    noter(m.mvp_player_id);
    for (const e of m.live_state?.events ?? []) {
      noter(e.player_id);
      noter(e.assist_player_id);
      noter(e.victim_player_id);
      noter(e.out_player_id);
    }
  }
  return actives;
}

/**
 * Recopie le compte sur les feuilles d'un match DÉJÀ ÉCRIT.
 *
 * `user_id` est posé sur la feuille au moment où elle est validée (voir
 * `FirestoreLineupEntry.user_id`), et c'est lui que lisent le classement et
 * la fiche du club. Une ligne rattachée après coup laissait ses anciens
 * matchs sans compte : le même joueur y figurait deux fois, une fois par son
 * nom, une fois par son compte.
 *
 * Ne touche qu'aux lignes sans compte, et rend `null` quand il n'y a rien à
 * écrire.
 */
export function recopierLesComptes(
  match: MatchStocke,
  comptesParLigne: Record<string, string>,
): { home_lineup?: FirestoreLineupEntry[]; away_lineup?: FirestoreLineupEntry[]; mvp_user_id?: string } | null {
  const patch: ReturnType<typeof recopierLesComptes> = {};

  for (const cote of ["home_lineup", "away_lineup"] as const) {
    const feuille = match[cote] ?? [];
    if (!feuille.some((e) => !e.user_id && comptesParLigne[e.player_id])) continue;
    patch[cote] = feuille.map((e) =>
      !e.user_id && comptesParLigne[e.player_id] ? { ...e, user_id: comptesParLigne[e.player_id] } : e,
    );
  }

  const mvp = match.mvp_player_id ? comptesParLigne[match.mvp_player_id] : undefined;
  if (mvp && !match.mvp_user_id) patch.mvp_user_id = mvp;

  return Object.keys(patch).length > 0 ? patch : null;
}

// ---- Délier ------------------------------------------------------------------
//
// Un rattachement s'écrit à trois endroits : le compte sur la ligne
// d'effectif, la ligne dans `linked_comp_players` du compte (ce que lit « Mes
// statistiques »), et le compte recopié sur les feuilles de match (ce que
// lisent le classement et la fiche du club). Délier défait les trois. Le
// bouton du manager ne retirait que le premier : le joueur gardait la
// compétition et les stats d'une ligne qui n'était plus la sienne.

/** Les liens d'un compte, sans celui de cette ligne dans cette équipe. */
export function sansLeLien(
  liens: LinkedCompPlayer[],
  cible: { cid: string; teamId: string; playerId: string },
): LinkedCompPlayer[] {
  return liens.filter(
    (l) => !(l.competition_id === cible.cid && l.team_id === cible.teamId && l.player_id === cible.playerId),
  );
}

/**
 * Retire ce compte des feuilles d'un match, là où elles le portent sur cette
 * ligne. L'inverse de `recopierLesComptes`.
 *
 * Ce compte-là et pas un autre : une feuille validée du temps où la ligne
 * appartenait à quelqu'un d'autre garde ce qu'elle disait. Rend `null` quand
 * il n'y a rien à écrire.
 */
export function retirerLeCompte(
  match: MatchStocke,
  ligne: string,
  uid: string,
): { home_lineup?: FirestoreLineupEntry[]; away_lineup?: FirestoreLineupEntry[]; mvp_user_id?: null } | null {
  const patch: ReturnType<typeof retirerLeCompte> = {};
  const sienne = (e: FirestoreLineupEntry) => e.player_id === ligne && e.user_id === uid;

  for (const cote of ["home_lineup", "away_lineup"] as const) {
    const feuille = match[cote] ?? [];
    if (!feuille.some(sienne)) continue;
    patch[cote] = feuille.map((e) => (sienne(e) ? { ...e, user_id: null } : e));
  }

  if (match.mvp_player_id === ligne && match.mvp_user_id === uid) patch.mvp_user_id = null;

  return Object.keys(patch).length > 0 ? patch : null;
}
