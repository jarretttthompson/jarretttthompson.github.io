/**
 * Site image tuning: floating side panel + select any <img> (slideshows excluded).
 * With the panel open: click a photo to tune it. Alt+click works anytime.
 * Resume page: loads css/resume-photo-tune.values.json onto .resume-header-card when present.
 */

const JSON_PATH = "css/resume-photo-tune.values.json";

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
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
    if (p.length >= 4) return p[0];
  }
  const s = tr.match(/scale\(\s*([\d.]+)/);
  if (s) return parseFloat(s[1]);
  return 1;
}

function readStateFromCard(card) {
  const cs = getComputedStyle(card);
  let wrapWidthPct = parseFloat(cs.getPropertyValue("--resume-photo-wrap-width-pct"));
  if (Number.isNaN(wrapWidthPct)) wrapWidthPct = 100;
  let wrapOffsetXVw = parseFloat(cs.getPropertyValue("--resume-photo-wrap-offset-x-vw"));
  if (Number.isNaN(wrapOffsetXVw)) wrapOffsetXVw = 0;
  let wrapOffsetYVh = parseFloat(cs.getPropertyValue("--resume-photo-wrap-offset-y-vh"));
  if (Number.isNaN(wrapOffsetYVh)) wrapOffsetYVh = 0;
  let widthPct = parseFloat(cs.getPropertyValue("--resume-title-photo-width-pct"));
  if (Number.isNaN(widthPct)) widthPct = 100;
  let bandHeightVh = parseFloat(cs.getPropertyValue("--resume-title-photo-band-height-vh"));
  if (Number.isNaN(bandHeightVh)) bandHeightVh = 22;
  const op = parseObjectPosition(cs.getPropertyValue("--resume-title-photo-object-position").trim() || "50% 35%");
  let bgPosX = parseFloat(cs.getPropertyValue("--resume-header-bg-pos-x"));
  if (Number.isNaN(bgPosX)) bgPosX = 50;
  let bgPosY = parseFloat(cs.getPropertyValue("--resume-header-bg-pos-y"));
  if (Number.isNaN(bgPosY)) bgPosY = 50;
  let bgSizePct = parseFloat(cs.getPropertyValue("--resume-header-bg-size-pct"));
  if (Number.isNaN(bgSizePct)) bgSizePct = 100;
  return {
    posX: op.x,
    posY: op.y,
    scale: parseFloat(cs.getPropertyValue("--resume-title-photo-scale")) || 1,
    bgPosX: clamp(bgPosX, 0, 100),
    bgPosY: clamp(bgPosY, 0, 100),
    bgSizePct: clamp(bgSizePct, 100, 200),
    wrapWidthPct: clamp(wrapWidthPct, 40, 100),
    wrapOffsetXVw: clamp(wrapOffsetXVw, -12, 12),
    wrapOffsetYVh: clamp(wrapOffsetYVh, -12, 12),
    widthPct: clamp(widthPct, 40, 100),
    bandHeightVh: clamp(bandHeightVh, 8, 55),
    objectFit: cs.getPropertyValue("--resume-title-photo-object-fit").trim() || "cover",
    maxHeight: cs.getPropertyValue("--resume-title-photo-max-height").trim() || "none",
  };
}

function readStateFromImg(img) {
  const cs = getComputedStyle(img);
  const op = parseObjectPosition(cs.objectPosition || "50% 50%");
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
  else if (ch.endsWith("px") && window.innerHeight > 0) {
    bandHeightVh = clamp((parseFloat(ch) / window.innerHeight) * 100, 8, 55);
  }
  return {
    posX: op.x,
    posY: op.y,
    scale: parseTransformScale(cs),
    useBandLayout,
    bgPosX: 50,
    bgPosY: 50,
    bgSizePct: 100,
    wrapWidthPct: 100,
    wrapOffsetXVw: 0,
    wrapOffsetYVh: 0,
    widthPct,
    bandHeightVh,
    objectFit: cs.objectFit || "cover",
    maxHeight: cs.maxHeight || "none",
  };
}

