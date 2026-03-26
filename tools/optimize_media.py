#!/usr/bin/env python3
"""Generate optimized image derivatives (AVIF + WebP + JPEG) for the static site.

Each output file is kept at or below MAX_OUTPUT_KB (default 500 KiB) by lowering
quality and, if needed, reducing resolution.

Gallery / posters / projects: multi-resolution bundles under optimized/:
  optimized/<path-without-ext>-t0.{avif,webp,jpg}, -t1..., -t2...
  plus optimized/variants.json (sizes + srcset metadata for JS).

Slideshow: per slide, desktop + mobile each get multiple width tiers; entries in
slides.optimized.json include sizes + tiers[] with w + urls for srcset.

Usage (from repo root):
  python3 -m pip install -r tools/requirements-media.txt
  python3 tools/optimize_media.py

To shrink the Git repo after verifying the site: stop tracking huge originals
(see docs/MEDIA_OPTIMIZATION.md).
"""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path
from typing import Any, Callable

from PIL import Image, ImageOps

try:
    import pillow_avif  # noqa: F401  # registers AVIF encoder with Pillow
except ImportError:
    pillow_avif = None

ROOT = Path(__file__).resolve().parents[1]
OPT = ROOT / "optimized"

# Target max file size per emitted derivative (KiB)
MAX_OUTPUT_KB = 500
MAX_OUTPUT_BYTES = MAX_OUTPUT_KB * 1024

# Do not shrink the long edge below this (unless we cannot fit budget at all)
MIN_LONG_EDGE = 320

PHOTO_JSON = ROOT / "photo-album.json"
POSTERS_JSON = ROOT / "posters.json"
PROJECTS_JSON = ROOT / "projects" / "projects.json"
SLIDES_JSON = ROOT / "slides.json"
SLIDES_OPTIMIZED_JSON = ROOT / "slides.optimized.json"
VARIANTS_JSON = OPT / "variants.json"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".JPG", ".JPEG", ".PNG", ".WEBP"}

# Max box (w,h) per tier for gallery-style images (album, posters, project stills)
GALLERY_BOXES: list[tuple[int, int]] = [(480, 480), (960, 960), (1600, 1600)]
# sizes= hint for <picture> when shown in grids / carousels
GALLERY_SIZES = (
    "(max-width: 480px) 88vw, (max-width: 768px) 55vw, (max-width: 1200px) 38vw, 360px"
)

# Slideshow hero: separate tier lists for desktop vs mobile columns
SLIDESHOW_DESKTOP_BOXES: list[tuple[int, int]] = [(800, 600), (1200, 900), (1600, 1200)]
SLIDESHOW_MOBILE_BOXES: list[tuple[int, int]] = [(480, 640), (720, 960), (900, 1400)]
SLIDESHOW_DESKTOP_SIZES = "(max-width: 768px) 0px, min(92vw, 900px)"
SLIDESHOW_MOBILE_SIZES = "(max-width: 768px) 92vw, 100vw"

# Filled during run(); written to optimized/variants.json at end
VARIANTS_MANIFEST: dict[str, Any] = {}


def rel_without_ext(path: Path) -> Path:
    return path.with_suffix("")


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def load_image(path: Path) -> Image.Image:
    with Image.open(path) as im:
        fixed = ImageOps.exif_transpose(im)
        return fixed.copy()


def fit_size(width: int, height: int, max_width: int, max_height: int) -> tuple[int, int]:
    ratio = min(max_width / width, max_height / height, 1.0)
    return max(1, int(width * ratio)), max(1, int(height * ratio))


def resize_to_box(im: Image.Image, max_w: int, max_h: int) -> Image.Image:
    ow, oh = im.size
    nw, nh = fit_size(ow, oh, max_w, max_h)
    if (nw, nh) == (ow, oh):
        return im
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def scale_by_factor(im: Image.Image, factor: float) -> Image.Image:
    if factor >= 0.999:
        return im
    w, h = im.size
    nw = max(1, int(w * factor))
    nh = max(1, int(h * factor))
    long_edge = max(nw, nh)
    if long_edge < MIN_LONG_EDGE:
        ratio = MIN_LONG_EDGE / long_edge
        nw = max(1, int(nw * ratio))
        nh = max(1, int(nh * ratio))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def flatten_rgba(im: Image.Image) -> Image.Image:
    if im.mode != "RGBA":
        return im.convert("RGB")
    bg = Image.new("RGB", im.size, (0, 0, 0))
    bg.paste(im, mask=im.split()[-1])
    return bg


