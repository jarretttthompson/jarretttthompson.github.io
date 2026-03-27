/**
 * site-tune.js — Unified site editor: image tuning + element layout + change ledger.
 *
 * One panel, one tab ("Tune ▸"), every page.
 *
 * Modes:
 *   resume  Auto-selected on /resume. Reads CSS vars + JSON persistence.
 *           Sliders: posX/Y, scale, wrapWidth/OffsetX/OffsetY, bgPos/Zoom.
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
const HOME_HERO_SELECTOR = "#site-home-hero";

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
  el.style.width = `${Math.max(v.widthPx ?? 1, 1)}px`;
  el.style.height = `${Math.max(v.heightPx ?? 1, 1)}px`;
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

  return diffs;
}

// ─── Change Ledger ────────────────────────────────────────────────────────────

let _ledger = [];
let _changeId = 0;
let _ledgerContainer = null; // set during buildPanel
let _baselineByElement = new WeakMap();
let _resumeBaseline = null;
let _liveLedgerFrame = 0;

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
  if (_ledger.length === 0) {
    const p = document.createElement("p");
    p.style.cssText = "color:rgba(180,230,200,0.4);font-size:11px;margin:6px 0 0;line-height:1.6;";
    p.textContent = "Current document matches the saved baseline.";
    _ledgerContainer.appendChild(p);
    return;
  }
  const hdr = document.createElement("p");
  hdr.style.cssText = "color:#00ff9f;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;font-weight:600;";
  hdr.textContent = `Current page snapshot (${_ledger.length})`;
  _ledgerContainer.appendChild(hdr);
  for (const entry of [..._ledger]) {
    const card = document.createElement("div");
    card.style.cssText = "margin-bottom:9px;padding:9px 10px;background:rgba(0,255,159,0.05);border:1px solid rgba(0,255,159,0.2);border-radius:6px;";
    const selRow = document.createElement("div");
    selRow.style.cssText = "display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:5px;";
    const selSpan = document.createElement("span");
    selSpan.textContent = entry.selector;
    selSpan.style.cssText = "font-size:11px;color:#a8ffd4;word-break:break-all;flex:1;";
    const badge = document.createElement("span");
    badge.textContent = entry.selectorConfidence;
    badge.style.cssText = `font-size:9px;padding:1px 5px;border-radius:3px;white-space:nowrap;background:${confBg(entry.selectorConfidence)};`;
    selRow.appendChild(selSpan);
    selRow.appendChild(badge);
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
    lines.push(`${entry.selector} {`);
    for (const diff of entry.diffs) {
      lines.push(`  ${diff.property}: ${diff.after};`);
    }
    lines.push("}");
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
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
  const res = await fetch("/__site_tune/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      css: buildCurrentCssSnapshot(entries),
      page: document.body.getAttribute("data-page") || location.pathname,
      savedAt: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Save failed (${res.status})`);
  }
  return res.json().catch(() => ({}));
}

function readStateForElement(el) {
  if (!el) return null;
  if (isHomeHeroEl(el)) return readStateFromHomeHero(el);
  const kind = detectElementKind(el);
  if (kind === "img") return readStateFromImg(el);
  if (kind === "text") return readStateFromText(el);
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
  for (const item of buildPageTargetCatalog()) {
    if (!item?.element || item.key.startsWith("resume:")) continue;
    if (seen.has(item.element)) continue;
    seen.add(item.element);
    const styleAttr = item.element.getAttribute("style") || "";
    if (!styleAttr.trim()) continue;
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

    /* Selected highlight + flash */
    @keyframes st-select-flash {
      from { box-shadow: inset 0 0 0 3px #00ff9f, 0 0 32px rgba(0,255,159,0.65); }
      to   { box-shadow: inset 0 0 0 2px rgba(0,255,159,0.9), 0 0 16px rgba(0,255,159,0.3); }
    }
    .st-selected {
      outline: 2px solid #00ff9f !important;
      outline-offset: 1px !important;
      position: relative !important;
      z-index: 5 !important;
      animation: st-select-flash 0.45s ease-out 1;
    }
    .st-home-hero-target {
      outline: 2px dashed rgba(120,220,255,0.95) !important;
      outline-offset: 4px !important;
      box-shadow:
        inset 0 0 0 2px rgba(120,220,255,0.26),
        0 0 18px rgba(120,220,255,0.22) !important;
      animation: st-select-flash 0.45s ease-out 1;
    }
    @keyframes st-resume-bg-pulse {
      from {
        box-shadow: inset 0 0 0 2px rgba(255,65,175,0.85), 0 0 28px rgba(255,65,175,0.38);
      }
      to {
        box-shadow: inset 0 0 0 2px rgba(255,65,175,0.55), 0 0 14px rgba(255,65,175,0.22);
      }
    }
    .st-resume-bg-target {
      outline: 2px dashed rgba(255,65,175,0.92) !important;
      outline-offset: 4px !important;
      animation: st-resume-bg-pulse 0.55s ease-out 1;
    }
    .st-resume-frame-target {
      outline: 3px solid rgba(120,220,255,0.95) !important;
      outline-offset: 2px !important;
      position: relative !important;
      z-index: 6 !important;
      box-shadow:
        inset 0 0 0 1px rgba(120,220,255,0.75),
        0 0 0 2px rgba(120,220,255,0.28),
        0 0 22px rgba(120,220,255,0.25) !important;
      animation: st-select-flash 0.45s ease-out 1;
    }
    .st-resume-crop-target {
      outline: 3px solid rgba(0,255,159,0.96) !important;
      outline-offset: 2px !important;
      position: relative !important;
      z-index: 6 !important;
      box-shadow:
        inset 0 0 0 2px rgba(0,255,159,0.68),
        0 0 0 2px rgba(0,255,159,0.18),
        0 0 18px rgba(0,255,159,0.18) !important;
      animation: st-select-flash 0.45s ease-out 1;
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
      padding: 5px 8px;
      border-radius: 999px;
      background: rgba(8, 4, 18, 0.92);
      border: 1px solid rgba(0,255,159,0.55);
      color: #00ff9f;
      font: 600 11px/1.2 ui-monospace, monospace;
      letter-spacing: 0.04em;
      box-shadow: 0 6px 18px rgba(0,0,0,0.4), 0 0 12px rgba(0,255,159,0.18);
      white-space: nowrap;
    }
    #st-overlay-badge[hidden] {
      display: none !important;
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
  let targetMode = page === "resume" ? "resume" : "none"; // resume | home-hero | img | text | block | none
  let cardEl = null;
  let homeHeroEl = null;
  let targetEl = null; // the currently selected non-resume element
  let resumeTargetKey = "photo-crop";
  let state = null;
  let snapshot = null;
  let panelOpen = false;

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
      await saveOverridesToFiles(entries);
      flashBtn(saveBtn, entries.length ? `💾 Saved ${entries.length}` : "💾 Saved!");
    } catch (err) {
      console.warn("[site-tune] save failed:", err);
      const msg = String(err?.message || err || "");
      if (msg.includes("404") || msg.includes("Not found")) flashBtn(saveBtn, "restart server");
      else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) flashBtn(saveBtn, "server offline");
      else flashBtn(saveBtn, "save failed");
    }
  });
  const snapshotBtn = mkStBtn("⎘ Copy Page Changes", "st-btn-primary", () => {
    const entries = syncLivePageLedger();
    doExport("copy", entries);
    flashBtn(snapshotBtn, entries.length ? `⎘ ${entries.length} copied` : "⎘ copied");
  });
  const clearLedgerBtn = mkStBtn("🗑 Clear", "", () => {
    if (_ledger.length === 0) return;
    if (confirm("Clear the current snapshot list?")) { _ledger = []; _changeId = 0; renderLedger(); }
  });
  appendAll(exportRow, saveBtn, snapshotBtn, clearLedgerBtn);
  appendAll(ledgerWrap, ledgerTitle, _ledgerContainer, exportRow);

  appendAll(panel, closeBtn, titleEl, intro, targetsWrap, selInfoEl, noSelEl, controlsWrap, readoutEl, ledgerWrap);

  document.body.appendChild(tab);
  document.body.appendChild(panel);
  document.body.appendChild(overlayBadgeEl);

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
    const order = ["Home", "Resume", "Images", "Image Frames", "Text", "Containers"];
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

  function getCurrentTargetKey() {
    if (currentTargetCatalogKey) return currentTargetCatalogKey;
    if (targetMode === "home-hero") return "home:hero-background";
    if (targetMode === "resume") return `resume:${resumeTargetKey}`;
    if (!targetEl) return "";
    const match = pageTargetCatalog.find((item) => item.element === targetEl);
    return match?.key || "";
  }

  function selectTargetByKey(key) {
    if (!key) return;
    currentTargetCatalogKey = key;
    if (key.startsWith("home:")) {
      selectHomeHeroTarget();
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
    overlayBadgeEl.textContent =
      targetMode === "home-hero"
        ? homeHeroTargetLabel()
        : targetMode === "resume"
          ? resumeTargetLabel(resumeTargetKey)
          : humanizeKind(targetMode);
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
    appendAll(targetsWrap, title, pageTargetSelect);
  }

  // ── Panel open/close ──
  function openPanel() {
    panelOpen = true;
    panel.hidden = false;
    tab.setAttribute("aria-expanded", "true");
    tab.style.display = "none";
    document.body.classList.add("site-tune-panel-open");
    renderTargets();
    syncOverlayBadge();
  }

  function closePanel() {
    panelOpen = false;
    panel.hidden = true;
    tab.setAttribute("aria-expanded", "false");
    tab.style.removeProperty("display");
    document.body.classList.remove("site-tune-panel-open");
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
    if (overlayBadgeEl) overlayBadgeEl.hidden = true;
  }

  function setSelected(el) {
    clearSelected();
    if (!el) return;
    void el.offsetWidth; // reflow → replay animation
    el.classList.add("st-selected");
    targetEl = el;
    syncOverlayBadge();
  }

  function setResumeTargets(card) {
    clearSelected();
    if (!card) return;
    const parts = getResumeParts(card);
    if (resumeTargetKey === "background" && parts.background) parts.background.classList.add("st-resume-bg-target");
    if (resumeTargetKey === "photo-frame" && parts["photo-frame"]) parts["photo-frame"].classList.add("st-resume-frame-target");
    if (resumeTargetKey === "photo-crop" && parts["photo-crop"] && !isExcludedImage(parts["photo-crop"])) {
      if (parts["photo-frame"]) parts["photo-frame"].classList.add("st-resume-crop-target");
      parts["photo-crop"].classList.add("st-resume-photo-target");
    }
    syncOverlayBadge();
  }

  function setHomeHeroTarget(section) {
    clearSelected();
    if (!section) return;
    section.classList.add("st-home-hero-target");
    syncOverlayBadge();
  }

  // ── Apply current state ──
  function apply() {
    if (!state) return;
    if (targetMode === "home-hero" && homeHeroEl) applyStateToHomeHero(homeHeroEl, state);
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

  // ── Build context-aware controls ──
  function buildControls() {
    controlsWrap.innerHTML = "";
    renderTargets();
    if (!state) return;

    if (targetMode === "resume") {
      buildResumeControls();
    } else if (targetMode === "home-hero") {
      buildHomeHeroControls();
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

  // ── Resume page init: load JSON + auto-select card ──
  void (async () => {
    if (page === "resume") {
      const card = document.querySelector(".resume-header-card");
      if (card) {
        cardEl = card;
        await loadResumeJson(card);
        _resumeBaseline = { ...readStateFromCard(card) };
        selectResumeCard();
      }
    } else {
      deselect();
    }
    syncLivePageLedger();
    // Auto-open via ?tune or #tune
    const params = new URLSearchParams(location.search);
    if (params.has("tune") || location.hash === "#tune") openPanel();
  })();
}
