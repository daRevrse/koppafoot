// ============================================
// KOPPAFOOT Admin, Firestore Queries
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
  Competition, FirestoreCompetition,
  GhostPlayer, FirestoreGhostPlayer,
} from "@/types";
import { toCompetition } from "@/lib/competition-mappers";
import { getUsersByIds, toGhostPlayer } from "@/lib/firestore";

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
    moderatorIds: d.moderator_ids ?? [],
    penaltyHome: d.penalty_home ?? null,
    penaltyAway: d.penalty_away ?? null,
    recordedAt: d.recorded_at ?? null,
    recordedScorers: (d.recorded_scorers ?? []).map((b) => ({
      playerId: b.player_id, sansCompte: b.sansCompte,
      nom: b.nom, buts: b.buts, passes: b.passes,
    })),
    // Repli sur `ghost_lineup` pour les matchs créés avant les champs par
    // camp : ce champ-là ne concernait que l'adversaire hors plateforme, donc
    // le camp opposé à celui du créateur (`is_home`).
    homeGhostLineup: (d.home_ghost_lineup
      ?? (!d.away_manager_id && !d.is_home ? d.ghost_lineup ?? [] : [])
    ).map((e) => ({ playerId: e.player_id, name: e.name, number: e.number, role: e.role })),
    awayGhostLineup: (d.away_ghost_lineup
      ?? (!d.away_manager_id && d.is_home ? d.ghost_lineup ?? [] : [])
    ).map((e) => ({ playerId: e.player_id, name: e.name, number: e.number, role: e.role })),
    confirmedHome: d.confirmed_home ?? 0,
    confirmedAway: d.confirmed_away ?? 0,
    // Voir la meme lecture dans lib/firestore : la feuille validee prime sur
    // l'heritage du camp hors plateforme.
    homeLineup: (d.home_lineup ?? d.home_ghost_lineup ?? []).map((e) => ({
      playerId: e.player_id, name: e.name, number: e.number, role: e.role,
    })),
    awayLineup: (d.away_lineup ?? d.away_ghost_lineup ?? []).map((e) => ({
      playerId: e.player_id, name: e.name, number: e.number, role: e.role,
    })),
    homeLineupReady: d.home_lineup_ready ?? false,
    awayLineupReady: d.away_lineup_ready ?? false,
    homeOnPitch: d.home_on_pitch ?? [],
    awayOnPitch: d.away_on_pitch ?? [],
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

export async function getAllTeams(max = 500): Promise<Team[]> {
  const q = query(collection(db, "teams"), orderBy("created_at", "desc"), firestoreLimit(max));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => toTeam(d.id, d.data() as FirestoreTeam))
    // Les adversaires d'amical ne sont plus écrits en base (voir
    // ghostOpponentLineup), mais ceux d'avant y restent. Ce ne sont pas des
    // clubs : ni compte, ni membre, ni personne derrière. L'annuaire de
    // l'administration était le dernier endroit à les montrer.
    .filter((t) => !t.isGhost);
}

// ============================================
// Compétitions, vues de l'administration
// ============================================

/** Toutes les compétitions, validées ou non, la plus récente d'abord. */
export async function getAllCompetitions(max = 500): Promise<Competition[]> {
  const q = query(collection(db, "competitions"), firestoreLimit(max));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => toCompetition(d.id, d.data() as FirestoreCompetition))
    // Les bacs à sable de la console live appartiennent à leur créateur et ne
    // sont le travail de personne : ils n'ont rien à faire dans une liste
    // qu'on valide.
    .filter((c) => !c.isSandbox)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/**
 * Ouvrir ou fermer la porte du public.
 *
 * Ne touche à rien d'autre : l'organisateur garde sa compétition, ses équipes
 * et son calendrier. Seul ce qui est montré au public change.
 */
export async function setCompetitionValidated(cid: string, validated: boolean): Promise<void> {
  await updateDoc(doc(db, "competitions", cid), {
    is_validated: validated,
    updated_at: serverTimestamp(),
  });
}

// ============================================
// Le détail d'une équipe, tel que l'administration doit le voir
// ============================================

export interface AdminTeamDetail {
  team: Team;
  manager: UserProfile | null;
  members: UserProfile[];
  ghostPlayers: GhostPlayer[];
  matches: Match[];
}

/**
 * Tout ce qu'il y a à savoir sur une équipe, en une lecture.
 *
 * L'administration ne voyait qu'une ligne de tableau : nom, ville, niveau,
 * nombre de membres. Impossible de répondre à « qui est dans cette équipe »,
 * « qui la dirige », « qu'a-t-elle joué » sans ouvrir la console Firebase.
 */
