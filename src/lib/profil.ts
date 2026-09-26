// ============================================
// Le document `users/{uid}`, dans les deux sens.
//
// Sorti d'AuthContext pour que l'application mobile crée ses comptes avec
// EXACTEMENT la forme du site : un compte né sur le téléphone s'ouvre sur le
// site, et inversement. Deux constructeurs, c'est deux formes le jour où un
// champ s'ajoute d'un seul côté.
//
// Module sans SDK (ni Firebase, ni React) : voir lib/direct-shared.
// ============================================

import { formatDate } from "@/lib/dates";
import { lireCondition } from "@/lib/etat-de-forme";
import type { AuthProvider, FirestoreUser, SignupData, UserProfile } from "@/types";

/** L'identifiant de fournisseur Firebase, dans le vocabulaire du profil. */
const FOURNISSEURS: Record<string, AuthProvider> = {
  "google.com": "google",
  phone: "phone",
  password: "email",
};

/**
 * Les fournisseurs d'un compte Firebase (`user.providerData[].providerId`),
 * tels que `auth_providers` les range. Un compte sans fournisseur reconnu
 * compte comme e-mail, ce que faisait déjà `completeProfile`.
 */
export function providersDepuisFirebase(providerIds: string[]): AuthProvider[] {
  const providers = providerIds
    .map((id) => FOURNISSEURS[id])
    .filter((p): p is AuthProvider => !!p);
  return providers.length > 0 ? providers : ["email"];
}

export function firestoreToProfile(uid: string, data: FirestoreUser): UserProfile {
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
    emailVerified: false, // overwritten by Firebase auth state
    authProviders: data.auth_providers ?? [],
    // Written with serverTimestamp(), so Firestore returns a Timestamp object
    // even though the type says string, `new Date(...)` on it yields
    // "Invalid Date", which is what the profile header used to show.
    createdAt: formatDate(data.created_at),
    updatedAt: formatDate(data.updated_at),
    // Role-specific optional fields
    ...(data.position !== undefined && { position: data.position }),
    ...(data.skill_level !== undefined && { skillLevel: data.skill_level }),
    ...(data.team_name !== undefined && { teamName: data.team_name }),
    ...(data.license_number !== undefined && { licenseNumber: data.license_number }),
    ...(data.license_level !== undefined && { licenseLevel: data.license_level }),
    ...(data.experience_years !== undefined && { experienceYears: data.experience_years }),
    // Physical info
    ...(data.strong_foot !== undefined && { strongFoot: data.strong_foot }),
    ...(data.height !== undefined && { height: data.height }),
    ...(data.weight !== undefined && { weight: data.weight }),
    ...(data.date_of_birth !== undefined && { dateOfBirth: data.date_of_birth }),
    // Social
    followersCount: data.followers_count ?? 0,
    followingCount: data.following_count ?? 0,
    // Évolution
    evolutionRole: data.evolution_role ?? null,
    // Les casquettes. `?? undefined` et non `?? false` : un compte d'avant
    // n'a pas de drapeau, et le predicat de `lib/hats` doit pouvoir se
    // rabattre sur `user_type` sans qu'un `false` explicite le contredise.
    ...(data.is_organizer !== undefined && { isOrganizer: data.is_organizer }),
    ...(data.is_venue_owner !== undefined && { isVenueOwner: data.is_venue_owner }),
    ...(data.is_scorer !== undefined && { isScorer: data.is_scorer }),
    ...(data.is_superadmin !== undefined && { isSuperAdmin: data.is_superadmin }),
    followedCompetitionIds: data.followed_competition_ids ?? [],
    // Un compte d'avant ce réglage n'a pas le champ, et son absence vaut
    // « tout accepté » — voir lib/push-categories.
    pushPrefs: data.push_prefs ?? {},
    organizerName: data.organizer_name ?? null,
    // Gallery
    galleryPhotos: data.gallery_photos ?? [],
    // Trophies
    trophies: data.trophies ?? [],
    // Competition roster lines validated as being this user
    linkedCompPlayers: data.linked_comp_players ?? [],
    condition: lireCondition(data.condition),
  };
}

export function buildFirestoreUser(
  data: SignupData,
  providers: AuthProvider[],
): Omit<FirestoreUser, "created_at" | "updated_at"> {
  // Build base object, never pass undefined to Firestore
  const base: Omit<FirestoreUser, "created_at" | "updated_at"> = {
    email: data.email ?? null,
    phone: data.phone ?? null,
    first_name: data.firstName,
    last_name: data.lastName,
    user_type: data.userType,
    location_city: data.locationCity ?? "",
    profile_picture_url: null,
    cover_photo_url: null,
    is_active: true,
    auth_providers: providers,
  };

  if (data.bio) base.bio = data.bio;
  // Le role choisi avant l'inscription, s'il y en a eu un.
  if (data.evolutionRole) base.evolution_role = data.evolutionRole;

  if (data.userType === "player") {
    if (data.position) base.position = data.position;
    if (data.skillLevel) base.skill_level = data.skillLevel;
  }
  if (data.userType === "manager") {
    if (data.teamName) base.team_name = data.teamName;
  }
  if (data.userType === "referee") {
    if (data.licenseNumber) base.license_number = data.licenseNumber;
    if (data.licenseLevel) base.license_level = data.licenseLevel;
    if (data.experienceYears != null) base.experience_years = data.experienceYears;
  }

  return base;
}
