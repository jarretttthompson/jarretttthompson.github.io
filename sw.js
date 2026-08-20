// Bump CACHE_NAME and the ?v= strings below together whenever assets change.
// Nav partial is safe to precache now that injectNav() fetches it with ?v= (versioned URL = no stale-link risk).
const CACHE_NAME = "site-cache-v20260820b";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/projects.html",
  "/css/tailwind-built.css",
  "/css/terminal-site.css?v=20260731",
  "/css/site-tune-overrides.css?v=20260381",
  "/js/main.js",
  // JS modules — precached so repeat visits don't need a network round-trip for each import
  "/js/modules/core.js?v=20260731",
  "/js/modules/home.js?v=20260344",
  "/js/modules/artwork.js?v=20260344",
  "/js/modules/photo-album.js?v=20260344",
  "/js/modules/projects.js?v=20260344",
  "/js/modules/media.js?v=20260344",
  // Nav partial — versioned, so safe to precache (eliminates "Loading navigation…" flash on repeat visits)
  "/partials/nav.html?v=20260344",
  "/slides.optimized.json",
  "/optimized/variants.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache site-tuner endpoints or state files — always fetch fresh
  if (
    url.pathname.startsWith("/__site_tune/") ||
    url.pathname.startsWith("/css/tune-state/")
  ) {
    event.respondWith(fetch(req));
    return;
  }

  const isLocalhost =
    self.location.hostname === "localhost" ||
    self.location.hostname === "127.0.0.1";

  if (isLocalhost) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        return response;
      });
    }),
  );
});
