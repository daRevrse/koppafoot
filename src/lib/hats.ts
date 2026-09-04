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
// LE REPLI SUR `user_type` A DISPARU. Il lisait `user_type === "organizer"`
// à côté du drapeau, le temps que les comptes approuvés avant la bascule
// reçoivent le leur. Ils l'ont reçu (voir scripts/migrate-user-type.ts
// --flags), et `user_type` ne porte plus que des rôles : il n'y a donc plus
// rien à y rattraper. Garder ce repli aurait laissé deux signaux à lire
// partout, c'est-à-dire la position dont on sortait.
// ============================================

type Hatted = Partial<
  Pick<UserProfile, "isOrganizer" | "isVenueOwner" | "isScorer" | "isSuperAdmin">
>;

/** Organise des compétitions. Le superadmin l'est d'office. */
export function isOrganizer(user: Hatted | null | undefined): boolean {
  if (!user) return false;
  return user.isOrganizer === true || isSuperAdmin(user);
}

/** Possède au moins un terrain référencé. */
export function isVenueOwner(user: Hatted | null | undefined): boolean {
  return user?.isVenueOwner === true;
}

/** Le superadmin, qui passe partout. */
export function isSuperAdmin(user: Hatted | null | undefined): boolean {
  return user?.isSuperAdmin === true;
}

/**
 * Scoreur valide : celui qui peut couvrir un amical qui n'est pas le sien.
 *
 * Elle est nee avec son drapeau, sans jamais passer par `user_type` — c'est
 * desormais le cas de toutes. Le superadmin l'est d'office, comme partout.
 */
export function isScorer(user: Hatted | null | undefined): boolean {
  if (!user) return false;
  return user.isScorer === true || isSuperAdmin(user);
}
