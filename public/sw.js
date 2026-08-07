// KoppaFoot — Service Worker
// Handles: install, activate, push notifications, notification clicks

// Bump this whenever the caching rules change: the activate handler deletes
// every cache whose key differs, which is how bad entries from a previous
// policy get evicted from users who already have the worker installed.
// v1 cached HTML documents, v2 cached RSC payloads — both had to go.
const CACHE_NAME = "koppafoot-v3";

// Minimal shell to cache for offline fallback
const PRECACHE_URLS = ["/branding/logo_symbol.png", "/branding/logo_full_name.png"];

// ─── Install ────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch (static assets only, network-first) ──────────────
//
// Three rules, each learned the hard way:
//
// 1. Never touch cross-origin traffic. The previous version intercepted
//    EVERY GET — the same-origin test only limited *caching*, not
//    interception. Firebase Auth, reCAPTCHA and the Google APIs went
//    through this handler, which is a good way to break phone sign-in.
//
// 2. Never serve HTML from cache. A stale document hydrating against
//    freshly deployed JS chunks is a guaranteed React hydration mismatch
//    (error #418), and the cache key never changed between deploys.
//
// 3. Never resolve to undefined. `caches.match()` gives undefined on a
//    miss, and respondWith(undefined) throws "Failed to convert value to
//    'Response'" — turning a slow network into a hard page failure.
//
// 4. Only static assets. Anything else — documents, RSC payloads, API
//    calls — is data: caching it serves stale content, and failing it
//    turns a slow network into a broken page. Next.js fetches RSC
//    payloads from the page's own URL with an empty `destination`, which
//    is how /login ended up answering 504 from the cache layer.
const CACHEABLE_DESTINATIONS = new Set(["image", "style", "script", "font"]);

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return; // Not a URL we can reason about — leave it to the browser.
  }

  // (1) cross-origin, (2) navigations, (4) anything that is not an asset.
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate" || request.destination === "document") return;
  if (!CACHEABLE_DESTINATIONS.has(request.destination)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only store complete, successful, same-origin responses. Opaque and
        // partial (206) responses are not usable from the cache.
        if (response && response.ok && response.type === "basic") {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, clone))
            .catch(() => {}); // A full disk must not break the request.
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        // (3) Always a Response, never undefined.
        return (
          cached ??
          new Response("", { status: 504, statusText: "Gateway Timeout" })
        );
      })
  );
});

// ─── Push Notifications ─────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "KoppaFoot", body: event.data.text() };
  }

  const options = {
    body: data.body || "",
    icon: data.icon || "/branding/logo_symbol.png",
    badge: "/branding/logo_symbol.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/dashboard",
      dateOfArrival: Date.now(),
    },
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(data.title || "KoppaFoot", options));
});

// ─── Notification Click ─────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus existing window if available
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Otherwise open a new window
        return self.clients.openWindow(targetUrl);
      })
  );
});
