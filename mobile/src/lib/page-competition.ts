import { FOOT } from "@/i18n/foot";
import { hasGroupStage, hasKnockout } from "@/lib/competition-format";
import type { CompMatch, CompMatchRound, CompTeam, Competition, CompetitionStatus, CompetitionType } from "@/types";

// La page d'une compétition dans l'application : la page publique du site
// (app/(app)/c/[slug]), ses onglets et leurs règles, portés tels quels. Une
// différence voulue : l'Aperçu ouvre la page — le direct, les prochains
// matchs, les derniers résultats et les performances avant tout le reste.

const f = FOOT.fr;

export type OngletCompetition = "apercu" | "matchs" | "classement" | "tableau" | "stats" | "equipes";

/**
 * Les onglets, dans l'ordre où un supporter les cherche : ce qui se passe,
 * les matchs, puis le classement et les stats. Comme sur le site, un
 * classement n'existe qu'avec une phase de groupes, un tableau qu'avec une
 * phase finale ; un type inconnu garde les deux.
 */
export function ongletsDeLaCompetition(c: Pick<Competition, "competitionType">): OngletCompetition[] {
  const type = c.competitionType ?? null;
  return [
    "apercu",
    "matchs",
    ...(type === null || hasGroupStage(type) ? (["classement"] as const) : []),
    ...(type === null || hasKnockout(type) ? (["tableau"] as const) : []),
    "stats",
    "equipes",
  ];
}

export function libellesDesOnglets(type: CompetitionType | null): Record<OngletCompetition, string> {
  return {
    apercu: "Aperçu",
    matchs: "Matchs",
    classement: "Classement",
    tableau: type === "league_playoffs" ? "Play-offs" : "Tableau",
    stats: "Stats",
    equipes: "Équipes",
  };
}

export const STATUTS: Record<CompetitionStatus, string> = {
  draft: "Brouillon", registration: "Inscriptions", registration_closed: "Inscriptions closes",
  group_stage: "Phase de groupes", knockout: "Phase finale", completed: "Terminée",
};

const dateDuTournoi = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};

/** « 18 octobre 2026 – 1 novembre 2026 », ou la borne qu'on connaît. */
export function periodeDeLaCompetition(debut: string | null, fin: string | null): string | null {
  if (debut && fin) return `${dateDuTournoi(debut)} – ${dateDuTournoi(fin)}`;
  if (debut) return `À partir du ${dateDuTournoi(debut)}`;
  if (fin) return `Jusqu'au ${dateDuTournoi(fin)}`;
  return null;
}

// ---- Les matchs ---------------------------------------------------------------

/** « Groupe A », le tour d'un match de phase finale, ou « Exhibition ». */
export function etiquetteDuMatch(m: CompMatch): string | null {
  if (m.stage === "exhibition") return f.exhibition;
  if (m.group) return f.groupe(m.group);
  if (m.round) return f.tour(m.round);
  return null;
}

export type FiltreCalendrier = "tous" | "phase-finale" | "exhibition" | `poule:${string}`;

/** Les puces du calendrier (CalendarTab) : tous, chaque poule, la phase finale, l'exhibition. */
export function filtresDuCalendrier(matchs: CompMatch[]): { cle: FiltreCalendrier; libelle: string }[] {
  const poules = new Set<string>();
  let phaseFinale = false;
  let exhibition = false;
  for (const m of matchs) {
    if (m.stage === "exhibition") exhibition = true;
    else if (m.group) poules.add(m.group);
    else if (m.round) phaseFinale = true;
  }
  return [
    { cle: "tous", libelle: "Tous" },
    ...[...poules].sort().map((g) => ({ cle: `poule:${g}` as const, libelle: `Poule ${g}` })),
    ...(phaseFinale ? [{ cle: "phase-finale" as const, libelle: "Phase finale" }] : []),
    ...(exhibition ? [{ cle: "exhibition" as const, libelle: f.exhibition }] : []),
  ];
}

export function matchsDuFiltre(matchs: CompMatch[], filtre: FiltreCalendrier): CompMatch[] {
  if (filtre === "tous") return matchs;
  if (filtre === "phase-finale") return matchs.filter((m) => m.stage !== "exhibition" && !m.group && m.round);
  if (filtre === "exhibition") return matchs.filter((m) => m.stage === "exhibition");
  const poule = filtre.slice("poule:".length);
  return matchs.filter((m) => m.stage !== "exhibition" && m.group === poule);
}

/** L'heure d'abord, les matchs sans heure à la fin de leur jour. */
const parHeure = (a: CompMatch, b: CompMatch) => {
  if (a.time == null || b.time == null) return a.time == null ? (b.time == null ? 0 : 1) : -1;
  return a.time.localeCompare(b.time);
};

/** Les matchs par jour, dans l'ordre ; les matchs sans date dans un dernier jour, `date` nulle. */
export function joursDuCalendrier(matchs: CompMatch[]): { date: string | null; matchs: CompMatch[] }[] {
  const parJour = new Map<string | null, CompMatch[]>();
  for (const m of matchs) {
    const cle = m.date ?? null;
    parJour.set(cle, [...(parJour.get(cle) ?? []), m]);
  }
  return [...parJour.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b)))
    .map(([date, liste]) => ({ date, matchs: [...liste].sort(parHeure) }));
}

/** Le moment d'un match, pour le ranger : « 2026-09-25 09:00 » ; sans date, après tous les autres. */
const moment = (m: CompMatch) => `${m.date ?? "9999-99-99"} ${m.time ?? "99:99"}`;

/**
 * Ce que l'Aperçu met en avant : les matchs en direct, les trois prochains,
 * les trois derniers joués (le plus récent d'abord). Un match annulé n'y est pas.
 */
export function matchsDeLApercu(matchs: CompMatch[]): { enDirect: CompMatch[]; aVenir: CompMatch[]; joues: CompMatch[] } {
  const parMoment = [...matchs].sort((a, b) => moment(a).localeCompare(moment(b)));
  return {
    enDirect: parMoment.filter((m) => m.status === "live"),
    aVenir: parMoment.filter((m) => m.status === "scheduled").slice(0, 3),
    joues: parMoment.filter((m) => m.status === "completed").reverse().slice(0, 3),
  };
}

// ---- Le tableau final ---------------------------------------------------------

const ORDRE_DES_TOURS: CompMatchRound[] = ["round_of_16", "quarter", "semi", "final"];

/** Les colonnes du tableau (BracketTab) : un tour par colonne, ses matchs dans l'ordre des places. */
export function colonnesDuTableau(matchs: CompMatch[]): {
  colonnes: { tour: CompMatchRound; matchs: CompMatch[] }[];
  petiteFinale: CompMatch | null;
} {
  return {
    colonnes: ORDRE_DES_TOURS.map((tour) => ({
      tour,
      matchs: matchs.filter((m) => m.round === tour).sort((a, b) => (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0)),
    })).filter((c) => c.matchs.length > 0),
    petiteFinale: matchs.find((m) => m.round === "third_place") ?? null,
  };
}

// ---- Les équipes --------------------------------------------------------------

/** Comme l'onglet Équipes du site : par poule puis par nom, les équipes invitées à la fin. */
export function equipesRangees(equipes: CompTeam[]): CompTeam[] {
  return [...equipes].sort(
    (a, b) => Number(a.invitee) - Number(b.invitee)
      || (a.group ?? "").localeCompare(b.group ?? "")
      || a.name.localeCompare(b.name),
  );
}
