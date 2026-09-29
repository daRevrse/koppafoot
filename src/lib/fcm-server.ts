import { getMessaging } from "firebase-admin/messaging";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import adminApp from "@/lib/firebase-admin";
import { pushAutorise, type PushCategory, type PushPrefs } from "@/lib/push-categories";

export { lienInterne } from "@/lib/push-categories";

// ============================================
// L'envoi, et le filtre qui le précède.
//
// LE FILTRE EST ICI, au dernier moment, et pas chez les appelants. Ils sont
// six à pousser des notifications, dans des contextes qui n'ont rien à voir :
// répartir le contrôle entre eux garantissait qu'un septième l'oublie, et
// qu'une case décochée laisse passer les messages sans que personne ne
// comprenne pourquoi.
//
// Une catégorie absente passe : voir lib/push-categories, un réglage ne doit
// jamais faire taire plus que ce qui a été explicitement décoché.
// ============================================

export async function sendPushToUser(
  userId: string,
  notification: { title: string; body: string; link?: string; category?: PushCategory }
): Promise<void> {
  const userSnap = await adminDb.collection("users").doc(userId).get();
  const data = userSnap.data();

  // Un compte suspendu ne se connecte plus : son téléphone n'a plus à sonner.
  if (data?.is_active === false) return;
  if (!pushAutorise(data?.push_prefs as PushPrefs | undefined, notification.category)) return;

  const tokens: string[] = data?.fcm_tokens ?? [];
  if (!tokens.length) return;

  const messaging = getMessaging(adminApp);
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: notification.title, body: notification.body },
    // Le lien voyage aussi en données : c'est là que l'application le lit au
    // toucher (mobile/src/lib/push). Le site, lui, le prend dans `fcmOptions`.
    data: notification.link ? { link: notification.link } : undefined,
    webpush: notification.link
      ? { fcmOptions: { link: notification.link } }
      : undefined,
    // L'application Android crée ce canal ; sans lui, une notification tombe
    // dans le canal « Divers » du système, silencieux par défaut.
    android: { priority: "high", notification: { channelId: "koppafoot" } },
  });

  const invalidTokens = response.responses
    .map((r, i) => (r.error ? tokens[i] : null))
    .filter(Boolean) as string[];

  if (invalidTokens.length) {
    await adminDb.collection("users").doc(userId).update({
      fcm_tokens: FieldValue.arrayRemove(...invalidTokens),
    });
  }
}

/**
 * Le même push à plusieurs comptes, chacun UNE fois.
 *
 * Les listes d'abonnés se recoupent : quelqu'un qui suit la compétition ET le
 * match était sur les deux, et recevait chaque but deux fois. On dédoublonne
 * ici, pas chez l'appelant.
 */
export async function sendPushToUsers(
  userIds: Iterable<string>,
  notification: { title: string; body: string; link?: string; category?: PushCategory },
): Promise<{ destinataires: number; envoyes: number }> {
  const uniques = [...new Set([...userIds].filter(Boolean))];
  const sorts = await Promise.allSettled(uniques.map((uid) => sendPushToUser(uid, notification)));
  return { destinataires: uniques.length, envoyes: sorts.filter((s) => s.status === "fulfilled").length };
}
