// ============================================
// Retrouver la fiche d'un joueur sans compte depuis une feuille de match,
// pour montrer sa photo sur les pages publiques.
//
// Un joueur sans compte vit sur `teams/{club}/ghost_players/{id}`, et c'est
// là que son club range sa photo (voir `FirestoreGhostPlayer.photo_url`). Sa
// ligne de feuille de match le désigne de deux façons :
//
//   - dans un AMICAL, par l'identifiant de sa fiche, sous l'équipe du camp ;
//   - dans une COMPÉTITION, par `ghost_<id>` : l'effectif y est une copie de
//     celui du club (voir lib/club-import-server), rangée sous l'équipe de la
//     compétition, et c'est `claimedByTeamId` qui dit quel club elle
//     représente.
//
// La clé `<club>:<id>` est ce que /api/public/photos sait lire. Les deux
// identifiants sont vérifiés avant d'entrer dans un chemin Firestore : une
// clé reçue d'un navigateur ne doit pas pouvoir y glisser un `/`.
//
// Module pur : la route, les pages et les tests le partagent.
// ============================================

/** Le préfixe des lignes d'effectif de compétition copiées d'un joueur sans compte du club. */
export const PREFIXE_LIGNE_DU_CLUB = "ghost_";

/** La ligne d'effectif de compétition d'un joueur sans compte du club. */
export const ligneDuClub = (ghostId: string): string => `${PREFIXE_LIGNE_DU_CLUB}${ghostId}`;

const ID = /^[A-Za-z0-9_-]{1,128}$/;

/** La clé d'un joueur sans compte, ou null si l'un des identifiants est absent ou douteux. */
export function cleSansCompte(
  clubId: string | null | undefined,
  ghostId: string | null | undefined,
): string | null {
  if (!clubId || !ghostId || !ID.test(clubId) || !ID.test(ghostId)) return null;
  return `${clubId}:${ghostId}`;
}

/**
 * La clé d'une ligne de feuille de COMPÉTITION, si elle vient d'un joueur
 * sans compte du club que l'équipe représente. Une ligne tapée par
 * l'organisateur n'a pas de fiche derrière elle : null.
 */
export function cleDeLigneDeCompetition(
  clubId: string | null | undefined,
  playerId: string | null | undefined,
): string | null {
  if (!playerId?.startsWith(PREFIXE_LIGNE_DU_CLUB)) return null;
  return cleSansCompte(clubId, playerId.slice(PREFIXE_LIGNE_DU_CLUB.length));
}

/** Une clé reçue par la route, relue ; null si elle n'est pas bien formée. */
export function lireCleSansCompte(cle: string): { clubId: string; ghostId: string } | null {
  const morceaux = cle.split(":");
  if (morceaux.length !== 2) return null;
  const [clubId, ghostId] = morceaux;
  return cleSansCompte(clubId, ghostId) ? { clubId, ghostId } : null;
}
