import { fr } from "@/i18n/fr";

// Supprimer son compte depuis l'application : la route du site
// (api/account/delete), qui fait tous les contrôles — le mot tapé, une
// connexion de moins d'une demi-heure, et rien qui appartienne à d'autres
// (une équipe gérée, une compétition organisée, un terrain). Ce module lit
// la réponse ; l'appel vit dans l'écran (app/supprimer-compte).

/** Le mot à taper, celui du site. */
export const MOT_DE_CONFIRMATION = fr["suppr.mot"];

export const confirmationValide = (saisie: string) => saisie.trim().toUpperCase() === MOT_DE_CONFIRMATION;

export type IssueSuppression =
  | { genre: "faite" }
  | { genre: "obstacles"; obstacles: string[] }
  | { genre: "reconnexion" }
  | { genre: "erreur"; message: string };

/** Ce que la route a répondu. */
export function issueDeLaSuppression(statut: number, data: unknown): IssueSuppression {
  const d = (data ?? {}) as { error?: unknown; obstacles?: unknown };
  if (statut >= 200 && statut < 300) return { genre: "faite" };
  if (statut === 409 && Array.isArray(d.obstacles)) {
    return { genre: "obstacles", obstacles: d.obstacles.filter((o): o is string => typeof o === "string") };
  }
  if (statut === 401 && d.error === "reauth") return { genre: "reconnexion" };
  return { genre: "erreur", message: typeof d.error === "string" ? d.error : fr["suppr.echouee"] };
}
