import {
  collection,
  collectionGroup,
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
  CompetitionFormat, CompetitionType,
  CompPlayer, LineupEntry, FirestoreLineupEntry,
  BracketSlotSource,
} from "@/types";
import { toCompetition, toCompTeam, toCompMatch } from "./competition-mappers";
import { hasKnockout, isSingleGroup, SINGLE_GROUP_LETTER } from "./competition-format";
import { listGrantedCompetitionIds } from "./staff-access";

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
  competitionType: CompetitionType;
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
    competition_type: input.competitionType,
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
  return snap.docs
    .map((d) => toCompetition(d.id, d.data() as FirestoreCompetition))
    // Training sandboxes are owned by their user but are not real work —
    // they belong in /live-ops, not in the organizer's competition list.
    .filter((c) => !c.isSandbox);
}

/** The caller's live-console training sandbox, if they have created one. */
export async function getSandboxCompetition(uid: string): Promise<Competition | null> {
  const q = query(
    collection(db, "competitions"),
    where("is_sandbox", "==", true),
    where("created_by", "==", uid),
    firestoreLimit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return toCompetition(d.id, d.data() as FirestoreCompetition);
}

/**
 * Competitions the user can act on as staff: those they moderate, those they
 * organize (a user may be both), and those where they redeemed an access code.
 * Two `array-contains` queries — neither uses `orderBy`, so no composite index
 * is required (array-contains is auto-indexed) — plus a collection-group read
 * of the grants. Results are merged, de-duped by id, and sorted by `createdAt`
 * desc in memory.
 */
export async function listModeratedCompetitions(uid: string): Promise<Competition[]> {
  const [modSnap, orgSnap, grantedIds] = await Promise.all([
    getDocs(query(collection(db, "competitions"), where("moderator_ids", "array-contains", uid))),
    getDocs(query(collection(db, "competitions"), where("organizer_ids", "array-contains", uid))),
    listGrantedCompetitionIds(uid),
  ]);

  const byId = new Map<string, Competition>();
  for (const d of [...modSnap.docs, ...orgSnap.docs]) {
    if (!byId.has(d.id)) {
      byId.set(d.id, toCompetition(d.id, d.data() as FirestoreCompetition));
    }
  }

  // Code holders are not in either array, so their competitions are fetched
  // one by one — a volunteer holds one or two codes, never a hundred.
  const missing = grantedIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    const snaps = await Promise.all(missing.map((id) => getDoc(doc(db, "competitions", id))));
    for (const snap of snaps) {
      if (snap.exists()) {
        byId.set(snap.id, toCompetition(snap.id, snap.data() as FirestoreCompetition));
      }
    }
  }

  return Array.from(byId.values())
    // The sandbox gets its own card on /live-ops — listing it alongside real
    // competitions would blur what is live and what is practice.
    .filter((c) => !c.isSandbox)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

/** Firestore caps a write batch at 500 operations. */
const BATCH_LIMIT = 450;

/** Deletes every doc of a subcollection, in batches. */
async function deleteSubcollection(cid: string, name: "comp_teams" | "comp_matches"): Promise<void> {
  const snap = await getDocs(collection(db, "competitions", cid, name));
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + BATCH_LIMIT)) batch.delete(d.ref);
    await batch.commit();
  }
}

/**
 * Permanently deletes a competition with its teams and matches.
 *
 * Subcollections go first: the security rules resolve `isOrganizerOf(cid)` by
 * reading the parent competition, so removing the parent first would lock us
 * out of its own children and orphan them.
 */
export async function deleteCompetition(cid: string): Promise<void> {
  await deleteSubcollection(cid, "comp_matches");
  await deleteSubcollection(cid, "comp_teams");
  await deleteDoc(doc(db, "competitions", cid));
}

/**
 * Creates a fresh competition from an existing one: same type, format and
 * team list (rosters included), but no matches, no groups, no staff and no
 * manager claims — a new edition starts from a clean slate.
 */
