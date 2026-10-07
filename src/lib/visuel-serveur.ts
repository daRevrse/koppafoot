import { randomUUID } from "node:crypto";
import { adminStorage } from "@/lib/firebase-admin";

// ============================================
// Un visuel (logo, bannière) envoyé par l'administration ou par un club, et
// rangé dans Storage par le serveur.
//
// Par le SDK admin, et pas par le navigateur : une règle Storage ne sait pas
// vérifier qu'on est l'administrateur, ni le propriétaire d'un club. Le
// navigateur envoie l'image en base64 dans sa requête ; on la range sous un
// préfixe qui lui est propre, avec un jeton de téléchargement, et on rend
// l'adresse publique à recopier dans le document.
// ============================================

export const POIDS_MAX_VISUEL = 2 * 1024 * 1024;

/** Ce que le navigateur envoie : le contenu en base64, sans `data:…;base64,`. */
export interface VisuelEnvoye {
  data?: string;
  contentType?: string;
}

/**
 * Range le visuel sous `prefixe` (« partenaires/<id>/ », « clubs/<id>/logo- »)
 * et rend son adresse, ou `{ erreur }`. `remplacer` : le préfixe à vider
 * d'abord, pour qu'un ancien visuel ne traîne pas.
 */
export async function stockerVisuel(
  prefixe: string,
  image: VisuelEnvoye,
  remplacer?: string,
): Promise<string | { erreur: string }> {
  if (!image.data || !image.contentType?.startsWith("image/")) return { erreur: "Le visuel doit être une image." };
  const contenu = Buffer.from(image.data, "base64");
  if (contenu.length > POIDS_MAX_VISUEL) return { erreur: "Visuel trop lourd (2 Mo au plus)." };
  const ext = image.contentType.split("/")[1]?.replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "") || "png";
  const chemin = `${prefixe}${randomUUID().slice(0, 8)}.${ext}`;
  const jeton = randomUUID();
  const bucket = adminStorage.bucket();
  if (remplacer) await bucket.deleteFiles({ prefix: remplacer }).catch(() => {});
  await bucket.file(chemin).save(contenu, {
    contentType: image.contentType,
    metadata: { metadata: { firebaseStorageDownloadTokens: jeton } },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(chemin)}?alt=media&token=${jeton}`;
}

/** Vide un préfixe de Storage ; une erreur ne bloque rien. */
export async function effacerVisuels(prefixe: string): Promise<void> {
  await adminStorage.bucket().deleteFiles({ prefix: prefixe }).catch(() => {});
}

/**
 * Le dossier de la photo d'un joueur sans compte. Un seul fichier y vit à la
 * fois (voir /api/teams/[id]/ghost-players/[gid]/photo) ; le vider suffit à
 * l'effacer, à sa suppression comme à sa fusion avec un compte.
 */
export function dossierPhotoSansCompte(teamId: string, ghostId: string): string {
  return `teams/${teamId}/ghost_players/${ghostId}/`;
}
