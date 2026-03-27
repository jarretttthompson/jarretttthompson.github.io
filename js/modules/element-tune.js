/**
 * element-tune.js — Site-wide element layout editor with change ledger.
 *
 * How it works:
 *   - "Edit" tab on the LEFT edge opens the panel (pink accent, to distinguish from Photo tuner on right).
 *   - With the panel open: hover any element to preview a dashed outline, click to lock selection.
 *   - Ctrl+click any element (panel open or closed) to open panel and select it instantly.
 *   - Sliders/selects update the element live via inline styles.
 *   - "Log Change" commits the current diff to the change ledger.
 *   - "Export Session" downloads agent-ready JSON for applying changes to source.
 *
 * Supported element types and their controls:
 *   image   → position X/Y, scale/zoom, object-fit
 *   text    → font-size, line-height, letter-spacing, text-align
 *   block   → max-width, padding (T/B/L/R), margin (T/B), gap (flex/grid)
 */

// ─── Config ───────────────────────────────────────────────────────────────────

const EXCLUDED_SELECTORS = [
  '#et-panel',
  '#et-tab',
  '#image-tune-panel',
  '#image-tune-tab',
  '.site-header-logo-wrap',
  '.site-header-logo',
];

const TEXT_TAGS = new Set([
  'h1','h2','h3','h4','h5','h6',
  'p','span','a','strong','em',
  'li','label','blockquote','cite',
  'figcaption','time','small','dt','dd',
]);

const BLOCK_TAGS = new Set([
  'div','section','article','header',
  'footer','nav','main','aside',
  'figure','ul','ol','form','fieldset',
]);

// ─── Module State ─────────────────────────────────────────────────────────────

let _panelOpen   = false;
let _selectedEl  = null;
let _hoverEl     = null;
let _baseline    = null;   // computed-style snapshot taken at selection time
let _currentVals = {};     // live values driven by sliders
let _ledger      = [];     // committed LedgerEntry[]
let _changeId    = 0;

// DOM refs set during buildPanel()
let _panelEl          = null;
let _tabEl            = null;
let _selInfoEl        = null;
let _noSelEl          = null;
let _controlsWrap     = null;
let _ledgerContainer  = null;
let _noteField        = null;

// ─── Utility ──────────────────────────────────────────────────────────────────

