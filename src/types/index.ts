// ============================================
// KOPPAFOOT — Core Types
// ============================================

export type UserRole = "player" | "manager" | "referee" | "venue_owner" | "superadmin";

export type AuthProvider = "email" | "phone" | "google";

export interface UserProfile {
  uid: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  userType: UserRole;
  locationCity: string;
  bio: string | null;
  profilePictureUrl: string | null;
  coverPhotoUrl: string | null;
  companyName: string | null;
  isActive: boolean;
  emailVerified: boolean;
  authProviders: AuthProvider[];
  createdAt: string;
  updatedAt: string;
  // Player-specific (may be absent)
  position?: string;
  skillLevel?: string;
  // Manager-specific
  teamName?: string;
  // Referee-specific
  licenseNumber?: string;
  licenseLevel?: string;
  experienceYears?: number;
  // Player stats (may be absent)
  matchesPlayed?: number;
  goals?: number;
  assists?: number;
  // Physical info
  strongFoot?: "left" | "right" | "both";
  height?: number; // cm
  weight?: number; // kg
  dateOfBirth?: string; // ISO date
  // Social
  followersCount?: number;
  followingCount?: number;
  // Gallery
  galleryPhotos?: string[];
  // Palmarès / Trophies
  trophies?: { title: string; year: number; description?: string }[];
}

// Signup form data before Firestore write
export interface SignupData {
  email?: string;
  phone?: string;
  password?: string;
  firstName: string;
  lastName: string;
  userType: UserRole;
  locationCity: string;
  bio?: string;
  // Player-specific
  position?: "goalkeeper" | "defender" | "midfielder" | "forward" | "any";
  skillLevel?: "beginner" | "amateur" | "intermediate" | "advanced";
  // Manager-specific
  teamName?: string;
  // Referee-specific
  licenseNumber?: string;
  licenseLevel?: "trainee" | "regional" | "national" | "international";
  experienceYears?: number;
}

export interface VenueOwnerSignupData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  venueName: string;
  venueAddress: string;
  venueCity: string;
  fieldType: "outdoor" | "indoor" | "hybrid";
  fieldSurface: "natural_grass" | "synthetic" | "hybrid" | "indoor";
  fieldSize: "5v5" | "7v7" | "11v11" | "futsal";
  acceptTerms: boolean;
}

