// ============================================
// KOPPAFOOT Admin — Firestore Queries
// Global platform monitoring (superadmin only)
// ============================================

import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  getDoc,
  getCountFromServer,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  UserProfile, FirestoreUser,
  Team, FirestoreTeam,
  Match, FirestoreMatch, MatchStatus,
  Venue, FirestoreVenue,
  Post, FirestorePost,
} from "@/types";

// ============================================
// Converters (re-export-compatible)
// ============================================

function toUserProfile(uid: string, d: FirestoreUser): UserProfile {
  return {
    uid,
    email: d.email,
    phone: d.phone,
    firstName: d.first_name,
    lastName: d.last_name,
    userType: d.user_type,
    locationCity: d.location_city,
    bio: d.bio ?? null,
    profilePictureUrl: d.profile_picture_url,
    coverPhotoUrl: d.cover_photo_url,
    companyName: d.company_name ?? null,
    isActive: d.is_active,
    emailVerified: false,
    authProviders: d.auth_providers ?? [],
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    ...(d.position !== undefined && { position: d.position }),
    ...(d.skill_level !== undefined && { skillLevel: d.skill_level }),
    ...(d.team_name !== undefined && { teamName: d.team_name }),
    ...(d.license_number !== undefined && { licenseNumber: d.license_number }),
    ...(d.license_level !== undefined && { licenseLevel: d.license_level }),
    ...(d.experience_years !== undefined && { experienceYears: d.experience_years }),
  };
}

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
  let effectiveStatus: MatchStatus = d.status;
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
    effectiveStatus,
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
    modificationRequest: d.modification_request
      ? {
          date: d.modification_request.date,
          time: d.modification_request.time,
          venueName: d.modification_request.venue_name,
          venueCity: d.modification_request.venue_city,
          reason: d.modification_request.reason,
          requestedBy: d.modification_request.requested_by,
        }
      : null,
    localRefereeName: d.local_referee_name ?? null,
    autoAcceptPlayers: d.auto_accept_players ?? false,
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
        createdAt: e.created_at,
      })),
    } : null,
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

// ============================================
// Collection Counts
// ============================================

export interface PlatformCounts {
  users: number;
  players: number;
  managers: number;
  referees: number;
  venueOwners: number;
  teams: number;
  matches: number;
  matchesPending: number;
  matchesUpcoming: number;
  matchesCompleted: number;
  venues: number;
  posts: number;
}

export async function getPlatformCounts(): Promise<PlatformCounts> {
  const [
    usersSnap,
    playersSnap,
    managersSnap,
    refereesSnap,
    venueOwnersSnap,
    teamsSnap,
    matchesSnap,
    matchesPendingSnap,
    matchesUpcomingSnap,
    matchesCompletedSnap,
    venuesSnap,
    postsSnap,
  ] = await Promise.all([
    getCountFromServer(collection(db, "users")),
    getCountFromServer(query(collection(db, "users"), where("user_type", "==", "player"))),
    getCountFromServer(query(collection(db, "users"), where("user_type", "==", "manager"))),
    getCountFromServer(query(collection(db, "users"), where("user_type", "==", "referee"))),
    getCountFromServer(query(collection(db, "users"), where("user_type", "==", "venue_owner"))),
    getCountFromServer(collection(db, "teams")),
    getCountFromServer(collection(db, "matches")),
    getCountFromServer(query(collection(db, "matches"), where("status", "==", "pending"))),
    getCountFromServer(query(collection(db, "matches"), where("status", "==", "upcoming"))),
    getCountFromServer(query(collection(db, "matches"), where("status", "==", "completed"))),
    getCountFromServer(collection(db, "venues")),
    getCountFromServer(collection(db, "posts")),
  ]);

  return {
    users: usersSnap.data().count,
    players: playersSnap.data().count,
    managers: managersSnap.data().count,
    referees: refereesSnap.data().count,
    venueOwners: venueOwnersSnap.data().count,
    teams: teamsSnap.data().count,
    matches: matchesSnap.data().count,
    matchesPending: matchesPendingSnap.data().count,
    matchesUpcoming: matchesUpcomingSnap.data().count,
    matchesCompleted: matchesCompletedSnap.data().count,
    venues: venuesSnap.data().count,
    posts: postsSnap.data().count,
  };
}

// ============================================
// Recent Users (all types)
// ============================================

export async function getRecentUsers(max = 10): Promise<UserProfile[]> {
  const q = query(collection(db, "users"), orderBy("created_at", "desc"), firestoreLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toUserProfile(d.id, d.data() as FirestoreUser));
}

export async function getAllUsers(max = 200): Promise<UserProfile[]> {
  const q = query(collection(db, "users"), orderBy("created_at", "desc"), firestoreLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toUserProfile(d.id, d.data() as FirestoreUser));
}

// ============================================
// Recent Matches
// ============================================

export async function getRecentMatches(max = 10): Promise<Match[]> {
  const q = query(collection(db, "matches"), orderBy("created_at", "desc"), firestoreLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toMatch(d.id, d.data() as FirestoreMatch));
}

export async function getAllMatches(max = 200): Promise<Match[]> {
  const q = query(collection(db, "matches"), orderBy("created_at", "desc"), firestoreLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toMatch(d.id, d.data() as FirestoreMatch));
}

// ============================================
// All Teams
// ============================================

export async function getAllTeams(max = 200): Promise<Team[]> {
  const q = query(collection(db, "teams"), orderBy("created_at", "desc"), firestoreLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toTeam(d.id, d.data() as FirestoreTeam));
}

// ============================================
// All Venues
// ============================================

export async function getAllVenues(max = 200): Promise<Venue[]> {
  const q = query(collection(db, "venues"), orderBy("created_at", "desc"), firestoreLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toVenue(d.id, d.data() as FirestoreVenue));
}

// ============================================
// User-level distribution (for charts)
// ============================================

export interface CityDistribution {
  city: string;
  count: number;
}

export async function getUserCityDistribution(): Promise<CityDistribution[]> {
  const q = query(collection(db, "users"), firestoreLimit(500));
  const snap = await getDocs(q);
  const cityMap = new Map<string, number>();
  for (const d of snap.docs) {
    const data = d.data() as FirestoreUser;
    const city = data.location_city || "Inconnu";
    cityMap.set(city, (cityMap.get(city) ?? 0) + 1);
  }
  return Array.from(cityMap.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);
}

// ============================================
// Admin user management
// ============================================

export async function toggleUserActive(uid: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    is_active: active,
    updated_at: serverTimestamp(),
  });
}

// ============================================
// Real-time listeners for admin
// ============================================

export function onRecentUsers(max: number, callback: (users: UserProfile[]) => void): Unsubscribe {
  const q = query(collection(db, "users"), orderBy("created_at", "desc"), firestoreLimit(max));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => toUserProfile(d.id, d.data() as FirestoreUser)));
  });
}

export function onRecentMatches(max: number, callback: (matches: Match[]) => void): Unsubscribe {
  const q = query(collection(db, "matches"), orderBy("created_at", "desc"), firestoreLimit(max));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => toMatch(d.id, d.data() as FirestoreMatch)));
  });
}
