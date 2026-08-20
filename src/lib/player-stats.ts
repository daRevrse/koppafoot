// ============================================
// Player statistics, aggregated from what the live console actually
// records: lineups and match events. Pure and SDK-agnostic so the player's
// own page and the manager's squad view share one definition.
//
// Note on what is NOT here: assists. The live console records goals, cards
// and substitutions only (`live_state.events.type`), so there is nothing to
// count. Adding them means adding an assist event to the console first.
// ============================================

import type { CompMatch, CompPlayer, LinkedCompPlayer } from "@/types";

export interface PlayerStats {
  matchesPlayed: number;
  starts: number;
  goals: number;
  yellowCards: number;
  redCards: number;
}

export interface PlayerCompetitionStats extends PlayerStats {
  link: LinkedCompPlayer;
}

export const EMPTY_STATS: PlayerStats = {
  matchesPlayed: 0,
  starts: 0,
  goals: 0,
  yellowCards: 0,
  redCards: 0,
};

/**
 * Stats of one roster line across a competition's matches.
 *
 * A match counts as played when it is completed and the player appears in
 * their team's submitted lineup, a squad member who never made the sheet
 * shouldn't inflate the count. Events are matched on `playerId`, so a goal
 * typed as free text (no player picked in the console) is not attributed.
 */
export function computePlayerStats(
  matches: CompMatch[],
  teamId: string,
  playerId: string,
): PlayerStats {
  const stats: PlayerStats = { ...EMPTY_STATS };

  for (const match of matches) {
    const isHome = match.homeTeamId === teamId;
    const isAway = match.awayTeamId === teamId;
    if (!isHome && !isAway) continue;

    const lineup = isHome ? match.homeLineup : match.awayLineup;
    const entry = lineup.find((e) => e.playerId === playerId);
    if (match.status === "completed" && entry) {
      stats.matchesPlayed += 1;
      if (entry.role === "starter") stats.starts += 1;
    }

    for (const event of match.liveState?.events ?? []) {
      if (event.playerId !== playerId) continue;
      // A goal disallowed by the VAR is off the scoreboard, it must not sit
      // in a player's tally either.
      if (event.type === "goal" && event.varStatus === "cancelled") continue;
      if (event.type === "goal") stats.goals += 1;
      else if (event.type === "yellow_card") stats.yellowCards += 1;
      else if (event.type === "red_card") stats.redCards += 1;
    }
  }

  return stats;
}

export interface PlayerAppearance {
  match: CompMatch;
  role: "starter" | "substitute";
  goals: number;
  yellowCards: number;
  redCards: number;
}

/**
 * Match-by-match record for one roster line, most recent first.
 *
 * Totals answer "how good a season", this answers "what did I do last
 * Saturday", which is the question a player actually opens the app with.
 * Only completed matches the player was on the sheet for are returned.
 */
export function computeAppearances(
  matches: CompMatch[],
  teamId: string,
  playerId: string,
): PlayerAppearance[] {
  const out: PlayerAppearance[] = [];

  for (const match of matches) {
    if (match.status !== "completed") continue;
    const isHome = match.homeTeamId === teamId;
    const isAway = match.awayTeamId === teamId;
    if (!isHome && !isAway) continue;

    const lineup = isHome ? match.homeLineup : match.awayLineup;
    const entry = lineup.find((e) => e.playerId === playerId);
    if (!entry) continue;

    const events = (match.liveState?.events ?? []).filter((e) => e.playerId === playerId);
    out.push({
      match,
      role: entry.role,
      goals: events.filter((e) => e.type === "goal" && e.varStatus !== "cancelled").length,
      yellowCards: events.filter((e) => e.type === "yellow_card").length,
      redCards: events.filter((e) => e.type === "red_card").length,
    });
  }

  return out.sort((a, b) =>
    `${b.match.date ?? ""}T${b.match.time ?? ""}`.localeCompare(
      `${a.match.date ?? ""}T${a.match.time ?? ""}`,
    ),
  );
}

/** Same, for every linked roster line of a team at once. */
export function computeSquadStats(
  matches: CompMatch[],
  teamId: string,
  players: CompPlayer[],
): { player: CompPlayer; stats: PlayerStats }[] {
  return players
    .map((player) => ({ player, stats: computePlayerStats(matches, teamId, player.id) }))
    .sort(
      (a, b) =>
        b.stats.goals - a.stats.goals ||
        b.stats.matchesPlayed - a.stats.matchesPlayed ||
        a.player.name.localeCompare(b.player.name),
    );
}

/** Adds up per-competition stats into a career total. */
export function totalStats(rows: { matchesPlayed: number; starts: number; goals: number; yellowCards: number; redCards: number }[]): PlayerStats {
  return rows.reduce<PlayerStats>(
    (acc, r) => ({
      matchesPlayed: acc.matchesPlayed + r.matchesPlayed,
      starts: acc.starts + r.starts,
      goals: acc.goals + r.goals,
      yellowCards: acc.yellowCards + r.yellowCards,
      redCards: acc.redCards + r.redCards,
    }),
    { ...EMPTY_STATS },
  );
}
