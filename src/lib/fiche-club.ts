import { OWN_GOAL_DETAIL } from "@/lib/evenements";
import { POSTES, normaliserPoste, type Poste } from "@/lib/postes";

// ============================================
// La fiche publique d'un club : ce qui s'y calcule, sans base ni SDK.
//
// La lecture vit dans lib/fiche-club-serveur ; ce fichier dit comment ranger
// ce qu'elle rapporte, pour que la route et les tests partagent la règle.
//
// UN JOUEUR SE RECONNAÎT D'UN MATCH À L'AUTRE PAR SON COMPTE. Un amical nomme
// ses joueurs par leur compte (ou par leur ligne, sans compte) ; une
// compétition par une ligne d'effectif à elle — « u_<compte> », « ghost_<ligne
// du club> ». Sans cette traduction, le buteur d'un amical et le même homme en
// tournoi feraient deux meilleurs buteurs.
// ============================================

/** Un joueur de l'effectif, tel que la fiche publique le montre. */
export interface JoueurDuClub {
  /** L'identifiant de sa ligne dans le club : un compte, ou un joueur sans compte. */
  id: string;
  nom: string;
  numero: string | null;
  poste: Poste | null;
  photo: string | null;
  /** Le compte derrière la ligne, pour le lien vers sa fiche. Null sans compte. */
  uid: string | null;
}

export interface MembreDuStaff {
  nom: string;
  titre: string;
}

/** Un match du club, vu depuis le club. */
export interface MatchDuClub {
  id: string;
  lien: string;
  /** La compétition ; null pour un amical. */
  competition: { nom: string; lien: string } | null;
  /** « Groupe A », « Demi-finale » : où ce match se place dans sa compétition. */
  etape: string | null;
  /**
   * La même chose, en données : la page l'écrit dans la langue du lecteur.
   * `etape` reste le repli français — les fiches servies depuis le cache
   * d'avant n'ont pas ces deux champs.
   */
  groupe?: string | null;
  tour?: "round_of_16" | "quarter" | "semi" | "final" | "third_place" | null;
  date: string | null;
  heure: string | null;
  statut: StatutPublic;
  domicile: boolean;
  adversaire: { nom: string; logo: string | null };
  pour: number | null;
  contre: number | null;
  lieu: string | null;
}

/** Une compétition où le club est inscrit. */
export interface CompetitionDuClub {
  nom: string;
  lien: string;
  /** Sa fiche dans la compétition. */
  lienEquipe: string;
  groupe: string | null;
  /** Son rang dans sa poule, et ses points ; null hors phase de poules. */
  rang: number | null;
  points: number | null;
}

/** Un meilleur buteur, ou passeur. */
export interface Meneur {
  cle: string;
  nom: string;
  uid: string | null;
  valeur: number;
}

export type StatutPublic = "a_venir" | "en_direct" | "termine";

/**
 * Ce qu'un public voit d'un statut d'amical. Un défi pas encore accepté, un
 * brouillon, un match en attente ou annulé ne regardent que les managers.
 */
export function statutPublicAmical(status: string): StatutPublic | null {
  if (status === "upcoming" || status === "delayed") return "a_venir";
  if (status === "live") return "en_direct";
  if (status === "completed") return "termine";
  return null;
}

/** Même chose pour un match de compétition : un match annulé n'a rien à montrer. */
export function statutPublicCompetition(status: string): StatutPublic | null {
  if (status === "scheduled") return "a_venir";
  if (status === "live") return "en_direct";
  if (status === "completed") return "termine";
  return null;
}

/** Le résultat d'un match joué, vu du club ; null tant qu'il n'y en a pas. */
export function resultatDuMatch(m: Pick<MatchDuClub, "statut" | "pour" | "contre">): "V" | "N" | "D" | null {
  if (m.statut !== "termine" || m.pour == null || m.contre == null) return null;
  return m.pour > m.contre ? "V" : m.pour < m.contre ? "D" : "N";
}

const quand = (m: Pick<MatchDuClub, "date" | "heure">) => `${m.date ?? "9999-99-99"}${m.heure ?? "99:99"}`;

