// Server-only client for football-data.org (real football content on the home).
// Token in FOOTBALL_DATA_TOKEN (.env.local). MUST NOT be imported into a client
// component. Rate-limit aware (free tier ~10 req/min): reads the provider's
// X-RequestsAvailable / X-RequestCounter-Reset headers and self-throttles, on top
// of ISR caching (next.revalidate). Every function degrades gracefully (returns
// [] / null) so the home never breaks when the token is missing or quota is hit.

const BASE = "https://api.football-data.org/v4";

// Curated free-tier competitions to feature (codes available on the free plan).
const FEATURED_CODES = ["CL", "PL", "FL1", "BL1", "SA", "PD"];

// Every competition the free plan exposes, in the order we want them listed in
// the public directory (the ones a francophone audience looks for first). The
// plan returns exactly these 13 codes — anything else 403s, so this doubles as
// the allow-list for /competitions/monde/[code].
const WORLD_CODES = [
  "CL", "FL1", "PL", "PD", "SA", "BL1",
  "WC", "CLI", "BSA", "DED", "PPL", "ELC", "EC",
];

export interface FootballTeamRef {
  name: string;
  crest: string | null;
}
export interface FootballMatch {
  id: number;
  utcDate: string;
  status: string;
  competition: { name: string; emblem: string | null };
  home: FootballTeamRef;
  away: FootballTeamRef;
  scoreHome: number | null;
  scoreAway: number | null;
}
export interface FootballCompetition {
  id: number;
  code: string;
  name: string;
  emblem: string | null;
  area: string | null;
  /** LEAGUE or CUP — drives the "Championnat"/"Coupe" badge. */
  type: string | null;
  areaFlag: string | null;
  seasonStart: string | null;
  seasonEnd: string | null;
  currentMatchday: number | null;
}

/** One row of a league/group table, as ranked by the provider. */
export interface WorldStandingRow {
  position: number;
  team: { id: number; name: string; crest: string | null };
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

/** A league table, or one group of a cup's group stage. */
export interface WorldStandingsGroup {
  /** null for a straight league table; "Group A" etc. for a cup. */
  group: string | null;
  rows: WorldStandingRow[];
}

/** A line of the top-scorer chart. */
export interface WorldScorer {
  playerId: number;
  playerName: string;
  nationality: string | null;
  team: { name: string; crest: string | null };
  goals: number;
  assists: number | null;
  playedMatches: number | null;
}

/**
 * Everything the /competitions/monde/[code] tabs render, in three cached calls.
 * The layout needs the whole thing to know which tabs have content, and each
 * tab page re-requests it — Next dedupes the fetches, so it stays three calls.
 */
export interface WorldCompetitionSummary {
  competition: FootballCompetition;
  standings: WorldStandingsGroup[];
  /** Most recent results first. */
  recent: FootballMatch[];
  /** Soonest kick-off first. */
  upcoming: FootballMatch[];
  scorers: WorldScorer[];
}
export interface TodayFootball {
  live: FootballMatch[];
  finished: FootballMatch[];
  upcoming: FootballMatch[];
}

// Minimal shapes of the API responses (only the fields we read).
interface ApiTeam {
  name?: string;
  shortName?: string;
  crest?: string | null;
}
interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  competition?: { name?: string; emblem?: string | null };
  homeTeam?: ApiTeam;
  awayTeam?: ApiTeam;
  score?: { fullTime?: { home?: number | null; away?: number | null } };
}
interface ApiSeason {
  startDate?: string | null;
  endDate?: string | null;
  currentMatchday?: number | null;
}
interface ApiCompetition {
  id: number;
  code?: string;
  name?: string;
  type?: string;
  emblem?: string | null;
  area?: { name?: string; flag?: string | null };
  currentSeason?: ApiSeason | null;
}
interface ApiStandingRow {
  position?: number;
  team?: { id?: number; name?: string; shortName?: string; crest?: string | null };
  playedGames?: number;
  won?: number;
  draw?: number;
  lost?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;
  points?: number;
}
interface ApiStandings {
  stage?: string;
  type?: string;
  group?: string | null;
  table?: ApiStandingRow[];
}
interface ApiScorer {
  player?: { id?: number; name?: string; nationality?: string | null };
  team?: { name?: string; shortName?: string; crest?: string | null };
  goals?: number | null;
  assists?: number | null;
  playedMatches?: number | null;
}

async function fdFetch<T>(path: string, revalidate: number): Promise<T | null> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "X-Auth-Token": token },
      next: { revalidate },
    });
    // Heed the provider's throttling guidance.
    const remaining = res.headers.get("X-RequestsAvailable");
    const reset = res.headers.get("X-RequestCounter-Reset");
    if (remaining != null && Number(remaining) <= 0) {
      console.warn(`football-data: quota exhausted (reset in ${reset}s) — skipping ${path}`);
      return null;
    }
    if (!res.ok) {
      console.warn(`football-data: HTTP ${res.status} on ${path} (remaining ${remaining ?? "?"})`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`football-data fetch failed for ${path}:`, err);
    return null;
  }
}

