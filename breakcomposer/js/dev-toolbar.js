/**
 * Dev toolbar for breakComposer — device preview for mobile scaling.
 * Loaded only on localhost.
 */
(function initDevToolbar() {
  if (document.getElementById('dev-toolbar')) return;

  const base = location.pathname.includes('breakcomposer') ? '../' : '';
  const pages = [
    { label: 'breakComposer', href: base ? 'index.html' : 'breakcomposer/index.html' },
    { label: 'Projects', href: base + 'page4.html' },
    { label: 'Home', href: base + 'index.html' },
    { label: 'Resume', href: base + 'page2.html' },
    { label: 'Artwork', href: base + 'page3.html' },
  ];

  const devices = [
    { group: 'Desktop',  label: 'Desktop (default)',       w: 0,    h: 0    },
    { group: 'iPhone',   label: 'iPhone SE',               w: 375,  h: 667  },
    { group: 'iPhone',   label: 'iPhone 12 mini',          w: 375,  h: 812  },
    { group: 'iPhone',   label: 'iPhone 13 / 14',          w: 390,  h: 844  },
    { group: 'iPhone',   label: 'iPhone 14 Pro',           w: 393,  h: 852  },
    { group: 'iPhone',   label: 'iPhone 14 Pro Max',       w: 430,  h: 932  },
    { group: 'iPhone',   label: 'iPhone 15',               w: 393,  h: 852  },
    { group: 'iPhone',   label: 'iPhone 15 Pro Max',       w: 430,  h: 932  },
    { group: 'iPhone',   label: 'iPhone 16',               w: 393,  h: 852  },
    { group: 'iPhone',   label: 'iPhone 16 Pro',           w: 402,  h: 874  },
    { group: 'iPhone',   label: 'iPhone 16 Pro Max',       w: 440,  h: 956  },
    { group: 'iPad',     label: 'iPad mini (6th gen)',     w: 744,  h: 1133 },
    { group: 'iPad',     label: 'iPad Air (5th gen)',      w: 820,  h: 1180 },
    { group: 'iPad',     label: 'iPad Pro 11″',            w: 834,  h: 1194 },
    { group: 'iPad',     label: 'iPad Pro 12.9″',          w: 1024, h: 1366 },
    { group: 'iPad',     label: 'iPad Pro 13″ (M4)',      w: 1032, h: 1376 },
  ];

  const TOOLBAR_H = 36;
  const isBreakComposer = location.pathname.includes('breakcomposer');
  let activeDevice = null;
  let landscape = false;
  let savedBodyStyles = null;
  let savedHtmlBg = null;

  const style = document.createElement('style');
  style.textContent = `
    #dev-toolbar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: ${TOOLBAR_H}px;
      z-index: 2147483647;
      background: rgba(20, 10, 30, 0.95);
      backdrop-filter: blur(10px);
      border-top: 2px solid #e06fea;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #e0e0e0;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      box-shadow: 0 -2px 20px rgba(224, 111, 234, 0.3);
    }
    #dev-toolbar .dt-badge { background: #e06fea; color: #0a0a0a; font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    #dev-toolbar .dt-sep { width: 1px; height: 18px; background: rgba(224, 111, 234, 0.3); flex-shrink: 0; }
    #dev-toolbar .dt-pages { display: flex; gap: 2px; flex-wrap: nowrap; align-items: center; overflow-x: auto; }
    #dev-toolbar .dt-pages a { color: #b0b0b0; text-decoration: none; padding: 2px 6px; border-radius: 3px; white-space: nowrap; }
    #dev-toolbar .dt-pages a:hover { background: rgba(224, 111, 234, 0.2); color: #fff; }
    #dev-toolbar .dt-pages a.dt-active { background: rgba(224, 111, 234, 0.25); color: #e06fea; font-weight: bold; }
    #dev-toolbar .dt-info { margin-left: auto; display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
    #dev-toolbar .dt-info span { color: #888; font-size: 11px; }
    #dev-toolbar .dt-btn { background: rgba(224, 111, 234, 0.15); border: 1px solid rgba(224, 111, 234, 0.3); color: #e06fea; padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; }
    #dev-toolbar .dt-btn:hover { background: rgba(224, 111, 234, 0.3); color: #fff; }
    #dev-toolbar .dt-btn.dt-on { background: rgba(224, 111, 234, 0.35); color: #fff; border-color: #e06fea; }
    #dev-toolbar select.dt-select { background: rgba(20, 10, 30, 0.95); border: 1px solid rgba(224, 111, 234, 0.3); color: #e06fea; padding: 2px 4px; border-radius: 3px; font-size: 11px; cursor: pointer; max-width: 170px; }
    #dev-toolbar .dt-device-label { color: #e06fea; font-size: 10px; font-weight: bold; white-space: nowrap; }
  `;
  document.head.appendChild(style);

  function activatePreview(device) {
    if (device.w === 0) { deactivatePreview(); return; }
    activeDevice = device;
    landscape = false;
    applyPreview();
  }

  function applyPreview() {
    if (!activeDevice || activeDevice.w === 0) return;
    const dw = landscape ? activeDevice.h : activeDevice.w;
    const dh = landscape ? activeDevice.w : activeDevice.h;

    if (!savedBodyStyles) {
      savedBodyStyles = {
        width: document.body.style.width,
        maxWidth: document.body.style.maxWidth,
        height: document.body.style.height,
        maxHeight: document.body.style.maxHeight,
        margin: document.body.style.margin,
        overflow: document.body.style.overflow,
        boxShadow: document.body.style.boxShadow,
        borderLeft: document.body.style.borderLeft,
        borderRight: document.body.style.borderRight,
      };
      savedHtmlBg = document.documentElement.style.backgroundColor;
    }

    document.documentElement.style.backgroundColor = '#08050e';
    document.body.style.width = dw + 'px';
    document.body.style.maxWidth = dw + 'px';
    document.body.style.height = `calc(100vh - ${TOOLBAR_H + 2}px)`;
    document.body.style.maxHeight = `calc(100vh - ${TOOLBAR_H + 2}px)`;
    document.body.style.margin = '0 auto';
    document.body.style.overflow = 'auto';
    document.body.style.boxShadow = '0 0 60px rgba(224,111,234,0.12)';
    document.body.style.borderLeft = '1px solid rgba(224,111,234,0.2)';
    document.body.style.borderRight = '1px solid rgba(224,111,234,0.2)';

    updateDeviceLabel();
    updateRotateBtn();
  }

  function deactivatePreview() {
    if (savedBodyStyles) {
      document.body.style.width = savedBodyStyles.width;
      document.body.style.maxWidth = savedBodyStyles.maxWidth;
      document.body.style.height = savedBodyStyles.height;
      document.body.style.maxHeight = savedBodyStyles.maxHeight;
      document.body.style.margin = savedBodyStyles.margin;
      document.body.style.overflow = savedBodyStyles.overflow;
      document.body.style.boxShadow = savedBodyStyles.boxShadow;
      document.body.style.borderLeft = savedBodyStyles.borderLeft;
      document.body.style.borderRight = savedBodyStyles.borderRight;
      savedBodyStyles = null;
    }
    if (savedHtmlBg !== null) {
      document.documentElement.style.backgroundColor = savedHtmlBg;
      savedHtmlBg = null;
    }
    activeDevice = null;
    landscape = false;
    updateDeviceLabel();
    updateRotateBtn();
    const sel = document.getElementById('dt-device-select');
    if (sel) sel.value = '0';
  }

  function toggleLandscape() {
    if (!activeDevice) return;
    landscape = !landscape;
    applyPreview();
  }

  let rotateBtn, deviceLabel;
  function updateRotateBtn() {
    if (rotateBtn) rotateBtn.classList.toggle('dt-on', landscape);
  }
  function updateDeviceLabel() {
    if (!deviceLabel) return;
    if (activeDevice && activeDevice.w > 0) {
      const dw = landscape ? activeDevice.h : activeDevice.w;
      const dh = landscape ? activeDevice.w : activeDevice.h;
      deviceLabel.textContent = `${dw}\u00D7${dh} ${landscape ? 'landscape' : 'portrait'}`;
      deviceLabel.style.display = '';
    } else {
      deviceLabel.style.display = 'none';
    }
  }

  const bar = document.createElement('div');
  bar.id = 'dev-toolbar';

  const badge = document.createElement('span');
  badge.className = 'dt-badge';
  badge.textContent = 'DEV';
  bar.appendChild(badge);

  function sep() {
    const d = document.createElement('div');
    d.className = 'dt-sep';
    return d;
  }
  bar.appendChild(sep());

  const nav = document.createElement('div');
  nav.className = 'dt-pages';
  for (const p of pages) {
    const a = document.createElement('a');
    a.href = p.href;
    a.textContent = p.label;
    if ((isBreakComposer && p.label === 'breakComposer') || (!isBreakComposer && p.href === 'breakcomposer/index.html')) a.classList.add('dt-active');
    else if (location.pathname.endsWith(p.href) || location.pathname.endsWith(p.href.replace('../', ''))) a.classList.add('dt-active');
    nav.appendChild(a);
  }
  bar.appendChild(nav);
  bar.appendChild(sep());

  const info = document.createElement('div');
  info.className = 'dt-info';

  const deviceSelect = document.createElement('select');
  deviceSelect.className = 'dt-select';
  deviceSelect.id = 'dt-device-select';
  deviceSelect.title = 'Preview on device';
  const groups = {};
  devices.forEach((d, i) => {
    if (!groups[d.group]) groups[d.group] = [];
    groups[d.group].push({ ...d, idx: i });
  });
  for (const [groupName, items] of Object.entries(groups)) {
    if (groupName === 'Desktop') {
      const opt = document.createElement('option');
      opt.value = '0';
      opt.textContent = '\u{1F5A5} Desktop';
      deviceSelect.appendChild(opt);
      continue;
    }
    const optgroup = document.createElement('optgroup');
    optgroup.label = groupName;
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = String(item.idx);
      opt.textContent = `${item.label}  (${item.w}\u00D7${item.h})`;
      optgroup.appendChild(opt);
    });
    deviceSelect.appendChild(optgroup);
  }
  deviceSelect.addEventListener('change', () => {
    const idx = parseInt(deviceSelect.value, 10);
    const device = devices[idx];
    if (!device || device.w === 0) { deactivatePreview(); return; }
    activatePreview(device);
  });
  info.appendChild(deviceSelect);

  rotateBtn = document.createElement('button');
  rotateBtn.className = 'dt-btn';
  rotateBtn.textContent = '\u21BB';
  rotateBtn.title = 'Rotate (portrait / landscape)';
  rotateBtn.addEventListener('click', toggleLandscape);
  info.appendChild(rotateBtn);

  deviceLabel = document.createElement('span');
  deviceLabel.className = 'dt-device-label';
  deviceLabel.style.display = 'none';
  info.appendChild(deviceLabel);

  info.appendChild(sep());

  const viewport = document.createElement('span');
  viewport.id = 'dt-viewport';
  viewport.textContent = `${window.innerWidth}\u00D7${window.innerHeight}`;
  window.addEventListener('resize', () => { viewport.textContent = `${window.innerWidth}\u00D7${window.innerHeight}`; });
  info.appendChild(viewport);

  const reloadBtn = document.createElement('button');
  reloadBtn.className = 'dt-btn';
  reloadBtn.textContent = '\u21BB';
  reloadBtn.title = 'Hard reload';
  reloadBtn.addEventListener('click', () => location.reload());
  info.appendChild(reloadBtn);

  bar.appendChild(info);
  document.documentElement.appendChild(bar);
})();
