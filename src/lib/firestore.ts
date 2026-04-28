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
import { db, auth } from "@/lib/firebase";
import type {
  Team, FirestoreTeam, Achievement,
  Match, FirestoreMatch,
  Participation, FirestoreParticipation,
  Invitation, FirestoreInvitation,
  Venue, FirestoreVenue,
  Post, FirestorePost,
  Comment, FirestoreComment,
  UserProfile, FirestoreUser,
  ShortlistEntry, FirestoreShortlistEntry,
  JoinRequest, FirestoreJoinRequest,
  Training, FirestoreTraining, TrainingAttendee,
  PlayerRating, FirestorePlayerRating,
  Booking, FirestoreBooking,
  GhostPlayer, FirestoreGhostPlayer,
  Notification, FirestoreNotification, NotificationType,
} from "@/types";

// ============================================
// Converters
// ============================================

/**
 * Helper to convert Firestore dates (string or Timestamp) to ISO string
 */
function formatDate(date: any): string {
  if (!date) return new Date().toISOString();
  // Handle Firestore serverTimestamp placeholder (sometimes has no toDate or seconds on first snapshot)
  if (typeof date === "object" && !date.seconds && !date.toDate) {
    return new Date().toISOString();
  }
  if (typeof date === "string") return date;
  if (typeof date.toDate === "function") return date.toDate().toISOString();
  if (date.seconds) return new Date(date.seconds * 1000).toISOString();
  return new Date().toISOString();
}


export function toGhostPlayer(id: string, teamId: string, d: FirestoreGhostPlayer): GhostPlayer {
  return {
    id,
    teamId,
    firstName: d.first_name,
    lastName: d.last_name,
    position: d.position,
    squadNumber: d.squad_number ?? undefined,
    matchesPlayed: d.matches_played ?? 0,
    goals: d.goals ?? 0,
    assists: d.assists ?? 0,
    yellowCards: d.yellow_cards ?? 0,
    redCards: d.red_cards ?? 0,
    createdAt: formatDate(d.created_at),
    updatedAt: formatDate(d.updated_at),
  };
}

export function toNotification(id: string, d: FirestoreNotification): Notification {
  return {
    id,
    userId: d.user_id,
    type: d.type,
    title: d.title,
    body: d.body,
    link: d.link ?? undefined,
    read: d.read,
    createdAt: formatDate(d.created_at),
  };
}

export function toTeam(id: string, d: FirestoreTeam): Team {
  return {
    id, name: d.name, managerId: d.manager_id, city: d.city,
    description: d.description, level: d.level, lookingFor: d.looking_for ?? [],
    memberIds: d.member_ids ?? [], maxMembers: d.max_members, color: d.color,
    wins: d.wins ?? 0, losses: d.losses ?? 0, draws: d.draws ?? 0,
    matchesPlayed: d.matches_played ?? 0, isRecruiting: d.is_recruiting ?? false,
    logoUrl: d.logo_url, bannerUrl: d.banner_url, slogan: d.slogan,
    lineupIds: d.lineup_ids ?? [], galleryUrls: d.gallery_urls ?? [],
    achievements: d.achievements ?? [], followersCount: d.followers_count ?? 0,
    squadNumbers: d.squad_numbers ?? {},
    trainingSchedule: d.training_schedule ?? [],
    createdAt: formatDate(d.created_at), updatedAt: formatDate(d.updated_at),
  };
}

export function toMatch(id: string, d: FirestoreMatch): Match {
  let effectiveStatus = d.status;
  
  // Dynamic status check for upcoming matches
  if (d.status === "upcoming" && d.date && d.time) {
    try {
      const matchDate = new Date(`${d.date}T${d.time}`);
      const now = new Date();
      if (now > matchDate) {
        effectiveStatus = "delayed"; 
      }
    } catch (e) {
      console.warn("Invalid date format in match", d.date, d.time);
    }
  }

  return {
    id, homeTeamId: d.home_team_id, awayTeamId: d.away_team_id,
    homeTeamName: d.home_team_name, awayTeamName: d.away_team_name,
    managerId: d.manager_id, date: d.date, time: d.time,
    venueName: d.venue_name, venueCity: d.venue_city, status: d.status,
    effectiveStatus: effectiveStatus as any, // Cast to any until type is fully propagated or updated
    result: d.result, scoreHome: d.score_home, scoreAway: d.score_away,
    refereeId: d.referee_id, refereeName: d.referee_name,
    refereeStatus: d.referee_status ?? "none", format: d.format,
    isHome: d.is_home, playersConfirmed: d.players_confirmed ?? 0,
    playersTotal: d.players_total ?? 0,
    awayManagerId: d.away_manager_id ?? "",
    confirmedHome: d.confirmed_home ?? 0,
    confirmedAway: d.confirmed_away ?? 0,
    homeLineupReady: d.home_lineup_ready ?? false,
    awayLineupReady: d.away_lineup_ready ?? false,
    modificationRequest: d.modification_request ? {
      date: d.modification_request.date,
      time: d.modification_request.time,
      venueName: d.modification_request.venue_name,
      venueCity: d.modification_request.venue_city,
      reason: d.modification_request.reason,
      requestedBy: d.modification_request.requested_by,
    } : null,
    localRefereeName: d.local_referee_name ?? null,
    autoAcceptPlayers: d.auto_accept_players ?? false,
    validationStatus: d.validation_status ?? "pending",
    completedAt: d.completed_at ?? null,
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
    postMatchFeedback: d.post_match_feedback ? Object.fromEntries(
      Object.entries(d.post_match_feedback).map(([k, v]) => [k, {
        validation: v.validation,
        comments: v.comments,
        refereeRating: v.referee_rating,
        createdAt: v.created_at,
      }])
    ) : null,
    createdAt: formatDate(d.created_at), updatedAt: formatDate(d.updated_at),
  };
}