function toMatch(m: ApiMatch): FootballMatch {
  return {
    id: m.id,
    utcDate: m.utcDate,
    status: m.status,
    competition: { name: m.competition?.name ?? "", emblem: m.competition?.emblem ?? null },
    home: { name: m.homeTeam?.shortName || m.homeTeam?.name || "—", crest: m.homeTeam?.crest ?? null },
    away: { name: m.awayTeam?.shortName || m.awayTeam?.name || "—", crest: m.awayTeam?.crest ?? null },
    scoreHome: m.score?.fullTime?.home ?? null,
    scoreAway: m.score?.fullTime?.away ?? null,
  };
}

// The provider names areas in English. The UI is French, so translate the ones
// the plan can return; anything unmapped falls through unchanged.
const AREA_FR: Record<string, string> = {
  Brazil: "Brésil",
  England: "Angleterre",
  Europe: "Europe",
  France: "France",
  Germany: "Allemagne",
  Italy: "Italie",
  Netherlands: "Pays-Bas",
  Portugal: "Portugal",
  "South America": "Amérique du Sud",
  Spain: "Espagne",
  World: "Monde",
};

function toCompetition(c: ApiCompetition): FootballCompetition {
  const area = c.area?.name ?? null;
  return {
    id: c.id,
    code: c.code ?? "",
    name: c.name ?? "",
    emblem: c.emblem ?? null,
    area: area ? (AREA_FR[area] ?? area) : null,
    type: c.type ?? null,
    areaFlag: c.area?.flag ?? null,
    seasonStart: c.currentSeason?.startDate ?? null,
    seasonEnd: c.currentSeason?.endDate ?? null,
    currentMatchday: c.currentSeason?.currentMatchday ?? null,
  };
}

type MatchPhase = "live" | "played" | "upcoming" | "void";

/**
 * Which bucket a fixture belongs in.
 *
 * `status` alone is NOT trustworthy: the provider sometimes ships a timestamp
 * string ("2026-08-16 18:30:00Z") in that field instead of TIMED/FINISHED, and
 * a switch on the documented values silently drops those matches. So the score
 * and the kick-off time decide, and `status` is only consulted for the live
 * flag and for fixtures that never happened.
 *
 * "void" = kicked off long ago with no score — postponed, cancelled or
 * abandoned. Showing it as a result or as an upcoming match both lie, so it is
 * dropped.
 */
function classify(m: ApiMatch, scored: boolean, now: number): MatchPhase {
  if (m.status === "IN_PLAY" || m.status === "PAUSED") return "live";
  if (scored) return "played";
  return Date.parse(m.utcDate) <= now ? "void" : "upcoming";
}

/** Today's matches across the plan's competitions, split by status. Cached ~90s. */
export async function getTodayFootball(): Promise<TodayFootball> {
  const data = await fdFetch<{ matches: ApiMatch[] }>("/matches", 90);
  const matches = data?.matches ?? [];
  const now = Date.now();
  const live: FootballMatch[] = [];
  const finished: FootballMatch[] = [];
  const upcoming: FootballMatch[] = [];
  for (const m of matches) {
    const fm = toMatch(m);
    const scored = fm.scoreHome != null && fm.scoreAway != null;
    switch (classify(m, scored, now)) {
      case "live": live.push(fm); break;
      case "played": finished.push(fm); break;
      case "upcoming": upcoming.push(fm); break;
      case "void": break;
    }
  }
  upcoming.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  finished.sort((a, b) => b.utcDate.localeCompare(a.utcDate));
  return { live, finished, upcoming };
}

// Shared by both competition lists below: one cached call to /competitions,
// indexed by code. Same URL + options as any other caller, so React memoises
// it within a render pass and Next caches it across requests.
async function competitionsByCode(): Promise<Map<string, FootballCompetition>> {
  const data = await fdFetch<{ competitions: ApiCompetition[] }>("/competitions", 86400);
  const byCode = new Map<string, FootballCompetition>();
  for (const c of data?.competitions ?? []) {
    if (c.code) byCode.set(c.code, toCompetition(c));
  }
  return byCode;
}

/** Curated featured competitions. Cached ~1 day. */
export async function getFeaturedCompetitions(): Promise<FootballCompetition[]> {
  const byCode = await competitionsByCode();
  // Preserve the curated order (CL, PL, FL1, …) for a stable layout.
  return FEATURED_CODES.map((code) => byCode.get(code)).filter((c): c is FootballCompetition => !!c);
}

/**
 * Every competition on the plan, in curated order — the "Le foot mondial"
 * section of the public directory. Cached ~1 day.
 */
export async function getWorldCompetitions(): Promise<FootballCompetition[]> {
  const byCode = await competitionsByCode();
  return WORLD_CODES.map((code) => byCode.get(code)).filter((c): c is FootballCompetition => !!c);
}

