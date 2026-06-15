import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  arrayUnion,
  increment,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Competition, FirestoreCompetition,
  CompTeam, FirestoreCompTeam,
  CompMatch, FirestoreCompMatch,
  CompetitionFormat,
} from "@/types";

// ============================================
// Helpers
// ============================================

type FirestoreDate = string | { seconds?: number; toDate?: () => Date } | null | undefined;

/**
 * Convert Firestore dates (string or Timestamp) to ISO string.
 * Mirrors the formatDate helper in firestore.ts (typed, no `any`).
 */
function formatDate(date: FirestoreDate): string {
  if (!date) return new Date().toISOString();
  if (typeof date === "string") return date;
  // Handle Firestore serverTimestamp placeholder (no toDate or seconds on first snapshot)
  if (!date.seconds && !date.toDate) return new Date().toISOString();
  if (typeof date.toDate === "function") return date.toDate().toISOString();
  if (date.seconds) return new Date(date.seconds * 1000).toISOString();
  return new Date().toISOString();
}

/**
 * lowercase; strip accents; collapse runs of non-alphanumerics to a single "-"; trim edge "-".
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ============================================
// Converters
// ============================================

export function toCompetition(id: string, d: FirestoreCompetition): Competition {
  return {
    id,
    name: d.name,
    slug: d.slug,
    description: d.description,
    logoUrl: d.logo_url,
    bannerUrl: d.banner_url,
    organizerIds: d.organizer_ids ?? [],
    createdBy: d.created_by,
    status: d.status,
    format: d.format,
    startDate: d.start_date,
    endDate: d.end_date,
    venueCity: d.venue_city,
    createdAt: formatDate(d.created_at),
    updatedAt: formatDate(d.updated_at),
  };
}

export function toCompTeam(id: string, competitionId: string, d: FirestoreCompTeam): CompTeam {
  return {
    id,
    competitionId,
    name: d.name,
    shortName: d.short_name,
    logoUrl: d.logo_url,
    color: d.color,
    group: d.group,
    createdAt: formatDate(d.created_at),
    updatedAt: formatDate(d.updated_at),
  };
}

export function toCompMatch(id: string, d: FirestoreCompMatch): CompMatch {
  return {
    id,
    competitionId: d.competition_id,
    stage: d.stage,
    group: d.group,
    round: d.round,
    bracketSlot: d.bracket_slot,
    homeTeamId: d.home_team_id,
    awayTeamId: d.away_team_id,
    homeTeamName: d.home_team_name,
    awayTeamName: d.away_team_name,
    homeTeamLogo: d.home_team_logo,
    awayTeamLogo: d.away_team_logo,
    date: d.date,
    time: d.time,
    venueName: d.venue_name,
    venueCity: d.venue_city,
    status: d.status,
    scoreHome: d.score_home,
    scoreAway: d.score_away,
    penaltyHome: d.penalty_home,
    penaltyAway: d.penalty_away,
    winnerTeamId: d.winner_team_id,
    feedsIntoMatchId: d.feeds_into_match_id,
    feedsIntoSlot: d.feeds_into_slot,
    liveState: d.live_state ? {
      currentPeriod: d.live_state.current_period,
      timerStartAt: d.live_state.timer_start_at,
      timerOffset: d.live_state.timer_offset,
      isTimerRunning: d.live_state.is_timer_running,
      events: (d.live_state.events || []).map(e => ({
        id: e.id,
        type: e.type,
        period: e.period,
        minute: e.minute,
        teamId: e.team_id,
        playerId: e.player_id,
        playerName: e.player_name,
        detail: e.detail,
        contestedByManagerId: e.contested_by_manager_id,
        contestationReason: e.contestation_reason,
        createdAt: e.created_at,
      })),
    } : null,
    createdAt: formatDate(d.created_at),
    updatedAt: formatDate(d.updated_at),
  };
}

// ============================================
// Competitions
// ============================================

export async function createCompetition(input: {
  name: string;
  description?: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  format: CompetitionFormat;
  startDate?: string | null;
  endDate?: string | null;
  venueCity?: string | null;
  createdBy: string;
}): Promise<string> {
  // Ensure slug uniqueness: slug, slug-2, slug-3, ...
  // Fallback when the name has no slug-able chars, so we never write an empty slug.
  const base = slugify(input.name) || "competition";
  let slug = base;
  let suffix = 2;
  while (true) {
    const q = query(collection(db, "competitions"), where("slug", "==", slug), firestoreLimit(1));
    const snap = await getDocs(q);
    if (snap.empty) break;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  const payload: Record<string, unknown> = {
    name: input.name,
    slug,
    logo_url: input.logoUrl ?? null,
    banner_url: input.bannerUrl ?? null,
    organizer_ids: [input.createdBy],
    created_by: input.createdBy,
    status: "draft",
    format: input.format,
    start_date: input.startDate ?? null,
    end_date: input.endDate ?? null,
    venue_city: input.venueCity ?? null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  if (input.description !== undefined) payload.description = input.description;

  const ref = await addDoc(collection(db, "competitions"), payload);
  return ref.id;
}

export async function getCompetition(id: string): Promise<Competition | null> {
  const snap = await getDoc(doc(db, "competitions", id));
  if (!snap.exists()) return null;
  return toCompetition(snap.id, snap.data() as FirestoreCompetition);
}

export async function getCompetitionBySlug(slug: string): Promise<Competition | null> {
  const q = query(collection(db, "competitions"), where("slug", "==", slug), firestoreLimit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return toCompetition(d.id, d.data() as FirestoreCompetition);
}

export async function listCompetitionsByOrganizer(uid: string): Promise<Competition[]> {
  const q = query(
    collection(db, "competitions"),
    where("organizer_ids", "array-contains", uid),
    orderBy("created_at", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toCompetition(d.id, d.data() as FirestoreCompetition));
}

export function onCompetition(id: string, cb: (c: Competition | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, "competitions", id),
    (snap) => {
      cb(snap.exists() ? toCompetition(snap.id, snap.data() as FirestoreCompetition) : null);
    },
    (error) => {
      console.error("Error in onCompetition listener:", error);
    },
  );
}

export async function updateCompetition(id: string, patch: Partial<FirestoreCompetition>): Promise<void> {
  await updateDoc(doc(db, "competitions", id), { ...patch, updated_at: serverTimestamp() });
}

// ============================================
// Competition Teams (subcollection: competitions/{cid}/comp_teams/{tid})
// ============================================

export async function createCompTeam(
  cid: string,
  input: { name: string; shortName: string; color: string; logoUrl?: string | null },
): Promise<string> {
  const payload: Record<string, unknown> = {
    name: input.name,
    short_name: input.shortName,
    color: input.color,
    logo_url: input.logoUrl ?? null,
    group: null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, "competitions", cid, "comp_teams"), payload);
  return ref.id;
}

export async function listCompTeams(cid: string): Promise<CompTeam[]> {
  const q = query(collection(db, "competitions", cid, "comp_teams"), orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toCompTeam(d.id, cid, d.data() as FirestoreCompTeam));
}

export function onCompTeams(cid: string, cb: (teams: CompTeam[]) => void): Unsubscribe {
  const q = query(collection(db, "competitions", cid, "comp_teams"), orderBy("name", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => toCompTeam(d.id, cid, d.data() as FirestoreCompTeam)));
    },
    (error) => {
      console.error("Error in onCompTeams listener:", error);
    },
  );
}

export async function getCompTeam(cid: string, tid: string): Promise<CompTeam | null> {
  const snap = await getDoc(doc(db, "competitions", cid, "comp_teams", tid));
  if (!snap.exists()) return null;
  return toCompTeam(snap.id, cid, snap.data() as FirestoreCompTeam);
}

export async function updateCompTeam(
  cid: string,
  tid: string,
  patch: Partial<FirestoreCompTeam>,
): Promise<void> {
  await updateDoc(doc(db, "competitions", cid, "comp_teams", tid), {
    ...patch,
    updated_at: serverTimestamp(),
  });
}

export async function deleteCompTeam(cid: string, tid: string): Promise<void> {
  await deleteDoc(doc(db, "competitions", cid, "comp_teams", tid));
}

// ============================================
// Competition Matches (subcollection: competitions/{cid}/comp_matches/{mid})
// ============================================

/** Single round-robin pairings for one group. Returns [homeId, awayId][]. */
export function roundRobinPairs(teamIds: string[]): [string, string][] {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push("__BYE__");
  const n = ids.length;
  const rounds: [string, string][] = [];
  const arr = [...ids];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a !== "__BYE__" && b !== "__BYE__") rounds.push([a, b]);
    }
    // rotate keeping first fixed
    arr.splice(1, 0, arr.pop() as string);
  }
  return rounds;
}