function applyVarsToCard(card, v) {
  if (typeof v.bgPosX === "number") {
    card.style.setProperty("--resume-header-bg-pos-x", String(clamp(v.bgPosX, 0, 100)));
  }
  if (typeof v.bgPosY === "number") {
    card.style.setProperty("--resume-header-bg-pos-y", String(clamp(v.bgPosY, 0, 100)));
  }
  if (typeof v.bgSizePct === "number") {
    card.style.setProperty("--resume-header-bg-size-pct", String(clamp(v.bgSizePct, 100, 200)));
  }
  if (typeof v.wrapWidthPct === "number" && v.wrapWidthPct > 0) {
    card.style.setProperty("--resume-photo-wrap-width-pct", String(clamp(v.wrapWidthPct, 40, 100)));
  }
  if (typeof v.wrapOffsetXVw === "number") {
    card.style.setProperty("--resume-photo-wrap-offset-x-vw", String(clamp(v.wrapOffsetXVw, -12, 12)));
  }
  if (typeof v.wrapOffsetYVh === "number") {
    card.style.setProperty("--resume-photo-wrap-offset-y-vh", String(clamp(v.wrapOffsetYVh, -12, 12)));
  }
  if (typeof v.widthPct === "number" && v.widthPct > 0) {
    card.style.setProperty("--resume-title-photo-width-pct", String(clamp(v.widthPct, 40, 100)));
  }
  if (typeof v.bandHeightVh === "number" && v.bandHeightVh > 0) {
    card.style.setProperty("--resume-title-photo-band-height-vh", String(clamp(v.bandHeightVh, 8, 55)));
  }
  if (v.objectFit != null) card.style.setProperty("--resume-title-photo-object-fit", v.objectFit);
  if (v.objectPosition != null) card.style.setProperty("--resume-title-photo-object-position", v.objectPosition);
  if (v.posX != null && v.posY != null) {
    card.style.setProperty("--resume-title-photo-object-position", `${v.posX}% ${v.posY}%`);
  }
  if (v.scale != null) card.style.setProperty("--resume-title-photo-scale", String(v.scale));
  if (v.maxHeight != null) card.style.setProperty("--resume-title-photo-max-height", v.maxHeight);
}

function getExportState(state) {
  const objectPosition = `${clamp(state.posX, 0, 100)}% ${clamp(state.posY, 0, 100)}%`;
  return {
    bgPosX: state.bgPosX ?? 50,
    bgPosY: state.bgPosY ?? 50,
    bgSizePct: state.bgSizePct ?? 100,
    wrapWidthPct: state.wrapWidthPct ?? 100,
    wrapOffsetXVw: state.wrapOffsetXVw ?? 0,
    wrapOffsetYVh: state.wrapOffsetYVh ?? 0,
    widthPct: state.widthPct,
    bandHeightVh: state.bandHeightVh,
    objectFit: state.objectFit,
    objectPosition,
    scale: state.scale,
    maxHeight: state.maxHeight,
  };
}

function applyStateToCard(card, state) {
  const v = getExportState(state);
  card.style.setProperty("--resume-header-bg-pos-x", String(clamp(state.bgPosX ?? 50, 0, 100)));
  card.style.setProperty("--resume-header-bg-pos-y", String(clamp(state.bgPosY ?? 50, 0, 100)));
  card.style.setProperty("--resume-header-bg-size-pct", String(clamp(state.bgSizePct ?? 100, 100, 200)));
  card.style.setProperty(
    "--resume-photo-wrap-width-pct",
    String(clamp(state.wrapWidthPct ?? 100, 40, 100)),
  );
  card.style.setProperty(
    "--resume-photo-wrap-offset-x-vw",
    String(clamp(state.wrapOffsetXVw ?? 0, -12, 12)),
  );
  card.style.setProperty(
    "--resume-photo-wrap-offset-y-vh",
    String(clamp(state.wrapOffsetYVh ?? 0, -12, 12)),
  );
  card.style.setProperty("--resume-title-photo-width-pct", String(clamp(state.widthPct, 40, 100)));
  card.style.setProperty("--resume-title-photo-band-height-vh", String(clamp(state.bandHeightVh, 8, 55)));
  card.style.setProperty("--resume-title-photo-object-position", v.objectPosition);
  card.style.setProperty("--resume-title-photo-scale", String(clamp(state.scale, 1, 2.75)));
  card.style.setProperty("--resume-title-photo-object-fit", state.objectFit);
  card.style.setProperty("--resume-title-photo-max-height", state.maxHeight);
}

