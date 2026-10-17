// ============================================
// La phase finale d'une compétition, telle que ses affiches la montrent : le
// tableau tour par tour, le champion, le meilleur buteur.
//
// Module pur, lu sur les documents bruts : le serveur (lib/phase-finale-
// publique) le nourrit, la suite de tests partagée (mobile/src/__tests__) le
// vérifie sans Firebase.
// ============================================

import { OWN_GOAL_DETAIL } from "@/lib/evenements";
import { estLigneHorsPlateforme } from "@/lib/effectif-match";
import type { CompMatchRound } from "@/types";

/** Les colonnes du tableau, de gauche à droite. La 3e place n'est pas un nœud de l'arbre. */
export const TOURS_DU_TABLEAU: CompMatchRound[] = ["round_of_16", "quarter", "semi", "final"];

export const LIBELLE_DU_TOUR: Record<CompMatchRound, string> = {
  round_of_16: "Huitièmes",
  quarter: "Quarts",
  semi: "Demies",
  final: "Finale",
  third_place: "3e place",
};

export interface CampDuTableau {
  nom: string;
  logo: string | null;
  /** Personne n'est encore qualifié pour cette place : le nom dit d'où il viendra. */
  aDeterminer: boolean;
}

export interface MatchDuTableau {
  id: string;
  tour: CompMatchRound;
  /** La place dans le tableau, du haut vers le bas. */
  position: number;
  home: CampDuTableau;
  away: CampDuTableau;
  scoreHome: number | null;
  scoreAway: number | null;
  tirsAuButHome: number | null;
  tirsAuButAway: number | null;
  termine: boolean;
  vainqueur: "home" | "away" | null;
  date: string;
}

export interface TourDuTableau {
  tour: CompMatchRound;
  libelle: string;
  matchs: MatchDuTableau[];
}

/**
 * Les tours présents, dans l'ordre du tableau, chacun trié par position.
 * Une compétition qui commence en quarts n'a pas de colonne de huitièmes.
 */
export function ordonnerTableau(matchs: MatchDuTableau[]): TourDuTableau[] {
  return TOURS_DU_TABLEAU
    .map((tour) => ({
      tour,
      libelle: LIBELLE_DU_TOUR[tour],
      matchs: matchs.filter((m) => m.tour === tour).sort((a, b) => a.position - b.position),
    }))
    .filter((t) => t.matchs.length > 0);
}

/** Le champion : le vainqueur de la finale jouée, ou `null`. */
export function championDe(matchs: MatchDuTableau[]): CampDuTableau | null {
  const finale = matchs.find((m) => m.tour === "final");
  if (!finale?.termine || !finale.vainqueur) return null;
  return finale.vainqueur === "home" ? finale.home : finale.away;
}

/** Un « 1er poule A », pour une place de premier tour pas encore attribuée. */
export function placeAttendue(source: unknown): string | null {
  const s = source as { kind?: string; group?: string; rank?: number; index?: number } | null;
  if (!s || !Number.isInteger(s.rank)) return null;
  const ordinal = (n: number) => (n === 1 ? "1er" : `${n}e`);
  if (s.kind === "group_rank" && s.group) return `${ordinal(s.rank!)} poule ${s.group}`;
  if (s.kind === "best_rank" && Number.isInteger(s.index)) return `${ordinal(s.index!)} meilleur ${ordinal(s.rank!)}`;
  return null;
}

/** Ce qu'on lit d'un match pour compter ses buteurs. */
export interface MatchAuxButs {
  stage?: string | null;
  home_team_id?: string | null;
  home_team_name?: string;
  away_team_id?: string | null;
  away_team_name?: string;
  live_state?: {
    events?: {
      type?: string;
      team_id?: string;
      player_id?: string | null;
      player_name?: string | null;
      detail?: string | null;
      var_status?: string | null;
    }[] | null;
  } | null;
}

/**
 * Le meilleur buteur de la compétition, sur tous ses matchs — les mêmes
 * règles que le classement des buteurs (lib/competition-firestore) : ni but
 * contre son camp, ni but refusé par la VAR, ni match d'exhibition, ni
 * dossard pas encore nommé. À égalité, celui qui a marqué le premier.
 */
export function meilleurButeur(matchs: MatchAuxButs[]): { nom: string; equipe: string; buts: number } | null {
  const parJoueur = new Map<string, { nom: string; equipe: string; buts: number; ordre: number }>();
  let ordre = 0;
  for (const m of matchs) {
    if (m.stage === "exhibition") continue;
    for (const e of m.live_state?.events ?? []) {
      if (e.type !== "goal" || e.var_status === "cancelled" || e.detail === OWN_GOAL_DETAIL) continue;
      if (estLigneHorsPlateforme(e.player_id)) continue;
      const nom = (e.player_name ?? "").trim();
      if (!nom) continue;
      const cle = `${e.team_id}::${e.player_id || nom.toLowerCase()}`;
      const equipe = e.team_id === m.home_team_id ? m.home_team_name ?? "" : m.away_team_name ?? "";
      const j = parJoueur.get(cle) ?? { nom, equipe, buts: 0, ordre: ordre++ };
      j.buts += 1;
      parJoueur.set(cle, j);
    }
  }
  const tous = [...parJoueur.values()].sort((a, b) => b.buts - a.buts || a.ordre - b.ordre);
  return tous[0] ? { nom: tous[0].nom, equipe: tous[0].equipe, buts: tous[0].buts } : null;
}
