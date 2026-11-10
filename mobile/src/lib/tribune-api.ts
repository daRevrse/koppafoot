import type { User } from "firebase/auth";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { API_URL } from "~/lib/config";
import { app } from "~/lib/firebase";

// Ce que la Tribune demande au serveur du site, avec le jeton du compte :
// commenter (le serveur signe le commentaire, le compte et prévient l'auteur)
// et signaler (la file de modération ne s'écrit que par lui). Et la photo
// d'une publication, envoyée dans le même dossier Storage que le site.

async function appeler<T>(u: User, chemin: string, corps: unknown, parDefaut: string): Promise<T> {
  const rep = await fetch(`${API_URL}${chemin}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await u.getIdToken()}` },
    body: JSON.stringify(corps),
  });
  const data = (await rep.json().catch(() => ({}))) as T & { error?: string };
  if (!rep.ok) throw new Error(data.error ?? parDefaut);
  return data;
}

/**
 * Commenter une publication (POST /api/tribune/comments). Le nom renvoyé est
 * celui que le serveur a écrit : à afficher tel quel.
 */
export function commenter(u: User, postId: string, contenu: string): Promise<{ id: string; authorName: string }> {
  return appeler(u, "/api/tribune/comments", { postId, content: contenu }, "Ton commentaire n'est pas parti. Réessaie.");
}

/** Signaler une publication (POST /api/tribune/reports) ; `duplicate` : déjà signalée par ce compte. */
export function signaler(u: User, postId: string): Promise<{ duplicate?: boolean }> {
  return appeler(u, "/api/tribune/reports", { postId }, "Le signalement a échoué.");
}

/**
 * Envoie la photo d'une publication (posts/<id>/media/…, comme uploadPostMedia
 * du site) et rend son adresse. La règle Storage n'accepte qu'une image de
 * moins de 5 Mo.
 */
export async function envoyerLaPhoto(postId: string, photo: { uri: string; mimeType?: string | null }): Promise<string> {
  const type = photo.mimeType && photo.mimeType.startsWith("image/") ? photo.mimeType : "image/jpeg";
  const extension = type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const blob = await (await fetch(photo.uri)).blob();
  const fichier = ref(getStorage(app), `posts/${postId}/media/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`);
  await uploadBytes(fichier, blob, { contentType: type });
  return getDownloadURL(fichier);
}