function applyStateToImg(img, state) {
  const v = getExportState(state);
  img.style.objectFit = state.objectFit || "cover";
  img.style.objectPosition = v.objectPosition;
  img.style.transform = `scale(${clamp(state.scale, 0.25, 3)})`;
  img.style.transformOrigin = "center center";
  if (state.useBandLayout === true) {
    img.style.width = `${clamp(state.widthPct, 40, 100)}%`;
    img.style.height = `${clamp(state.bandHeightVh, 8, 55)}vh`;
    img.style.maxHeight = state.maxHeight === "none" ? "none" : state.maxHeight;
    img.style.aspectRatio = "auto";
  } else {
    img.style.removeProperty("width");
    img.style.removeProperty("height");
    img.style.removeProperty("max-height");
    img.style.removeProperty("aspect-ratio");
  }
}

function buildCssBlockResume(v) {
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
  --resume-title-photo-object-position: ${v.objectPosition};
  --resume-title-photo-scale: ${v.scale};
  --resume-title-photo-max-height: ${v.maxHeight};
}
`;
}

function buildCssBlockImg(v) {
  return `/* Paste on the selected <img> as style="" or in CSS */
object-fit: ${v.objectFit};
object-position: ${v.objectPosition};
transform: scale(${v.scale});
transform-origin: center center;
width: ${v.widthPct}%;
height: ${v.bandHeightVh}vh;
aspect-ratio: auto;
`;
}

function buildJsonExportResume(v) {
  return `${JSON.stringify(
    {
      version: 5,
      resumeTitlePhoto: {
        bgPosX: v.bgPosX,
        bgPosY: v.bgPosY,
        bgSizePct: v.bgSizePct,
        wrapWidthPct: v.wrapWidthPct,
        wrapOffsetXVw: v.wrapOffsetXVw,
        wrapOffsetYVh: v.wrapOffsetYVh,
        widthPct: v.widthPct,
        bandHeightVh: v.bandHeightVh,
        objectFit: v.objectFit,
        objectPosition: v.objectPosition,
        scale: v.scale,
        maxHeight: v.maxHeight,
      },
    },
    null,
    2,
  )}\n`;
}

function buildJsonExportImg(v, hint) {
  return `${JSON.stringify(
    {
      version: 2,
      imageTune: {
        hint: hint || "",
        widthPct: v.widthPct,
        bandHeightVh: v.bandHeightVh,
        objectFit: v.objectFit,
        objectPosition: v.objectPosition,
        scale: v.scale,
        maxHeight: v.maxHeight,
      },
    },
    null,
    2,
  )}\n`;
}

async function applyResumeJsonIfPresent(card) {
  try {
    const r = await fetch(JSON_PATH, { cache: "no-store" });
    if (!r.ok) return;
    const data = await r.json();
    const p = data?.resumeTitlePhoto;
    if (!p || typeof p !== "object") return;
    const hasLayout =
      typeof p.widthPct === "number" && typeof p.bandHeightVh === "number";
    if (hasLayout) {
      applyVarsToCard(card, {
        bgPosX: typeof p.bgPosX === "number" ? p.bgPosX : 50,
        bgPosY: typeof p.bgPosY === "number" ? p.bgPosY : 50,
        bgSizePct: typeof p.bgSizePct === "number" ? p.bgSizePct : 100,
        wrapWidthPct: typeof p.wrapWidthPct === "number" ? p.wrapWidthPct : 100,
        wrapOffsetXVw: typeof p.wrapOffsetXVw === "number" ? p.wrapOffsetXVw : 0,
        wrapOffsetYVh: typeof p.wrapOffsetYVh === "number" ? p.wrapOffsetYVh : 0,
        widthPct: p.widthPct,
        bandHeightVh: p.bandHeightVh,
        objectFit: p.objectFit,
        objectPosition: p.objectPosition,
        scale: typeof p.scale === "number" ? p.scale : undefined,
        maxHeight: p.maxHeight,
      });
      return;
    }
    applyVarsToCard(card, {
      bgPosX: 50,
      bgPosY: 50,
      bgSizePct: 100,
      wrapWidthPct: 100,
      wrapOffsetXVw: 0,
      wrapOffsetYVh: 0,
      widthPct: 100,
      bandHeightVh: 22,
      objectFit: p.objectFit,
      objectPosition: p.objectPosition,
      scale: typeof p.scale === "number" ? p.scale : undefined,
      maxHeight: p.maxHeight,
    });
  } catch {
    /* missing or invalid */
  }
}

function injectPanelStyles() {
  const id = "image-tune-panel-styles";
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = `
    #image-tune-tab {
      position: fixed !important;
      top: 50% !important;
      right: 0 !important;
      left: auto !important;
      bottom: auto !important;
      transform: translateY(-50%) !important;
      z-index: 2147483000;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      padding: 14px 8px;
      font: 600 13px/1.2 ui-monospace, monospace;
      letter-spacing: 0.06em;
      color: #0a1620;
      background: linear-gradient(180deg, rgba(0, 255, 159, 0.92), rgba(0, 200, 130, 0.88));
      border: 1px solid rgba(0, 255, 159, 0.6);
      border-right: none;
      border-radius: 10px 0 0 10px;
      cursor: pointer;
      box-shadow: -4px 0 18px rgba(0,0,0,0.35);
    }
    #image-tune-tab:hover { filter: brightness(1.06); }
    #image-tune-tab[aria-expanded="true"] { display: none !important; }
    #image-tune-panel {
      position: fixed !important;
      top: 0 !important;
      right: 0 !important;
      left: auto !important;
      bottom: 0 !important;
      width: min(360px, 100vw) !important;
      height: 100vh !important;
      height: 100dvh !important;
      max-height: none !important;
      margin: 0 !important;
      overflow-y: auto !important;
      box-sizing: border-box !important;
      z-index: 2147482999;
      padding: 16px;
      padding-top: 48px;
      font: 13px/1.45 ui-monospace, monospace;
      color: #e8fff0;
      background: rgba(8, 4, 18, 0.97);
      border-left: 2px solid rgba(0, 255, 159, 0.55);
      box-shadow: -8px 0 40px rgba(0,0,0,0.55);
    }
    #image-tune-panel[hidden] { display: none !important; }
    #image-tune-panel h2 {
      margin: 0 0 12px;
      font-size: 15px;
      font-weight: 600;
      color: #00ff9f;
    }
    #image-tune-panel label {
      display: block;
      margin: 12px 0 4px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.85;
    }
    #image-tune-panel input[type="range"] {
      width: 100%;
      accent-color: #00ff9f;
    }
    #image-tune-panel .image-tune-value {
      font-size: 12px;
      opacity: 0.9;
      margin-bottom: 2px;
    }
    #image-tune-readout {
      margin-top: 16px;
      padding: 12px;
      background: rgba(0,0,0,0.45);
      border: 1px solid rgba(0, 255, 159, 0.35);
      border-radius: 8px;
      font-size: 12px;
      line-height: 1.55;
      white-space: pre;
      user-select: text;
    }
    #image-tune-readout strong {
      display: block;
      margin-bottom: 8px;
      color: #00ff9f;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    #image-tune-panel .image-tune-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }
    #image-tune-panel .image-tune-actions button {
      cursor: pointer;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid rgba(0, 255, 159, 0.45);
      background: rgba(0, 50, 36, 0.55);
      color: #e8fff4;
      font: inherit;
      font-size: 11px;
    }
    #image-tune-panel .image-tune-actions button:hover { filter: brightness(1.1); }
    #image-tune-close {
      position: absolute !important;
      top: 10px !important;
      right: 10px !important;
      padding: 4px 10px;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      color: #e8fff4;
      background: transparent;
      border: 1px solid rgba(0, 255, 159, 0.35);
      border-radius: 6px;
    }
    /* Inset ring survives parents with overflow:hidden; outer glow + pulse on pick */
    @keyframes image-tune-select-flash {
      0% {
        box-shadow:
          inset 0 0 0 4px #00ff9f,
          inset 0 0 40px rgba(0, 255, 159, 0.2),
          0 0 0 3px rgba(0, 255, 159, 0.85),
          0 0 36px rgba(0, 255, 159, 0.55);
      }
      100% {
        box-shadow:
          inset 0 0 0 3px rgba(0, 255, 159, 0.95),
          inset 0 0 28px rgba(0, 255, 159, 0.14),
          0 0 0 2px rgba(0, 255, 159, 0.75),
          0 0 22px rgba(0, 255, 159, 0.4);
      }
    }
    body.image-tune-panel-open img.image-tune--selected,
    img.image-tune--selected {
      outline: 3px solid #00ff9f !important;
      outline-offset: 1px;
      position: relative;
      z-index: 5 !important;
      filter: drop-shadow(0 0 10px rgba(0, 255, 159, 0.85)) !important;
      box-shadow:
        inset 0 0 0 3px rgba(0, 255, 159, 0.95),
        inset 0 0 28px rgba(0, 255, 159, 0.14),
        0 0 0 2px rgba(0, 255, 159, 0.75),
        0 0 22px rgba(0, 255, 159, 0.4) !important;
      animation: image-tune-select-flash 0.55s ease-out 1;
    }
  `;
  document.head.appendChild(s);
}

function isExcludedImage(img, opts = {}) {
  if (!img || img.tagName !== "IMG") return true;
  const allowSlideshow = !!opts.allowSlideshow;
  if (!allowSlideshow) {
    if (img.closest(".slideshow")) return true;
    if (img.closest(".projects-slideshow")) return true;
    if (img.closest(".poster-carousel")) return true;
    if (img.closest(".carousel")) return true;
  }
  if (img.closest("#image-tune-panel")) return true;
  if (img.closest("#image-tune-tab")) return true;
  if (img.closest(".site-header-logo-wrap")) return true;
  if (img.classList.contains("site-header-logo")) return true;
  if (img.naturalWidth > 0 && img.naturalHeight > 0 && img.naturalWidth < 40 && img.naturalHeight < 40) return true;
  return false;
}

function updateReadoutEl(el, state, mode) {
  const v = getExportState(state);
  const modeLine = `target: ${mode}`;
  const resumeCard = mode === "resume-header-card";
  const bgLines =
    resumeCard && typeof state.bgPosX === "number"
      ? `
