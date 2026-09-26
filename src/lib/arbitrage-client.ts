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
  | "annuler"
  /** L'arbitre confirmé choisit son équipe pour ce match (voir `composerEquipe`). */
  | "composer";

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

/** L'arbitre confirmé emmène ses assistants et son scoreur, pris dans son corps arbitral. */
export const composerEquipe = (matchId: string, assistants: string[], scoreur: string | null) =>
  appeler<{ ok: true }>(
    `/api/matches/${encodeURIComponent(matchId)}/arbitre`,
    "POST",
    { action: "composer", assistants, scoreur },
  );

// ============================================
// Le corps arbitral (voir /api/corps-arbitral)
// ============================================

export type GesteCorps =
  | { action: "creer"; nom: string }
  | { action: "renommer"; corpsId: string; nom: string }
  | { action: "inviter"; corpsId: string; uid: string; role: "arbitre" | "scoreur" }
  | { action: "annulerInvitation"; corpsId: string; uid: string }
  | { action: "repondre"; corpsId: string; accepte: boolean }
  | { action: "retirer"; corpsId: string; uid: string }
  | { action: "quitter"; corpsId: string }
  | { action: "dissoudre"; corpsId: string };

export const gesteCorps = (g: GesteCorps) =>
  appeler<{ ok: true; id?: string }>("/api/corps-arbitral", "POST", g);

/** Ce qu'on fait dans un corps, tel qu'on le dit. */
export const ROLE_DANS_LE_CORPS: Record<"arbitre" | "scoreur", string> = {
  arbitre: "Arbitre assistant",
  scoreur: "Scoreur",
};
