# Website Improvement Menu

Pick any item numbers from this list and I will implement them.

I reviewed the current project (`html/css/js`, media folders, data json, and page structure) and prioritized ideas that fit your current aesthetic while improving speed and portfolio quality.

---

## 0) Baseline Findings (from this audit)

- Media footprint is currently very large for a static portfolio:
  - `images`: ~123 MB
  - `slideshow`: ~127 MB
  - `posterPortfolio`: ~37 MB
  - `projects`: ~150 MB
- Several single files are very large (10-31 MB each), which directly impacts mobile load time.
- The photo album is now in a good direction visually; next wins are mostly packing/perf and maintainability.

---

## A) Performance Improvements

1. **Image optimization pass (highest impact)**  
   Convert oversized JPG/PNG to optimized WebP/AVIF variants and keep fallbacks where needed.

2. **Slideshow optimization pipeline**  
   Auto-generate smaller slideshow assets (desktop + mobile sizes) and update loading logic.

3. **Poster/project media compression pass**  
   Compress `posterPortfolio` and `projects` media with quality targets, preserving visual quality.

4. **Page-specific JS loading**  
   (Done) Shell logic lives in `js/main.js` + `js/modules/*`.

5. **CSS cleanup + split**  
   Move photo-album redesign styles into a dedicated section/file to reduce CSS complexity and regressions.

6. **Font optimization**  
   Add WOFF2 versions, keep OTF fallback, and improve font loading behavior.

7. **Embed performance improvements**  
   Add `loading="lazy"` and placeholder thumbnails where appropriate for YouTube/Spotify-heavy pages.

8. **Critical rendering path cleanup**  
   Remove non-critical preloads and tune initial paint assets.

9. **Optional local caching/service worker**  
   Cache static assets for repeat visitors while keeping content updates safe.

10. **Reduced effects mode toggle**  
   Add a user toggle for lower visual effects (scanlines/flicker/filters) to improve battery/perf on mobile.

---

## B) Aesthetic / UX Refinements (same vibe, cleaner execution)

11. **Global spacing and rhythm pass**  
   Normalize section spacing/padding/margins so pages feel more intentionally composed.

12. **Typography hierarchy pass**  
   Improve readability while preserving your neon CRT style (headings, body copy, section labels).

13. **Navigation consistency pass**  
   Ensure nav behavior/markup is fully unified across all pages.

14. **Photo album polish pack**  
   Fine-tune randomness thresholds (distance/tilt/scale) with 2-3 preset intensity options.

15. **Projects page visual hierarchy**  
   Add stronger project card intro blocks and cleaner transitions into galleries.

16. **Micro-interactions pass**  
   Subtle hover/focus transitions for links/cards/buttons that keep the same aesthetic.

17. **Mobile readability pass**  
   Improve text blocks and embed sizing on `music`, `compositions`, and long-form pages.

18. **Accessibility color contrast pass**  
   Preserve style while increasing legibility in high-glow/high-noise contexts.

---

## C) Portfolio Content Upgrades (higher conversion/credibility)

19. **Case-study format for projects**  
   Standardize each project with: role, tools, challenge, process, outcome.

20. **Featured work section on home**  
   Add a curated 3-6 project highlight strip with direct links.

21. **Resume call-to-action**  
   Add visible downloadable PDF resume button + contact CTA.

22. **Contact section/page**  
   Add a clean contact section (email + socials + optional form endpoint).

23. **Project metadata schema**  
   Expand `projects.json` with title/summary/tool tags/date/credits for richer display.

24. **About page depth pass**  
   Add concise bio + specialties + current focus + selected credits.

25. **Testimonials / collaborators section**  
   Add optional quotes from collaborators/clients to strengthen credibility.

26. **Press / performances / highlights timeline**  
   Add notable events and milestones in a scannable timeline.

---

## D) SEO / Discoverability / Sharing

27. **Per-page meta tags + OpenGraph**  
   Custom title/description/social card for each major page.

28. **Sitemap + robots + canonical pass**  
   Improve crawlability and avoid duplicate indexing issues.

29. **Structured data (Person + CreativeWork)**  
   Add JSON-LD so search engines better understand your portfolio.

30. **Custom social share images**  
   Create consistent OG images for home/projects/artwork/music.

---

## E) Reliability / Workflow

31. **Pre-publish validation script**  
   One command that checks broken links/media references before pushing.

32. **Media ingest script improvements**  
   Extend `update_photo_album.py` and related scripts to auto-normalize names/alt text.

33. **Branch + release workflow helper**  
   Add a small script for `dev-preview -> main` merge/push routine.

34. **Project maintenance docs**  
   Add contributor notes for how to add photos/projects/slides safely.

---

## Suggested starting bundles

- **Bundle S (Fastest wins):** `1, 2, 4, 7, 11, 17, 27, 31`
- **Bundle A (Aesthetic + UX):** `11, 12, 14, 15, 16, 17`
- **Bundle P (Portfolio growth):** `19, 20, 21, 22, 23, 26`

---

## How to choose

Reply with item numbers (example: `1, 2, 14, 19`) and I’ll implement them in priority order.
