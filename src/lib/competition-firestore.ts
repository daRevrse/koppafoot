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
  arrayRemove,
  increment,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Competition, FirestoreCompetition,
  CompTeam, FirestoreCompTeam,
  CompMatch, FirestoreCompMatch,
  CompMatchRound, CompMatchStage,
  CompetitionFormat,
  CompPlayer, LineupEntry, FirestoreLineupEntry,
} from "@/types";
import { toCompetition, toCompTeam, toCompMatch } from "./competition-mappers";

// Converters now live in the SDK-agnostic competition-mappers module so the
// server lib (firebase-admin) can reuse them. Re-exported for existing importers.
export { toCompetition, toCompTeam, toCompMatch };

// ============================================
// Follow (push notifications on kickoff/goal/final)
// ============================================

/** Add/remove a competition from the user's followed list (own doc only). */
export async function setCompetitionFollow(
  uid: string,
  cid: string,
  follow: boolean,
): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    followed_competition_ids: follow ? arrayUnion(cid) : arrayRemove(cid),
    updated_at: serverTimestamp(),
  });
}

// ============================================
// Helpers
// ============================================

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
    moderator_ids: [],
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

// Relevance rank shared with competition-admin.getPublicCompetitions:
// ongoing first, then upcoming, then finished (draft filtered out).
const PUBLIC_STATUS_RANK: Record<Competition["status"], number> = {
  group_stage: 0, knockout: 0, registration: 1, completed: 2, draft: 99,
};

/**
 * Client-side equivalent of competition-admin.getPublicCompetitions — all
 * publicly-visible competitions (status != draft), most relevant first.
 * Used by logged-in surfaces (dashboard) that need client Firestore.
 */
