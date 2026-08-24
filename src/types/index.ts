import type { PushPrefs } from "@/lib/push-categories";

// ============================================
// KOPPAFOOT, Core Types
// ============================================

export type UserRole = "player" | "manager" | "referee" | "venue_owner" | "organizer" | "superadmin";

// Role picked in the Évolution onboarding (null/absent = not activated yet;
// everyone starts as a plain spectator account).
/**
 * Ce qu'on EST sur le terrain, un à la fois.
 *
 * Ne pas confondre avec les casquettes (organisateur, propriétaire de
 * terrain) : celles-là sont ce qu'on FAIT en plus, elles se cumulent, et
 * elles vivent dans des drapeaux séparés. Un arbitre peut être organisateur
 * et propriétaire sans cesser d'être arbitre.
 */
export type EvolutionRole = "player" | "manager" | "referee";

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
  // Évolution onboarding, role activated by the user (Espace joueur/manager)
  evolutionRole?: EvolutionRole | null;
  /**
   * Les casquettes, cumulables et indépendantes du rôle Evolution.
   *
   * Elles existent parce que `user_type` ne peut porter qu'une valeur :
   * approuver une candidature d'organisateur ÉCRASAIT le type de compte, et
   * un organisateur qui joue disparaissait donc de tout ce qui filtrait sur
   * les joueurs. Un drapeau à côté, comme `is_superadmin`, ne détruit rien.
   */
  isOrganizer?: boolean;
  isVenueOwner?: boolean;
  // Competitions followed (push notifications on kickoff/goal/final)
  followedCompetitionIds?: string[];
  /** Préférences de notification push, par catégorie. Absent = tout accepté. */
  pushPrefs?: PushPrefs;
  /**
   * Nom public de la structure organisatrice (association, ligue, école,
   * collectif). Saisi à la candidature organisateur, repris à l'approbation,
   * puis estampillé sur chaque compétition créée. Null tant que l'utilisateur
   * n'est pas organisateur.
   */
  organizerName?: string | null;
  // Gallery
  galleryPhotos?: string[];
  // Palmarès / Trophies
  trophies?: { title: string; year: number; description?: string }[];
  // Competition roster lines validated as being this user
  linkedCompPlayers?: LinkedCompPlayer[];
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
  // Évolution onboarding, role activated by the user (Espace joueur/manager)
  evolution_role?: EvolutionRole | null;
  is_organizer?: boolean;
  is_venue_owner?: boolean;
  // Competitions followed (push notifications on kickoff/goal/final)
  followed_competition_ids?: string[];
  /** Nom public de la structure organisatrice, voir UserProfile. */
  organizer_name?: string | null;
  // Gallery
  gallery_photos?: string[];
  // Palmarès
  trophies?: { title: string; year: number; description?: string }[];
  // Validated roster claims, written by the roster-claims API only.
  linked_comp_players?: LinkedCompPlayer[];
  // FCM push tokens
  fcm_tokens?: string[];
  /** Ce que le compte accepte de recevoir en push, par catégorie. Absent =
   *  tout accepté, voir lib/push-categories. */
  push_prefs?: PushPrefs;
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Route protection
export const ROLE_REDIRECTS: Record<UserRole, string> = {
  player: "/",
  manager: "/",
  referee: "/",
  venue_owner: "/",
  organizer: "/organizer",
  superadmin: "/admin",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  player: "Joueur",
  manager: "Manager",
  referee: "Arbitre",
  venue_owner: "Propriétaire de terrain",
  organizer: "Organisateur",
  superadmin: "Super Admin",
};

// ============================================
// Teams
// ============================================

/**
 * Un membre du staff d'une équipe.
 *
 * DEUX CHOSES DISTINCTES DANS UN SEUL OBJET, et il faut les nommer : le
 * `title` est de l'AFFICHAGE — coach, dirigeant, soigneur, ce qu'on présente
 * sur la fiche — tandis que `delegated` est un DROIT. Les confondre, c'est-à-
 * dire faire de « coach » une permission, aurait recréé un second système
 * d'autorisation à côté de celui des compétitions, et deux modèles de droits
 * dans un même produit finissent toujours par se contredire.
 *
 * `name` est recopié à l'ajout pour que la fiche s'affiche sans relire un
 * profil par ligne. Il vieillit, comme toute dénormalisation : c'est le nom
 * du jour où la personne a rejoint le staff.
 */
