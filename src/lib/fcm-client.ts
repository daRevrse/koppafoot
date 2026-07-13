import { getToken, onMessage } from "firebase/messaging";
import { getClientMessaging } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY ?? "";

export async function requestPushPermission(userId: string): Promise<void> {
  const messaging = getClientMessaging();
  if (!messaging || !VAPID_KEY) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  // FCM needs its own service worker to mint a token and to render
  // background messages. Register it explicitly and hand it to getToken so
  // it never falls back to a missing default file.
  // Register at a dedicated scope so it coexists with the PWA sw.js (scope
  // "/") instead of replacing it.
  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/firebase-cloud-messaging-push-scope",
    });
  } catch (err) {
    console.warn("[FCM] SW registration failed:", err);
    return;
  }

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  }).catch((err) => {
    console.warn("[FCM] getToken failed:", err);
    return null;
  });
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
