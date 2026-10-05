import { auth } from "@/lib/firebase";
import { ErreurLimiteOffre, estLimiteAtteinte } from "@/lib/offre";

/**
 * Une création qui passe par le serveur parce que l'offre la limite
 * (équipe, terrain, compétition, équipes d'une compétition).
 *
 * Un refus pour limite devient une `ErreurLimiteOffre`, que l'écran reconnaît
 * pour dire quoi et proposer l'offre (voir components/offre/LimiteOffre) ;
 * toute autre erreur garde le message du serveur.
 */
export async function envoyerCreation<T>(url: string, corps: unknown): Promise<T> {
  const utilisateur = auth.currentUser;
  if (!utilisateur) throw new Error("Connecte-toi pour continuer.");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await utilisateur.getIdToken()}` },
    body: JSON.stringify(corps),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    if (estLimiteAtteinte(data)) throw new ErreurLimiteOffre(data.error ?? "", data.cle, data.max);
    throw new Error(data.error ?? "La création a échoué.");
  }
  return data as T;
}

/** Une création, qui rend l'identifiant du document créé. */
export async function creerParLeServeur(url: string, corps: unknown): Promise<string> {
  const { id } = await envoyerCreation<{ id?: string }>(url, corps);
  if (!id) throw new Error("La création a échoué.");
  return id;
}