bgPosX: ${state.bgPosX.toFixed(2)}
bgPosY: ${state.bgPosY.toFixed(2)}
bgSizePct: ${state.bgSizePct.toFixed(2)}`
      : "";
  const wrapLines =
    resumeCard && typeof state.wrapWidthPct === "number"
      ? `
wrapWidthPct: ${state.wrapWidthPct.toFixed(2)}
wrapOffsetXVw: ${(state.wrapOffsetXVw ?? 0).toFixed(2)}
wrapOffsetYVh: ${(state.wrapOffsetYVh ?? 0).toFixed(2)}`
      : "";
  el.innerHTML = `<strong>Screenshot these numbers for Cursor</strong>${modeLine}
positionX: ${state.posX.toFixed(2)}
positionY: ${state.posY.toFixed(2)}
scale: ${state.scale.toFixed(3)}${bgLines}${wrapLines}
widthPct: ${state.widthPct.toFixed(2)}
bandHeightVh: ${state.bandHeightVh.toFixed(2)}
objectPosition: ${v.objectPosition}
maxHeight: ${v.maxHeight}`;
}

export function initImageTuning() {
  if (!document.body?.hasAttribute("data-terminal-site")) return;
  if (location.pathname.includes("/breakcomposer")) return;

  injectPanelStyles();

  const page = document.body.getAttribute("data-page");
  let targetMode = page === "resume" ? "resume" : "none";
  let cardEl = null;
  let imgEl = null;
  let state = null;
  let snapshot = null;
  let p1;
  let p2;
  let p3;
  let p4;
  let p5;
  let p6;
  let p7;
  let p8;
  let p9;
  let p10;
  let p11;
  let wrapSlidersRow = null;
  let bgSlidersRow = null;
  let readoutEl;

  function apply() {
    if (!state) return;
    if (targetMode === "resume" && cardEl) applyStateToCard(cardEl, state);
    if (targetMode === "img" && imgEl) applyStateToImg(imgEl, state);
    if (readoutEl) {
      const label =
        targetMode === "resume"
          ? "resume-header-card"
          : targetMode === "img"
            ? "selected-img"
            : "none (open panel, click or Alt+click a photo)";
      updateReadoutEl(readoutEl, state, label);
    }
  }

  function setSlidersFromState() {
    if (!p1) return;
    p1.input.value = String(state.posX);
    p2.input.value = String(state.posY);
    p3.input.value = String(state.scale);
    p4.input.value = String(state.widthPct);
    p5.input.value = String(state.bandHeightVh);
    p1.val.textContent = p1.input.value;
    p2.val.textContent = p2.input.value;
    p3.val.textContent = p3.input.value;
    p4.val.textContent = p4.input.value;
    p5.val.textContent = p5.input.value;
    if (p6 && p7 && p8) {
      p6.input.value = String(state.wrapWidthPct ?? 100);
      p7.input.value = String(state.wrapOffsetXVw ?? 0);
      p8.input.value = String(state.wrapOffsetYVh ?? 0);
      p6.val.textContent = p6.input.value;
      p7.val.textContent = p7.input.value;
      p8.val.textContent = p8.input.value;
    }
    if (p9 && p10 && p11) {
      p9.input.value = String(state.bgPosX ?? 50);
      p10.input.value = String(state.bgPosY ?? 50);
      p11.input.value = String(state.bgSizePct ?? 100);
      p9.val.textContent = p9.input.value;
      p10.val.textContent = p10.input.value;
      p11.val.textContent = p11.input.value;
    }
  }

  function selectResumeCard() {
    imgEl = null;
    targetMode = "resume";
    cardEl = document.querySelector(".resume-header-card");
    if (!cardEl) return;
    state = { ...readStateFromCard(cardEl) };
    snapshot = { ...state };
    titleEl.textContent = "Resume header photo";
    if (wrapSlidersRow) wrapSlidersRow.hidden = false;
    if (bgSlidersRow) bgSlidersRow.hidden = false;
    const headerImg = cardEl.querySelector(":scope .resume-photo-wrap img");
    if (
      document.body.classList.contains("image-tune-panel-open") &&
      headerImg &&
      !isExcludedImage(headerImg)
    ) {
      setImageTuneSelected(headerImg);
    } else {
      clearImageTuneSelection();
    }
    setSlidersFromState();
    apply();
  }

  function selectImg(img) {
    if (isExcludedImage(img)) return;
    setImageTuneSelected(img);
    imgEl = img;
    cardEl = null;
    targetMode = "img";
    state = { ...readStateFromImg(img) };
    snapshot = { ...state };
    titleEl.textContent = "Selected image";
    if (wrapSlidersRow) wrapSlidersRow.hidden = true;
    if (bgSlidersRow) bgSlidersRow.hidden = true;
    setSlidersFromState();
    apply();
  }

  const tab = document.createElement("button");
  tab.id = "image-tune-tab";
  tab.type = "button";
  tab.setAttribute("aria-expanded", "false");
  tab.setAttribute("aria-controls", "image-tune-panel");
  tab.textContent = "Photo ▸";
  tab.setAttribute("aria-label", "Open image tuning panel");

  const panel = document.createElement("aside");
  panel.id = "image-tune-panel";
  panel.hidden = true;

  function setPanelHidden(hidden) {
    panel.hidden = hidden;
    document.body.classList.toggle("image-tune-panel-open", !hidden);
  }

  function clearImageTuneSelection() {
    document.querySelectorAll("img.image-tune--selected").forEach((n) => n.classList.remove("image-tune--selected"));
  }

  /** One highlighted img at a time; reflow replays the flash when re-picking the same node. */
  function setImageTuneSelected(img) {
    clearImageTuneSelection();
    if (!img) return;
    void img.offsetWidth;
    img.classList.add("image-tune--selected");
  }

  const close = document.createElement("button");
  close.id = "image-tune-close";
  close.type = "button";
  close.textContent = "Close";
  close.addEventListener("click", () => {
    setPanelHidden(true);
    tab.setAttribute("aria-expanded", "false");
    tab.style.removeProperty("display");
    clearImageTuneSelection();
  });

  const titleEl = document.createElement("h2");
  titleEl.textContent = "Image";

  const intro = document.createElement("p");
  intro.style.margin = "0 0 8px";
  intro.style.fontSize = "11px";
  intro.style.opacity = "0.85";
  intro.innerHTML =
    "<strong>Panel open:</strong> click a photo (or <strong>Shift+click</strong> inside a slideshow). Green ring + flash = selection. <strong>Alt+click</strong> opens the panel from any page. Band height/width sliders apply only to images that use a vh-height band (e.g. resume header).";

  function mkRange(id, label, min, max, step, value, onInput) {
    const lab = document.createElement("label");
    lab.setAttribute("for", id);
    lab.textContent = label;
    const val = document.createElement("div");
    val.className = "image-tune-value";
    const input = document.createElement("input");
    input.id = id;
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.addEventListener("input", () => {
      val.textContent = input.value;
      onInput(parseFloat(input.value));
    });
    val.textContent = input.value;
    return { lab, input, val };
  }

  readoutEl = document.createElement("div");
  readoutEl.id = "image-tune-readout";

  p1 = mkRange("it-posx", "Position X (horizontal %)", 0, 100, 0.25, 50, (n) => {
    state.posX = n;
    apply();
  });
  p2 = mkRange("it-posy", "Position Y (vertical %)", 0, 100, 0.25, 35, (n) => {
    state.posY = n;
    apply();
  });
  p3 = mkRange("it-scale", "Zoom (scale)", 1, 2.75, 0.005, 1, (n) => {
    state.scale = n;
    apply();
  });
  p4 = mkRange("it-widthpct", "Photo width (% of container)", 40, 100, 0.5, 100, (n) => {
    state.widthPct = n;
    apply();
  });
  p5 = mkRange("it-bandvh", "Band height (vh)", 8, 55, 0.25, 22, (n) => {
    state.bandHeightVh = n;
    apply();
  });

  if (page === "resume") {
    wrapSlidersRow = document.createElement("div");
    wrapSlidersRow.className = "image-tune-wrap-sliders";
    p6 = mkRange("it-wrapw", "Container width (% of card)", 40, 100, 0.5, 100, (n) => {
      state.wrapWidthPct = n;
      apply();
    });
    p7 = mkRange("it-wrapx", "Container position X (vw)", -12, 12, 0.25, 0, (n) => {
      state.wrapOffsetXVw = n;
      apply();
    });
    p8 = mkRange("it-wrapy", "Container position Y (vh)", -12, 12, 0.25, 0, (n) => {
      state.wrapOffsetYVh = n;
      apply();
    });
    for (const p of [p6, p7, p8]) {
      wrapSlidersRow.appendChild(p.lab);
      wrapSlidersRow.appendChild(p.val);
      wrapSlidersRow.appendChild(p.input);
    }
    bgSlidersRow = document.createElement("div");
    bgSlidersRow.className = "image-tune-bg-sliders";
    p9 = mkRange("it-bgx", "Header background X (%)", 0, 100, 0.25, 50, (n) => {
      state.bgPosX = n;
      apply();
    });
    p10 = mkRange("it-bgy", "Header background Y (%)", 0, 100, 0.25, 50, (n) => {
      state.bgPosY = n;
      apply();
    });
    p11 = mkRange("it-bgzoom", "Header background zoom (%)", 100, 200, 0.5, 100, (n) => {
      state.bgSizePct = n;
      apply();
    });
    for (const p of [p9, p10, p11]) {
      bgSlidersRow.appendChild(p.lab);
      bgSlidersRow.appendChild(p.val);
      bgSlidersRow.appendChild(p.input);
    }
  }

  panel.appendChild(close);
  panel.appendChild(titleEl);
  panel.appendChild(intro);
  panel.appendChild(p1.lab);
  panel.appendChild(p1.val);
  panel.appendChild(p1.input);
  panel.appendChild(p2.lab);
  panel.appendChild(p2.val);
  panel.appendChild(p2.input);
  panel.appendChild(p3.lab);
  panel.appendChild(p3.val);
  panel.appendChild(p3.input);
  panel.appendChild(p4.lab);
  panel.appendChild(p4.val);
  panel.appendChild(p4.input);
  panel.appendChild(p5.lab);
  panel.appendChild(p5.val);
  panel.appendChild(p5.input);
  if (wrapSlidersRow) panel.appendChild(wrapSlidersRow);
  if (bgSlidersRow) panel.appendChild(bgSlidersRow);
  panel.appendChild(readoutEl);

  const actions = document.createElement("div");
  actions.className = "image-tune-actions";
  const mkBtn = (t, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = t;
    b.addEventListener("click", fn);
    return b;
  };
  if (page === "resume") {
    actions.appendChild(
      mkBtn("Target: resume header", () => {
        selectResumeCard();
      }),
    );
  }
  actions.appendChild(
    mkBtn("Reset", () => {
      state = { ...snapshot };
      setSlidersFromState();
      apply();
    }),
  );
  actions.appendChild(
    mkBtn("Copy CSS", async () => {
      const v = getExportState(state);
      const text = targetMode === "resume" ? buildCssBlockResume(v) : buildCssBlockImg(v);
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        window.prompt("Copy CSS:", text);
      }
    }),
  );
  actions.appendChild(
    mkBtn("Copy JSON", async () => {
      const v = getExportState(state);
      const hint = imgEl ? (imgEl.getAttribute("alt") || imgEl.src || "").slice(0, 120) : "resume-header-card";
      const text =
        targetMode === "resume" ? buildJsonExportResume(v) : buildJsonExportImg(v, hint);
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        window.prompt("Copy JSON:", text);
      }
    }),
  );
  actions.appendChild(
    mkBtn("Download JSON", () => {
      const v = getExportState(state);
      const hint = imgEl ? (imgEl.getAttribute("alt") || "").slice(0, 80) : "resume";
      const blob = new Blob(
        [targetMode === "resume" ? buildJsonExportResume(v) : buildJsonExportImg(v, hint)],
        { type: "application/json" },
      );
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = targetMode === "resume" ? "resume-photo-tune.values.json" : "image-tune.values.json";
      a.click();
      URL.revokeObjectURL(a.href);
    }),
  );
  panel.appendChild(actions);

  tab.addEventListener("click", () => {
    setPanelHidden(false);
    tab.setAttribute("aria-expanded", "true");
    tab.style.setProperty("display", "none");
    if (page === "resume" && targetMode === "resume" && cardEl) {
      const hi = cardEl.querySelector(":scope .resume-photo-wrap img");
      if (hi && !isExcludedImage(hi)) setImageTuneSelected(hi);
    }
  });

  document.body.appendChild(tab);
  document.body.appendChild(panel);

  let lastTunePickTs = 0;
  let lastTunePickEl = null;
  function pickAndTune(img) {
    const now = Date.now();
    if (img === lastTunePickEl && now - lastTunePickTs < 400) return;
    lastTunePickTs = now;
    lastTunePickEl = img;
    selectImg(img);
    tab.setAttribute("aria-expanded", "true");
    tab.style.setProperty("display", "none");
  }

  document.addEventListener(
    "click",
    (e) => {
      if (!e.altKey) return;
      const img = e.target?.closest?.("img");
      if (!img) return;
      if (isExcludedImage(img, { allowSlideshow: e.shiftKey })) return;
      e.preventDefault();
      e.stopPropagation();
      setPanelHidden(false);
      pickAndTune(img);
    },
    true,
  );

  document.addEventListener(
    "click",
    (e) => {
      if (panel.hidden) return;
      if (e.altKey) return;
      const img = e.target?.closest?.("img");
      if (!img) return;
      if (isExcludedImage(img, { allowSlideshow: e.shiftKey })) return;
      if (img.closest("#image-tune-panel") || img.closest("#image-tune-tab")) return;
      e.preventDefault();
      e.stopPropagation();
      pickAndTune(img);
    },
    true,
  );

  void (async () => {
    if (page === "resume") {
      const card = document.querySelector(".resume-header-card");
      if (card) {
        await applyResumeJsonIfPresent(card);
        selectResumeCard();
      }
    } else {
      targetMode = "none";
      state = {
        posX: 50,
        posY: 35,
        scale: 1,
        useBandLayout: false,
        bgPosX: 50,
        bgPosY: 50,
        bgSizePct: 100,
        wrapWidthPct: 100,
        wrapOffsetXVw: 0,
        wrapOffsetYVh: 0,
        widthPct: 100,
        bandHeightVh: 22,
        objectFit: "cover",
        maxHeight: "none",
      };
      snapshot = { ...state };
      setSlidersFromState();
      apply();
    }

    if (new URLSearchParams(location.search).get("tune") === "1" || location.hash.replace(/^#/, "") === "tune") {
      tab.click();
    }
  })();

}
