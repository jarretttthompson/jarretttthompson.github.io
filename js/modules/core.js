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

export function injectNav() {
  const container = document.querySelector(".nav-boxes");
  if (!container) return;
  fetch("partials/nav.html")
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

export function startHeaderFlicker() {
  const h1 = document.getElementById("lightbulb");
  if (!h1) return;

  // Terminal site uses a fixed HUD title — skip legacy CRT cyan flicker.
  if (document.body?.hasAttribute("data-terminal-site")) {
    return;
  }

  // Respect reduced motion and idle mode.
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const transitionMs = 420;
  h1.style.willChange = "opacity, transform, text-shadow";
  h1.style.transition = `opacity ${transitionMs}ms ease, transform ${transitionMs}ms ease, text-shadow ${transitionMs}ms ease`;

  const randomFlicker = () => {
    // Subtle, smooth “CRT breathing” instead of harsh jitter.
    const opacity = Math.random() > 0.94 ? 0.82 : 1;
    const blur = Math.floor(Math.random() * 10) + 8; // ~8..18px
    const x = (Math.random() - 0.5) * 1.0; // -0.5..0.5px
    const y = (Math.random() - 0.5) * 1.0; // -0.5..0.5px

    requestAnimationFrame(() => {
      h1.style.opacity = opacity;
      h1.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;

      const glow1 = Math.round(blur);
      const glow2 = Math.round(blur * 1.75);
      h1.style.textShadow = `0 0 ${glow1}px #0ff, 0 0 ${glow2}px #fff`;
    });
  };

  const schedule = () => {
    setTimeout(() => {
      if (document.body && document.body.classList.contains("no-anim")) {
        schedule();
        return;
      }
      randomFlicker();
      schedule();
    }, 260);
  };
  schedule();
}

export function lazyHydrateEmbeds() {
  const embeds = document.querySelectorAll("iframe.youtube-embed, iframe.spotify-embed");
  if (!embeds.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const src = el.getAttribute("data-src");
      if (src && !el.getAttribute("src")) {
        el.setAttribute("src", src);
      }
      observer.unobserve(el);
    });
  }, { rootMargin: "400px 0px" });

  embeds.forEach((frame) => {
    const src = frame.getAttribute("src");
    if (!src) return;
    frame.setAttribute("data-src", src);
    frame.removeAttribute("src");
    frame.setAttribute("loading", "lazy");
    observer.observe(frame);
  });
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!(location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
