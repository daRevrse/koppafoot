// v1.0.1 - Fixed exports detection
import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  documentId,
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
  type Transaction,
  type Unsubscribe,
  type QueryConstraint,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import type {
  Team, FirestoreTeam, Achievement,
  Match, FirestoreMatch, MatchStatus,
  Participation, FirestoreParticipation,
  Invitation, FirestoreInvitation,
  Venue, FirestoreVenue,
  Post, FirestorePost,
  Comment, FirestoreComment,
  UserProfile, FirestoreUser,
  ShortlistEntry, FirestoreShortlistEntry,
  JoinRequest, FirestoreJoinRequest,
  Training, FirestoreTraining, TrainingAttendee, TeamStaffMember,
  PlayerRating, FirestorePlayerRating,
  Booking, FirestoreBooking,
  GhostPlayer, FirestoreGhostPlayer, LineupEntry,
  Notification, FirestoreNotification, NotificationType,
} from "@/types";
import { SYSTEM_AUTHOR_ID, SYSTEM_AUTHOR_NAME } from "@/types";
import { normaliserPoste, type Poste } from "@/lib/postes";
import type { TypeEvenement } from "@/lib/evenements";
import type { FirestoreLineupEntry } from "@/types";

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
    goals: d.goals ?? 0,
    assists: d.assists ?? 0,
    matchesPlayed: d.matches_played ?? 0,
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
    staff: d.staff ?? [],
    staffManagerIds: d.staff_manager_ids ?? [],
    isGhost: d.is_ghost ?? false,
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
    moderatorIds: d.moderator_ids ?? [],
    penaltyHome: d.penalty_home ?? null,
    penaltyAway: d.penalty_away ?? null,
    recordedAt: d.recorded_at ?? null,
    recordedScorers: (d.recorded_scorers ?? []).map((b) => ({
      playerId: b.player_id, sansCompte: b.sansCompte,
      nom: b.nom, buts: b.buts, passes: b.passes,
    })),
    confirmedHome: d.confirmed_home ?? 0,
    confirmedAway: d.confirmed_away ?? 0,
    // La feuille de match, ou son heritage. Voir `FirestoreMatch.home_lineup` :
    // l'ecran de compo d'avant n'ecrivait que le camp hors plateforme, dans
    // `home_ghost_lineup`. Une feuille validee par la console prime.
    homeLineup: (d.home_lineup ?? d.home_ghost_lineup ?? []).map((e) => ({
      playerId: e.player_id, name: e.name, number: e.number, role: e.role,
      userId: e.user_id ?? null,
      position: normaliserPoste(e.position),
    })),
    awayLineup: (d.away_lineup ?? d.away_ghost_lineup ?? []).map((e) => ({
      playerId: e.player_id, name: e.name, number: e.number, role: e.role,
      userId: e.user_id ?? null,
      position: normaliserPoste(e.position),
    })),
    homeLineupReady: d.home_lineup_ready ?? false,
    awayLineupReady: d.away_lineup_ready ?? false,
    homeOnPitch: d.home_on_pitch ?? [],
    awayOnPitch: d.away_on_pitch ?? [],
    // Repli sur `ghost_lineup` pour les matchs créés avant les champs par
    // camp : ce champ-là ne concernait que l'adversaire hors plateforme, donc
    // le camp opposé à celui du créateur (`is_home`).
    homeGhostLineup: (d.home_ghost_lineup
      ?? (!d.away_manager_id && !d.is_home ? d.ghost_lineup ?? [] : [])
    ).map((e) => ({
      playerId: e.player_id, name: e.name, number: e.number, role: e.role,
      userId: e.user_id ?? null,
      position: normaliserPoste(e.position),
    })),
    awayGhostLineup: (d.away_ghost_lineup
      ?? (!d.away_manager_id && d.is_home ? d.ghost_lineup ?? [] : [])
    ).map((e) => ({
      playerId: e.player_id, name: e.name, number: e.number, role: e.role,
      userId: e.user_id ?? null,
      position: normaliserPoste(e.position),
    })),
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
    statsCreditedAt: d.stats_credited_at ?? null,
    statsCreditedBy: d.stats_credited_by ?? null,
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
    // Le role Evolution, ce qu'on est sur le terrain, par opposition a
    // `user_type` qui dit ce qu'est le compte. Il manquait ici alors que
    // AuthContext et la projection publique le portent tous les deux : une
    // fiche lue par un visiteur l'avait donc, la meme fiche relue une fois
    // connecte le perdait, et toute section conditionnee dessus disparaissait
    // sous les yeux du lecteur.
    ...(data.evolution_role !== undefined && { evolutionRole: data.evolution_role }),
    // Les casquettes. `?? undefined` et non `?? false` : un compte d'avant
    // n'a pas de drapeau, et le predicat de `lib/hats` doit pouvoir se
    // rabattre sur `user_type` sans qu'un `false` explicite le contredise.
    ...(data.is_organizer !== undefined && { isOrganizer: data.is_organizer }),
    ...(data.is_venue_owner !== undefined && { isVenueOwner: data.is_venue_owner }),
    followersCount: data.followers_count ?? 0,
    followingCount: data.following_count ?? 0,
    followedCompetitionIds: data.followed_competition_ids ?? [],
    organizerName: data.organizer_name ?? null,
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
/**
 * L'effectif d'une équipe, comptes seulement.
 *
 * LIT `teams.member_ids`, la seule source d'effectif de l'application. Cette
 * fonction interrogeait `users` sur un champ `team_id` que RIEN N'ÉCRIT nulle
 * part — un reliquat. Elle renvoyait donc systématiquement une liste vide, en
 * silence, avec deux conséquences qu'on ne pouvait relier ni l'une ni l'autre à
 * cette ligne :
 *
 *  - un amical ne convoquait personne. `createMatch` reçoit l'effectif à
 *    convoquer et saute l'étape quand la liste est vide : le match partait sans
 *    une seule participation, l'auto-acceptation n'avait rien à accepter, et la
 *    feuille de match n'affichait que les joueurs sans compte.
 *  - la grille « Inviter tes joueurs » de la fiche d'un match était vide, donc
 *    annonçait « tous les membres sont déjà sur la feuille » alors qu'aucun
 *    n'y était.
 *
 * Le parcours du défi, lui, ne passait pas par ici (voir respondToMatchChallenge,
 * qui lit `memberIds`), ce qui explique que le défaut n'ait touché que l'amical.
 */
export async function getTeamMembers(teamId: string): Promise<UserProfile[]> {
  const team = await getTeamById(teamId);
  if (!team) return [];
  return getUsersByIds(team.memberIds);
}


export function toParticipation(id: string, d: FirestoreParticipation): Participation {
  return {
    id, playerId: d.player_id, playerName: d.player_name,
    teamId: d.team_id, matchId: d.match_id, matchLabel: d.match_label,
    matchDate: d.match_date, matchTime: d.match_time, venueName: d.venue_name,
    status: d.status, goals: d.goals ?? 0, assists: d.assists ?? 0,
    matchFormat: d.match_format ?? "", isHome: d.is_home ?? false,
    squadNumber: d.squad_number, matchRole: d.match_role,
    matchPosition: d.match_position ?? null,
    createdAt: formatDate(d.created_at), updatedAt: formatDate(d.updated_at),
  };
}

