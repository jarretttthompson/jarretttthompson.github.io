# Website Improvement Menu — v2 (March 2026 audit)

Fresh code-level audit. Supersedes v1 where items overlap; items already done or covered in v1 are noted.

---

## 🔴 Performance — Concrete bugs / easy wins

These are actual issues in the current code, not just best-practice suggestions.

### P1 — Uncomment the slideshow first-image preload
`index.html` has a commented-out `<link rel="preload" as="image">` for the first slide. Uncommenting it (after running `tools/optimize_media.py` once) eliminates the blank-image flash on initial load. One line change, biggest visual win.

### P2 — Calendar iframe isn't lazy-loaded
`lazyHydrateEmbeds()` in `core.js` only targets `.youtube-embed` and `.spotify-embed`. The Google Calendar iframe in `index.html` has no `loading="lazy"` and is not caught by the observer. It loads eagerly and blocks a third-party connection immediately on page open. Add `loading="lazy"` to that iframe or extend the observer to include it.

### P3 — Service worker doesn't cache JS module files
`sw.js` precaches `js/main.js` but not any of the `js/modules/*.js` files (`core.js`, `home.js`, `artwork.js`, etc.). On repeat visits, the entry point is served from cache but then has to re-fetch 5–6 module files over the network before anything runs. Add all module URLs to `STATIC_ASSETS`.

### P4 — Nav flash on every page
`injectNav()` fetches `partials/nav.html` from the network on every page, causing the "Loading navigation…" placeholder to flash briefly before nav appears. The nav partial isn't in the SW precache list, so it's never served from cache. Either add it to `STATIC_ASSETS` in `sw.js` (with a matching versioned URL), or consider inlining the nav directly into each HTML page and removing the runtime fetch entirely.

### P5 — Dead code in `startHeaderFlicker()`
The function immediately returns for every `data-terminal-site` page (i.e., every page on the site). The rest of the function — ~50 lines of flicker logic and a recursive `setTimeout` loop — is unreachable. It's imported, called, and executed on every page but does nothing. Either remove the function + import, or repurpose it for a future hover/focus effect.

### P6 — `photo-album.css` has no version cache-buster
Every other CSS file uses `?v=20260344`. `photo-album.css` is linked without one in `photo-album.html`. Browser caches will serve stale styles after updates.

### P7 — Photo album renders sequentially with `await` in a loop
`photo-album.js` builds each photo card one at a time in a `for` loop with `await` calls inside. On large albums this serializes what could be parallel image resolution. Switching to `Promise.all()` / `Promise.allSettled()` would let all cards resolve concurrently.

---

## 🟡 SEO & Meta — Missing across the whole site

These affect discoverability and how your site appears when shared.

### S1 — No favicon on the main site
`breakcomposer/` has `favicon.svg`. The main site has nothing — browsers make a 404 request for `/favicon.ico` on every page load. Copy or symlink the breakcomposer favicon (or create a new one) and add `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` to each page's `<head>`.

### S2 — No `<meta name="description">` on any page except a false match (a form input)
None of the HTML pages have an actual `<meta name="description">` tag. Search engines show a random excerpt instead. One sentence per page is enough.

### S3 — No OpenGraph or Twitter Card tags
When someone shares a link to your site on social media, no title/description/image preview appears — just the bare URL. Adding `og:title`, `og:description`, `og:image`, and `og:url` to each page fixes this. The home page with the slideshow could use one of your photos as the OG image.

### S4 — Page titles are generic and unbranded
Current titles: `friends`, `music`, `misc`, `photo album`, etc. These show up in browser tabs, bookmarks, and search results with no context. Consider `Jarrett Thompson · Music`, `Jarrett Thompson · Friends`, etc. Matches how `index.html` does it with `thejrummer`.