def binary_search_best_quality(encode: Callable[[int], bytes], lo: int, hi: int, max_bytes: int) -> bytes | None:
    """Return largest blob under max_bytes, or None if even lo fails."""
    best: bytes | None = None
    low, high = lo, hi
    while low <= high:
        mid = (low + high) // 2
        blob = encode(mid)
        if len(blob) <= max_bytes:
            best = blob
            low = mid + 1
        else:
            high = mid - 1
    return best


def encode_avif(im: Image.Image, quality: int) -> bytes:
    buf = io.BytesIO()
    q = max(25, min(quality, 80))
    im.save(buf, "AVIF", quality=q)
    return buf.getvalue()


def encode_webp(im: Image.Image, quality: int) -> bytes:
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=6)
    return buf.getvalue()


def encode_jpeg(im_rgb: Image.Image, quality: int) -> bytes:
    buf = io.BytesIO()
    im_rgb.save(
        buf,
        "JPEG",
        quality=min(max(quality, 20), 88),
        optimize=True,
        progressive=True,
    )
    return buf.getvalue()


def save_format_under_cap(
    im_base: Image.Image,
    out_path: Path,
    fmt: str,
    max_bytes: int,
) -> bool:
    """
    im_base: RGB or RGBA, already resized to initial max dimensions.
    Tries scale factors then quality binary search.
    """
    ensure_parent(out_path)
    scales = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.34, 0.27, 0.22, 0.18]

    for factor in scales:
        scaled = scale_by_factor(im_base, factor)
        if fmt == "avif":
            if pillow_avif is None:
                return False
            work = scaled if scaled.mode in ("RGB", "RGBA") else scaled.convert("RGB")

            def enc_avif(q: int) -> bytes:
                return encode_avif(work, q)

            blob = binary_search_best_quality(enc_avif, 28, 75, max_bytes)
            if blob is not None:
                out_path.write_bytes(blob)
                return True

        elif fmt == "webp":
            work = scaled if scaled.mode in ("RGB", "RGBA") else scaled.convert("RGB")

            def enc_webp(q: int) -> bytes:
                return encode_webp(work, q)

            blob = binary_search_best_quality(enc_webp, 30, 90, max_bytes)
            if blob is not None:
                out_path.write_bytes(blob)
                return True

        elif fmt == "jpeg":
            work = flatten_rgba(scaled)

            def enc_jpg(q: int) -> bytes:
                return encode_jpeg(work, q)

            blob = binary_search_best_quality(enc_jpg, 35, 88, max_bytes)
            if blob is not None:
                out_path.write_bytes(blob)
                return True

    # Last resort: tiny JPEG so something always exists for <img> fallback
    if fmt == "jpeg":
        tiny = scale_by_factor(im_base, 0.12)
        work = flatten_rgba(tiny)
        blob = encode_jpeg(work, 35)
        out_path.write_bytes(blob)
        return True
    if fmt == "webp":
        tiny = scale_by_factor(im_base, 0.12)
        work = tiny if tiny.mode in ("RGB", "RGBA") else tiny.convert("RGB")
        out_path.write_bytes(encode_webp(work, 30))
        return True
    if fmt == "avif" and pillow_avif is not None:
        tiny = scale_by_factor(im_base, 0.12)
        work = tiny if tiny.mode in ("RGB", "RGBA") else tiny.convert("RGB")
        out_path.write_bytes(encode_avif(work, 28))
        return True
    return False


def save_tier_formats(im: Image.Image, out_base: Path) -> dict[str, Any] | None:
    """Write avif/webp/jpg for one sized bitmap. out_base has no extension."""
    w = im.width
    row: dict[str, Any] = {"w": w}
    if save_format_under_cap(im, out_base.with_suffix(".avif"), "avif", MAX_OUTPUT_BYTES):
        row["avif"] = str(out_base.with_suffix(".avif").relative_to(ROOT)).replace("\\", "/")
    if save_format_under_cap(im, out_base.with_suffix(".webp"), "webp", MAX_OUTPUT_BYTES):
        row["webp"] = str(out_base.with_suffix(".webp").relative_to(ROOT)).replace("\\", "/")
    if save_format_under_cap(im, out_base.with_suffix(".jpg"), "jpeg", MAX_OUTPUT_BYTES):
        row["jpg"] = str(out_base.with_suffix(".jpg").relative_to(ROOT)).replace("\\", "/")
    if len(row) <= 1:
        return None
    return row


