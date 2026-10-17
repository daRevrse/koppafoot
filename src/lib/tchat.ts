// ============================================
// Le tchat d'un match en direct, la partie pure.
//
// DÉCIDÉ AVEC LE PROPRIÉTAIRE DU PRODUIT (2026-10-17) :
//  - on lit sans compte, on écrit avec un compte : un nom responsable derrière
//    chaque message, et suspendre un compte suffit à faire taire un abus ;
//  - on n'écrit que pendant le direct ; au coup de sifflet final, l'onglet
//    reste en lecture seule — s'il y a quelque chose à relire ;
//  - le staff du match (organisateurs, modérateurs, scoreur, managers d'un
//    amical) et l'administration suppriment un message.
//
// Les messages vivent dans `match_chats/{mid}/messages` — `mid` est
// l'identifiant du match, de compétition ou amical, qui ne se croisent pas.
// Ils s'écrivent par /api/matches/[mid]/tchat seulement : le serveur signe,
// limite le débit, et refuse un compte suspendu.
//
// Aucun SDK ici : le navigateur, le serveur et la suite de tests partagée
// s'en servent.
// ============================================

/** La longueur d'un message, au plus : un tchat se lit en défilant, pas en dépliant. */
export const TCHAT_MAX = 280;

/** Un message toutes les cinq secondes par compte : de quoi réagir, pas de quoi inonder. */
export const TCHAT_DELAI_MS = 5_000;

/** Les messages qu'un onglet charge, les plus récents. */
export const TCHAT_DERNIERS = 100;

/** Le texte d'un message, nettoyé, ou `null` s'il est vide ou trop long. */
export function texteDuMessage(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  // Une ligne : les retours à la ligne et les espaces en série n'en font qu'un.
  const texte = brut.replace(/\s+/g, " ").trim();
  if (!texte || texte.length > TCHAT_MAX) return null;
  return texte;
}

/** On n'écrit que pendant le direct. */
export const tchatOuvert = (statut: string | null | undefined): boolean => statut === "live";

/**
 * L'onglet s'affiche pendant le direct, puis en lecture seule une fois le
 * match terminé, s'il y a quelque chose à relire. Avant le coup d'envoi, rien.
 */
export function ongletTchatVisible(statut: string | null | undefined, messages: number): boolean {
  if (tchatOuvert(statut)) return true;
  return statut === "completed" && messages > 0;
}

export interface MessageDuTchat {
  id: string;
  /** `null` quand le message a été supprimé : il reste à sa place, vidé. */
  texte: string | null;
  auteurUid: string;
  auteurNom: string;
  creeLeMs: number | null;
  supprime: boolean;
}

/** Un message tel que Firestore le range, relu sans lui faire confiance. */
export function lireMessage(id: string, brut: Record<string, unknown>): MessageDuTchat | null {
  if (typeof brut.auteur_uid !== "string" || !brut.auteur_uid) return null;
  const cree = brut.cree_le as { toMillis?: () => number } | null | undefined;
  const supprime = brut.supprime === true;
  return {
    id,
    texte: supprime || typeof brut.texte !== "string" ? null : brut.texte,
    auteurUid: brut.auteur_uid,
    auteurNom: typeof brut.auteur_nom === "string" && brut.auteur_nom ? brut.auteur_nom : "Un membre",
    creeLeMs: typeof cree?.toMillis === "function" ? cree.toMillis() : null,
    supprime,
  };
}

/** Il reste combien de millisecondes avant de pouvoir écrire, 0 si c'est permis. */
export function attenteAvantMessage(dernierMs: number | null, maintenantMs: number = Date.now()): number {
  if (dernierMs == null) return 0;
  return Math.max(0, dernierMs + TCHAT_DELAI_MS - maintenantMs);
}

/** Un message signalé, tel que la file de l'administration le montre. */
export interface SignalementDuTchat {
  mid: string;
  cid: string | null;
  messageId: string;
  /** La copie prise au signalement : le message a pu être vidé depuis. */
  texte: string;
  auteurUid: string;
  auteurNom: string;
  /** Combien de comptes l'ont signalé. */
  signalements: number;
  raisons: string[];
  le: string | null;
}