### S5 — No `theme-color` meta or web app manifest
Adding `<meta name="theme-color" content="#0d0517">` makes the browser chrome match your deep-purple background on mobile. A simple `site.webmanifest` (like breakcomposer's `manifest.json`) would also allow "Add to Home Screen" on iOS/Android with your branding.

### S6 — No robots.txt or sitemap
The `projects.html` page has a canonical tag, but there's no `sitemap.xml` or `robots.txt`. Both are one-time additions that help search engines index the right pages and ignore build artifacts (like `mobile-preview.html` and `terminal-experiment.html`).

### S7 — Facebook tracking params baked into `friends.html` hrefs
Several friend links contain long `?fbclid=...` query strings in the HTML source. These are session tokens that expire and make the HTML noisy. Strip them — the links work fine without them.

---

## 🔵 Aesthetic — Within design language

Referring to `DESIGN_LANGUAGE.md`: Y2K / lo-fi terminal / CRT, Vulf Mono + Vulf Sans, neon cyan + hot pink, uniform border treatment.

### A1 — Friends page could use the `neon-inner-panel` + HUD bracket treatment
Currently it just uses `.scroll-window` with `.friend-boxes` inside. The Friends page is the one main page that doesn't have the neon panel / HUD corner aesthetic that the rest of the site uses. Wrapping the friend grid in a `neon-inner-panel` with `hud-bracket-*` corners would make it feel part of the family.

### A2 — Music page structure is dense and informal
The `music.html` page is a series of paragraphs + iframes with no visual hierarchy — no headings, no panel labels, no section separation. Each "credit block" (song + collaborator list + embed) is a great candidate for a small neon panel card. Preserves the `mixed-case-prose` approach while making it more scannable.

### A3 — Typing / section label consistency
Some pages use `panel-kicker` for sub-labels, others use raw `<h3>` or skip labels entirely. A pass to ensure section labels follow the same pattern (font, color, size, case) would make the site feel more unified.

### A4 — No `<meta name="color-scheme" content="dark">` declared
The site is always dark, but without this meta some browsers briefly flash a white background during navigation before CSS loads. One line in the `<head>` of each page eliminates this.

### A5 — Hover states on friend cards could use neon glow treatment
Friend cards have basic hover styling. Applying the `--ui-border-glow` treatment on hover (matching how other inner panels already glow) would make them feel consistent with the rest of the UI.

---

## 🟢 Fun Future Projects

Things that would be genuinely useful, interesting, or just a great addition to the site's personality.

### F1 — Spotify "Now Playing" live widget
A small Vercel/Netlify serverless function proxies your Spotify Web API `currently-playing` endpoint. A little panel on the home page updates every 30s showing what you're listening to right now — album art, track, artist. When nothing is playing it shows "offline" or your last played track. Very on-brand for a musician's portfolio.

### F2 — Web Audio API drum visualizer on the Music page
Use the Web Audio API to draw a live waveform or frequency spectrum behind (or beside) the Spotify embeds while they're playing — the waveform would render in your neon cyan/pink palette. Falls back gracefully when audio permissions aren't granted.

### F3 — Guestbook / "sign the wall"
You already have the calendar add-event form (with PIN auth) working perfectly as a Google Apps Script backend. The same pattern — PIN + text submission → Sheets → displayed on page — could power a public guestbook that visitors can sign. It fits the personal/lo-fi feel of the Friends page perfectly.

### F4 — Randomize button ("surprise me")
A small button somewhere (footer, nav, or floating) that loads a random slide from your photo album in a modal, or navigates to a random page, or picks a random track. The kind of thing that rewards repeat visitors and adds personality.

### F5 — Site-wide "CRT intensity" slider
A small persistent toggle/slider (maybe in the footer chrome or as a sticky HUD element) that lets visitors dial the CRT effects up or down — controlling `opacity` of the `.crt-overlay`, the strength of the `lofi-static` grain, and scanline intensity. State saved to `localStorage`. Useful for people on battery/lower-power devices and fits the "OS settings panel" aesthetic.

### F6 — Performance/gig history timeline
A JSON-driven timeline (similar to how `photo-album.json` and `slides.optimized.json` work) showing notable gigs, recording sessions, or project milestones in chronological order. Rendered as a vertical neon-line timeline in the existing aesthetic. Low maintenance once the JSON format is set.

### F7 — Interactive "drum machine" easter egg
A hidden page or modal (maybe accessible via a keyboard shortcut or a small icon in the footer) with a simple step-sequencer grid — 8 steps, 4–6 drum sounds — playable in the browser using the Web Audio API. Ties directly into the breakComposer direction and shows off the maker side of the site.

### F8 — Livesets / recording archive page
A page that catalogs live recordings, sets, or session recordings — not just Spotify tracks — using audio players styled to the site's aesthetic (`<audio>` element with custom CSS controls in neon/CRT style). Could host files on GitHub LFS or link to external sources.

### F9 — "Currently working on" status panel
A small JSON-driven status block on the home page (like an old-school BBS status line) that you update manually: `{ "status": "Recording drums for Hugo's EP", "updated": "2026-03-22" }`. Dead simple — just edit a JSON file and push — but gives the site a "alive" feeling.

### F10 — Projects page auto-build from GitHub
A GitHub Action that fetches your pinned repos via the GitHub GraphQL API and auto-generates a section of `projects.html` (or a separate JSON) with repo name, description, stars, and last updated. Keeps the projects page fresh with zero manual upkeep.

---

## Suggested starting bundles

**Quick wins (< 1 hour combined):** P1, P2, P3, P4, S1, S4, A4, S7
**SEO/discoverability pass:** S1–S6 as a set
**Aesthetic consistency pass:** A1, A2, A3, A5
**Fun project to build next:** F1 (Now Playing) or F3 (Guestbook) — both reuse your existing Google Apps Script / fetch pattern

---

Reply with item codes (e.g. `P1, P3, S1, A1`) and I'll implement them in order.
