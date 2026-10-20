import { appeler } from "@/lib/reservations-client";
import type { Position } from "@/lib/carte";

// ============================================
// Les gestes du propriétaire sur ses terrains, vus du navigateur.
//
// Deux choses que les règles Firestore ne permettent pas, et c'est voulu :
// les coordonnées montrées aux équipes vivent hors de la fiche publique, et
// retirer un terrain doit prévenir les équipes qui attendaient une réponse.
// Les deux passent donc par le serveur.
// ============================================

/** Ce que le responsable montre à qui touche « Contacter le responsable ». */
export interface ReglageContact {
  /** Le numéro propre au terrain, `null` : celui du compte. */
  telephone: string | null;
  emailVisible: boolean;
  telephoneCompte: string | null;
  emailCompte: string | null;
}

export async function lireReglageContact(venueId: string): Promise<ReglageContact | null> {
  const r = await appeler<{ reglage?: ReglageContact }>(`/api/venues/${encodeURIComponent(venueId)}/contact`, "GET");
  return r.reglage ?? null;
}

export const reglerContact = (venueId: string, d: { telephone: string; emailVisible: boolean }) =>
  appeler<{ ok: boolean }>(`/api/venues/${encodeURIComponent(venueId)}/contact`, "PUT", d);

/** Ce que le retrait d'un terrain touchera, avant de le confirmer. */
export const apercuRetrait = (venueId: string) =>
  appeler<{ enAttente: number; confirmees: number }>(`/api/venues/${encodeURIComponent(venueId)}`, "GET");

/**
 * Retirer un terrain : les demandes en attente sont closes et leurs équipes
 * prévenues, les blocages à venir levés. Les créneaux confirmés restent.
 */
export const retirerTerrain = (venueId: string) =>
  appeler<{ closes: number; confirmees: number }>(`/api/venues/${encodeURIComponent(venueId)}`, "DELETE");

/**
 * Le point d'un lien Google Maps. Le serveur suit les liens courts du bouton
 * « Partager », qu'un navigateur ne peut pas suivre (voir /api/venues/position).
 */
export const positionDuLien = (lien: string) =>
  appeler<{ position: Position }>("/api/venues/position", "POST", { lien }).then((r) => r.position);