export async function listPublicCompetitions(): Promise<Competition[]> {
  const snap = await getDocs(collection(db, "competitions"));
  const comps = snap.docs
    .map((d) => toCompetition(d.id, d.data() as FirestoreCompetition))
    .filter((c) => c.status !== "draft");
  comps.sort((a, b) => {
    const r = PUBLIC_STATUS_RANK[a.status] - PUBLIC_STATUS_RANK[b.status];
    if (r !== 0) return r;
    return (b.startDate ?? b.createdAt).localeCompare(a.startDate ?? a.createdAt);
  });
  return comps;
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

/**
 * Competitions the user can act on as staff: those they moderate plus those
 * they organize (a user may be both). Two `array-contains` queries — neither
 * uses `orderBy`, so no composite index is required (array-contains is
 * auto-indexed). Results are merged, de-duped by id, and sorted by `createdAt`
 * desc in memory.
 */
export async function listModeratedCompetitions(uid: string): Promise<Competition[]> {
  const [modSnap, orgSnap] = await Promise.all([
    getDocs(query(collection(db, "competitions"), where("moderator_ids", "array-contains", uid))),
    getDocs(query(collection(db, "competitions"), where("organizer_ids", "array-contains", uid))),
  ]);

  const byId = new Map<string, Competition>();
  for (const d of [...modSnap.docs, ...orgSnap.docs]) {
    if (!byId.has(d.id)) {
      byId.set(d.id, toCompetition(d.id, d.data() as FirestoreCompetition));
    }
  }

  return Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

/**
 * Propagate a team's denormalised name/logo onto its matches.
 *
 * Matches snapshot `home_team_name` / `home_team_logo` (and away) at creation
 * time, so a logo uploaded (or a name changed) afterwards would not show on
 * match cards. Call this after editing a team so every surface that reads the
 * match-level fields (Direct feed, match page, calendar, bracket) stays in
 * sync. Returns the number of matches touched.
 */
export async function syncTeamToMatches(
  cid: string,
  teamId: string,
  data: { name: string; logoUrl: string | null },
): Promise<number> {
  const matchesCol = collection(db, "competitions", cid, "comp_matches");
  const [homeSnap, awaySnap] = await Promise.all([
    getDocs(query(matchesCol, where("home_team_id", "==", teamId))),
    getDocs(query(matchesCol, where("away_team_id", "==", teamId))),
  ]);

  if (homeSnap.empty && awaySnap.empty) return 0;

  const batch = writeBatch(db);
  homeSnap.forEach((d) =>
    batch.update(d.ref, { home_team_name: data.name, home_team_logo: data.logoUrl }),
  );
  awaySnap.forEach((d) =>
    batch.update(d.ref, { away_team_name: data.name, away_team_logo: data.logoUrl }),
  );
  await batch.commit();
  return homeSnap.size + awaySnap.size;
}

// ============================================
// Roster (players live on the comp_team doc as a small array — read-modify-write)
// ============================================

export async function addCompPlayer(
  cid: string,
  tid: string,
  input: { name: string; number: string; position?: string },
): Promise<void> {
  const team = await getCompTeam(cid, tid);
  if (!team) throw new Error(`Comp team ${tid} not found`);
  const player: CompPlayer = {
    id: Math.random().toString(36).substring(2, 11),
    name: input.name,
    number: input.number,
    ...(input.position ? { position: input.position } : {}),
  };
  await updateCompTeam(cid, tid, { players: [...team.players, player] });
}

export async function updateCompPlayer(
  cid: string,
  tid: string,
  playerId: string,
  patch: { name?: string; number?: string; position?: string },
): Promise<void> {
  const team = await getCompTeam(cid, tid);
  if (!team) throw new Error(`Comp team ${tid} not found`);
  const players: CompPlayer[] = team.players.map((p) => {
    if (p.id !== playerId) return p;
    const position = patch.position ?? p.position;
    return {
      id: p.id,
      name: patch.name ?? p.name,
      number: patch.number ?? p.number,
      ...(position ? { position } : {}),
    };
  });
  await updateCompTeam(cid, tid, { players });
}

export async function removeCompPlayer(cid: string, tid: string, playerId: string): Promise<void> {
  const team = await getCompTeam(cid, tid);
  if (!team) throw new Error(`Comp team ${tid} not found`);
  await updateCompTeam(cid, tid, { players: team.players.filter((p) => p.id !== playerId) });
}

/** Set (or update) one side's match sheet on a comp_match + its ready flag. */
export async function setCompMatchLineup(
  cid: string,
  mid: string,
  side: "home" | "away",
  entries: LineupEntry[],
  ready: boolean,
): Promise<void> {
  const firestoreEntries: FirestoreLineupEntry[] = entries.map((e) => ({
    player_id: e.playerId,
    name: e.name,
    number: e.number,
    role: e.role,
  }));
  const patch: Partial<FirestoreCompMatch> =
    side === "home"
      ? { home_lineup: firestoreEntries, home_lineup_ready: ready }
      : { away_lineup: firestoreEntries, away_lineup_ready: ready };
  await updateCompMatch(cid, mid, patch);
}

// ============================================
// Bulk import (paste / CSV) — teams+players and matches
// ============================================

/**
 * Split pasted/CSV text into trimmed cells. Detects the delimiter from the first
 * non-empty line (tab > semicolon > comma — FR Excel uses ';'), drops empty lines.
 * Column mapping + header-skip are the caller's job (it knows the expected columns).
 */
export function parseDelimited(text: string): string[][] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const first = lines[0];
  const delim = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ",";
  return lines.map((l) => l.split(delim).map((c) => c.trim()));
}

export interface ImportTeamRow {
  name: string;
  shortName?: string;
  group?: string;
  color?: string;
}

/**
 * Create/reuse teams by name from team rows. Re-importing a team updates its
 * short name / poule / colour (only the provided fields). Rosters are set
 * separately, per team, via setTeamRoster.
 */
export async function importTeams(
  cid: string,
  rows: ImportTeamRow[],
): Promise<{ created: number; updated: number }> {
  const existing = await listCompTeams(cid);
  const byName = new Map(existing.map((t) => [t.name.trim().toLowerCase(), t]));

  let created = 0;
  let updated = 0;

  for (const r of rows) {
    const name = r.name.trim();
    if (!name) continue;
    const shortName = r.shortName?.trim() || name.slice(0, 3).toUpperCase();
    const color = r.color?.trim() || "#059669";
    const group = r.group?.trim() || null;

    const found = byName.get(name.toLowerCase());
    if (found) {
      await updateCompTeam(cid, found.id, {
        short_name: shortName,
        color,
        group,
      });
      updated += 1;
    } else {
      const tid = await createCompTeam(cid, { name, shortName, color });
      if (group) await updateCompTeam(cid, tid, { group });
      created += 1;
    }
  }

  return { created, updated };
}

export interface ImportRosterRow {
  name: string;
  number: string;
  position?: string;
}

/**
 * Replace a single team's roster from the rows (idempotent — re-importing
 * overwrites the previous roster). The organizer picks the team first, so
 * roster rows carry no team column.
 */
export async function setTeamRoster(
  cid: string,
  teamId: string,
  rows: ImportRosterRow[],
): Promise<{ players: number }> {
  const roster: CompPlayer[] = rows
    .filter((r) => r.name.trim())
    .map((r) => {
      const position = r.position?.trim();
      return {
        id: Math.random().toString(36).substring(2, 11),
        name: r.name.trim(),
        number: r.number.trim(),
        ...(position ? { position } : {}),
      };
    });

  await updateCompTeam(cid, teamId, { players: roster });
  return { players: roster.length };
}

export interface ImportMatchRow {
  home: string;
  away: string;
  date?: string;
  time?: string;
  venue?: string;
  group?: string;
}

/**
 * Create group/standalone matches from rows, resolving teams by name (rows whose
 * home/away team is unknown are skipped). Denormalizes team name/logo. Knockout
 * bracket wiring is NOT done here (use generateKnockout for that).
 */
export async function importMatches(
  cid: string,
  rows: ImportMatchRow[],
): Promise<{ created: number; skipped: number }> {
  const teams = await listCompTeams(cid);
  const byName = new Map(teams.map((t) => [t.name.trim().toLowerCase(), t]));
  const matchesCol = collection(db, "competitions", cid, "comp_matches");

  const batch = writeBatch(db);
  let created = 0;
  let skipped = 0;

  for (const r of rows) {
    const home = byName.get(r.home.trim().toLowerCase());
    const away = byName.get(r.away.trim().toLowerCase());
    if (!home || !away) {
      skipped += 1;
      continue;
    }
    const ref = doc(matchesCol);
    const data: FirestoreCompMatch = {
      competition_id: cid,
      stage: "group",
      group: r.group?.trim() || null,
      round: null,
      bracket_slot: null,
      home_team_id: home.id,
      away_team_id: away.id,
      home_team_name: home.name,
      away_team_name: away.name,
      home_team_logo: home.logoUrl ?? null,
      away_team_logo: away.logoUrl ?? null,
      date: r.date?.trim() || null,
      time: r.time?.trim() || null,
      venue_name: r.venue?.trim() || null,
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
      created_at: serverTimestamp() as unknown as string,
      updated_at: serverTimestamp() as unknown as string,
    };
    batch.set(ref, data);
    created += 1;
  }

  if (created > 0) await batch.commit();
  return { created, skipped };
}

/**
 * Create a single match from scratch (organizer "add match" flow). Resolves
 * the two teams by id to denormalise name/logo. Defaults to a group match;
 * pass stage/round for a knockout fixture (bracket wiring stays manual).
 */
export async function createCompMatch(
  cid: string,
  input: {
    homeTeamId: string;
    awayTeamId: string;
    stage?: CompMatchStage;
    group?: string | null;
    round?: CompMatchRound | null;
    date?: string | null;
    time?: string | null;
    venueName?: string | null;
    venueCity?: string | null;
  },
): Promise<string> {
  const teams = await listCompTeams(cid);
  const byId = new Map(teams.map((t) => [t.id, t]));
  const home = byId.get(input.homeTeamId);
  const away = byId.get(input.awayTeamId);
  if (!home || !away) throw new Error("Équipe introuvable");
  if (home.id === away.id) throw new Error("Une équipe ne peut pas jouer contre elle-même");

  const data: FirestoreCompMatch = {
    competition_id: cid,
    stage: input.stage ?? "group",
    group: input.group?.trim() || null,
    round: input.round ?? null,
    bracket_slot: null,
    home_team_id: home.id,
    away_team_id: away.id,
    home_team_name: home.name,
    away_team_name: away.name,
    home_team_logo: home.logoUrl ?? null,
    away_team_logo: away.logoUrl ?? null,
    date: input.date?.trim() || null,
    time: input.time?.trim() || null,
    venue_name: input.venueName?.trim() || null,
    venue_city: input.venueCity?.trim() || null,
    status: "scheduled",
    score_home: null,
    score_away: null,
    penalty_home: null,
    penalty_away: null,
    winner_team_id: null,
    feeds_into_match_id: null,
    feeds_into_slot: null,
    live_state: null,
    created_at: serverTimestamp() as unknown as string,
    updated_at: serverTimestamp() as unknown as string,
  };
  const ref = await addDoc(collection(db, "competitions", cid, "comp_matches"), data);
  return ref.id;
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
  type: "goal" | "yellow_card" | "red_card" | "substitution";
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
    type: "goal" | "yellow_card" | "red_card" | "substitution";
    side: "home" | "away";
    team_id: string;
    period: number;
    minute: number;
    player_id?: string | null;
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
    player_id: event.player_id ?? null,
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

  // Freeze the match clock as part of finishing. Without this, live_state keeps
  // is_timer_running=true / timer_start_at set, so every viewer's elapsed-time
  // computation (now - start + offset) keeps ticking after full time. We persist
  // the final elapsed into timer_offset and stop the clock. Dotted live_state
  // keys are merged via a Record (mirrors addCompEvent) to avoid a typed-patch fight.
  const ls = m.liveState;
  const updates: Record<string, unknown> = {
    status: "completed",
    winner_team_id: winnerId,
    penalty_home: opts?.penaltyHome ?? null,
    penalty_away: opts?.penaltyAway ?? null,
    updated_at: serverTimestamp(),
  };
  if (ls) {
    updates["live_state.is_timer_running"] = false;
    updates["live_state.timer_start_at"] = null;
    updates["live_state.timer_offset"] =
      ls.isTimerRunning && ls.timerStartAt
        ? Date.now() - new Date(ls.timerStartAt).getTime() + (ls.timerOffset ?? 0)
        : ls.timerOffset ?? 0;
  }
  await updateDoc(compMatchRef(cid, mid), updates);

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
 * Dedup key prefers `playerId`: a goal with `playerId` keys on
 * `${teamId}::id:${playerId}`, falling back to `${teamId}::name:${lowercased
 * trimmed name}` for legacy events that only carry a free-text `playerName`.
 * This keeps name-only events working while new player-linked events dedupe
 * correctly per player (even across name spelling/casing). Goals with neither a
 * `playerId` nor a non-empty trimmed `playerName` are anonymous and not ranked.
 * The first-seen original casing of `playerName` is kept for display. Results
 * are ordered by goals desc, then name asc.
 */
export function computeTopScorers(matches: CompMatch[]): TopScorer[] {
  const byKey = new Map<string, TopScorer>();

  for (const match of matches) {
    const events = match.liveState?.events ?? [];
    for (const event of events) {
      if (event.type !== "goal") continue;

      const name = (event.playerName ?? "").trim();
      let key: string;
      if (event.playerId) {
        key = `${event.teamId}::id:${event.playerId}`;
      } else if (name !== "") {
        key = `${event.teamId}::name:${name.toLowerCase()}`;
      } else {
        continue; // anonymous goal
      }

      const existing = byKey.get(key);
      if (existing) existing.goals += 1;
      else byKey.set(key, { playerName: name, teamId: event.teamId, goals: 1 });
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => b.goals - a.goals || a.playerName.localeCompare(b.playerName),
  );
}

// ============================================
// Knockout bracket generation
// ============================================

/** One qualified team carried from the group stage into knockout seeding. */
interface Qualifier {
  teamId: string;
  name: string;
  logo: string | null;
  group: string;
  rank: number; // 1-based finishing position within its group
}

/**
 * Largest power of two that is <= n (0 for n < 1). Used to size the bracket:
 * any qualifiers beyond the nearest power of two are dropped so every round is
 * a clean halving (no byes).
 */
function largestPowerOfTwoAtMost(n: number): number {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return n >= 1 ? p : 0;
}

/**
 * Round name keyed by the number of TEAMS competing in that round.
 * 16 -> round_of_16, 8 -> quarter, 4 -> semi, 2 -> final.
 */
function knockoutRoundName(roundTeams: number): CompMatchRound {
  switch (roundTeams) {
    case 16:
      return "round_of_16";
    case 8:
      return "quarter";
    case 4:
      return "semi";
    case 2:
      return "final";
    default:
      // Bracket sizes are always powers of two in [2,16] by construction
      // (largestPowerOfTwoAtMost + the <2 guard in generateKnockout), so this
      // is unreachable; we throw rather than emit an invalid round value.
      throw new Error(`Taille de tour de phase finale non supportée: ${roundTeams}`);
  }
}

/**
 * Generate the knockout bracket for a competition: gather group qualifiers,
 * seed round 1, then create every subsequent round down to the final, wiring
 * each match to its successor so `finishCompMatch` can propagate winners.
 *
 * Idempotency: if any `stage === "knockout"` match already exists we return
 * early without creating duplicates (re-running is a safe no-op). The optional
 * third-place match counts as a knockout match for this guard.
 *
 * Seeding:
 *  - Primary (qualifiers_per_group === 2 AND group_count even): groups are
 *    paired two-by-two — (G0,G1), (G2,G3), … — and each pair (X,Y) yields the
 *    matchups `1X vs 2Y` and `1Y vs 2X`. No two teams from the same group can
 *    meet in round 1, and because matchups are emitted pair-by-pair, the two
 *    eventual finalists come from opposite halves of the bracket (they can only
 *    meet in the final).
 *  - Fallback (any other shape): take the top `bracketSize` qualifiers in seed
 *    order (all rank-1s across groups first, then rank-2s, …) and pair standard
 *    1-vs-N: seed[0] vs seed[last], seed[1] vs seed[last-1], …
 *
 * Winner propagation: match at local index `i` in round `r` feeds the match at
 * `floor(i/2)` in round `r+1`, taking the home slot when `i` is even and the
 * away slot when `i` is odd. The final feeds nothing.
 *
 * Third place: when `format.has_third_place`, an extra `round: "third_place"`
 * match is created with empty team slots and `feeds_into_match_id: null`. The
 * winner-propagation path only forwards winners (not losers), so the organizer
 * populates this match manually; it is intentionally NOT wired into the tree.
 *
 * This function does NOT change the competition status — the organizer/UI sets
 * `status: "knockout"` separately.
 */
export async function generateKnockout(cid: string): Promise<void> {
  const competition = await getCompetition(cid);
  if (!competition) throw new Error(`Competition ${cid} not found`);

  const matchesCol = collection(db, "competitions", cid, "comp_matches");

  // Idempotency guard: bail out if a knockout bracket already exists.
  const existingKnockout = await getDocs(query(matchesCol, where("stage", "==", "knockout")));
  if (!existingKnockout.empty) return;

  const format = competition.format;
  const teams = await listCompTeams(cid);

  // Standings are computed from completed group matches only.
  const groupSnap = await getDocs(query(matchesCol, where("stage", "==", "group")));
  const groupMatches = groupSnap.docs.map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch));
  const standings = computeStandings(groupMatches, teams, format);

  // Gather qualifiers: top `qualifiers_per_group` rows per (already sorted) group.
  const qualifiersByGroup: Qualifier[][] = standings.map((standing) =>
    standing.rows.slice(0, format.qualifiers_per_group).map((row, i) => ({
      teamId: row.team.id,
      name: row.team.name,
      logo: row.team.logoUrl ?? null,
      group: standing.group,
      rank: i + 1,
    })),
  );
  const qualifiers = qualifiersByGroup.flat();

  const qualifierCount = qualifiers.length;
  const bracketSize = largestPowerOfTwoAtMost(qualifierCount);
  if (bracketSize < 2) throw new Error("Pas assez de qualifiés pour une phase finale");

  // Build the bracketSize/2 round-1 matchups.
  const round1: { home: Qualifier; away: Qualifier }[] = [];
  if (format.qualifiers_per_group === 2 && format.group_count % 2 === 0) {
    // Primary: pair groups two-by-two. Each group standing is sorted, so
    // qualifiersByGroup[g][0] is the winner (rank 1) and [1] the runner-up.
    for (let g = 0; g + 1 < qualifiersByGroup.length; g += 2) {
      const x = qualifiersByGroup[g];
      const y = qualifiersByGroup[g + 1];
      // Defensive: a group could be short on qualifiers if results are missing.
      if (x.length < 2 || y.length < 2) continue;
      round1.push({ home: x[0], away: y[1] }); // 1X vs 2Y
      round1.push({ home: y[0], away: x[1] }); // 1Y vs 2X
    }
  } else {
    // NOTE: best-effort seed for non-standard shapes (odd group_count, or
    // qualifiers_per_group !== 2). Standard 1-vs-N pairing on seed order; the
    // organizer can manually adjust matchups afterwards.
    const seeded = [...qualifiers].sort((a, b) => a.rank - b.rank); // rank-1s first, then rank-2s, …
    const top = seeded.slice(0, bracketSize);
    for (let i = 0; i < bracketSize / 2; i++) {
      round1.push({ home: top[i], away: top[bracketSize - 1 - i] });
    }
  }

  // Pre-mint a doc ref per match so we can set feeds_into_match_id before write.
  // rounds[r] holds the match refs for that round; rounds[0] is round 1.
  const rounds: { ref: ReturnType<typeof doc>; teams: number }[][] = [];
  for (let roundTeams = bracketSize; roundTeams >= 2; roundTeams = Math.floor(roundTeams / 2)) {
    const count = roundTeams / 2;
    const refs: { ref: ReturnType<typeof doc>; teams: number }[] = [];
    for (let i = 0; i < count; i++) refs.push({ ref: doc(matchesCol), teams: roundTeams });
    rounds.push(refs);
  }

  const batch = writeBatch(db);
  let bracketSlot = 0;

  for (let r = 0; r < rounds.length; r++) {
    const roundRefs = rounds[r];
    const roundName = knockoutRoundName(roundRefs[0].teams);
    const nextRound = rounds[r + 1]; // undefined for the final
    for (let i = 0; i < roundRefs.length; i++) {
      const isRound1 = r === 0;
      const seed = isRound1 ? round1[i] : null;

      const successor = nextRound ? nextRound[Math.floor(i / 2)] : null;
      const data: FirestoreCompMatch = {
        competition_id: cid,
        stage: "knockout",
        group: null,
        round: roundName,
        bracket_slot: bracketSlot,
        home_team_id: seed ? seed.home.teamId : null,
        away_team_id: seed ? seed.away.teamId : null,
        home_team_name: seed ? seed.home.name : "",
        away_team_name: seed ? seed.away.name : "",
        home_team_logo: seed ? seed.home.logo : null,
        away_team_logo: seed ? seed.away.logo : null,
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
        feeds_into_match_id: successor ? successor.ref.id : null,
        feeds_into_slot: successor ? (i % 2 === 0 ? "home" : "away") : null,
        live_state: null,
        // serverTimestamp() returns a FieldValue, not a string, at write time.
        created_at: serverTimestamp() as unknown as string,
        updated_at: serverTimestamp() as unknown as string,
      };
      batch.set(roundRefs[i].ref, data);
      bracketSlot += 1;
    }
  }

  // Third place: standalone match, empty slots, NOT wired into the tree.
  // Winner-propagation forwards winners only, so the organizer fills this in
  // manually (typically with the two semi-final losers).
  if (format.has_third_place) {
    const ref = doc(matchesCol);
    const data: FirestoreCompMatch = {
      competition_id: cid,
      stage: "knockout",
      group: null,
      round: "third_place",
      bracket_slot: bracketSlot,
      home_team_id: null,
      away_team_id: null,
      home_team_name: "",
      away_team_name: "",
      home_team_logo: null,
      away_team_logo: null,
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
      created_at: serverTimestamp() as unknown as string,
      updated_at: serverTimestamp() as unknown as string,
    };
    batch.set(ref, data);
  }

  await batch.commit();
}
