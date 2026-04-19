// v1.0.1 - Fixed exports detection
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
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch,
  runTransaction,
  setDoc,
  type Transaction,
  type Unsubscribe,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Team, FirestoreTeam,
  Match, FirestoreMatch,
  Participation, FirestoreParticipation,
  Invitation, FirestoreInvitation,
  Venue, FirestoreVenue,
  Post, FirestorePost,
  Comment, FirestoreComment,
  UserProfile, FirestoreUser,
  ShortlistEntry, FirestoreShortlistEntry,
  JoinRequest, FirestoreJoinRequest,
} from "@/types";

// ============================================
// Converters
// ============================================

function toTeam(id: string, d: FirestoreTeam): Team {
  return {
    id, name: d.name, managerId: d.manager_id, city: d.city,
    description: d.description, level: d.level, lookingFor: d.looking_for ?? [],
    memberIds: d.member_ids ?? [], maxMembers: d.max_members, color: d.color,
    wins: d.wins ?? 0, losses: d.losses ?? 0, draws: d.draws ?? 0,
    matchesPlayed: d.matches_played ?? 0, isRecruiting: d.is_recruiting ?? false,
    createdAt: d.created_at, updatedAt: d.updated_at,
  };
}

function toMatch(id: string, d: FirestoreMatch): Match {
  return {
    id, homeTeamId: d.home_team_id, awayTeamId: d.away_team_id,
    homeTeamName: d.home_team_name, awayTeamName: d.away_team_name,
    managerId: d.manager_id, date: d.date, time: d.time,
    venueName: d.venue_name, venueCity: d.venue_city, status: d.status,
    result: d.result, scoreHome: d.score_home, scoreAway: d.score_away,
    refereeId: d.referee_id, refereeName: d.referee_name,
    refereeStatus: d.referee_status ?? "none", format: d.format,
    isHome: d.is_home, playersConfirmed: d.players_confirmed ?? 0,
    playersTotal: d.players_total ?? 0,
    awayManagerId: d.away_manager_id ?? "",
    confirmedHome: d.confirmed_home ?? 0,
    confirmedAway: d.confirmed_away ?? 0,
    modificationRequest: d.modification_request ? {
      date: d.modification_request.date,
      time: d.modification_request.time,
      venueName: d.modification_request.venue_name,
      venueCity: d.modification_request.venue_city,
      reason: d.modification_request.reason,
      requestedBy: d.modification_request.requested_by,
    } : null,
    createdAt: d.created_at, updatedAt: d.updated_at,
  };
}


function toParticipation(id: string, d: FirestoreParticipation): Participation {
  return {
    id, playerId: d.player_id, playerName: d.player_name,
    teamId: d.team_id, matchId: d.match_id, matchLabel: d.match_label,
    matchDate: d.match_date, matchTime: d.match_time, venueName: d.venue_name,
    status: d.status, goals: d.goals ?? 0, assists: d.assists ?? 0,
    matchFormat: d.match_format ?? "", isHome: d.is_home ?? false,
    createdAt: d.created_at, updatedAt: d.updated_at,
  };
}

function toInvitation(id: string, d: FirestoreInvitation): Invitation {
  return {
    id, senderId: d.sender_id, senderName: d.sender_name,
    receiverId: d.receiver_id, receiverName: d.receiver_name,
    receiverCity: d.receiver_city, receiverPosition: d.receiver_position,
    receiverLevel: d.receiver_level, teamId: d.team_id, teamName: d.team_name,
    message: d.message, status: d.status,
    createdAt: d.created_at, updatedAt: d.updated_at,
  };
}

function toVenue(id: string, d: FirestoreVenue): Venue {
  return {
    id, name: d.name, address: d.address, city: d.city, ownerId: d.owner_id,
    fieldType: d.field_type, fieldSurface: d.field_surface, fieldSize: d.field_size,
    rating: d.rating ?? 0, reviewCount: d.review_count ?? 0,
    pricePerHour: d.price_per_hour ?? 0, amenities: d.amenities ?? [],
    available: d.available ?? true, photoUrl: d.photo_url ?? null,
    createdAt: d.created_at, updatedAt: d.updated_at,
  };
}

function toPost(id: string, d: FirestorePost, currentUserId?: string): Post {
  const likes = d.likes ?? [];
  const meta = d.metadata;
  return {
    id, authorId: d.author_id, authorName: d.author_name,
    authorRole: d.author_role, authorAvatar: d.author_avatar,
    type: d.type, content: d.content,
    metadata: meta ? {
      homeTeam: meta.home_team, awayTeam: meta.away_team,
      scoreHome: meta.score_home, scoreAway: meta.score_away,
      teamName: meta.team_name,
    } : null,
    likes, commentCount: d.comment_count ?? 0,
    isLiked: currentUserId ? likes.includes(currentUserId) : false,
    createdAt: d.created_at, updatedAt: d.updated_at,
  };
}

function toComment(id: string, d: FirestoreComment): Comment {
  return {
    id, authorId: d.author_id, authorName: d.author_name,
    content: d.content, createdAt: d.created_at,
  };
}

