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

  const randomFlicker = () => {
    const opacity = Math.random() > 0.9 ? 0.1 : 1;
    const blur = Math.floor(Math.random() * 15) + 5;
    const x = Math.floor(Math.random() * 3) - 1;
    const y = Math.floor(Math.random() * 3) - 1;

    requestAnimationFrame(() => {
      h1.style.opacity = opacity;
      h1.style.transform = `translate(${x}px, ${y}px)`;
      h1.style.textShadow = `0 0 ${blur}px #0ff, 0 0 ${blur * 2}px #fff`;
    });
  };

  const schedule = () => {
    setTimeout(() => {
      randomFlicker();
      schedule();
    }, 120);
  };
  schedule();
}

export function weatherWidget() {
  const widget = document.getElementById("weatherWidget");
  if (!widget) return;
  const CACHE_KEY = "weatherStatesboroGA";
  const MAX_AGE_MS = 15 * 60 * 1000;

  const loading = widget.querySelector(".weather-loading");
  const content = widget.querySelector(".weather-content");

  const readCached = () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.savedAt || !parsed?.payload) return null;
      if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
      return parsed.payload;
    } catch {
      return null;
    }
  };

  const render = (current) => {
    const tempF = current.temp_F;
    const feelsLikeF = current.FeelsLikeF;
    const desc = current.weatherDesc?.[0]?.value || "Weather unavailable";
    widget.querySelector(".weather-location").textContent = "Statesboro, GA";
    widget.querySelector(".weather-temp").textContent = `${tempF}°F`;
    widget.querySelector(".weather-desc").textContent = desc.toLowerCase();
    widget.querySelector(".weather-feels-like").textContent = `Feels like ${feelsLikeF}°F`;
    loading.style.display = "none";
    content.style.display = "block";
  };

  const fetchWeather = async () => {
    try {
      const cached = readCached();
      if (cached?.current_condition?.[0]) {
        render(cached.current_condition[0]);
        return;
      }
      const response = await fetch("https://wttr.in/Statesboro,GA?format=j1", { cache: "force-cache" });
      const data = await response.json();
      if (data.current_condition?.length) {
        render(data.current_condition[0]);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), payload: data }));
      } else {
        loading.textContent = "Weather unavailable";
      }
    } catch {
      loading.textContent = "Weather offline";
    }
  };

  fetchWeather();
  setInterval(fetchWeather, 900000);
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
