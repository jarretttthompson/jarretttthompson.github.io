// Pages, lists, styles and scripts are always asked for fresh (the saved copy is only an offline
// fallback), so a publish can never leave a visitor with a new page and an old stylesheet or image
// index. Only pictures, fonts and video are served from the saved copy first.
// Bump CACHE_NAME on every publish so the saved pictures are refreshed too.
const CACHE_NAME = "site-cache-v20261002g";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/projects.html",
  "/css/tailwind-built.css",
  "/css/terminal-site.css?v=20260915",
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
  // Take over from the previous worker straight away instead of waiting for every tab to close.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {}),
  );
});

// Workers before this version served saved pages first, so a page opened under one of them can be
// a stale mix of old and new files. Taking over from one reloads the open pages once.
const FRESH_FIRST_SINCE = "site-cache-v20261002d";

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      const old = keys.filter((key) => key !== CACHE_NAME);
      await Promise.all(old.map((key) => caches.delete(key)));
      await self.clients.claim();
      if (old.some((key) => key.startsWith("site-cache-v") && key < FRESH_FIRST_SINCE)) {
        const pages = await self.clients.matchAll({ type: "window" });
        await Promise.all(pages.map((page) => page.navigate(page.url).catch(() => {})));
      }
    }),
  );
});

const SAVED_FIRST = /\.(avif|webp|jpe?g|png|gif|svg|ico|woff2?|ttf|otf|mp4|webm|mov)$/i;

function save(req, response) {
  if (!response || response.status !== 200 || response.type !== "basic") return response;
  const clone = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
  return response;
}

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

  if (SAVED_FIRST.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((response) => save(req, response))),
    );
    return;
  }

  // "no-cache" makes the browser check with the server even when its own copy still looks fresh.
  event.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((response) => save(req, response))
      .catch(() => caches.match(req).then((cached) => cached || Response.error())),
  );
});