export interface TeamStaffMember {
  uid: string;
  name: string;
  /** Ce qu'on montre : Adjoint, Coach, Dirigeant… */
  title: string;
  /** Reçoit les droits du manager sur l'équipe. Miroir de
   *  `staff_manager_ids`, qui est la seule forme que les règles Firestore
   *  savent interroger — une règle ne peut pas filtrer un tableau d'objets. */
  delegated: boolean;
}

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
  squad_numbers?: { [playerId: string]: string };
  training_schedule?: TrainingScheduleSlot[];
  /** Le staff, tel qu'on l'affiche. */
  staff?: TeamStaffMember[];
  /** Ceux du staff qui ont les droits du manager. Redondant avec
   *  `staff[].delegated` et c'est voulu : les règles ne savent lire qu'un
   *  tableau plat de chaînes. Les deux s'écrivent ensemble, voir
   *  setTeamStaff. */
  staff_manager_ids?: string[];
  // Équipe adverse qui n'est pas sur la plateforme, créée par un manager pour
  // pouvoir planifier un amical contre elle. C'est un vrai doc `teams` (sinon
  // le rollup de fin de match échouerait sur un doc absent) mais elle n'a ni
  // compte ni membres : son effectif vit dans la sous-collection ghost_players,
  // et son manager_id est celui qui l'a créée.
  is_ghost?: boolean;
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
  squadNumbers?: { [playerId: string]: string };
  trainingSchedule?: TrainingScheduleSlot[];
  staff?: TeamStaffMember[];
  staffManagerIds?: string[];
  isGhost?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Matches
// ============================================

export type MatchStatus = "challenge" | "pending" | "draft" | "upcoming" | "live" | "completed" | "cancelled" | "delayed";
export type MatchResult = "win" | "loss" | "draw" | null;

/**
 * Fate of a goal once the video assistant gets involved. A goal carries no
 * status at all until someone reviews it, only a reviewed goal is flagged,
 * and only a "cancelled" one leaves the scoreboard.
 */
