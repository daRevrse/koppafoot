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
  profilePictureUrl: string | null;
  coverPhotoUrl: string | null;
  isActive: boolean;
  emailVerified: boolean;
  authProviders: AuthProvider[];
  createdAt: string;
  updatedAt: string;
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
  profile_picture_url: string | null;
  cover_photo_url: string | null;
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
