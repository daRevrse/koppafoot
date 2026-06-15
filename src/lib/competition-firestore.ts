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