export async function duplicateCompetition(
  cid: string,
  name: string,
  createdBy: string,
): Promise<string> {
  const source = await getCompetition(cid);
  if (!source) throw new Error(`Competition ${cid} not found`);

  const newId = await createCompetition({
    name,
    ...(source.description ? { description: source.description } : {}),
    logoUrl: source.logoUrl,
    bannerUrl: source.bannerUrl,
    competitionType: source.competitionType,
    format: source.format,
    startDate: null,
    endDate: null,
    venueCity: source.venueCity,
    createdBy,
  });

  const teams = await listCompTeams(cid);
  const targetCol = collection(db, "competitions", newId, "comp_teams");
  for (let i = 0; i < teams.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const team of teams.slice(i, i + BATCH_LIMIT)) {
      const data: FirestoreCompTeam = {
        name: team.name,
        short_name: team.shortName,
        logo_url: team.logoUrl,
        color: team.color,
        group: null,
        players: team.players,
        claimed_by_manager_id: null,
        claimed_by_team_id: null,
        created_at: serverTimestamp() as unknown as string,
        updated_at: serverTimestamp() as unknown as string,
      };
      batch.set(doc(targetCol), data);
    }
    await batch.commit();
  }

  return newId;
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

/**
 * Every competition team this manager owns, across all competitions.
 * Collection-group query — needs the `comp_teams.claimed_by_manager_id`
 * COLLECTION_GROUP field override in firestore.indexes.json.
 */
export async function listCompTeamsByManager(uid: string): Promise<CompTeam[]> {
  const q = query(
    collectionGroup(db, "comp_teams"),
    where("claimed_by_manager_id", "==", uid),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    // competitions/{cid}/comp_teams/{tid} — the parent's parent is the comp.
    const cid = d.ref.parent.parent?.id ?? "";
    return toCompTeam(d.id, cid, d.data() as FirestoreCompTeam);
  });
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

/** Thrown by `deleteCompTeam` when the team already has a result on record. */
export class TeamHasPlayedError extends Error {
  constructor(public readonly playedCount: number) {
    super("Cette équipe a déjà joué — elle ne peut plus être retirée.");
    this.name = "TeamHasPlayedError";
  }
}

/**
 * Remove a team from a competition.
 *
 * Refuses once the team has a completed match: deleting it would strip
 * results its opponents earned out of the tables, and rewrite a competition
 * that has already been played. Disqualification is the way out from there.
 */
export async function deleteCompTeam(cid: string, tid: string): Promise<void> {
  const played = (await listCompMatches(cid)).filter(
    (m) =>
      m.status === "completed" && (m.homeTeamId === tid || m.awayTeamId === tid),
  );
  if (played.length > 0) throw new TeamHasPlayedError(played.length);
  await deleteDoc(doc(db, "competitions", cid, "comp_teams", tid));
}

/**
 * The awarded score of a forfeited match, CAF/FIFA convention.
 * The disqualified side takes 0, the opponent 3.
 */
export const FORFEIT_SCORE = 3;

/**
 * Disqualify a team: results already played stand, every match still to come
 * is awarded to the opponent 3-0.
 *
 * Each forfeited match goes through `finishCompMatch`, so a knockout tie also
 * carries the opponent into the next round exactly as a played result would.
 * Only `scheduled` matches are touched — a match already live belongs to the
 * organizer's console, not to this.
 *
 * Returns how many matches were forfeited.
 */
