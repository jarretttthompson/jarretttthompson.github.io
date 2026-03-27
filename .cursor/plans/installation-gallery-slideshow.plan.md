---
name: Installation gallery slideshow
overview: Replace the horizontal projects carousel for the Southern Social install with a single-frame slideshow (prev/next, optional autoplay), reusing existing site slideshow styling where it fits and handling both images and videos from projects.json.
todos:
  - id: slideshow-dom
    content: Refactor projects.js createProjectSection to build a slideshow stage + controls (no poster-carousel track)
  - id: slideshow-css
    content: Add scoped slideshow styles in terminal-site.css (reuse/adapt .slideshow tokens; one visible slide, object-fit cover)
  - id: slideshow-media
    content: Wire images via buildOptimizedPicture; videos with play/pause on slide change and keyboard/touch a11y
  - id: copy-layout
    content: Optional page4.html prose wrapper (max-width) per earlier readability note
  - id: verify
    content: Test page4 install section + confirm page3 artwork carousel unchanged
---

# Installation project — slideshow instead of carousel

## Direction change

Move **away from the horizontal carousel** (`.poster-carousel`, prev/next scroll) for the install gallery. Implement a **slideshow**: one full-width (or constrained) **stage** at a time with explicit **previous / next** (and optionally **autoplay** with pause control).

## Why not extend the homepage slideshow verbatim?

The homepage pattern in [`index.html`](index.html) + [`js/modules/home.js`](js/modules/home.js) (`initHomeSlideshow`) uses **two** `<picture>` nodes and cross-fades for a **timer-only** rotation driven by [`slides.optimized.json`](slides.optimized.json). It does not handle **videos** or **many** slides with manual navigation.

The install manifest ([`projects/projects.json`](projects/projects.json)) has **many** images **and** `.MOV` videos. A better fit:

- **One active slide** in the DOM (or a minimal double-buffer only if we want cross-fade transitions without flashing).
- **Index-based** navigation: `currentIndex`, render/update the stage when index changes.
- **Videos**: only the active slide’s `<video>` should play; **pause** when leaving the slide; respect `controls`, `playsinline`, `muted` defaults as today.

## Implementation outline

### 1. [`js/modules/projects.js`](js/modules/projects.js)

- Replace the carousel structure (`poster-carousel`, viewport, track, many `.poster-card` siblings) with something like:
  - `section.project-section` > `div.projects-slideshow` (name TBD) >
    - `div.projects-slideshow__stage` (single container for current media)
    - `div.projects-slideshow__controls` — **Previous**, **Next**, optional **Play/Pause** (autoplay), optional **counter** (`1 / N`)
- On **next/prev**: increment/decrement index modulo `items.length`; swap stage content:
  - **Image**: `buildOptimizedPicture` (could cache created elements per index to avoid refetching manifest)
  - **Video**: create or reuse `<video>`; **pause** previous video when switching
- Optional: **keyboard** (`ArrowLeft` / `ArrowRight`) when stage is focused or section is in view.
- Optional **autoplay** (images only or longer interval): user preference — default off or subtle (e.g. 5s) with pause button for a11y.

### 2. [`css/terminal-site.css`](css/terminal-site.css)

- **Scoped** classes under e.g. `.projects-gallery .projects-slideshow` so **artwork** [`page3.html`](page3.html) poster carousel is **unchanged**.
- Reuse **visual language** from existing `.terminal-site .slideshow` ([`terminal-site.css`](css/terminal-site.css) ~892–933): bordered panel, aspect ratio, `object-fit: cover` on imgs so **no empty letterboxing** inside the stage (pick one ratio e.g. `16/9` or `4/3` and accept crop).
- Style control buttons to match **nav / panel** affordances (existing mono borders, neon accents — see design tokens in [`DESIGN_LANGUAGE.md`](DESIGN_LANGUAGE.md)).

### 3. [`page4.html`](page4.html) (optional)

- Optional wrapper for the Southern Social **copy** block: comfortable **max line length** and spacing only (no copy rewrite required).

## Out of scope (unless you ask later)

- Rewriting `generate_projects_manifest.py` / JSON schema (unless we add optional `caption` per slide).
- Changing breakComposer or other `PROJECTS` cards.

## Verification

- Install gallery: prev/next cycles all items; images fill the stage cleanly; videos play only when selected and pause when not.
- **page3** artwork: still uses the existing poster carousel — no regressions.
- Reduced motion: respect `prefers-reduced-motion` for any autoplay or transitions.
