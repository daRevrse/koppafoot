import { auth } from "@/lib/firebase";
import type { PropositionCreneau } from "@/types";

// ============================================
// Les gestes de réservation, vus du navigateur.
//
// Tous passent par le serveur (voir lib/reservations-server) : une demande
// qui naît confirmée, un blocage, le match qu'on met à jour quand le
// propriétaire répond — rien de tout ça n'est permis par les règles Firestore,
// et c'est voulu. Ici, rien d'autre qu'un appel authentifié et une erreur
// lisible quand il échoue.
// ============================================

async function appeler<T>(url: string, method: "POST" | "PATCH", corps: unknown): Promise<T> {
  const utilisateur = auth.currentUser;
  if (!utilisateur) throw new Error("Connecte-toi pour continuer.");
  const token = await utilisateur.getIdToken();
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(corps),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "L'opération a échoué.");
  return data as T;
}

/** Une équipe demande un créneau depuis la fiche du terrain. */
export const demanderCreneau = (d: {
  venueId: string; date: string; time: string; duration: number; telephone: string; message: string;
}) => appeler<{ id: string }>("/api/bookings", "POST", d);

/** Le propriétaire bloque un créneau pris hors de la plateforme. */
export const bloquerCreneau = (d: {
  venueId: string; date: string; time: string; duration: number; note: string;
}) => appeler<{ id: string }>("/api/bookings", "POST", { ...d, blocage: true });

export type ActionReservation = "confirmer" | "refuser" | "annuler" | "prendre-proposition";

/** Répondre à une demande, l'annuler, ou prendre le créneau proposé. */
export const agirSurReservation = (
  id: string,
  action: ActionReservation,
  proposition?: PropositionCreneau | null,
) => appeler<{ ok?: boolean; id?: string; status?: string }>(`/api/bookings/${id}`, "PATCH", { action, proposition });

/**
 * Aligner la réservation du terrain sur le match, après un geste sur lui.
 *
 * Ne lève jamais : le geste sur le match est fait, et un écart se rattrape au
 * suivant. Rend le message d'erreur pour que la page puisse le dire.
 */
export async function synchroniserTerrain(matchId: string): Promise<string | null> {
  try {
    await appeler(`/api/matches/${matchId}/terrain`, "POST", {});
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "La demande au terrain n'est pas partie.";
  }
}

/**
 * La même chose pour des matchs de compétition, en une fois : un calendrier
 * importé ou programmé d'un coup n'envoie qu'un email par propriétaire.
 *
 * Ne lève jamais non plus.
 */
export async function synchroniserTerrainsCompetition(cid: string, mids: string[]): Promise<string | null> {
  const PAR_APPEL = 100;
  try {
    let echecs = 0;
    for (let i = 0; i < mids.length; i += PAR_APPEL) {
      const r = await appeler<{ echecs?: number }>(`/api/competitions/${cid}/terrain`, "POST", {
        mids: mids.slice(i, i + PAR_APPEL),
      });
      echecs += r.echecs ?? 0;
    }
    if (echecs === 0) return null;
    return echecs === 1
      ? "La demande d'un match au terrain n'est pas partie."
      : `Les demandes de ${echecs} matchs au terrain ne sont pas parties.`;
  } catch (err) {
    return err instanceof Error ? err.message : "La demande au terrain n'est pas partie.";
  }
}