/**
 * Les matchs du club, en deux listes qui ne vont pas dans le même sens : ce
 * qui vient se lit du plus proche au plus lointain (un match en cours d'abord),
 * ce qui est joué du plus récent au plus ancien. On cherche le prochain d'un
 * côté, le résultat de la veille de l'autre.
 */
export function rangerLesMatchs(matchs: MatchDuClub[]): { aVenir: MatchDuClub[]; joues: MatchDuClub[] } {
  const aVenir = matchs
    .filter((m) => m.statut !== "termine")
    .sort((a, b) =>
      (a.statut === "en_direct" ? 0 : 1) - (b.statut === "en_direct" ? 0 : 1)
      || quand(a).localeCompare(quand(b)));
  const joues = matchs
    .filter((m) => m.statut === "termine")
    .sort((a, b) => quand(b).localeCompare(quand(a)));
  return { aVenir, joues };
}

/**
 * L'identité d'un joueur, la même d'un match à l'autre : son compte quand on
 * le connaît, sinon sa ligne dans le club, sinon son nom.
 */
export function cleJoueur(
  playerId: string | null | undefined,
  userId: string | null | undefined,
  nom: string,
): string {
  if (userId) return `uid:${userId}`;
  if (playerId?.startsWith("u_")) return `uid:${playerId.slice(2)}`;
  if (playerId) return `ligne:${playerId.replace(/^ghost_/, "")}`;
  return `nom:${nom.trim().toLowerCase()}`;
}

/** Ce que le calcul des meilleurs buteurs et passeurs lit d'un match. */
export interface MatchPourMeneurs {
  /** Les identifiants sous lesquels le club joue ce match : le club, ou son inscription. */
  nous: string[];
  status: string;
  /** Les deux feuilles : c'est là qu'on apprend le compte derrière une ligne. */
  feuilles: { playerId: string; userId?: string | null; name: string }[];
  evenements: {
    type: string;
    teamId: string;
    playerId?: string | null;
    playerName?: string | null;
    assistPlayerId?: string | null;
    assistPlayerName?: string | null;
    detail?: string | null;
    varStatus?: string | null;
  }[];
  /**
   * Un match renseigné après coup n'a pas d'événements, seulement la liste de
   * ses buteurs et passeurs. `sansCompte` : l'identifiant est une ligne.
   */
  renseignes?: { playerId: string | null; nom: string; sansCompte: boolean; buts: number; passes: number }[];
}

/**
 * Les meilleurs buteurs et passeurs du club, sur ses matchs terminés.
 *
 * CALCULÉS SUR LES MATCHS, ET NON LUS SUR LES PROFILS. La fiche lisait les
 * compteurs des comptes, qu'un match ne crédite qu'une fois validé : on y
 * lisait « meilleur passeur : personne encore » sous un match où un passeur
 * était nommé. Un but contre son camp ne compte pour personne, un but refusé
 * par la VAR non plus.
 *
 * À égalité, le premier arrivé dans l'ordre alphabétique : un classement
 * doit être stable d'une visite à l'autre.
 */