/**
 * Generate single round-robin group-stage fixtures for a competition.
 *
 * Idempotency: if any group-stage match already exists we return early WITHOUT
 * creating duplicates (the UI is responsible for messaging "already generated").
 * Re-running is therefore a no-op rather than an error.
 *
 * Teams are grouped by their `group` field; teams with `group == null` (unassigned)
 * are ignored. Within each group, `roundRobinPairs` produces every unordered pair once.
 * Team name/logo are denormalized onto each match doc (logo → null when absent).
 */
export async function generateGroupFixtures(cid: string): Promise<void> {
  const competition = await getCompetition(cid);
  if (!competition) throw new Error(`Competition ${cid} not found`);

  // Idempotency guard: bail out if group fixtures already exist.
  const matchesCol = collection(db, "competitions", cid, "comp_matches");
  const existing = await getDocs(query(matchesCol, where("stage", "==", "group")));
  if (!existing.empty) return;

  const teams = await listCompTeams(cid);

  // Group assigned teams by their group letter.
  const groups = new Map<string, CompTeam[]>();
  for (const team of teams) {
    if (team.group == null) continue;
    const bucket = groups.get(team.group);
    if (bucket) bucket.push(team);
    else groups.set(team.group, [team]);
  }

  const byId = new Map<string, CompTeam>(teams.map((t) => [t.id, t]));

  const batch = writeBatch(db);
  let pairCount = 0;

  for (const [groupLetter, groupTeams] of groups) {
    const pairs = roundRobinPairs(groupTeams.map((t) => t.id));
    for (const [homeId, awayId] of pairs) {
      const home = byId.get(homeId);
      const away = byId.get(awayId);
      if (!home || !away) continue; // defensive; pairs come from team ids
      const ref = doc(matchesCol);
      const data: FirestoreCompMatch = {
        competition_id: cid,
        stage: "group",
        group: groupLetter,
        round: null,
        bracket_slot: null,
        home_team_id: homeId,
        away_team_id: awayId,
        home_team_name: home.name,
        away_team_name: away.name,
        home_team_logo: home.logoUrl ?? null,
        away_team_logo: away.logoUrl ?? null,
        date: null,
        time: null,
        venue_name: null,
        venue_city: null,
        status: "scheduled",
        score_home: null,
        score_away: null,
        penalty_home: null,
        penalty_away: null,
        winner_team_id: null,
        feeds_into_match_id: null,
        feeds_into_slot: null,
        live_state: null,
        // serverTimestamp() returns a FieldValue, not a string, at write time.
        created_at: serverTimestamp() as unknown as string,
        updated_at: serverTimestamp() as unknown as string,
      };
      batch.set(ref, data);
      pairCount += 1;
    }
  }

  if (pairCount > 0) await batch.commit();
}

