import type { CompMatch, CompTeam, CompetitionFormat } from "@/types";

// ============================================
// Les classements de poule, purs.
//
// Ils vivaient dans lib/competition-firestore, qui importe le SDK client : le
// serveur ne pouvait pas s'en servir sans le tirer avec lui. La fiche publique
// d'un club (voir lib/fiche-club-serveur) en a besoin pour dire son rang.
// ============================================

export interface StandingRow {
  team: CompTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

export interface GroupStanding {
  group: string;
  rows: StandingRow[];
}

/**
 * Compute group-stage standings, one table per group.
 *
 * Only teams with a non-null `group` are ranked. Only matches that are
 * `stage === "group"`, `status === "completed"`, with both team ids and both
 * scores present, contribute to the tables. A match referencing a team id not
 * present in `teams` (e.g. a deleted team) is skipped for that side rather than
 * crashing.
 *
 * Within a group, rows are ordered by points desc, then goal difference desc,
 * then goals-for desc, then team name asc (locale-aware).
 *
 * NOTE: head-to-head tiebreak is intentionally NOT implemented for v1; the
 * agreed v1 ordering is points -> goal difference -> goals-for -> name.
 */
export function computeStandings(
  matches: CompMatch[],
  teams: CompTeam[],
  format: CompetitionFormat,
): GroupStanding[] {
  // One row per grouped team, indexed by id for O(1) match updates.
  const rowsById = new Map<string, StandingRow>();
  for (const team of teams) {
    if (team.group == null) continue;
    rowsById.set(team.id, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
    });
  }

  for (const match of matches) {
    if (match.stage !== "group" || match.status !== "completed") continue;
    if (match.homeTeamId == null || match.awayTeamId == null) continue;
    if (match.scoreHome == null || match.scoreAway == null) continue;

    const home = rowsById.get(match.homeTeamId);
    const away = rowsById.get(match.awayTeamId);
    // Defensive: a side may reference a deleted team absent from `teams`.
    if (!home || !away) continue;

    const sh = match.scoreHome;
    const sa = match.scoreAway;

    home.played += 1;
    away.played += 1;
    home.goalsFor += sh;
    home.goalsAgainst += sa;
    away.goalsFor += sa;
    away.goalsAgainst += sh;

    if (sh > sa) {
      home.won += 1;
      away.lost += 1;
      home.points += format.points.win;
      away.points += format.points.loss;
    } else if (sh < sa) {
      away.won += 1;
      home.lost += 1;
      away.points += format.points.win;
      home.points += format.points.loss;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += format.points.draw;
      away.points += format.points.draw;
    }
  }

  // Finalize goal difference and bucket rows by group letter.
  const byGroup = new Map<string, StandingRow[]>();
  for (const row of rowsById.values()) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
    const letter = row.team.group as string; // non-null by construction above
    const bucket = byGroup.get(letter);
    if (bucket) bucket.push(row);
    else byGroup.set(letter, [row]);
  }

  return Array.from(byGroup.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((group) => ({
      group,
      rows: (byGroup.get(group) as StandingRow[]).sort(
        (a, b) =>
          b.points - a.points ||
          b.goalDiff - a.goalDiff ||
          b.goalsFor - a.goalsFor ||
          a.team.name.localeCompare(b.team.name),
      ),
    }));
}

