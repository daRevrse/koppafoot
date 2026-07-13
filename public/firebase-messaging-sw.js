/* KoppaFoot — Firebase Cloud Messaging service worker.
 *
 * Required for FCM web push: getToken() looks for this file to obtain a
 * token, and background messages are displayed from here.
 *
 * The Firebase web config is passed as query params when the client
 * registers this worker (see requestPushPermission), so nothing is
 * hardcoded here — the registration URL persists, so params survive the
 * worker being woken for a background push.
 */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

const params = new URLSearchParams(self.location.search);

firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  storageBucket: params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});

const messaging = firebase.messaging();

// Background messages (tab closed / not focused).
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "KoppaFoot";
  const link = payload.fcmOptions?.link || (payload.data && payload.data.link) || "/";
  self.registration.showNotification(title, {
    body: payload.notification?.body || "",
    icon: "/branding/logo_symbol.png",
    badge: "/branding/logo_symbol.png",
    vibrate: [100, 50, 100],
    data: { url: link },
  });
});

// Focus an existing tab (or open one) on notification click.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
