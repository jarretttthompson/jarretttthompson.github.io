# breakComposer — design handoff for Google Stitch (mobile + desktop)

**Purpose:** Give Stitch (and any designer) enough context to **optimize breakComposer for mobile** while keeping the app **fully usable on laptop/desktop**. This document ties the **thejrummer / jarretttthompson.github.io design language** to this sub-app.

**Canonical site doc:** `../DESIGN_LANGUAGE.md` (full tokens, casing rules, shell patterns).  
**This file:** breakComposer-specific constraints + how to align UI without breaking the bundled app.

---

## 1. What breakComposer is

- **Web app (React, bundled)** served from `breakcomposer/` — main UI is in `assets/index-*.js` + `assets/index-*.css`; **avoid hand-editing bundles** unless you control the source repo.
- **Role:** Interactive **breakbeat drum pattern composer** — piano roll + synced notation, tempo, time signature, pattern generation (“breakbeat”), note editing (select, move, copy, accent, ghost), etc.
- **PWA:** `manifest.json` — `display: standalone`, `orientation: landscape`, theme/background colors. Mobile installs should still feel usable in **portrait** if the user rotates; **do not assume landscape-only** for layout (some devices lock orientation; others don’t).

---

## 2. Design language to carry into the app

### 2.1 Mood & brand

- **Label:** Y2K / lo-fi **terminal / CRT-inspired OS shell** — nostalgic, **not** a literal terminal emulator.
- **Feel:** Dark purple bases, **neon cyan** + **hot pink** accents, optional **film grain / scanlines**, **glowing window chrome** (see Luna notes below).
- **Consistency:** breakComposer already leans **purple + pink**; aligning cyan accents with the main site is welcome but **must not** destroy contrast on the piano roll / notation.

### 2.2 Typography (canonical)

| Role | Font | Notes |
|------|------|--------|
| UI chrome, labels, toolbar, small controls | **Vulf Mono** | Mono, “system” feel; uppercase + letter-spacing ok for tiny labels. |
| Body, help text, longer strings | **Vulf Sans** | Readable body copy. |

**Implementation note:** The main site loads Vulf via `@font-face` in `css/terminal-site.css`. The breakComposer bundle may not embed Vulf; **Stitch should specify** `font-family: "Vulf Mono", ui-monospace, monospace` and `"Vulf Sans", system-ui, sans-serif` and assume the app will load the same fonts or webfont fallbacks.

### 2.3 Color tokens (canonical — do not invent new brand hues)

| Token | Hex | Use |
|-------|-----|-----|
| `--neon-cyan` | `#00ff9f` | Primary accent, borders, key headings, glows |
| `--neon-pink` | `#ff41af` | Secondary accent, highlights, emphasis |
| `--deep-purple` | `#0d0517` | Page / app background depth |
| `--soft-purple` | `#1a0b2e` | Panels, surfaces |
| Text on panels | ~`#eedcff` | Primary readable text |

**Existing breakComposer overlay UI** (injected in `index.html`) already uses **pink-tinted** borders (`rgba(224, 111, 234, …)`) and dark panels — **map these toward** `#ff41af` / `#1a0b2e` family for consistency, but **preserve contrast** for WCAG on controls.

### 2.4 “Luna” / Windows XP–style surfaces (optional)

- **Vertical gradients** on **title bars** (toolbar), **taskbar-like** footers if any.
- **Inset highlights** (light top edge, shadow bottom) on **raised buttons** and **panels**.
- **Rounded top corners** slightly more than bottom on “windows” if you use card frames.
- **Important:** Same **palette** as above — structure only, **no new rainbow colors**.

### 2.5 Copy & UX tone

- **Plain English** controls: “Clear”, “BPM”, “How to use”, “Select”, “Copy”.
- **Avoid** fake system strings (`SITE_V1`, `DIR_*`, `SYSTEM_ONLINE`, unnecessary underscores).
- **Decorative** brackets/glow = OK; **labels** must read like a real music tool.

---

## 3. Current UI surfaces (for Stitch awareness)

These are **not** in the React bundle but are **part of the shipped page** — designs should **harmonize** with them.

| Surface | Behavior |
|---------|----------|
| **Toolbar** | Top area with classes like `toolbar-safe-top` / `toolbar-compact`.
| **Mobile “Select” / “Copy”** | Buttons injected near the **BPM** control; pink border, dark panel, Vulf Mono.
| **“?” help** | Modal with step list (notation, selection, move, copy/paste, clear, breakbeat, accent/ghost, tempo/signature).
| **Logo overlay** | Fixed logo between toolbar and staff (processed PNG); optional visually. |
| **Dev toolbar** | Only on `localhost` — device preview; **do not** rely on it for production. |

**Mobile gesture behavior (must preserve):** On touch, **Select** and **Copy** synthesize **mouse events** on the piano-roll canvas (right-click drag for multi-select; Cmd/Ctrl-drag for copy). **Desktop mouse** uses real events — **do not** remove or block mouse paths for “mobile-only” layouts.