export function onCompMatches(cid: string, cb: (m: CompMatch[]) => void): Unsubscribe {
  // Firestore orders nulls first, so undated fixtures sort ahead of scheduled ones.
  const q = query(collection(db, "competitions", cid, "comp_matches"), orderBy("date", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch)));
    },
    (error) => {
      console.error("Error in onCompMatches listener:", error);
    },
  );
}

export function onCompMatch(cid: string, mid: string, cb: (m: CompMatch | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, "competitions", cid, "comp_matches", mid),
    (snap) => {
      cb(snap.exists() ? toCompMatch(snap.id, snap.data() as FirestoreCompMatch) : null);
    },
    (error) => {
      console.error("Error in onCompMatch listener:", error);
    },
  );
}

export async function getCompMatch(cid: string, mid: string): Promise<CompMatch | null> {
  const snap = await getDoc(doc(db, "competitions", cid, "comp_matches", mid));
  if (!snap.exists()) return null;
  return toCompMatch(snap.id, snap.data() as FirestoreCompMatch);
}

export async function updateCompMatch(
  cid: string,
  mid: string,
  patch: Partial<FirestoreCompMatch>,
): Promise<void> {
  await updateDoc(doc(db, "competitions", cid, "comp_matches", mid), {
    ...patch,
    updated_at: serverTimestamp(),
  });
}