export function toUserProfile(uid: string, data: FirestoreUser): UserProfile {
  return {
    uid,
    email: data.email,
    phone: data.phone,
    firstName: data.first_name,
    lastName: data.last_name,
    userType: data.user_type,
    locationCity: data.location_city,
    bio: data.bio ?? null,
    profilePictureUrl: data.profile_picture_url,
    coverPhotoUrl: data.cover_photo_url,
    companyName: data.company_name ?? null,
    isActive: data.is_active,
    emailVerified: false,
    authProviders: data.auth_providers ?? [],
    createdAt: formatDate(data.created_at),
    updatedAt: formatDate(data.updated_at),
    ...(data.position !== undefined && { position: data.position }),
    ...(data.skill_level !== undefined && { skillLevel: data.skill_level }),
    ...(data.team_name !== undefined && { teamName: data.team_name }),
    ...(data.license_number !== undefined && { licenseNumber: data.license_number }),
    ...(data.license_level !== undefined && { licenseLevel: data.license_level }),
    ...(data.experience_years !== undefined && { experienceYears: data.experience_years }),
    ...(data.strong_foot !== undefined && { strongFoot: data.strong_foot }),
    ...(data.height !== undefined && { height: data.height }),
    ...(data.weight !== undefined && { weight: data.weight }),
    ...(data.date_of_birth !== undefined && { dateOfBirth: data.date_of_birth }),
    followersCount: data.followers_count ?? 0,
    followingCount: data.following_count ?? 0,
    galleryPhotos: data.gallery_photos ?? [],
    trophies: data.trophies ?? [],
  };
}

export async function getMatchParticipations(matchId: string): Promise<Participation[]> {
  const q = query(collection(db, "participations"), where("match_id", "==", matchId));
  const snap = await getDocs(q);
  return snap.docs.map(d => toParticipation(d.id, d.data() as FirestoreParticipation));
}

/**
 * Get all members of a team
 */
export async function getTeamMembers(teamId: string): Promise<UserProfile[]> {
  const q = query(
    collection(db, "users"),
    where("team_id", "==", teamId),
    where("is_active", "==", true)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => toUserProfile(d.id, d.data() as FirestoreUser));
}


export function toParticipation(id: string, d: FirestoreParticipation): Participation {
  return {
    id, playerId: d.player_id, playerName: d.player_name,
    teamId: d.team_id, matchId: d.match_id, matchLabel: d.match_label,
    matchDate: d.match_date, matchTime: d.match_time, venueName: d.venue_name,
    status: d.status, goals: d.goals ?? 0, assists: d.assists ?? 0,
    matchFormat: d.match_format ?? "", isHome: d.is_home ?? false,
    squadNumber: d.squad_number, matchRole: d.match_role,
    createdAt: formatDate(d.created_at), updatedAt: formatDate(d.updated_at),
  };
}

export function toInvitation(id: string, d: FirestoreInvitation): Invitation {
  return {
    id, senderId: d.sender_id, senderName: d.sender_name,
    receiverId: d.receiver_id, receiverName: d.receiver_name,
    receiverCity: d.receiver_city, receiverPosition: d.receiver_position,
    receiverLevel: d.receiver_level, teamId: d.team_id, teamName: d.team_name,
    message: d.message, status: d.status,
    createdAt: formatDate(d.created_at), updatedAt: formatDate(d.updated_at),
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
      repostOf: meta.repost_of ? {
        postId: meta.repost_of.post_id,
        authorName: meta.repost_of.author_name,
        content: meta.repost_of.content,
      } : undefined,
    } : null,
    likes, commentCount: d.comment_count ?? 0,
    isLiked: currentUserId ? likes.includes(currentUserId) : false,
    mediaUrls: d.media_urls ?? [],
    createdAt: formatDate(d.created_at), updatedAt: formatDate(d.updated_at),
  };
}

