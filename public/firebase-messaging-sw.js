/* KoppaFoot — Firebase Cloud Messaging service worker.
 *
 * Required for FCM web push: getToken() looks for this file to obtain a
 * token, and background messages are displayed from here. Service workers
 * can't read process.env, so the (public) Firebase web config is inlined.
 */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCxCSdN4NBQYFZFEuMQlzfzXIWHKzKxNEU",
  authDomain: "koppafoot.firebaseapp.com",
  projectId: "koppafoot",
  storageBucket: "koppafoot.firebasestorage.app",
  messagingSenderId: "234916872903",
  appId: "1:234916872903:web:dc3f28da6140c699a874e2",
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