function toUserProfile(uid: string, d: FirestoreUser): UserProfile {
  return {
    uid, email: d.email, phone: d.phone,
    firstName: d.first_name, lastName: d.last_name,
    userType: d.user_type, locationCity: d.location_city,
    bio: d.bio ?? null, profilePictureUrl: d.profile_picture_url,
    coverPhotoUrl: d.cover_photo_url, companyName: d.company_name ?? null,
    isActive: d.is_active, emailVerified: false,
    authProviders: d.auth_providers ?? [],
    createdAt: d.created_at, updatedAt: d.updated_at,
    // Role-specific optional fields
    ...(d.position !== undefined && { position: d.position }),
    ...(d.skill_level !== undefined && { skillLevel: d.skill_level }),
    ...(d.team_name !== undefined && { teamName: d.team_name }),
    ...(d.license_number !== undefined && { licenseNumber: d.license_number }),
    ...(d.license_level !== undefined && { licenseLevel: d.license_level }),
    ...(d.experience_years !== undefined && { experienceYears: d.experience_years }),
    // Physical info
    ...(d.strong_foot !== undefined && { strongFoot: d.strong_foot }),
    ...(d.height !== undefined && { height: d.height }),
    ...(d.weight !== undefined && { weight: d.weight }),
    ...(d.date_of_birth !== undefined && { dateOfBirth: d.date_of_birth }),
    // Social
    followersCount: d.followers_count ?? 0,
    followingCount: d.following_count ?? 0,
    // Gallery
    galleryPhotos: d.gallery_photos ?? [],
    // Trophies
    trophies: d.trophies ?? [],
  };
}

function toShortlistEntry(id: string, d: FirestoreShortlistEntry): ShortlistEntry {
  return {
    id, managerId: d.manager_id, playerId: d.player_id,
    playerName: d.player_name, playerCity: d.player_city,
    playerPosition: d.player_position, playerLevel: d.player_level,
    playerBio: d.player_bio ?? "", createdAt: d.created_at,
  };
}

function toJoinRequest(id: string, d: FirestoreJoinRequest): JoinRequest {
  return {
    id, playerId: d.player_id, playerName: d.player_name,
    playerCity: d.player_city, playerPosition: d.player_position,
    playerLevel: d.player_level, teamId: d.team_id, teamName: d.team_name,
    managerId: d.manager_id, message: d.message, status: d.status,
    createdAt: d.created_at, updatedAt: d.updated_at,
  };
}

// ============================================
// Teams
// ============================================