---

## 4. Mobile optimization — what Stitch should design for

### 4.1 Touch targets

- **Minimum ~44×44px** (or 48dp) for primary actions (transport, mode toggles, BPM, time signature, Clear, breakbeat).
- **Avoid** cramming the full desktop toolbar into one row without wrapping or overflow — use **scrollable toolbar**, **bottom sheet**, or **collapsible groups**.

### 4.2 Safe areas & notches

- `viewport-fit=cover` is set — respect **`env(safe-area-inset-*)`** for fixed toolbars and modals.
- **Landscape** on phones: vertical space is scarce; **notation + piano roll** both need height — consider **collapsible notation** or **tab strip** (Notation | Roll) on small heights.

### 4.3 Performance & clarity

- **High contrast** for grid lines and hit targets on the piano roll (dark background + neon grid is on-brand; keep **readability**).
- **Reduce decorative glow** on the roll itself if it interferes with seeing hits; **keep glow on chrome** (toolbar, panels).

### 4.4 Orientation

- Manifest prefers **landscape**; UI should still **degrade gracefully** in portrait (e.g. stacked toolbar, scroll).

### 4.5 Reduced motion

- Respect **`prefers-reduced-motion`** for looping animations, background parallax, or pulsing glows.

---

## 5. Desktop / laptop — non‑negotiable parity

Stitch must **not** treat breakComposer as a phone-only app.

| Requirement | Why |
|-------------|-----|
| **Mouse + keyboard** | Right-click drag selection, Shift (accent), Option/Alt (ghost), Cmd/Ctrl+drag copy — **documented in help modal**. |
| **Keyboard shortcuts** | Must remain discoverable (help panel or tooltip hints). |
| **Pointer vs touch** | Injected mobile code **skips** `pointerType === 'mouse'` — desktop must not get synthetic pointer hijacking. |
| **Large screens** | Piano roll and notation should **use** extra width/height; **no max-width prison** that only makes sense on mobile. |
| **Multi-window / PWA** | Standalone window should still expose full feature set. |

**Design implication:** Provide **responsive breakpoints** (e.g. compact / comfortable / wide) with **feature parity**, not “mobile lite” vs “desktop full.”

---

## 6. Feature checklist (do not remove in redesign)

Use this as acceptance criteria for any Stitch output that flows into implementation:

1. **Place notes** — click/tap piano roll; notation updates.
2. **Multi-select** — right-click drag (desktop) or **Select** mode + drag (touch).
3. **Move** selected notes — drag as today.
4. **Copy / duplicate** — Cmd/Ctrl + drag (desktop) or **Copy** mode + drag (touch).
5. **Clear** pattern.
6. **Generate breakbeat** (button).
7. **Accent** — Shift + selection.
8. **Ghost** — Option/Alt + selection.
9. **Tempo (BPM)** and **time signature** — editable in toolbar.
10. **Help** — “How to use” discoverable.

---

## 7. Assets & paths (repo)

| Asset | Path |
|-------|------|
| App entry | `breakcomposer/index.html` |
| Manifest | `breakcomposer/manifest.json` |
| Icons | `breakcomposer/logo-simple.png`, `favicon.svg`, `icons.svg` |
| Full logo (overlay) | `breakcomposer/logo-full.png` |

---

## 8. What to paste into Stitch (short prompt block)

You can copy this verbatim as a starting prompt:

> Design **breakComposer**, a **breakbeat drum pattern web app** (piano roll + notation). **Theme:** Y2K neon terminal — dark purple (`#0d0517` / `#1a0b2e`), **neon cyan** `#00ff9f`, **hot pink** `#ff41af`, text ~`#eedcff`. Fonts: **Vulf Mono** for UI chrome, **Vulf Sans** for body. **Optional:** Windows XP Luna–style glossy gradients on toolbar/panels (same colors). **Mobile:** large touch targets, safe areas, optional collapsible sections for small height; **Desktop:** full parity — mouse right-click selection, keyboard modifiers (Shift, Alt, Cmd/Ctrl), no mobile-only feature set. **Tone:** plain English labels, no fake hacker strings. Deliver **responsive layouts** (phone + tablet + desktop) and **component states** (default, hover, active, disabled).

---

## 9. After Stitch — engineering note

Visuals from Stitch will need to be applied in the **source** of the React app (not the minified `assets/index-*.js`), or via **CSS variables** / theme layer if the project refactors. The **injected scripts** in `index.html` (mobile tools, help, logo) should be updated to match the **final toolbar DOM** (selectors like `[class*="toolbar"]` and BPM anchor are fragile).

---

## 10. Revision

- **2026-03-20** — Initial handoff doc for Google Stitch: site design language + breakComposer constraints + mobile/desktop parity.
