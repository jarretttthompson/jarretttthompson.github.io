export function ensureCrtShell() {
  const body = document.body;
  if (!body) return;
  const first = body.firstElementChild;
  if (first && first.classList.contains("crt-shell")) return;

  const shell = document.createElement("div");
  shell.className = "crt-shell";
  while (body.firstChild) shell.appendChild(body.firstChild);
  body.appendChild(shell);
}

/** Bump when `partials/nav.html` changes so SW + browser caches don’t serve stale links. */
const NAV_PARTIAL_VER = "20260344";

export function injectNav() {
  const container = document.querySelector(".nav-boxes");
  if (!container) return;
  fetch(`partials/nav.html?v=${NAV_PARTIAL_VER}`)
    .then((r) => r.text())
    .then((html) => {
      container.outerHTML = html;
      const current = document.body.getAttribute("data-page");
      if (!current) return;
      document.querySelectorAll("nav a[data-page]").forEach((a) => {
        if (a.dataset.page === current) a.setAttribute("aria-current", "page");
      });
    })
    .catch(() => {});
}

export function setIdleWatchers() {
  const body = document.body;
  if (!body) return;
  const IDLE_TIMEOUT = 15000;
  let idleTimer = null;

  const resetIdle = () => {
    body.classList.remove("no-anim");
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => body.classList.add("no-anim"), IDLE_TIMEOUT);
  };

  ["mousemove", "keydown", "touchstart", "scroll", "click"].forEach((evt) =>
    window.addEventListener(evt, resetIdle, { passive: true }),
  );

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) body.classList.add("no-anim");
    else resetIdle();
  });
  resetIdle();
}


/** Sets `loading="lazy"` on embeds; do not strip `src` (empty iframes stay blank). */
export function lazyHydrateEmbeds() {
  const embeds = document.querySelectorAll(
    "iframe.youtube-embed, iframe.spotify-embed",
  );
  embeds.forEach((frame) => {
    if (frame.classList.contains("spotify-embed")) return;
    if (!frame.hasAttribute("loading")) frame.setAttribute("loading", "lazy");
  });
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!(location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
