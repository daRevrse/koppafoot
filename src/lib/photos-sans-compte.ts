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

/**
 * Le visage d'une ligne d'effectif de COMPÉTITION, par ordre de préférence :
 *
 *   1. le compte qui la porte : la photo de son profil, ou aucune — c'est lui
 *      qui choisit, pas l'organisateur ;
 *   2. la photo posée sur la ligne par l'organisateur ou le manager ;
 *   3. celle de sa fiche dans le club, pour une ligne copiée de l'effectif du
 *      club (`ghost_<id>`).
 */
export function photoDeLaLigne(
  ligne: { id: string; user_id?: string | null; photo_url?: string | null },
  clubId: string | null | undefined,
  photosDesComptes: Record<string, string | null | undefined>,
  photosSansCompte: Record<string, string | null | undefined>,
): string | null {
  if (ligne.user_id) return photosDesComptes[ligne.user_id] || null;
  if (ligne.photo_url) return ligne.photo_url;
  const cle = cleDeLigneDeCompetition(clubId, ligne.id);
  return (cle && photosSansCompte[cle]) || null;
}

/**
 * Le chemin Storage derrière une adresse de téléchargement Firebase
 * (`…/o/<chemin encodé>?alt=media…`), ou null pour une autre adresse.
 */
export function cheminDeLAdresse(url: string | null | undefined): string | null {
  const m = /\/o\/([^?#]+)/.exec(url ?? "");
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

/**
 * Cette photo de ligne est-elle rangée chez CETTE compétition ? Une édition
 * dupliquée reprend les lignes de la précédente, photos comprises, et donc
 * leurs fichiers : la retirer de la nouvelle ne doit pas les effacer de
 * l'ancienne.
 */
export function photoDeLaCompetition(cid: string, url: string | null | undefined): boolean {
  return cheminDeLAdresse(url)?.startsWith(`competitions/${cid}/joueurs/`) ?? false;
}