function toComment(id: string, d: FirestoreComment): Comment {
  return {
    id, authorId: d.author_id, authorName: d.author_name,
    content: d.content, createdAt: formatDate(d.created_at),
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

export async function updateTeamSquadNumbers(teamId: string, squadNumbers: Record<string, string>): Promise<void> {
  await updateDoc(doc(db, "teams", teamId), {
    squad_numbers: squadNumbers,
    updated_at: serverTimestamp(),
  });
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
  void createNotification({
    userId: data.managerId,
    type: "join_request",
    title: "Demande d'adhésion",
    body: `${data.playerName} souhaite rejoindre ${data.teamName}`,
    link: "/teams",
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

export function onLiveMatches(callback: (matches: Match[]) => void): Unsubscribe {
  const qLive = query(
    collection(db, "matches"),
    where("status", "==", "live"),
    orderBy("created_at", "desc")
  );
  
  return onSnapshot(qLive, (snap) => {
    const matches = snap.docs.map(d => toMatch(d.id, d.data() as FirestoreMatch));
    callback(matches);
  });
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
  format: string; isHome: boolean; playersTotal: number; localRefereeName?: string;
  autoAcceptPlayers?: boolean;
}): Promise<string> {
  const ref = await addDoc(collection(db, "matches"), {
    home_team_id: data.homeTeamId, away_team_id: data.awayTeamId,
    home_team_name: data.homeTeamName, away_team_name: data.awayTeamName,
    manager_id: data.managerId, away_manager_id: data.awayManagerId,
    date: data.date, time: data.time,
    venue_name: data.venueName, venue_city: data.venueCity,
    status: "challenge", result: null, score_home: null, score_away: null,
    referee_id: null, referee_name: null, referee_status: "none",
    local_referee_name: data.localRefereeName ?? null,
    format: data.format, is_home: data.isHome,
    players_confirmed: 0, players_total: data.playersTotal,
    confirmed_home: 0, confirmed_away: 0,
    auto_accept_players: !!data.autoAcceptPlayers,
    created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  void createNotification({
    userId: data.awayManagerId,
    type: "match_challenge",
    title: "Nouveau défi reçu",
    body: `${data.homeTeamName} vous défie`,
    link: "/matches",
  });
  return ref.id;
}

export async function updateMatch(matchId: string, data: Partial<FirestoreMatch>): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), { ...data, updated_at: serverTimestamp() });
}

export async function updateMatchLineup(
  matchId: string, 
  teamId: string, 
  isHome: boolean,
  assignments: { playerId: string; squadNumber: string; role: "starter" | "substitute" }[]
): Promise<void> {
  const batch = writeBatch(db);
  
  const q = query(
    collection(db, "participations"), 
    where("match_id", "==", matchId), 
    where("team_id", "==", teamId)
  );
  const snap = await getDocs(q);
  
  snap.docs.forEach(d => {
    batch.update(d.ref, {
      match_role: null,
      updated_at: serverTimestamp(),
    });
  });

  assignments.forEach(asgn => {
    const doc = snap.docs.find(d => d.data().player_id === asgn.playerId);
    if (doc) {
      batch.update(doc.ref, {
        squad_number: asgn.squadNumber,
        match_role: asgn.role,
        updated_at: serverTimestamp(),
      });
    }
  });

  const matchRef = doc(db, "matches", matchId);
  batch.update(matchRef, {
    [isHome ? "home_lineup_ready" : "away_lineup_ready"]: true,
    updated_at: serverTimestamp(),
  });

  await batch.commit();
}

export async function cancelMatch(matchId: string): Promise<void> {
  await cancelMatchParticipations(matchId);
  await updateDoc(doc(db, "matches", matchId), {
    status: "cancelled",
    updated_at: serverTimestamp(),
  });
}

export async function submitManagerFeedback(
  matchId: string,
  managerId: string,
  data: {
    validation: "validated" | "contested";
    comments?: string;
    refereeRating?: number;
  },
  ghostRollup?: {
    teamId: string;
    ghostPlayers: GhostPlayer[];
  }
): Promise<void> {
  const matchRef = doc(db, "matches", matchId);
  await runTransaction(db, async (transaction) => {
    const matchSnap = await transaction.get(matchRef);
    if (!matchSnap.exists()) throw new Error("Match not found");
    const matchData = matchSnap.data() as FirestoreMatch;

    const feedback = { ...(matchData.post_match_feedback || {}) };
    const feedbackEntry: any = {
      validation: data.validation,
      created_at: new Date().toISOString(),
    };
    if (data.comments) feedbackEntry.comments = data.comments;
    if (data.refereeRating) feedbackEntry.referee_rating = data.refereeRating;

    feedback[managerId] = feedbackEntry;

    let validation_status: "pending" | "contested" | "validated" = matchData.validation_status ?? "pending";
    if (data.validation === "contested") {
      validation_status = "contested";
    } else if (validation_status !== "contested") {
      // Check if both managers have provided feedback.
      const bothValidated =
        feedback[matchData.manager_id]?.validation === "validated" &&
        feedback[matchData.away_manager_id]?.validation === "validated";
      if (bothValidated) {
        validation_status = "validated";
      }
    }

    transaction.update(matchRef, {
      post_match_feedback: feedback,
      validation_status,
      updated_at: serverTimestamp(),
    });
  });

  // Rollup ghost player stats after transaction
  if (ghostRollup && ghostRollup.ghostPlayers.length > 0) {
    // Re-read match events after transaction to get liveState
    const matchSnap = await getDoc(doc(db, "matches", matchId));
    if (matchSnap.exists()) {
      const matchData = matchSnap.data() as FirestoreMatch;
      if (matchData.live_state?.events) {
        await rollupGhostPlayerStats(
          ghostRollup.teamId,
          ghostRollup.ghostPlayers,
          matchData.live_state.events as unknown as NonNullable<Match["liveState"]>["events"]
        );
      }
    }
  }
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
  autoAccept: boolean = false,
): Promise<void> {
  const status = accepted ? (autoAccept ? "upcoming" : "pending") : "cancelled";
  await updateDoc(doc(db, "matches", matchId), {
    status, updated_at: serverTimestamp(),
  });
  if (accepted) {
    await createParticipationsForTeam(matchId, matchLabel, matchDate, matchTime, venueName, homeTeamId, homeTeamMemberIds, homeTeamMemberNames, format, true, !!autoAccept);
    await createParticipationsForTeam(matchId, matchLabel, matchDate, matchTime, venueName, awayTeamId, awayTeamMemberIds, awayTeamMemberNames, format, false, !!autoAccept);
    
    if (autoAccept) {
      // Create announcement immediately if auto-accepting
      await addDoc(collection(db, "posts"), {
        author_id: "system",
        author_name: "Koppafoot",
        author_role: "system",
        author_avatar: "",
        type: "match_announcement",
        content: `⚽ Match confirmé ! ${matchLabel} le ${matchDate} à ${matchTime} — ${venueName}`,
        metadata: { home_team: homeTeamId, away_team: awayTeamId },
        likes: [], comment_count: 0,
        created_at: serverTimestamp(), updated_at: serverTimestamp(),
      });
    }
  } else {
    await cancelMatchParticipations(matchId);
  }
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

export async function invitePlayerToMatch(
  matchId: string, 
  matchLabel: string, 
  matchDate: string, 
  matchTime: string,
  venueName: string, 
  playerId: string, 
  playerName: string, 
  teamId: string, 
  format: string, 
  isHome: boolean,
  autoConfirm: boolean = false
): Promise<void> {
  const participationData = {
    player_id: playerId,
    player_name: playerName,
    team_id: teamId,
    match_id: matchId,
    match_label: matchLabel,
    match_date: matchDate,
    match_time: matchTime,
    venue_name: venueName,
    status: autoConfirm ? "confirmed" : "pending",
    goals: 0,
    assists: 0,
    match_format: format,
    is_home: isHome,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await addDoc(collection(db, "participations"), participationData);

  if (!autoConfirm) {
    void createNotification({
      userId: playerId,
      type: "participation_request",
      title: "Convocation à un match",
      body: `Vous êtes convoqué pour ${matchLabel} le ${matchDate}`,
      link: "/participations",
    });
  }

  if (autoConfirm) {
    const matchRef = doc(db, "matches", matchId);
    await updateDoc(matchRef, {
      [isHome ? "confirmed_home" : "confirmed_away"]: increment(1),
      players_confirmed: increment(1),
      updated_at: serverTimestamp(),
    });
  }
}

export async function createParticipationsForTeam(
  matchId: string, matchLabel: string, matchDate: string, matchTime: string,
  venueName: string, teamId: string, memberIds: string[],
  memberNames: Map<string, string>, format: string, isHome: boolean,
  autoConfirm: boolean = false,
): Promise<void> {
  const batch: Promise<unknown>[] = [];
  for (const playerId of memberIds) {
    batch.push(invitePlayerToMatch(
      matchId, matchLabel, matchDate, matchTime, venueName,
      playerId, memberNames.get(playerId) ?? "", teamId,
      format, isHome, autoConfirm
    ));
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
    status: "completed",
    updated_at: serverTimestamp(),
  });
}

export async function updateMatchStatus(matchId: string, status: Match["status"]): Promise<void> {
  const matchRef = doc(db, "matches", matchId);
  const matchSnap = await getDoc(matchRef);
  if (!matchSnap.exists()) return;
  const matchData = matchSnap.data() as FirestoreMatch;

  const updates: any = {
    status,
    updated_at: serverTimestamp(),
  };

  if (status === "completed") {
    updates.validation_status = "pending";
    updates.completed_at = serverTimestamp();
  }

  // 1. Calculate Result & Final Stats Rollup
  if (status === "completed") {
    const sh = matchData.score_home ?? 0;
    const sa = matchData.score_away ?? 0;
    let matchResult: "win" | "loss" | "draw";
    
    if (sh > sa) matchResult = "win";
    else if (sh < sa) matchResult = "loss";
    else matchResult = "draw";
    
    updates.result = matchResult;

    // Start a batch for all rollups
    const batch = writeBatch(db);

    // A. Team Rollups
    if (matchData.home_team_id && matchData.home_team_id !== "") {
      const homeTeamRef = doc(db, "teams", matchData.home_team_id);
      batch.update(homeTeamRef, {
        matches_played: increment(1),
        wins: increment(matchResult === "win" ? 1 : 0),
        losses: increment(matchResult === "loss" ? 1 : 0),
        draws: increment(matchResult === "draw" ? 1 : 0),
        updated_at: serverTimestamp(),
      });
    }
    if (matchData.away_team_id && matchData.away_team_id !== "") {
      const awayTeamRef = doc(db, "teams", matchData.away_team_id);
      const awayResult = matchResult === "win" ? "loss" : (matchResult === "loss" ? "win" : "draw");
      batch.update(awayTeamRef, {
        matches_played: increment(1),
        wins: increment(awayResult === "win" ? 1 : 0),
        losses: increment(awayResult === "loss" ? 1 : 0),
        draws: increment(awayResult === "draw" ? 1 : 0),
        updated_at: serverTimestamp(),
      });
    }

    // B. Player Rollups
    // Query all participations for this match and filter in-memory to avoid index requirements
    const partsQuery = query(collection(db, "participations"), where("match_id", "==", matchId));
    const partsSnap = await getDocs(partsQuery);
    
    const goalsPerPlayer: Record<string, number> = {};
    if (matchData.live_state?.events) {
      matchData.live_state.events.forEach(ev => {
        if (ev.type === "goal" && ev.player_id) {
          goalsPerPlayer[ev.player_id] = (goalsPerPlayer[ev.player_id] || 0) + 1;
        }
      });
    }

    for (const pDoc of partsSnap.docs) {
      const pData = pDoc.data() as FirestoreParticipation;
      if (pData.status !== "confirmed") continue;
      
      const playerId = pData.player_id;
      if (!playerId) continue;

      const playerGoals = goalsPerPlayer[playerId] || 0;
      const playerAssists = pData.assists || 0;

      batch.update(pDoc.ref, {
        goals: playerGoals,
        updated_at: serverTimestamp(),
      });

      const userRef = doc(db, "users", playerId);
      batch.update(userRef, {
        matches_played: increment(1),
        goals: increment(playerGoals),
        assists: increment(playerAssists),
        updated_at: serverTimestamp(),
      });
    }

    // C. Update Match with result
    batch.update(matchRef, updates);
    await batch.commit();
  } else {
    // Normal status update (pending -> upcoming, etc.)
    await updateDoc(matchRef, updates);
  }
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
  void createNotification({
    userId: data.receiverId,
    type: "invitation",
    title: "Nouvelle invitation",
    body: `${data.senderName} vous invite à rejoindre ${data.teamName}`,
    link: "/mercato",
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
  metadata?: {
    home_team?: string; away_team?: string; score_home?: number; score_away?: number;
    team_name?: string;
    repost_of?: { post_id: string; author_name: string; content: string };
  } | null;
  mediaUrls?: string[];
}): Promise<string> {
  const ref = await addDoc(collection(db, "posts"), {
    author_id: data.authorId, author_name: data.authorName,
    author_role: data.authorRole, author_avatar: data.authorAvatar,
    type: data.type, content: data.content,
    metadata: data.metadata ?? null, likes: [], comment_count: 0,
    media_urls: data.mediaUrls ?? [],
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

export async function deletePost(postId: string): Promise<void> {
  await deleteDoc(doc(db, "posts", postId));
}

export async function updatePostContent(postId: string, content: string): Promise<void> {
  await updateDoc(doc(db, "posts", postId), { content, updated_at: serverTimestamp() });
}

export async function getMatchesByCity(city: string, limitCount = 15): Promise<Match[]> {
  const q = query(
    collection(db, "matches"),
    where("venue_city", "==", city),
    where("status", "in", ["upcoming", "completed"]),
    orderBy("date", "desc"),
    firestoreLimit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toMatch(d.id, d.data() as FirestoreMatch));
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

export async function startMatchTimer(matchId: string): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    "live_state.is_timer_running": true,
    "live_state.timer_start_at": new Date().toISOString(),
    updated_at: serverTimestamp(),
  });
}

export async function pauseMatchTimer(matchId: string, currentOffset: number): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    "live_state.is_timer_running": false,
    "live_state.timer_start_at": null,
    "live_state.timer_offset": currentOffset,
    updated_at: serverTimestamp(),
  });
}

export async function addMatchEvent(matchId: string, event: any): Promise<void> {
  const matchRef = doc(db, "matches", matchId);
  const eventId = Math.random().toString(36).substring(2, 11);
  const newEvent = {
    ...event,
    id: eventId,
    created_at: new Date().toISOString(),
  };

  const updates: any = {
    "live_state.events": arrayUnion(newEvent),
    updated_at: serverTimestamp(),
  };

  if (event.type === "goal") {
    const field = event.team_id === "home" || event.isHome ? "score_home" : "score_away";
    updates[field] = increment(1);
  }

  await updateDoc(matchRef, updates);
}

export async function updateMatchPeriod(matchId: string, period: number): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    "live_state.current_period": period,
    updated_at: serverTimestamp(),
  });
}

