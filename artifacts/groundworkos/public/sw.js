// GroundworkOS service worker
//
// Scope: makes the app installable and lets the shell (JS/CSS/fonts, plus the
// last page a user had open) keep loading with a poor or absent signal on
// site — it does NOT cache API responses. Job, quote and invoice data must
// always come from the network when it's reachable; serving stale site data
// to a foreman is worse than a slow spinner. Bump CACHE_VERSION whenever the
// caching strategy below changes so old clients drop their cache cleanly.
const CACHE_VERSION = "gwos-shell-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [OFFLINE_URL, "/manifest.webmanifest", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GET requests. Everything else (API calls,
  // cross-origin requests, non-GET writes) passes straight through to the
  // network untouched.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Page navigations: try the network first (so users always get the latest
  // build and data-bearing routes), fall back to a cached copy of the same
  // page, then to the offline placeholder if nothing is cached yet.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(
          async () =>
            (await caches.match(request)) ||
            (await caches.match(OFFLINE_URL)),
        ),
    );
    return;
  }

  // Hashed build assets (JS/CSS/fonts/images under Vite's output) are safe
  // to cache aggressively: cache-first, falling back to network and storing
  // whatever comes back for next time.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
