import { getMessaging } from "firebase-admin/messaging";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import adminApp from "@/lib/firebase-admin";
import { pushAutorise, type PushCategory, type PushPrefs } from "@/lib/push-categories";

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

  if (!pushAutorise(data?.push_prefs as PushPrefs | undefined, notification.category)) return;

  const tokens: string[] = data?.fcm_tokens ?? [];
  if (!tokens.length) return;

  const messaging = getMessaging(adminApp);
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: notification.title, body: notification.body },
    webpush: notification.link
      ? { fcmOptions: { link: notification.link } }
      : undefined,
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