export async function initLiveMatch(matchId: string): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
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

export async function getGlobalMatches(limitCount = 20): Promise<Match[]> {
  const matchesRef = collection(db, "matches");
  // Only upcoming, live or recently completed
  const q = query(
    matchesRef,
    where("status", "in", ["upcoming", "live", "completed"]),
    orderBy("date", "desc"),
    firestoreLimit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => toMatch(doc.id, doc.data() as FirestoreMatch));
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
  const followId = `${followerId}_${followingId}`;
  const batch = writeBatch(db);

  // Create follow document with deterministic ID
  const followRef = doc(db, "follows", followId);
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
  const followId = `${followerId}_${followingId}`;
  const batch = writeBatch(db);

  // Delete follow document
  batch.delete(doc(db, "follows", followId));

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
  if (!followerId || !followingId) return false;
  try {
    const followId = `${followerId}_${followingId}`;
    const snap = await getDoc(doc(db, "follows", followId));
    return snap.exists();
  } catch (error: any) {
    console.error("Error in isFollowing:", error);
    return false;
  }
}




export async function getFollowersCount(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return 0;
  return (snap.data() as FirestoreUser).followers_count ?? 0;
}

// ============================================
// Posts by User
// ============================================

// ============================================
// Team Customisation
// ============================================

