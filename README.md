# thejrummer.art

Static personal site for Jarrett Thompson, hosted at:

- `https://thejrummer.art`
- `https://jarretttthompson.github.io`

## Local preview

You do **not** need an assistant or extra tooling to run the site locally—use one of these from the **repository root**:

| Command | What it does |
|--------|----------------|
| `./serve` | Runs `python3 run_site.py` (chmod +x once if needed). |
| `npm run serve` | Same server; requires Node/npm. |
| `python3 run_site.py` | Direct; picks a free port (often 8000), binds `0.0.0.0`, prints LAN URLs, tries to open a browser. |

Then open (port may differ—use the URL printed in the terminal):

- Site home: `http://127.0.0.1:8000/index.html`
- breakComposer (bundled in this repo): `http://127.0.0.1:8000/breakcomposer/index.html`

Stop the server with **Ctrl+C**.

## Site Tuner (dev only)

The interactive **Site Tuner** must **not** be merged or pushed to **`main`** in a way that ships it to production visitors. See **`docs/SITE_TUNING_POLICY.md`**.

## CSS: Tailwind (self-hosted)

Utilities come from a **purged** build, not the Tailwind CDN:

1. `npm install` (once; `node_modules/` is gitignored)
2. `npm run build:css` — reads `css/tailwind-input.css` + `tailwind.config.js`, writes **`css/tailwind-built.css`** (~20KB minified).

After changing HTML classes or `tailwind.config.js`, rebuild and commit **`css/tailwind-built.css`**. GitHub Pages has no Node step, so the built file must be in the repo for deploy.

## Projects page: app repos that self-update

This site includes a single **Projects** page at `page4.html` (apps + portfolio). `projects.html` redirects there.
The `PROJECTS` list in `page4.html` is kept in sync (manually) with your public GitHub repositories.
Each app is ideally hosted on GitHub Pages from its own repo, then embedded in this site with an iframe.

### How it works

1. Every app has its own repo (example: `jarretttthompson/alarm-clock`).
2. That app repo deploys to GitHub Pages on push to `main`.
3. The app URL is stable: `https://jarretttthompson.github.io/<repo-name>/`.
4. `page4.html` launches that URL in an iframe.

When you update an app repo, the embedded app updates automatically after that repo deploys.
No app code is copied into this main site repo.

## Add a new app project (future workflow)

1. Create a new app repo, e.g. `jarretttthompson/new-app`.
2. In that app repo, add `.github/workflows/deploy.yml` using this repo's template:
   - `/.github/workflows/deploy-app-template.yml`
3. Push your app code to `main`.
4. In this main site repo, open `page4.html`.
5. Add one object to the `PROJECTS` array:

```js
{
  name: "New App",
  description: "Short description.",
  tags: ["HTML", "CSS", "JavaScript"],
  repo: "new-app",
  liveUrl: "https://jarretttthompson.github.io/new-app/",
  githubUrl: "https://github.com/jarretttthompson/new-app",
  // Optional hero (same layout as breakComposer):
  // heroSrc: "path/to/banner.png",
  // heroAlt: "New App",
  // heroHref: "https://jarretttthompson.github.io/new-app/"
  // If the app is bundled in THIS repo (not a separate GitHub Pages project), set:
  // embedUrl: "/my-app/",
  // …so Launch app / iframe use same-origin URLs and avoid GitHub 404s.
}
```

6. Push this site update.

Done. Future app updates only require pushes to the app repo.

## Troubleshooting: Projects nav looks stale

This site registers a **service worker** (`sw.js`). Older versions precached `partials/nav.html`, which could freeze the nav as **Projects → page4.html** even after the repo was updated.

**Fix in the repo (already done in current main):**

- Nav is fetched as `partials/nav.html?v=…` so caches bust when the version changes.
- The service worker cache name is bumped when that happens.

**Fix in your browser if it still happens:**

- Safari: Settings → Advanced → Website Data → remove your site, or hard refresh after an update.
- Chrome: DevTools → Application → Service Workers → Unregister, then reload.

You must **push** this repo to GitHub for the live site (thejrummer.art) to change.

## Images: WebP / AVIF and ≤500 KB per derivative

Large JPG/PNG in `projects/`, `slideshow/`, and `posterPortfolio/` bloat the repo and bandwidth. The site serves **compressed copies** from `optimized/` (see `js/modules/media.js`).

1. `python3 -m pip install -r tools/requirements-media.txt`
2. `python3 tools/optimize_media.py`
3. Commit the updated `optimized/` tree and `slides.optimized.json`.

Details and how to **drop originals from Git** after verification: **`docs/MEDIA_OPTIMIZATION.md`**.