export function toInvitation(id: string, d: FirestoreInvitation): Invitation {
  return {
    id, senderId: d.sender_id, senderName: d.sender_name,
    receiverId: d.receiver_id, receiverName: d.receiver_name,
    receiverPhoto: d.receiver_photo ?? null, teamLogo: d.team_logo ?? null,
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
    pinned: d.pinned ?? false,
    link: d.link ?? null,
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
    playerName: d.player_name, playerPhoto: d.player_photo ?? null,
    playerCity: d.player_city,
    playerPosition: d.player_position, playerLevel: d.player_level,
    playerBio: d.player_bio ?? "", createdAt: d.created_at,
  };
}

function toJoinRequest(id: string, d: FirestoreJoinRequest): JoinRequest {
  return {
    id, playerId: d.player_id, playerName: d.player_name,
    playerPhoto: d.player_photo ?? null, teamLogo: d.team_logo ?? null,
    playerCity: d.player_city, playerPosition: d.player_position,
    playerLevel: d.player_level, teamId: d.team_id, teamName: d.team_name,
    managerId: d.manager_id, message: d.message, status: d.status,
    createdAt: d.created_at, updatedAt: d.updated_at,
  };
}

// ============================================
// Teams
// ============================================

// Les équipes fantômes portent le manager_id de celui qui les a créées : sans
// filtre elles remonteraient parmi ses vraies équipes (page /teams, sélecteur
// d'équipe du formulaire de match, mercato). Le tri se fait en mémoire pour
// éviter un index composite sur (manager_id, is_ghost, created_at).
async function fetchTeamsOfManager(managerId: string): Promise<Team[]> {
  const q = query(collection(db, "teams"), where("manager_id", "==", managerId), orderBy("created_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toTeam(d.id, d.data() as FirestoreTeam));
}

export async function getTeamsByManager(managerId: string): Promise<Team[]> {
  return (await fetchTeamsOfManager(managerId)).filter((t) => !t.isGhost);
}

/**
 * Les équipes qu'on gère : les siennes, et celles où l'on est staff délégué.
 *
 * DEUX REQUÊTES ET PAS UNE, parce que Firestore ne sait pas faire de OU entre
 * deux champs. Les résultats se recollent ici, dédoublonnés par id — le
 * propriétaire d'une équipe pourrait figurer dans son propre staff.
 *
 * C'est ce prédicat que doivent utiliser les écrans qui demandent « mes
 * équipes » : sans lui, un délégué a les droits sur la fiche mais l'équipe
 * n'apparaît nulle part chez lui, ce qui revient à ne pas la lui avoir
 * déléguée.
 */
export async function getTeamsIManage(uid: string): Promise<Team[]> {
  const deleguees = query(
    collection(db, "teams"),
    where("staff_manager_ids", "array-contains", uid),
  );
  const [miennes, snap] = await Promise.all([
    getTeamsByManager(uid),
    getDocs(deleguees),
  ]);
  const parId = new Map(miennes.map((t) => [t.id, t]));
  snap.docs
    .map((d) => toTeam(d.id, d.data() as FirestoreTeam))
    .filter((t) => !t.isGhost)
    .forEach((t) => parId.set(t.id, t));
  return [...parId.values()];
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

/**
 * LE NvN D'UN MATCH, LU DANS SON FORMAT, plutôt que cherché dans une table.
 *
 * Trois tables figées traduisaient « 5v5 », « 7v7 » et « 11v11 » — effectif,
 * total de joueurs, quota minimum — et retombaient sur onze pour tout le
 * reste. Or le formulaire de création laisse maintenant la main sur le N,
 * comme une compétition (voir TEAM_SIZE_OPTIONS) : un 6v6 comptait donc onze
 * titulaires côté fantôme et vingt-deux joueurs attendus.
 *
 * Le N est déjà écrit dans le format, il n'y a rien à mémoriser.
 */
export function tailleEffectif(format: string | undefined): number {
  const n = Number.parseInt(String(format ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 11;
}

/** Joueurs attendus sur la feuille, les deux camps réunis. */
export function totalJoueurs(format: string | undefined): number {
  return tailleEffectif(format) * 2;
}

/**
 * Confirmés minimum par équipe pour qu'un match se programme.
 *
 * La règle reproduit exactement les trois valeurs de l'ancienne table
 * (5v5 → 3, 7v7 → 5, 11v11 → 8) et sait répondre pour les autres formats :
 * il faut de quoi aligner une équipe, pas l'équipe entière.
 */
export function quotaMinimum(format: string | undefined): number {
  const n = tailleEffectif(format);
  return Math.max(2, n <= 7 ? n - 2 : n - 3);
}

/**
 * L'onze d'un adversaire hors plateforme, SANS RIEN ÉCRIRE EN BASE.
 *
 * Il existait un document `teams` pour chaque adversaire d'amical, avec sa
 * sous-collection de joueurs. C'était un mensonge commode : ces « équipes »
 * n'ont ni compte, ni membre, ni personne derrière, et elles s'accumulaient
 * dans une collection réservée aux vrais clubs — jusqu'à polluer l'annuaire de
 * l'administration, seul endroit qui les montrait encore.
 *
 * Tout ce dont on avait besoin d'elles vit déjà sur le match : le nom dans
 * `away_team_name`, l'onze dans `away_ghost_lineup`. Le document ne servait
 * plus qu'à porter des joueurs que personne ne relisait, la compo étant
 * dénormalisée depuis. On génère donc la feuille en mémoire, et le camp
 * adverse n'a plus d'identifiant d'équipe du tout.
 *
 * Les identifiants de joueurs sont locaux au match, ce qui suffit : ils ne
 * servent qu'à rattacher un but ou un carton à une ligne de cette feuille-là.
 */
export function ghostOpponentLineup(format: string): LineupEntry[] {
  const taille = tailleEffectif(format);
  const lignes: LineupEntry[] = [];
  for (let i = 1; i <= taille; i++) {
    const numero = String(i);
    lignes.push({
      // Suffixe aléatoire : deux matchs du même jour ne doivent pas partager
      // un identifiant de joueur, la timeline les confondrait.
      playerId: `ext-${Math.random().toString(36).slice(2, 8)}-${numero}`,
      name: `Joueur ${numero}`,
      number: numero,
      role: "starter",
    });
  }
  return lignes;
}

export async function updateTeam(teamId: string, data: Partial<FirestoreTeam>): Promise<void> {
  await updateDoc(doc(db, "teams", teamId), { ...data, updated_at: serverTimestamp() });
}

/**
 * Écrit le staff d'une équipe.
 *
 * LES DEUX CHAMPS PARTENT ENSEMBLE, toujours, et c'est la seule raison
 * d'être de cette fonction : `staff` porte l'affichage, `staff_manager_ids`
 * porte les droits, et c'est le second que lisent les règles Firestore. Les
 * écrire séparément, c'est un jour où quelqu'un figure comme adjoint sur la
 * fiche sans pouvoir rien toucher, ou l'inverse — bien pire.
 */
export async function setTeamStaff(teamId: string, staff: TeamStaffMember[]): Promise<void> {
  await updateDoc(doc(db, "teams", teamId), {
    staff,
    staff_manager_ids: staff.filter((m) => m.delegated).map((m) => m.uid),
    updated_at: serverTimestamp(),
  });
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

/**
 * Diffuse un mouvement d'effectif à l'équipe et à ses abonnés.
 *
 * Fire-and-forget par principe : la notification est un bonus, l'adhésion ou
 * le retrait a déjà abouti quand on arrive ici. La liste des destinataires se
 * lit côté serveur (voir /api/notifications/team-activity).
 */
export function notifyTeamActivity(input: {
  teamId: string;
  event: "member_joined" | "member_left" | "competition_entered";
  playerId?: string;
  competitionName?: string;
  link?: string;
}): void {
  void (async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      await fetch("/api/notifications/team-activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });
    } catch {
      // Best-effort only.
    }
  })();
}

export async function removeTeamMember(teamId: string, playerId: string): Promise<void> {
  await updateDoc(doc(db, "teams", teamId), {
    member_ids: arrayRemove(playerId),
    updated_at: serverTimestamp(),
  });
  // Le reste de l'effectif doit apprendre le départ autrement qu'en
  // recomptant la liste des joueurs.
  notifyTeamActivity({ teamId, event: "member_left", playerId });
}

// addTeamMember() lived here: a bare arrayUnion onto any team's member_ids,
// with no caller anywhere in the app. It was the unguarded self-join primitive
// the old teams rule existed to permit. Joining now happens through an
// invitation (/api/team-invitations/respond) or a manager accepting a join
// request.

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

/**
 * Teams by id, batched like getUsersByIds.
 *
 * Le mercato en a besoin pour réhydrater les logos des candidatures et des
 * invitations créées avant que le logo ne soit recopié dans le document :
 * une carte par requête aurait fait une lecture par ligne de liste.
 */
export async function getTeamsByIds(teamIds: string[]): Promise<Team[]> {
  if (teamIds.length === 0) return [];
  const results: Team[] = [];
  for (let i = 0; i < teamIds.length; i += 30) {
    const chunk = teamIds.slice(i, i + 30);
    const snap = await getDocs(
      query(collection(db, "teams"), where("__name__", "in", chunk)),
    );
    for (const d of snap.docs) results.push(toTeam(d.id, d.data() as FirestoreTeam));
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

/** Accent- and case-insensitive folding, so "lome" finds "Lomé". */
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Free-text team lookup for the directory, matching on name OR city.
 *
 * Distinct from searchTeams below, which exists for the mercato and only ever
 * returns teams that are recruiting. This one answers "where is my friend's
 * team?" as well as "who is taking players?", so it does not filter on
 * is_recruiting, the card badges that instead.
 *
 * Firestore has no substring index, so the match is done client-side; ghost
 * teams (off-platform opponents, no account and no members) are dropped since
 * they are not something a player can join or follow.
 */
export async function findTeams(term: string, max = 24): Promise<Team[]> {
  const needle = fold(term.trim());
  if (!needle) return [];
  const snap = await getDocs(collection(db, "teams"));
  return snap.docs
    .map((d) => toTeam(d.id, d.data() as FirestoreTeam))
    .filter((t) => !t.isGhost && fold(`${t.name} ${t.city}`).includes(needle))
    // Recruiting teams first, a search for a team is most often a search for
    // one that will have you.
    .sort((a, b) => Number(b.isRecruiting) - Number(a.isRecruiting) || a.name.localeCompare(b.name))
    .slice(0, max);
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

/**
 * Les équipes qu'on peut défier, pour le sélecteur d'adversaire.
 *
 * PAS `searchTeams` : celui-là filtre sur `is_recruiting`, ce qui est la bonne
 * règle au mercato et la mauvaise ici. Une équipe au complet coupe son
 * recrutement, elle ne cesse pas pour autant de jouer : la rendre introuvable
 * comme adversaire n'avait aucun sens.
 *
 * Deux exclusions en revanche :
 *  - les fantômes, qui n'ont pas de manager en face et relèvent de l'amical ;
 *  - mes propres équipes, sans quoi on peut se programmer un Koppa FC contre
 *    Koppa FC dont personne ne sait quoi faire ensuite.
 *
 * Le filtre sur le nom reste côté client, comme dans `searchTeams` : Firestore
 * ne sait pas chercher un fragment de chaîne.
 */
export async function searchOpponentTeams(input: {
  query: string;
  managerId: string;
}): Promise<Team[]> {
  const search = input.query.trim().toLowerCase();
  if (!search) return [];
  const snap = await getDocs(collection(db, "teams"));
  return snap.docs
    .map((d) => toTeam(d.id, d.data() as FirestoreTeam))
    .filter((t) => !t.isGhost)
    .filter((t) => t.managerId !== input.managerId)
    .filter((t) => !(t.staffManagerIds ?? []).includes(input.managerId))
    .filter((t) => t.name.toLowerCase().includes(search));
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
  managerId: string; playerId: string; playerName: string; playerPhoto?: string | null;
  playerCity: string; playerPosition: string; playerLevel: string; playerBio: string;
}): Promise<string> {
  const q = query(collection(db, "shortlists"),
    where("manager_id", "==", data.managerId),
    where("player_id", "==", data.playerId));
  const existing = await getDocs(q);
  if (!existing.empty) return existing.docs[0].id;

  const ref = await addDoc(collection(db, "shortlists"), {
    manager_id: data.managerId, player_id: data.playerId,
    player_name: data.playerName, player_photo: data.playerPhoto ?? null,
    player_city: data.playerCity,
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
  playerId: string; playerName: string; playerPhoto?: string | null; playerCity: string;
  playerPosition: string; playerLevel: string;
  teamId: string; teamName: string; teamLogo?: string | null;
  managerId: string; message: string;
}): Promise<string> {
  const q = query(collection(db, "join_requests"),
    where("player_id", "==", data.playerId),
    where("team_id", "==", data.teamId),
    where("status", "==", "pending"));
  const existing = await getDocs(q);
  if (!existing.empty) return existing.docs[0].id;

  const ref = await addDoc(collection(db, "join_requests"), {
    player_id: data.playerId, player_name: data.playerName,
    player_photo: data.playerPhoto ?? null, team_logo: data.teamLogo ?? null,
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

  if (accepted && teamId && playerId) {
    notifyTeamActivity({ teamId, event: "member_joined", playerId });
  }
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

/**
 * Crée un match. `awayManagerId` vide = adversaire hors plateforme.
 *
 * Le flux normal naît en `challenge` : le manager adverse accepte, et c'est
 * son acceptation (`respondToMatchChallenge`) qui crée les convocations des
 * deux camps. Face à un fantôme il n'y a personne pour accepter, le match
 * partirait donc dans une boîte de réception que personne ne lit, et aucun
 * joueur ne serait convoqué. On planifie donc directement, et on convoque
 * l'équipe réelle ici même.
 */
export async function createMatch(data: {
  homeTeamId: string; awayTeamId: string; homeTeamName: string; awayTeamName: string;
  managerId: string; awayManagerId: string; date: string; time: string; venueName: string; venueCity: string;
  format: string; isHome: boolean; playersTotal: number; localRefereeName?: string;
  autoAcceptPlayers?: boolean;
  // Effectif à convoquer côté équipe réelle, requis pour un adversaire fantôme.
  homeSquad?: { teamId: string; memberIds: string[]; memberNames: Map<string, string> };
  // Feuille de match du camp fantôme, générée avec l'adversaire.
  ghostLineup?: LineupEntry[];
}): Promise<string> {
  const isGhostOpponent = !data.awayManagerId;
  // Un amical contre un fantôme est programmé, point : il n'y a pas de camp
  // adverse à convoquer, donc `confirmed_away` reste à zéro et le passage
  // automatique `pending -> upcoming` (voir respondToParticipation) ne pouvait
  // jamais se déclencher. Le match restait en brouillon à vie. Les joueurs de
  // notre camp sont convoqués et répondent quand même : leurs réponses
  // remplissent la feuille de match, elles ne conditionnent plus la tenue du
  // match. C'est aussi la seule issue pour une équipe dont l'effectif est
  // entièrement composé de joueurs sans compte.
  const status: MatchStatus = isGhostOpponent ? "upcoming" : "challenge";
  const ghostIsHome = isGhostOpponent && !data.isHome;
  const ghostLineup = isGhostOpponent ? (data.ghostLineup ?? []) : [];
  const ref = await addDoc(collection(db, "matches"), {
    home_team_id: data.homeTeamId, away_team_id: data.awayTeamId,
    home_team_name: data.homeTeamName, away_team_name: data.awayTeamName,
    manager_id: data.managerId, away_manager_id: data.awayManagerId,
    date: data.date, time: data.time,
    venue_name: data.venueName, venue_city: data.venueCity,
    status, result: null, score_home: null, score_away: null,
    referee_id: null, referee_name: null, referee_status: "none",
    local_referee_name: data.localRefereeName ?? null,
    format: data.format, is_home: data.isHome,
    players_confirmed: 0, players_total: data.playersTotal,
    confirmed_home: 0, confirmed_away: 0,
    auto_accept_players: !!data.autoAcceptPlayers,
    [ghostIsHome ? "home_ghost_lineup" : "away_ghost_lineup"]: ghostLineup.map((e) => ({
      player_id: e.playerId, name: e.name, number: e.number, role: e.role,
      position: e.position ?? null,
    })),
    [ghostIsHome ? "home_lineup_ready" : "away_lineup_ready"]: ghostLineup.length > 0,
    created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  if (isGhostOpponent) {
    // Personne à notifier en face ; on convoque directement notre camp, ce que
    // respondToMatchChallenge aurait fait à l'acceptation.
    if (data.homeSquad && data.homeSquad.memberIds.length > 0) {
      await createParticipationsForTeam(
        ref.id, `${data.homeTeamName} vs ${data.awayTeamName}`,
        data.date, data.time, data.venueName,
        data.homeSquad.teamId, data.homeSquad.memberIds, data.homeSquad.memberNames,
        data.format, data.isHome, !!data.autoAcceptPlayers,
      );
    }
  } else {
    void createNotification({
      userId: data.awayManagerId,
      type: "match_challenge",
      title: "Nouveau défi reçu",
      body: `${data.homeTeamName} vous défie`,
      link: "/matches",
    });
  }
  return ref.id;
}

export async function updateMatch(matchId: string, data: Partial<FirestoreMatch>): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), { ...data, updated_at: serverTimestamp() });
}

/**
 * Enregistre la feuille de match d'un camp.
 *
 * DEUX ORIGINES, ET C'EST TOUT L'OBJET DE CETTE FONCTION. Les joueurs qui ont
 * un compte portent leur numéro et leur rôle sur leur document
 * `participations`. Ceux qui n'en ont pas n'ont aucun document où les poser :
 * leurs assignations se dénormalisent sur le match, dans le champ du camp.
 *
 * Avant, seule la première branche existait. L'écran proposait pourtant de
 * numéroter les joueurs sans compte, et `snap.docs.find(...)` ne trouvant
 * jamais leur participation, chaque saisie était jetée en silence — sans une
 * erreur, sans un avertissement, et la feuille se déclarait validée.
 *
 * `ghostEntries` REMPLACE la liste du camp, il ne s'y ajoute pas : un joueur
 * retiré de la feuille doit disparaître, pas y rester faute d'être mentionné.
 */
export async function updateMatchLineup(
  matchId: string,
  teamId: string,
  isHome: boolean,
  assignments: {
    playerId: string;
    squadNumber: string;
    role: "starter" | "substitute";
    /**
     * Le poste tenu sur CE match. Absent de cette signature jusqu'ici : seuls
     * les joueurs sans compte en portaient un, et le terrain n'avait donc
     * jamais de poste à lire pour les autres — il repliait tout le monde sur
     * un 4-3-3 par ordre de feuille (voir lib/terrain).
     */
    position?: Poste | null;
  }[],
  ghostEntries: LineupEntry[] = [],
): Promise<void> {
  const batch = writeBatch(db);

  const q = query(
    collection(db, "participations"),
    where("match_id", "==", matchId),
    where("team_id", "==", teamId)
  );
  const snap = await getDocs(q);

  // La feuille se réécrit en entier : on efface d'abord le rôle ET le poste de
  // tout le monde, sinon un joueur retiré de la composition y gardait le poste
  // de la version précédente et le terrain continuait de l'aligner.
  snap.docs.forEach(d => {
    batch.update(d.ref, {
      match_role: null,
      match_position: null,
      updated_at: serverTimestamp(),
    });
  });

  assignments.forEach(asgn => {
    const doc = snap.docs.find(d => d.data().player_id === asgn.playerId);
    if (doc) {
      batch.update(doc.ref, {
        squad_number: asgn.squadNumber,
        match_role: asgn.role,
        match_position: asgn.position ?? null,
        updated_at: serverTimestamp(),
      });
    }
  });

  /**
   * DEUX JOUEURS, UN DOSSARD : LE COMPTE L'EMPORTE SUR LE FANTÔME.
   *
   * Les deux moitiés d'un effectif se numérotent séparément — le dossard d'un
   * joueur avec un compte vit sur sa convocation (et par défaut sur celui que
   * son équipe lui a donné), celui d'un joueur sans compte sur sa fiche — et
   * rien ne les confrontait. Un même numéro pouvait donc partir en double sur
   * la feuille, ce qui n'est pas un détail d'affichage : un but attribué au
   * « 7 » depuis la console ne désigne plus personne.
   *
   * On tranche du côté du compte : c'est lui qui porte une carrière, des
   * statistiques et un profil public, là où la ligne fantôme ne vit que le
   * temps de ce match. Le fantôme perd donc son numéro plutôt que la feuille
   * son sens ; le manager le voit vide et lui en donne un autre.
   */
  const dossardsDesComptes = new Set(
    assignments.map((a) => a.squadNumber.trim()).filter((n) => n !== ""),
  );
  const ghostsDemeles = ghostEntries.map((e) =>
    dossardsDesComptes.has(e.number.trim()) ? { ...e, number: "" } : e,
  );

  // Une feuille sans un seul titulaire n'est pas une feuille prête. Le drapeau
  // partait à `true` quoi qu'il arrive, et la console annonçait « validée » sur
  // une grille vide.
  const titulaires =
    assignments.filter((a) => a.role === "starter").length +
    ghostsDemeles.filter((e) => e.role === "starter").length;

  const matchRef = doc(db, "matches", matchId);
  batch.update(matchRef, {
    [isHome ? "home_ghost_lineup" : "away_ghost_lineup"]: ghostsDemeles.map((e) => ({
      player_id: e.playerId, name: e.name, number: e.number, role: e.role,
      position: e.position ?? null,
    })),
    [isHome ? "home_lineup_ready" : "away_lineup_ready"]: titulaires > 0,
    updated_at: serverTimestamp(),
  });

  await batch.commit();
}

// ============================================
// Modérateurs d'un match
//
// Ceux qui tiendront sa console live sans être managers. La liste vit sur le
// match (`moderator_ids`) et ne vaut que pour lui : la modération de
// compétition, elle, est globale et porte sur `competitions.moderator_ids`.
// Les écritures passent par /api/matches/moderators, parce que résoudre un
// email en compte demande le SDK admin.
// ============================================

/**
 * Les amicaux en cours ET ceux qui viennent de finir, pour le Direct.
 *
 * Le tableau n'attachait d'écouteur qu'aux compétitions : un amical y entrait
 * par le rendu serveur et n'en bougeait plus, score figé jusqu'à la
 * revalidation. Or c'est justement celui qu'on regarde quand quelqu'un le
 * couvre.
 *
 * LES DEUX STATUTS, pas seulement « live » : un match qui se termine sous les
 * yeux du spectateur quitterait sinon la requête, et le tableau garderait de
 * lui l'instantané d'avant — score figé à la dernière minute connue, mention
 * « en direct » sur une rencontre finie.
 *
 * La requête ne porte que sur `status`, sans tri : un index composite pour une
 * poignée de documents n'aurait servi à rien, et le tableau retrie de toute
 * façon.
 */
export function onLiveFriendlies(
  callback: (rows: { id: string; data: Record<string, unknown> }[]) => void,
): Unsubscribe {
  const q = query(collection(db, "matches"), where("status", "in", ["live", "completed"]));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))),
    () => callback([]),
  );
}

/** Les matchs que ce compte a été chargé de couvrir. */
export async function getMatchesIModerate(uid: string): Promise<Match[]> {
  const q = query(collection(db, "matches"), where("moderator_ids", "array-contains", uid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => toMatch(d.id, d.data() as FirestoreMatch))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}

/**
 * Les amicaux que PERSONNE ne couvre, ouverts au premier scoreur qui les prend.
 *
 * FILTRE EN MEMOIRE, et pas dans la requete : Firestore ne sait pas demander
 * « ce tableau est vide ». `where("moderator_ids", "==", [])` ne trouverait
 * que les documents qui portent explicitement un tableau vide — or les
 * amicaux crees avant la moderation par match n'ont pas le champ du tout, et
 * ce sont justement ceux qui n'ont personne. On filtre donc apres coup, ce
 * que le volume permet largement.
 *
 * Seuls les matchs A VENIR : un match en cours a deja quelqu'un devant la
 * console ou il ne se passe rien, et un match passe n'a plus de score a
 * saisir.
 */
export function onAmicauxSansScoreur(callback: (data: Match[]) => void): Unsubscribe {
  const q = query(
    collection(db, "matches"),
    where("status", "in", ["upcoming", "pending"]),
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs
        .map((d) => toMatch(d.id, d.data() as FirestoreMatch))
        .filter((m) => (m.moderatorIds ?? []).length === 0)
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
    );
  }, (err) => {
    console.error("onAmicauxSansScoreur failed:", err);
    callback([]);
  });
}

/** Idem, en direct : la console doit apparaître sans recharger la page. */
export function onMatchesIModerate(
  uid: string,
  callback: (data: Match[]) => void,
): Unsubscribe {
  const q = query(collection(db, "matches"), where("moderator_ids", "array-contains", uid));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs
        .map((d) => toMatch(d.id, d.data() as FirestoreMatch))
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
    );
  });
}

async function appelerRouteModerateurs(
  methode: "POST" | "DELETE",
  corps: Record<string, string>,
): Promise<any> {
  const current = auth.currentUser;
  if (!current) throw new Error("Connexion requise");
  const res = await fetch("/api/matches/moderators", {
    method: methode,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await current.getIdToken()}`,
    },
    body: JSON.stringify(corps),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "L'opération a échoué");
  return data;
}

export async function addMatchModerator(
  matchId: string,
  email: string,
): Promise<{ uid: string; firstName: string; lastName: string; email: string }> {
  return appelerRouteModerateurs("POST", { matchId, email });
}

export async function removeMatchModerator(matchId: string, uid: string): Promise<void> {
  await appelerRouteModerateurs("DELETE", { matchId, uid });
}

/**
 * Le résultat des tirs au but.
 *
 * Écrit À PART du score : `score_home` / `score_away` restent le temps
 * réglementaire, et c'est bien ce 2-2 qui doit compter au bilan des deux
 * clubs. Les tirs au but ne disent que qui a passé.
 *
 * `null` efface la séance, pour le cas où on l'a saisie par erreur.
 */
export async function setPenaltyShootout(
  matchId: string,
  home: number | null,
  away: number | null,
): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    penalty_home: home,
    penalty_away: away,
    updated_at: serverTimestamp(),
  });
}

// ============================================
// Renseigner un match déjà joué
//
// Le troisième parcours. Tout passe par /api/matches/record : la saisie écrit
// dans le bilan de deux clubs et dans la carrière de joueurs, c'est-à-dire des
// documents que le manager ne possède pas. La seule règle Firestore qui
// l'aurait permis est « tout compte connecté peut réécrire les statistiques de
// n'importe qui ».
// ============================================

export interface ButeurSaisi {
  playerId: string;
  sansCompte: boolean;
  nom: string;
  buts: number;
  passes: number;
}

async function appelerRouteRecord(methode: "POST" | "PATCH" | "DELETE", corps: unknown): Promise<any> {
  const current = auth.currentUser;
  if (!current) throw new Error("Connexion requise");
  const res = await fetch("/api/matches/record", {
    method: methode,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await current.getIdToken()}`,
    },
    body: JSON.stringify(corps),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "L'opération a échoué");
  return data;
}

export async function recordPlayedMatch(input: {
  teamId: string;
  isHome: boolean;
  opponentTeamId?: string;
  opponentManagerId?: string;
  opponentName: string;
  date: string;
  time?: string;
  venueName?: string;
  venueCity?: string;
  format: string;
  scoreUs: number;
  scoreThem: number;
  buteurs: ButeurSaisi[];
}): Promise<{ id: string; enAttente: boolean }> {
  return appelerRouteRecord("POST", input);
}

/** Contresigner, ou contester, un résultat saisi par l'adversaire. */
export async function confirmRecordedMatch(matchId: string, accepte: boolean): Promise<void> {
  await appelerRouteRecord("PATCH", { matchId, accepte });
}

/** Supprimer un match renseigné : la route reprend ce qu'il avait crédité. */
export async function deleteRecordedMatch(matchId: string): Promise<void> {
  await appelerRouteRecord("DELETE", { matchId });
}

export async function cancelMatch(matchId: string): Promise<void> {
  await cancelMatchParticipations(matchId);
  await updateDoc(doc(db, "matches", matchId), {
    status: "cancelled",
    updated_at: serverTimestamp(),
  });
}

/**
 * Supprimer un match, pour de bon.
 *
 * `cancelMatch` ne supprime rien : il passe le statut à « cancelled », et
 * l'onglet Brouillons affiche justement les annulés. Le bouton « Supprimer »
 * pointait dessus, si bien qu'un match supprimé restait à l'écran pour
 * toujours, sans aucun moyen de s'en débarrasser.
 *
 * DEUX CHOSES PARTENT ENSEMBLE, sinon la suppression laisse des orphelins que
 * plus aucun écran ne montre :
 *   - les convocations, qui pendent au match par `match_id` ;
 *   - le match lui-même, en dernier : tant qu'il existe, les règles Firestore
 *     s'appuient dessus pour autoriser la suppression de ses convocations.
 */
export async function deleteMatch(matchId: string): Promise<void> {
  const snap = await getDoc(doc(db, "matches", matchId));
  if (!snap.exists()) return;
  const m = snap.data() as FirestoreMatch;

  const parts = await getDocs(
    query(collection(db, "participations"), where("match_id", "==", matchId)),
  );
  const batch = writeBatch(db);
  parts.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  // L'adversaire hors plateforme n'a plus rien à supprimer : il n'existe que
  // sur le match, dans son nom et sa feuille (voir ghostOpponentLineup). Les
  // équipes fantômes d'avant restent en base, sans écran pour les montrer.
  await deleteDoc(doc(db, "matches", matchId));
}

export async function submitManagerFeedback(
  matchId: string,
  managerId: string,
  data: {
    validation: "validated" | "contested";
    comments?: string;
    refereeRating?: number;
  },
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

    // "unverified" (adversaire hors plateforme) est terminal : bothValidated
    // ne peut pas être vrai sans manager adverse, donc le statut y reste.
    let validation_status: NonNullable<FirestoreMatch["validation_status"]> =
      matchData.validation_status ?? "pending";
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
        content: `⚽ Match confirmé ! ${matchLabel} le ${matchDate} à ${matchTime}, ${venueName}`,
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

/**
 * Déplacer un match sans passer par une demande.
 *
 * Réservé aux amicaux contre un fantôme : `requestMatchModification` attend
 * qu'un manager adverse accepte, et il n'y en a pas. La demande s'écrivait
 * quand même, le match affichait « en attente de validation adverse » et plus
 * personne ne pouvait ni le déplacer ni s'en débarrasser. Ici on écrit
 * directement, et les convoqués sont prévenus du changement.
 */
export async function updateMatchSchedule(
  matchId: string,
  data: { date: string; time: string; venueName: string; venueCity: string },
): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    date: data.date, time: data.time,
    venue_name: data.venueName, venue_city: data.venueCity,
    modification_request: null,
    updated_at: serverTimestamp(),
  });

  // Les participations portent une copie de la date et du terrain : sans ça,
  // le joueur garde l'ancien créneau dans son agenda.
  const q = query(collection(db, "participations"), where("match_id", "==", matchId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, {
      match_date: data.date, match_time: data.time,
      venue_name: data.venueName,
      updated_at: serverTimestamp(),
    });
  });
  await batch.commit();

  await Promise.all(snap.docs.map((d) => {
    const part = d.data() as FirestoreParticipation;
    if (part.status === "cancelled" || part.status === "declined") return Promise.resolve();
    return createNotification({
      userId: part.player_id,
      type: "match_update",
      title: "Match déplacé",
      body: `${part.match_label} : ${data.date} à ${data.time}${data.venueName ? `, ${data.venueName}` : ""}`,
      link: `/matches/${matchId}`,
    });
  }));
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
    const minQuota = quotaMinimum(format);
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
        content: `⚽ Match confirmé ! ${matchData.home_team_name} vs ${matchData.away_team_name} le ${matchData.date} à ${matchData.time}, ${matchData.venue_name}`,
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