export async function getAdminTeamDetail(teamId: string): Promise<AdminTeamDetail | null> {
  const snap = await getDoc(doc(db, "teams", teamId));
  if (!snap.exists()) return null;
  const team = toTeam(snap.id, snap.data() as FirestoreTeam);

  const [membres, fantomes, domicile, exterieur, manager] = await Promise.all([
    team.memberIds.length > 0 ? getUsersByIds(team.memberIds) : Promise.resolve([]),
    getDocs(collection(db, "teams", teamId, "ghost_players")),
    getDocs(query(collection(db, "matches"), where("home_team_id", "==", teamId))),
    getDocs(query(collection(db, "matches"), where("away_team_id", "==", teamId))),
    getDoc(doc(db, "users", team.managerId)),
  ]);

  const matches = [...domicile.docs, ...exterieur.docs]
    .map((d) => toMatch(d.id, d.data() as FirestoreMatch))
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  return {
    team,
    manager: manager.exists() ? toUserProfile(manager.id, manager.data() as FirestoreUser) : null,
    members: membres,
    ghostPlayers: fantomes.docs.map((d) => toGhostPlayer(d.id, teamId, d.data() as FirestoreGhostPlayer)),
    matches,
  };
}

// ============================================
// Ce qu'un compte a réellement fait, selon sa casquette
// ============================================

export interface AdminUserActivity {
  /** Joueur */
  matchesPlayed: number;
  goals: number;
  assists: number;
  noteMoyenne: number | null;
  equipesRejointes: Team[];
  /** Manager */
  equipesDirigees: Team[];
  matchsProgrammes: number;
  amicauxHorsPlateforme: number;
  /** Arbitre */
  matchsArbitres: number;
  designationsEnAttente: number;
  /** Organisateur */
  competitions: Competition[];
}

/**
 * L'activité d'un compte, toutes casquettes confondues.
 *
 * Un rôle affiché ne dit pas ce qu'on en fait : la colonne « rôle » d'un
 * tableau annonce « manager » aussi bien pour celui qui dirige trois clubs
 * que pour celui qui n'a jamais rien créé. Les compteurs vivent chacun dans
 * leur collection, il faut aller les chercher.
 */
export async function getAdminUserActivity(uid: string): Promise<AdminUserActivity> {
  const [profil, notes, membreDe, dirigeant, crees, arbitres, comps] = await Promise.all([
    getDoc(doc(db, "users", uid)),
    getDocs(query(collection(db, "player_ratings"), where("player_id", "==", uid))),
    getDocs(query(collection(db, "teams"), where("member_ids", "array-contains", uid))),
    getDocs(query(collection(db, "teams"), where("manager_id", "==", uid))),
    getDocs(query(collection(db, "matches"), where("manager_id", "==", uid))),
    getDocs(query(collection(db, "matches"), where("referee_id", "==", uid))),
    getDocs(query(collection(db, "competitions"), where("organizer_ids", "array-contains", uid))),
  ]);

  const p = profil.exists() ? toUserProfile(profil.id, profil.data() as FirestoreUser) : null;
  const scores = notes.docs.map((d) => (d.data().score as number) ?? 0).filter((n) => n > 0);
  const matchsCrees = crees.docs.map((d) => d.data() as FirestoreMatch);

  return {
    matchesPlayed: p?.matchesPlayed ?? 0,
    goals: p?.goals ?? 0,
    assists: p?.assists ?? 0,
    noteMoyenne: scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null,
    equipesRejointes: membreDe.docs.map((d) => toTeam(d.id, d.data() as FirestoreTeam)).filter((t) => !t.isGhost),
    equipesDirigees: dirigeant.docs.map((d) => toTeam(d.id, d.data() as FirestoreTeam)).filter((t) => !t.isGhost),
    matchsProgrammes: matchsCrees.length,
    // Un amical se reconnaît à l'absence de manager en face.
    amicauxHorsPlateforme: matchsCrees.filter((m) => !m.away_manager_id).length,
    matchsArbitres: arbitres.docs.filter((d) => (d.data() as FirestoreMatch).status === "completed").length,
    designationsEnAttente: arbitres.docs.filter((d) => {
      const m = d.data() as FirestoreMatch;
      return m.referee_status === "pending" || m.referee_status === "invited";
    }).length,
    competitions: comps.docs
      .map((d) => toCompetition(d.id, d.data() as FirestoreCompetition))
      .filter((c) => !c.isSandbox),
  };
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

// ============================================
// Qui modère quelque chose.
//
// La modération ne se lit pas sur le compte : elle vit dans
// `competitions.moderator_ids`. Une requête par ligne du tableau des
// utilisateurs, c'est cinq cents lectures pour une colonne ; une seule
// traversée des compétitions suffit à répondre pour tout le monde.
//
// Les brouillons sont inclus, contrairement à listPublicCompetitions : un
// modérateur nommé sur une compétition pas encore publiée a bel et bien accès
// à la console.
// ============================================

export async function getModeratorIds(): Promise<Set<string>> {
  const snap = await getDocs(collection(db, "competitions"));
  const ids = new Set<string>();
  for (const d of snap.docs) {
    for (const uid of (d.data().moderator_ids as string[] | undefined) ?? []) {
      if (uid) ids.add(uid);
    }
  }
  return ids;
}
