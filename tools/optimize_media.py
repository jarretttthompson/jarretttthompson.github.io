#!/usr/bin/env python3
"""Generate optimized image derivatives for the portfolio site.

Outputs:
- optimized/<original-path-without-ext>.avif
- optimized/<original-path-without-ext>.webp
- optimized/<original-path-without-ext>.jpg fallback
- optimized/slideshow/{name}-desktop.webp|jpg
- optimized/slideshow/{name}-mobile.webp|jpg
- slides.optimized.json manifest used by JS
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageOps
import pillow_avif  # noqa: F401  # registers AVIF encoder


ROOT = Path(__file__).resolve().parents[1]
OPT = ROOT / "optimized"

PHOTO_JSON = ROOT / "photo-album.json"
POSTERS_JSON = ROOT / "posters.json"
PROJECTS_JSON = ROOT / "projects" / "projects.json"
SLIDES_JSON = ROOT / "slides.json"
SLIDES_OPTIMIZED_JSON = ROOT / "slides.optimized.json"


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".JPG", ".JPEG", ".PNG", ".WEBP"}


@dataclass
class ImageTarget:
    source: Path
    max_width: int
    max_height: int
    quality: int


def rel_without_ext(path: Path) -> Path:
    return path.with_suffix("")


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def load_image(path: Path) -> Image.Image:
    with Image.open(path) as im:
        fixed = ImageOps.exif_transpose(im)
        if fixed.mode not in ("RGB", "RGBA"):
            fixed = fixed.convert("RGB")
        return fixed.copy()


def fit_size(width: int, height: int, max_width: int, max_height: int) -> tuple[int, int]:
    ratio = min(max_width / width, max_height / height, 1.0)
    return max(1, int(width * ratio)), max(1, int(height * ratio))


def save_variants(src: Path, max_width: int, max_height: int, quality: int) -> dict[str, str]:
    im = load_image(src)
    out_w, out_h = fit_size(im.width, im.height, max_width, max_height)
    if (out_w, out_h) != (im.width, im.height):
        im = im.resize((out_w, out_h), Image.Resampling.LANCZOS)

    rel = src.relative_to(ROOT)
    base_out = OPT / rel_without_ext(rel)
    ensure_parent(base_out)

    avif = base_out.with_suffix(".avif")
    webp = base_out.with_suffix(".webp")
    jpg = base_out.with_suffix(".jpg")

    avif_kwargs = {"quality": max(30, min(quality, 80))}
    webp_kwargs = {"quality": quality, "method": 6}
    jpg_kwargs = {"quality": min(quality, 88), "optimize": True, "progressive": True}

    if im.mode == "RGBA":
        # Keep alpha for AVIF/WEBP; flatten for JPG fallback.
        im.save(avif, "AVIF", **avif_kwargs)
        im.save(webp, "WEBP", **webp_kwargs)
        flat = Image.new("RGB", im.size, (0, 0, 0))
        flat.paste(im, mask=im.split()[-1])
        flat.save(jpg, "JPEG", **jpg_kwargs)
    else:
        rgb = im.convert("RGB")
        rgb.save(avif, "AVIF", **avif_kwargs)
        rgb.save(webp, "WEBP", **webp_kwargs)
        rgb.save(jpg, "JPEG", **jpg_kwargs)

    return {
        "avif": str(avif.relative_to(ROOT)),
        "webp": str(webp.relative_to(ROOT)),
        "fallback": str(jpg.relative_to(ROOT)),
    }


def gather_album_images() -> Iterable[ImageTarget]:
    data = json.loads(PHOTO_JSON.read_text(encoding="utf-8"))
    for item in data:
        src = ROOT / item["src"]
        if src.exists() and src.suffix in IMAGE_EXTS:
            yield ImageTarget(src, max_width=1600, max_height=1600, quality=72)


def gather_poster_images() -> Iterable[ImageTarget]:
    names = json.loads(POSTERS_JSON.read_text(encoding="utf-8"))
    for name in names:
        src = ROOT / "posterPortfolio" / name
        if src.exists() and src.suffix in IMAGE_EXTS:
            yield ImageTarget(src, max_width=1800, max_height=1800, quality=74)


def gather_project_images() -> Iterable[ImageTarget]:
    projects = json.loads(PROJECTS_JSON.read_text(encoding="utf-8"))
    for project in projects:
        for item in project.get("items", []):
            if item.get("type") != "image":
                continue
            src = ROOT / item["src"]
            if src.exists() and src.suffix in IMAGE_EXTS:
                yield ImageTarget(src, max_width=1800, max_height=1800, quality=74)


def build_slideshow_outputs() -> None:
    files = json.loads(SLIDES_JSON.read_text(encoding="utf-8"))
    optimized_entries = []

    for name in files:
        src = ROOT / "slideshow" / name
        if not src.exists() or src.suffix not in IMAGE_EXTS:
            continue

        im = load_image(src).convert("RGB")
        stem = src.stem
        desktop = im.resize(
            fit_size(im.width, im.height, 1600, 1200),
            Image.Resampling.LANCZOS,
        )
        mobile = im.resize(
            fit_size(im.width, im.height, 900, 1400),
            Image.Resampling.LANCZOS,
        )

        desk_base = OPT / "slideshow" / f"{stem}-desktop"
        mob_base = OPT / "slideshow" / f"{stem}-mobile"
        ensure_parent(desk_base)

        desk_webp = desk_base.with_suffix(".webp")
        desk_jpg = desk_base.with_suffix(".jpg")
        mob_webp = mob_base.with_suffix(".webp")
        mob_jpg = mob_base.with_suffix(".jpg")

        desktop.save(desk_webp, "WEBP", quality=74, method=6)
        desktop.save(desk_jpg, "JPEG", quality=80, optimize=True, progressive=True)
        mobile.save(mob_webp, "WEBP", quality=70, method=6)
        mobile.save(mob_jpg, "JPEG", quality=76, optimize=True, progressive=True)

        optimized_entries.append(
            {
                "name": name,
                "desktop": {
                    "webp": str(desk_webp.relative_to(ROOT)),
                    "fallback": str(desk_jpg.relative_to(ROOT)),
                },
                "mobile": {
                    "webp": str(mob_webp.relative_to(ROOT)),
                    "fallback": str(mob_jpg.relative_to(ROOT)),
                },
            }
        )

    SLIDES_OPTIMIZED_JSON.write_text(
        json.dumps(optimized_entries, indent=2) + "\n",
        encoding="utf-8",
    )


def run() -> None:
    OPT.mkdir(exist_ok=True)
    targets: list[ImageTarget] = []
    targets.extend(gather_album_images())
    targets.extend(gather_poster_images())
    targets.extend(gather_project_images())

    seen: set[Path] = set()
    for target in targets:
        if target.source in seen:
            continue
        seen.add(target.source)
        save_variants(target.source, target.max_width, target.max_height, target.quality)

    build_slideshow_outputs()

    print(f"Optimized {len(seen)} images into {OPT.relative_to(ROOT)}")
    print(f"Generated {SLIDES_OPTIMIZED_JSON.name}")


if __name__ == "__main__":
    run()
