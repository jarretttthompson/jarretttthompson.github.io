/**
 * site-tune.js — Unified site editor: image tuning + element layout + change ledger.
 *
 * One panel, one tab ("Tune ▸"), every page.
 *
 * Modes:
 *   resume  Auto-selected on /resume. Reads CSS vars + JSON persistence.
 *           Sliders: posX/Y, scale, wrapWidth/OffsetX/OffsetY, bgPos/Zoom.
 *   shell-header
 *           The shell title bar background behind the logo. Selected from
 *           the Element Picker.
 *           Sliders: bgPosX/Y, bgSizePct.
 *   img     Any <img>. Selected from the Element Picker.
 *           Sliders: posX/Y, scale, widthPct, bandHeightVh.
 *   text    h1–h6, p, span, etc. Selected from the Element Picker.
 *           Sliders: fontSize, lineHeight, letterSpacing. Select: textAlign.
 *   block   div, section, article, etc. Selected from the Element Picker.
 *           Sliders: maxWidth, padding T/B/L/R, margin T/B, gap.
 *   none    Panel open but nothing selected.
 *
 * Change Ledger: page snapshots can be copied as agent-ready JSON.
 * Export Session: copies agent-ready JSON describing all diffs + HTML context.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const RESUME_JSON_PATH = "css/resume-photo-tune.values.json";
const TUNE_STATE_BASE = "css/tune-state";
const HOME_HERO_SELECTOR = "#site-home-hero";
const SHELL_HEADER_SELECTOR = ".site-shell-header";
const PANEL_ART_SELECTOR = ".inner-panel-photo-bg, .artwork-bg-photo";
const PANEL_ART_MIN = 0;
const PANEL_ART_MAX = 20;

const TEXT_TAGS = new Set([
  "h1","h2","h3","h4","h5","h6",
  "p","span","a","strong","em",
  "li","label","blockquote","cite",
  "figcaption","time","small","dt","dd",
]);

// ─── Shared Utilities ─────────────────────────────────────────────────────────

function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
function px(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

function isHomeHeroEl(el) {
  return el instanceof HTMLElement && el.matches(HOME_HERO_SELECTOR);
}

function isShellHeaderEl(el) {
  return el instanceof HTMLElement && el.matches(SHELL_HEADER_SELECTOR);
}

function isPanelArtEl(el) {
  return el instanceof HTMLElement && el.matches(PANEL_ART_SELECTOR);
}

function parseObjectPosition(str) {
  const t = (str || "").trim();
  if (!t) return { x: 50, y: 35 };
  const m = t.match(/([\d.]+)%\s+([\d.]+)%/);
  if (m) return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
  const one = t.match(/([\d.]+)%/);
  if (one) return { x: parseFloat(one[1]), y: 50 };
  return { x: 50, y: 35 };
}

function parseTransformScale(cs) {
  const tr = cs.transform;
  if (!tr || tr === "none") return 1;
  if (tr.startsWith("matrix3d")) return 1;
  const m = tr.match(/matrix\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(",").map((x) => parseFloat(x.trim()));
    if (p.length >= 1) return p[0];
  }
  const s = tr.match(/scale\(\s*([\d.]+)/);
  if (s) return parseFloat(s[1]);
  return 1;
}

function parseTranslate(cs) {
  const raw = (cs.translate || "").trim();
  if (!raw || raw === "none") return { x: 0, y: 0 };
  const parts = raw.split(/\s+/);
  return {
    x: px(parts[0]),
    y: px(parts[1] || "0"),
  };
}

function parseCssRotateDeg(cs) {
  const raw = (cs.rotate || "none").trim();
  if (raw === "none") return 0;
  if (raw.endsWith("deg")) return parseFloat(raw) || 0;
  if (raw.endsWith("rad")) return ((parseFloat(raw) || 0) * 180) / Math.PI;
  return parseFloat(raw) || 0;
}

function parseBgPosition(str) {
  // Computed background-position is always in pixels or percentages — convert to %
  const parts = (str || "50% 50%").trim().split(/\s+/);
  const toNum = (s, fallback) => {
    const n = parseFloat(s);
    return isNaN(n) ? fallback : n;
  };
  return {
    x: clamp(toNum(parts[0], 50), 0, 100),
    y: clamp(toNum(parts[1] ?? parts[0], 50), 0, 100),
  };
}

/** True only when an element has a real image (url()) as its background. */
function hasBgImage(el) {
  if (!el) return false;
  const bg = getComputedStyle(el).backgroundImage;
  return bg && bg !== "none" && bg.includes("url(");
}

// ─── Background Image: Read / Apply ──────────────────────────────────────────

function readStateFromBgImg(el) {
  const cs = getComputedStyle(el);
  // background-position computed value: "X% Y%" or pixel values
  const rawPos = cs.backgroundPosition || "50% 50%";
  // When multiple layers exist, the first value is for the last declared layer
  const firstLayer = rawPos.split(",")[0].trim();
  const pos = parseBgPosition(firstLayer);
  const rawSize = (cs.backgroundSize || "cover").split(",")[0].trim();
  // Normalise size: "cover"/"contain"/"auto" → use 100 as placeholder, flag it
  let bgSizePct = 100;
  let bgSizeMode = "cover";
  if (rawSize !== "cover" && rawSize !== "contain" && rawSize !== "auto") {
    bgSizeMode = "custom";
    bgSizePct = parseFloat(rawSize) || 100;
  }
  return {
    mode: "bg-img",
    posX: pos.x,
    posY: pos.y,
    bgSizePct,
    bgSizeMode,
    rotate: parseCssRotateDeg(cs),
  };
}

function applyStateToBgImg(el, v) {
  el.style.backgroundPosition = `${clamp(v.posX ?? 50, 0, 100)}% ${clamp(v.posY ?? 50, 0, 100)}%`;
  if ((v.bgSizeMode || "cover") === "cover") {
    el.style.backgroundSize = "cover";
  } else {
    el.style.backgroundSize = `${clamp(v.bgSizePct ?? 100, 10, 400)}%`;
  }
  const deg = v.rotate ?? 0;
  if (deg === 0) {
    el.style.removeProperty("rotate");
  } else {
    el.style.rotate = `${deg}deg`;
  }
}

// ─── Element Type Detection ───────────────────────────────────────────────────

function detectElementKind(el) {
  if (!el) return "none";
  const tag = el.tagName.toLowerCase();
  if (tag === "img") return "img";
  if (TEXT_TAGS.has(tag)) return "text";
  return "block";
}

function isExcludedFromSelection(el) {
  if (!el || el === document.documentElement || el === document.body) return true;
  if (el.matches(".crt-shell") || el.matches(".crt-overlay")) return true;
  const excluded = [
    "#site-tune-panel", "#site-tune-tab",
    ".site-header-logo-wrap", ".site-header-logo",
    ".crt-scanline",
  ];
  for (const sel of excluded) {
    try { if (el.matches(sel) || el.closest(sel)) return true; } catch { /* */ }
  }
  try {
    const r = el.getBoundingClientRect();
    if (r.width < 16 || r.height < 16) return true;
  } catch { /* */ }
  return false;
}

function isExcludedImage(img, opts = {}) {
  if (!img || img.tagName !== "IMG") return true;
  if (!opts.allowSlideshow) {
    if (img.closest(".slideshow")) return true;
    if (img.closest(".projects-slideshow")) return true;
    if (img.closest(".poster-carousel")) return true;
    if (img.closest(".carousel")) return true;
  }
  if (img.closest("#site-tune-panel")) return true;
  if (img.closest("#site-tune-tab")) return true;
  if (img.closest(".site-header-logo-wrap")) return true;
  if (img.classList.contains("site-header-logo")) return true;
  if (img.naturalWidth > 0 && img.naturalHeight > 0 && img.naturalWidth < 40 && img.naturalHeight < 40) return true;
  return false;
}

function getImageFrameEl(img) {
  if (!img?.parentElement) return null;
  const frame = img.closest("figure, picture, .resume-photo-wrap, .slideshow-container, .slide, .photo-card, .image-frame") || img.parentElement;
  if (!frame || frame === img || frame === document.body || frame === document.documentElement) return null;
  return frame instanceof HTMLElement ? frame : null;
}

// ─── Resume Card: Read / Apply / Export ──────────────────────────────────────

function readStateFromCard(card) {
  const cs = getComputedStyle(card);
  const get = (prop, fallback) => { const v = parseFloat(cs.getPropertyValue(prop)); return isNaN(v) ? fallback : v; };
  const op = parseObjectPosition(cs.getPropertyValue("--resume-title-photo-object-position").trim() || "50% 35%");
  return {
    mode: "resume",
    posX: op.x,
    posY: op.y,
    scale: get("--resume-title-photo-scale", 1),
    wrapWidthPct: clamp(get("--resume-photo-wrap-width-pct", 100), 40, 100),
    wrapOffsetXVw: clamp(get("--resume-photo-wrap-offset-x-vw", 0), -12, 12),
    wrapOffsetYVh: clamp(get("--resume-photo-wrap-offset-y-vh", 0), -12, 12),
    widthPct: clamp(get("--resume-title-photo-width-pct", 100), 40, 100),
    bandHeightVh: clamp(get("--resume-title-photo-band-height-vh", 22), 8, 55),
    bgPosX: clamp(get("--resume-header-bg-pos-x", 50), 0, 100),
    bgPosY: clamp(get("--resume-header-bg-pos-y", 50), 0, 100),
    bgSizePct: clamp(get("--resume-header-bg-size-pct", 112), 112, 200),
    objectFit: cs.getPropertyValue("--resume-title-photo-object-fit").trim() || "cover",
    maxHeight: cs.getPropertyValue("--resume-title-photo-max-height").trim() || "none",
  };
}

function applyStateToCard(card, v) {
  card.style.setProperty("--resume-header-bg-pos-x", String(clamp(v.bgPosX ?? 50, 0, 100)));
  card.style.setProperty("--resume-header-bg-pos-y", String(clamp(v.bgPosY ?? 50, 0, 100)));
  card.style.setProperty("--resume-header-bg-size-pct", String(clamp(v.bgSizePct ?? 112, 112, 200)));
  card.style.setProperty("--resume-photo-wrap-width-pct", String(clamp(v.wrapWidthPct ?? 100, 40, 100)));
  card.style.setProperty("--resume-photo-wrap-offset-x-vw", String(clamp(v.wrapOffsetXVw ?? 0, -12, 12)));
  card.style.setProperty("--resume-photo-wrap-offset-y-vh", String(clamp(v.wrapOffsetYVh ?? 0, -12, 12)));
  card.style.setProperty("--resume-title-photo-width-pct", String(clamp(v.widthPct ?? 100, 40, 100)));
  card.style.setProperty("--resume-title-photo-band-height-vh", String(clamp(v.bandHeightVh ?? 22, 8, 55)));
  card.style.setProperty("--resume-title-photo-object-position", `${v.posX}% ${v.posY}%`);
  card.style.setProperty("--resume-title-photo-scale", String(clamp(v.scale ?? 1, 1, 2.75)));
  if (v.objectFit != null) card.style.setProperty("--resume-title-photo-object-fit", v.objectFit);
  if (v.maxHeight != null) card.style.setProperty("--resume-title-photo-max-height", v.maxHeight);
}

function buildResumeJsonExport(v) {
  const objectPosition = `${clamp(v.posX, 0, 100)}% ${clamp(v.posY, 0, 100)}%`;
  return JSON.stringify({
    version: 5,
    resumeTitlePhoto: {
      bgPosX: v.bgPosX ?? 50, bgPosY: v.bgPosY ?? 50,
      bgSizePct: v.bgSizePct ?? 112,
      wrapWidthPct: v.wrapWidthPct ?? 100,
      wrapOffsetXVw: v.wrapOffsetXVw ?? 0,
      wrapOffsetYVh: v.wrapOffsetYVh ?? 0,
      widthPct: v.widthPct, bandHeightVh: v.bandHeightVh,
      objectFit: v.objectFit, objectPosition, scale: v.scale, maxHeight: v.maxHeight,
    },
  }, null, 2) + "\n";
}

function buildResumeCssExport(v) {
  const objectPosition = `${clamp(v.posX, 0, 100)}% ${clamp(v.posY, 0, 100)}%`;
  return `body.terminal-site .resume-prose .resume-header-card {
  --resume-header-bg-pos-x: ${v.bgPosX};
  --resume-header-bg-pos-y: ${v.bgPosY};
  --resume-header-bg-size-pct: ${v.bgSizePct};
  --resume-photo-wrap-width-pct: ${v.wrapWidthPct};
  --resume-photo-wrap-offset-x-vw: ${v.wrapOffsetXVw};
  --resume-photo-wrap-offset-y-vh: ${v.wrapOffsetYVh};
  --resume-title-photo-width-pct: ${v.widthPct};
  --resume-title-photo-band-height-vh: ${v.bandHeightVh};
  --resume-title-photo-object-fit: ${v.objectFit};
  --resume-title-photo-object-position: ${objectPosition};
  --resume-title-photo-scale: ${v.scale};
  --resume-title-photo-max-height: ${v.maxHeight};
}\n`;
}

async function loadResumeJson(card) {
  try {
    const r = await fetch(RESUME_JSON_PATH, { cache: "no-store" });
    if (!r.ok) return;
    const data = await r.json();
    const p = data?.resumeTitlePhoto;
    if (!p || typeof p !== "object") return;
    const v = {
      bgPosX: typeof p.bgPosX === "number" ? p.bgPosX : 50,
      bgPosY: typeof p.bgPosY === "number" ? p.bgPosY : 50,
      bgSizePct: typeof p.bgSizePct === "number" ? Math.max(112, p.bgSizePct) : 112,
      wrapWidthPct: typeof p.wrapWidthPct === "number" ? p.wrapWidthPct : 100,
      wrapOffsetXVw: typeof p.wrapOffsetXVw === "number" ? p.wrapOffsetXVw : 0,
      wrapOffsetYVh: typeof p.wrapOffsetYVh === "number" ? p.wrapOffsetYVh : 0,
      widthPct: typeof p.widthPct === "number" ? p.widthPct : 100,
      bandHeightVh: typeof p.bandHeightVh === "number" ? p.bandHeightVh : 22,
      objectFit: p.objectFit || "cover",
      objectPosition: p.objectPosition || "50% 35%",
      scale: typeof p.scale === "number" ? p.scale : 1,
      maxHeight: p.maxHeight || "none",
      posX: 50, posY: 35,
    };
    if (p.objectPosition) {
      const op = parseObjectPosition(p.objectPosition);
      v.posX = op.x; v.posY = op.y;
    }
    applyStateToCard(card, v);
  } catch { /* missing or invalid */ }
}

/**
 * Load and apply the saved state JSON for any non-resume page.
 * Mirrors what loadResumeJson does for the resume card, but for all element types.
 * Populates _savedStateSnapshot so renderLedger can colour entries saved vs pending.
 */
async function loadPageState(page) {
  if (!page) return;
  const safePage = page.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^_+|_+$/g, "") || "default";
  try {
    const r = await fetch(`${TUNE_STATE_BASE}/${safePage}.json`, { cache: "no-store" });
    if (!r.ok) return;
    const data = await r.json();
    if (!Array.isArray(data?.elements) || data.elements.length === 0) return;

    _savedStateSnapshot.clear();

    for (const item of data.elements) {
      const { selector, confidence, mode, state } = item;
      if (!selector || !state) continue;
      let el = null;
      try { el = document.querySelector(selector); } catch { /* bad selector */ }
      if (!el) continue;

      // Re-apply saved styles as inline (authoritative, beats CSS cascade)
      if (mode === "img" || el.tagName === "IMG") {
        applyStateToImg(el, state);
      } else if (mode === "text") {
        applyStateToText(el, state);
      } else if (mode === "block") {
        applyStateToBlock(el, state);
      } else if (mode === "home-hero") {
        applyStateToHomeHero(el, state);
      } else if (mode === "shell-header") {
        applyStateToShellHeader(el, state);
      } else if (mode === "panel-art") {
        applyStateToPanelArt(el, state);
      } else if (mode === "bg-img") {
        applyStateToBgImg(el, state);
      }

      // Use as baseline so sliders initialise from the restored values
      _baselineByElement.set(el, { ...state });

      // Record the saved property values — renderLedger compares live state against this
      const savedDiffs = buildCurrentStateProps(mode, state);
      _savedStateSnapshot.set(selector, savedDiffs);
    }

    _lastSavedAt = data.savedAt || null;
  } catch { /* missing or invalid state file — start fresh */ }
}