/**
 * Attribuer les statistiques d'un amical joué contre une équipe hors
 * plateforme, aux joueurs de sa propre équipe.
 *
 * Même raison que le rollup de fin de match : les compteurs vivent sur des
 * documents que l'appelant ne possède pas, donc l'écriture est côté serveur.
 * Voir /api/matches/credit-stats pour ce que ça engage.
 */
export async function creditGhostMatchStats(matchId: string): Promise<number> {
  const current = auth.currentUser;
  if (!current) throw new Error("Connexion requise");
  const res = await fetch("/api/matches/credit-stats", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await current.getIdToken()}`,
    },
    body: JSON.stringify({ matchId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "L'attribution a échoué");
  return data.joueurs ?? 0;
}

/**
 * Completing a match rolls its stats onto both clubs and every player who took
 * part, writes that no longer happen from the browser. See
 * /api/matches/complete: the counters live on documents the caller does not own,
 * so the only rule that could permit a client-side rollup was "anyone signed in
 * may rewrite these fields on anyone", which is exactly what it sounds like.
 *
 * Every other status transition only touches the match document itself and stays
 * here, gated by the match rules.
 */
export async function updateMatchStatus(matchId: string, status: Match["status"]): Promise<void> {
  if (status === "completed") {
    const current = auth.currentUser;
    if (!current) throw new Error("Connexion requise");
    const res = await fetch("/api/matches/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await current.getIdToken()}`,
      },
      body: JSON.stringify({ matchId }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: null }));
      throw new Error(error ?? "Impossible de terminer le match");
    }
    return;
  }

  // A plain transition (pending -> upcoming, etc.): only the match document is
  // touched, so it stays client-side under the match rules.
  const matchRef = doc(db, "matches", matchId);
  const matchSnap = await getDoc(matchRef);
  if (!matchSnap.exists()) return;

  await updateDoc(matchRef, {
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
  receiverPhoto?: string | null; teamLogo?: string | null;
  receiverCity: string; receiverPosition: string; receiverLevel: string;
  teamId: string; teamName: string; message: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, "invitations"), {
    sender_id: data.senderId, sender_name: data.senderName,
    receiver_id: data.receiverId, receiver_name: data.receiverName,
    receiver_photo: data.receiverPhoto ?? null, team_logo: data.teamLogo ?? null,
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

/**
 * Answer an invitation to join a team.
 *
 * Goes through /api/team-invitations/respond: accepting writes `member_ids` on
 * a team the player does not own, and the rule that used to permit that could
 * only inspect the shape of the write, never whether an invitation existed,
 * so it let anyone add themselves to any team. The server checks the invitation
 * instead.
 *
 * `teamId` and `playerId` are ignored: both are read from the invitation, and
 * the player is the token's owner. The parameters stay for the call sites.
 */
export async function respondToInvitation(
  invitationId: string,
  accepted: boolean,
  _teamId?: string,
  _playerId?: string,
): Promise<void> {
  const current = auth.currentUser;
  if (!current) throw new Error("Connexion requise");
  const res = await fetch("/api/team-invitations/respond", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await current.getIdToken()}`,
    },
    body: JSON.stringify({ invitationId, accepted }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: null }));
    throw new Error(error ?? "Opération impossible");
  }
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  await deleteDoc(doc(db, "invitations", invitationId));
}

// ============================================
// Players (for recruitment search)
// ============================================

/**
 * Players available on the market.
 *
 * Filters on the ACTIVATED role, not on `user_type`: since the pivot every
 * account is created with `user_type: "player"`, so that field would put
 * every spectator who never opened the player space into the mercato,
 * which is why managers were seeing profiles with no position. Docs without
 * `evolution_role` are excluded by the equality filter, which is the point.
 */
export async function searchPlayers(filters: { city?: string; position?: string; skillLevel?: string; query?: string }): Promise<UserProfile[]> {
  const constraints: QueryConstraint[] = [where("evolution_role", "==", "player"), where("is_active", "==", true)];
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

/**
 * Les arbitres, sur DEUX signaux réunis.
 *
 * Depuis que l'arbitre est un rôle Evolution activable librement, deux
 * populations coexistent :
 *
 * - les comptes qui viennent de l'activer, marqués `evolution_role`. Un
 *   organisateur qui arbitre garde son `user_type: "organizer"` (l'activation
 *   préserve les types privilégiés), donc lui seul ce champ le désigne ;
 * - les arbitres d'avant, désignés par `user_type: "referee"` et sans
 *   `evolution_role`.
 *
 * Firestore ne sait pas faire un OU sur deux champs : on lance donc les deux
 * requêtes et on fusionne. Filtrer sur un seul des deux aurait rendu invisible
 * la moitié des arbitres, et laquelle dépend de leur ancienneté.
 */
export async function searchReferees(filters: { city?: string; licenseLevel?: string; query?: string }): Promise<UserProfile[]> {
  const common: QueryConstraint[] = [where("is_active", "==", true)];
  if (filters.city) common.push(where("location_city", "==", filters.city));
  if (filters.licenseLevel) common.push(where("license_level", "==", filters.licenseLevel));

  const [parRole, parType] = await Promise.all([
    getDocs(query(collection(db, "users"), where("evolution_role", "==", "referee"), ...common)),
    getDocs(query(collection(db, "users"), where("user_type", "==", "referee"), ...common)),
  ]);

  const vus = new Set<string>();
  let results = [...parRole.docs, ...parType.docs].flatMap((d) => {
    if (vus.has(d.id)) return [];
    vus.add(d.id);
    return [toUserProfile(d.id, d.data() as FirestoreUser)];
  });
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

/**
 * Replace each post's copied-in author name and picture with the author's
 * current ones.
 *
 * A post stores author_name / author_avatar at the moment it is written, so
 * changing your profile picture used to leave every old post showing the old
 * one. The stored values stay as a fallback for authors whose account has
 * since gone; what the feed displays is live.
 *
 * `cache` is owned by the caller and survives across snapshots, so a realtime
 * feed does not refetch the same handful of authors on every update.
 */
async function hydratePostAuthors(
  posts: Post[],
  cache: Map<string, { name: string; avatar: string }>,
): Promise<void> {
  const missing = [
    ...new Set(
      posts
        .map((p) => p.authorId)
        // The official account has no users document, its identity comes
        // from the Tribune settings, resolved at render time.
        .filter((id) => id && id !== SYSTEM_AUTHOR_ID && !cache.has(id)),
    ),
  ];

  // documentId() 'in' takes at most 30 values per query.
  for (let i = 0; i < missing.length; i += 30) {
    const chunk = missing.slice(i, i + 30);
    try {
      const snap = await getDocs(
        query(collection(db, "users"), where(documentId(), "in", chunk)),
      );
      for (const d of snap.docs) {
        const u = d.data();
        const name = `${u.first_name ?? ""} ${u.last_name ? u.last_name.charAt(0) + "." : ""}`.trim();
        cache.set(d.id, { name, avatar: u.profile_picture_url ?? "" });
      }
    } catch (err) {
      console.error("Error hydrating post authors:", err);
    }
  }

  // The official account's identity lives in settings/tribune and is editable
  // from the admin panel, so it is resolved the same way, renaming it or
  // changing its picture must update everything it ever posted.
  if (posts.some((p) => p.authorId === SYSTEM_AUTHOR_ID) && !cache.has(SYSTEM_AUTHOR_ID)) {
    try {
      const snap = await getDoc(doc(db, "settings", "tribune"));
      const d = snap.data();
      cache.set(SYSTEM_AUTHOR_ID, {
        name: d?.system_name || SYSTEM_AUTHOR_NAME,
        avatar: d?.system_avatar_url || "",
      });
    } catch (err) {
      console.error("Error reading Tribune settings:", err);
    }
  }

  for (const p of posts) {
    const fresh = cache.get(p.authorId);
    if (!fresh) continue;
    if (fresh.name) p.authorName = fresh.name;
    p.authorAvatar = fresh.avatar;
  }
}

export function onPosts(maxResults: number, currentUserId: string, callback: (data: Post[]) => void): Unsubscribe {
  const q = query(collection(db, "posts"), orderBy("created_at", "desc"), firestoreLimit(maxResults));
  const authorCache = new Map<string, { name: string; avatar: string }>();
  // Snapshots can overlap while authors are being fetched; only the newest
  // one is allowed to reach the callback.
  let latest = 0;
  return onSnapshot(q,
    (snap) => {
      const seq = ++latest;
      const posts = snap.docs.map((d) => toPost(d.id, d.data() as FirestorePost, currentUserId));
      // Render immediately with the stored values, then correct them, the
      // feed must not wait on a second round trip to appear.
      callback(posts);
      hydratePostAuthors(posts, authorCache).then(() => {
        if (seq === latest) callback([...posts]);
      });
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

/**
 * L'arbitre retire sa candidature d'un match où le manager n'a pas encore
 * tranché.
 *
 * L'écriture est celle d'une invitation déclinée — on efface le nom, le
 * match repart sans arbitre — mais le geste n'est pas le même : décliner
 * répond à quelqu'un, se retirer revient sur sa propre demande. Les deux
 * appels s'écrivent donc en clair là où on les lit, plutôt qu'un
 * `respondToRefereeInvitation(id, false)` dont le nom mentirait sur ce que
 * l'arbitre vient de faire.
 */
export async function withdrawRefereeApplication(matchId: string): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    referee_id: null,
    referee_name: null,
    referee_status: "none",
    updated_at: serverTimestamp(),
  });
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

// ============================================
// Amical : la feuille de match et les evenements, dans la forme de la
// competition.
//
// Ces ecritures sont les jumelles de celles de `competition-firestore`
// (setCompMatchLineup, addCompEvent, setCompGoalAssist, setCompFoulVictim).
// Elles existent parce que les deux types de match partagent DESORMAIS UNE
// SEULE CONSOLE (voir lib/console-pilote) : ce qui differe n'est plus l'ecran,
// seulement l'endroit ou l'on ecrit. Un amical vit dans `matches/{id}`, une
// rencontre de competition dans une sous-collection — c'est tout.
//
// `addMatchEvent`, l'ancienne, disparait avec la console qui l'appelait : elle
// ne rendait pas l'identifiant de l'evenement, donc rien ne pouvait s'y
// raccrocher ensuite, ni passeur ni victime. Et elle devinait le camp en
// comparant `team_id` a la chaine « home », ce qu'aucun identifiant d'equipe
// ne vaut.
// ============================================

/**
 * Un amical, en direct.
 *
 * La console s'abonnait au document depuis son propre composant, avec un
 * `onSnapshot` ecrit sur place. Il vit ici, a cote des autres lectures de
 * `matches`, pour que le pilote n'ait pas a connaitre Firestore.
 */
export function onMatchLive(matchId: string, cb: (m: Match | null) => void): () => void {
  return onSnapshot(doc(db, "matches", matchId), (snap) => {
    cb(snap.exists() ? toMatch(snap.id, snap.data() as FirestoreMatch) : null);
  }, (err) => {
    console.error("onMatchLive failed:", err);
    cb(null);
  });
}

/** La feuille d'un camp sur un amical, et son drapeau. */
export async function setMatchLineup(
  matchId: string,
  side: "home" | "away",
  entries: LineupEntry[],
  ready: boolean,
): Promise<void> {
  const lignes: FirestoreLineupEntry[] = entries.map((e) => ({
    player_id: e.playerId,
    name: e.name,
    number: e.number,
    role: e.role,
    user_id: e.userId ?? null,
    // `null` et non `undefined` : Firestore refuse `undefined`, et un poste
    // absent doit s'ecrire pour rester absent.
    position: e.position ?? null,
  }));
  await updateDoc(doc(db, "matches", matchId), {
    [side === "home" ? "home_lineup" : "away_lineup"]: lignes,
    [side === "home" ? "home_lineup_ready" : "away_lineup_ready"]: ready,
    updated_at: serverTimestamp(),
  });
}

/** Qui est sur la pelouse, apres un coup d'envoi, une sortie ou un changement. */
export async function setMatchOnPitch(
  matchId: string,
  side: "home" | "away",
  ids: string[],
): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    [side === "home" ? "home_on_pitch" : "away_on_pitch"]: ids,
    updated_at: serverTimestamp(),
  });
}

/**
 * Un evenement, et son identifiant en retour.
 *
 * C'est le retour qui compte : sans lui, la console ne peut raccrocher ni le
 * passeur a son but, ni la victime a sa faute.
 */
export async function addMatchLiveEvent(
  matchId: string,
  event: {
    type: TypeEvenement;
    side: "home" | "away";
    team_id: string;
    period: number;
    minute: number;
    player_id?: string | null;
    player_name?: string | null;
    detail?: string | null;
    victim_player_id?: string | null;
    victim_player_name?: string | null;
  },
): Promise<string> {
  const id = Math.random().toString(36).substring(2, 11);
  const nouveau = {
    id,
    type: event.type,
    period: event.period,
    minute: event.minute,
    team_id: event.team_id,
    player_id: event.player_id ?? null,
    player_name: event.player_name ?? null,
    detail: event.detail ?? null,
    victim_player_id: event.victim_player_id ?? null,
    victim_player_name: event.victim_player_name ?? null,
    created_at: new Date().toISOString(),
  };

  const updates: Record<string, unknown> = {
    "live_state.events": arrayUnion(nouveau),
    updated_at: serverTimestamp(),
  };
  if (event.type === "goal") {
    updates[event.side === "home" ? "score_home" : "score_away"] = increment(1);
  }

  await updateDoc(doc(db, "matches", matchId), updates);
  return id;
}

/** Le passeur d'un but deja pose. Voir `setCompGoalAssist` pour le pourquoi. */
export async function setMatchGoalAssist(
  matchId: string,
  eventId: string,
  assist: { playerId: string | null; playerName: string | null } | null,
): Promise<void> {
  await modifierEvenementAmical(matchId, eventId, "goal", "Seul un but a un passeur", (e) => ({
    ...e,
    assist_player_id: assist?.playerId ?? null,
    assist_player_name: assist?.playerName ?? null,
  }));
}

/** La victime d'une faute deja posee. Voir `setCompFoulVictim`. */
export async function setMatchFoulVictim(
  matchId: string,
  eventId: string,
  victime: { playerId: string | null; playerName: string | null } | null,
): Promise<void> {
  await modifierEvenementAmical(matchId, eventId, "foul", "Seule une faute a une victime", (e) => ({
    ...e,
    victim_player_id: victime?.playerId ?? null,
    victim_player_name: victime?.playerName ?? null,
  }));
}

/**
 * Reecrit UNE entree de `live_state.events`.
 *
 * Le tableau est ajoute par `arrayUnion` partout ailleurs, donc modifier une
 * entree demande de le relire en entier : d'ou la transaction, qui laisse la
 * console poser d'autres evenements pendant qu'on repond a la question.
 */
type EntreeEvenement = NonNullable<FirestoreMatch["live_state"]>["events"][number];

async function modifierEvenementAmical(
  matchId: string,
  eventId: string,
  typeAttendu: TypeEvenement,
  messageSiMauvaisType: string,
  transformer: (e: EntreeEvenement) => EntreeEvenement,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "matches", matchId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error(`Match ${matchId} introuvable`);
    const d = snap.data() as FirestoreMatch;

    const events = d.live_state?.events ?? [];
    const index = events.findIndex((e) => e.id === eventId);
    if (index === -1) throw new Error("Événement introuvable");
    if (events[index].type !== typeAttendu) throw new Error(messageSiMauvaisType);

    tx.update(ref, {
      "live_state.events": events.map((e, i) => (i === index ? transformer(e) : e)),
      updated_at: serverTimestamp(),
    });
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
//
// Follows are written through /api/follows, not from here. The follow document
// is one half of the operation; the other half is a counter on the *followed*
// document, and letting the browser write that meant firestore.rules had to
// allow any signed-in user to set any user's followers_count. The route does
// both halves in one transaction under the admin SDK.
//
// The `followerId` parameters are kept so the call sites read the same, but the
// server takes the follower from the caller's token and ignores anything the
// body claims.
// ============================================

async function callFollowApi(
  action: "follow" | "unfollow",
  targetType: "user" | "team",
  targetId: string,
): Promise<void> {
  const current = auth.currentUser;
  if (!current) throw new Error("Connexion requise");
  const res = await fetch("/api/follows", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await current.getIdToken()}`,
    },
    body: JSON.stringify({ action, targetType, targetId }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: null }));
    throw new Error(error ?? "Opération impossible");
  }
}

