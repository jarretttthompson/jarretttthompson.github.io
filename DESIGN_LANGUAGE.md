# The Jrummer site — design language

**Status:** Active until you say otherwise.  
**Implementation:** `css/tailwind-built.css` (purged Tailwind build), `css/terminal-site.css`, `partials/nav.html`, shared HTML shell on main pages.

When changing the look of the site, **update this file** if tokens or rules change. When the user says they like (or dislike) something specific, **add a short note under [User preference log](#user-preference-log)**.

---

## Name & mood

- **Working label:** Y2K / lo-fi terminal / CRT-inspired OS shell (not a literal terminal emulator).
- **Feel:** Dark purple bands, **neon cyan** + **hot pink** accents, subtle **film grain**, **scanlines**, **thick glowing window chrome**, nostalgic but readable.

---

## Typography

| Role | Font | Notes |
|------|------|--------|
| Headings, nav, labels, “system” UI chrome | **Vulf Mono** | Uppercase + letter-spacing ok for small labels. |
| Body, descriptions, long copy | **Vulf Sans** | Default for `body.terminal-site`. |

- Fonts live under `fonts/` (see `@font-face` in `terminal-site.css`).
- Avoid mixing arbitrary third-party fonts on themed pages.

---

## Color tokens (canonical)

Defined in `:root` in `terminal-site.css` (keep in sync with Tailwind `extend` where duplicated).

| Token / role | Typical use |
|--------------|-------------|
| `--neon-cyan` `#00ff9f` | Primary accent, borders, glows, key headings |
| `--neon-pink` `#ff41af` | Secondary accent, highlights, links emphasis |
| `--deep-purple` `#0d0517` | Page-level darkness (mostly behind window now) |
| `--soft-purple` `#1a0b2e` | Supporting surfaces |
| `--panel-band-1` … `--panel-band-4` | **Horizontal banding** on main window background |
| Text on panels | ~`#eedcff` (soft lavender-white) |
| `--shell-radius-tl` … `--shell-radius-bl` | Outer window + header top + footer bottom **must stay in sync** so the neon border and purple fill share one rounded silhouette. |
| `--shell-frame-width` / `--shell-frame-color` | **Uniform** neon stroke on `.site-main-window::after` — **do not** use different `border-*-color` per side (dark greens disappear on purple and look like a missing edge). |
| `--shell-frame-glow-a` … `-c`, `--shell-frame-pink-halo` | **Symmetric** outer bloom (`box-shadow` with **0 0** blur only for halos) so left/right/top/bottom read the same. |
| `--ui-border-width`, `--ui-border-color`, `--ui-border-color-muted`, `--ui-border-color-strong` | **All inner chrome** (panels, nav pills, embeds, scroll client, friend cards, forms): **one stroke color on every side** — no per-side dark green “shadow” borders. |
| `--ui-border-glow-soft`, `--ui-border-glow` | Optional **symmetric** outer halos on inner components (always `0 0` offset). Pink callouts: `--ui-border-pink`, `--ui-border-pink-glow`. |

**Contrast:** Keep body text readable; glow is decoration, not the only contrast.

---

## Layout shell (every main page)

1. **`body.terminal-site`** — Column flex, **top-aligned** (`justify-start`), horizontal centering of the shell; transparent body bg (no dot grid). **Page scroll** on `body` (single scrollbar).
2. **`body.terminal-site::before`** — Full-viewport **rotating** `images/background.png`, blurred + vignette (original site asset).
3. **`.crt-overlay`** — Fixed, pointer-events none, subtle scanlines + RGB tint (z above content except intentional HUD).
4. **`.site-main-window`** — Single “desktop window”: banded gradient fill (rounded with the same **`--shell-radius-*`** tokens). **Neon frame is not a normal `border` on the box** — descendants would paint **on top** of it (CSS order). Instead, **`::after`** (`z-index: 60`, `pointer-events: none`) draws **`--shell-frame-width`** + **`--shell-frame-color`** (**uniform** on all sides) and **symmetric** multi-layer cyan + pink halos (`--shell-frame-glow-*`, `--shell-frame-pink-halo`) so the frame **reads evenly** left/right/top/bottom and **sits above** header, nav, and content. **`overflow: visible`** so outer `box-shadow` isn’t clipped (inset depth stays on the main box). Max width ~72rem, column flex. **Height follows content** (no `max-height` / inner scroll trap); the **whole shell** scrolls with the page like one document.
5. **`.site-shell-header` / `.site-shell-footer`** — Title bar uses **`border-top-left-radius` / `border-top-right-radius`** = `var(--shell-radius-tl)` / `var(--shell-radius-tr)`; footer bottom corners use **`var(--shell-radius-bl)` / `var(--shell-radius-br)`** so chrome lines up with the outer window curve. Frosted gradients, thin dividers, light glow. **Upper-right:** shared **wordmark** — `images/logo-jarrett-name.png` is a **cropped transparent** mask (white glyphs). Replace **`images/logo-jarrett-name-source.png`** with a flat export, then run `tools/build_logo_png.py` (auto-detects **hairline-on-gray** vs **light-on-black**). Update **`aspect-ratio`** in `terminal-site.css` (`.site-header-logo`) if the rebuilt crop size changes. Tinted **`--neon-pink`** with CSS `mask-mode: alpha` + `background-color`, plus **static outer glow** and a **linear-gradient sweep** (`::after`, `site-header-logo-glow-sweep`) through the glyphs; page title stays in a **screen-reader-only** `<h1 class="sr-only">` plus the left tagline.
6. **Nav** — Injected via `partials/nav.html` + `injectNav()`; style via **CSS classes in `terminal-site.css`** (don’t rely only on Tailwind for nav).
7. **Scroll** — **One scrollbar** on `body` (WebKit thumb styled like `.custom-scrollbar`). Main column uses **`.site-shell-content`** (no `overflow-y: auto`); **`.scroll-window`** remains the recessed “client” panel inside pages that use it.

Inner blocks use **`.neon-inner-panel`** (or equivalent) + optional **HUD corner brackets** where it fits.

---

## Effects & texture

- **`.lofi-static`** — Very light noise overlay on panels/windows.
- **Neon panels** — **`--ui-border-*`** uniform stroke + symmetric glow on inner UI; **outer window** uses **inset** depth on `.site-main-window` and **stroke + halos** on `.site-main-window::after` (above content).
- **“Luna” / XP-style chrome (same palette)** — Vertical gradients on title bar, nav strip, and taskbar-style footer; **inset highlights** (light top / shadow bottom) for *depth inside* controls — **neon outline** stays **uniform** (no fake 3D border that disappears on one side). **`--xp-*`** for gloss; **`--ui-border-*`** for the visible cyan frame.
- **Reduced motion:** Respect `prefers-reduced-motion` for rotating background (already in CSS).

---

## Copy & UX tone

- Use **plain, recognizable words** in UI: Home, resume/cv, Music, Projects, etc.
- Avoid **fake system jargon** in user-facing strings: no `SITE_V1`, `BIO_TEXT`, `DIR_HOME`, `SYSTEM_ONLINE`, random underscores, or “hacker flavor” unless it’s clearly decorative and minimal.
- **Decorative** terminal styling is ok in **visual design** (brackets, glow); **labels** should still read like a normal personal site.

### Casing (sentence-style prose)

- **Body copy and headings** use **normal capitalization from HTML** (sentence starts and titles capitalized where it reads naturally). CSS does **not** force lowercase on the page body.
- **Main nav** (`nav.nav-boxes a`) stays **stylistically lowercase** via CSS.
- **resume/cv:** class **`resume-prose`** on that page’s `scroll-window` keeps the document body exactly as authored (plus optional layout like the header photo).
- **Proper nouns / brands:** **`case-preserve`** spans or classes where you need explicit control (e.g. home intro).
- **Composition / piece titles** in **`<i>` / `<em>`** keep authored casing.
- **Friend names** (`.friend-name`), **footer location** (`.footer-line`), and **in-page links** (`.scroll-window a`) keep authored casing.
- **Dense prose pages:** **`mixed-case-prose`** on **`music`**, **`page5`**, **`page4`** `scroll-window` — full HTML casing preserved there.

---

## Tech conventions

- **Tailwind** via self-hosted **`css/tailwind-built.css`** (see `tailwind.config.js`, `npm run build:css`); **canonical look** for the shell is in **`terminal-site.css`**.
- Bump cache query strings on CSS/JS when iterating (`?v=…`) if users see stale assets.
- **`breakcomposer/`** is a separate app now aligned with the site design language via **`breakcomposer/breakcomposer-mobile.css`** (mobile + Luna-style overrides). Dev toolbar removed. For future reference see **`breakcomposer/STITCH_HANDOFF.md`**.

---

## Files to touch for global aesthetic changes

| Area | File(s) |
|------|---------|
| Tokens, shell, panels, CRT | `css/terminal-site.css` |
| Tailwind theme / purge | `tailwind.config.js` → `npm run build:css` → `css/tailwind-built.css` |
| Shared nav labels | `partials/nav.html` (CV page label: **resume/cv**, ASCII) |
| Page shell structure | Each `*.html` (mirror `index.html` / `page2.html` pattern) |

---

## Page pattern: Artwork (`page3.html`)

Stitch-style layout, aligned with tokens above (no JetBrains / no fake `DATA_STREAM` copy).

| Idea | Implementation |
|------|----------------|
| Gradient hero title + underline | `.artwork-hero`, `.artwork-hero-title`, `.artwork-hero-rule` |
| Cyan → pink gradient frame around sections | `.artwork-frame` + `.artwork-frame--a1` / `--a2` / `--a3` (asymmetric radii) |
| HUD corners | `.hud-bracket-tl` … `.hud-bracket-br` inside each frame |
| Intro row with icon | `.artwork-intro-row` + `.artwork-info-icon` (mono “i”, no Material font) |
| Poster strip | Existing `poster-carousel--manual` + `#posterCarouselManual` (`artwork.js`); fade at edges `.artwork-viewport-fade` |
| Poster tile shape | **Scoped to** `.artwork-page .poster-card` only (2:3 tiles, softer border) |
| Tip callout | `.artwork-tip` |
| Video + copy | `.artwork-video-grid`, `.artwork-embed-wrap`, `.artwork-embed-badge`, `.youtube-embed` |

**Poster carousel layout** for all `terminal-site` pages that use `.poster-carousel--manual` is defined in `terminal-site.css`.

---

## User preference log

_Add dated bullets when the user explicitly likes or wants to keep something. Agents: append here; don’t delete older entries without asking._

- **2026-03-20** — User wants the overall **Y2K neon terminal aesthetic** kept as the default direction for site-wide redesigns.
- **2026-03-20** — User asked for a **written design language + Cursor rule** so future sessions stay aligned, and to **remember what they like** via this log until further notice.
- **2026-03-20** — User wants the **Stitch “art data stream” artwork layout** (gradient section frames, asymmetric corners, horizontal poster previews, split column for YouTube) **adapted** into this design language (Vulf fonts, plain labels, shared site shell).
- **2026-03-20** — User wants **most site copy to read in lowercase** by default, with **resume/cv body unchanged** and **proper nouns preserved** (via `.case-preserve`, link text, italics, or `.mixed-case-prose` on dense pages).
- **2026-03-20** — User wants **sentence-initial capitalization** (normal grammar) for words that start sentences, not all-lowercase body text — implemented by **dropping global body lowercase** and capitalizing from HTML / keeping nav lowercase only.
- **2026-03-20** — User wants the site to say **resume/cv** (ASCII “resume”, no accents) everywhere that label appears, and a **performance photo** on the resume page header (`images/resume-photo.png`) beside name/contact without breaking the rest of the layout.
- **2026-03-20** — User wants **Windows XP / Luna–style** bubbly gradients and embossed controls **without changing** the vapor/neon color palette (see `--xp-*` in `terminal-site.css`).
- **2026-03-20** — User wants the **condensed name wordmark** (`images/logo-jarrett-name.png`) in the **upper-right** on main pages, **`--neon-pink`** with **glow** (sweeping highlight through the letters, not whole-logo scale pulse), replacing per-page header text (page title remains for screen readers via `sr-only` + tagline).
- **2026-03-20** — User provided an updated **hairline / tall condensed** wordmark reference; source lives at `images/logo-jarrett-name-source.png`, mask rebuilt for transparent PNG + pink mask.
- **2026-03-20** — User wants **breakComposer optimized for mobile** (phone + iPad): floating dock with Select / Copy / Accent / Ghost, design-language toolbar styling, safe-area handling. **Dev toolbar removed** from production page. Desktop parity preserved (mouse, keyboard shortcuts, no dock on `pointer: fine`).
- **2026-03-20** — User wants **one vertical scrollbar** on terminal-site pages: **whole `.site-main-window`** scrolls with the document (Word-like), not a nested scroll inside the window.
- **2026-03-20** — User wants the **shell fill and neon border to share the same rounded corners** (no sharp corners past the border), **slightly larger radius**, and a **thicker, more bloomed** cyan border + outer glow.
- **2026-03-20** — User wants the **neon frame to read in front of** inner chrome (not “behind” the shell) → implemented as **`.site-main-window::after`** above content.
- **2026-03-20** — User wants the **outer window border/glow uniform on every side** (left was bright, right looked missing) → **single stroke color** + **symmetric 0-offset halos**; tokens `--shell-frame-*`.
- **2026-03-20** — User wants that **same uniform neon border + symmetric glow treatment site-wide** on inner UI (panels, nav, embeds, forms, friends, carousel, photo album, etc.) → tokens **`--ui-border-*`** in `terminal-site.css`; **breakComposer** mobile overlay mirrors with **`--bc-ui-*`**.

---

## Agent checklist (quick)

- [ ] Shell: `crt-overlay` + `site-main-window` + header/footer/nav pattern matches siblings; **no inner `overflow-y-auto`** on `.site-shell-content` (document scroll on `body` only). Neon frame on **`.site-main-window::after`** with **`--shell-frame-*`** (**uniform** stroke, **symmetric** halos).
- [ ] Fonts: Vulf Mono (chrome/headings), Vulf Sans (body).
- [ ] Copy: human-readable UI strings; normal sentence caps in prose; nav may stay lowercase; avoid underscore_all_caps flavor text.
- [ ] Inner chrome: use **`--ui-border-*`** (uniform stroke; symmetric `0 0` glows). Don’t reintroduce per-side dark green border colors on neon outlines.
- [ ] New visual rules? Update this doc + `terminal-site.css` / tailwind config as needed.
