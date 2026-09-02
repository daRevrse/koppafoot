import type { UserProfile } from "@/types";

// ============================================
// Les casquettes : ce qu'un compte FAIT, par opposition à ce qu'il EST.
//
// Le rôle Evolution, joueur, manager, arbitre, dit ce qu'on est sur le
// terrain, et on n'en a qu'un. Les casquettes se cumulent : le même compte
// peut être arbitre, organiser une compétition et posséder un terrain.
//
// Pourquoi ce module existe plutôt qu'un simple `user.userType === ...`
// écrit à quatorze endroits : `user_type` ne porte qu'UNE valeur. Approuver
// une candidature d'organisateur écrasait donc le type de compte, et un
// organisateur qui joue tombait hors de tout ce qui filtre sur les joueurs,
// ses informations physiques, ses équipes, sa présence dans la recherche.
// La correction est un drapeau à côté, sur le modèle de `is_superadmin`.
//
// Les deux signaux sont lus, et c'est délibéré : les comptes créés avant ce
// changement n'ont pas de drapeau, seulement un `user_type` hérité. Les
// oublier aurait déconnecté du jour au lendemain tous les organisateurs
// existants.
// ============================================

type Hatted = Pick<UserProfile, "userType"> &
  Partial<Pick<UserProfile, "isOrganizer" | "isVenueOwner" | "isScorer">>;

/** Organise des compétitions. Le superadmin l'est d'office. */
export function isOrganizer(user: Hatted | null | undefined): boolean {
  if (!user) return false;
  return user.isOrganizer === true
    || user.userType === "organizer"
    || user.userType === "superadmin";
}

/** Possède au moins un terrain référencé. */
export function isVenueOwner(user: Hatted | null | undefined): boolean {
  if (!user) return false;
  return user.isVenueOwner === true || user.userType === "venue_owner";
}

/** Le superadmin, qui passe partout. */
export function isSuperAdmin(user: Hatted | null | undefined): boolean {
  return user?.userType === "superadmin";
}

/**
 * Scoreur valide : celui qui peut couvrir un amical qui n'est pas le sien.
 *
 * Pas de `user_type` herite a rattraper ici, contrairement aux autres
 * casquettes : celle-ci nait avec son drapeau, elle n'a jamais eu d'autre
 * forme. Le superadmin l'est d'office, comme partout.
 */
export function isScorer(user: Hatted | null | undefined): boolean {
  if (!user) return false;
  return user.isScorer === true || isSuperAdmin(user);
}