export async function disqualifyCompTeam(
  cid: string,
  tid: string,
  reason?: string,
): Promise<{ forfeited: number }> {
  await updateDoc(doc(db, "competitions", cid, "comp_teams", tid), {
    disqualified: true,
    disqualified_at: new Date().toISOString(),
    disqualified_reason: reason?.trim() || null,
    updated_at: serverTimestamp(),
  });

  const remaining = (await listCompMatches(cid)).filter(
    (m) =>
      m.status === "scheduled" && (m.homeTeamId === tid || m.awayTeamId === tid),
  );

  for (const m of remaining) {
    const teamIsHome = m.homeTeamId === tid;
    await updateCompMatch(cid, m.id, {
      score_home: teamIsHome ? 0 : FORFEIT_SCORE,
      score_away: teamIsHome ? FORFEIT_SCORE : 0,
      forfeit_by_team_id: tid,
    });
    // Resolves the winner from the score we just wrote, marks the match
    // completed and propagates the opponent through the bracket.
    await finishCompMatch(cid, m.id);
  }

  return { forfeited: remaining.length };
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

/**
 * Returns the created player's id. The dossard is optional: a scorer typed
 * from the calendar (post-hoc result entry) is often just a name.
 */
export async function addCompPlayer(
  cid: string,
  tid: string,
  input: { name: string; number?: string; position?: string },
): Promise<string> {
  const team = await getCompTeam(cid, tid);
  if (!team) throw new Error(`Comp team ${tid} not found`);
  const player: CompPlayer = {
    id: Math.random().toString(36).substring(2, 11),
    name: input.name,
    number: input.number ?? "",
    ...(input.position ? { position: input.position } : {}),
  };
  await updateCompTeam(cid, tid, { players: [...team.players, player] });
  return player.id;
}

/** Accent- and case-insensitive key used to match a typed name to a roster line. */
export function rosterNameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Resolve a list of typed names against a team's roster, creating the missing
 * lines in ONE read-modify-write. Matching is by normalized name, so typing
 * "Kodjo" twice (or "kodjo" after "Kodjo") reuses the same roster line instead
 * of stacking duplicates.
 *
 * Returns the resolved players in the same order as `inputs` — callers need the
 * ids to link goal events. Prefer this over looping `addCompPlayer`: the roster
 * is a single array field, so N sequential read-modify-writes would be N chances
 * to lose a concurrent edit.
 */
export async function ensureCompPlayers(
  cid: string,
  tid: string,
  inputs: { name: string; number?: string; position?: string }[],
): Promise<CompPlayer[]> {
  const team = await getCompTeam(cid, tid);
  if (!team) throw new Error(`Comp team ${tid} not found`);

  const byKey = new Map<string, CompPlayer>();
  for (const p of team.players) {
    const key = rosterNameKey(p.name);
    if (!byKey.has(key)) byKey.set(key, p);
  }

  const created: CompPlayer[] = [];
  const resolved = inputs.map((input) => {
    const key = rosterNameKey(input.name);
    const existing = byKey.get(key);
    if (existing) return existing;
    const player: CompPlayer = {
      id: Math.random().toString(36).substring(2, 11),
      name: input.name.trim(),
      number: input.number ?? "",
      ...(input.position ? { position: input.position } : {}),
    };
    byKey.set(key, player);
    created.push(player);
    return player;
  });

  if (created.length > 0) {
    await updateCompTeam(cid, tid, { players: [...team.players, ...created] });
  }
  return resolved;
}

export async function updateCompPlayer(
  cid: string,
  tid: string,
  playerId: string,
  patch: { name?: string; number?: string; position?: string; user_id?: string | null },
): Promise<void> {
  const team = await getCompTeam(cid, tid);
  if (!team) throw new Error(`Comp team ${tid} not found`);
  const players: CompPlayer[] = team.players.map((p) => {
    if (p.id !== playerId) return p;
    const position = patch.position ?? p.position;
    // `user_id` is carried over unless the patch explicitly sets it —
    // renaming a player must not silently unlink their account.
    const userId = patch.user_id !== undefined ? patch.user_id : p.user_id ?? null;
    return {
      id: p.id,
      name: patch.name ?? p.name,
      number: patch.number ?? p.number,
      ...(position ? { position } : {}),
      user_id: userId,
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
 * are ignored — except on single-group types (championnat, championnat +
 * play-offs) where every team plays in the one group, so unassigned teams are
 * folded into it rather than dropped. Within each group, `roundRobinPairs`
 * produces every unordered pair once, and `format.double_round` appends the
 * return leg with the venues swapped.
 * Team name/logo are denormalized onto each match doc (logo → null when absent).
 */
export async function generateGroupFixtures(cid: string): Promise<void> {
  const competition = await getCompetition(cid);
  if (!competition) throw new Error(`Competition ${cid} not found`);
  if (competition.competitionType === "cup") {
    throw new Error("Une coupe n'a pas de phase de groupes");
  }

  // Idempotency guard: bail out if group fixtures already exist.
  const matchesCol = collection(db, "competitions", cid, "comp_matches");
  const existing = await getDocs(query(matchesCol, where("stage", "==", "group")));
  if (!existing.empty) return;

  const teams = await listCompTeams(cid);
  const singleGroup = isSingleGroup(competition.competitionType);

  // Group assigned teams by their group letter.
  const groups = new Map<string, CompTeam[]>();
  for (const team of teams) {
    // On a single-group competition there are no poules to compose, so an
    // unassigned team belongs to the one and only group.
    const letter = singleGroup ? SINGLE_GROUP_LETTER : team.group;
    if (letter == null) continue;
    const bucket = groups.get(letter);
    if (bucket) bucket.push(team);
    else groups.set(letter, [team]);
  }

  const byId = new Map<string, CompTeam>(teams.map((t) => [t.id, t]));

  const batch = writeBatch(db);
  let pairCount = 0;

  for (const [groupLetter, groupTeams] of groups) {
    const pairs = roundRobinPairs(groupTeams.map((t) => t.id));
    // Aller-retour: replay every pairing with the venues swapped.
    const legs: [string, string][] = competition.format.double_round
      ? [...pairs, ...pairs.map(([h, a]) => [a, h] as [string, string])]
      : pairs;
    for (const [homeId, awayId] of legs) {
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

/** One-shot read of a competition's matches (the stats pages don't need live). */
export async function listCompMatches(cid: string): Promise<CompMatch[]> {
  const snap = await getDocs(collection(db, "competitions", cid, "comp_matches"));
  return snap.docs.map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch));
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

  await propagateBracketWinner(cid, m, winnerId);
}

/**
 * Push a decided winner into the slot it feeds in the next round.
 *
 * Idempotent: it writes only when the target slot does not already hold that
 * team, so finishing a match twice is a no-op — and correcting a result that
 * flipped the winner overwrites the stale qualifier instead of duplicating it.
 */
async function propagateBracketWinner(
  cid: string,
  m: CompMatch,
  winnerId: string | null,
): Promise<void> {
  if (!m.feedsIntoMatchId || !winnerId) return;
  const tgt = await getCompMatch(cid, m.feedsIntoMatchId);
  const slot = m.feedsIntoSlot;
  if (!tgt || !slot) return;

  const idField = slot === "home" ? "homeTeamId" : "awayTeamId";
  if (tgt[idField] === winnerId) return;

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

/**
 * `detail` marker put on an own goal. The event counts for the team that
 * benefits (`team_id`), while `player_id` points at the player who scored it —
 * a player of the OTHER team. `computeTopScorers` skips these so a defender
 * never climbs the scoring chart for a mistake.
 */
export const OWN_GOAL_DETAIL = "csc";

/** One goal of a result entered after the fact (see `setCompMatchResult`). */
export interface ResultGoal {
  /** Side the goal counts FOR. */
  side: "home" | "away";
  /** Roster line of the scorer — of the OPPOSING team when `ownGoal`. */
  playerId: string | null;
  playerName: string | null;
  /** `null` (or 0) = unknown. No real goal is scored at the 0th minute. */
  minute: number | null;
  ownGoal?: boolean;
}

/**
 * Write a final result — score AND scorers — on a match that was never run
 * through the live console (a date the organizer is catching up on).
 *
 * Unlike `addCompEvent`, this NEVER increments the scoreboard: the score is
 * whatever the organizer typed, and the goal events are written alongside it in
 * the same update. Feeding post-hoc goals through `addCompEvent` would count
 * every goal twice (once typed, once incremented).
 *
 * Re-entering a result REPLACES the goal events instead of appending, so an
 * organizer can reopen and correct without duplicating. Cards, substitutions
 * and period markers from a real live session are preserved untouched — only
 * `type === "goal"` entries are rebuilt.
 *
 * Fewer scorers than goals is allowed (an unknown scorer is a legitimate state);
 * more is rejected.
 *
 * On a knockout match, a level score is decided by the shootout when one is
 * given, and the winner is pushed into the next round exactly like
 * `finishCompMatch` does — correcting a result that flips the winner re-seeds
 * the successor slot.
 */
export async function setCompMatchResult(
  cid: string,
  mid: string,
  input: {
    scoreHome: number;
    scoreAway: number;
    goals: ResultGoal[];
    penaltyHome?: number | null;
    penaltyAway?: number | null;
  },
): Promise<void> {
  const snap = await getDoc(doc(db, "competitions", cid, "comp_matches", mid));
  if (!snap.exists()) throw new Error(`Competition match ${mid} not found`);
  const d = snap.data() as FirestoreCompMatch;

  const homeGoals = input.goals.filter((g) => g.side === "home").length;
  const awayGoals = input.goals.filter((g) => g.side === "away").length;
  if (homeGoals > input.scoreHome || awayGoals > input.scoreAway) {
    throw new Error("Plus de buteurs que de buts");
  }

  const now = new Date().toISOString();
  const goalEvents: StoredCompEvent[] = input.goals.map((g) => ({
    id: Math.random().toString(36).substring(2, 11),
    type: "goal",
    period: 0, // unknown — the match was not clocked
    minute: g.minute ?? 0,
    team_id: (g.side === "home" ? d.home_team_id : d.away_team_id) ?? "",
    player_id: g.ownGoal ? null : g.playerId ?? null,
    player_name: g.playerName ?? null,
    detail: g.ownGoal ? OWN_GOAL_DETAIL : null,
    created_at: now,
  }));

  // Unknown minutes (0) sort last so the feed still reads chronologically.
  goalEvents.sort((a, b) => (a.minute || Infinity) - (b.minute || Infinity));

  // Keep whatever a live session recorded, in its original order, and append
  // the rebuilt goals. Sorting the merged list would scramble period markers.
  const kept = (d.live_state?.events ?? []).filter((e) => e.type !== "goal");
  const events = [...kept, ...goalEvents];

  // Same rules as `finishCompMatch`: regulation score first, then the shootout
  // on a knockout tie. Any other level score (a group draw, or a knockout the
  // organizer has not decided yet) leaves the match without a winner.
  const ph = input.penaltyHome;
  const pa = input.penaltyAway;
  let winnerId: string | null = null;
  if (input.scoreHome > input.scoreAway) {
    winnerId = d.home_team_id;
  } else if (input.scoreAway > input.scoreHome) {
    winnerId = d.away_team_id;
  } else if (d.stage === "knockout" && ph != null && pa != null) {
    if (ph > pa) winnerId = d.home_team_id;
    else if (pa > ph) winnerId = d.away_team_id;
  }

  const liveState = d.live_state
    ? { ...d.live_state, events }
    : {
        current_period: 4, // finished
        timer_start_at: null,
        timer_offset: 0,
        is_timer_running: false,
        events,
      };

  // Written through a Record so the `player_id: string | null` of a stored
  // event does not fight FirestoreMatch's optional-string shape (same reason
  // `addCompEvent` and `finishCompMatch` do it).
  const updates: Record<string, unknown> = {
    score_home: input.scoreHome,
    score_away: input.scoreAway,
    status: "completed",
    winner_team_id: winnerId,
    penalty_home: ph ?? null,
    penalty_away: pa ?? null,
    live_state: liveState,
    updated_at: serverTimestamp(),
  };
  await updateDoc(doc(db, "competitions", cid, "comp_matches", mid), updates);

  await propagateBracketWinner(cid, toCompMatch(mid, d), winnerId);
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
 * `playerId` nor a non-empty trimmed `playerName` are anonymous and not ranked,
 * and own goals (`detail === OWN_GOAL_DETAIL`) are excluded entirely.
 * The first-seen original casing of `playerName` is kept for display. Results
 * are ordered by goals desc, then name asc.
 */
export function computeTopScorers(matches: CompMatch[]): TopScorer[] {
  const byKey = new Map<string, TopScorer>();

  for (const match of matches) {
    const events = match.liveState?.events ?? [];
    for (const event of events) {
      if (event.type !== "goal") continue;
      // An own goal counts on the scoreboard for `teamId`, but the player who
      // scored it plays for the other side — crediting them here would rank
      // them under an opponent's colours. Not a scorer.
      if (event.detail === OWN_GOAL_DETAIL) continue;

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
 * Generate the knockout bracket for a competition: gather the entrants, seed
 * round 1, then create every subsequent round down to the final, wiring each
 * match to its successor so `finishCompMatch` can propagate winners.
 *
 * Entrants depend on `competitionType`: a cup takes the team list directly,
 * play-offs take the top `knockout_teams` rows of the single table, and
 * groups_knockout takes `qualifiers_per_group` rows per group. A championnat
 * has no bracket at all and throws.
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
  const type = competition.competitionType;
  if (!hasKnockout(type)) {
    throw new Error("Un championnat n'a pas de phase finale");
  }
  const teams = await listCompTeams(cid);

  // Where the bracket's entrants come from depends on the type:
  //  - cup             : straight from the team list, no group stage played
  //  - league_playoffs : the top `knockout_teams` rows of the single table
  //  - groups_knockout : the top `qualifiers_per_group` rows of each group
  let qualifiersByGroup: Qualifier[][];
  let cap = 0;

  if (type === "cup") {
    qualifiersByGroup = [
      teams.map((team, i) => ({
        teamId: team.id,
        name: team.name,
        logo: team.logoUrl ?? null,
        group: "",
        rank: i + 1,
      })),
    ];
    cap = format.knockout_teams || teams.length;
  } else {
    // Standings are computed from completed group matches only.
    const groupSnap = await getDocs(query(matchesCol, where("stage", "==", "group")));
    const groupMatches = groupSnap.docs.map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch));
    const standings = computeStandings(groupMatches, teams, format);

    if (type === "league_playoffs") {
      const table = standings[0];
      if (!table) throw new Error("Aucun classement disponible pour les play-offs");
      cap = format.knockout_teams || 4;
      qualifiersByGroup = [
        table.rows.slice(0, cap).map((row, i) => ({
          teamId: row.team.id,
          name: row.team.name,
          logo: row.team.logoUrl ?? null,
          group: table.group,
          rank: i + 1,
        })),
      ];
    } else {
      // Gather qualifiers: top `qualifiers_per_group` rows per (already sorted) group.
      qualifiersByGroup = standings.map((standing) =>
        standing.rows.slice(0, format.qualifiers_per_group).map((row, i) => ({
          teamId: row.team.id,
          name: row.team.name,
          logo: row.team.logoUrl ?? null,
          group: standing.group,
          rank: i + 1,
        })),
      );
      cap = Number.POSITIVE_INFINITY;
    }
  }

  const qualifiers = qualifiersByGroup.flat();

  const qualifierCount = Math.min(qualifiers.length, cap);
  const bracketSize = largestPowerOfTwoAtMost(qualifierCount);
  if (bracketSize < 2) throw new Error("Pas assez de qualifiés pour une phase finale");
  // knockoutRoundName only names rounds down from a 16-team bracket; a larger
  // one would need a `round_of_32` round value across the bracket UI.
  if (bracketSize > 16) {
    throw new Error("Le tableau final est limité à 16 équipes pour le moment");
  }

  // Build the bracketSize/2 round-1 matchups. The group-pairing seed only
  // applies when the bracket is actually fed by several groups.
  const round1: { home: Qualifier; away: Qualifier }[] = [];
  if (type === "groups_knockout" && format.qualifiers_per_group === 2 && format.group_count % 2 === 0) {
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
    // Standard 1-vs-N pairing on seed order — used by cups (team list order),
    // play-offs (table order) and any non-standard group shape (odd
    // group_count, or qualifiers_per_group !== 2). The organizer can adjust
    // matchups manually afterwards.
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

// ============================================
// Manual bracket design
//
// Automatic seeding only lands cleanly when the group count divides the
// bracket. Five groups of four (Miabé CAN) qualify ten teams for an eight-team
// bracket: two qualifiers have to be cut and there is no universal rule saying
// which — real competitions write that rule in their own regulations. So the
// organizer draws the tree instead: pick a size, then say where each first-round
// slot comes from ("1er poule A", "2e meilleur 3e"). Slots are resolved into
// real teams once the tables are final.
// ============================================

/** Bracket sizes the tree supports, in teams. Every round is a clean halving. */
export const KNOCKOUT_BRACKET_SIZES = [4, 8, 16] as const;

export type KnockoutBracketSize = (typeof KNOCKOUT_BRACKET_SIZES)[number];

/** "1er", "2e", "3e"… — used to label positions and repêchage indexes. */
function ordinalFr(n: number): string {
  return n === 1 ? "1er" : `${n}e`;
}

/** Human label for a slot source, e.g. "1er poule A" or "2e meilleur 3e". */
export function describeBracketSlotSource(source: BracketSlotSource): string {
  return source.kind === "group_rank"
    ? `${ordinalFr(source.rank)} poule ${source.group}`
    : `${ordinalFr(source.index)} meilleur ${ordinalFr(source.rank)}`;
}

/** Stable key for a source — used to spot the same slot picked twice. */
export function bracketSlotSourceKey(source: BracketSlotSource): string {
  return source.kind === "group_rank"
    ? `g:${source.group}:${source.rank}`
    : `b:${source.rank}:${source.index}`;
}

/**
 * Inverse of `bracketSlotSourceKey` — lets a `<select>` carry a source as its
 * option value. Returns null for anything malformed (including the empty
 * "no source" value).
 */
export function parseBracketSlotSourceKey(key: string): BracketSlotSource | null {
  const parts = key.split(":");
  if (parts[0] === "g" && parts.length === 3) {
    const rank = Number(parts[2]);
    if (!parts[1] || !Number.isInteger(rank) || rank < 1) return null;
    return { kind: "group_rank", group: parts[1], rank };
  }
  if (parts[0] === "b" && parts.length === 3) {
    const rank = Number(parts[1]);
    const index = Number(parts[2]);
    if (!Number.isInteger(rank) || !Number.isInteger(index) || rank < 1 || index < 1) return null;
    return { kind: "best_rank", rank, index };
  }
  return null;
}

/**
 * The teams that finished `rank`-th in their group, ranked against each other —
 * the repêchage ladder. Ordered by points, then goal difference, then goals
 * scored, then name, matching `computeStandings`'s within-group ordering.
 *
 * Comparing across groups is only fair when the groups are the same size; the
 * caller decides whether that holds (the format's `teams_per_group` says so).
 */
export function rankedBestOfRank(standings: GroupStanding[], rank: number): StandingRow[] {
  const rows = standings
    .map((standing) => standing.rows[rank - 1])
    .filter((row): row is StandingRow => row != null);
  return rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.team.name.localeCompare(b.team.name, "fr"),
  );
}

/**
 * Team a source currently points at, or null while the group stage has not
 * produced one. Pure — feeds both the live preview and the write path.
 */
export function resolveBracketSlot(
  source: BracketSlotSource,
  standings: GroupStanding[],
): CompTeam | null {
  if (source.kind === "group_rank") {
    const standing = standings.find((s) => s.group === source.group);
    return standing?.rows[source.rank - 1]?.team ?? null;
  }
  return rankedBestOfRank(standings, source.rank)[source.index - 1]?.team ?? null;
}

/** A knockout fixture with both slots empty. */
function emptyKnockoutMatch(
  cid: string,
  opts: {
    round: CompMatchRound;
    bracketSlot: number;
    feedsIntoMatchId: string | null;
    feedsIntoSlot: "home" | "away" | null;
  },
): FirestoreCompMatch {
  return {
    competition_id: cid,
    stage: "knockout",
    group: null,
    round: opts.round,
    bracket_slot: opts.bracketSlot,
    home_source: null,
    away_source: null,
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
    feeds_into_match_id: opts.feedsIntoMatchId,
    feeds_into_slot: opts.feedsIntoSlot,
    live_state: null,
    created_at: serverTimestamp() as unknown as string,
    updated_at: serverTimestamp() as unknown as string,
  };
}

/**
 * Create an empty bracket of `size` teams: every round from the first down to
 * the final, each match wired to its successor so winners propagate. Slots are
 * left blank — the organizer fills them with sources afterwards.
 *
 * Refuses to run over an existing bracket: clearing one destroys played
 * results, so that has to be an explicit `clearKnockoutBracket` call.
 */
export async function createKnockoutBracket(
  cid: string,
  size: KnockoutBracketSize,
): Promise<void> {
  const competition = await getCompetition(cid);
  if (!competition) throw new Error(`Competition ${cid} not found`);
  if (!hasKnockout(competition.competitionType)) {
    throw new Error("Un championnat n'a pas de phase finale");
  }
  if (!(KNOCKOUT_BRACKET_SIZES as readonly number[]).includes(size)) {
    throw new Error(`Taille de tableau non supportée: ${size}`);
  }

  const matchesCol = collection(db, "competitions", cid, "comp_matches");
  const existing = await getDocs(query(matchesCol, where("stage", "==", "knockout")));
  if (!existing.empty) {
    throw new Error("Un tableau existe déjà — supprimez-le avant d'en dessiner un autre");
  }

  // Pre-mint a ref per match so a round can point at the next one before write.
  const rounds: { ref: ReturnType<typeof doc>; teams: number }[][] = [];
  for (let roundTeams: number = size; roundTeams >= 2; roundTeams = Math.floor(roundTeams / 2)) {
    const refs: { ref: ReturnType<typeof doc>; teams: number }[] = [];
    for (let i = 0; i < roundTeams / 2; i++) refs.push({ ref: doc(matchesCol), teams: roundTeams });
    rounds.push(refs);
  }

  const batch = writeBatch(db);
  let bracketSlot = 0;

  for (let r = 0; r < rounds.length; r++) {
    const roundRefs = rounds[r];
    const roundName = knockoutRoundName(roundRefs[0].teams);
    const nextRound = rounds[r + 1]; // undefined for the final
    for (let i = 0; i < roundRefs.length; i++) {
      const successor = nextRound ? nextRound[Math.floor(i / 2)] : null;
      batch.set(roundRefs[i].ref, emptyKnockoutMatch(cid, {
        round: roundName,
        bracketSlot,
        feedsIntoMatchId: successor ? successor.ref.id : null,
        feedsIntoSlot: successor ? (i % 2 === 0 ? "home" : "away") : null,
      }));
      bracketSlot += 1;
    }
  }

  // Third place stays out of the tree: propagation forwards winners, not
  // losers, so the organizer seats the two beaten semi-finalists by hand.
  if (competition.format.has_third_place) {
    batch.set(doc(matchesCol), emptyKnockoutMatch(cid, {
      round: "third_place",
      bracketSlot,
      feedsIntoMatchId: null,
      feedsIntoSlot: null,
    }));
  }

  await batch.commit();
}

/**
 * Delete every knockout match of a competition. Destructive by nature — any
 * score, scorer or lineup recorded on those matches goes with them — so the UI
 * must confirm before calling, and say what is being lost.
 */
export async function clearKnockoutBracket(cid: string): Promise<number> {
  const matchesCol = collection(db, "competitions", cid, "comp_matches");
  const snap = await getDocs(query(matchesCol, where("stage", "==", "knockout")));
  if (snap.empty) return 0;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

/**
 * Point one slot of a bracket match at a source (or clear it with `null`).
 *
 * Setting a source also wipes the team currently sitting in that slot: the slot
 * now means "whoever finishes there", and leaving the old team behind would
 * show a name the source no longer backs.
 */
export async function setBracketSlotSource(
  cid: string,
  mid: string,
  side: "home" | "away",
  source: BracketSlotSource | null,
): Promise<void> {
  const patch: Partial<FirestoreCompMatch> = side === "home"
    ? { home_source: source, home_team_id: null, home_team_name: "", home_team_logo: null }
    : { away_source: source, away_team_id: null, away_team_name: "", away_team_logo: null };
  await updateCompMatch(cid, mid, patch);
}

/**
 * Fill every sourced slot with the team its source currently points at.
 *
 * Skips matches that have already started (a result stands, whatever the tables
 * say afterwards) and slots whose source resolves to nothing yet. Returns how
 * many slots were seated, so the caller can tell "12 places attribuées" from
 * "rien à attribuer".
 */
export async function resolveBracketSlots(cid: string): Promise<number> {
  const competition = await getCompetition(cid);
  if (!competition) throw new Error(`Competition ${cid} not found`);

  const teams = await listCompTeams(cid);
  const matchesCol = collection(db, "competitions", cid, "comp_matches");
  const snap = await getDocs(matchesCol);
  const all = snap.docs.map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch));
  const standings = computeStandings(
    all.filter((m) => m.stage === "group"),
    teams,
    competition.format,
  );

  const batch = writeBatch(db);
  let seated = 0;

  for (const match of all) {
    if (match.stage !== "knockout") continue;
    // A played match keeps the teams it was played by, whatever the tables say.
    if (match.status === "live" || match.status === "completed") continue;

    const patch: Record<string, unknown> = {};
    for (const side of ["home", "away"] as const) {
      const source = side === "home" ? match.homeSource : match.awaySource;
      if (!source) continue;
      const team = resolveBracketSlot(source, standings);
      if (!team) continue;
      const current = side === "home" ? match.homeTeamId : match.awayTeamId;
      if (current === team.id) continue; // already seated
      patch[`${side}_team_id`] = team.id;
      patch[`${side}_team_name`] = team.name;
      patch[`${side}_team_logo`] = team.logoUrl ?? null;
      seated += 1;
    }

    if (Object.keys(patch).length > 0) {
      patch.updated_at = serverTimestamp();
      batch.update(doc(matchesCol, match.id), patch);
    }
  }

  if (seated > 0) await batch.commit();
  return seated;
}