export function meneursDuClub(matchs: MatchPourMeneurs[], n = 3): { buteurs: Meneur[]; passeurs: Meneur[] } {
  const buts = new Map<string, Meneur>();
  const passes = new Map<string, Meneur>();
  const compter = (table: Map<string, Meneur>, cle: string, nom: string, uid: string | null, combien = 1) => {
    const m = table.get(cle) ?? { cle, nom, uid, valeur: 0 };
    m.valeur += combien;
    if (!m.nom && nom) m.nom = nom;
    table.set(cle, m);
  };

  for (const match of matchs) {
    if (match.status !== "completed") continue;
    const nous = new Set(match.nous);
    const compteDe = new Map(match.feuilles.map((f) => [f.playerId, f.userId ?? null]));
    const nomDe = new Map(match.feuilles.map((f) => [f.playerId, f.name]));
    const qui = (id: string | null | undefined, nom: string | null | undefined) => {
      const vrai = (nom ?? (id ? nomDe.get(id) : "") ?? "").trim();
      const uid = (id ? compteDe.get(id) : null) ?? (id?.startsWith("u_") ? id.slice(2) : null);
      return { cle: cleJoueur(id, uid, vrai), nom: vrai, uid };
    };

    for (const e of match.evenements) {
      if (e.type !== "goal" || e.varStatus === "cancelled" || e.detail === OWN_GOAL_DETAIL) continue;
      if (!nous.has(e.teamId)) continue;
      if (e.playerId || e.playerName) {
        const b = qui(e.playerId, e.playerName);
        if (b.nom) compter(buts, b.cle, b.nom, b.uid);
      }
      if (e.assistPlayerId || e.assistPlayerName) {
        const p = qui(e.assistPlayerId, e.assistPlayerName);
        if (p.nom) compter(passes, p.cle, p.nom, p.uid);
      }
    }

    for (const r of match.renseignes ?? []) {
      const uid = r.sansCompte ? null : r.playerId;
      const cle = cleJoueur(r.sansCompte ? r.playerId : null, uid, r.nom);
      if (r.buts > 0) compter(buts, cle, r.nom, uid, r.buts);
      if (r.passes > 0) compter(passes, cle, r.nom, uid, r.passes);
    }
  }

  const trier = (t: Map<string, Meneur>) =>
    [...t.values()]
      .filter((m) => m.valeur > 0)
      .sort((a, b) => b.valeur - a.valeur || a.nom.localeCompare(b.nom))
      .slice(0, n);
  return { buteurs: trier(buts), passeurs: trier(passes) };
}

/** Les postes au pluriel, pour les titres de l'effectif. */
export const POSTES_AU_PLURIEL: Record<Poste, string> = {
  goalkeeper: "Gardiens",
  defender: "Défenseurs",
  midfielder: "Milieux",
  forward: "Attaquants",
};

/** Une équipe féminine : ses joueuses (lib/genre). */
const POSTES_AU_PLURIEL_FEMININ: Record<Poste, string> = {
  goalkeeper: "Gardiennes",
  defender: "Défenseures",
  midfielder: "Milieux",
  forward: "Attaquantes",
};

const POSTES_AU_PLURIEL_EN: Record<Poste, string> = {
  goalkeeper: "Goalkeepers",
  defender: "Defenders",
  midfielder: "Midfielders",
  forward: "Forwards",
};

/** Le numéro, pour trier : « 9 » avant « 10 », et les sans-numéro à la fin. */
function rangDuNumero(numero: string | null | undefined): number {
  const n = Number.parseInt(String(numero ?? "").trim(), 10);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

/**
 * L'effectif rangé comme une feuille de match : du but vers l'attaque, puis
 * par numéro, puis par nom. UNE SEULE liste, comptes et joueurs sans compte
 * mêlés : triés chacun de leur côté puis mis bout à bout, ils plaçaient un
 * gardien sans compte après les attaquants qui en ont un.
 *
 * Les postes illisibles ferment la liste, sous leur propre titre.
 */
export function effectifParPoste<T extends { nom: string; numero?: string | null; poste?: string | null }>(
  joueurs: T[],
  langue: "fr" | "en" = "fr",
  feminin = false,
): { poste: Poste | null; titre: string; joueurs: T[] }[] {
  const pluriels = langue === "en" ? POSTES_AU_PLURIEL_EN : feminin ? POSTES_AU_PLURIEL_FEMININ : POSTES_AU_PLURIEL;
  const groupes = new Map<Poste | null, T[]>();
  for (const j of joueurs) {
    const poste = normaliserPoste(j.poste);
    groupes.set(poste, [...(groupes.get(poste) ?? []), j]);
  }
  const ordre: (Poste | null)[] = [...POSTES, null];
  return ordre
    .filter((p) => (groupes.get(p) ?? []).length > 0)
    .map((poste) => ({
      poste,
      titre: poste ? pluriels[poste] : langue === "en" ? "Position not given" : "Poste non renseigné",
      joueurs: [...(groupes.get(poste) ?? [])].sort((a, b) =>
        rangDuNumero(a.numero) - rangDuNumero(b.numero) || a.nom.localeCompare(b.nom)),
    }));
}
