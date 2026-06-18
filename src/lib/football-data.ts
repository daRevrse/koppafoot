// Server-only client for football-data.org (real football content on the home).
// Token in FOOTBALL_DATA_TOKEN (.env.local). MUST NOT be imported into a client
// component. Rate-limit aware (free tier ~10 req/min): reads the provider's
// X-RequestsAvailable / X-RequestCounter-Reset headers and self-throttles, on top
// of ISR caching (next.revalidate). Every function degrades gracefully (returns
// [] / null) so the home never breaks when the token is missing or quota is hit.

const BASE = "https://api.football-data.org/v4";

// Curated free-tier competitions to feature (codes available on the free plan).
const FEATURED_CODES = ["CL", "PL", "FL1", "BL1", "SA", "PD"];

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
interface ApiCompetition {
  id: number;
  code?: string;
  name?: string;
  emblem?: string | null;
  area?: { name?: string };
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

/** Today's matches across the plan's competitions, split by status. Cached ~90s. */
export async function getTodayFootball(): Promise<TodayFootball> {
  const data = await fdFetch<{ matches: ApiMatch[] }>("/matches", 90);
  const matches = data?.matches ?? [];
  const live: FootballMatch[] = [];
  const finished: FootballMatch[] = [];
  const upcoming: FootballMatch[] = [];
  for (const m of matches) {
    const fm = toMatch(m);
    if (m.status === "IN_PLAY" || m.status === "PAUSED") live.push(fm);
    else if (m.status === "FINISHED") finished.push(fm);
    else if (m.status === "TIMED" || m.status === "SCHEDULED") upcoming.push(fm);
  }
  upcoming.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  finished.sort((a, b) => b.utcDate.localeCompare(a.utcDate));
  return { live, finished, upcoming };
}

/** Curated featured competitions. Cached ~1 day. */
export async function getFeaturedCompetitions(): Promise<FootballCompetition[]> {
  const data = await fdFetch<{ competitions: ApiCompetition[] }>("/competitions", 86400);
  const all = data?.competitions ?? [];
  const wanted = new Set(FEATURED_CODES);
  // Preserve the curated order (CL, PL, FL1, …) for a stable layout.
  const byCode = new Map<string, FootballCompetition>();
  for (const c of all) {
    if (c.code && wanted.has(c.code)) {
      byCode.set(c.code, {
        id: c.id,
        code: c.code,
        name: c.name ?? "",
        emblem: c.emblem ?? null,
        area: c.area?.name ?? null,
      });
    }
  }
  return FEATURED_CODES.map((code) => byCode.get(code)).filter((c): c is FootballCompetition => !!c);
}