export async function getTeamsByManager(managerId: string): Promise<Team[]> {
  const q = query(collection(db, "teams"), where("manager_id", "==", managerId), orderBy("created_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toTeam(d.id, d.data() as FirestoreTeam));
}

export async function getTeamsByPlayer(playerId: string): Promise<Team[]> {
  const q = query(collection(db, "teams"), where("member_ids", "array-contains", playerId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toTeam(d.id, d.data() as FirestoreTeam));
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  const snap = await getDoc(doc(db, "teams", teamId));
  if (!snap.exists()) return null;
  return toTeam(snap.id, snap.data() as FirestoreTeam);
}

export async function createTeam(data: {
  name: string; managerId: string; city: string; description: string;
  level: string; maxMembers: number; color: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, "teams"), {
    name: data.name, manager_id: data.managerId, city: data.city,
    description: data.description, level: data.level,
    looking_for: [], member_ids: [],
    max_members: data.maxMembers, color: data.color,
    wins: 0, losses: 0, draws: 0, matches_played: 0,
    is_recruiting: true,
    created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTeam(teamId: string, data: Partial<FirestoreTeam>): Promise<void> {
  await updateDoc(doc(db, "teams", teamId), { ...data, updated_at: serverTimestamp() });
}

export async function deleteTeam(teamId: string): Promise<void> {
  await deleteDoc(doc(db, "teams", teamId));
}

export async function removeTeamMember(teamId: string, playerId: string): Promise<void> {
  await updateDoc(doc(db, "teams", teamId), {
    member_ids: arrayRemove(playerId),
    updated_at: serverTimestamp(),
  });
}

export async function addTeamMember(teamId: string, playerId: string): Promise<void> {
  await updateDoc(doc(db, "teams", teamId), {
    member_ids: arrayUnion(playerId),
    updated_at: serverTimestamp(),
  });
}

export async function getUsersByIds(uids: string[]): Promise<UserProfile[]> {
  if (uids.length === 0) return [];
  // Firestore 'in' supports up to 30 values per query
  const results: UserProfile[] = [];
  for (let i = 0; i < uids.length; i += 30) {
    const batch = uids.slice(i, i + 30);
    const q = query(collection(db, "users"), where("__name__", "in", batch));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      results.push(toUserProfile(d.id, d.data() as FirestoreUser));
    }
  }
  return results;
}

export async function getUserById(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return toUserProfile(snap.id, snap.data() as FirestoreUser);
}

export async function getParticipationsForMatch(matchId: string): Promise<Participation[]> {
  const q = query(collection(db, "participations"), where("match_id", "==", matchId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toParticipation(d.id, d.data() as FirestoreParticipation));
}

export async function searchTeams(filters: { city?: string; level?: string; query?: string }): Promise<Team[]> {
  const constraints: QueryConstraint[] = [where("is_recruiting", "==", true)];
  if (filters.city) constraints.push(where("city", "==", filters.city));
  if (filters.level) constraints.push(where("level", "==", filters.level));
  const q = query(collection(db, "teams"), ...constraints);
  const snap = await getDocs(q);
  let results = snap.docs.map((d) => toTeam(d.id, d.data() as FirestoreTeam));
  if (filters.query) {
    const search = filters.query.toLowerCase();
    results = results.filter((t) => t.name.toLowerCase().includes(search));
  }
  return results;
}

// ============================================
// Shortlist
// ============================================

export async function getShortlistByManager(managerId: string): Promise<ShortlistEntry[]> {
  const q = query(collection(db, "shortlists"), where("manager_id", "==", managerId), orderBy("created_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toShortlistEntry(d.id, d.data() as FirestoreShortlistEntry));
}

export async function addToShortlist(data: {
  managerId: string; playerId: string; playerName: string;
  playerCity: string; playerPosition: string; playerLevel: string; playerBio: string;
}): Promise<string> {
  const q = query(collection(db, "shortlists"),
    where("manager_id", "==", data.managerId),
    where("player_id", "==", data.playerId));
  const existing = await getDocs(q);
  if (!existing.empty) return existing.docs[0].id;

  const ref = await addDoc(collection(db, "shortlists"), {
    manager_id: data.managerId, player_id: data.playerId,
    player_name: data.playerName, player_city: data.playerCity,
    player_position: data.playerPosition, player_level: data.playerLevel,
    player_bio: data.playerBio, created_at: serverTimestamp(),
  });
  return ref.id;
}

export async function removeFromShortlist(shortlistId: string): Promise<void> {
  await deleteDoc(doc(db, "shortlists", shortlistId));
}

export async function isInShortlist(managerId: string, playerId: string): Promise<string | null> {
  const q = query(collection(db, "shortlists"),
    where("manager_id", "==", managerId),
    where("player_id", "==", playerId));
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].id;
}

// ============================================
// Join Requests (player → team)
// ============================================

export async function createJoinRequest(data: {
  playerId: string; playerName: string; playerCity: string;
  playerPosition: string; playerLevel: string;
  teamId: string; teamName: string; managerId: string; message: string;
}): Promise<string> {
  const q = query(collection(db, "join_requests"),
    where("player_id", "==", data.playerId),
    where("team_id", "==", data.teamId),
    where("status", "==", "pending"));
  const existing = await getDocs(q);
  if (!existing.empty) return existing.docs[0].id;

  const ref = await addDoc(collection(db, "join_requests"), {
    player_id: data.playerId, player_name: data.playerName,
    player_city: data.playerCity, player_position: data.playerPosition,
    player_level: data.playerLevel, team_id: data.teamId,
    team_name: data.teamName, manager_id: data.managerId,
    message: data.message, status: "pending",
    created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  return ref.id;
}

export function onJoinRequestsByManager(managerId: string, callback: (data: JoinRequest[]) => void): Unsubscribe {
  const q = query(collection(db, "join_requests"), where("manager_id", "==", managerId), orderBy("created_at", "desc"));
  return onSnapshot(q,
    (snap) => {
      callback(snap.docs.map((d) => toJoinRequest(d.id, d.data() as FirestoreJoinRequest)));
    },
    (error) => {
      console.error("Error in onJoinRequestsByManager listener:", error);
    }
  );
}

export function onJoinRequestsByTeam(teamId: string, managerId: string, callback: (data: JoinRequest[]) => void): Unsubscribe {
  const q = query(collection(db, "join_requests"),
    where("team_id", "==", teamId),
    where("manager_id", "==", managerId),
    orderBy("created_at", "desc"));
  return onSnapshot(q,
    (snap) => {
      callback(snap.docs.map((d) => toJoinRequest(d.id, d.data() as FirestoreJoinRequest)));
    },
    (error) => {
      console.error("Error in onJoinRequestsByTeam listener:", error);
    }
  );
}

export async function getJoinRequestsByPlayer(playerId: string): Promise<JoinRequest[]> {
  const q = query(collection(db, "join_requests"), where("player_id", "==", playerId), orderBy("created_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toJoinRequest(d.id, d.data() as FirestoreJoinRequest));
}

export async function respondToJoinRequest(requestId: string, accepted: boolean, teamId?: string, playerId?: string): Promise<void> {
  const batch = writeBatch(db);
  const reqRef = doc(db, "join_requests", requestId);

  batch.update(reqRef, {
    status: accepted ? "accepted" : "rejected",
    updated_at: serverTimestamp(),
  });

  // If accepted and we have team/player IDs, add player to team immediately
  if (accepted && teamId && playerId) {
    const teamRef = doc(db, "teams", teamId);
    batch.update(teamRef, {
      member_ids: arrayUnion(playerId),
      updated_at: serverTimestamp(),
    });
  }

  await batch.commit();
}

// ============================================
// Matches
// ============================================

export async function getMatchById(matchId: string): Promise<Match | null> {
  const snap = await getDoc(doc(db, "matches", matchId));
  if (!snap.exists()) return null;
  return toMatch(snap.id, snap.data() as FirestoreMatch);
}

export async function getMatchesByManager(managerId: string): Promise<Match[]> {
  const qHome = query(collection(db, "matches"), where("manager_id", "==", managerId), orderBy("created_at", "desc"));
  const qAway = query(collection(db, "matches"), where("away_manager_id", "==", managerId), orderBy("created_at", "desc"));
  const [snapH, snapA] = await Promise.all([getDocs(qHome), getDocs(qAway)]);
  const map = new Map<string, Match>();
  for (const d of [...snapH.docs, ...snapA.docs]) {
    if (!map.has(d.id)) map.set(d.id, toMatch(d.id, d.data() as FirestoreMatch));
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function onMatchesByManager(managerId: string, callback: (data: Match[]) => void): Unsubscribe {
  const qHome = query(collection(db, "matches"), where("manager_id", "==", managerId), orderBy("created_at", "desc"));
  const qAway = query(collection(db, "matches"), where("away_manager_id", "==", managerId), orderBy("created_at", "desc"));

  let homeMatches: Match[] = [];
  let awayMatches: Match[] = [];

  const update = () => {
    const map = new Map<string, Match>();
    [...homeMatches, ...awayMatches].forEach((m) => {
      if (!map.has(m.id)) map.set(m.id, m);
    });
    const sorted = Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(sorted);
  };

  const unsubHome = onSnapshot(qHome, (snap) => {
    homeMatches = snap.docs.map(d => toMatch(d.id, d.data() as FirestoreMatch));
    update();
  });

  const unsubAway = onSnapshot(qAway, (snap) => {
    awayMatches = snap.docs.map(d => toMatch(d.id, d.data() as FirestoreMatch));
    update();
  });

  return () => {
    unsubHome();
    unsubAway();
  };
}

export async function getMatchesByTeamIds(teamIds: string[]): Promise<Match[]> {
  if (teamIds.length === 0) return [];
  // Firestore 'in' supports up to 30 values
  const qHome = query(collection(db, "matches"), where("home_team_id", "in", teamIds.slice(0, 30)));
  const qAway = query(collection(db, "matches"), where("away_team_id", "in", teamIds.slice(0, 30)));
  const [snapH, snapA] = await Promise.all([getDocs(qHome), getDocs(qAway)]);
  const map = new Map<string, Match>();
  for (const d of [...snapH.docs, ...snapA.docs]) {
    if (!map.has(d.id)) map.set(d.id, toMatch(d.id, d.data() as FirestoreMatch));
  }
  return Array.from(map.values()).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

export async function createMatch(data: {
  homeTeamId: string; awayTeamId: string; homeTeamName: string; awayTeamName: string;
  managerId: string; awayManagerId: string; date: string; time: string; venueName: string; venueCity: string;
  format: string; isHome: boolean; playersTotal: number;
}): Promise<string> {
  const ref = await addDoc(collection(db, "matches"), {
    home_team_id: data.homeTeamId, away_team_id: data.awayTeamId,
    home_team_name: data.homeTeamName, away_team_name: data.awayTeamName,
    manager_id: data.managerId, away_manager_id: data.awayManagerId,
    date: data.date, time: data.time,
    venue_name: data.venueName, venue_city: data.venueCity,
    status: "challenge", result: null, score_home: null, score_away: null,
    referee_id: null, referee_name: null, referee_status: "none",
    format: data.format, is_home: data.isHome,
    players_confirmed: 0, players_total: data.playersTotal,
    confirmed_home: 0, confirmed_away: 0,
    created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  return ref.id;
}

export async function updateMatch(matchId: string, data: Partial<FirestoreMatch>): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), { ...data, updated_at: serverTimestamp() });
}

export async function cancelMatch(matchId: string): Promise<void> {
  await cancelMatchParticipations(matchId);
  await updateDoc(doc(db, "matches", matchId), {
    status: "cancelled",
    updated_at: serverTimestamp(),
  });
}

// ============================================
// Match Challenges
// ============================================

export async function getMatchChallengesForManager(managerId: string): Promise<Match[]> {
  const q = query(collection(db, "matches"),
    where("away_manager_id", "==", managerId),
    where("status", "==", "challenge"),
    orderBy("created_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toMatch(d.id, d.data() as FirestoreMatch));
}

export function onMatchChallengesForManager(managerId: string, callback: (data: Match[]) => void): Unsubscribe {
  const q = query(collection(db, "matches"),
    where("away_manager_id", "==", managerId),
    where("status", "==", "challenge"),
    orderBy("created_at", "desc"));
  return onSnapshot(q,
    (snap) => {
      callback(snap.docs.map((d) => toMatch(d.id, d.data() as FirestoreMatch)));
    },
    (error) => {
      console.error("Error in onMatchChallengesForManager listener:", error);
    }
  );
}

export async function respondToMatchChallenge(
  matchId: string,
  accepted: boolean,
  homeTeamMemberIds: string[],
  homeTeamMemberNames: Map<string, string>,
  awayTeamMemberIds: string[],
  awayTeamMemberNames: Map<string, string>,
  matchLabel: string,
  matchDate: string,
  matchTime: string,
  venueName: string,
  homeTeamId: string,
  awayTeamId: string,
  format: string,
): Promise<void> {
  if (!accepted) {
    await updateDoc(doc(db, "matches", matchId), {
      status: "cancelled", updated_at: serverTimestamp(),
    });
    await cancelMatchParticipations(matchId);
    return;
  }
  await updateDoc(doc(db, "matches", matchId), {
    status: "pending", updated_at: serverTimestamp(),
  });
  await createParticipationsForTeam(matchId, matchLabel, matchDate, matchTime, venueName, homeTeamId, homeTeamMemberIds, homeTeamMemberNames, format, true);
  await createParticipationsForTeam(matchId, matchLabel, matchDate, matchTime, venueName, awayTeamId, awayTeamMemberIds, awayTeamMemberNames, format, false);
}

export async function requestMatchModification(
  matchId: string,
  data: { date: string; time: string; venueName: string; venueCity: string; reason: string; requestedBy: string }
): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    modification_request: {
      date: data.date,
      time: data.time,
      venue_name: data.venueName,
      venue_city: data.venueCity,
      reason: data.reason,
      requested_by: data.requestedBy,
    },
    updated_at: serverTimestamp(),
  });
}

export async function respondToMatchModification(
  matchId: string,
  accepted: boolean,
  currentMod: { date: string; time: string; venue_name: string; venue_city: string }
): Promise<void> {
  const updates: Record<string, any> = {
    modification_request: null,
    updated_at: serverTimestamp(),
  };
  
  if (accepted) {
    updates.date = currentMod.date;
    updates.time = currentMod.time;
    updates.venue_name = currentMod.venue_name;
    updates.venue_city = currentMod.venue_city;
  }
  
  await updateDoc(doc(db, "matches", matchId), updates);
}

// ============================================
// Participations (top-level collection)

// ============================================

export async function createParticipationsForTeam(
  matchId: string, matchLabel: string, matchDate: string, matchTime: string,
  venueName: string, teamId: string, memberIds: string[],
  memberNames: Map<string, string>, format: string, isHome: boolean,
): Promise<void> {
  const batch: Promise<unknown>[] = [];
  for (const playerId of memberIds) {
    batch.push(addDoc(collection(db, "participations"), {
      player_id: playerId,
      player_name: memberNames.get(playerId) ?? "",
      team_id: teamId,
      match_id: matchId,
      match_label: matchLabel,
      match_date: matchDate,
      match_time: matchTime,
      venue_name: venueName,
      status: "pending",
      goals: 0, assists: 0,
      match_format: format,
      is_home: isHome,
      created_at: serverTimestamp(), updated_at: serverTimestamp(),
    }));
  }
  await Promise.all(batch);
}

export async function getParticipationsForPlayer(playerId: string): Promise<Participation[]> {
  const q = query(collection(db, "participations"), where("player_id", "==", playerId), orderBy("created_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toParticipation(d.id, d.data() as FirestoreParticipation));
}

const MATCH_QUOTAS: Record<string, number> = {
  "5v5": 3,
  "7v7": 5,
  "11v11": 8,
};

export async function respondToParticipation(
  participationId: string,
  accepted: boolean,
  matchId?: string,
  teamId?: string,
  format?: string,
  isHome?: boolean,
): Promise<void> {
  await runTransaction(db, async (transaction: Transaction) => {
    const partRef = doc(db, "participations", participationId);
    const partSnap = await transaction.get(partRef);
    if (!partSnap.exists()) return;
    const partData = partSnap.data();

    // Move second read (match) here, before any updates
    let matchSnap = null;
    let matchRef = null;
    if (matchId) {
      matchRef = doc(db, "matches", matchId);
      matchSnap = await transaction.get(matchRef);
    }

    // Idempotency check: don't process if already confirmed/declined to avoid double counting
    if (partData.status === (accepted ? "confirmed" : "declined")) return;
    const previouslyConfirmed = partData.status === "confirmed";

    if (matchSnap && matchSnap.exists()) {
      const matchData = matchSnap.data();
      if (matchData.status === "cancelled") {
        // Return early to prevent updates if match is cancelled
        return;
      }
    }

    // All reads are done. Now start writes.
    transaction.update(partRef, {
      status: accepted ? "confirmed" : "declined",
      updated_at: serverTimestamp(),
    });

    if (!matchId || !teamId || !format || !matchSnap || !matchSnap.exists() || !matchRef) return;
    const matchData = matchSnap.data() as FirestoreMatch;

    // Calculate changes
    let h_change = 0;
    let a_change = 0;

    if (accepted && !previouslyConfirmed) {
      if (isHome) h_change = 1; else a_change = 1;
    } else if (!accepted && previouslyConfirmed) {
      if (isHome) h_change = -1; else a_change = -1;
    }

    if (h_change === 0 && a_change === 0) return;

    const h = (matchData.confirmed_home ?? 0) + h_change;
    const a = (matchData.confirmed_away ?? 0) + a_change;

    transaction.update(matchRef, {
      confirmed_home: h,
      confirmed_away: a,
      players_confirmed: h + a,
      updated_at: serverTimestamp(),
    });

    // Auto-confirm logic
    const minQuota = MATCH_QUOTAS[format] ?? 3;
    if (
      matchData.status === "pending" &&
      h >= minQuota &&
      a >= minQuota
    ) {
      transaction.update(matchRef, { status: "upcoming", updated_at: serverTimestamp() });
      
      // Since we can't easily addDoc in a transaction without knowing the ID,
      // we'll use setDoc with a manual ID or just keep it simple.
      // Actually, addDoc works fine if it's not part of the transaction's read-write cycle,
      // or we can just use setDoc(doc(collection(...)))
      const postRef = doc(collection(db, "posts"));
      transaction.set(postRef, {
        author_id: "system",
        author_name: "Koppafoot",
        author_role: "system",
        author_avatar: "",
        type: "match_announcement",
        content: `⚽ Match confirmé ! ${matchData.home_team_name} vs ${matchData.away_team_name} le ${matchData.date} à ${matchData.time} — ${matchData.venue_name}`,
        metadata: { home_team: matchData.home_team_name, away_team: matchData.away_team_name },
        likes: [], comment_count: 0,
        created_at: serverTimestamp(), updated_at: serverTimestamp(),
      });
    }
  });
}

export async function forceCompleteMatch(matchId: string): Promise<void> {
  const matchRef = doc(db, "matches", matchId);
  await updateDoc(matchRef, {
    status: "upcoming",
    updated_at: serverTimestamp(),
  });
}

export async function updateMatchStatus(matchId: string, status: Match["status"]): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    status,
    updated_at: serverTimestamp(),
  });
}

export async function cancelMatchParticipations(matchId: string): Promise<void> {
  const q = query(collection(db, "participations"), where("match_id", "==", matchId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { status: "cancelled", updated_at: serverTimestamp() });
  });
  await batch.commit();
}

export function onParticipationsForPlayer(playerId: string, callback: (data: Participation[]) => void): Unsubscribe {
  const q = query(collection(db, "participations"), where("player_id", "==", playerId), orderBy("created_at", "desc"));
  return onSnapshot(q,
    (snap) => {
      callback(snap.docs.map((d) => toParticipation(d.id, d.data() as FirestoreParticipation)));
    },
    (error) => {
      console.error("Error in onParticipationsForPlayer listener:", error);
    }
  );
}

// ============================================
// Invitations
// ============================================

export async function sendInvitation(data: {
  senderId: string; senderName: string; receiverId: string; receiverName: string;
  receiverCity: string; receiverPosition: string; receiverLevel: string;
  teamId: string; teamName: string; message: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, "invitations"), {
    sender_id: data.senderId, sender_name: data.senderName,
    receiver_id: data.receiverId, receiver_name: data.receiverName,
    receiver_city: data.receiverCity, receiver_position: data.receiverPosition,
    receiver_level: data.receiverLevel, team_id: data.teamId,
    team_name: data.teamName, message: data.message,
    status: "pending",
    created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  return ref.id;
}

export function onInvitationsForPlayer(playerId: string, callback: (data: Invitation[]) => void): Unsubscribe {
  const q = query(collection(db, "invitations"), where("receiver_id", "==", playerId), orderBy("created_at", "desc"));
  return onSnapshot(q,
    (snap) => {
      callback(snap.docs.map((d) => toInvitation(d.id, d.data() as FirestoreInvitation)));
    },
    (error) => {
      console.error("Error in onInvitationsForPlayer listener:", error);
    }
  );
}

export function onInvitationsByManager(managerId: string, callback: (data: Invitation[]) => void): Unsubscribe {
  const q = query(collection(db, "invitations"), where("sender_id", "==", managerId), orderBy("created_at", "desc"));
  return onSnapshot(q,
    (snap) => {
      callback(snap.docs.map((d) => toInvitation(d.id, d.data() as FirestoreInvitation)));
    },
    (error) => {
      console.error("Error in onInvitationsByManager listener:", error);
    }
  );
}

export async function respondToInvitation(invitationId: string, accepted: boolean, teamId?: string, playerId?: string): Promise<void> {
  const batch = writeBatch(db);
  const invRef = doc(db, "invitations", invitationId);

  batch.update(invRef, {
    status: accepted ? "accepted" : "declined",
    updated_at: serverTimestamp(),
  });

  // If accepted, add player to team
  if (accepted && teamId && playerId) {
    const teamRef = doc(db, "teams", teamId);
    batch.update(teamRef, {
      member_ids: arrayUnion(playerId),
      updated_at: serverTimestamp(),
    });
  }

  await batch.commit();
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  await deleteDoc(doc(db, "invitations", invitationId));
}

// ============================================
// Players (for recruitment search)
// ============================================

export async function searchPlayers(filters: { city?: string; position?: string; skillLevel?: string; query?: string }): Promise<UserProfile[]> {
  const constraints: QueryConstraint[] = [where("user_type", "==", "player"), where("is_active", "==", true)];
  if (filters.city) constraints.push(where("location_city", "==", filters.city));
  if (filters.position) constraints.push(where("position", "==", filters.position));
  if (filters.skillLevel) constraints.push(where("skill_level", "==", filters.skillLevel));
  const q = query(collection(db, "users"), ...constraints);
  const snap = await getDocs(q);
  let results = snap.docs.map((d) => toUserProfile(d.id, d.data() as FirestoreUser));
  if (filters.query) {
    const search = filters.query.toLowerCase();
    results = results.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(search));
  }
  return results;
}

// ============================================
// Referees (for referee search)
// ============================================

export async function searchReferees(filters: { city?: string; licenseLevel?: string; query?: string }): Promise<UserProfile[]> {
  const constraints: QueryConstraint[] = [where("user_type", "==", "referee"), where("is_active", "==", true)];
  if (filters.city) constraints.push(where("location_city", "==", filters.city));
  if (filters.licenseLevel) constraints.push(where("license_level", "==", filters.licenseLevel));
  const q = query(collection(db, "users"), ...constraints);
  const snap = await getDocs(q);
  let results = snap.docs.map((d) => toUserProfile(d.id, d.data() as FirestoreUser));
  if (filters.query) {
    const search = filters.query.toLowerCase();
    results = results.filter((r) => `${r.firstName} ${r.lastName}`.toLowerCase().includes(search));
  }
  return results;
}

// ============================================
// Venues
// ============================================

export async function getVenues(filters?: { city?: string; fieldSize?: string; query?: string }): Promise<Venue[]> {
  const constraints: QueryConstraint[] = [];
  if (filters?.city) constraints.push(where("city", "==", filters.city));
  if (filters?.fieldSize) constraints.push(where("field_size", "==", filters.fieldSize));
  const q = query(collection(db, "venues"), ...constraints);
  const snap = await getDocs(q);
  let results = snap.docs.map((d) => toVenue(d.id, d.data() as FirestoreVenue));
  if (filters?.query) {
    const search = filters.query.toLowerCase();
    results = results.filter((v) => v.name.toLowerCase().includes(search));
  }
  return results;
}

// ============================================
// Feed / Posts
// ============================================

export function onPosts(maxResults: number, currentUserId: string, callback: (data: Post[]) => void): Unsubscribe {
  const q = query(collection(db, "posts"), orderBy("created_at", "desc"), firestoreLimit(maxResults));
  return onSnapshot(q,
    (snap) => {
      callback(snap.docs.map((d) => toPost(d.id, d.data() as FirestorePost, currentUserId)));
    },
    (error) => {
      console.error("Error in onPosts listener:", error);
    }
  );
}

export async function createPost(data: {
  authorId: string; authorName: string; authorRole: string; authorAvatar: string;
  type: string; content: string;
  metadata?: { home_team?: string; away_team?: string; score_home?: number; score_away?: number; team_name?: string } | null;
}): Promise<string> {
  const ref = await addDoc(collection(db, "posts"), {
    author_id: data.authorId, author_name: data.authorName,
    author_role: data.authorRole, author_avatar: data.authorAvatar,
    type: data.type, content: data.content,
    metadata: data.metadata ?? null, likes: [], comment_count: 0,
    created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  return ref.id;
}

export async function toggleLike(postId: string, userId: string, isLiked: boolean): Promise<void> {
  await updateDoc(doc(db, "posts", postId), {
    likes: isLiked ? arrayRemove(userId) : arrayUnion(userId),
  });
}

export async function addComment(postId: string, data: { authorId: string; authorName: string; content: string }): Promise<string> {
  const ref = await addDoc(collection(db, "posts", postId, "comments"), {
    author_id: data.authorId, author_name: data.authorName,
    content: data.content, created_at: serverTimestamp(),
  });
  await updateDoc(doc(db, "posts", postId), { comment_count: increment(1) });
  return ref.id;
}

export async function getComments(postId: string): Promise<Comment[]> {
  const q = query(collection(db, "posts", postId, "comments"), orderBy("created_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toComment(d.id, d.data() as FirestoreComment));
}

// ============================================
// Referee Business Logic
// ============================================

export async function getMatchesLookingForReferee(): Promise<Match[]> {
  // Show matches where referee_status is 'none' or 'pending' (someone else applied but not confirmed)
  // And status is 'pending' (accepted challenge) or 'upcoming'
  const q = query(
    collection(db, "matches"),
    where("referee_status", "==", "none"),
    where("status", "in", ["pending", "upcoming"]),
    orderBy("created_at", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toMatch(d.id, d.data() as FirestoreMatch));
}

export async function applyToMatchAsReferee(matchId: string, refereeId: string, refereeName: string): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    referee_id: refereeId,
    referee_name: refereeName,
    referee_status: "pending",
    updated_at: serverTimestamp(),
  });
}

export function onRefereeAssignments(refereeId: string, callback: (data: Match[]) => void): Unsubscribe {
  const q = query(
    collection(db, "matches"),
    where("referee_id", "==", refereeId),
    orderBy("created_at", "desc")
  );
  return onSnapshot(q,
    (snap) => {
      callback(snap.docs.map((d) => toMatch(d.id, d.data() as FirestoreMatch)));
    },
    (error) => {
      console.error("Error in onRefereeAssignments listener:", error);
    }
  );
}

export async function respondToRefereeApplication(matchId: string, accepted: boolean): Promise<void> {
  if (accepted) {
    await updateDoc(doc(db, "matches", matchId), {
      referee_status: "confirmed",
      updated_at: serverTimestamp(),
    });
  } else {
    await updateDoc(doc(db, "matches", matchId), {
      referee_id: null,
      referee_name: null,
      referee_status: "none",
      updated_at: serverTimestamp(),
    });
  }
}

export async function inviteRefereeToMatch(matchId: string, refereeId: string, refereeName: string): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    referee_id: refereeId,
    referee_name: refereeName,
    referee_status: "invited",
    updated_at: serverTimestamp(),
  });
}

export async function respondToRefereeInvitation(matchId: string, accepted: boolean): Promise<void> {
  if (accepted) {
    await updateDoc(doc(db, "matches", matchId), {
      referee_status: "confirmed",
      updated_at: serverTimestamp(),
    });
  } else {
    await updateDoc(doc(db, "matches", matchId), {
      referee_id: null,
      referee_name: null,
      referee_status: "none",
      updated_at: serverTimestamp(),
    });
  }
}

export async function getMatchesByReferee(refereeId: string, status?: string): Promise<Match[]> {
  const matchesRef = collection(db, "matches");
  let q;
  if (status) {
    q = query(
      matchesRef,
      where("referee_id", "==", refereeId),
      where("referee_status", "==", status),
      orderBy("date", "asc")
    );
  } else {
    q = query(
      matchesRef,
      where("referee_id", "==", refereeId),
      orderBy("date", "asc")
    );
  }
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(d => toMatch(d.id, d.data() as FirestoreMatch));
}

export function onMatchesByReferee(refereeId: string, callback: (data: Match[]) => void, status?: string): Unsubscribe {
  const matchesRef = collection(db, "matches");
  let q;
  if (status) {
    q = query(
      matchesRef,
      where("referee_id", "==", refereeId),
      where("referee_status", "==", status),
      orderBy("date", "asc")
    );
  } else {
    q = query(
      matchesRef,
      where("referee_id", "==", refereeId),
      orderBy("date", "asc")
    );
  }
  
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => toMatch(d.id, d.data() as FirestoreMatch)));
  });
}

export async function submitMatchReport(matchId: string, scoreHome: number, scoreAway: number): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    score_home: scoreHome,
    score_away: scoreAway,
    status: "completed",
    updated_at: serverTimestamp(),
  });

  // Fetch match details to create post
  const matchSnap = await getDoc(doc(db, "matches", matchId));
  if (matchSnap.exists()) {
    const m = matchSnap.data() as FirestoreMatch;
    await createPost({
      authorId: "system",
      authorName: "Koppafoot",
      authorRole: "system",
      authorAvatar: "",
      type: "match_result",
      content: `🏁 Résultat Match : ${m.home_team_name} ${scoreHome} - ${scoreAway} ${m.away_team_name}`,
      metadata: {
        home_team: m.home_team_name,
        away_team: m.away_team_name,
        score_home: scoreHome,
        score_away: scoreAway,
      },
    });
  }
}

// ============================================
// Follow System
// ============================================

export async function followUser(followerId: string, followingId: string): Promise<void> {
  // Check if already following
  const existing = await isFollowing(followerId, followingId);
  if (existing) return;

  const batch = writeBatch(db);

  // Create follow document
  const followRef = doc(collection(db, "follows"));
  batch.set(followRef, {
    follower_id: followerId,
    following_id: followingId,
    created_at: serverTimestamp(),
  });

  // Increment counters
  batch.update(doc(db, "users", followerId), {
    following_count: increment(1),
    updated_at: serverTimestamp(),
  });
  batch.update(doc(db, "users", followingId), {
    followers_count: increment(1),
    updated_at: serverTimestamp(),
  });

  await batch.commit();
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const q = query(
    collection(db, "follows"),
    where("follower_id", "==", followerId),
    where("following_id", "==", followingId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);

  snap.docs.forEach((d) => batch.delete(d.ref));

  // Decrement counters
  batch.update(doc(db, "users", followerId), {
    following_count: increment(-1),
    updated_at: serverTimestamp(),
  });
  batch.update(doc(db, "users", followingId), {
    followers_count: increment(-1),
    updated_at: serverTimestamp(),
  });

  await batch.commit();
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const q = query(
    collection(db, "follows"),
    where("follower_id", "==", followerId),
    where("following_id", "==", followingId)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function getFollowersCount(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return 0;
  return (snap.data() as FirestoreUser).followers_count ?? 0;
}

// ============================================
// Posts by User
// ============================================

export async function getPostsByUser(userId: string, currentUserId?: string, maxResults = 20): Promise<Post[]> {
  const q = query(
    collection(db, "posts"),
    where("author_id", "==", userId),
    orderBy("created_at", "desc"),
    firestoreLimit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toPost(d.id, d.data() as FirestorePost, currentUserId));
}