export async function updateTeamMedia(
  teamId: string,
  data: { logoUrl?: string; bannerUrl?: string; slogan?: string }
): Promise<void> {
  const update: Record<string, unknown> = { updated_at: serverTimestamp() };
  if (data.logoUrl !== undefined) update.logo_url = data.logoUrl;
  if (data.bannerUrl !== undefined) update.banner_url = data.bannerUrl;
  if (data.slogan !== undefined) update.slogan = data.slogan;
  await updateDoc(doc(db, "teams", teamId), update);
}

export async function addAchievement(
  teamId: string,
  achievement: Omit<Achievement, "id">
): Promise<void> {
  const newAchievement: Achievement = { ...achievement, id: crypto.randomUUID() };
  await updateDoc(doc(db, "teams", teamId), {
    achievements: arrayUnion(newAchievement),
    updated_at: serverTimestamp(),
  });
}

export async function removeAchievement(teamId: string, achievementId: string): Promise<void> {
  const team = await getTeamById(teamId);
  if (!team) return;
  const updated = (team.achievements ?? []).filter((a) => a.id !== achievementId);
  await updateDoc(doc(db, "teams", teamId), {
    achievements: updated,
    updated_at: serverTimestamp(),
  });
}

export async function addGalleryUrl(teamId: string, url: string): Promise<void> {
  await updateDoc(doc(db, "teams", teamId), {
    gallery_urls: arrayUnion(url),
    updated_at: serverTimestamp(),
  });
}

