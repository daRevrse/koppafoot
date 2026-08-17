// ============================================
// Competition types — the single source of truth on what each shape means.
// SDK-agnostic and pure, so both the client lib and the server lib can use it.
// ============================================

import type { CompetitionFormat, CompetitionStatus, CompetitionType } from "@/types";

export const COMPETITION_TYPES: {
  type: CompetitionType;
  label: string;
  tagline: string;
  /** Bullet points shown on the type picker at creation. */
  details: string[];
}[] = [
  {
    type: "cup",
    label: "Coupe",
    tagline: "Élimination directe",
    details: [
      "Un tableau final, pas de phase de groupes",
      "Un match perdu et c'est fini",
      "Match pour la 3ᵉ place en option",
    ],
  },
  {
    type: "league",
    label: "Championnat",
    tagline: "Poule unique",
    details: [
      "Toutes les équipes dans un seul groupe",
      "Aller simple ou aller-retour",
      "Le classement désigne le vainqueur",
    ],
  },
  {
    type: "groups_knockout",
    label: "Poules + phase finale",
    tagline: "Format coupe du monde",
    details: [
      "Plusieurs groupes puis un tableau final",
      "Les meilleurs de chaque groupe se qualifient",
      "Match pour la 3ᵉ place en option",
    ],
  },
  {
    type: "league_playoffs",
    label: "Championnat + play-offs",
    tagline: "Poule unique puis tableau",
    details: [
      "Toutes les équipes dans un seul groupe",
      "Les N premiers disputent une phase finale",
      "Aller simple ou aller-retour en saison régulière",
    ],
  },
];

export const COMPETITION_TYPE_LABELS: Record<CompetitionType, string> = {
  cup: "Coupe",
  league: "Championnat",
  groups_knockout: "Poules + phase finale",
  league_playoffs: "Championnat + play-offs",
};

/** Does this type play a group/league stage before (or instead of) a bracket? */
export function hasGroupStage(type: CompetitionType): boolean {
  return type !== "cup";
}

/** Does this type end on a knockout bracket? */
export function hasKnockout(type: CompetitionType): boolean {
  return type !== "league";
}

/**
 * Single-group types run on one group. The organizer never has to compose
 * poules for them, so teams are auto-assigned to group "A" at generation.
 */
export function isSingleGroup(type: CompetitionType): boolean {
  return type === "league" || type === "league_playoffs";
}

export const SINGLE_GROUP_LETTER = "A";

// ============================================
// Règles du jeu — le NvN et la durée. Deux réglages qui n'ont rien à voir
// avec la forme du tournoi : une coupe comme un championnat peut se jouer à
// 5 contre 5 en 2×20. Absents des compétitions créées avant ces champs, d'où
// les accesseurs plutôt que des lectures directes.
// ============================================

export const DEFAULT_TEAM_SIZE = 11;
export const DEFAULT_HALF_DURATION = 45;

/** Formats de jeu proposés à l'organisateur, gardien compris. */
export const TEAM_SIZE_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11];

// Absent, zéro ou négatif retombent tous sur la valeur par défaut : un champ
// vidé dans le formulaire ne doit jamais produire une équipe de 0 joueur ni
// une mi-temps de 0 minute côté console.
const positiveOr = (v: number | undefined, fallback: number) =>
  typeof v === "number" && v > 0 ? v : fallback;

/** Joueurs de champ par équipe (NvN) — 11 par défaut. */
export function teamSize(format: CompetitionFormat): number {
  return positiveOr(format.team_size, DEFAULT_TEAM_SIZE);
}

/** Durée d'une mi-temps en minutes — 45 par défaut. */
export function halfDuration(format: CompetitionFormat): number {
  return positiveOr(format.half_duration, DEFAULT_HALF_DURATION);
}

/** Durée totale d'un match, en minutes (deux mi-temps). */
export function matchDuration(format: CompetitionFormat): number {
  return halfDuration(format) * 2;
}

/** "11v11" — la même écriture que les matchs amicaux et les terrains. */
export function gameTypeLabel(format: CompetitionFormat): string {
  const n = teamSize(format);
  return `${n}v${n}`;
}

/** "2 × 45 min" */
export function matchDurationLabel(format: CompetitionFormat): string {
  return `2 × ${halfDuration(format)} min`;
}

/** Sensible starting format for each type, used to seed the creation form. */
export function defaultFormat(type: CompetitionType): CompetitionFormat {
  const points = { win: 3, draw: 1, loss: 0 };
  // Le NvN et la durée survivent au changement de type : ils décrivent le jeu,
  // pas la forme du tournoi.
  const play = { team_size: DEFAULT_TEAM_SIZE, half_duration: DEFAULT_HALF_DURATION };
  switch (type) {
    case "cup":
      return {
        group_count: 0,
        teams_per_group: 0,
        qualifiers_per_group: 0,
        has_third_place: true,
        double_round: false,
        knockout_teams: 8,
        points,
        ...play,
      };
    case "league":
      return {
        group_count: 1,
        teams_per_group: 10,
        qualifiers_per_group: 0,
        has_third_place: false,
        double_round: true,
        knockout_teams: 0,
        points,
        ...play,
      };
    case "league_playoffs":
      return {
        group_count: 1,
        teams_per_group: 10,
        qualifiers_per_group: 0,
        has_third_place: true,
        double_round: true,
        knockout_teams: 4,
        points,
        ...play,
      };
    case "groups_knockout":
    default:
      return {
        group_count: 4,
        teams_per_group: 4,
        qualifiers_per_group: 2,
        has_third_place: true,
        double_round: false,
        knockout_teams: 0,
        points,
        ...play,
      };
  }
}

/**
 * Statuses an organizer may set by hand, in order. `group_stage` and
 * `knockout` are also set automatically by the generators; `draft` is the
 * only one that hides the competition from the public listings.
 */
export function statusFlow(type: CompetitionType): CompetitionStatus[] {
  const flow: CompetitionStatus[] = ["draft", "registration"];
  if (hasGroupStage(type)) flow.push("group_stage");
  if (hasKnockout(type)) flow.push("knockout");
  flow.push("completed");
  return flow;
}

/** Label for the running stage — "phase de groupes" reads wrong for a league. */
export function stageLabel(type: CompetitionType, status: CompetitionStatus): string {
  if (status === "group_stage") {
    return isSingleGroup(type) ? "Saison régulière" : "Phase de groupes";
  }
  if (status === "knockout") {
    return type === "league_playoffs" ? "Play-offs" : "Phase finale";
  }
  return "";
}