export async function followUser(_followerId: string, followingId: string): Promise<void> {
  await callFollowApi("follow", "user", followingId);
}

export async function unfollowUser(_followerId: string, followingId: string): Promise<void> {
  await callFollowApi("unfollow", "user", followingId);
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

export async function followTeam(_followerId: string, teamId: string): Promise<void> {
  await callFollowApi("follow", "team", teamId);
}

export async function unfollowTeam(_followerId: string, teamId: string): Promise<void> {
  await callFollowApi("unfollow", "team", teamId);
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

/**
 * Dépose une demande de créneau.
 *
 * Toujours en `pending` : la confirmation appartient au propriétaire, et les
 * règles refusent d'ailleurs qu'une demande naisse dans un autre état.
 *
 * `total_price` reste à zéro, la plateforme n'encaisse rien et ne connaît
 * pas les tarifs. Le champ existe dans le modèle, on ne lui fait pas dire ce
 * qu'on ne sait pas.
 */
export async function createBooking(data: {
  venueId: string;
  venueName: string;
  ownerId: string;
  userId: string;
  userName: string;
  date: string;
  time: string;
  duration: number;
}): Promise<string> {
  const ref = await addDoc(collection(db, "bookings"), {
    venue_id: data.venueId,
    venue_name: data.venueName,
    owner_id: data.ownerId,
    user_id: data.userId,
    user_name: data.userName,
    date: data.date,
    time: data.time,
    duration: data.duration,
    total_price: 0,
    status: "pending",
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return ref.id;
}

/** Les demandes déposées par ce compte, la plus récente d'abord. */
export function onBookingsByUser(userId: string, callback: (data: Booking[]) => void): Unsubscribe {
  const q = query(collection(db, "bookings"), where("user_id", "==", userId), orderBy("created_at", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => toBooking(d.id, d.data() as FirestoreBooking)));
  });
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
    goals: 0,
    assists: 0,
    matches_played: 0,
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

/**
 * Fusionner un joueur sans compte avec le compte qu'il vient de créer.
 *
 * Passe par le serveur : le transfert écrit dans `users/{uid}`, hors de ce que
 * le manager possède. Voir /api/teams/merge-ghost.
 */
export async function mergeGhostPlayer(input: {
  teamId: string;
  ghostId: string;
  playerId: string;
}): Promise<{ nom: string; buts: number; passes: number; matchs: number }> {
  const current = auth.currentUser;
  if (!current) throw new Error("Connexion requise");
  const res = await fetch("/api/teams/merge-ghost", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await current.getIdToken()}`,
    },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "La fusion a échoué");
  return data;
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

  // Best-effort push, fire and forget
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
  callback: (data: Notification[]) => void,
  // La cloche n'affiche qu'un aperçu ; l'écran /notifications remonte plus
  // loin dans l'historique.
  max = 50,
): Unsubscribe {
  const q = query(
    collection(db, "notifications"),
    where("user_id", "==", userId),
    orderBy("created_at", "desc"),
    firestoreLimit(max)
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