export async function removeGalleryUrl(teamId: string, url: string): Promise<void> {
  await updateDoc(doc(db, "teams", teamId), {
    gallery_urls: arrayRemove(url),
    updated_at: serverTimestamp(),
  });
}

export async function updateTeamLineup(teamId: string, lineupIds: string[]): Promise<void> {
  await updateDoc(doc(db, "teams", teamId), {
    lineup_ids: lineupIds,
    updated_at: serverTimestamp(),
  });
}

// ============================================
// Team Follows
// ============================================

export async function followTeam(followerId: string, teamId: string): Promise<void> {
  const followId = `${followerId}_team_${teamId}`;
  await setDoc(doc(db, "team_follows", followId), {
    follower_id: followerId,
    team_id: teamId,
    created_at: serverTimestamp(),
  });
  await updateDoc(doc(db, "teams", teamId), {
    followers_count: increment(1),
    updated_at: serverTimestamp(),
  });
}

export async function unfollowTeam(followerId: string, teamId: string): Promise<void> {
  const followId = `${followerId}_team_${teamId}`;
  await deleteDoc(doc(db, "team_follows", followId));
  await updateDoc(doc(db, "teams", teamId), {
    followers_count: increment(-1),
    updated_at: serverTimestamp(),
  });
}

export async function isFollowingTeam(followerId: string, teamId: string): Promise<boolean> {
  const followId = `${followerId}_team_${teamId}`;
  const snap = await getDoc(doc(db, "team_follows", followId));
  return snap.exists();
}

// ============================================
// Trainings
// ============================================

function toTraining(id: string, d: FirestoreTraining): Training {
  return {
    id, teamId: d.team_id, managerId: d.manager_id,
    title: d.title, date: d.date, time: d.time, location: d.location,
    description: d.description,
    attendees: d.attendees ?? [],
    createdAt: formatDate(d.created_at), updatedAt: formatDate(d.updated_at),
  };
}

export async function createTraining(data: {
  teamId: string; managerId: string; title: string;
  date: string; time: string; location: string; description?: string;
  memberIds: string[];
}): Promise<string> {
  const attendees: TrainingAttendee[] = data.memberIds
    .filter((id) => id !== data.managerId)
    .map((player_id) => ({ player_id, status: "pending" as const }));
  const ref = await addDoc(collection(db, "trainings"), {
    team_id: data.teamId, manager_id: data.managerId,
    title: data.title, date: data.date, time: data.time,
    location: data.location,
    ...(data.description && { description: data.description }),
    attendees,
    created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  return ref.id;
}

export async function getTrainingsByTeam(teamId: string): Promise<Training[]> {
  const q = query(collection(db, "trainings"), where("team_id", "==", teamId), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toTraining(d.id, d.data() as FirestoreTraining));
}

export function onTrainingsByTeam(teamId: string, callback: (data: Training[]) => void): Unsubscribe {
  const q = query(collection(db, "trainings"), where("team_id", "==", teamId), orderBy("date", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => toTraining(d.id, d.data() as FirestoreTraining)));
  });
}

export async function respondToTraining(
  trainingId: string,
  playerId: string,
  status: "confirmed" | "declined"
): Promise<void> {
  const snap = await getDoc(doc(db, "trainings", trainingId));
  if (!snap.exists()) return;
  const data = snap.data() as FirestoreTraining;
  const attendees = (data.attendees ?? []).map((a) =>
    a.player_id === playerId ? { ...a, status } : a
  );
  await updateDoc(doc(db, "trainings", trainingId), {
    attendees, updated_at: serverTimestamp(),
  });
}

export async function deleteTraining(trainingId: string): Promise<void> {
  await deleteDoc(doc(db, "trainings", trainingId));
}

// ============================================
// Player Ratings
// ============================================

function toPlayerRating(id: string, d: FirestorePlayerRating): PlayerRating {
  return {
    id, matchId: d.match_id, playerId: d.player_id, teamId: d.team_id,
    ratedBy: d.rated_by, score: d.score, createdAt: formatDate(d.created_at),
  };
}

export async function ratePlayer(data: {
  matchId: string; playerId: string; teamId: string; ratedBy: string; score: number;
}): Promise<void> {
  const q = query(
    collection(db, "player_ratings"),
    where("match_id", "==", data.matchId),
    where("player_id", "==", data.playerId),
    where("rated_by", "==", data.ratedBy)
  );
  const existing = await getDocs(q);
  if (!existing.empty) {
    await updateDoc(existing.docs[0].ref, { score: data.score });
  } else {
    await addDoc(collection(db, "player_ratings"), {
      match_id: data.matchId, player_id: data.playerId,
      team_id: data.teamId, rated_by: data.ratedBy,
      score: data.score, created_at: serverTimestamp(),
    });
  }
}

