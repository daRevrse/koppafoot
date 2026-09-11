// ============================================
// Player statistics, aggregated from what the live console actually
// records: lineups and match events. Pure and SDK-agnostic so the player's
// own page and the manager's squad view share one definition.
//
// AMICAUX COMPRIS. Ces fonctions ne lisaient que des `CompMatch`, et « Mes
// statistiques » ne comptait donc que les compétitions : un joueur qui venait
// de faire un amical voyait quatre zéros, sans rien pour lui dire pourquoi.
// Un match joué est un match joué. Les deux collections ne se ressemblent pas,
// mais la feuille et l'horloge, si — c'est tout ce qui est lu ici, d'où
// `MatchJoue` plus bas.
//
// Note on what is NOT here: assists. The live console records goals, cards
// and substitutions only (`live_state.events.type`), so there is nothing to
// count. Adding them means adding an assist event to the console first.
// ============================================

import type {
  CompMatch, CompMatchStatus, CompPlayer, LineupEntry, LinkedCompPlayer,
  Match, MatchStatus,
} from "@/types";

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
 * Ce qu'il faut d'un match pour en tirer des statistiques : la feuille, le
 * tableau d'affichage, et ce que la console a noté.
 *
 * Un amical (`Match`) et une rencontre de compétition (`CompMatch`) portent
 * tous les deux ces champs — sous des types légèrement différents, d'où les
 * unions. Ils vivent dans deux collections qui n'ont rien en commun, et c'est
 * bien la seule chose qui les sépare ici : le joueur qui ouvre son bilan ne
 * fait pas la différence, son bilan ne doit pas la faire non plus.
 */
export interface MatchJoue {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  date: string | null;
  time: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
  status: MatchStatus | CompMatchStatus;
  homeLineup: LineupEntry[];
  awayLineup: LineupEntry[];
  liveState?: Match["liveState"];
}

/**
 * La ligne de feuille de ce joueur, quand il y en a une.
 *
 * `playerId` désigne une LIGNE D'EFFECTIF, propre à une équipe : c'est ce que
 * porte la feuille d'une compétition. Sur un amical, la feuille est bâtie
 * depuis les participations, et la ligne est directement le compte du joueur —
 * les deux identifiants s'y confondent. Tester `userId` en plus rattrape le
 * second cas sans rien changer au premier : un identifiant de compte n'est
 * jamais l'identifiant d'une ligne d'effectif.
 */
function ligneDe(lineup: LineupEntry[], playerId: string): LineupEntry | undefined {
  return lineup.find((e) => e.playerId === playerId || e.userId === playerId);
}

/**
 * Stats of one player across a list of matches — those of a competition, or
 * the friendlies they turned out for.
 *
 * A match counts as played when it is completed and the player appears in
 * their team's submitted lineup, a squad member who never made the sheet
 * shouldn't inflate the count. Events are matched on `playerId`, so a goal
 * typed as free text (no player picked in the console) is not attributed.
 */
export function computePlayerStats(
  matches: MatchJoue[],
  teamId: string,
  playerId: string,
): PlayerStats {
  const stats: PlayerStats = { ...EMPTY_STATS };

  for (const match of matches) {
    const isHome = match.homeTeamId === teamId;
    const isAway = match.awayTeamId === teamId;
    if (!isHome && !isAway) continue;

    const entry = ligneDe(isHome ? match.homeLineup : match.awayLineup, playerId);
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
  match: MatchJoue;
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
  matches: MatchJoue[],
  teamId: string,
  playerId: string,
): PlayerAppearance[] {
  const out: PlayerAppearance[] = [];

  for (const match of matches) {
    if (match.status !== "completed") continue;
    const isHome = match.homeTeamId === teamId;
    const isAway = match.awayTeamId === teamId;
    if (!isHome && !isAway) continue;

    const entry = ligneDe(isHome ? match.homeLineup : match.awayLineup, playerId);
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
