# Media optimization (WebP / AVIF, ≤500 KB per file)

The site **serves compressed derivatives** from the `optimized/` folder. HTML/JSON still reference original paths (e.g. `projects/foo/photo.jpg`); JavaScript builds `<picture>` URLs as `optimized/projects/foo/photo.{avif,webp,jpg}`.

## 1. Install tooling

```bash
cd jarretttthompson.github.io   # repo root
python3 -m pip install -r tools/requirements-media.txt
```

Use **`python3 -m pip`** (not bare `pip`) if your shell says `command not found: pip`.

Needs **Python 3** with **Pillow** and **pillow-avif-plugin** (for AVIF).

## 2. Generate derivatives

```bash
python3 tools/optimize_media.py
```

This reads:

- `photo-album.json`
- `posters.json`
- `projects/projects.json`
- `slides.json`

…and writes **multi-resolution** files under `optimized/` (e.g. `…-t0.webp`, `…-t1.webp`, `…-t2.jpg`), plus:

- **`optimized/variants.json`** — `sizes` + per-width URLs for **`<picture srcset>`** (photo album, posters, project gallery).
- **`slides.optimized.json`** — home slideshow entries with `desktop` / `mobile` each containing `sizes` + `tiers[]` (`w`, `avif`, `webp`, `jpg`).

**Budget:** each emitted file is targeted at **≤ 500 KiB** (adjust `MAX_OUTPUT_KB` in `tools/optimize_media.py` if needed).

## 3. Verify locally

Run your usual static server and spot-check:

- Home slideshow
- Artwork posters
- Photo album (thumbnails + “open full” should use optimized JPEG)
- Projects gallery on `page4.html`

## 4. Shrinking the Git repo (optional, high impact)

Optimized files are small; **original JPG/PNG under `projects/`, `slideshow/`, `posterPortfolio/`, etc. can still be hundreds of MB**.

After you trust the optimized output:

1. Add paths to **`.gitignore`** if you want to keep masters only on disk, **or**
2. Remove originals from Git tracking (site still works if `optimized/` is committed):

   ```bash
   git rm -r --cached projects/some-heavy-folder/   # example
   ```

3. Commit `optimized/` + manifest changes.

**Backup** irreplaceable masters outside the repo before deleting.

## 5. CI (optional)

You can run `python3 tools/optimize_media.py` in GitHub Actions before deploy so `optimized/` is always fresh; cache pip for speed.