function readStateFromHomeHero(section) {
  const cs = getComputedStyle(section);
  const get = (prop, fallback) => {
    const v = parseFloat(cs.getPropertyValue(prop));
    return Number.isFinite(v) ? v : fallback;
  };
  return {
    mode: "home-hero",
    bgPosX: clamp(get("--home-hero-bg-pos-x", 50), 0, 100),
    bgPosY: clamp(get("--home-hero-bg-pos-y", 50), 0, 100),
    bgSizePct: clamp(get("--home-hero-bg-size-pct", 118), 108, 220),
  };
}

function applyStateToHomeHero(section, v) {
  section.style.setProperty("--home-hero-bg-pos-x", String(clamp(v.bgPosX ?? 50, 0, 100)));
  section.style.setProperty("--home-hero-bg-pos-y", String(clamp(v.bgPosY ?? 50, 0, 100)));
  section.style.setProperty("--home-hero-bg-size-pct", String(clamp(v.bgSizePct ?? 118, 108, 220)));
}

function readStateFromShellHeader(header) {
  const cs = getComputedStyle(header);
  const get = (prop, fallback) => {
    const v = parseFloat(cs.getPropertyValue(prop));
    return Number.isFinite(v) ? v : fallback;
  };
  return {
    mode: "shell-header",
    bgPosX: clamp(get("--shell-header-bg-pos-x", 50), 0, 100),
    bgPosY: clamp(get("--shell-header-bg-pos-y", 50), 0, 100),
    bgSizePct: clamp(get("--shell-header-bg-size-pct", 118), 108, 220),
  };
}

function applyStateToShellHeader(header, v) {
  header.style.setProperty("--shell-header-bg-pos-x", String(clamp(v.bgPosX ?? 50, 0, 100)));
  header.style.setProperty("--shell-header-bg-pos-y", String(clamp(v.bgPosY ?? 50, 0, 100)));
  header.style.setProperty("--shell-header-bg-size-pct", String(clamp(v.bgSizePct ?? 118, 108, 220)));
}

function readStateFromPanelArt(el) {
  const cs = getComputedStyle(el);
  const get = (prop, fallback) => {
    const v = parseFloat(cs.getPropertyValue(prop));
    return Number.isFinite(v) ? v : fallback;
  };
  const rawIdx = parseInt(el.getAttribute("data-bg-art") || "0", 10);
  const artIndex = Number.isFinite(rawIdx) ? clamp(rawIdx, PANEL_ART_MIN, PANEL_ART_MAX) : 0;
  return {
    mode: "panel-art",
    artIndex,
    bgPosX: clamp(get("--inner-panel-bg-pos-x", 50), 0, 100),
    bgPosY: clamp(get("--inner-panel-bg-pos-y", 50), 0, 100),
    bgSizePct: clamp(get("--inner-panel-bg-size-pct", 120), 80, 260),
    rotateDeg: clamp(get("--inner-panel-bg-rotate-deg", 0), -180, 180),
    opacity: clamp(get("--inner-panel-bg-opacity", 1), 0, 1),
  };
}

function applyStateToPanelArt(el, v) {
  const nextIdx = Math.round(clamp(v.artIndex ?? 0, PANEL_ART_MIN, PANEL_ART_MAX));
  el.setAttribute("data-bg-art", String(nextIdx));
  el.style.setProperty("--inner-panel-bg-pos-x", String(clamp(v.bgPosX ?? 50, 0, 100)));
  el.style.setProperty("--inner-panel-bg-pos-y", String(clamp(v.bgPosY ?? 50, 0, 100)));
  el.style.setProperty("--inner-panel-bg-size-pct", String(clamp(v.bgSizePct ?? 120, 80, 260)));
  el.style.setProperty("--inner-panel-bg-rotate-deg", String(clamp(v.rotateDeg ?? 0, -180, 180)));
  el.style.setProperty("--inner-panel-bg-opacity", String(clamp(v.opacity ?? 1, 0, 1)));
}

// ─── Image: Read / Apply ──────────────────────────────────────────────────────

function readStateFromImg(img) {
  const cs = getComputedStyle(img);
  const op = parseObjectPosition(cs.objectPosition || "50% 50%");
  const tr = parseTranslate(cs);
  let widthPct = 100;
  const cw = cs.width;
  if (cw.endsWith("%")) widthPct = parseFloat(cw);
  else if (img.parentElement) {
    const pw = parseFloat(getComputedStyle(img.parentElement).width) || 1;
    const iw = parseFloat(cs.width) || pw;
    widthPct = clamp((iw / pw) * 100, 40, 100);
  }
  let bandHeightVh = 22;
  const ch = (cs.height || "").trim();
  const useBandLayout = ch.endsWith("vh");
  if (ch.endsWith("vh")) bandHeightVh = parseFloat(ch);
  else if (ch.endsWith("px") && window.innerHeight > 0)
    bandHeightVh = clamp((parseFloat(ch) / window.innerHeight) * 100, 8, 55);
  return {
    mode: "img",
    posX: op.x, posY: op.y,
    offsetX: tr.x, offsetY: tr.y,
    widthPx: px(cs.width),
    heightPx: px(cs.height),
    scale: parseTransformScale(cs),
    rotate: parseCssRotateDeg(cs),
    useBandLayout, widthPct, bandHeightVh,
    objectFit: cs.objectFit || "cover",
    maxHeight: cs.maxHeight || "none",
  };
}

function applyStateToImg(img, v) {
  img.style.objectFit = v.objectFit || "cover";
  img.style.objectPosition = `${v.posX}% ${v.posY}%`;
  img.style.translate = `${v.offsetX ?? 0}px ${v.offsetY ?? 0}px`;
  img.style.transform = `scale(${clamp(v.scale, 0.25, 3)})`;
  img.style.transformOrigin = "center center";
  const deg = v.rotate ?? 0;
  if (deg === 0) { img.style.removeProperty("rotate"); } else { img.style.rotate = `${deg}deg`; }
  if (v.useBandLayout === true) {
    img.style.width = `${clamp(v.widthPct, 40, 100)}%`;
    img.style.height = `${clamp(v.bandHeightVh, 8, 55)}vh`;
    img.style.maxHeight = v.maxHeight === "none" ? "none" : v.maxHeight;
    img.style.aspectRatio = "auto";
  } else {
    img.style.width = `${Math.max(v.widthPx ?? 1, 1)}px`;
    img.style.height = `${Math.max(v.heightPx ?? 1, 1)}px`;
    img.style.removeProperty("max-height");
    img.style.removeProperty("aspect-ratio");
  }
}

// ─── Text / Block: Read / Apply ───────────────────────────────────────────────

function readStateFromText(el) {
  const cs = getComputedStyle(el);
  const fsPx = px(cs.fontSize) || 16;
  const lhRaw = cs.lineHeight;
  const tr = parseTranslate(cs);
  return {
    mode: "text",
    offsetX: tr.x,
    offsetY: tr.y,
    fontSize: fsPx,
    lineHeight: lhRaw === "normal" ? 1.5 : parseFloat((px(lhRaw) / fsPx).toFixed(3)),
    letterSpacing: cs.letterSpacing === "normal" ? 0 : parseFloat(px(cs.letterSpacing).toFixed(2)),
    textAlign: cs.textAlign || "left",
  };
}

function applyStateToText(el, v) {
  el.style.translate = `${v.offsetX ?? 0}px ${v.offsetY ?? 0}px`;
  el.style.fontSize = `${v.fontSize}px`;
  el.style.lineHeight = String(v.lineHeight);
  el.style.letterSpacing = `${v.letterSpacing}px`;
  el.style.textAlign = v.textAlign;
}

function readStateFromBlock(el) {
  const cs = getComputedStyle(el);
  const mw = cs.maxWidth;
  const tr = parseTranslate(cs);
  return {
    mode: "block",
    offsetX: tr.x,
    offsetY: tr.y,
    widthPx: px(cs.width),
    heightPx: px(cs.height),
    maxWidth: mw === "none" ? 9999 : px(mw),
    paddingTop: px(cs.paddingTop),
    paddingBottom: px(cs.paddingBottom),
    paddingLeft: px(cs.paddingLeft),
    paddingRight: px(cs.paddingRight),
    marginTop: px(cs.marginTop),
    marginBottom: px(cs.marginBottom),
    gap: px(cs.gap) || 0,
    display: cs.display,
  };
}

function applyStateToBlock(el, v) {
  el.style.translate = `${v.offsetX ?? 0}px ${v.offsetY ?? 0}px`;
  // widthPx/heightPx are only applied when present (in-session slider use).
  // They are intentionally omitted from the saved JSON to preserve responsive layout.
  if (v.widthPx != null) el.style.width = `${Math.max(v.widthPx, 1)}px`;
  if (v.heightPx != null) el.style.height = `${Math.max(v.heightPx, 1)}px`;
  el.style.maxWidth = (v.maxWidth ?? 9999) >= 9990 ? "none" : `${v.maxWidth}px`;
  el.style.paddingTop = `${v.paddingTop}px`;
  el.style.paddingBottom = `${v.paddingBottom}px`;
  el.style.paddingLeft = `${v.paddingLeft}px`;
  el.style.paddingRight = `${v.paddingRight}px`;
  el.style.marginTop = `${v.marginTop}px`;
  el.style.marginBottom = `${v.marginBottom}px`;
  if (["flex","inline-flex","grid","inline-grid"].includes(v.display || ""))
    el.style.gap = `${v.gap}px`;
}

// ─── Selector Generation ──────────────────────────────────────────────────────

function generateSelector(el) {
  if (el.id && /^[a-zA-Z]/.test(el.id)) {
    const s = `#${CSS.escape(el.id)}`;
    try { if (document.querySelectorAll(s).length === 1) return { selector: s, confidence: "high" }; } catch { /* */ }
  }
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList).filter(
    c => !c.startsWith("st-") && !c.startsWith("site-tune") &&
         !c.includes("hover") && !c.includes("focus") && !c.includes("active") && c.length > 1,
  );
  for (let n = Math.min(classes.length, 3); n >= 1; n--) {
    const cp = classes.slice(0, n).map(c => `.${CSS.escape(c)}`).join("");
    for (const cand of [cp, `${tag}${cp}`]) {
      try {
        const hits = document.querySelectorAll(cand);
        if (hits.length === 1) return { selector: cand, confidence: n > 1 ? "high" : "medium" };
        if (hits.length <= 5 && el.parentElement && el.parentElement !== document.body) {
          const { selector: ps } = generateSelector(el.parentElement);
          const combined = `${ps} > ${cand}`;
          try { if (document.querySelectorAll(combined).length === 1) return { selector: combined, confidence: "medium" }; } catch { /* */ }
        }
      } catch { /* */ }
    }
  }
  const path = [];
  let curr = el;
  for (let d = 0; d < 8 && curr && curr !== document.body; d++) {
    const parent = curr.parentElement;
    if (!parent) break;
    const ct = curr.tagName.toLowerCase();
    if (curr.id && /^[a-zA-Z]/.test(curr.id)) { path.unshift(`#${CSS.escape(curr.id)}`); break; }
    const same = Array.from(parent.children).filter(c => c.tagName === curr.tagName);
    const idx = same.indexOf(curr) + 1;
    path.unshift(same.length === 1 ? ct : `${ct}:nth-of-type(${idx})`);
    curr = parent;
    if (curr.id && /^[a-zA-Z]/.test(curr.id)) { path.unshift(`#${CSS.escape(curr.id)}`); break; }
  }
  return { selector: path.join(" > ") || tag, confidence: "low" };
}

function htmlContext(el) {
  const outer = el.outerHTML;
  if (outer.length < 350) return outer;
  const openEnd = outer.indexOf(">") + 1;
  return `${outer.slice(0, openEnd)}${outer.slice(openEnd, openEnd + 160).replace(/\n\s*/g, " ")}... [${el.children.length} children]`;
}

// ─── Diff Computation ─────────────────────────────────────────────────────────

