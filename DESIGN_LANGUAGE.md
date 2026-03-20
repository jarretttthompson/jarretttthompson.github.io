# The Jrummer site — design language

**Status:** Active until you say otherwise.  
**Implementation:** `css/terminal-site.css`, `js/tailwind-site-config.js`, `partials/nav.html`, shared HTML shell on main pages.

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

**Contrast:** Keep body text readable; glow is decoration, not the only contrast.

---

## Layout shell (every main page)

1. **`body.terminal-site`** — Centered flex, transparent body bg (no dot grid).
2. **`body.terminal-site::before`** — Full-viewport **rotating** `images/background.png`, blurred + vignette (original site asset).
3. **`.crt-overlay`** — Fixed, pointer-events none, subtle scanlines + RGB tint (z above content except intentional HUD).
4. **`.site-main-window`** — Single “desktop window”: banded gradient fill, **thick (~3px) neon border**, multi-layer **outer glow** (cyan + hint of pink), `border-radius: 12px`, max width ~72rem, vertical flex column.
5. **`.site-shell-header` / `.site-shell-footer`** — Frosted dark bars, thin white borders, light cyan glow. **Upper-right:** shared **wordmark** — `images/logo-jarrett-name.png` is a **cropped transparent** mask (white glyphs). Replace **`images/logo-jarrett-name-source.png`** with a flat export, then run `tools/build_logo_png.py` (auto-detects **hairline-on-gray** vs **light-on-black**). Update **`aspect-ratio`** in `terminal-site.css` (`.site-header-logo`) if the rebuilt crop size changes. Tinted **`--neon-pink`** with CSS `mask-mode: alpha` + `background-color`, plus **static outer glow** and a **linear-gradient sweep** (`::after`, `site-header-logo-glow-sweep`) through the glyphs; page title stays in a **screen-reader-only** `<h1 class="sr-only">` plus the left tagline.
6. **Nav** — Injected via `partials/nav.html` + `injectNav()`; style via **CSS classes in `terminal-site.css`** (don’t rely only on Tailwind for nav).
7. **Scroll area** — `flex-1 overflow-y-auto custom-scrollbar` wrapping **`.scroll-window`** for page content.

Inner blocks use **`.neon-inner-panel`** (or equivalent) + optional **HUD corner brackets** where it fits.

---

## Effects & texture

- **`.lofi-static`** — Very light noise overlay on panels/windows.
- **Neon panels** — Border + soft box-shadow; outer window is the **strongest** glow.
- **“Luna” / XP-style chrome (same palette)** — Vertical gradients on title bar, nav strip, and taskbar-style footer; **inset highlights** (light top / shadow bottom) on panels, buttons, inputs, and embeds; **slightly rounder top** on the main window (`border-radius` taller on top than bottom). Implemented in `terminal-site.css` via `--xp-*` tokens — **no new hues**, only bevel + gloss.
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

- **Tailwind** via CDN + `js/tailwind-site-config.js` for utilities; **canonical look** for the shell is in **`terminal-site.css`**.
- Bump cache query strings on CSS/JS when iterating (`?v=…`) if users see stale assets.
- **`breakcomposer/`** is a separate app now aligned with the site design language via **`breakcomposer/breakcomposer-mobile.css`** (mobile + Luna-style overrides). Dev toolbar removed. For future reference see **`breakcomposer/STITCH_HANDOFF.md`**.

---

## Files to touch for global aesthetic changes

| Area | File(s) |
|------|---------|
| Tokens, shell, panels, CRT | `css/terminal-site.css` |
| Tailwind theme mirror | `js/tailwind-site-config.js` |
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

**Poster carousel layout** for all `terminal-site` pages that use `.poster-carousel--manual` is defined in `terminal-site.css` (does not depend on legacy `style.css`).

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

---

## Agent checklist (quick)

- [ ] Shell: `crt-overlay` + `site-main-window` + header/footer/nav pattern matches siblings.
- [ ] Fonts: Vulf Mono (chrome/headings), Vulf Sans (body).
- [ ] Copy: human-readable UI strings; normal sentence caps in prose; nav may stay lowercase; avoid underscore_all_caps flavor text.
- [ ] New visual rules? Update this doc + `terminal-site.css` / tailwind config as needed.
