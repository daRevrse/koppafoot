import { getMessaging } from "firebase-admin/messaging";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import adminApp from "@/lib/firebase-admin";

export async function sendPushToUser(
  userId: string,
  notification: { title: string; body: string; link?: string }
): Promise<void> {
  const userSnap = await adminDb.collection("users").doc(userId).get();
  const tokens: string[] = userSnap.data()?.fcm_tokens ?? [];
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