/** Is `code` one we serve a page for? Guards the [code] route against 403s. */
export function isWorldCode(code: string): boolean {
  return WORLD_CODES.includes(code.toUpperCase());
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Standings, a window of fixtures and the scoring chart for one competition —
 * everything the /competitions/monde/[code] tabs need, in three cached calls.
 *
 * Standings carry the competition/season metadata, so there is no extra call
 * for the header. The fixture window is centred on today (recent results +
 * next kick-offs); competitions whose season is over (World Cup, Euro) return
 * an empty window, so those fall back to the full season and we keep the tail.
 */
export async function getWorldCompetitionSummary(
  code: string,
): Promise<WorldCompetitionSummary | null> {
  const upper = code.toUpperCase();
  if (!isWorldCode(upper)) return null;

  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - 14);
  const to = new Date(now);
  to.setDate(now.getDate() + 21);

  const [standingsRes, windowRes, scorersRes] = await Promise.all([
    fdFetch<{ competition?: ApiCompetition; standings?: ApiStandings[] }>(
      `/competitions/${upper}/standings`,
      900,
    ),
    fdFetch<{ matches?: ApiMatch[] }>(
      `/competitions/${upper}/matches?dateFrom=${ymd(from)}&dateTo=${ymd(to)}`,
      600,
    ),
    // The chart barely moves between matchdays — cache it for an hour.
    fdFetch<{ scorers?: ApiScorer[] }>(`/competitions/${upper}/scorers?limit=20`, 3600),
  ]);

  // Without the competition header there is nothing meaningful to render.
  if (!standingsRes?.competition) return null;

  let matches = windowRes?.matches ?? [];
  if (matches.length === 0) {
    // Season over (or not yet started): fall back to the whole calendar. Cached
    // for a day — a dormant competition does not move.
    const all = await fdFetch<{ matches?: ApiMatch[] }>(`/competitions/${upper}/matches`, 86400);
    matches = all?.matches ?? [];
  }

  const nowMs = Date.now();
  const recent: FootballMatch[] = [];
  const upcoming: FootballMatch[] = [];
  for (const m of matches) {
    const fm = toMatch(m);
    const scored = fm.scoreHome != null && fm.scoreAway != null;
    switch (classify(m, scored, nowMs)) {
      // A match in progress belongs at the top of the results, not among the
      // fixtures still to come — the list badges it LIVE.
      case "live":
      case "played": recent.push(fm); break;
      case "upcoming": upcoming.push(fm); break;
      case "void": break;
    }
  }
  recent.sort((a, b) => b.utcDate.localeCompare(a.utcDate));
  upcoming.sort((a, b) => a.utcDate.localeCompare(b.utcDate));

  // TOTAL is the home+away table; the provider also ships HOME/AWAY splits we
  // do not show. Cups repeat TOTAL once per group.
  const standings: WorldStandingsGroup[] = (standingsRes.standings ?? [])
    .filter((s) => s.type === "TOTAL")
    .map((s) => ({
      // A straight league table comes back labelled "Matchday" — that is not a
      // group name, so it must not become a section heading.
      group: !s.group || /^matchday$/i.test(s.group) ? null : s.group,
      rows: (s.table ?? []).map((r) => ({
        position: r.position ?? 0,
        team: {
          id: r.team?.id ?? 0,
          name: r.team?.shortName || r.team?.name || "—",
          crest: r.team?.crest ?? null,
        },
        played: r.playedGames ?? 0,
        won: r.won ?? 0,
        draw: r.draw ?? 0,
        lost: r.lost ?? 0,
        goalsFor: r.goalsFor ?? 0,
        goalsAgainst: r.goalsAgainst ?? 0,
        goalDifference: r.goalDifference ?? 0,
        points: r.points ?? 0,
      })),
    }))
    // Before a ball is kicked the provider still ships a full table, every team
    // ranked 1st on zero points. That is not a standing — drop it and let the
    // page say the season has not started.
    .filter((g) => g.rows.length > 0 && g.rows.some((r) => r.played > 0));

  // A player with no goals is not a scorer — the chart is empty until the
  // season produces one, and the Buteurs tab hides itself accordingly.
  const scorers: WorldScorer[] = (scorersRes?.scorers ?? [])
    .filter((s) => (s.goals ?? 0) > 0)
    .map((s) => ({
      playerId: s.player?.id ?? 0,
      playerName: s.player?.name ?? "—",
      nationality: s.player?.nationality ?? null,
      team: {
        name: s.team?.shortName || s.team?.name || "—",
        crest: s.team?.crest ?? null,
      },
      goals: s.goals ?? 0,
      assists: s.assists ?? null,
      playedMatches: s.playedMatches ?? null,
    }));

  return {
    competition: toCompetition(standingsRes.competition),
    standings,
    recent: recent.slice(0, 30),
    upcoming: upcoming.slice(0, 30),
    scorers,
  };
}