export type GoalVarStatus = "checking" | "confirmed" | "cancelled";

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
  auto_accept_players?: boolean;
  // "unverified" = match contre un adversaire hors plateforme : un seul
  // manager l'a vécu, donc aucune contre-signature possible. État terminal,
  // il ne deviendra jamais "validated".
  validation_status?: "pending" | "contested" | "validated" | "unverified";
  completed_at?: string | null;
  live_state?: {
    current_period: number; // 0: pre, 1: 1st, 2: halftime, 3: 2nd, 4: finished
    timer_start_at: string | null;
    timer_offset: number;
    is_timer_running: boolean;
    events: {
      id: string;
      type: "goal" | "yellow_card" | "red_card" | "substitution" | "period_start" | "period_end";
      period: number;
      minute: number;
      team_id: string;
      player_id?: string;
      player_name?: string;
      detail?: string;
      /**
       * Goals only. The player who laid the goal on, when the console was
       * told, a goal recorded before the assist existed simply has none.
       */
      assist_player_id?: string | null;
      assist_player_name?: string | null;
      contested_by_manager_id?: string | null;
      contestation_reason?: string | null;
      /**
       * Goals only. Absent = a goal nobody reviewed, which is most of them.
       *  - "checking"  : under VAR review, still on the scoreboard
       *  - "confirmed" : reviewed and upheld
       *  - "cancelled" : disallowed, off the scoreboard, kept in the timeline
       */
      var_status?: GoalVarStatus | null;
      created_at: string;
    }[];
  } | null;
  modification_request?: {
    date: string;
    time: string;
    venue_name: string;
    venue_city: string;
    reason: string;
    requested_by: string;
  } | null;
  home_lineup_ready?: boolean;
  away_lineup_ready?: boolean;
  // Feuille de match du camp sans comptes (adversaire hors plateforme). Les
  // joueurs réels passent par les participations ; un fantôme n'en a pas, donc
  // sa compo est dénormalisée sur le match, comme côté compétition.
  ghost_lineup?: FirestoreLineupEntry[];
  post_match_feedback?: {
    [manager_id: string]: {
      validation: "validated" | "contested";
      comments?: string;
      referee_rating?: number;
      created_at: string;
    };
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
  effectiveStatus: MatchStatus;
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
  autoAcceptPlayers?: boolean;
  validationStatus?: "pending" | "contested" | "validated" | "unverified";
  completedAt?: string | null;
  liveState?: {
    currentPeriod: number;
    timerStartAt: string | null;
    timerOffset: number;
    isTimerRunning: boolean;
    events: {
      id: string;
      type: "goal" | "yellow_card" | "red_card" | "substitution" | "period_start" | "period_end";
      period: number;
      minute: number;
      teamId: string;
      playerId?: string;
      playerName?: string;
      detail?: string;
      /** See `FirestoreMatch.live_state.events[].assist_player_id`. */
      assistPlayerId?: string | null;
      assistPlayerName?: string | null;
      contestedByManagerId?: string | null;
      contestationReason?: string | null;
      /** See `FirestoreMatch.live_state.events[].var_status`. */
      varStatus?: GoalVarStatus | null;
      createdAt: string;
    }[];
  } | null;
  modificationRequest?: MatchModificationRequest | null;
  homeLineupReady?: boolean;
  awayLineupReady?: boolean;
  ghostLineup?: LineupEntry[];
  postMatchFeedback?: {
    [managerId: string]: {
      validation: "validated" | "contested";
      comments?: string;
      refereeRating?: number;
      createdAt: string;
    };
  } | null;
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
  squad_number?: string;
  match_role?: "starter" | "substitute" | null;
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
  squadNumber?: string;
  matchRole?: "starter" | "substitute" | null;
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
  /** Dénormalisés à l'envoi, le mercato affiche l'invitation sans relire
   *  ni le profil du joueur ni le doc de l'équipe. Absents sur les
   *  invitations créées avant le champ : la page les réhydrate. */
  receiver_photo?: string | null;
  team_logo?: string | null;
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
  /** See FirestoreInvitation, null when the doc predates the field. */
  receiverPhoto: string | null;
  teamLogo: string | null;
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

export type PostType =
  | "text"
  | "match_result"
  | "team_announcement"
  | "highlight"
  /** Written by the official account when a competition reaches a milestone. */
  | "competition_announcement";

/**
 * The official KoppaFoot account. Its posts are written by the platform, not
 * by a person: they carry no profile to visit and no role to display, which
 * is why the Tribune gives them a verified badge instead of the grey role
 * pill everyone else gets.
 */
export const SYSTEM_AUTHOR_ID = "system";
export const SYSTEM_AUTHOR_NAME = "KoppaFoot";

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
  /** Official posts a superadmin has stuck to the top of the Tribune. */
  pinned?: boolean;
  /** Where the post points, a competition page, a match. Official posts only. */
  link?: string | null;
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
  pinned: boolean;
  link: string | null;
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
  /** Photo de profil recopiée à l'ajout, voir FirestoreInvitation. */
  player_photo?: string | null;
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
  playerPhoto: string | null;
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
  /** Photo joueur / logo équipe recopiés à la candidature, voir
   *  FirestoreInvitation pour le pourquoi et la réhydratation. */
  player_photo?: string | null;
  team_logo?: string | null;
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
  playerPhoto: string | null;
  teamLogo: string | null;
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
// ============================================
// Bookings
// ============================================

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export interface FirestoreBooking {
  venue_id: string;
  venue_name: string;
  owner_id: string;
  user_id: string;
  user_name: string;
  date: string;
  time: string;
  duration: number; // in hours
  total_price: number;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  venueId: string;
  venueName: string;
  ownerId: string;
  userId: string;
  userName: string;
  date: string;
  time: string;
  duration: number;
  totalPrice: number;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Ghost Players
// ============================================

export interface FirestoreGhostPlayer {
  first_name: string;
  last_name: string;
  position: "goalkeeper" | "defender" | "midfielder" | "forward";
  squad_number?: string;
  matches_played: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  created_at: string;
  updated_at: string;
}

export interface GhostPlayer {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  position: "goalkeeper" | "defender" | "midfielder" | "forward";
  squadNumber?: string;
  matchesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Training Schedule
// ============================================

export interface TrainingScheduleSlot {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=dimanche, 1=lundi...6=samedi
  time: string;      // "19:00"
  location: string;
  label?: string;    // "Tactique", "Physique", etc.
}

// ============================================
// Notifications
// ============================================

export type NotificationType =
  | "invitation"
  | "join_request"
  | "match_challenge"
  | "participation_request"
  | "admin_message"
  /** Vie d'une équipe dont on est membre : arrivée, départ, inscription
   *  en compétition. Envoyée à l'effectif. */
  | "team_activity"
  /** Même événement, mais reçu parce qu'on suit l'équipe ou le joueur,
   *  pas parce qu'on en fait partie. */
  | "follow_activity";

export interface FirestoreNotification {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  read: boolean;
  created_at: any;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

// ============================================
// Competitions
// ============================================

export type CompetitionStatus = "draft" | "registration" | "group_stage" | "knockout" | "completed";

/**
 * Shape of a competition. Drives which stages exist, which generators the
 * organizer is offered, and which public tabs (classement / tableau) render.
 *  - cup             : direct elimination only, no group stage
 *  - league          : one single group, table only, no final stage
 *  - groups_knockout : group stage then a bracket (the historical format)
 *  - league_playoffs : one single group then a bracket on the top N
 */
export type CompetitionType = "cup" | "league" | "groups_knockout" | "league_playoffs";
export type CompMatchStage = "group" | "knockout";
export type CompMatchRound = "round_of_16" | "quarter" | "semi" | "final" | "third_place";
export type CompMatchStatus = "scheduled" | "live" | "completed" | "cancelled";

export interface CompetitionFormat {
  group_count: number;
  teams_per_group: number;
  qualifiers_per_group: number;
  has_third_place: boolean;
  points: { win: number; draw: number; loss: number };
  /** Aller-retour: every group pairing is played twice, home and away. */
  double_round?: boolean;
  /**
   * Jeu à N contre N, joueurs de champ par équipe. Plafonne les titulaires
   * sur la feuille de match. Absent sur les compétitions créées avant le
   * champ → 11 (voir teamSize() dans lib/competition-format).
   */
  team_size?: number;
  /**
   * Durée d'une mi-temps, en minutes. La console cale l'horloge dessus : pause
   * à `half_duration`, coup de sifflet final à 2×. Absent → 45.
   */
  half_duration?: number;
  /**
   * Size of the bracket, in teams. Only read for the types whose final stage
   * is not fed by group qualifiers:
   *  - cup             : how many teams enter round 1
   *  - league_playoffs : how many of the table's top rows qualify
   * Rounded down to the nearest power of two at generation time.
   */
  knockout_teams?: number;
}

export interface FirestoreCompetition {
  name: string;
  slug: string;
  description?: string;
  logo_url: string | null;
  banner_url: string | null;
  organizer_ids: string[];
  moderator_ids: string[];
  created_by: string;
  status: CompetitionStatus;
  /** Absent on competitions created before types existed → groups_knockout. */
  competition_type?: CompetitionType;
  /**
   * Training sandbox: a throwaway competition owned by one user so they can
   * practise the live console on a fake match. Hidden from every public and
   * organizer listing; only /live-ops surfaces it.
   */
  is_sandbox?: boolean;
  /**
   * Nom de la structure organisatrice, recopié depuis le profil du créateur au
   * moment de la création. Dénormalisé exprès : les pages publiques
   * (/competitions, /c/**) sont sans connexion, et la collection `users` n'est
   * plus lisible sans compte, on ne peut donc pas résoudre le nom par l'uid.
   * Renommer sa structure ne réécrit pas les compétitions déjà créées.
   */
  organizer_name?: string | null;
  format: CompetitionFormat;
  start_date: string | null;
  end_date: string | null;
  venue_city: string | null;
  /**
   * Entry file, what a manager agrees to and owes to enter. Every field is
   * optional and nothing is on by default: a neighbourhood tournament asks
   * for none of this, a real competition asks for all of it. The organizer
   * decides, not the platform.
   */
  rules_text?: string | null;
  rules_url?: string | null;
  /** When true, the manager cannot submit without ticking the box. */
  require_rules_acceptance?: boolean;
  /** null or 0 → free entry, and the fee block never renders. */
  entry_fee?: number | null;
  entry_fee_currency?: string;
  created_at: string;
  updated_at: string;
}

export interface Competition {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  organizerIds: string[];
  moderatorIds: string[];
  createdBy: string;
  status: CompetitionStatus;
  competitionType: CompetitionType;
  /** Training sandbox, see FirestoreCompetition.is_sandbox. */
  isSandbox: boolean;
  /** Nom de la structure organisatrice, see FirestoreCompetition. */
  organizerName: string | null;
  format: CompetitionFormat;
  startDate: string | null;
  endDate: string | null;
  venueCity: string | null;
  /** Entry file, see FirestoreCompetition. */
  rulesText: string | null;
  rulesUrl: string | null;
  requireRulesAcceptance: boolean;
  entryFee: number | null;
  entryFeeCurrency: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompPlayer {
  id: string;
  name: string;
  number: string;       // dossard
  position?: string;
  /**
   * KoppaFoot account this roster line belongs to, once a claim has been
   * validated by the organizer or the team's manager. Null/absent means the
   * line is just a name typed by the organizer.
   */
  user_id?: string | null;
}

// ============================================
// Roster claims, a player says "this line is me"; the organizer or the
// team's manager validates. The `roster_claims` collection is admin-SDK only
// (clients go through /api/competitions/roster-claims), so it needs no rules.
// ============================================

export type RosterClaimStatus = "pending" | "accepted" | "rejected";

export interface RosterClaim {
  id: string;
  competitionId: string;
  competitionName: string;
  teamId: string;
  teamName: string;
  playerId: string;
  playerName: string;
  userId: string;
  userName: string;
  status: RosterClaimStatus;
  createdAt: string | null;
}

/** One validated link, denormalized on the user so /stats reads in one hop. */
export interface LinkedCompPlayer {
  competition_id: string;
  competition_name: string;
  competition_slug: string;
  team_id: string;
  team_name: string;
  player_id: string;
  player_name: string;
}

export interface FirestoreLineupEntry {
  player_id: string;
  name: string;
  number: string;
  role: "starter" | "substitute";
}

export interface LineupEntry {
  playerId: string;
  name: string;
  number: string;
  role: "starter" | "substitute";
}

export interface FirestoreCompTeam {
  name: string;
  short_name: string;
  logo_url: string | null;
  color: string;
  group: string | null;
  players?: CompPlayer[];
  claimed_by_manager_id?: string | null;
  claimed_by_team_id?: string | null;
  /**
   * A team that has already played is never removed, its results would
   * vanish from tables its opponents earned. It is disqualified instead:
   * played matches stand, every remaining one is forfeited to the opponent.
   */
  disqualified?: boolean;
  disqualified_at?: string | null;
  disqualified_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompTeam {
  id: string;
  competitionId: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  color: string;
  group: string | null;
  players: CompPlayer[];
  claimedByManagerId: string | null;
  /** The manager's club (`teams` collection) this competition entry stands for. */
  claimedByTeamId: string | null;
  /** Disqualification, see FirestoreCompTeam. */
  disqualified: boolean;
  disqualifiedAt: string | null;
  disqualifiedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// Team-manager invitation, as returned by the API routes (the Firestore
// `team_manager_invites` collection is admin-SDK only, no client rules).
export type TeamManagerInviteStatus = "pending" | "accepted" | "revoked";

export interface TeamManagerInvite {
  id: string;
  competitionId: string;
  teamId: string;
  teamName: string;
  competitionName: string;
  email: string;
  invitedByName: string;
  status: TeamManagerInviteStatus;
  createdAt: string | null;
}

// ============================================
// Competition registrations, a manager applies to enter their club in a
// competition open for entries. The mirror of team_manager_invites, which
// runs the other way (an organizer hands an existing team to a manager).
// The `competition_registrations` collection is admin-SDK only.
// ============================================

/**
 * `removed` is not a decision the organizer takes on the entry itself: it is
 * what an accepted entry becomes when its competition team is deleted. Kept
 * distinct from `rejected` so the history stays honest, the club was in,
 * then taken out, and so the manager is free to enter again.
 */
export type RegistrationStatus = "pending" | "accepted" | "rejected" | "removed";

/** Entry fees are tracked by hand, the platform takes no money. */
export type RegistrationFeeStatus = "unpaid" | "paid";

export interface CompetitionRegistration {
  id: string;
  competitionId: string;
  competitionName: string;
  competitionSlug: string;
  clubId: string;
  clubName: string;
  clubCity: string;
  clubLogo: string | null;
  managerId: string;
  managerName: string;
  message: string;
  status: RegistrationStatus;
  /** When the manager ticked the règlement box. Null = never accepted. */
  rulesAcceptedAt: string | null;
  feeStatus: RegistrationFeeStatus;
  /**
   * Snapshot of the fee as it stood when the club entered. Kept on the
   * registration so raising the fee later does not rewrite what was owed.
   */
  feeAmount: number | null;
  feeCurrency: string;
  createdAt: string | null;
}

/**
 * Where a first-round bracket slot takes its team from, expressed in terms of
 * the group stage rather than a team id, so an organizer can draw the whole
 * bracket before a single group match is played, and the slots fill themselves
 * once the tables are final.
 *
 * Later rounds need no source: they are fed by `feeds_into_match_id` from the
 * round before, which already says "the winner of that match".
 *
 *  - `group_rank` : a finishing position in one named group ("1er poule A").
 *  - `best_rank`  : the repêchage, the `index`-th best team across every group
 *    among those that finished `rank`-th ("2e meilleur 3e"). Needed whenever the
 *    group count does not divide the bracket, which is exactly the case an
 *    automatic seed cannot resolve on its own.
 */
export type BracketSlotSource =
  | { kind: "group_rank"; group: string; rank: number }
  | { kind: "best_rank"; rank: number; index: number };

export interface FirestoreCompMatch {
  competition_id: string;
  stage: CompMatchStage;
  group: string | null;
  round: CompMatchRound | null;
  bracket_slot: number | null;
  /** Provenance of each slot, first knockout round only. See BracketSlotSource. */
  home_source?: BracketSlotSource | null;
  away_source?: BracketSlotSource | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_team_name: string;
  away_team_name: string;
  home_team_logo: string | null;
  away_team_logo: string | null;
  banner_url?: string | null;
  date: string | null;
  time: string | null;
  venue_name: string | null;
  venue_city: string | null;
  status: CompMatchStatus;
  score_home: number | null;
  score_away: number | null;
  penalty_home: number | null;
  penalty_away: number | null;
  winner_team_id: string | null;
  /**
   * Set when the score was awarded rather than played, the id of the side
   * that forfeited. Keeps a 3-0 walkover distinguishable from a real 3-0.
   */
  forfeit_by_team_id?: string | null;
  feeds_into_match_id: string | null;
  feeds_into_slot: "home" | "away" | null;
  home_lineup?: FirestoreLineupEntry[];
  away_lineup?: FirestoreLineupEntry[];
  home_lineup_ready?: boolean;
  away_lineup_ready?: boolean;
  home_on_pitch?: string[];
  away_on_pitch?: string[];
  live_state: FirestoreMatch["live_state"];
  created_at: string;
  updated_at: string;
}

export interface CompMatch {
  id: string;
  competitionId: string;
  stage: CompMatchStage;
  group: string | null;
  round: CompMatchRound | null;
  bracketSlot: number | null;
  /** Provenance of each slot, first knockout round only. See BracketSlotSource. */
  homeSource: BracketSlotSource | null;
  awaySource: BracketSlotSource | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  bannerUrl: string | null;
  date: string | null;
  time: string | null;
  venueName: string | null;
  venueCity: string | null;
  status: CompMatchStatus;
  scoreHome: number | null;
  scoreAway: number | null;
  penaltyHome: number | null;
  penaltyAway: number | null;
  winnerTeamId: string | null;
  /** Id of the side that forfeited, when the score was awarded not played. */
  forfeitByTeamId: string | null;
  feedsIntoMatchId: string | null;
  feedsIntoSlot: "home" | "away" | null;
  homeLineup: LineupEntry[];
  awayLineup: LineupEntry[];
  homeLineupReady: boolean;
  awayLineupReady: boolean;
  homeOnPitch: string[];
  awayOnPitch: string[];
  liveState: Match["liveState"];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Staff access codes
//
// An organizer hands a volunteer a short code instead of an e-mail invite:
// the volunteer may not have a KoppaFoot account, and often only covers one
// poule or one match. Redeeming a code writes a GRANT under the competition,
// and that grant is what Firestore rules check on every live write, so the
// access is scoped, expirable and revocable, unlike `moderator_ids` which is
// all-or-nothing for the whole competition.
// ============================================

/** What a code (and the grant it produces) unlocks. */
export type StaffScope =
  | { kind: "competition" }
  | { kind: "stage"; stage: CompMatchStage }
  | { kind: "group"; group: string }
  | { kind: "match"; matchId: string; matchLabel: string };

export type FirestoreStaffScope =
  | { kind: "competition" }
  | { kind: "stage"; stage: CompMatchStage }
  | { kind: "group"; group: string }
  | { kind: "match"; match_id: string; match_label: string };

/**
 * A code, at `staff_codes/{CODE}`. Deliberately NOT client-readable: a code is
 * a secret, so it only ever travels through the API to an organizer of its
 * competition.
 */
export interface FirestoreStaffCode {
  competition_id: string;
  competition_name: string;
  /** Who the organizer wrote it for, "Kodjo (poule A)". */
  label: string;
  scope: FirestoreStaffScope;
  created_by: string;
  created_at: string;
  /** ISO date-time, or null for "until revoked". */
  expires_at: string | null;
  revoked: boolean;
  used_count: number;
  last_used_at: string | null;
}

export interface StaffCode extends Omit<
  FirestoreStaffCode,
  "competition_id" | "competition_name" | "created_by" | "created_at" | "expires_at" | "used_count" | "last_used_at" | "scope"
> {
  /** The code itself, the document id. */
  code: string;
  competitionId: string;
  competitionName: string;
  scope: StaffScope;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  usedCount: number;
  lastUsedAt: string | null;
}

/**
 * A redeemed code, at `competitions/{cid}/staff_grants/{uid}`. Written by the
 * API only (rules deny every client write) and read by the holder, by the
 * organizer, and by the rules that guard live writes.
 */
export interface FirestoreStaffGrant {
  uid: string;
  /** Denormalized so the staff list needs no user lookup. */
  name: string;
  code: string;
  label: string;
  scope: FirestoreStaffScope;
  granted_at: string;
  /**
   * Epoch milliseconds, not an ISO string: security rules cannot parse a
   * string into a timestamp, but they can compare
   * `request.time.toMillis() < expires_at_ms`.
   */
  expires_at_ms: number | null;
  revoked: boolean;
}

export interface StaffGrant {
  uid: string;
  name: string;
  code: string;
  label: string;
  scope: StaffScope;
  grantedAt: string;
  expiresAt: string | null;
  revoked: boolean;
}