function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
function px(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

function detectType(el) {
  const tag = el.tagName.toLowerCase();
  if (tag === 'img') return 'image';
  if (TEXT_TAGS.has(tag)) return 'text';
  return 'block';
}

function isExcluded(el) {
  if (!el || el === document.documentElement || el === document.body) return true;
  for (const sel of EXCLUDED_SELECTORS) {
    try { if (el.matches(sel) || el.closest(sel)) return true; } catch { /* noop */ }
  }
  try {
    const r = el.getBoundingClientRect();
    if (r.width < 16 || r.height < 16) return true;
  } catch { /* noop */ }
  return false;
}

// ─── Selector Generation ──────────────────────────────────────────────────────

function generateSelector(el) {
  // 1. Unique ID
  if (el.id && /^[a-zA-Z]/.test(el.id)) {
    const s = `#${CSS.escape(el.id)}`;
    try { if (document.querySelectorAll(s).length === 1) return { selector: s, confidence: 'high' }; } catch { /* */ }
  }

  const tag = el.tagName.toLowerCase();

  // 2. Class combinations (filter out state/utility classes)
  const classes = Array.from(el.classList).filter(
    c => !c.startsWith('et-') && !c.startsWith('image-tune') &&
         !c.includes('hover') && !c.includes('focus') &&
         !c.includes('active') && c.length > 1,
  );

  for (let n = Math.min(classes.length, 3); n >= 1; n--) {
    for (const candidates of [
      classes.slice(0, n).map(c => `.${CSS.escape(c)}`).join(''),
      `${tag}${classes.slice(0, n).map(c => `.${CSS.escape(c)}`).join('')}`,
    ]) {
      try {
        const hits = document.querySelectorAll(candidates);
        if (hits.length === 1) return { selector: candidates, confidence: n > 1 ? 'high' : 'medium' };
        if (hits.length <= 5 && el.parentElement && el.parentElement !== document.body) {
          const { selector: pSel } = generateSelector(el.parentElement);
          const combined = `${pSel} > ${candidates}`;
          try {
            if (document.querySelectorAll(combined).length === 1)
              return { selector: combined, confidence: 'medium' };
          } catch { /* */ }
        }
      } catch { /* */ }
    }
  }

  // 3. DOM path fallback
  const path = [];
  let curr = el;
  for (let depth = 0; depth < 8 && curr && curr !== document.body; depth++) {
    const parent = curr.parentElement;
    if (!parent) break;
    const currTag = curr.tagName.toLowerCase();
    if (curr.id && /^[a-zA-Z]/.test(curr.id)) { path.unshift(`#${CSS.escape(curr.id)}`); break; }
    const sameSiblings = Array.from(parent.children).filter(c => c.tagName === curr.tagName);
    const idx = sameSiblings.indexOf(curr) + 1;
    path.unshift(sameSiblings.length === 1 ? currTag : `${currTag}:nth-of-type(${idx})`);
    curr = parent;
    if (curr.id && /^[a-zA-Z]/.test(curr.id)) { path.unshift(`#${CSS.escape(curr.id)}`); break; }
  }
  return { selector: path.join(' > ') || tag, confidence: 'low' };
}

// ─── HTML Context Snippet ─────────────────────────────────────────────────────

function getHtmlContext(el) {
  const outer = el.outerHTML;
  if (outer.length < 350) return outer;
  const openEnd = outer.indexOf('>') + 1;
  const openTag = outer.slice(0, openEnd);
  const innerSnip = outer.slice(openEnd, openEnd + 160).replace(/\n\s*/g, ' ');
  return `${openTag}${innerSnip}... [${el.children.length} children truncated]`;
}

// ─── Style Snapshots ──────────────────────────────────────────────────────────

function snapshotStyles(el) {
  const cs = getComputedStyle(el);
  const type = detectType(el);

  if (type === 'image') {
    const raw = cs.transform;
    let scale = 1;
    if (raw && raw !== 'none') {
      const m = raw.match(/matrix\(([^)]+)\)/);
      if (m) { const p = m[1].split(',').map(x => parseFloat(x.trim())); if (p.length >= 1) scale = p[0]; }
      const s = raw.match(/scale\(\s*([\d.]+)/);
      if (s) scale = parseFloat(s[1]);
    }
    const op = cs.objectPosition || '50% 50%';
    const parts = op.split(/\s+/);
    const posX = parseFloat(parts[0]) || 50;
    const posY = parseFloat(parts[1] || parts[0]) || 50;
    return { type: 'image', posX, posY, scale, objectFit: cs.objectFit || 'cover', objectPosition: op };
  }

  if (type === 'text') {
    const fsPx = px(cs.fontSize) || 16;
    const lhRaw = cs.lineHeight;
    const lhNum = lhRaw === 'normal' ? 1.5 : px(lhRaw) / fsPx;
    const lsRaw = cs.letterSpacing;
    const lsNum = lsRaw === 'normal' ? 0 : px(lsRaw);
    return {
      type: 'text',
      fontSize: fsPx,
      lineHeight: parseFloat(lhNum.toFixed(3)),
      letterSpacing: parseFloat(lsNum.toFixed(2)),
      textAlign: cs.textAlign || 'left',
    };
  }

  // block
  const mw = cs.maxWidth;
  return {
    type: 'block',
    maxWidth: mw === 'none' ? 9999 : px(mw),
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

// ─── Apply Live Styles ────────────────────────────────────────────────────────

function applyImageStyles(el, v) {
  el.style.objectPosition = `${v.posX}% ${v.posY}%`;
  el.style.objectFit = v.objectFit || 'cover';
  el.style.transform = `scale(${v.scale})`;
  el.style.transformOrigin = 'center center';
}

function applyTextStyles(el, v) {
  el.style.fontSize = `${v.fontSize}px`;
  el.style.lineHeight = String(v.lineHeight);
  el.style.letterSpacing = `${v.letterSpacing}px`;
  el.style.textAlign = v.textAlign;
}

function applyBlockStyles(el, v) {
  el.style.maxWidth = v.maxWidth >= 9990 ? 'none' : `${v.maxWidth}px`;
  el.style.paddingTop = `${v.paddingTop}px`;
  el.style.paddingBottom = `${v.paddingBottom}px`;
  el.style.paddingLeft = `${v.paddingLeft}px`;
  el.style.paddingRight = `${v.paddingRight}px`;
  el.style.marginTop = `${v.marginTop}px`;
  el.style.marginBottom = `${v.marginBottom}px`;
  if (['flex','inline-flex','grid','inline-grid'].includes(v.display || '')) {
    el.style.gap = `${v.gap}px`;
  }
}

// ─── Diff Computation ─────────────────────────────────────────────────────────

function computeDiffs(baseline, current) {
  const diffs = [];
  if (!baseline || !current) return diffs;

  if (baseline.type === 'image') {
    if (Math.abs((current.posX ?? 50) - baseline.posX) > 0.5 || Math.abs((current.posY ?? 50) - baseline.posY) > 0.5) {
      diffs.push({ property: 'object-position', before: baseline.objectPosition, after: `${current.posX}% ${current.posY}%` });
    }
    if (Math.abs((current.scale ?? 1) - baseline.scale) > 0.005) {
      diffs.push({ property: 'transform', before: `scale(${baseline.scale.toFixed(3)})`, after: `scale(${(current.scale).toFixed(3)})` });
    }
    if (current.objectFit && current.objectFit !== baseline.objectFit) {
      diffs.push({ property: 'object-fit', before: baseline.objectFit, after: current.objectFit });
    }
    return diffs;
  }

  if (baseline.type === 'text') {
    if (Math.abs((current.fontSize ?? baseline.fontSize) - baseline.fontSize) > 0.5)
      diffs.push({ property: 'font-size', before: `${baseline.fontSize}px`, after: `${current.fontSize}px` });
    if (Math.abs((current.lineHeight ?? baseline.lineHeight) - baseline.lineHeight) > 0.02)
      diffs.push({ property: 'line-height', before: String(baseline.lineHeight), after: String(current.lineHeight) });
    if (Math.abs((current.letterSpacing ?? baseline.letterSpacing) - baseline.letterSpacing) > 0.1)
      diffs.push({ property: 'letter-spacing', before: `${baseline.letterSpacing}px`, after: `${current.letterSpacing}px` });
    if (current.textAlign && current.textAlign !== baseline.textAlign)
      diffs.push({ property: 'text-align', before: baseline.textAlign, after: current.textAlign });
    return diffs;
  }

  // block
  if (Math.abs((current.maxWidth ?? baseline.maxWidth) - baseline.maxWidth) > 1) {
    diffs.push({
      property: 'max-width',
      before: baseline.maxWidth >= 9990 ? 'none' : `${baseline.maxWidth}px`,
      after: (current.maxWidth ?? 0) >= 9990 ? 'none' : `${current.maxWidth}px`,
    });
  }
  for (const prop of ['paddingTop','paddingBottom','paddingLeft','paddingRight','marginTop','marginBottom']) {
    const b = baseline[prop] ?? 0;
    const a = current[prop] ?? b;
    if (Math.abs(a - b) > 0.5) {
      const css = prop.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
      diffs.push({ property: css, before: `${b}px`, after: `${a}px` });
    }
  }
  if (Math.abs((current.gap ?? baseline.gap) - baseline.gap) > 0.5 &&
      ['flex','inline-flex','grid','inline-grid'].includes(baseline.display || '')) {
    diffs.push({ property: 'gap', before: `${baseline.gap}px`, after: `${current.gap}px` });
  }
  return diffs;
}

// ─── Change Ledger ────────────────────────────────────────────────────────────

function commitEntry(diffs, note) {
  if (!_selectedEl || !_baseline || diffs.length === 0) return;
  const { selector, confidence } = generateSelector(_selectedEl);
  const existing = _ledger.find(e => e.selector === selector);
  if (existing) {
    for (const d of diffs) {
      const ex = existing.diffs.find(x => x.property === d.property);
      if (ex) { ex.after = d.after; }
      else { existing.diffs.push(d); }
    }
    // Drop any diff that reverted to original
    existing.diffs = existing.diffs.filter(d => d.before !== d.after);
    if (existing.diffs.length === 0) {
      _ledger = _ledger.filter(e => e !== existing);
    } else if (note) {
      existing.note = note;
    }
  } else {
    _ledger.push({
      id: `ch_${String(++_changeId).padStart(3, '0')}`,
      selector,
      selectorConfidence: confidence,
      page: document.body.getAttribute('data-page') || location.pathname,
      elementType: _baseline.type,
      tagName: _selectedEl.tagName.toLowerCase(),
      htmlContext: getHtmlContext(_selectedEl),
      diffs,
      note: note || '',
      timestamp: new Date().toISOString(),
    });
  }
  renderLedger();
}

function confColor(c) {
  return c === 'high' ? 'rgba(0,200,100,0.35)' : c === 'medium' ? 'rgba(255,180,0,0.35)' : 'rgba(255,80,80,0.35)';
}

function renderLedger() {
  if (!_ledgerContainer) return;
  _ledgerContainer.innerHTML = '';

  if (_ledger.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color:rgba(255,200,220,0.45);font-size:11px;margin:6px 0 0;line-height:1.6;';
    empty.textContent = 'No changes logged yet. Adjust an element and click "Log Change".';
    _ledgerContainer.appendChild(empty);
    return;
  }

  const hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
  const hdrTitle = document.createElement('strong');
  hdrTitle.textContent = `CHANGES (${_ledger.length})`;
  hdrTitle.style.cssText = 'color:#ff41af;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;';
  hdr.appendChild(hdrTitle);
  _ledgerContainer.appendChild(hdr);

  for (const entry of [..._ledger]) {
    const card = document.createElement('div');
    card.style.cssText = 'margin-bottom:9px;padding:9px 10px;background:rgba(255,65,175,0.07);border:1px solid rgba(255,65,175,0.25);border-radius:6px;';

    // Selector line + confidence badge
    const selRow = document.createElement('div');
    selRow.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:5px;';
    const selSpan = document.createElement('span');
    selSpan.textContent = entry.selector;
    selSpan.style.cssText = 'font-size:11px;color:#ffb3d9;word-break:break-all;flex:1;';
    const badge = document.createElement('span');
    badge.textContent = entry.selectorConfidence;
    badge.style.cssText = `font-size:9px;padding:1px 5px;border-radius:3px;white-space:nowrap;background:${confColor(entry.selectorConfidence)};`;
    selRow.appendChild(selSpan);
    selRow.appendChild(badge);
    card.appendChild(selRow);

    // Diffs
    for (const d of entry.diffs) {
      const line = document.createElement('div');
      line.style.cssText = 'font-size:11px;margin:2px 0;color:#e8d0e0;';
      line.innerHTML =
        `<span style="color:#aaa;">${d.property}:</span> ` +
        `<span style="color:#ff9ec9;text-decoration:line-through;">${d.before}</span> ` +
        `→ <span style="color:#00ff9f;">${d.after}</span>`;
      card.appendChild(line);
    }

    // Note (if any)
    if (entry.note) {
      const noteEl = document.createElement('div');
      noteEl.style.cssText = 'margin-top:5px;font-size:10px;color:rgba(255,200,230,0.65);font-style:italic;';
      noteEl.textContent = `"${entry.note}"`;
      card.appendChild(noteEl);
    }

    // Remove button
    const rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.textContent = '✕ Remove';
    rmBtn.style.cssText = 'margin-top:7px;padding:2px 8px;font-size:10px;cursor:pointer;background:transparent;border:1px solid rgba(255,65,175,0.3);color:#ff9ec9;border-radius:4px;';
    rmBtn.addEventListener('click', () => { _ledger = _ledger.filter(e => e !== entry); renderLedger(); });
    card.appendChild(rmBtn);

    _ledgerContainer.appendChild(card);
  }
}

// ─── Agent-Ready Export ───────────────────────────────────────────────────────

function buildAgentJson() {
  return JSON.stringify({
    exportVersion: '1.0',
    sessionDate: new Date().toISOString().slice(0, 10),
    siteId: location.hostname || 'thejrummer.art',
    generatedBy: 'element-tune.js',
    agentInstructions:
      'Apply the following CSS changes to the site source files. ' +
      'For each change: use `selector` to locate the rule in HTML/CSS. ' +
      'Prefer updating existing CSS rules or CSS custom properties over adding inline styles. ' +
      'If the element is styled via a CSS var (e.g. --foo-bar), update that variable definition instead. ' +
      'The `htmlContext` field contains a snippet to help locate ambiguous elements. ' +
      '`selectorConfidence` is high/medium/low — low means verify visually before committing. ' +
      'After applying, remove any inline style="" attributes added by the tuner.',
    affectedPages: [...new Set(_ledger.map(e => e.page))],
    changes: _ledger.map(e => ({
      id: e.id,
      selector: e.selector,
      selectorConfidence: e.selectorConfidence,
      page: e.page,
      elementType: e.elementType,
      tagName: e.tagName,
      diffs: e.diffs,
      note: e.note,
      htmlContext: e.htmlContext,
      timestamp: e.timestamp,
    })),
  }, null, 2);
}

function exportSession(mode) {
  const json = buildAgentJson();
  if (mode === 'copy') {
    navigator.clipboard.writeText(json).catch(() => window.prompt('Copy export JSON:', json));
    return;
  }
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `site-edits-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── Panel Styles ─────────────────────────────────────────────────────────────

function injectStyles() {
  const id = 'et-panel-styles';
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = `
    /* ── Tab ── */
    #et-tab {
      position: fixed !important;
      top: 50% !important;
      left: 0 !important;
      right: auto !important;
      bottom: auto !important;
      transform: translateY(-50%) !important;
      z-index: 2147483000;
      writing-mode: vertical-lr;
      text-orientation: mixed;
      padding: 14px 8px;
      font: 600 13px/1.2 ui-monospace, monospace;
      letter-spacing: 0.06em;
      color: #1a0012;
      background: linear-gradient(180deg, rgba(255,65,175,0.92), rgba(200,40,140,0.88));
      border: 1px solid rgba(255,65,175,0.6);
      border-left: none;
      border-radius: 0 10px 10px 0;
      cursor: pointer;
      box-shadow: 4px 0 18px rgba(0,0,0,0.4);
      user-select: none;
    }
    #et-tab:hover { filter: brightness(1.1); }
    #et-tab[aria-expanded="true"] { display: none !important; }

    /* ── Panel ── */
    #et-panel {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: auto !important;
      bottom: 0 !important;
      width: min(380px, 100vw) !important;
      height: 100vh !important;
      height: 100dvh !important;
      max-height: none !important;
      margin: 0 !important;
      overflow-y: auto !important;
      box-sizing: border-box !important;
      z-index: 2147482999;
      padding: 16px 16px 32px;
      padding-top: 50px;
      font: 13px/1.45 ui-monospace, monospace;
      color: #ffe8f5;
      background: rgba(18, 4, 14, 0.97);
      border-right: 2px solid rgba(255, 65, 175, 0.5);
      box-shadow: 8px 0 40px rgba(0,0,0,0.6);
    }
    #et-panel[hidden] { display: none !important; }
    #et-panel h2 {
      margin: 0 0 10px;
      font-size: 15px;
      font-weight: 600;
      color: #ff41af;
    }
    #et-panel h3 {
      margin: 16px 0 6px;
      font-size: 11px;
      font-weight: 600;
      color: #ff88cc;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-top: 1px solid rgba(255,65,175,0.2);
      padding-top: 14px;
    }
    #et-panel label {
      display: block;
      margin: 11px 0 3px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.8;
    }
    #et-panel input[type="range"] {
      width: 100%;
      accent-color: #ff41af;
      cursor: pointer;
    }
    #et-panel select {
      width: 100%;
      background: rgba(40,8,28,0.92);
      color: #ffe8f5;
      border: 1px solid rgba(255,65,175,0.35);
      border-radius: 5px;
      padding: 5px 7px;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    #et-panel .et-val-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
    }
    #et-panel .et-val-row label { margin: 0; opacity: 0.75; }
    #et-panel .et-val {
      font-size: 12px;
      color: #ff9ec9;
      font-weight: 600;
    }
    #et-close {
      position: absolute !important;
      top: 10px !important;
      right: 10px !important;
      padding: 4px 10px;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      color: #ffe8f5;
      background: transparent;
      border: 1px solid rgba(255,65,175,0.35);
      border-radius: 6px;
    }
    #et-close:hover { filter: brightness(1.2); }
    #et-sel-info {
      margin: 8px 0 10px;
      padding: 8px 10px;
      background: rgba(255,65,175,0.08);
      border: 1px solid rgba(255,65,175,0.3);
      border-radius: 6px;
      font-size: 11px;
      color: #ffb3d9;
      word-break: break-all;
      min-height: 30px;
    }
    #et-no-sel {
      color: rgba(255,180,220,0.5);
      font-size: 11px;
      margin: 10px 0;
      line-height: 1.6;
    }
    #et-controls { margin-top: 4px; }
    #et-note-field {
      width: 100%;
      box-sizing: border-box;
      margin-top: 6px;
      padding: 6px 8px;
      background: rgba(40,8,28,0.7);
      border: 1px solid rgba(255,65,175,0.3);
      border-radius: 5px;
      color: #ffe8f5;
      font: inherit;
      font-size: 11px;
      resize: vertical;
      min-height: 44px;
    }
    #et-note-field::placeholder { color: rgba(255,180,220,0.3); }
    .et-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 12px;
    }
    .et-actions button {
      cursor: pointer;
      padding: 7px 10px;
      border-radius: 6px;
      border: 1px solid rgba(255, 65, 175, 0.4);
      background: rgba(60, 8, 44, 0.55);
      color: #ffe8f5;
      font: inherit;
      font-size: 11px;
    }
    .et-actions button:hover { filter: brightness(1.15); }
    .et-btn-primary {
      border-color: rgba(255,65,175,0.8) !important;
      background: rgba(255,65,175,0.18) !important;
    }
    #et-ledger-wrap { margin-top: 20px; }
    #et-ledger-title {
      font-size: 12px;
      font-weight: 600;
      color: #ff41af;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-top: 1px solid rgba(255,65,175,0.2);
      padding-top: 14px;
      margin: 0 0 8px;
    }
    #et-export-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 10px;
    }
    #et-export-actions button {
      cursor: pointer;
      padding: 7px 10px;
      border-radius: 6px;
      border: 1px solid rgba(255, 65, 175, 0.4);
      background: rgba(60, 8, 44, 0.55);
      color: #ffe8f5;
      font: inherit;
      font-size: 11px;
    }
    #et-export-actions button:hover { filter: brightness(1.15); }

    /* ── Hover highlight ── */
    .et-hover {
      outline: 2px dashed rgba(255, 65, 175, 0.7) !important;
      outline-offset: 2px !important;
      cursor: crosshair !important;
    }

    /* ── Selected highlight ── */
    @keyframes et-select-flash {
      from {
        box-shadow: 0 0 0 3px #ff41af, 0 0 32px rgba(255,65,175,0.6);
      }
      to {
        box-shadow: 0 0 0 2px rgba(255,65,175,0.85), 0 0 16px rgba(255,65,175,0.3);
      }
    }
    .et-selected {
      outline: 2px solid #ff41af !important;
      outline-offset: 2px !important;
      position: relative !important;
      z-index: 5 !important;
      animation: et-select-flash 0.45s ease-out 1;
    }
  `;
  document.head.appendChild(s);
}

// ─── Controls Rendering ───────────────────────────────────────────────────────

function mkRange(id, lbl, min, max, step, init, unit, onChange) {
  const row = document.createElement('div');
  row.className = 'et-val-row';
  const lab = document.createElement('label');
  lab.setAttribute('for', id);
  lab.textContent = lbl;
  const val = document.createElement('span');
  val.className = 'et-val';
  val.textContent = `${Number(init).toFixed(step < 1 ? 1 : 0)}${unit}`;
  row.appendChild(lab);
  row.appendChild(val);
  const input = document.createElement('input');
  input.id = id;
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(init);
  input.addEventListener('input', () => {
    const n = parseFloat(input.value);
    val.textContent = `${n.toFixed(step < 1 ? 1 : 0)}${unit}`;
    onChange(n);
  });
  return { row, input };
}

function mkSelect(id, lbl, opts, init, onChange) {
  const lab = document.createElement('label');
  lab.setAttribute('for', id);
  lab.textContent = lbl;
  const sel = document.createElement('select');
  sel.id = id;
  for (const o of opts) {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    if (o === init) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => onChange(sel.value));
  return { lab, sel };
}

function append(container, ...nodes) {
  for (const n of nodes) if (n) container.appendChild(n);
}

function renderControls(el) {
  if (!_controlsWrap || !_baseline) return;
  _controlsWrap.innerHTML = '';

  const type = _baseline.type;

  if (type === 'image') {
    _currentVals = { posX: _baseline.posX, posY: _baseline.posY, scale: _baseline.scale, objectFit: _baseline.objectFit };
    const hdr = document.createElement('h3');
    hdr.textContent = 'Image Positioning';
    _controlsWrap.appendChild(hdr);
    const p1 = mkRange('et-posx', 'Position X', 0, 100, 0.5, _baseline.posX, '%', n => { _currentVals.posX = n; applyImageStyles(el, _currentVals); });
    const p2 = mkRange('et-posy', 'Position Y', 0, 100, 0.5, _baseline.posY, '%', n => { _currentVals.posY = n; applyImageStyles(el, _currentVals); });
    const p3 = mkRange('et-scale', 'Scale / Zoom', 0.5, 3, 0.01, _baseline.scale, '×', n => { _currentVals.scale = n; applyImageStyles(el, _currentVals); });
    for (const p of [p1, p2, p3]) append(_controlsWrap, p.row, p.input);
    const fit = mkSelect('et-fit', 'Object Fit', ['cover','contain','fill','none','scale-down'], _baseline.objectFit, v => { _currentVals.objectFit = v; applyImageStyles(el, _currentVals); });
    append(_controlsWrap, fit.lab, fit.sel);
    return;
  }

  if (type === 'text') {
    _currentVals = { fontSize: _baseline.fontSize, lineHeight: _baseline.lineHeight, letterSpacing: _baseline.letterSpacing, textAlign: _baseline.textAlign };
    const hdr = document.createElement('h3');
    hdr.textContent = 'Typography';
    _controlsWrap.appendChild(hdr);
    const fsMin = Math.max(8, _baseline.fontSize - 36);
    const fsMax = _baseline.fontSize + 80;
    const p1 = mkRange('et-fs', 'Font Size', fsMin, fsMax, 0.5, _baseline.fontSize, 'px', n => { _currentVals.fontSize = n; applyTextStyles(el, _currentVals); });
    const p2 = mkRange('et-lh', 'Line Height', 0.8, 3, 0.05, _baseline.lineHeight, '', n => { _currentVals.lineHeight = n; applyTextStyles(el, _currentVals); });
    const p3 = mkRange('et-ls', 'Letter Spacing', -2, 20, 0.1, _baseline.letterSpacing, 'px', n => { _currentVals.letterSpacing = n; applyTextStyles(el, _currentVals); });
    for (const p of [p1, p2, p3]) append(_controlsWrap, p.row, p.input);
    const algn = mkSelect('et-align', 'Text Align', ['left','center','right','justify'], _baseline.textAlign, v => { _currentVals.textAlign = v; applyTextStyles(el, _currentVals); });
    append(_controlsWrap, algn.lab, algn.sel);
    return;
  }

  // block
  const isFlexGrid = ['flex','inline-flex','grid','inline-grid'].includes(_baseline.display || '');
  _currentVals = { ..._baseline };
  const hdr = document.createElement('h3');
  hdr.textContent = `Layout · <${el.tagName.toLowerCase()}>`;
  _controlsWrap.appendChild(hdr);
  const mw = mkRange('et-mw', 'Max Width', 100, 2400, 4, _baseline.maxWidth >= 9990 ? 1200 : _baseline.maxWidth, 'px', n => { _currentVals.maxWidth = n; applyBlockStyles(el, _currentVals); });
  const pt = mkRange('et-pt', 'Padding Top', 0, 200, 1, _baseline.paddingTop, 'px', n => { _currentVals.paddingTop = n; applyBlockStyles(el, _currentVals); });
  const pb = mkRange('et-pb', 'Padding Bottom', 0, 200, 1, _baseline.paddingBottom, 'px', n => { _currentVals.paddingBottom = n; applyBlockStyles(el, _currentVals); });
  const pl = mkRange('et-pl', 'Padding Left', 0, 120, 1, _baseline.paddingLeft, 'px', n => { _currentVals.paddingLeft = n; applyBlockStyles(el, _currentVals); });
  const pr = mkRange('et-pr', 'Padding Right', 0, 120, 1, _baseline.paddingRight, 'px', n => { _currentVals.paddingRight = n; applyBlockStyles(el, _currentVals); });
  const mt = mkRange('et-mt', 'Margin Top', -100, 200, 1, _baseline.marginTop, 'px', n => { _currentVals.marginTop = n; applyBlockStyles(el, _currentVals); });
  const mb = mkRange('et-mb', 'Margin Bottom', -100, 200, 1, _baseline.marginBottom, 'px', n => { _currentVals.marginBottom = n; applyBlockStyles(el, _currentVals); });
  for (const p of [mw, pt, pb, pl, pr, mt, mb]) append(_controlsWrap, p.row, p.input);
  if (isFlexGrid) {
    const g = mkRange('et-gap', 'Gap', 0, 120, 1, _baseline.gap, 'px', n => { _currentVals.gap = n; applyBlockStyles(el, _currentVals); });
    append(_controlsWrap, g.row, g.input);
  }
}

// ─── Selection ────────────────────────────────────────────────────────────────

function selectElement(el) {
  if (_selectedEl) _selectedEl.classList.remove('et-selected');
  _selectedEl = el;
  _baseline = snapshotStyles(el);
  _currentVals = {};

  // Stash original inline style for reset
  el.dataset.etOrig = el.getAttribute('style') || '';

  void el.offsetWidth; // force reflow → restart animation
  el.classList.add('et-selected');

  const { selector, confidence } = generateSelector(el);
  if (_selInfoEl) {
    _selInfoEl.innerHTML =
      `<strong style="color:#ff41af;">&lt;${el.tagName.toLowerCase()}&gt;</strong> ` +
      `${selector} ` +
      `<span style="font-size:9px;padding:1px 5px;border-radius:3px;margin-left:3px;background:${confColor(confidence)}">${confidence}</span>`;
  }
  if (_noSelEl) _noSelEl.hidden = true;
  if (_controlsWrap) _controlsWrap.style.display = '';
  renderControls(el);
  if (_noteField) _noteField.value = '';
}

function deselectElement() {
  if (_selectedEl) _selectedEl.classList.remove('et-selected');
  _selectedEl = null;
  _baseline = null;
  _currentVals = {};
  if (_selInfoEl) _selInfoEl.textContent = 'No element selected';
  if (_noSelEl) _noSelEl.hidden = false;
  if (_controlsWrap) { _controlsWrap.innerHTML = ''; _controlsWrap.style.display = 'none'; }
}

// ─── Hover ────────────────────────────────────────────────────────────────────

function handleMouseMove(e) {
  if (!_panelOpen) return;
  const el = e.target;
  if (!el || el === _hoverEl) return;
  if (_hoverEl) { _hoverEl.classList.remove('et-hover'); _hoverEl = null; }
  if (isExcluded(el) || el === _selectedEl) return;
  _hoverEl = el;
  _hoverEl.classList.add('et-hover');
}

function clearHover() {
  if (_hoverEl) { _hoverEl.classList.remove('et-hover'); _hoverEl = null; }
}

// ─── Panel Construction ───────────────────────────────────────────────────────

function buildPanel() {
  const panel = document.createElement('aside');
  panel.id = 'et-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Element layout editor');

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.id = 'et-close';
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', closePanel);

  // Title
  const title = document.createElement('h2');
  title.textContent = '⬡ Element Tuner';

  // Intro
  const intro = document.createElement('p');
  intro.style.cssText = 'margin:0 0 10px;font-size:11px;opacity:0.75;line-height:1.65;';
  intro.innerHTML =
    '<strong>Click</strong> any element to select. ' +
    '<strong>Ctrl+click</strong> to select from anywhere. ' +
    '<strong>Esc</strong> to deselect / close.';

  // Selection info
  _selInfoEl = document.createElement('div');
  _selInfoEl.id = 'et-sel-info';
  _selInfoEl.textContent = 'No element selected';

  // No-selection helper text
  _noSelEl = document.createElement('p');
  _noSelEl.id = 'et-no-sel';
  _noSelEl.textContent = 'Click any element on the page to begin.';

  // Controls area (hidden until element selected)
  _controlsWrap = document.createElement('div');
  _controlsWrap.id = 'et-controls';
  _controlsWrap.style.display = 'none';

  // Note field inside controls
  const noteLab = document.createElement('label');
  noteLab.setAttribute('for', 'et-note-field');
  noteLab.textContent = 'Note (optional intent description)';
  noteLab.style.cssText = 'margin-top:14px;border-top:1px solid rgba(255,65,175,0.15);padding-top:12px;';
  _noteField = document.createElement('textarea');
  _noteField.id = 'et-note-field';
  _noteField.placeholder = 'e.g. "more breathing room above the fold"';
  _controlsWrap.appendChild(noteLab);
  _controlsWrap.appendChild(_noteField);

  // Per-element action row
  const ctrlActions = document.createElement('div');
  ctrlActions.className = 'et-actions';

  const logBtn = document.createElement('button');
  logBtn.type = 'button';
  logBtn.textContent = '✓ Log Change';
  logBtn.className = 'et-btn-primary';
  logBtn.addEventListener('click', () => {
    if (!_selectedEl || !_baseline) return;
    const diffs = computeDiffs(_baseline, _currentVals);
    if (diffs.length === 0) {
      logBtn.textContent = '(no change)';
      setTimeout(() => { logBtn.textContent = '✓ Log Change'; }, 1200);
      return;
    }
    commitEntry(diffs, _noteField ? _noteField.value.trim() : '');
    logBtn.textContent = '✓ Logged!';
    setTimeout(() => { logBtn.textContent = '✓ Log Change'; }, 1200);
  });

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.textContent = '↺ Reset';
  resetBtn.addEventListener('click', () => {
    if (!_selectedEl) return;
    const orig = _selectedEl.dataset.etOrig || '';
    if (orig) { _selectedEl.setAttribute('style', orig); }
    else { _selectedEl.removeAttribute('style'); }
    selectElement(_selectedEl); // re-read fresh baseline
  });

  const deselBtn = document.createElement('button');
  deselBtn.type = 'button';
  deselBtn.textContent = '✕ Deselect';
  deselBtn.addEventListener('click', deselectElement);

  append(ctrlActions, logBtn, resetBtn, deselBtn);
  _controlsWrap.appendChild(ctrlActions);

  // ── Ledger section ──
  const ledgerWrap = document.createElement('div');
  ledgerWrap.id = 'et-ledger-wrap';
  const ledgerTitle = document.createElement('p');
  ledgerTitle.id = 'et-ledger-title';
  ledgerTitle.textContent = 'Change Ledger';
  _ledgerContainer = document.createElement('div');
  _ledgerContainer.id = 'et-ledger';
  renderLedger();

  // Export buttons
  const exportActions = document.createElement('div');
  exportActions.id = 'et-export-actions';

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.textContent = '⬇ Export Session JSON';
  exportBtn.className = 'et-btn-primary';
  exportBtn.addEventListener('click', () => {
    if (_ledger.length === 0) { exportBtn.textContent = '(nothing yet)'; setTimeout(() => { exportBtn.textContent = '⬇ Export Session JSON'; }, 1400); return; }
    exportSession('download');
  });

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = '⎘ Copy JSON';
  copyBtn.addEventListener('click', () => {
    if (_ledger.length === 0) { copyBtn.textContent = '(nothing yet)'; setTimeout(() => { copyBtn.textContent = '⎘ Copy JSON'; }, 1400); return; }
    exportSession('copy');
    copyBtn.textContent = '⎘ Copied!';
    setTimeout(() => { copyBtn.textContent = '⎘ Copy JSON'; }, 1500);
  });

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.textContent = '🗑 Clear';
  clearBtn.addEventListener('click', () => {
    if (_ledger.length === 0) return;
    if (confirm('Clear all logged changes?')) { _ledger = []; _changeId = 0; renderLedger(); }
  });

  append(exportActions, exportBtn, copyBtn, clearBtn);
  append(ledgerWrap, ledgerTitle, _ledgerContainer, exportActions);

  // Assemble
  append(panel, closeBtn, title, intro, _selInfoEl, _noSelEl, _controlsWrap, ledgerWrap);
  return panel;
}

// ─── Open / Close ─────────────────────────────────────────────────────────────

function openPanel() {
  _panelOpen = true;
  _panelEl.hidden = false;
  _tabEl.setAttribute('aria-expanded', 'true');
  _tabEl.style.display = 'none';
  document.body.classList.add('et-panel-open');
}

function closePanel() {
  _panelOpen = false;
  _panelEl.hidden = true;
  _tabEl.setAttribute('aria-expanded', 'false');
  _tabEl.style.removeProperty('display');
  document.body.classList.remove('et-panel-open');
  clearHover();
  deselectElement();
}

// ─── Public Init ──────────────────────────────────────────────────────────────

export function initElementTuning() {
  if (!document.body?.hasAttribute('data-terminal-site')) return;
  if (location.pathname.includes('/breakcomposer')) return;

  injectStyles();

  // Tab button
  _tabEl = document.createElement('button');
  _tabEl.id = 'et-tab';
  _tabEl.type = 'button';
  _tabEl.setAttribute('aria-expanded', 'false');
  _tabEl.setAttribute('aria-controls', 'et-panel');
  _tabEl.setAttribute('aria-label', 'Open element tuning panel');
  _tabEl.textContent = 'Edit ▸';
  _tabEl.addEventListener('click', openPanel);

  _panelEl = buildPanel();

  document.body.appendChild(_tabEl);
  document.body.appendChild(_panelEl);

  // Hover highlight
  document.addEventListener('mousemove', handleMouseMove, { passive: true });
  document.addEventListener('mouseleave', clearHover, { passive: true });

  // Click to select (when panel is open)
  document.addEventListener('click', (e) => {
    if (!_panelOpen) return;
    if (e.ctrlKey || e.metaKey) return; // handled separately below
    const el = e.target;
    if (!el || isExcluded(el)) return;
    if (el.closest('#et-panel') || el.closest('#et-tab')) return;
    e.preventDefault();
    e.stopPropagation();
    selectElement(el);
  }, true);

  // Ctrl+click: open panel + select from anywhere on the page
  document.addEventListener('click', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    const el = e.target;
    if (!el || isExcluded(el)) return;
    if (el.closest('#et-panel') || el.closest('#et-tab') || el.closest('#image-tune-panel')) return;
    e.preventDefault();
    e.stopPropagation();
    if (!_panelOpen) openPanel();
    selectElement(el);
  }, true);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (_panelOpen && _selectedEl) { deselectElement(); }
      else if (_panelOpen) { closePanel(); }
    }
  });

  // Auto-open via ?tune=el or #tune-el
  const params = new URLSearchParams(location.search);
  if (params.get('tune') === 'el' || location.hash === '#tune-el') openPanel();
}