// Firestore document shape for /users/{uid}
export interface FirestoreUser {
  email: string | null;
  phone: string | null;
  first_name: string;
  last_name: string;
  user_type: UserRole;
  location_city: string;
  bio?: string;
  profile_picture_url: string | null;
  cover_photo_url: string | null;
  company_name?: string;
  is_active: boolean;
  auth_providers: AuthProvider[];
  // Player fields
  position?: string;
  skill_level?: string;
  // Manager fields
  team_name?: string;
  // Referee fields
  license_number?: string;
  license_level?: string;
  experience_years?: number;
  // Physical info
  strong_foot?: "left" | "right" | "both";
  height?: number;
  weight?: number;
  date_of_birth?: string;
  // Social
  followers_count?: number;
  following_count?: number;
  // Gallery
  gallery_photos?: string[];
  // Palmarès
  trophies?: { title: string; year: number; description?: string }[];
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Route protection
export const ROLE_REDIRECTS: Record<UserRole, string> = {
  player: "/dashboard",
  manager: "/dashboard",
  referee: "/dashboard",
  venue_owner: "/venue-owner",
  superadmin: "/admin",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  player: "Joueur",
  manager: "Manager",
  referee: "Arbitre",
  venue_owner: "Propriétaire de terrain",
  superadmin: "Super Admin",
};

// ============================================
// Teams
// ============================================

export interface Achievement {
  id: string;
  title: string;
  date: string;
  description?: string;
  icon: "trophy" | "medal" | "star" | "shield";
}

export interface FirestoreTeam {
  name: string;
  manager_id: string;
  city: string;
  description: string;
  level: "beginner" | "amateur" | "intermediate" | "advanced";
  looking_for: string[];
  member_ids: string[];
  max_members: number;
  color: string;
  wins: number;
  losses: number;
  draws: number;
  matches_played: number;
  is_recruiting: boolean;
  logo_url?: string;
  banner_url?: string;
  slogan?: string;
  lineup_ids?: string[];
  gallery_urls?: string[];
  achievements?: Achievement[];
  followers_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  managerId: string;
  city: string;
  description: string;
  level: "beginner" | "amateur" | "intermediate" | "advanced";
  lookingFor: string[];
  memberIds: string[];
  maxMembers: number;
  color: string;
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  isRecruiting: boolean;
  logoUrl?: string;
  bannerUrl?: string;
  slogan?: string;
  lineupIds?: string[];
  galleryUrls?: string[];
  achievements?: Achievement[];
  followersCount?: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Matches
// ============================================

export type MatchStatus = "challenge" | "pending" | "draft" | "upcoming" | "completed" | "cancelled";
export type MatchResult = "win" | "loss" | "draw" | null;

export interface MatchModificationRequest {
  date: string;
  time: string;
  venueName: string;
  venueCity: string;
  reason: string;
  requestedBy: string;
}

export interface FirestoreMatch {
  home_team_id: string;
  away_team_id: string;
  home_team_name: string;
  away_team_name: string;
  manager_id: string;
  date: string;
  time: string;
  venue_name: string;
  venue_city: string;
  status: MatchStatus;
  result: MatchResult;
  score_home: number | null;
  score_away: number | null;
  referee_id: string | null;
  referee_name: string | null;
  referee_status: "confirmed" | "pending" | "invited" | "none";
  local_referee_name?: string | null;
  format: "5v5" | "7v7" | "11v11";
  is_home: boolean;
  players_confirmed: number;
  players_total: number;
  away_manager_id: string;
  confirmed_home: number;
  confirmed_away: number;
  modification_request?: {
    date: string;
    time: string;
    venue_name: string;
    venue_city: string;
    reason: string;
    requested_by: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  managerId: string;
  date: string;
  time: string;
  venueName: string;
  venueCity: string;
  status: MatchStatus;
  result: MatchResult;
  scoreHome: number | null;
  scoreAway: number | null;
  refereeId: string | null;
  refereeName: string | null;
  refereeStatus: "confirmed" | "pending" | "invited" | "none";
  localRefereeName?: string | null;
  format: "5v5" | "7v7" | "11v11";
  isHome: boolean;
  playersConfirmed: number;
  playersTotal: number;
  awayManagerId: string;
  confirmedHome: number;
  confirmedAway: number;
  modificationRequest?: MatchModificationRequest | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Participations (match subcollection)
// ============================================

export type ParticipationStatus = "pending" | "confirmed" | "declined" | "cancelled";

export interface FirestoreParticipation {
  player_id: string;
  player_name: string;
  team_id: string;
  match_id: string;
  match_label: string;
  match_date: string;
  match_time: string;
  venue_name: string;
  status: ParticipationStatus;
  goals: number;
  assists: number;
  match_format: string;
  is_home: boolean;
  created_at: string;
  updated_at: string;
}

export interface Participation {
  id: string;
  playerId: string;
  playerName: string;
  teamId: string;
  matchId: string;
  matchLabel: string;
  matchDate: string;
  matchTime: string;
  venueName: string;
  status: ParticipationStatus;
  goals: number;
  assists: number;
  matchFormat: string;
  isHome: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Invitations (team recruitment)
// ============================================

export type InvitationStatus = "pending" | "accepted" | "declined";

export interface FirestoreInvitation {
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  receiver_name: string;
  receiver_city: string;
  receiver_position: string;
  receiver_level: string;
  team_id: string;
  team_name: string;
  message: string;
  status: InvitationStatus;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  receiverCity: string;
  receiverPosition: string;
  receiverLevel: string;
  teamId: string;
  teamName: string;
  message: string;
  status: InvitationStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Venues
// ============================================

export interface FirestoreVenue {
  name: string;
  address: string;
  city: string;
  owner_id: string;
  field_type: "outdoor" | "indoor" | "hybrid";
  field_surface: "natural_grass" | "synthetic" | "hybrid" | "indoor";
  field_size: "5v5" | "7v7" | "11v11" | "futsal";
  rating: number;
  review_count: number;
  price_per_hour: number;
  amenities: string[];
  available: boolean;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  ownerId: string;
  fieldType: "outdoor" | "indoor" | "hybrid";
  fieldSurface: "natural_grass" | "synthetic" | "hybrid" | "indoor";
  fieldSize: "5v5" | "7v7" | "11v11" | "futsal";
  rating: number;
  reviewCount: number;
  pricePerHour: number;
  amenities: string[];
  available: boolean;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Feed / Posts
// ============================================

export type PostType = "text" | "match_result" | "team_announcement" | "highlight";

export interface FirestorePost {
  author_id: string;
  author_name: string;
  author_role: string;
  author_avatar: string;
  type: PostType;
  content: string;
  metadata: {
    home_team?: string;
    away_team?: string;
    score_home?: number;
    score_away?: number;
    team_name?: string;
    repost_of?: { post_id: string; author_name: string; content: string };
  } | null;
  likes: string[];
  comment_count: number;
  media_urls?: string[];
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorAvatar: string;
  type: PostType;
  content: string;
  metadata: {
    homeTeam?: string;
    awayTeam?: string;
    scoreHome?: number;
    scoreAway?: number;
    teamName?: string;
    repostOf?: { postId: string; authorName: string; content: string };
  } | null;
  likes: string[];
  commentCount: number;
  isLiked: boolean;
  mediaUrls?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreComment {
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

// ============================================
// Shortlist (manager mercato)
// ============================================

export interface FirestoreShortlistEntry {
  manager_id: string;
  player_id: string;
  player_name: string;
  player_city: string;
  player_position: string;
  player_level: string;
  player_bio: string;
  created_at: string;
}

export interface ShortlistEntry {
  id: string;
  managerId: string;
  playerId: string;
  playerName: string;
  playerCity: string;
  playerPosition: string;
  playerLevel: string;
  playerBio: string;
  createdAt: string;
}

// ============================================
// Join Requests (player → team)
// ============================================

export type JoinRequestStatus = "pending" | "accepted" | "rejected";

export interface FirestoreJoinRequest {
  player_id: string;
  player_name: string;
  player_city: string;
  player_position: string;
  player_level: string;
  team_id: string;
  team_name: string;
  manager_id: string;
  message: string;
  status: JoinRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface JoinRequest {
  id: string;
  playerId: string;
  playerName: string;
  playerCity: string;
  playerPosition: string;
  playerLevel: string;
  teamId: string;
  teamName: string;
  managerId: string;
  message: string;
  status: JoinRequestStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Follows
// ============================================

export interface FirestoreFollow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

// ============================================
// Trainings
// ============================================

export interface TrainingAttendee {
  player_id: string;
  status: "pending" | "confirmed" | "declined";
}

export interface FirestoreTraining {
  team_id: string;
  manager_id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description?: string;
  attendees: TrainingAttendee[];
  created_at: string;
  updated_at: string;
}

export interface Training {
  id: string;
  teamId: string;
  managerId: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description?: string;
  attendees: TrainingAttendee[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Player Ratings
// ============================================

export interface FirestorePlayerRating {
  match_id: string;
  player_id: string;
  team_id: string;
  rated_by: string;
  score: number;
  created_at: string;
}

export interface PlayerRating {
  id: string;
  matchId: string;
  playerId: string;
  teamId: string;
  ratedBy: string;
  score: number;
  createdAt: string;
}
