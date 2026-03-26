import { encoded } from "./media.js";

export async function initCalendarForm() {
  const form = document.getElementById('calendarSubmitForm');
  const msg = document.getElementById('calendarSubmitMessage');
  if (!form || !msg) return;

  // Optional: load POST URL from gitignored `js/site.secrets.json` (e.g. generated in CI).
  // If missing or invalid, the form keeps its `action` from `index.html`.
  try {
    const r = await fetch('js/site.secrets.json', { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      const url = j && typeof j.formAction === 'string' ? j.formAction.trim() : '';
      if (url.startsWith('https://')) form.setAttribute('action', url);
    }
  } catch {
    /* keep action from markup */
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = 'Sending…';
    msg.style.color = 'inherit';

    const body = new URLSearchParams();
    new FormData(form).forEach((v, k) => body.append(k, v));

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body,
        redirect: 'follow',
      });
      const data = await res.json();
      msg.textContent = data.message;
      msg.style.color = data.success ? '#7fdb7f' : '#ff7f7f';
      if (data.success) form.reset();
    } catch {
      msg.textContent = 'Network error — check your connection and try again.';
      msg.style.color = '#ff7f7f';
    }
  });
}

function buildSrcsetFromTiers(tiers, prop) {
  if (!tiers?.length) return "";
  const parts = [];
  for (const t of tiers) {
    const url = t[prop];
    const w = t.w;
    if (url && w) parts.push(`${encoded(url)} ${w}w`);
  }
  return parts.join(", ");
}

function pickFallbackUrl(variant) {
  const tiers = variant?.tiers;
  if (tiers?.length) {
    const jpgs = tiers.map((t) => t.jpg || t.fallback).filter(Boolean);
    if (jpgs.length) return jpgs[jpgs.length - 1];
    const webps = tiers.map((t) => t.webp).filter(Boolean);
    if (webps.length) return webps[webps.length - 1];
    const avifs = tiers.map((t) => t.avif).filter(Boolean);
    if (avifs.length) return avifs[avifs.length - 1];
  }
  return variant?.fallback || variant?.jpg || variant?.webp || variant?.avif || null;
}

/**
 * Apply responsive slideshow variant: <picture> with srcset, or legacy single URLs + format chain.
 */
export function setSlideshowSlidePicture(pictureEl, variant) {
  if (!pictureEl || !variant) return;

  const sizes = variant.sizes || "(max-width: 768px) 92vw, min(92vw, 900px)";
  const tiers = variant.tiers;

  const img = pictureEl.querySelector("img");
  if (!img) return;

  if (tiers?.length) {
    pictureEl.querySelectorAll("source[data-slide-src]").forEach((el) => el.remove());

    const avifSet = buildSrcsetFromTiers(tiers, "avif");
    const webpSet = buildSrcsetFromTiers(tiers, "webp");
    const jpgSet = buildSrcsetFromTiers(tiers, "jpg");

    if (avifSet) {
      const s = document.createElement("source");
      s.type = "image/avif";
      s.srcset = avifSet;
      s.sizes = sizes;
      s.setAttribute("data-slide-src", "");
      pictureEl.insertBefore(s, img);
    }
    if (webpSet) {
      const s = document.createElement("source");
      s.type = "image/webp";
      s.srcset = webpSet;
      s.sizes = sizes;
      s.setAttribute("data-slide-src", "");
      pictureEl.insertBefore(s, img);
    }

    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    const jpgs = tiers.map((t) => t.jpg || t.fallback).filter(Boolean);

    if (jpgSet) {
      img.srcset = jpgSet;
      img.sizes = sizes;
      img.src = encoded(jpgs[jpgs.length - 1] || pickFallbackUrl(variant));
    } else {
      const chain = [pickFallbackUrl(variant)].filter(Boolean);
      let i = 0;
      const tryNext = () => {
        if (i >= chain.length) return;
        img.onerror = () => {
          i += 1;
          tryNext();
        };
        img.src = encoded(chain[i]);
      };
      tryNext();
    }
    return;
  }

  /* Legacy slides.optimized.json (single avif / webp / fallback) */
  pictureEl.querySelectorAll("source[data-slide-src]").forEach((el) => el.remove());
  img.removeAttribute("srcset");
  img.removeAttribute("sizes");
  const chain = [variant.avif, variant.webp, variant.fallback, variant.jpg].filter(Boolean);
  let i = 0;
  const tryNext = () => {
    if (i >= chain.length) return;
    img.onerror = () => {
      i += 1;
      tryNext();
    };
    img.src = encoded(chain[i]);
  };
  tryNext();
}

export function initHomeSlideshow() {
  const slide1 = document.getElementById("slide1");
  const slide2 = document.getElementById("slide2");
  if (!slide1 || !slide2) return;

  let currentIndex = 0;
  let entries = [];

  const chooseVariant = (entry) => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const variant = isMobile ? entry.mobile : entry.desktop;
    return variant || entry.desktop || entry.mobile;
  };

  const setSlideSrc = (pictureEl, entry) => {
    const variant = chooseVariant(entry);
    setSlideshowSlidePicture(pictureEl, variant);
  };

  const showNext = () => {
    if (!entries.length) return;
    const visible = slide1.classList.contains("visible") ? slide1 : slide2;
    const hidden = visible === slide1 ? slide2 : slide1;
    currentIndex = (currentIndex + 1) % entries.length;
    setSlideSrc(hidden, entries[currentIndex]);
    requestAnimationFrame(() => {
      visible.classList.remove("visible");
      hidden.classList.add("visible");
    });
  };

  fetch("slides.optimized.json")
    .then((r) => r.json())
    .then((data) => {
      if (!Array.isArray(data) || data.length < 2) return;
      entries = data;
      setSlideSrc(slide1, entries[0]);
      setSlideSrc(slide2, entries[1]);
      slide1.classList.add("visible");
      setInterval(() => {
        if (!document.hidden) showNext();
      }, 3000);
    })
    .catch(() => {});
}
