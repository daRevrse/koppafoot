import { appeler } from "@/lib/reservations-client";

// ============================================
// L'arbitrage d'un amical, côté navigateur.
//
// Chaque geste passe par /api/matches/[mid]/arbitre : les champs de
// l'arbitre sur le match sont réservés au serveur, qui vérifie qui fait quoi
// et prévient l'autre partie (voir la route).
// ============================================

export type GesteArbitre =
  /** L'arbitre, sur un match sans arbitre. */
  | "postuler"
  /** L'arbitre revient sur sa candidature, avant la réponse du manager. */
  | "retirer"
  /** L'arbitre répond à une invitation. */
  | "accepter"
  | "decliner"
  /** L'arbitre confirmé ne pourra finalement pas venir. */
  | "desister"
  /** Un manager répond à une candidature. */
  | "valider"
  | "refuser"
  /** Un manager propose le match à un arbitre. */
  | "inviter"
  /** Un manager retire son invitation, ou l'arbitre confirmé. */
  | "annuler";

export const gesteArbitre = (matchId: string, action: GesteArbitre, arbitreId?: string) =>
  appeler<{ ok: true; statut: string }>(
    `/api/matches/${encodeURIComponent(matchId)}/arbitre`,
    "POST",
    arbitreId ? { action, arbitreId } : { action },
  );

/** Les niveaux de licence, tels qu'on les dit. */
export const NIVEAUX_LICENCE: Record<string, string> = {
  trainee: "Stagiaire",
  regional: "Régional",
  national: "National",
  international: "International",
};