def save_gallery_responsive(src: Path) -> None:
    """Multi-tier derivatives + variants.json entry for album / posters / projects."""
    im0 = load_image(src)
    rel = src.resolve().relative_to(ROOT)
    base_out = OPT / rel_without_ext(rel)
    ensure_parent(base_out.parent)
    key = str(base_out.relative_to(ROOT)).replace("\\", "/")

    tiers: list[dict[str, Any]] = []
    for i, (mw, mh) in enumerate(GALLERY_BOXES):
        canvas = resize_to_box(im0.copy(), mw, mh)
        tier_base = base_out.parent / f"{base_out.name}-t{i}"
        row = save_tier_formats(canvas, tier_base)
        if row:
            tiers.append(row)

    if tiers:
        VARIANTS_MANIFEST[key] = {"sizes": GALLERY_SIZES, "tiers": tiers}


def gather_album_sources() -> list[Path]:
    data = json.loads(PHOTO_JSON.read_text(encoding="utf-8"))
    out: list[Path] = []
    for item in data:
        src = (ROOT / item["src"]).resolve()
        if src.exists() and src.suffix in IMAGE_EXTS:
            out.append(src)
    return out


def gather_poster_sources() -> list[Path]:
    names = json.loads(POSTERS_JSON.read_text(encoding="utf-8"))
    out: list[Path] = []
    for name in names:
        src = (ROOT / "posterPortfolio" / name).resolve()
        if src.exists() and src.suffix in IMAGE_EXTS:
            out.append(src)
    return out


def gather_project_sources() -> list[Path]:
    projects = json.loads(PROJECTS_JSON.read_text(encoding="utf-8"))
    out: list[Path] = []
    for project in projects:
        for item in project.get("items", []):
            if item.get("type") != "image":
                continue
            src = (ROOT / item["src"]).resolve()
            if src.exists() and src.suffix in IMAGE_EXTS:
                out.append(src)
    return out


def slide_source_path(name: str) -> Path:
    return (ROOT / "slideshow" / name).resolve()


def slideshow_variant_tiers(im: Image.Image, stem: str, label: str, boxes: list[tuple[int, int]], sizes_attr: str) -> dict[str, Any]:
    tiers: list[dict[str, Any]] = []
    for i, (mw, mh) in enumerate(boxes):
        canvas = resize_to_box(im.copy(), mw, mh)
        out_base = OPT / "slideshow" / f"{stem}-{label}-t{i}"
        ensure_parent(out_base.parent)
        row = save_tier_formats(canvas, out_base)
        if row:
            tiers.append(row)
    return {"sizes": sizes_attr, "tiers": tiers}


def build_slideshow_outputs() -> None:
    files = json.loads(SLIDES_JSON.read_text(encoding="utf-8"))
    optimized_entries: list[dict[str, Any]] = []

    for name in files:
        src = slide_source_path(name)
        if not src.exists() or src.suffix not in IMAGE_EXTS:
            continue

        im = load_image(src).convert("RGB")
        stem = src.stem

        desktop = slideshow_variant_tiers(
            im, stem, "desktop", SLIDESHOW_DESKTOP_BOXES, SLIDESHOW_DESKTOP_SIZES
        )
        mobile = slideshow_variant_tiers(
            im, stem, "mobile", SLIDESHOW_MOBILE_BOXES, SLIDESHOW_MOBILE_SIZES
        )

        optimized_entries.append(
            {
                "name": name,
                "desktop": desktop,
                "mobile": mobile,
            }
        )

    SLIDES_OPTIMIZED_JSON.write_text(
        json.dumps(optimized_entries, indent=2) + "\n",
        encoding="utf-8",
    )


def run() -> None:
    if pillow_avif is None:
        print("Warning: pillow-avif-plugin not installed; AVIF outputs will be skipped.", file=sys.stderr)
        print("  python3 -m pip install -r tools/requirements-media.txt", file=sys.stderr)

    OPT.mkdir(exist_ok=True)
    VARIANTS_MANIFEST.clear()

    targets: list[Path] = []
    targets.extend(gather_album_sources())
    targets.extend(gather_poster_sources())
    targets.extend(gather_project_sources())

    seen: set[Path] = set()
    count = 0
    for src in targets:
        if src in seen:
            continue
        seen.add(src)
        save_gallery_responsive(src)
        count += 1

    build_slideshow_outputs()

    VARIANTS_JSON.write_text(
        json.dumps(VARIANTS_MANIFEST, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Optimized {count} source images (multi-tier) into {OPT.relative_to(ROOT)}/")
    print(f"Max size per file: {MAX_OUTPUT_KB} KiB (AVIF + WebP + JPEG)")
    print(f"Wrote {SLIDES_OPTIMIZED_JSON.relative_to(ROOT)}")
    print(f"Wrote {VARIANTS_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    run()