function computeDiffs(baseline, current) {
  const diffs = [];
  if (!baseline || !current) return diffs;
  const mode = baseline.mode;

  if (mode === "resume") {
    const pairs = [
      ["--resume-title-photo-object-position", `${baseline.posX}% ${baseline.posY}%`, `${current.posX}% ${current.posY}%`, () => Math.abs(current.posX - baseline.posX) > 0.5 || Math.abs(current.posY - baseline.posY) > 0.5],
      ["--resume-title-photo-scale", baseline.scale, current.scale, () => Math.abs(current.scale - baseline.scale) > 0.005],
      ["--resume-title-photo-width-pct", baseline.widthPct, current.widthPct, () => Math.abs(current.widthPct - baseline.widthPct) > 0.5],
      ["--resume-title-photo-band-height-vh", baseline.bandHeightVh, current.bandHeightVh, () => Math.abs(current.bandHeightVh - baseline.bandHeightVh) > 0.25],
      ["--resume-photo-wrap-width-pct", baseline.wrapWidthPct, current.wrapWidthPct, () => Math.abs(current.wrapWidthPct - baseline.wrapWidthPct) > 0.5],
      ["--resume-photo-wrap-offset-x-vw", baseline.wrapOffsetXVw, current.wrapOffsetXVw, () => Math.abs(current.wrapOffsetXVw - baseline.wrapOffsetXVw) > 0.1],
      ["--resume-photo-wrap-offset-y-vh", baseline.wrapOffsetYVh, current.wrapOffsetYVh, () => Math.abs(current.wrapOffsetYVh - baseline.wrapOffsetYVh) > 0.1],
      ["--resume-header-bg-pos-x", baseline.bgPosX, current.bgPosX, () => Math.abs(current.bgPosX - baseline.bgPosX) > 0.5],
      ["--resume-header-bg-pos-y", baseline.bgPosY, current.bgPosY, () => Math.abs(current.bgPosY - baseline.bgPosY) > 0.5],
      ["--resume-header-bg-size-pct", baseline.bgSizePct, current.bgSizePct, () => Math.abs(current.bgSizePct - baseline.bgSizePct) > 0.5],
    ];
    for (const [prop, bv, av, changed] of pairs)
      if (changed()) diffs.push({ property: prop, before: String(bv), after: String(av) });
    return diffs;
  }

  if (mode === "home-hero") {
    const pairs = [
      ["--home-hero-bg-pos-x", baseline.bgPosX, current.bgPosX, () => Math.abs(current.bgPosX - baseline.bgPosX) > 0.5],
      ["--home-hero-bg-pos-y", baseline.bgPosY, current.bgPosY, () => Math.abs(current.bgPosY - baseline.bgPosY) > 0.5],
      ["--home-hero-bg-size-pct", baseline.bgSizePct, current.bgSizePct, () => Math.abs(current.bgSizePct - baseline.bgSizePct) > 0.5],
    ];
    for (const [prop, bv, av, changed] of pairs)
      if (changed()) diffs.push({ property: prop, before: String(bv), after: String(av) });
    return diffs;
  }

  if (mode === "shell-header") {
    const pairs = [
      ["--shell-header-bg-pos-x", baseline.bgPosX, current.bgPosX, () => Math.abs(current.bgPosX - baseline.bgPosX) > 0.5],
      ["--shell-header-bg-pos-y", baseline.bgPosY, current.bgPosY, () => Math.abs(current.bgPosY - baseline.bgPosY) > 0.5],
      ["--shell-header-bg-size-pct", baseline.bgSizePct, current.bgSizePct, () => Math.abs(current.bgSizePct - baseline.bgSizePct) > 0.5],
    ];
    for (const [prop, bv, av, changed] of pairs)
      if (changed()) diffs.push({ property: prop, before: String(bv), after: String(av) });
    return diffs;
  }

  if (mode === "panel-art") {
    const pairs = [
      ["data-bg-art", baseline.artIndex, current.artIndex, () => Math.round(current.artIndex) !== Math.round(baseline.artIndex)],
      ["--inner-panel-bg-pos-x", baseline.bgPosX, current.bgPosX, () => Math.abs(current.bgPosX - baseline.bgPosX) > 0.5],
      ["--inner-panel-bg-pos-y", baseline.bgPosY, current.bgPosY, () => Math.abs(current.bgPosY - baseline.bgPosY) > 0.5],
      ["--inner-panel-bg-size-pct", baseline.bgSizePct, current.bgSizePct, () => Math.abs(current.bgSizePct - baseline.bgSizePct) > 0.5],
      ["--inner-panel-bg-rotate-deg", baseline.rotateDeg, current.rotateDeg, () => Math.abs((current.rotateDeg ?? 0) - (baseline.rotateDeg ?? 0)) > 0.25],
      ["--inner-panel-bg-opacity", baseline.opacity, current.opacity, () => Math.abs((current.opacity ?? 1) - (baseline.opacity ?? 1)) > 0.01],
    ];
    for (const [prop, bv, av, changed] of pairs)
      if (changed()) diffs.push({ property: prop, before: String(bv), after: String(av) });
    return diffs;
  }

  if (mode === "img") {
    if (Math.abs((current.offsetX ?? 0) - (baseline.offsetX ?? 0)) > 0.5 ||
        Math.abs((current.offsetY ?? 0) - (baseline.offsetY ?? 0)) > 0.5) {
      diffs.push({
        property: "translate",
        before: `${baseline.offsetX ?? 0}px ${baseline.offsetY ?? 0}px`,
        after: `${current.offsetX ?? 0}px ${current.offsetY ?? 0}px`,
      });
    }
    if (Math.abs(current.posX - baseline.posX) > 0.5 || Math.abs(current.posY - baseline.posY) > 0.5)
      diffs.push({ property: "object-position", before: `${baseline.posX}% ${baseline.posY}%`, after: `${current.posX}% ${current.posY}%` });
    if (Math.abs(current.scale - baseline.scale) > 0.005)
      diffs.push({ property: "transform", before: `scale(${baseline.scale.toFixed(3)})`, after: `scale(${current.scale.toFixed(3)})` });
    if (Math.abs((current.rotate ?? 0) - (baseline.rotate ?? 0)) > 0.5)
      diffs.push({ property: "rotate", before: `${(baseline.rotate ?? 0).toFixed(1)}deg`, after: `${(current.rotate ?? 0).toFixed(1)}deg` });
    if (current.objectFit !== baseline.objectFit)
      diffs.push({ property: "object-fit", before: baseline.objectFit, after: current.objectFit });
    const bandBefore = baseline.useBandLayout === true;
    const bandAfter = current.useBandLayout === true;
    if (bandBefore !== bandAfter) {
      diffs.push({
        property: "layout-mode",
        before: bandBefore ? "band" : "intrinsic",
        after: bandAfter ? "band" : "intrinsic",
      });
    }
    if (bandBefore || bandAfter) {
      const beforeWidth = bandBefore ? `${baseline.widthPct}%` : "(unset)";
      const afterWidth = bandAfter ? `${current.widthPct}%` : "(removed)";
      if (!bandBefore || !bandAfter || Math.abs(current.widthPct - baseline.widthPct) > 0.5)
        diffs.push({ property: "width", before: beforeWidth, after: afterWidth });

      const beforeHeight = bandBefore ? `${baseline.bandHeightVh}vh` : "(unset)";
      const afterHeight = bandAfter ? `${current.bandHeightVh}vh` : "(removed)";
      if (!bandBefore || !bandAfter || Math.abs(current.bandHeightVh - baseline.bandHeightVh) > 0.25)
        diffs.push({ property: "height", before: beforeHeight, after: afterHeight });

      const beforeMaxHeight = bandBefore ? (baseline.maxHeight || "none") : "(unset)";
      const afterMaxHeight = bandAfter ? (current.maxHeight || "none") : "(removed)";
      if (beforeMaxHeight !== afterMaxHeight)
        diffs.push({ property: "max-height", before: beforeMaxHeight, after: afterMaxHeight });

      const beforeAspectRatio = bandBefore ? "auto" : "(unset)";
      const afterAspectRatio = bandAfter ? "auto" : "(removed)";
      if (beforeAspectRatio !== afterAspectRatio)
        diffs.push({ property: "aspect-ratio", before: beforeAspectRatio, after: afterAspectRatio });
    } else {
      if (Math.abs((current.widthPx ?? baseline.widthPx) - baseline.widthPx) > 1)
        diffs.push({ property: "width", before: `${baseline.widthPx}px`, after: `${current.widthPx}px` });
      if (Math.abs((current.heightPx ?? baseline.heightPx) - baseline.heightPx) > 1)
        diffs.push({ property: "height", before: `${baseline.heightPx}px`, after: `${current.heightPx}px` });
    }
    return diffs;
  }

  if (mode === "text") {
    if (Math.abs((current.offsetX ?? 0) - (baseline.offsetX ?? 0)) > 0.5 ||
        Math.abs((current.offsetY ?? 0) - (baseline.offsetY ?? 0)) > 0.5)
      diffs.push({ property: "translate", before: `${baseline.offsetX ?? 0}px ${baseline.offsetY ?? 0}px`, after: `${current.offsetX ?? 0}px ${current.offsetY ?? 0}px` });
    if (Math.abs(current.fontSize - baseline.fontSize) > 0.5)
      diffs.push({ property: "font-size", before: `${baseline.fontSize}px`, after: `${current.fontSize}px` });
    if (Math.abs(current.lineHeight - baseline.lineHeight) > 0.02)
      diffs.push({ property: "line-height", before: String(baseline.lineHeight), after: String(current.lineHeight) });
    if (Math.abs(current.letterSpacing - baseline.letterSpacing) > 0.1)
      diffs.push({ property: "letter-spacing", before: `${baseline.letterSpacing}px`, after: `${current.letterSpacing}px` });
    if (current.textAlign !== baseline.textAlign)
      diffs.push({ property: "text-align", before: baseline.textAlign, after: current.textAlign });
    return diffs;
  }

  if (mode === "block") {
    if (Math.abs((current.offsetX ?? 0) - (baseline.offsetX ?? 0)) > 0.5 ||
        Math.abs((current.offsetY ?? 0) - (baseline.offsetY ?? 0)) > 0.5)
      diffs.push({ property: "translate", before: `${baseline.offsetX ?? 0}px ${baseline.offsetY ?? 0}px`, after: `${current.offsetX ?? 0}px ${current.offsetY ?? 0}px` });
    if (Math.abs((current.widthPx ?? baseline.widthPx) - baseline.widthPx) > 1)
      diffs.push({ property: "width", before: `${baseline.widthPx}px`, after: `${current.widthPx}px` });
    if (Math.abs((current.heightPx ?? baseline.heightPx) - baseline.heightPx) > 1)
      diffs.push({ property: "height", before: `${baseline.heightPx}px`, after: `${current.heightPx}px` });
    if (Math.abs((current.maxWidth ?? 9999) - baseline.maxWidth) > 1)
      diffs.push({ property: "max-width", before: baseline.maxWidth >= 9990 ? "none" : `${baseline.maxWidth}px`, after: (current.maxWidth ?? 0) >= 9990 ? "none" : `${current.maxWidth}px` });
    for (const prop of ["paddingTop","paddingBottom","paddingLeft","paddingRight","marginTop","marginBottom"]) {
      if (Math.abs((current[prop] ?? baseline[prop]) - baseline[prop]) > 0.5)
        diffs.push({ property: prop.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`), before: `${baseline[prop]}px`, after: `${current[prop]}px` });
    }
    if (Math.abs((current.gap ?? baseline.gap) - baseline.gap) > 0.5 &&
        ["flex","inline-flex","grid","inline-grid"].includes(baseline.display || ""))
      diffs.push({ property: "gap", before: `${baseline.gap}px`, after: `${current.gap}px` });
    return diffs;
  }

  if (mode === "bg-img") {
    if (Math.abs(current.posX - baseline.posX) > 0.5 || Math.abs(current.posY - baseline.posY) > 0.5)
      diffs.push({ property: "background-position", before: `${baseline.posX}% ${baseline.posY}%`, after: `${current.posX}% ${current.posY}%` });
    const bSize = baseline.bgSizeMode === "cover" ? "cover" : `${baseline.bgSizePct}%`;
    const aSize = current.bgSizeMode === "cover" ? "cover" : `${current.bgSizePct}%`;
    if (bSize !== aSize)
      diffs.push({ property: "background-size", before: bSize, after: aSize });
    if (Math.abs((current.rotate ?? 0) - (baseline.rotate ?? 0)) > 0.5)
      diffs.push({ property: "rotate", before: `${(baseline.rotate ?? 0).toFixed(1)}deg`, after: `${(current.rotate ?? 0).toFixed(1)}deg` });
    return diffs;
  }

  return diffs;
}

// ─── Diff Equality ────────────────────────────────────────────────────────────

/** True when two diffs arrays represent the same property→value pairs (order-insensitive). */
function diffsMatch(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const aMap = new Map(a.map(d => [d.property, d.after]));
  for (const d of b) {
    if (aMap.get(d.property) !== d.after) return false;
  }
  return aMap.size === b.length;
}

// ─── Change Ledger ────────────────────────────────────────────────────────────

let _ledger = [];
let _changeId = 0;
let _ledgerContainer = null; // set during buildPanel
let _baselineByElement = new WeakMap();
let _resumeBaseline = null;
let _liveLedgerFrame = 0;
let _lastSavedAt = null;               // ISO string of last successful save
let _savedStateSnapshot = new Map();   // selector → diffs[] at last save (for saved/pending diff)
// Bridge: initSiteTuning() replaces this with the real closure function so
// module-level helpers (collectCurrentPageEntries) can call it without
// breaking the encapsulation of the page/card/state closure vars.
let _buildPageTargetCatalog = () => [];

function confBg(c) {
  return c === "high" ? "rgba(0,200,100,0.35)" : c === "medium" ? "rgba(255,180,0,0.35)" : "rgba(255,80,80,0.35)";
}

function createChangeEntry(selectedEl, baseline, diffs, note = "", forcedId = null) {
  const { selector, confidence } = generateSelector(selectedEl);
  return {
    id: forcedId || `ch_${String(++_changeId).padStart(3, "0")}`,
    selector,
    selectorConfidence: confidence,
    page: document.body.getAttribute("data-page") || location.pathname,
    mode: baseline.mode,
    tagName: selectedEl.tagName.toLowerCase(),
    htmlContext: htmlContext(selectedEl),
    diffs,
    note: note || "",
    timestamp: new Date().toISOString(),
  };
}

function commitEntry(diffs, note, selectedEl, baseline) {
  if (!selectedEl || !baseline || diffs.length === 0) return;
  const { selector, confidence } = generateSelector(selectedEl);
  const existing = _ledger.find(e => e.selector === selector);
  if (existing) {
    for (const d of diffs) {
      const ex = existing.diffs.find(x => x.property === d.property);
      if (ex) { ex.after = d.after; } else { existing.diffs.push(d); }
    }
    existing.diffs = existing.diffs.filter(d => d.before !== d.after);
    if (existing.diffs.length === 0) { _ledger = _ledger.filter(e => e !== existing); }
    else if (note) { existing.note = note; }
  } else {
    _ledger.push(createChangeEntry(selectedEl, baseline, diffs, note));
  }
  renderLedger();
}

function renderLedger() {
  if (!_ledgerContainer) return;
  _ledgerContainer.innerHTML = "";

  // Last-saved timestamp
  if (_lastSavedAt) {
    const ts = document.createElement("p");
    ts.style.cssText = "color:rgba(0,255,159,0.5);font-size:10px;margin:0 0 8px;";
    try {
      ts.textContent = `Last saved: ${new Date(_lastSavedAt).toLocaleTimeString()}`;
    } catch {
      ts.textContent = `Last saved: ${_lastSavedAt}`;
    }
    _ledgerContainer.appendChild(ts);
  }

  if (_ledger.length === 0) {
    const p = document.createElement("p");
    p.style.cssText = "color:rgba(180,230,200,0.4);font-size:11px;margin:6px 0 0;line-height:1.6;";
    p.textContent = _lastSavedAt
      ? "All changes are saved — document matches the saved baseline."
      : "Current document matches the saved baseline.";
    _ledgerContainer.appendChild(p);
    return;
  }

  const hdr = document.createElement("p");
  hdr.style.cssText = "color:#00ff9f;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;font-weight:600;";
  hdr.textContent = `Current page snapshot (${_ledger.length})`;
  _ledgerContainer.appendChild(hdr);

  for (const entry of [..._ledger]) {
    // Compare live diffs against the last-saved snapshot to decide badge colour
    const savedDiffs = _savedStateSnapshot.get(entry.selector);
    const isSaved = savedDiffs != null && diffsMatch(savedDiffs, entry.diffs);

    const card = document.createElement("div");
    card.style.cssText = [
      "margin-bottom:9px;padding:9px 10px;border-radius:6px;",
      isSaved
        ? "background:rgba(0,255,159,0.05);border:1px solid rgba(0,255,159,0.2);"
        : "background:rgba(255,200,0,0.04);border:1px solid rgba(255,200,0,0.28);",
    ].join("");

    const selRow = document.createElement("div");
    selRow.style.cssText = "display:flex;justify-content:space-between;align-items:flex-start;gap:5px;margin-bottom:5px;flex-wrap:wrap;";

    const selSpan = document.createElement("span");
    selSpan.textContent = entry.selector;
    selSpan.style.cssText = "font-size:11px;color:#a8ffd4;word-break:break-all;flex:1;min-width:0;";

    const badges = document.createElement("span");
    badges.style.cssText = "display:flex;gap:3px;flex-shrink:0;";

    const confBadge = document.createElement("span");
    confBadge.textContent = entry.selectorConfidence;
    confBadge.style.cssText = `font-size:9px;padding:1px 5px;border-radius:3px;white-space:nowrap;background:${confBg(entry.selectorConfidence)};`;

    const statusBadge = document.createElement("span");
    statusBadge.textContent = isSaved ? "saved" : "pending";
    statusBadge.style.cssText = isSaved
      ? "font-size:9px;padding:1px 6px;border-radius:3px;white-space:nowrap;font-weight:600;background:rgba(0,180,90,0.3);color:#00ff9f;"
      : "font-size:9px;padding:1px 6px;border-radius:3px;white-space:nowrap;font-weight:600;background:rgba(255,200,0,0.28);color:#ffd060;";

    badges.appendChild(confBadge);
    badges.appendChild(statusBadge);
    selRow.appendChild(selSpan);
    selRow.appendChild(badges);
    card.appendChild(selRow);

    for (const d of entry.diffs) {
      const line = document.createElement("div");
      line.style.cssText = "font-size:11px;margin:2px 0;";
      line.innerHTML =
        `<span style="color:#6eb;opacity:.8;">${d.property}:</span> ` +
        `<span style="color:#ff9ec9;text-decoration:line-through;">${d.before}</span> ` +
        `→ <span style="color:#00ff9f;">${d.after}</span>`;
      card.appendChild(line);
    }

    if (entry.note) {
      const n = document.createElement("div");
      n.style.cssText = "margin-top:4px;font-size:10px;color:rgba(180,255,220,0.55);font-style:italic;";
      n.textContent = `"${entry.note}"`;
      card.appendChild(n);
    }

    const rm = document.createElement("button");
    rm.type = "button";
    rm.textContent = "✕ Remove";
    rm.style.cssText = "margin-top:6px;padding:2px 8px;font-size:10px;cursor:pointer;background:transparent;border:1px solid rgba(0,255,159,0.25);color:#a8ffd4;border-radius:4px;";
    rm.addEventListener("click", () => { _ledger = _ledger.filter(e => e !== entry); renderLedger(); });
    card.appendChild(rm);
    _ledgerContainer.appendChild(card);
  }
}

// ─── Agent-Ready Export ───────────────────────────────────────────────────────

function buildAgentJson(entries = _ledger) {
  return JSON.stringify({
    exportVersion: "1.0",
    sessionDate: new Date().toISOString().slice(0, 10),
    siteId: location.hostname || "thejrummer.art",
    generatedBy: "site-tune.js",
    agentInstructions:
      "Apply the CSS changes below to the site source files. " +
      "Prefer updating existing CSS rules or CSS custom property definitions over adding inline styles. " +
      "If a CSS var (--foo) is already used for that property, update its definition instead. " +
      "The `htmlContext` field contains a snippet to help locate ambiguous elements. " +
      "`selectorConfidence` high/medium/low — low means verify visually. " +
      "After applying, remove any inline style=\"\" attributes added by the tuner.",
    affectedPages: [...new Set(entries.map(e => e.page))],
    changes: entries.map(e => ({
      id: e.id, selector: e.selector,
      selectorConfidence: e.selectorConfidence,
      page: e.page, mode: e.mode, tagName: e.tagName,
      diffs: e.diffs, note: e.note,
      htmlContext: e.htmlContext,
      timestamp: e.timestamp,
    })),
  }, null, 2);
}

function buildCurrentCssSnapshot(entries = _ledger) {
  const lines = [
    "/*",
    " * Live overrides saved by the Site Tuner local dev tool.",
    ` * Saved: ${new Date().toISOString()}`,
    " */",
    "",
  ];
  for (const entry of entries) {
    if (!entry?.selector || !Array.isArray(entry.diffs) || entry.diffs.length === 0) continue;
    // Boost specificity so overrides beat Tailwind / terminal-site.css
    const prefixed = entry.selector.startsWith("body") ? entry.selector : `body.terminal-site ${entry.selector}`;
    lines.push(`${prefixed} {`);
    for (const diff of entry.diffs) {
      lines.push(`  ${diff.property}: ${diff.after};`);
    }
    lines.push("}");
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Build the per-page state export object that the server writes to
 * css/tune-state/{page}.json.  On next page load, loadPageState() reads this
 * and re-applies inline styles — no agent, no copy-paste required.
 *
 * Block elements intentionally omit widthPx/heightPx so responsive layout
 * is not broken by fixed pixel dimensions after a viewport resize.
 */
function buildPageStateExport(page, entries = _ledger) {
  const elements = [];
  const seen = new WeakSet();

  // Resume card uses its own JSON file; skip here
  for (const entry of entries) {
    if (!entry?.selector || entry.mode === "resume") continue;
    let el = null;
    try { el = document.querySelector(entry.selector); } catch { /* */ }
    if (!el || seen.has(el)) continue;
    seen.add(el);

    const state = readStateForElement(el);
    if (!state) continue;

    // Strip non-responsive properties from block state
    if (state.mode === "block") {
      delete state.widthPx;
      delete state.heightPx;
    }

    elements.push({
      selector: entry.selector,
      confidence: entry.selectorConfidence || "medium",
      mode: state.mode,
      state,
    });
  }

  return { version: 1, page, savedAt: new Date().toISOString(), elements };
}

function doExport(mode, entries = _ledger) {
  const json = buildAgentJson(entries);
  if (mode === "copy") {
    navigator.clipboard.writeText(json).catch(() => window.prompt("Copy JSON:", json));
    return;
  }
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `site-edits-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function saveOverridesToFiles(entries = _ledger) {
  const page = document.body.getAttribute("data-page") || location.pathname;
  const stateExport = buildPageStateExport(page, entries);
  const res = await fetch("/__site_tune/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      css: buildCurrentCssSnapshot(entries),
      page,
      state: stateExport,
      savedAt: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Save failed (${res.status})`);
  }
  const result = await res.json().catch(() => ({}));
  // Update saved-state tracking so ledger flips entries to "saved"
  _lastSavedAt = new Date().toISOString();
  _savedStateSnapshot.clear();
  for (const entry of entries) {
    if (entry?.selector && Array.isArray(entry.diffs)) {
      _savedStateSnapshot.set(entry.selector, entry.diffs.map(d => ({ ...d })));
    }
  }
  return result;
}

function readStateForElement(el) {
  if (!el) return null;
  if (isHomeHeroEl(el)) return readStateFromHomeHero(el);
  if (isShellHeaderEl(el)) return readStateFromShellHeader(el);
  if (isPanelArtEl(el)) return readStateFromPanelArt(el);
  const kind = detectElementKind(el);
  if (kind === "img") return readStateFromImg(el);
  if (kind === "text") return readStateFromText(el);
  // Check for CSS background-image before falling back to block
  if (hasBgImage(el)) return readStateFromBgImg(el);
  return readStateFromBlock(el);
}

function ensureBaselineForElement(el) {
  if (!el || _baselineByElement.has(el)) return;
  const baseline = readStateForElement(el);
  if (baseline) _baselineByElement.set(el, { ...baseline });
}

function buildCurrentStateProps(mode, current) {
  if (!current) return [];
  if (mode === "home-hero") {
    return [
      { property: "--home-hero-bg-pos-x", before: "(current)", after: String(current.bgPosX) },
      { property: "--home-hero-bg-pos-y", before: "(current)", after: String(current.bgPosY) },
      { property: "--home-hero-bg-size-pct", before: "(current)", after: String(current.bgSizePct) },
    ];
  }
  if (mode === "shell-header") {
    return [
      { property: "--shell-header-bg-pos-x", before: "(current)", after: String(current.bgPosX) },
      { property: "--shell-header-bg-pos-y", before: "(current)", after: String(current.bgPosY) },
      { property: "--shell-header-bg-size-pct", before: "(current)", after: String(current.bgSizePct) },
    ];
  }
  if (mode === "panel-art") {
    return [
      { property: "data-bg-art", before: "(current)", after: String(Math.round(current.artIndex ?? 0)) },
      { property: "--inner-panel-bg-pos-x", before: "(current)", after: String(current.bgPosX) },
      { property: "--inner-panel-bg-pos-y", before: "(current)", after: String(current.bgPosY) },
      { property: "--inner-panel-bg-size-pct", before: "(current)", after: String(current.bgSizePct) },
      { property: "--inner-panel-bg-rotate-deg", before: "(current)", after: String(current.rotateDeg ?? 0) },
      { property: "--inner-panel-bg-opacity", before: "(current)", after: String(current.opacity ?? 1) },
    ];
  }
  if (mode === "resume") {
    return [
      { property: "--resume-header-bg-pos-x", before: "(current)", after: String(current.bgPosX) },
      { property: "--resume-header-bg-pos-y", before: "(current)", after: String(current.bgPosY) },
      { property: "--resume-header-bg-size-pct", before: "(current)", after: String(current.bgSizePct) },
      { property: "--resume-photo-wrap-width-pct", before: "(current)", after: String(current.wrapWidthPct) },
      { property: "--resume-photo-wrap-offset-x-vw", before: "(current)", after: String(current.wrapOffsetXVw) },
      { property: "--resume-photo-wrap-offset-y-vh", before: "(current)", after: String(current.wrapOffsetYVh) },
      { property: "--resume-title-photo-width-pct", before: "(current)", after: String(current.widthPct) },
      { property: "--resume-title-photo-band-height-vh", before: "(current)", after: String(current.bandHeightVh) },
      { property: "--resume-title-photo-object-position", before: "(current)", after: `${current.posX}% ${current.posY}%` },
      { property: "--resume-title-photo-scale", before: "(current)", after: String(current.scale) },
      { property: "--resume-title-photo-object-fit", before: "(current)", after: String(current.objectFit) },
      { property: "--resume-title-photo-max-height", before: "(current)", after: String(current.maxHeight) },
    ];
  }
  if (mode === "img") {
    const props = [
      { property: "translate", before: "(current)", after: `${current.offsetX ?? 0}px ${current.offsetY ?? 0}px` },
      { property: "object-position", before: "(current)", after: `${current.posX}% ${current.posY}%` },
      { property: "transform", before: "(current)", after: `scale(${current.scale})` },
      { property: "rotate", before: "(current)", after: `${current.rotate ?? 0}deg` },
      { property: "object-fit", before: "(current)", after: String(current.objectFit) },
      { property: "layout-mode", before: "(current)", after: current.useBandLayout ? "band" : "intrinsic" },
    ];
    if (current.useBandLayout) {
      props.push(
        { property: "width", before: "(current)", after: `${current.widthPct}%` },
        { property: "height", before: "(current)", after: `${current.bandHeightVh}vh` },
      );
    } else {
      props.push(
        { property: "width", before: "(current)", after: `${current.widthPx}px` },
        { property: "height", before: "(current)", after: `${current.heightPx}px` },
      );
    }
    return props;
  }
  if (mode === "bg-img") {
    return [
      { property: "background-position", before: "(current)", after: `${current.posX ?? 50}% ${current.posY ?? 50}%` },
      { property: "background-size", before: "(current)", after: (current.bgSizeMode === "cover" ? "cover" : `${current.bgSizePct ?? 100}%`) },
      { property: "rotate", before: "(current)", after: `${current.rotate ?? 0}deg` },
    ];
  }
  if (mode === "text") {
    return [
      { property: "translate", before: "(current)", after: `${current.offsetX ?? 0}px ${current.offsetY ?? 0}px` },
      { property: "font-size", before: "(current)", after: `${current.fontSize}px` },
      { property: "line-height", before: "(current)", after: String(current.lineHeight) },
      { property: "letter-spacing", before: "(current)", after: `${current.letterSpacing}px` },
      { property: "text-align", before: "(current)", after: String(current.textAlign) },
    ];
  }
  return [
    { property: "translate", before: "(current)", after: `${current.offsetX ?? 0}px ${current.offsetY ?? 0}px` },
    { property: "width", before: "(current)", after: `${current.widthPx}px` },
    { property: "height", before: "(current)", after: `${current.heightPx}px` },
    { property: "max-width", before: "(current)", after: (current.maxWidth ?? 9999) >= 9990 ? "none" : `${current.maxWidth}px` },
    { property: "padding-top", before: "(current)", after: `${current.paddingTop}px` },
    { property: "padding-bottom", before: "(current)", after: `${current.paddingBottom}px` },
    { property: "padding-left", before: "(current)", after: `${current.paddingLeft}px` },
    { property: "padding-right", before: "(current)", after: `${current.paddingRight}px` },
    { property: "margin-top", before: "(current)", after: `${current.marginTop}px` },
    { property: "margin-bottom", before: "(current)", after: `${current.marginBottom}px` },
    { property: "gap", before: "(current)", after: `${current.gap}px` },
  ];
}

function collectCurrentPageEntries() {
  const entries = [];
  let localId = 0;
  const nextId = () => `ch_${String(++localId).padStart(3, "0")}`;
  const currentPage = document.body.getAttribute("data-page") || "";
  const currentCard = document.querySelector(".resume-header-card");

  if (currentPage === "resume" && currentCard) {
      const current = readStateFromCard(currentCard);
      const diffs = buildCurrentStateProps("resume", current);
      entries.push(createChangeEntry(currentCard, { mode: "resume" }, diffs, "", nextId()));
  }

  const seen = new WeakSet();
  for (const item of _buildPageTargetCatalog()) {
    if (!item?.element || item.key.startsWith("resume:")) continue;
    if (seen.has(item.element)) continue;
    seen.add(item.element);
    const styleAttr = item.element.getAttribute("style") || "";
    const keepPanelArtEntry = item.action === "panel-art" || item.element.matches?.(PANEL_ART_SELECTOR);
    if (!styleAttr.trim() && !keepPanelArtEntry) continue;
    const current = readStateForElement(item.element);
    if (!current) continue;
    const mode = current.mode || detectElementKind(item.element);
    const diffs = buildCurrentStateProps(mode, current);
    entries.push(createChangeEntry(item.element, { mode }, diffs, "", nextId()));
  }

  return entries;
}

function syncLivePageLedger() {
  _ledger = collectCurrentPageEntries();
  _changeId = _ledger.length;
  renderLedger();
  return _ledger;
}

function scheduleLivePageLedgerSync() {
  if (_liveLedgerFrame) cancelAnimationFrame(_liveLedgerFrame);
  _liveLedgerFrame = requestAnimationFrame(() => {
    _liveLedgerFrame = 0;
    syncLivePageLedger();
  });
}

// ─── Panel Styles ─────────────────────────────────────────────────────────────

function injectPanelStyles() {
  const id = "site-tune-styles";
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = `
    #site-tune-tab {
      position: fixed !important;
      top: 50% !important;
      right: 0 !important;
      left: auto !important;
      transform: translateY(-50%) !important;
      z-index: 2147483000;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      padding: 14px 8px;
      font: 600 13px/1.2 ui-monospace, monospace;
      letter-spacing: 0.06em;
      color: #0a1620;
      background: linear-gradient(180deg, rgba(0,255,159,0.92), rgba(0,200,130,0.88));
      border: 1px solid rgba(0,255,159,0.6);
      border-right: none;
      border-radius: 10px 0 0 10px;
      cursor: pointer;
      box-shadow: -4px 0 18px rgba(0,0,0,0.35);
      user-select: none;
    }
    #site-tune-tab:hover { filter: brightness(1.06); }
    #site-tune-tab[aria-expanded="true"] { display: none !important; }

    #site-tune-panel {
      position: fixed !important;
      top: 0 !important;
      right: 0 !important;
      left: auto !important;
      bottom: 0 !important;
      width: min(370px, 100vw) !important;
      height: 100vh !important;
      height: 100dvh !important;
      max-height: none !important;
      margin: 0 !important;
      overflow-y: auto !important;
      box-sizing: border-box !important;
      z-index: 2147482999;
      padding: 16px 16px 36px;
      padding-top: 50px;
      font: 13px/1.45 ui-monospace, monospace;
      color: #e8fff0;
      background: rgba(8, 4, 18, 0.97);
      border-left: 2px solid rgba(0,255,159,0.5);
      box-shadow: -8px 0 40px rgba(0,0,0,0.6);
    }
    #site-tune-panel[hidden] { display: none !important; }

    #site-tune-panel h2 {
      margin: 0 0 10px;
      font-size: 15px;
      font-weight: 600;
      color: #00ff9f;
    }
    #site-tune-panel h3 {
      margin: 14px 0 6px;
      font-size: 11px;
      font-weight: 600;
      color: #7fffcc;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-top: 1px solid rgba(0,255,159,0.18);
      padding-top: 12px;
    }
    #site-tune-panel label {
      display: block;
      margin: 10px 0 3px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.8;
    }
    #site-tune-panel input[type="range"] {
      width: 100%;
      accent-color: #00ff9f;
      cursor: pointer;
    }
    #site-tune-panel select {
      width: 100%;
      background: rgba(8,20,12,0.92);
      color: #e8fff0;
      border: 1px solid rgba(0,255,159,0.3);
      border-radius: 5px;
      padding: 5px 7px;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .st-val-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
    }
    .st-val-row label { margin: 0; }
    .st-val {
      font-size: 12px;
      color: #00ff9f;
      font-weight: 600;
    }
    #site-tune-close {
      position: absolute !important;
      top: 10px !important;
      right: 10px !important;
      padding: 4px 10px;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      color: #e8fff0;
      background: transparent;
      border: 1px solid rgba(0,255,159,0.3);
      border-radius: 6px;
    }
    #site-tune-close:hover { filter: brightness(1.2); }

    #st-sel-info {
      margin: 8px 0 10px;
      padding: 8px 10px;
      background: rgba(0,255,159,0.06);
      border: 1px solid rgba(0,255,159,0.25);
      border-radius: 6px;
      font-size: 11px;
      color: #a8ffd4;
      word-break: break-all;
      min-height: 30px;
    }
    #st-no-sel {
      color: rgba(160,230,190,0.45);
      font-size: 11px;
      margin: 10px 0;
      line-height: 1.65;
    }
    #st-controls { margin-top: 4px; }

    #st-note-field {
      width: 100%;
      box-sizing: border-box;
      margin-top: 6px;
      padding: 6px 8px;
      background: rgba(8,20,12,0.7);
      border: 1px solid rgba(0,255,159,0.25);
      border-radius: 5px;
      color: #e8fff0;
      font: inherit;
      font-size: 11px;
      resize: vertical;
      min-height: 42px;
    }
    #st-note-field::placeholder { color: rgba(160,230,190,0.3); }

    .st-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 12px;
    }
    .st-actions button {
      cursor: pointer;
      padding: 7px 10px;
      border-radius: 6px;
      border: 1px solid rgba(0,255,159,0.4);
      background: rgba(0,50,36,0.5);
      color: #e8fff0;
      font: inherit;
      font-size: 11px;
    }
    .st-actions button:hover { filter: brightness(1.15); }
    .st-btn-primary {
      border-color: rgba(0,255,159,0.8) !important;
      background: rgba(0,255,159,0.15) !important;
    }
    #st-targets {
      margin: 0 0 10px;
    }
    #st-targets[hidden] {
      display: none !important;
    }
    #st-targets-title {
      margin: 0 0 8px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: rgba(160,230,190,0.7);
    }
    #st-element-picker {
      width: 100%;
      background: rgba(8,20,12,0.92);
      color: #e8fff0;
      border: 1px solid rgba(0,255,159,0.3);
      border-radius: 6px;
      padding: 7px 9px;
      font: inherit;
      font-size: 12px;
    }
    .st-target-list {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }
    .st-target-chip {
      padding: 6px 9px;
      border-radius: 999px;
      border: 1px solid rgba(0,255,159,0.28);
      background: rgba(8,20,12,0.55);
      color: #c8ffe0;
      font: inherit;
      font-size: 11px;
      line-height: 1.2;
      cursor: pointer;
    }
    .st-target-chip:hover {
      filter: brightness(1.1);
    }
    .st-target-chip[aria-pressed="true"] {
      border-color: rgba(0,255,159,0.85);
      background: rgba(0,255,159,0.16);
      color: #00ff9f;
      box-shadow: 0 0 12px rgba(0,255,159,0.16);
    }
    .st-target-chip[disabled] {
      cursor: default;
      opacity: 0.9;
    }

    #st-ledger-wrap {
      margin-top: 20px;
      border-top: 1px solid rgba(0,255,159,0.18);
      padding-top: 14px;
    }
    #st-ledger-title {
      font-size: 12px;
      font-weight: 600;
      color: #00ff9f;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 8px;
    }
    #st-readout {
      margin-top: 14px;
      padding: 10px 12px;
      background: rgba(0,0,0,0.4);
      border: 1px solid rgba(0,255,159,0.3);
      border-radius: 7px;
      font-size: 11px;
      line-height: 1.6;
      white-space: pre;
      user-select: text;
      color: #c8ffe0;
    }
    #st-readout strong {
      display: block;
      margin-bottom: 6px;
      color: #00ff9f;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* ── Dim overlay: darkens the whole page behind the selected element ── */
    #st-dim-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.52);
      z-index: 2147482992;
      pointer-events: none;
      transition: opacity 0.18s;
    }
    #st-dim-overlay[hidden] { display: none !important; }

    /* ── Selected element: sits above the dim overlay and pulses continuously ── */
    @keyframes st-selected-pulse {
      0%   { outline-color: #00ff9f;              box-shadow: 0 0 0 5px rgba(0,255,159,0.35), 0 0 28px rgba(0,255,159,0.55); }
      50%  { outline-color: rgba(0,255,159,0.55); box-shadow: 0 0 0 9px rgba(0,255,159,0.08), 0 0 48px rgba(0,255,159,0.2); }
      100% { outline-color: #00ff9f;              box-shadow: 0 0 0 5px rgba(0,255,159,0.35), 0 0 28px rgba(0,255,159,0.55); }
    }
    .st-selected {
      outline: 3px solid #00ff9f !important;
      outline-offset: 4px !important;
      position: relative !important;
      z-index: 2147482993 !important;
      animation: st-selected-pulse 1.9s ease-in-out infinite !important;
    }

    @keyframes st-hero-pulse {
      0%   { outline-color: rgba(120,220,255,0.95); box-shadow: 0 0 0 5px rgba(120,220,255,0.28), 0 0 30px rgba(120,220,255,0.4); }
      50%  { outline-color: rgba(120,220,255,0.5);  box-shadow: 0 0 0 9px rgba(120,220,255,0.07), 0 0 50px rgba(120,220,255,0.15); }
      100% { outline-color: rgba(120,220,255,0.95); box-shadow: 0 0 0 5px rgba(120,220,255,0.28), 0 0 30px rgba(120,220,255,0.4); }
    }
    .st-home-hero-target {
      outline: 3px dashed rgba(120,220,255,0.95) !important;
      outline-offset: 4px !important;
      position: relative !important;
      z-index: 2147482993 !important;
      animation: st-hero-pulse 1.9s ease-in-out infinite !important;
    }

    @keyframes st-resume-bg-pulse {
      0%   { outline-color: rgba(255,65,175,0.92); box-shadow: 0 0 0 5px rgba(255,65,175,0.28), 0 0 30px rgba(255,65,175,0.45); }
      50%  { outline-color: rgba(255,65,175,0.45); box-shadow: 0 0 0 9px rgba(255,65,175,0.07), 0 0 50px rgba(255,65,175,0.15); }
      100% { outline-color: rgba(255,65,175,0.92); box-shadow: 0 0 0 5px rgba(255,65,175,0.28), 0 0 30px rgba(255,65,175,0.45); }
    }
    .st-resume-bg-target {
      outline: 3px dashed rgba(255,65,175,0.92) !important;
      outline-offset: 5px !important;
      position: relative !important;
      z-index: 2147482993 !important;
      animation: st-resume-bg-pulse 1.9s ease-in-out infinite !important;
    }
    .st-resume-frame-target {
      outline: 3px solid rgba(120,220,255,0.95) !important;
      outline-offset: 3px !important;
      position: relative !important;
      z-index: 2147482993 !important;
      animation: st-hero-pulse 1.9s ease-in-out infinite !important;
    }
    .st-resume-crop-target {
      outline: 3px solid rgba(0,255,159,0.96) !important;
      outline-offset: 3px !important;
      position: relative !important;
      z-index: 2147482993 !important;
      animation: st-selected-pulse 1.9s ease-in-out infinite !important;
    }
    .st-resume-photo-target {
      outline: none !important;
      outline-offset: 0 !important;
      filter: none !important;
      box-shadow: none !important;
      animation: none !important;
    }
    #st-overlay-badge {
      position: fixed;
      z-index: 2147483001;
      pointer-events: none;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(4, 12, 8, 0.96);
      border: 1.5px solid rgba(0,255,159,0.75);
      color: #00ff9f;
      font: 700 12px/1.2 ui-monospace, monospace;
      letter-spacing: 0.05em;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6), 0 0 18px rgba(0,255,159,0.28);
      white-space: nowrap;
      text-shadow: 0 0 10px rgba(0,255,159,0.5);
    }
    #st-overlay-badge[hidden] {
      display: none !important;
    }

    /* Hover inspector: crosshair cursor on page when active */
    body.st-hover-inspect * {
      cursor: crosshair !important;
    }
    #st-hover-toggle[aria-pressed="true"] {
      border-color: rgba(120,220,255,0.85) !important;
      background: rgba(120,220,255,0.14) !important;
      color: #78dcff !important;
    }
  `;
  document.head.appendChild(s);
}

// ─── Control Builder Helpers ──────────────────────────────────────────────────

function mkRange(id, lbl, min, max, step, init, unit, onInput) {
  const row = document.createElement("div");
  row.className = "st-val-row";
  const lab = document.createElement("label");
  lab.setAttribute("for", id);
  lab.textContent = lbl;
  const val = document.createElement("span");
  val.className = "st-val";
  val.textContent = `${Number(init).toFixed(step < 1 ? 1 : 0)}${unit}`;
  row.appendChild(lab);
  row.appendChild(val);
  const input = document.createElement("input");
  input.id = id;
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(init);
  input.addEventListener("input", () => {
    const n = parseFloat(input.value);
    val.textContent = `${n.toFixed(step < 1 ? 1 : 0)}${unit}`;
    onInput(n);
  });
  return { row, input, val };
}

function mkSelect(id, lbl, opts, init, onChange) {
  const lab = document.createElement("label");
  lab.setAttribute("for", id);
  lab.textContent = lbl;
  const sel = document.createElement("select");
  sel.id = id;
  for (const o of opts) {
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    if (o === init) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener("change", () => onChange(sel.value));
  return { lab, sel };
}

function appendAll(parent, ...nodes) {
  for (const n of nodes) if (n) parent.appendChild(n);
}

// ─── Main Module ──────────────────────────────────────────────────────────────

export function initSiteTuning() {
  if (!document.body?.hasAttribute("data-terminal-site")) return;
  if (location.pathname.includes("/breakcomposer")) return;

  injectPanelStyles();

  const page = document.body.getAttribute("data-page");

  // ── Shared mutable state ──
  let targetMode = page === "resume" ? "resume" : "none"; // resume | home-hero | shell-header | panel-art | img | text | block | none
  let cardEl = null;
  let homeHeroEl = null;
  let shellHeaderEl = null;
  let panelArtEl = null;
  let targetEl = null; // the currently selected non-resume element
  let resumeTargetKey = "photo-crop";
  let state = null;
  let snapshot = null;
  let panelOpen = false;
  let hoverInspectorActive = false; // hover-to-inspect mode

  // ── DOM refs for controls (rebuilt per selection) ──
  let targetsWrap = null;
  let pageTargetSelect = null;
  let pageTargetCatalog = [];
  let currentTargetCatalogKey = "";
  let controlsWrap = null;
  let selInfoEl = null;
  let noSelEl = null;
  let readoutEl = null;
  let overlayBadgeEl = null;

  // ── Build Tab ──
  const tab = document.createElement("button");
  tab.id = "site-tune-tab";
  tab.type = "button";
  tab.setAttribute("aria-expanded", "false");
  tab.setAttribute("aria-controls", "site-tune-panel");
  tab.setAttribute("aria-label", "Open site tuning panel");
  tab.textContent = "Tune ▸";

  // ── Build Panel Shell ──
  const panel = document.createElement("aside");
  panel.id = "site-tune-panel";
  panel.hidden = true;

  const closeBtn = document.createElement("button");
  closeBtn.id = "site-tune-close";
  closeBtn.type = "button";
  closeBtn.textContent = "Close";

  const titleEl = document.createElement("h2");
  titleEl.textContent = "⬡ Site Tuner";

  const intro = document.createElement("p");
  intro.style.cssText = "margin:0 0 10px;font-size:11px;opacity:.75;line-height:1.65;";
  intro.innerHTML =
    "Use the <strong>Element Picker</strong> to choose what to edit, then adjust it with the controls below. " +
    "<strong>Esc</strong> deselects the current target or closes the panel.";

  selInfoEl = document.createElement("div");
  selInfoEl.id = "st-sel-info";
  selInfoEl.textContent = "No element selected";

  noSelEl = document.createElement("p");
  noSelEl.id = "st-no-sel";
  noSelEl.textContent = "Choose an element from the Element Picker to begin editing.";

  targetsWrap = document.createElement("div");
  targetsWrap.id = "st-targets";
  targetsWrap.hidden = true;

  controlsWrap = document.createElement("div");
  controlsWrap.id = "st-controls";
  controlsWrap.style.display = "none";

  readoutEl = document.createElement("div");
  readoutEl.id = "st-readout";
  readoutEl.hidden = true;

  overlayBadgeEl = document.createElement("div");
  overlayBadgeEl.id = "st-overlay-badge";
  overlayBadgeEl.hidden = true;

  const dimOverlay = document.createElement("div");
  dimOverlay.id = "st-dim-overlay";
  dimOverlay.hidden = true;

  // Ledger section
  const ledgerWrap = document.createElement("div");
  ledgerWrap.id = "st-ledger-wrap";
  const ledgerTitle = document.createElement("p");
  ledgerTitle.id = "st-ledger-title";
  ledgerTitle.textContent = "Change Ledger";
  _ledgerContainer = document.createElement("div");
  renderLedger();

  const exportRow = document.createElement("div");
  exportRow.className = "st-actions";
  exportRow.style.marginTop = "10px";
  const saveBtn = mkStBtn("💾 Save To Files", "", async () => {
    try {
      const entries = syncLivePageLedger();
      const result = await saveOverridesToFiles(entries);
      renderLedger(); // flip pending → saved immediately
      // Show saved file paths if returned by server
      const paths = [result?.cssPath, result?.statePath].filter(Boolean);
      if (paths.length) {
        const names = paths.map(p => p.split(/[\\/]/).slice(-2).join("/"));
        flashBtn(saveBtn, `✓ ${names.join(" + ")}`);
      } else {
        flashBtn(saveBtn, entries.length ? `💾 Saved ${entries.length}` : "💾 Saved!");
      }
    } catch (err) {
      console.warn("[site-tune] save failed:", err);
      const msg = String(err?.message || err || "");
      if (msg.includes("404") || msg.includes("Not found")) {
        flashBtn(saveBtn, "⚠ restart server");
      } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        // Offline fallback: download the CSS as a file so changes aren't lost
        try {
          const entries2 = syncLivePageLedger();
          const css = buildCurrentCssSnapshot(entries2);
          const blob = new Blob([css], { type: "text/css" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "site-tune-overrides.css";
          a.click();
          URL.revokeObjectURL(a.href);
          flashBtn(saveBtn, "⬇ downloaded (server offline)");
        } catch {
          flashBtn(saveBtn, "⚠ server offline");
        }
      } else {
        flashBtn(saveBtn, "⚠ save failed");
      }
    }
  });
  const revertBtn = mkStBtn("↺ Revert", "", async () => {
    if (!_lastSavedAt && _savedStateSnapshot.size === 0) {
      flashBtn(revertBtn, "nothing saved yet");
      return;
    }
    if (!confirm("Revert all unsaved changes on this page?")) return;
    // Remove inline styles from all elements that have them
    for (const item of buildPageTargetCatalog()) {
      if (!item?.element || item.key.startsWith("resume:")) continue;
      const el = item.element;
      if (el.getAttribute("style")) el.removeAttribute("style");
    }
    // Re-apply saved state from file
    await loadPageState(page);
    syncLivePageLedger();
    if (state && targetEl) {
      const freshState = readStateForElement(targetEl);
      if (freshState) { state = { ...freshState }; snapshot = { ...state }; buildControls(); apply(); }
    }
    flashBtn(revertBtn, "↺ reverted");
  });
  const snapshotBtn = mkStBtn("⎘ Copy Changes", "st-btn-primary", () => {
    const entries = syncLivePageLedger();
    doExport("copy", entries);
    flashBtn(snapshotBtn, entries.length ? `⎘ ${entries.length} copied` : "⎘ copied");
  });
  const clearLedgerBtn = mkStBtn("🗑 Clear", "", () => {
    if (_ledger.length === 0) return;
    if (confirm("Clear the current snapshot list?")) { _ledger = []; _changeId = 0; renderLedger(); }
  });
  appendAll(exportRow, saveBtn, revertBtn, snapshotBtn, clearLedgerBtn);
  appendAll(ledgerWrap, ledgerTitle, _ledgerContainer, exportRow);

  appendAll(panel, closeBtn, titleEl, intro, targetsWrap, selInfoEl, noSelEl, controlsWrap, readoutEl, ledgerWrap);

  document.body.appendChild(tab);
  document.body.appendChild(panel);
  document.body.appendChild(overlayBadgeEl);
  document.body.appendChild(dimOverlay);

  // ── Helpers ──
  function mkStBtn(text, extraClass, fn) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    if (extraClass) b.classList.add(extraClass);
    b.addEventListener("click", fn);
    return b;
  }

  function flashBtn(btn, msg) {
    const orig = btn.textContent;
    btn.textContent = msg;
    setTimeout(() => { btn.textContent = orig; }, 1400);
  }

  function humanizeKind(kind) {
    if (kind === "home-hero") return "hero background";
    if (kind === "img") return "image";
    if (kind === "text") return "text";
    if (kind === "block") return "container";
    return kind;
  }

  function describeElementLabel(el) {
    if (!el) return "element";
    const tag = el.tagName.toLowerCase();
    if (el.id) return `${tag}#${el.id}`;
    const firstClass = Array.from(el.classList || []).find((cls) => !cls.startsWith("st-"));
    if (firstClass) return `${tag}.${firstClass}`;
    return tag;
  }

  function buildTargetOptionLabel(el) {
    const kind = humanizeKind(detectElementKind(el));
    const base = describeElementLabel(el);
    const text = (el.textContent || el.getAttribute?.("alt") || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 42);
    return text ? `${kind}: ${base} - ${text}` : `${kind}: ${base}`;
  }

  function getCatalogGroupForEntry(entry) {
    if (entry?.key?.startsWith("home:")) return "Home";
    if (entry?.key?.startsWith("resume:")) return "Resume";
    if (entry?.group) return entry.group;
    if (entry?.action === "img") return "Images";
    if (entry?.key?.endsWith(":frame")) return "Image Frames";
    return detectElementKind(entry?.element) === "text" ? "Text" : "Containers";
  }

  function buildImageFrameOptionLabel(frameEl, img) {
    const frameBase = describeElementLabel(frameEl);
    const imageBase = describeElementLabel(img);
    const text = (img.getAttribute("alt") || img.getAttribute("aria-label") || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 36);
    return text
      ? `image frame: ${frameBase} - wraps ${imageBase} (${text})`
      : `image frame: ${frameBase} - wraps ${imageBase}`;
  }

  function collectTargetTrail(el, limit = 5) {
    const items = [];
    let curr = el;
    while (curr && curr !== document.body && items.length < limit) {
      if (!isExcludedFromSelection(curr)) items.push(curr);
      curr = curr.parentElement;
    }
    return items;
  }

  function resumeTargetLabel(key) {
    if (key === "background") return "Header background";
    if (key === "photo-frame") return "Photo frame";
    return "Photo crop";
  }

  function homeHeroTargetLabel() {
    return "Hero background";
  }

  function shellHeaderTargetLabel() {
    return "Shell header background";
  }

  function panelArtTargetLabel(el) {
    if (el?.matches?.(".artwork-bg-photo")) return "Artwork container background";
    return "Container background";
  }

  function getResumeParts(card) {
    return {
      background: card,
      "photo-frame": card?.querySelector?.(":scope .resume-photo-wrap") || null,
      "photo-crop": card?.querySelector?.(":scope .resume-photo-wrap img") || null,
    };
  }

  function buildPageTargetCatalog() {
    const items = [];
    const seen = new Set();
    let count = 0;
    const pushItem = (entry) => {
      if (!entry?.key || seen.has(entry.key)) return;
      seen.add(entry.key);
      items.push(entry);
    };
    if (page === "index") {
      const hero = document.querySelector(HOME_HERO_SELECTOR);
      if (hero) {
        ensureBaselineForElement(hero);
        pushItem({
          key: "home:hero-background",
          label: "home: Hero background",
          element: hero,
          action: "home-hero",
          group: "Home",
        });
      }
    }
    const shellHeader = document.querySelector(SHELL_HEADER_SELECTOR);
    if (shellHeader) {
      ensureBaselineForElement(shellHeader);
      pushItem({
        key: "shell:header-background",
        label: "shell: Header background",
        element: shellHeader,
        action: "shell-header",
        group: "Shell",
      });
    }
    for (const panelArtEl of document.body.querySelectorAll(PANEL_ART_SELECTOR)) {
      if (!(panelArtEl instanceof HTMLElement)) continue;
      ensureBaselineForElement(panelArtEl);
      pushItem({
        key: `panel-art:${count++}`,
        label: `panel: ${panelArtTargetLabel(panelArtEl)}`,
        element: panelArtEl,
        action: "panel-art",
        group: "Panel backgrounds",
      });
    }
    if (page === "resume") {
      pushItem(
        { key: "resume:background", label: "resume: Header background", group: "Resume" },
      );
      pushItem({ key: "resume:photo-frame", label: "resume: Photo frame", group: "Resume" });
      pushItem({ key: "resume:photo-crop", label: "resume: Photo crop", group: "Resume" });
    }
    for (const el of document.body.querySelectorAll("*")) {
      if (!(el instanceof HTMLElement)) continue;
      if (isExcludedFromSelection(el)) continue;
      if (page === "index" && isHomeHeroEl(el)) continue;
      if (isShellHeaderEl(el)) continue;
      if (isPanelArtEl(el)) continue;
      if (page === "resume" && el.closest(".resume-header-card")) continue;
      const kind = detectElementKind(el);
      const keyBase = `el:${count++}`;
      pushItem({
        key: keyBase,
        label: buildTargetOptionLabel(el),
        element: el,
        action: el.tagName === "IMG" ? "img" : "generic",
        group: el.tagName === "IMG" ? "Images" : (kind === "text" ? "Text" : "Containers"),
      });
      ensureBaselineForElement(el);
      if (el.tagName === "IMG" && !isExcludedImage(el)) {
        const frameEl = getImageFrameEl(el);
        if (frameEl && !isExcludedFromSelection(frameEl)) {
          ensureBaselineForElement(frameEl);
          pushItem({
            key: `${keyBase}:frame`,
            label: buildImageFrameOptionLabel(frameEl, el),
            element: frameEl,
            action: "generic",
            sourceImage: el,
            group: "Image Frames",
          });
        }
      }
    }
    const order = ["Home", "Shell", "Panel backgrounds", "Resume", "Images", "Image Frames", "Text", "Containers"];
    items.sort((a, b) => {
      const ag = getCatalogGroupForEntry(a);
      const bg = getCatalogGroupForEntry(b);
      const ai = order.indexOf(ag);
      const bi = order.indexOf(bg);
      if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return String(a.label).localeCompare(String(b.label));
    });
    pageTargetCatalog = items;
    return items;
  }
  // Expose to module-level helpers (collectCurrentPageEntries etc.)
  _buildPageTargetCatalog = buildPageTargetCatalog;

  function getCurrentTargetKey() {
    if (currentTargetCatalogKey) return currentTargetCatalogKey;
    if (targetMode === "home-hero") return "home:hero-background";
    if (targetMode === "shell-header") return "shell:header-background";
    if (targetMode === "panel-art" && panelArtEl) {
      const match = pageTargetCatalog.find((item) => item.element === panelArtEl && item.action === "panel-art");
      return match?.key || "";
    }
    if (targetMode === "resume") return `resume:${resumeTargetKey}`;
    if (!targetEl) return "";
    const match = pageTargetCatalog.find((item) => item.element === targetEl);
    return match?.key || "";
  }

  function selectTargetByKey(key) {
    if (!key) return;
    currentTargetCatalogKey = key;
    // Persist last selection for this page so it survives panel close/open
    try { sessionStorage.setItem(`st-last-key-${page}`, key); } catch { /* */ }
    if (key.startsWith("home:")) {
      selectHomeHeroTarget();
      return;
    }
    if (key.startsWith("shell:")) {
      selectShellHeaderTarget();
      return;
    }
    if (key.startsWith("panel-art:")) {
      const item = pageTargetCatalog.find((entry) => entry.key === key);
      if (item?.element) selectPanelArtTarget(item.element);
      return;
    }
    if (key.startsWith("resume:")) {
      selectResumeTarget(key.replace("resume:", ""));
      return;
    }
    const item = pageTargetCatalog.find((entry) => entry.key === key);
    if (!item?.element) return;
    if (item.action === "img" || item.element.tagName === "IMG") selectImg(item.element);
    else selectGenericEl(item.element);
  }

  function getOverlayAnchor() {
    if (targetMode === "home-hero" && homeHeroEl) return homeHeroEl;
    if (targetMode === "shell-header" && shellHeaderEl) return shellHeaderEl;
    if (targetMode === "panel-art" && panelArtEl) return panelArtEl;
    if (targetMode === "resume" && cardEl) {
      const parts = getResumeParts(cardEl);
      return parts[resumeTargetKey] || cardEl;
    }
    return targetEl;
  }

  function getInteractionHint() {
    if (!state) return "";
    if (targetMode === "home-hero") {
      return "Use the sliders to pan and zoom the hero background behind the intro content. Arrow keys nudge the background position.";
    }
    if (targetMode === "shell-header") {
      return "Use the sliders to pan and zoom the shell header background behind the logo. Arrow keys nudge the background position.";
    }
    if (targetMode === "panel-art") {
      return "Use the sliders to switch panel image index, pan, and zoom the container background. Arrow keys nudge background position.";
    }
    if (targetMode === "resume") {
      if (resumeTargetKey === "photo-crop") return "Use the sliders to adjust crop and zoom. Arrow keys nudge the crop.";
      if (resumeTargetKey === "photo-frame") return "Use the sliders to move and resize the frame. Arrow keys nudge the frame offsets.";
      return "Use the sliders to pan and zoom the header background. Arrow keys nudge the background position.";
    }
    if (targetMode === "img") return "Use the sliders to pan, size, and crop the image. Arrow keys nudge image position.";
    if (targetMode === "text") return "Use the sliders to adjust type. Arrow keys nudge size and spacing.";
    if (targetMode === "block") return "Use the sliders to size and space the container. Arrow keys nudge width and top spacing.";
    return "";
  }

  function syncOverlayBadge() {
    if (!overlayBadgeEl || !panelOpen || !state) {
      if (overlayBadgeEl) overlayBadgeEl.hidden = true;
      return;
    }
    const anchor = getOverlayAnchor();
    if (!anchor) {
      overlayBadgeEl.hidden = true;
      return;
    }
    const rect = anchor.getBoundingClientRect();
    // Build a descriptive label: show tag + id or first class for generic elements
    let badgeLabel;
    if (targetMode === "home-hero") {
      badgeLabel = homeHeroTargetLabel();
    } else if (targetMode === "shell-header") {
      badgeLabel = shellHeaderTargetLabel();
    } else if (targetMode === "panel-art") {
      badgeLabel = panelArtTargetLabel(panelArtEl);
    } else if (targetMode === "resume") {
      badgeLabel = `resume · ${resumeTargetLabel(resumeTargetKey)}`;
    } else if (targetEl) {
      const tag = targetEl.tagName.toLowerCase();
      const id = targetEl.id ? `#${targetEl.id}` : "";
      const cls = !id
        ? Array.from(targetEl.classList).filter(c => !c.startsWith("st-")).slice(0, 2).map(c => `.${c}`).join("")
        : "";
      const textPreview = (targetEl.textContent || "").replace(/\s+/g, " ").trim().slice(0, 28);
      badgeLabel = `<${tag}${id || cls}>${textPreview ? ` · "${textPreview}${textPreview.length >= 28 ? "…" : ""}"` : ""}`;
    } else {
      badgeLabel = humanizeKind(targetMode);
    }
    overlayBadgeEl.textContent = badgeLabel;
    overlayBadgeEl.hidden = false;
    const badgeRect = overlayBadgeEl.getBoundingClientRect();
    const top = Math.max(8, rect.top + 8);
    const left = Math.min(
      Math.max(8, rect.left + 8),
      window.innerWidth - badgeRect.width - 8,
    );
    overlayBadgeEl.style.top = `${top}px`;
    overlayBadgeEl.style.left = `${left}px`;
  }

  function renderTargets() {
    if (!targetsWrap) return;
    targetsWrap.innerHTML = "";
    const items = buildPageTargetCatalog();
    targetsWrap.hidden = false;
    const title = document.createElement("p");
    title.id = "st-targets-title";
    title.textContent = "Element Picker";
    pageTargetSelect = document.createElement("select");
    pageTargetSelect.id = "st-element-picker";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = state ? "Choose another element…" : "Choose an element to edit…";
    pageTargetSelect.appendChild(placeholder);
    let currentGroup = "";
    let optgroup = null;
    for (const item of items) {
      const groupName = getCatalogGroupForEntry(item);
      if (groupName !== currentGroup) {
        currentGroup = groupName;
        optgroup = document.createElement("optgroup");
        optgroup.label = groupName;
        pageTargetSelect.appendChild(optgroup);
      }
      const opt = document.createElement("option");
      opt.value = item.key;
      opt.textContent = item.label;
      if (item.key === getCurrentTargetKey()) opt.selected = true;
      (optgroup || pageTargetSelect).appendChild(opt);
    }
    pageTargetSelect.addEventListener("change", () => selectTargetByKey(pageTargetSelect.value));

    // Hover inspector toggle
    const hoverToggle = document.createElement("button");
    hoverToggle.id = "st-hover-toggle";
    hoverToggle.type = "button";
    hoverToggle.textContent = "⊹ Click to select";
    hoverToggle.setAttribute("aria-pressed", String(hoverInspectorActive));
    hoverToggle.style.cssText = "margin-top:7px;width:100%;padding:6px 10px;font:inherit;font-size:11px;cursor:pointer;border:1px solid rgba(0,255,159,0.3);border-radius:6px;background:rgba(8,20,12,0.55);color:#c8ffe0;text-align:left;";
    hoverToggle.addEventListener("click", () => {
      hoverInspectorActive = !hoverInspectorActive;
      hoverToggle.setAttribute("aria-pressed", String(hoverInspectorActive));
      document.body.classList.toggle("st-hover-inspect", hoverInspectorActive);
    });
    appendAll(targetsWrap, title, pageTargetSelect, hoverToggle);
  }

  // ── Panel open/close ──
  function openPanel() {
    panelOpen = true;
    panel.hidden = false;
    tab.setAttribute("aria-expanded", "true");
    tab.style.display = "none";
    document.body.classList.add("site-tune-panel-open");
    renderTargets();
    // Restore last selection for this page from session storage
    if (!state) {
      try {
        const lastKey = sessionStorage.getItem(`st-last-key-${page}`);
        if (lastKey) selectTargetByKey(lastKey);
      } catch { /* */ }
    }
    syncOverlayBadge();
  }

  function closePanel() {
    panelOpen = false;
    panel.hidden = true;
    tab.setAttribute("aria-expanded", "false");
    tab.style.removeProperty("display");
    document.body.classList.remove("site-tune-panel-open");
    dimOverlay.hidden = true;
    if (overlayBadgeEl) overlayBadgeEl.hidden = true;
  }

  tab.addEventListener("click", () => {
    openPanel();
    if (page === "index" && targetMode === "home-hero" && homeHeroEl) {
      setHomeHeroTarget(homeHeroEl);
    }
    // Resume page: re-highlight the header photo on open
    if (page === "resume" && targetMode === "resume" && cardEl) {
      setResumeTargets(cardEl);
    }
  });

  closeBtn.addEventListener("click", () => {
    closePanel();
    clearSelected();
  });

  window.addEventListener("scroll", syncOverlayBadge, { passive: true });
  window.addEventListener("resize", syncOverlayBadge, { passive: true });

  // ── Hover Inspector ──
  document.body.addEventListener("mouseover", (e) => {
    if (!hoverInspectorActive || !panelOpen) return;
    const el = e.target;
    if (!el || el === document.body || isExcludedFromSelection(el)) return;
    if (!overlayBadgeEl) return;
    const rect = el.getBoundingClientRect();
    overlayBadgeEl.textContent = describeElementLabel(el);
    overlayBadgeEl.hidden = false;
    const badgeRect = overlayBadgeEl.getBoundingClientRect();
    overlayBadgeEl.style.top = `${Math.max(8, rect.top + 6)}px`;
    overlayBadgeEl.style.left = `${Math.min(Math.max(8, rect.left + 6), window.innerWidth - badgeRect.width - 8)}px`;
  }, { passive: true });

  document.body.addEventListener("click", (e) => {
    if (!hoverInspectorActive || !panelOpen) return;
    const el = e.target;
    if (!el || isExcludedFromSelection(el)) return;
    e.preventDefault();
    e.stopPropagation();
    // Turn off inspector mode after selection
    hoverInspectorActive = false;
    document.body.classList.remove("st-hover-inspect");
    const toggle = document.getElementById("st-hover-toggle");
    if (toggle) toggle.setAttribute("aria-pressed", "false");
    // Select the clicked element
    if (el.tagName === "IMG" && !isExcludedImage(el)) {
      selectImg(el);
    } else {
      selectGenericEl(el);
    }
    // Re-render targets so picker reflects new selection
    renderTargets();
  }, true /* capture so it fires before page handlers */);

  // ── Selection highlight ──
  function clearSelected() {
    if (targetEl) { targetEl.classList.remove("st-selected"); }
    document.querySelectorAll(".st-selected").forEach(n => n.classList.remove("st-selected"));
    document.querySelectorAll(".st-home-hero-target").forEach(n => n.classList.remove("st-home-hero-target"));
    document.querySelectorAll(".st-resume-bg-target").forEach(n => n.classList.remove("st-resume-bg-target"));
    document.querySelectorAll(".st-resume-frame-target").forEach(n => n.classList.remove("st-resume-frame-target"));
    document.querySelectorAll(".st-resume-crop-target").forEach(n => n.classList.remove("st-resume-crop-target"));
    document.querySelectorAll(".st-resume-photo-target").forEach(n => n.classList.remove("st-resume-photo-target"));
    targetEl = null;
    dimOverlay.hidden = true;
    if (overlayBadgeEl) overlayBadgeEl.hidden = true;
  }

  function setSelected(el) {
    clearSelected();
    if (!el) return;
    void el.offsetWidth; // reflow → restart animation
    el.classList.add("st-selected");
    targetEl = el;
    dimOverlay.hidden = false;
    // Scroll so the element is visible — delay slightly so the dim overlay
    // renders first and the user sees the spotlight effect land on the element.
    setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }, 60);
    syncOverlayBadge();
  }

  function setResumeTargets(card) {
    clearSelected();
    if (!card) return;
    const parts = getResumeParts(card);
    let highlightEl = card;
    if (resumeTargetKey === "background" && parts.background) {
      parts.background.classList.add("st-resume-bg-target");
      highlightEl = parts.background;
    }
    if (resumeTargetKey === "photo-frame" && parts["photo-frame"]) {
      parts["photo-frame"].classList.add("st-resume-frame-target");
      highlightEl = parts["photo-frame"];
    }
    if (resumeTargetKey === "photo-crop" && parts["photo-crop"] && !isExcludedImage(parts["photo-crop"])) {
      if (parts["photo-frame"]) parts["photo-frame"].classList.add("st-resume-crop-target");
      parts["photo-crop"].classList.add("st-resume-photo-target");
      highlightEl = parts["photo-frame"] || card;
    }
    dimOverlay.hidden = false;
    setTimeout(() => highlightEl?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" }), 60);
    syncOverlayBadge();
  }

  function setHomeHeroTarget(section) {
    clearSelected();
    if (!section) return;
    section.classList.add("st-home-hero-target");
    dimOverlay.hidden = false;
    setTimeout(() => section.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" }), 60);
    syncOverlayBadge();
  }

  // ── Apply current state ──
  function apply() {
    if (!state) return;
    if (targetMode === "home-hero" && homeHeroEl) applyStateToHomeHero(homeHeroEl, state);
    if (targetMode === "shell-header" && shellHeaderEl) applyStateToShellHeader(shellHeaderEl, state);
    if (targetMode === "panel-art" && panelArtEl) applyStateToPanelArt(panelArtEl, state);
    if (targetMode === "resume" && cardEl) applyStateToCard(cardEl, state);
    if (targetMode === "img" && targetEl) applyStateToImg(targetEl, state);
    if (targetMode === "text" && targetEl) applyStateToText(targetEl, state);
    if (targetMode === "block" && targetEl) applyStateToBlock(targetEl, state);
    updateReadout();
    rebuildSlidersFromState();
    scheduleLivePageLedgerSync();
    syncOverlayBadge();
  }

  function nudgeSelectedTarget(key, amount) {
    if (!state) return false;

    if (targetMode === "home-hero") {
      if (key === "ArrowLeft") state.bgPosX = clamp((state.bgPosX ?? 50) - amount, 0, 100);
      if (key === "ArrowRight") state.bgPosX = clamp((state.bgPosX ?? 50) + amount, 0, 100);
      if (key === "ArrowUp") state.bgPosY = clamp((state.bgPosY ?? 50) - amount, 0, 100);
      if (key === "ArrowDown") state.bgPosY = clamp((state.bgPosY ?? 50) + amount, 0, 100);
      apply();
      return true;
    }

    if (targetMode === "shell-header") {
      if (key === "ArrowLeft") state.bgPosX = clamp((state.bgPosX ?? 50) - amount, 0, 100);
      if (key === "ArrowRight") state.bgPosX = clamp((state.bgPosX ?? 50) + amount, 0, 100);
      if (key === "ArrowUp") state.bgPosY = clamp((state.bgPosY ?? 50) - amount, 0, 100);
      if (key === "ArrowDown") state.bgPosY = clamp((state.bgPosY ?? 50) + amount, 0, 100);
      apply();
      return true;
    }

    if (targetMode === "panel-art") {
      if (key === "ArrowLeft") state.bgPosX = clamp((state.bgPosX ?? 50) - amount, 0, 100);
      if (key === "ArrowRight") state.bgPosX = clamp((state.bgPosX ?? 50) + amount, 0, 100);
      if (key === "ArrowUp") state.bgPosY = clamp((state.bgPosY ?? 50) - amount, 0, 100);
      if (key === "ArrowDown") state.bgPosY = clamp((state.bgPosY ?? 50) + amount, 0, 100);
      apply();
      return true;
    }

    if (targetMode === "resume") {
      if (resumeTargetKey === "photo-crop") {
        if (key === "ArrowLeft") state.posX = clamp((state.posX ?? 50) - amount, 0, 100);
        if (key === "ArrowRight") state.posX = clamp((state.posX ?? 50) + amount, 0, 100);
        if (key === "ArrowUp") state.posY = clamp((state.posY ?? 50) - amount, 0, 100);
        if (key === "ArrowDown") state.posY = clamp((state.posY ?? 50) + amount, 0, 100);
      } else if (resumeTargetKey === "photo-frame") {
        if (key === "ArrowLeft") state.wrapOffsetXVw = clamp((state.wrapOffsetXVw ?? 0) - amount * 0.2, -12, 12);
        if (key === "ArrowRight") state.wrapOffsetXVw = clamp((state.wrapOffsetXVw ?? 0) + amount * 0.2, -12, 12);
        if (key === "ArrowUp") state.wrapOffsetYVh = clamp((state.wrapOffsetYVh ?? 0) - amount * 0.2, -12, 12);
        if (key === "ArrowDown") state.wrapOffsetYVh = clamp((state.wrapOffsetYVh ?? 0) + amount * 0.2, -12, 12);
      } else {
        if (key === "ArrowLeft") state.bgPosX = clamp((state.bgPosX ?? 50) - amount, 0, 100);
        if (key === "ArrowRight") state.bgPosX = clamp((state.bgPosX ?? 50) + amount, 0, 100);
        if (key === "ArrowUp") state.bgPosY = clamp((state.bgPosY ?? 50) - amount, 0, 100);
        if (key === "ArrowDown") state.bgPosY = clamp((state.bgPosY ?? 50) + amount, 0, 100);
      }
      apply();
      return true;
    }

    if (targetMode === "img") {
      if (key === "ArrowLeft") state.posX = clamp((state.posX ?? 50) - amount, 0, 100);
      if (key === "ArrowRight") state.posX = clamp((state.posX ?? 50) + amount, 0, 100);
      if (key === "ArrowUp") state.posY = clamp((state.posY ?? 50) - amount, 0, 100);
      if (key === "ArrowDown") state.posY = clamp((state.posY ?? 50) + amount, 0, 100);
      apply();
      return true;
    }

    if (targetMode === "text") {
      if (key === "ArrowLeft") state.letterSpacing = clamp((state.letterSpacing ?? 0) - amount * 0.1, -2, 20);
      if (key === "ArrowRight") state.letterSpacing = clamp((state.letterSpacing ?? 0) + amount * 0.1, -2, 20);
      if (key === "ArrowUp") state.fontSize = clamp((state.fontSize ?? 16) + amount * 0.5, 8, 220);
      if (key === "ArrowDown") state.fontSize = clamp((state.fontSize ?? 16) - amount * 0.5, 8, 220);
      apply();
      return true;
    }

    if (targetMode === "block") {
      if (key === "ArrowLeft") state.maxWidth = clamp((state.maxWidth ?? 1200) - amount * 12, 100, 2400);
      if (key === "ArrowRight") state.maxWidth = clamp((state.maxWidth ?? 1200) + amount * 12, 100, 2400);
      if (key === "ArrowUp") state.marginTop = clamp((state.marginTop ?? 0) - amount, -100, 200);
      if (key === "ArrowDown") state.marginTop = clamp((state.marginTop ?? 0) + amount, -100, 200);
      apply();
      return true;
    }

    return false;
  }

  // ── Readout (numeric display for resume/image modes) ──
  function updateReadout() {
    if (!readoutEl || !state) return;
    if (targetMode === "home-hero") {
      readoutEl.hidden = false;
      const lines = [
        "layoutMode: home-hero",
        `bgPosX: ${state.bgPosX.toFixed(2)}`,
        `bgPosY: ${state.bgPosY.toFixed(2)}`,
        `bgSizePct: ${state.bgSizePct.toFixed(2)}`,
      ];
      readoutEl.innerHTML = `<strong>Current values</strong>${lines.join("\n")}`;
    } else if (targetMode === "shell-header") {
      readoutEl.hidden = false;
      const lines = [
        "layoutMode: shell-header",
        `bgPosX: ${state.bgPosX.toFixed(2)}`,
        `bgPosY: ${state.bgPosY.toFixed(2)}`,
        `bgSizePct: ${state.bgSizePct.toFixed(2)}`,
      ];
      readoutEl.innerHTML = `<strong>Current values</strong>${lines.join("\n")}`;
    } else if (targetMode === "panel-art") {
      readoutEl.hidden = false;
      const lines = [
        "layoutMode: panel-art",
        `artIndex: ${Math.round(state.artIndex ?? 0)}`,
        `bgPosX: ${state.bgPosX.toFixed(2)}`,
        `bgPosY: ${state.bgPosY.toFixed(2)}`,
        `bgSizePct: ${state.bgSizePct.toFixed(2)}`,
        `rotateDeg: ${(state.rotateDeg ?? 0).toFixed(2)}`,
        `opacity: ${(state.opacity ?? 1).toFixed(2)}`,
      ];
      readoutEl.innerHTML = `<strong>Current values</strong>${lines.join("\n")}`;
    } else if (targetMode === "resume" || targetMode === "img") {
      readoutEl.hidden = false;
      const lines = [
        `layoutMode: ${targetMode === "resume" ? "resume" : (state.useBandLayout ? "band" : "intrinsic")}`,
        `offsetX: ${(state.offsetX ?? 0).toFixed(1)}`,
        `offsetY: ${(state.offsetY ?? 0).toFixed(1)}`,
        `posX: ${state.posX.toFixed(2)}`,
        `posY: ${state.posY.toFixed(2)}`,
        `scale: ${state.scale.toFixed(3)}`,
      ];
      if (targetMode === "resume") {
        lines.push(
          `wrapWidthPct: ${state.wrapWidthPct.toFixed(2)}`,
          `wrapOffsetXVw: ${(state.wrapOffsetXVw ?? 0).toFixed(2)}`,
          `wrapOffsetYVh: ${(state.wrapOffsetYVh ?? 0).toFixed(2)}`,
          `bgPosX: ${state.bgPosX.toFixed(2)}`,
          `bgPosY: ${state.bgPosY.toFixed(2)}`,
          `bgSizePct: ${state.bgSizePct.toFixed(2)}`,
        );
      } else {
        lines.push(
          `widthPct: ${state.widthPct.toFixed(2)}`,
          `bandHeightVh: ${state.bandHeightVh.toFixed(2)}`,
        );
      }
      readoutEl.innerHTML = `<strong>Current values</strong>${lines.join("\n")}`;
    } else {
      readoutEl.hidden = true;
    }
  }

  // ── Update selection info bar ──
  function updateSelInfo(label, selector, confidence) {
    if (!selInfoEl) return;
    if (selector) {
      selInfoEl.innerHTML =
        `<strong style="color:#00ff9f;">${label}</strong> ${selector} ` +
        `<span style="font-size:9px;padding:1px 5px;border-radius:3px;margin-left:3px;background:${confBg(confidence)}">${confidence}</span>`;
    } else {
      selInfoEl.innerHTML = `<strong style="color:#00ff9f;">${label}</strong>`;
    }
    noSelEl.hidden = true;
    controlsWrap.style.display = "";
  }

  function updateResumeSelInfo() {
    updateSelInfo(`Resume · ${resumeTargetLabel(resumeTargetKey)}`, null, null);
  }

  function updateHomeHeroSelInfo() {
    updateSelInfo("Home · Hero background", "#site-home-hero", "high");
  }

  function updateShellHeaderSelInfo() {
    updateSelInfo("Shell · Header background", ".site-shell-header", "high");
  }

  function updatePanelArtSelInfo() {
    updateSelInfo("Panel · Container background", null, null);
  }

  // ── Build context-aware controls ──
  function buildControls() {
    controlsWrap.innerHTML = "";
    renderTargets();
    if (!state) return;

    if (targetMode === "resume") {
      buildResumeControls();
    } else if (targetMode === "home-hero") {
      buildHomeHeroControls();
    } else if (targetMode === "shell-header") {
      buildShellHeaderControls();
    } else if (targetMode === "panel-art") {
      buildPanelArtControls();
    } else if (targetMode === "img") {
      buildImgControls();
    } else if (targetMode === "text") {
      buildTextControls();
    } else if (targetMode === "block") {
      buildBlockControls();
    }

    const interactionHint = getInteractionHint();
    if (interactionHint) {
      const hint = document.createElement("p");
      hint.style.cssText = "margin:10px 0 0;font-size:11px;line-height:1.6;color:rgba(160,230,190,0.68);";
      hint.textContent = interactionHint;
      controlsWrap.appendChild(hint);
    }

    // Local target actions
    const noteSep = document.createElement("h3");
    noteSep.textContent = "Actions";
    controlsWrap.appendChild(noteSep);

    const actRow = document.createElement("div");
    actRow.className = "st-actions";
    const resetBtn = mkStBtn("↺ Reset", "", () => {
      state = { ...snapshot };
      renderTargets();
      buildControls();
      apply();
    });
    const desBtn = mkStBtn("✕ Deselect", "", deselect);
    appendAll(actRow, resetBtn, desBtn);
    controlsWrap.appendChild(actRow);
    controlsWrap.appendChild(readoutEl);
  }

  // ── Slider refs for rebuildSlidersFromState ──
  let sliderRefs = {};

  function regSlider(key, ref) { sliderRefs[key] = ref; return ref; }

  function rebuildSlidersFromState() {
    for (const [key, ref] of Object.entries(sliderRefs)) {
      if (!ref || state[key] == null) continue;
      ref.input.value = String(state[key]);
      const step = parseFloat(ref.input.step);
      ref.val.textContent = `${Number(state[key]).toFixed(step < 1 ? 1 : 0)}${ref.unit || ""}`;
    }
  }

  function addRange(id, lbl, min, max, step, key, unit) {
    const r = mkRange(id, lbl, min, max, step, state[key] ?? 0, unit, (n) => { state[key] = n; apply(); });
    r.unit = unit;
    regSlider(key, r);
    appendAll(controlsWrap, r.row, r.input);
    return r;
  }

  function addSelect(id, lbl, opts, key) {
    const s = mkSelect(id, lbl, opts, state[key] || opts[0], (v) => { state[key] = v; apply(); });
    appendAll(controlsWrap, s.lab, s.sel);
    return s;
  }

  function buildResumeControls() {
    sliderRefs = {};
    const hdr = document.createElement("h3");
    hdr.textContent = resumeTargetLabel(resumeTargetKey);
    controlsWrap.appendChild(hdr);

    const help = document.createElement("p");
    help.style.cssText = "margin:0 0 8px;font-size:11px;line-height:1.6;color:rgba(160,230,190,0.62);";

    if (resumeTargetKey === "photo-crop") {
      help.textContent = "Adjust which part of the performance photo is visible inside the frame.";
      controlsWrap.appendChild(help);
      addRange("st-posx", "Crop X (%)", 0, 100, 0.25, "posX", "%");
      addRange("st-posy", "Crop Y (%)", 0, 100, 0.25, "posY", "%");
      addRange("st-scale", "Photo zoom", 1, 2.75, 0.005, "scale", "×");
      addSelect("st-resume-fit", "Image Fit", ["cover","contain","fill","none","scale-down"], "objectFit");
      return;
    }

    if (resumeTargetKey === "photo-frame") {
      help.textContent = "Move and resize the photo band inside the header card without changing the crop itself.";
      controlsWrap.appendChild(help);
      addRange("st-widthpct", "Photo width (% of frame)", 40, 100, 0.5, "widthPct", "%");
      addRange("st-bandvh", "Photo band height (vh)", 8, 55, 0.25, "bandHeightVh", "vh");
      addRange("st-wrapw", "Frame width (% of card)", 40, 100, 0.5, "wrapWidthPct", "%");
      addRange("st-wrapx", "Move frame X (vw)", -12, 12, 0.25, "wrapOffsetXVw", "vw");
      addRange("st-wrapy", "Move frame Y (vh)", -12, 12, 0.25, "wrapOffsetYVh", "vh");
      return;
    }

    help.textContent = "Pan and zoom the header background art behind the photo and text.";
    controlsWrap.appendChild(help);
    addRange("st-bgx", "Pan background X (%)", 0, 100, 0.25, "bgPosX", "%");
    addRange("st-bgy", "Pan background Y (%)", 0, 100, 0.25, "bgPosY", "%");
    addRange("st-bgzoom", "Background zoom (%)", 112, 200, 0.5, "bgSizePct", "%");
    const bgHint = document.createElement("p");
    bgHint.style.cssText = "margin:8px 0 0;font-size:11px;line-height:1.6;color:rgba(160,230,190,0.6);";
    bgHint.textContent = "The background stays slightly oversized so pan controls always have visible travel.";
    controlsWrap.appendChild(bgHint);
  }

  function buildHomeHeroControls() {
    sliderRefs = {};
    const hdr = document.createElement("h3");
    hdr.textContent = homeHeroTargetLabel();
    controlsWrap.appendChild(hdr);

    const help = document.createElement("p");
    help.style.cssText = "margin:0 0 8px;font-size:11px;line-height:1.6;color:rgba(160,230,190,0.62);";
    help.textContent = "Pan and zoom the background art behind the homepage intro, slideshow, and about copy.";
    controlsWrap.appendChild(help);
    addRange("st-home-bgx", "Pan background X (%)", 0, 100, 0.25, "bgPosX", "%");
    addRange("st-home-bgy", "Pan background Y (%)", 0, 100, 0.25, "bgPosY", "%");
    addRange("st-home-bgzoom", "Background zoom (%)", 108, 220, 0.5, "bgSizePct", "%");
  }

  function buildShellHeaderControls() {
    sliderRefs = {};
    const hdr = document.createElement("h3");
    hdr.textContent = shellHeaderTargetLabel();
    controlsWrap.appendChild(hdr);

    const help = document.createElement("p");
    help.style.cssText = "margin:0 0 8px;font-size:11px;line-height:1.6;color:rgba(160,230,190,0.62);";
    help.textContent = "Pan and zoom the shell title bar background behind the wordmark.";
    controlsWrap.appendChild(help);
    addRange("st-shell-bgx", "Pan background X (%)", 0, 100, 0.25, "bgPosX", "%");
    addRange("st-shell-bgy", "Pan background Y (%)", 0, 100, 0.25, "bgPosY", "%");
    addRange("st-shell-bgzoom", "Background zoom (%)", 108, 220, 0.5, "bgSizePct", "%");
  }

  function buildPanelArtControls() {
    sliderRefs = {};
    const hdr = document.createElement("h3");
    hdr.textContent = panelArtTargetLabel(panelArtEl);
    controlsWrap.appendChild(hdr);

    const help = document.createElement("p");
    help.style.cssText = "margin:0 0 8px;font-size:11px;line-height:1.6;color:rgba(160,230,190,0.62);";
    help.textContent = "Use a shared image index (data-bg-art) so container backgrounds are referenced consistently across pages.";
    controlsWrap.appendChild(help);
    addRange("st-panel-art-index", "Image index (data-bg-art)", PANEL_ART_MIN, PANEL_ART_MAX, 1, "artIndex", "");
    addRange("st-panel-bgx", "Pan background X (%)", 0, 100, 0.25, "bgPosX", "%");
    addRange("st-panel-bgy", "Pan background Y (%)", 0, 100, 0.25, "bgPosY", "%");
    addRange("st-panel-bgzoom", "Background zoom (%)", 80, 260, 0.5, "bgSizePct", "%");
    addRange("st-panel-bgrot", "Background rotate (deg)", -180, 180, 0.5, "rotateDeg", "deg");
    addRange("st-panel-bgopacity", "Background opacity", 0, 1, 0.01, "opacity", "");
  }

  function buildImgControls() {
    sliderRefs = {};
    const hdr = document.createElement("h3");
    hdr.textContent = "Image Position";
    controlsWrap.appendChild(hdr);
    addRange("st-img-offx", "Move X (px)", -800, 800, 1, "offsetX", "px");
    addRange("st-img-offy", "Move Y (px)", -800, 800, 1, "offsetY", "px");
    const layoutLab = document.createElement("label");
    layoutLab.setAttribute("for", "st-layout");
    layoutLab.textContent = "Sizing Mode";
    const layoutSel = document.createElement("select");
    layoutSel.id = "st-layout";
    for (const option of [
      { value: "intrinsic", label: "intrinsic" },
      { value: "band", label: "band" },
    ]) {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      opt.selected = (state.useBandLayout ? "band" : "intrinsic") === option.value;
      layoutSel.appendChild(opt);
    }
    layoutSel.addEventListener("change", () => {
      state.useBandLayout = layoutSel.value === "band";
      buildControls();
      apply();
    });
    appendAll(controlsWrap, layoutLab, layoutSel);
    addRange("st-posx", "Crop X (%)", 0, 100, 0.25, "posX", "%");
    addRange("st-posy", "Crop Y (%)", 0, 100, 0.25, "posY", "%");
    addRange("st-scale", "Size / Zoom", 1, 2.75, 0.005, "scale", "×");
    addSelect("st-objfit", "Object Fit", ["cover","contain","fill","none","scale-down"], "objectFit");
    if (state.useBandLayout) {
      const bandHdr = document.createElement("h3");
      bandHdr.textContent = "Band Layout";
      controlsWrap.appendChild(bandHdr);
      addRange("st-widthpct", "Width (% of container)", 40, 100, 0.5, "widthPct", "%");
      addRange("st-bandvh", "Band height (vh)", 8, 55, 0.25, "bandHeightVh", "vh");
    } else {
      const sizeHdr = document.createElement("h3");
      sizeHdr.textContent = "Image Size";
      controlsWrap.appendChild(sizeHdr);
      addRange("st-img-widthpx", "Width (px)", 24, 2400, 1, "widthPx", "px");
      addRange("st-img-heightpx", "Height (px)", 24, 2400, 1, "heightPx", "px");
      const hint = document.createElement("p");
      hint.style.cssText = "margin:8px 0 0;font-size:11px;line-height:1.6;color:rgba(160,230,190,0.6);";
      hint.textContent = "Intrinsic mode lets you size the image directly in pixels. Switch to band mode to tune width and vh-based height inside a frame.";
      controlsWrap.appendChild(hint);
    }
  }

  function buildTextControls() {
    sliderRefs = {};
    const hdr = document.createElement("h3");
    hdr.textContent = `Typography · <${targetEl?.tagName.toLowerCase()}>`;
    controlsWrap.appendChild(hdr);
    addRange("st-text-offx", "Move X (px)", -800, 800, 1, "offsetX", "px");
    addRange("st-text-offy", "Move Y (px)", -800, 800, 1, "offsetY", "px");
    const fsMin = Math.max(8, (state.fontSize || 16) - 36);
    const fsMax = (state.fontSize || 16) + 80;
    addRange("st-fs", "Size", fsMin, fsMax, 0.5, "fontSize", "px");
    addRange("st-lh", "Line Height", 0.8, 3, 0.05, "lineHeight", "");
    addRange("st-ls", "Letter Spacing", -2, 20, 0.1, "letterSpacing", "px");
    addSelect("st-align", "Text Align", ["left","center","right","justify"], "textAlign");
  }

  function buildBlockControls() {
    sliderRefs = {};
    const hdr = document.createElement("h3");
    hdr.textContent = `Layout · <${targetEl?.tagName.toLowerCase()}>`;
    controlsWrap.appendChild(hdr);
    addRange("st-block-offx", "Move X (px)", -800, 800, 1, "offsetX", "px");
    addRange("st-block-offy", "Move Y (px)", -800, 800, 1, "offsetY", "px");
    addRange("st-block-widthpx", "Width (px)", 24, 2600, 1, "widthPx", "px");
    addRange("st-block-heightpx", "Height (px)", 24, 1800, 1, "heightPx", "px");
    const mwInit = (state.maxWidth ?? 9999) >= 9990 ? 1200 : state.maxWidth;
    const mwRange = mkRange("st-mw", "Size (max width)", 100, 2400, 4, mwInit, "px", (n) => { state.maxWidth = n; apply(); });
    mwRange.unit = "px";
    regSlider("maxWidth", mwRange);
    appendAll(controlsWrap, mwRange.row, mwRange.input);

    addRange("st-pt", "Padding Top", 0, 200, 1, "paddingTop", "px");
    addRange("st-pb", "Padding Bottom", 0, 200, 1, "paddingBottom", "px");
    addRange("st-pl", "Padding Left", 0, 120, 1, "paddingLeft", "px");
    addRange("st-pr", "Padding Right", 0, 120, 1, "paddingRight", "px");
    addRange("st-mt", "Margin Top", -100, 200, 1, "marginTop", "px");
    addRange("st-mb", "Margin Bottom", -100, 200, 1, "marginBottom", "px");
    if (["flex","inline-flex","grid","inline-grid"].includes(state.display || ""))
      addRange("st-gap", "Gap", 0, 120, 1, "gap", "px");
  }

  // ── Selection logic ──
  function selectHomeHeroTarget(sourceEl = null) {
    homeHeroEl = sourceEl || document.querySelector(HOME_HERO_SELECTOR);
    if (!homeHeroEl) return;
    clearSelected();
    targetMode = "home-hero";
    currentTargetCatalogKey = "home:hero-background";
    state = { ...readStateFromHomeHero(homeHeroEl) };
    snapshot = { ...state };
    if (panelOpen) setHomeHeroTarget(homeHeroEl);
    updateHomeHeroSelInfo();
    buildControls();
    apply();
  }

  function selectShellHeaderTarget(sourceEl = null) {
    shellHeaderEl = sourceEl || document.querySelector(SHELL_HEADER_SELECTOR);
    if (!shellHeaderEl) return;
    clearSelected();
    targetMode = "shell-header";
    currentTargetCatalogKey = "shell:header-background";
    state = { ...readStateFromShellHeader(shellHeaderEl) };
    snapshot = { ...state };
    if (panelOpen) setSelected(shellHeaderEl);
    updateShellHeaderSelInfo();
    buildControls();
    apply();
  }

  function selectPanelArtTarget(sourceEl = null) {
    panelArtEl = sourceEl instanceof HTMLElement ? sourceEl : null;
    if (!panelArtEl) return;
    clearSelected();
    targetMode = "panel-art";
    state = { ...readStateFromPanelArt(panelArtEl) };
    snapshot = { ...state };
    const match = pageTargetCatalog.find((item) => item.element === panelArtEl && item.action === "panel-art");
    currentTargetCatalogKey = match?.key || currentTargetCatalogKey;
    if (panelOpen) setSelected(panelArtEl);
    updatePanelArtSelInfo();
    buildControls();
    apply();
  }

  function selectResumeTarget(targetKey = "photo-crop", sourceCard = null) {
    cardEl = sourceCard || document.querySelector(".resume-header-card");
    if (!cardEl) return;
    clearSelected();
    targetMode = "resume";
    resumeTargetKey = targetKey;
    currentTargetCatalogKey = `resume:${targetKey}`;
    state = { ...readStateFromCard(cardEl) };
    snapshot = { ...state };
    if (panelOpen) setResumeTargets(cardEl);
    updateResumeSelInfo();
    buildControls();
    apply();
  }

  function selectResumeCard() {
    selectResumeTarget("photo-crop");
  }

  function selectImg(img) {
    if (isExcludedImage(img)) return;
    setSelected(img);
    targetMode = "img";
    state = { ...readStateFromImg(img) };
    snapshot = { ...state };
    img.dataset.stOrig = img.getAttribute("style") || "";
    const currentCatalogItem = pageTargetCatalog.find((item) => item.key === currentTargetCatalogKey);
    if (!currentCatalogItem || currentCatalogItem.element !== img) {
      currentTargetCatalogKey = pageTargetCatalog.find((item) => item.element === img && item.action === "img")?.key || "";
    }
    const { selector, confidence } = generateSelector(img);
    updateSelInfo("img", selector, confidence);
    buildControls();
    apply();
  }

  function selectGenericEl(el) {
    if (isExcludedFromSelection(el)) return;
    if (isPanelArtEl(el)) {
      selectPanelArtTarget(el);
      return;
    }
    // If it's an image, use the image path (unless excluded)
    if (el.tagName === "IMG") { if (!isExcludedImage(el)) selectImg(el); return; }
    // Resume header card: use named resume targets on resume page
    if (page === "resume" && el.closest(".resume-header-card")) {
      const card = el.closest(".resume-header-card");
      if (el.closest(".resume-photo-wrap img")) { selectResumeTarget("photo-crop", card); return; }
      if (el.closest(".resume-photo-wrap")) { selectResumeTarget("photo-frame", card); return; }
      selectResumeTarget("background", card);
      return;
    }
    clearSelected();
    setSelected(el);
    const kind = detectElementKind(el);
    targetMode = kind; // "text" | "block"
    el.dataset.stOrig = el.getAttribute("style") || "";
    if (kind === "text") {
      state = { ...readStateFromText(el) };
    } else {
      state = { ...readStateFromBlock(el) };
    }
    snapshot = { ...state };
    const currentCatalogItem = pageTargetCatalog.find((item) => item.key === currentTargetCatalogKey);
    if (!currentCatalogItem || currentCatalogItem.element !== el) {
      currentTargetCatalogKey = pageTargetCatalog.find((item) => item.element === el && item.action !== "img")?.key || "";
    }
    const { selector, confidence } = generateSelector(el);
    updateSelInfo(el.tagName.toLowerCase(), selector, confidence);
    buildControls();
    apply();
  }

  function deselect() {
    clearSelected();
    currentTargetCatalogKey = "";
    targetMode = page === "resume" ? "none" : "none";
    resumeTargetKey = "photo-crop";
    state = null;
    snapshot = null;
    sliderRefs = {};
    if (targetsWrap) {
      renderTargets();
    }
    selInfoEl.textContent = "No element selected";
    noSelEl.hidden = false;
    controlsWrap.style.display = "none";
    controlsWrap.innerHTML = "";
    readoutEl.hidden = true;
    syncLivePageLedger();
  }

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if (!panelOpen) return;
    if (e.key === "Escape") {
      if (state) { deselect(); }
      else { closePanel(); }
      return;
    }
    if (!state) return;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    const amount = e.shiftKey ? 5 : 1;
    if (nudgeSelectedTarget(e.key, amount)) {
      e.preventDefault();
    }
  });

  // ── Page init: load saved state → restore inline styles → sync ledger ──
  void (async () => {
    if (page === "resume") {
      const card = document.querySelector(".resume-header-card");
      if (card) {
        cardEl = card;
        await loadResumeJson(card);
        // Resume card uses its own JSON, but panel-art/background targets on
        // this page are restored from css/tune-state/resume.json.
        await loadPageState(page);
        _resumeBaseline = { ...readStateFromCard(card) };
        selectResumeCard();
      }
    } else {
      // Restore saved element states from css/tune-state/{page}.json
      // before the first ledger sync so sliders initialise from correct values.
      await loadPageState(page);
      deselect();
    }
    syncLivePageLedger();
    // Auto-open via ?tune or #tune
    const params = new URLSearchParams(location.search);
    if (params.has("tune") || location.hash === "#tune") openPanel();
  })();
}