export async function scheduleCompMatch(
  cid: string,
  mid: string,
  input: { date: string; time: string; venueName: string; venueCity: string },
): Promise<void> {
  await updateCompMatch(cid, mid, {
    date: input.date,
    time: input.time,
    venue_name: input.venueName,
    venue_city: input.venueCity,
  });
}

// ============================================
// Competition Live Match Engine
//
// Timer + period + event writers ported from the referee flow in firestore.ts
// (initLiveMatch / startMatchTimer / pauseMatchTimer / updateMatchPeriod /
// addMatchEvent), retargeted to the comp_matches subcollection. The stored
// shapes mirror firestore.ts EXACTLY so the shared live view (which reads
// `timerStartAt` and does `new Date(timerStartAt).getTime()`) keeps working:
// `timer_start_at` is an ISO string (new Date().toISOString()), never a
// serverTimestamp. Event ids use the same scheme. Goals increment the score.
// ============================================

/** Stored shape of a single live event (one entry of `live_state.events`). */
type StoredCompEvent = {
  id: string;
  type: "goal" | "yellow_card" | "red_card";
  period: number;
  minute: number;
  team_id: string;
  player_id: string | null;
  player_name: string | null;
  detail: string | null;
  created_at: string;
};

const compMatchRef = (cid: string, mid: string) =>
  doc(db, "competitions", cid, "comp_matches", mid);

/**
 * Initialise live state for a competition match. Mirrors `initLiveMatch`:
 * status -> "live", fresh `live_state`, scores reset to 0.
 */
export async function initLiveCompMatch(cid: string, mid: string): Promise<void> {
  await updateDoc(compMatchRef(cid, mid), {
    status: "live",
    live_state: {
      current_period: 1,
      timer_start_at: null,
      timer_offset: 0,
      is_timer_running: false,
      events: [],
    },
    score_home: 0,
    score_away: 0,
    updated_at: serverTimestamp(),
  });
}

/**
 * Start (or resume) the match clock. Mirrors `startMatchTimer` exactly:
 * `timer_start_at` is stored as an ISO string so the live view's
 * `new Date(timerStartAt).getTime()` resolves correctly.
 */
export async function startCompTimer(cid: string, mid: string): Promise<void> {
  await updateDoc(compMatchRef(cid, mid), {
    "live_state.is_timer_running": true,
    "live_state.timer_start_at": new Date().toISOString(),
    updated_at: serverTimestamp(),
  });
}

/**
 * Pause the match clock. Mirrors `pauseMatchTimer`: persist elapsed ms in
 * `timer_offset`, stop the clock, and clear `timer_start_at`.
 */
export async function pauseCompTimer(cid: string, mid: string, elapsedMs: number): Promise<void> {
  await updateDoc(compMatchRef(cid, mid), {
    "live_state.is_timer_running": false,
    "live_state.timer_start_at": null,
    "live_state.timer_offset": elapsedMs,
    updated_at: serverTimestamp(),
  });
}

/** Set the current period. Mirrors `updateMatchPeriod` (dotted field update). */
export async function updateCompPeriod(cid: string, mid: string, period: number): Promise<void> {
  await updateDoc(compMatchRef(cid, mid), {
    "live_state.current_period": period,
    updated_at: serverTimestamp(),
  });
}

/**
 * Append a goal/card event to `live_state.events` and, for goals, bump the
 * scoreboard. Mirrors `addMatchEvent`: same id scheme, `arrayUnion`, ISO
 * `created_at`. There is no roster here, so the scorer is free text
 * (`player_name`, may be null) and `player_id` is always null. Never writes
 * `undefined` into the event (all optionals are coerced to null). The score
 * field is chosen by `side` ("home" -> score_home, "away" -> score_away)
 * because `team_id` holds a real team id, not a side keyword.
 */
export async function addCompEvent(
  cid: string,
  mid: string,
  event: {
    type: "goal" | "yellow_card" | "red_card";
    side: "home" | "away";
    team_id: string;
    period: number;
    minute: number;
    player_name?: string | null;
    detail?: string | null;
  },
): Promise<void> {
  const newEvent: StoredCompEvent = {
    id: Math.random().toString(36).substring(2, 11),
    type: event.type,
    period: event.period,
    minute: event.minute,
    team_id: event.team_id,
    player_id: null,
    player_name: event.player_name ?? null,
    detail: event.detail ?? null,
    created_at: new Date().toISOString(),
  };

  const updates: Record<string, unknown> = {
    "live_state.events": arrayUnion(newEvent),
    updated_at: serverTimestamp(),
  };

  if (event.type === "goal") {
    updates[event.side === "home" ? "score_home" : "score_away"] = increment(1);
  }

  await updateDoc(compMatchRef(cid, mid), updates);
}

