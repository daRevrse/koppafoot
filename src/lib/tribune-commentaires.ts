// ============================================
// Commenter dans la Tribune : ce qui se décide sans réseau.
//
// Le commentaire passe désormais par le serveur (/api/tribune/comments), pour
// deux raisons. Il faut prévenir l'auteur de la publication, et un navigateur
// ne peut pas écrire la notification d'un autre compte. Et le serveur signe le
// commentaire lui-même : les règles laissaient n'importe quel compte en écrire
// un sous le nom de son choix.
//
// Module pur : la route s'en sert, et la suite de tests le relit.
// ============================================

/** Au-delà, ce n'est plus un commentaire, c'est une publication. */
export const COMMENTAIRE_MAX = 1000;

/**
 * Le téléphone de l'auteur sonne au plus une fois par publication dans cette
 * fenêtre. Une photo qui part bien reçoit dix commentaires en cinq minutes :
 * dix vibrations, c'est la meilleure façon de faire couper la catégorie. La
 * cloche, elle, les garde tous.
 */
export const PAUSE_PUSH_COMMENTAIRES_MS = 10 * 60 * 1000;

/** Le texte à publier, ou `null` s'il n'y a rien (ou trop). */
export function texteDuCommentaire(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const texte = brut.trim();
  if (!texte || texte.length > COMMENTAIRE_MAX) return null;
  return texte;
}

/** Ce que Firestore range d'un compte, pour le nommer. */
export interface CompteNomme {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  is_venue_owner?: boolean | null;
}

/**
 * Le nom d'un compte tel que la Tribune l'écrit, le même que pour une
 * publication (feed/page) : le prénom et l'initiale du nom, ou le nom de
 * l'établissement pour un gérant de terrain qui en a donné un.
 */
export function nomDansLaTribune(u: CompteNomme): string {
  const entreprise = u.company_name?.trim();
  if (u.is_venue_owner === true && entreprise) return entreprise;
  const initiale = u.last_name?.trim().charAt(0);
  const nom = [u.first_name?.trim(), initiale ? `${initiale}.` : null].filter(Boolean).join(" ");
  return nom || "Un membre";
}

/**
 * Le téléphone sonne-t-il pour ce commentaire-ci ? Oui pour le premier, puis
 * pas avant la fin de la pause.
 */
export function sonnerPourCeCommentaire(dernierPush: number | null, maintenant: number): boolean {
  return dernierPush == null || maintenant - dernierPush >= PAUSE_PUSH_COMMENTAIRES_MS;
}

/** La notification envoyée à l'auteur de la publication. */
export function notificationDeCommentaire(nom: string, texte: string, postId: string): {
  title: string; body: string; link: string;
} {
  const ligne = texte.replace(/\s+/g, " ");
  const extrait = ligne.length > 120 ? `${ligne.slice(0, 119).trimEnd()}…` : ligne;
  return {
    title: `${nom} a commenté ta publication`,
    body: `«\u00a0${extrait}\u00a0»`,
    link: `/feed?post=${encodeURIComponent(postId)}&commentaires=1`,
  };
}
