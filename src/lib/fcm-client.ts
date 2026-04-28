import { getToken, onMessage } from "firebase/messaging";
import { getClientMessaging } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY ?? "";

export async function requestPushPermission(userId: string): Promise<void> {
  const messaging = getClientMessaging();
  if (!messaging || !VAPID_KEY) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const token = await getToken(messaging, { vapidKey: VAPID_KEY }).catch(() => null);
  if (!token) return;

  await updateDoc(doc(db, "users", userId), {
    fcm_tokens: arrayUnion(token),
  });
}

export function onForegroundMessage(
  callback: (payload: { title: string; body: string }) => void
): () => void {
  const messaging = getClientMessaging();
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? "KoppaFoot";
    const body = payload.notification?.body ?? "";
    callback({ title, body });
  });
}