/**
 * Finish a competition match: resolve the winner, mark it completed, and
 * propagate the winner into its bracket successor (idempotently).
 *
 * Winner rules:
 *  - higher regulation score wins;
 *  - on a tie, a knockout match decided on penalties picks the higher penalty
 *    taker; any other tie (group draw, or knockout without penalties) yields no
 *    winner (`null`).
 *
 * Propagation only writes when the target slot does not already hold the
 * winner, so clicking "finish" twice is safe.
 */
export async function finishCompMatch(
  cid: string,
  mid: string,
  opts?: { penaltyHome?: number; penaltyAway?: number },
): Promise<void> {
  const m = await getCompMatch(cid, mid);
  if (!m) throw new Error(`Competition match ${mid} not found`);

  const scoreHome = m.scoreHome ?? 0;
  const scoreAway = m.scoreAway ?? 0;

  let winnerId: string | null = null;
  if (scoreHome > scoreAway) {
    winnerId = m.homeTeamId;
  } else if (scoreHome < scoreAway) {
    winnerId = m.awayTeamId;
  } else if (
    m.stage === "knockout" &&
    opts?.penaltyHome != null &&
    opts?.penaltyAway != null
  ) {
    if (opts.penaltyHome > opts.penaltyAway) winnerId = m.homeTeamId;
    else if (opts.penaltyHome < opts.penaltyAway) winnerId = m.awayTeamId;
  }

  await updateCompMatch(cid, mid, {
    status: "completed",
    winner_team_id: winnerId,
    penalty_home: opts?.penaltyHome ?? null,
    penalty_away: opts?.penaltyAway ?? null,
  });

  // Idempotent bracket propagation.
  if (m.feedsIntoMatchId && winnerId) {
    const tgt = await getCompMatch(cid, m.feedsIntoMatchId);
    const slot = m.feedsIntoSlot;
    if (tgt && slot) {
      const idField = slot === "home" ? "homeTeamId" : "awayTeamId";
      if (tgt[idField] !== winnerId) {
        const winnerTeam = await getCompTeam(cid, winnerId);
        await updateCompMatch(
          cid,
          m.feedsIntoMatchId,
          slot === "home"
            ? {
                home_team_id: winnerId,
                home_team_name: winnerTeam?.name ?? "",
                home_team_logo: winnerTeam?.logoUrl ?? null,
              }
            : {
                away_team_id: winnerId,
                away_team_name: winnerTeam?.name ?? "",
                away_team_logo: winnerTeam?.logoUrl ?? null,
              },
        );
      }
    }
  }
}

// ============================================
// Pure computation utilities (no Firestore I/O)
//
// These feed the public standings page, the scorers page, and (later)
// knockout bracket seeding. They take already-fetched arrays and return
// derived data — no `db`, no async, fully testable in isolation.
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

export interface TopScorer {
  playerName: string;
  teamId: string;
  goals: number;
}

/**
 * Aggregate goal counts per (player, team) across all matches' live events.
 *
 * Only events with `type === "goal"` and a non-empty trimmed `playerName` are
 * counted; anonymous goals (no/blank name) are not ranked. Names are matched
 * case-insensitively (trimmed + lowercased) but the first-seen original casing
 * is kept for display. Results are ordered by goals desc, then name asc.
 */
export function computeTopScorers(matches: CompMatch[]): TopScorer[] {
  // Key: `${lowercased trimmed name}__${teamId}` so "Léo" and "léo" on the
  // same team merge, while the same name on two teams stays separate.
  const byKey = new Map<string, TopScorer>();

  for (const match of matches) {
    const events = match.liveState?.events ?? [];
    for (const event of events) {
      if (event.type !== "goal") continue;
      const raw = event.playerName;
      if (raw == null) continue;
      const display = raw.trim();
      if (display === "") continue;

      const key = `${display.toLowerCase()}__${event.teamId}`;
      const existing = byKey.get(key);
      if (existing) existing.goals += 1;
      else byKey.set(key, { playerName: display, teamId: event.teamId, goals: 1 });
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => b.goals - a.goals || a.playerName.localeCompare(b.playerName),
  );
}