export async function getRatingsForMatch(matchId: string): Promise<PlayerRating[]> {
  const q = query(collection(db, "player_ratings"), where("match_id", "==", matchId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toPlayerRating(d.id, d.data() as FirestorePlayerRating));
}

export async function getAverageRatingForPlayer(playerId: string): Promise<number | null> {
  const q = query(collection(db, "player_ratings"), where("player_id", "==", playerId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const total = snap.docs.reduce((sum, d) => sum + (d.data() as FirestorePlayerRating).score, 0);
  return Math.round((total / snap.docs.length) * 10) / 10;
}

// ============================================
// Posts by User
// ============================================

export async function getPostsByUser(userId: string, currentUserId?: string, maxResults = 20): Promise<Post[]> {
  try {
    const q = query(
      collection(db, "posts"),
      where("author_id", "==", userId),
      orderBy("created_at", "desc"),
      firestoreLimit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => toPost(d.id, d.data() as FirestorePost, currentUserId));
  } catch (error: any) {
    console.error("Error in getPostsByUser:", error);
    // Fallback if index is missing (common with Missing or insufficient permissions error)
    if (error.code === "permission-denied" || error.code === "failed-precondition" || error.message?.includes("index")) {
      try {
        const qSimple = query(
          collection(db, "posts"),
          where("author_id", "==", userId),
          firestoreLimit(maxResults)
        );
        const snap = await getDocs(qSimple);
        return snap.docs
          .map((d) => toPost(d.id, d.data() as FirestorePost, currentUserId))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } catch (innerError) {
        console.error("Fallback query also failed:", innerError);
        return [];
      }
    }
    return [];
  }
}

// ============================================
// Venue Owner Business Logic
// ============================================

function toBooking(id: string, d: FirestoreBooking): Booking {
  return {
    id,
    venueId: d.venue_id,
    venueName: d.venue_name,
    ownerId: d.owner_id,
    userId: d.user_id,
    userName: d.user_name,
    date: d.date,
    time: d.time,
    duration: d.duration,
    totalPrice: d.total_price,
    status: d.status,
    createdAt: formatDate(d.created_at),
    updatedAt: formatDate(d.updated_at),
  };
}

export async function getVenuesByOwner(ownerId: string): Promise<Venue[]> {
  const q = query(collection(db, "venues"), where("owner_id", "==", ownerId), orderBy("created_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toVenue(d.id, d.data() as FirestoreVenue));
}

export function onVenuesByOwner(ownerId: string, callback: (data: Venue[]) => void): Unsubscribe {
  const q = query(collection(db, "venues"), where("owner_id", "==", ownerId), orderBy("created_at", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => toVenue(d.id, d.data() as FirestoreVenue)));
  });
}

export async function getVenueById(venueId: string): Promise<Venue | null> {
  const snap = await getDoc(doc(db, "venues", venueId));
  if (!snap.exists()) return null;
  return toVenue(snap.id, snap.data() as FirestoreVenue);
}

export async function createVenue(data: Omit<Venue, "id" | "createdAt" | "updatedAt" | "rating" | "reviewCount">): Promise<string> {
  const ref = await addDoc(collection(db, "venues"), {
    name: data.name,
    address: data.address,
    city: data.city,
    owner_id: data.ownerId,
    field_type: data.fieldType,
    field_surface: data.fieldSurface,
    field_size: data.fieldSize,
    price_per_hour: data.pricePerHour,
    amenities: data.amenities,
    available: data.available,
    photo_url: data.photoUrl,
    rating: 0,
    review_count: 0,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return ref.id;
}

export async function updateVenue(venueId: string, data: Partial<Omit<Venue, "id" | "createdAt" | "updatedAt">>): Promise<void> {
  const updates: any = {};
  if (data.name) updates.name = data.name;
  if (data.address) updates.address = data.address;
  if (data.city) updates.city = data.city;
  if (data.fieldType) updates.field_type = data.fieldType;
  if (data.fieldSurface) updates.field_surface = data.fieldSurface;
  if (data.fieldSize) updates.field_size = data.fieldSize;
  if (data.pricePerHour !== undefined) updates.price_per_hour = data.pricePerHour;
  if (data.amenities) updates.amenities = data.amenities;
  if (data.available !== undefined) updates.available = data.available;
  if (data.photoUrl !== undefined) updates.photo_url = data.photoUrl;
  
  updates.updated_at = serverTimestamp();
  await updateDoc(doc(db, "venues", venueId), updates);
}

export async function deleteVenue(venueId: string): Promise<void> {
  await deleteDoc(doc(db, "venues", venueId));
}

export function onBookingsByOwner(ownerId: string, callback: (data: Booking[]) => void): Unsubscribe {
  const q = query(collection(db, "bookings"), where("owner_id", "==", ownerId), orderBy("created_at", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => toBooking(d.id, d.data() as FirestoreBooking)));
  });
}

export async function updateBookingStatus(bookingId: string, status: Booking["status"]): Promise<void> {
  await updateDoc(doc(db, "bookings", bookingId), {
    status,
    updated_at: serverTimestamp(),
  });
}

/**
 * Updates the referee status for a match
 */
export async function updateMatchRefereeStatus(
  matchId: string,
  status: "confirmed" | "declined" | "pending" | "invited" | "none"
) {
  const matchRef = doc(db, "matches", matchId);
  await updateDoc(matchRef, {
    referee_status: status,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Contests a specific match event
 */
export async function contestMatchEvent(
  matchId: string,
  eventId: string,
  managerId: string,
  reason: string
): Promise<void> {
  const matchRef = doc(db, "matches", matchId);
  await runTransaction(db, async (transaction) => {
    const matchSnap = await transaction.get(matchRef);
    if (!matchSnap.exists()) throw new Error("Match not found");
    const matchData = matchSnap.data() as FirestoreMatch;

    if (!matchData.live_state || !matchData.live_state.events) {
      throw new Error("No live state or events found");
    }

    const eventIndex = matchData.live_state.events.findIndex(e => e.id === eventId);
    if (eventIndex === -1) throw new Error("Event not found");

    const newEvents = [...matchData.live_state.events];
    newEvents[eventIndex] = {
      ...newEvents[eventIndex],
      contested_by_manager_id: managerId,
      contestation_reason: reason,
    };

    transaction.update(matchRef, {
      "live_state.events": newEvents,
      updated_at: serverTimestamp(),
    });
  });
}

// ============================================
// Ghost Players
// ============================================

export async function createGhostPlayer(
  teamId: string,
  data: {
    firstName: string;
    lastName: string;
    position: "goalkeeper" | "defender" | "midfielder" | "forward";
    squadNumber?: string;
  }
): Promise<string> {
  const ref = collection(db, "teams", teamId, "ghost_players");
  const docRef = await addDoc(ref, {
    first_name: data.firstName.trim(),
    last_name: data.lastName.trim(),
    position: data.position,
    squad_number: data.squadNumber?.trim() || null,
    matches_played: 0,
    goals: 0,
    assists: 0,
    yellow_cards: 0,
    red_cards: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return docRef.id;
}

export async function updateGhostPlayer(
  teamId: string,
  ghostId: string,
  data: {
    firstName?: string;
    lastName?: string;
    position?: "goalkeeper" | "defender" | "midfielder" | "forward";
    squadNumber?: string;
  }
): Promise<void> {
  const ref = doc(db, "teams", teamId, "ghost_players", ghostId);
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.firstName !== undefined) update.first_name = data.firstName.trim();
  if (data.lastName !== undefined) update.last_name = data.lastName.trim();
  if (data.position !== undefined) update.position = data.position;
  if (data.squadNumber !== undefined) update.squad_number = data.squadNumber.trim() || null;
  await updateDoc(ref, update);
}

export async function deleteGhostPlayer(teamId: string, ghostId: string): Promise<void> {
  await deleteDoc(doc(db, "teams", teamId, "ghost_players", ghostId));
}

export async function getGhostPlayersByTeam(teamId: string): Promise<GhostPlayer[]> {
  const ref = collection(db, "teams", teamId, "ghost_players");
  const snap = await getDocs(ref);
  return snap.docs.map((d) => toGhostPlayer(d.id, teamId, d.data() as FirestoreGhostPlayer));
}

export function onGhostPlayersByTeam(
  teamId: string,
  callback: (data: GhostPlayer[]) => void
): Unsubscribe {
  const ref = collection(db, "teams", teamId, "ghost_players");
  return onSnapshot(ref, (snap) => {
    callback(snap.docs.map((d) => toGhostPlayer(d.id, teamId, d.data() as FirestoreGhostPlayer)));
  });
}

export async function rollupGhostPlayerStats(
  teamId: string,
  ghostPlayers: GhostPlayer[],
  matchEvents: NonNullable<Match["liveState"]>["events"]
): Promise<void> {
  if (!ghostPlayers.length || !matchEvents?.length) return;

  const ghostIds = new Set(ghostPlayers.map((g) => g.id));
  const stats: Record<string, { goals: number; assists: number; yellow_cards: number; red_cards: number }> = {};

  for (const event of matchEvents) {
    if (!event.playerId || !ghostIds.has(event.playerId)) continue;
    if (!stats[event.playerId]) stats[event.playerId] = { goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 };
    if (event.type === "goal") stats[event.playerId].goals += 1;
    if (event.type === "yellow_card") stats[event.playerId].yellow_cards += 1;
    if (event.type === "red_card") stats[event.playerId].red_cards += 1;
  }

  if (!Object.keys(stats).length) return;

  const batch = writeBatch(db);
  for (const [ghostId, s] of Object.entries(stats)) {
    const ref = doc(db, "teams", teamId, "ghost_players", ghostId);
    batch.update(ref, {
      goals: increment(s.goals),
      assists: increment(s.assists),
      yellow_cards: increment(s.yellow_cards),
      red_cards: increment(s.red_cards),
      matches_played: increment(1),
      updated_at: new Date().toISOString(),
    });
  }
  await batch.commit();
}

// ============================================
// Notifications
// ============================================

export async function createNotification(data: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, "notifications"), {
    user_id: data.userId,
    type: data.type,
    title: data.title,
    body: data.body,
    link: data.link ?? null,
    read: false,
    created_at: serverTimestamp(),
  });

  // Best-effort push — fire and forget
  const currentUser = auth.currentUser;
  if (currentUser) {
    currentUser.getIdToken().then((token) => {
      fetch("/api/notifications/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: data.userId,
          title: data.title,
          body: data.body,
          link: data.link,
          type: data.type,
        }),
      }).catch(() => {});
    }).catch(() => {});
  }

  return ref.id;
}

export function onNotifications(
  userId: string,
  callback: (data: Notification[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "notifications"),
    where("user_id", "==", userId),
    orderBy("created_at", "desc"),
    firestoreLimit(50)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => toNotification(d.id, d.data() as FirestoreNotification)));
  });
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, "notifications", notificationId), { read: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, "notifications"),
    where("user_id", "==", userId),
    where("read", "==", false)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}
