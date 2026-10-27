import type { User } from "firebase/auth";
import { API_URL } from "~/lib/config";

// Les gestes de l'Espace casquette : les routes du site, avec le jeton du
// compte. Le serveur fait le reste (droits, notifications, frais de
// réservation) ; l'écran se met à jour par les écouteurs Firestore.

async function appeler(u: User, chemin: string, methode: "POST" | "PATCH", corps: unknown, parDefaut: string) {
  const rep = await fetch(`${API_URL}${chemin}`, {
    method: methode,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await u.getIdToken()}` },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  if (rep.ok) return;
  // La route dit pourquoi (« Ce match a déjà un scoreur. ») : c'est ce qu'on montre.
  const data = (await rep.json().catch(() => ({}))) as { error?: string };
  throw new Error(data.error ?? parDefaut);
}

/** « Je couvre » : un scoreur prend un amical que personne ne couvre (POST /api/matches/[mid]/couvrir). */
export function couvrirAmical(u: User, mid: string): Promise<void> {
  return appeler(u, `/api/matches/${encodeURIComponent(mid)}/couvrir`, "POST", undefined, "Impossible de prendre ce match.");
}

/** Le propriétaire répond à une demande de créneau (PATCH /api/bookings/[id]). */
export function repondreALaDemande(u: User, id: string, action: "confirmer" | "refuser"): Promise<void> {
  return appeler(u, `/api/bookings/${encodeURIComponent(id)}`, "PATCH", { action }, "La réponse n'a pas été enregistrée.");
}
