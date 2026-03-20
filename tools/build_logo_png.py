#!/usr/bin/env python3
"""Rebuild images/logo-jarrett-name.png from a flat logo asset.

Exports a **transparent** PNG with white glyphs for CSS masking (`mask-image` +
`background-color: var(--neon-pink)`).

Supports two common exports:
- **Light strokes on near-black** (old): keep pixels with luminance *above* a low threshold.
- **Dark / hairline strokes on gray** (new): keep pixels *below* a threshold (darker than the page).

With `--threshold auto`, the script picks the mode from the image's luminance range.

Requires: `pip install Pillow` (project venv: `tools/.venv`).
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = ROOT / "images" / "logo-jarrett-name-source.png"
OUT = ROOT / "images" / "logo-jarrett-name.png"


def _luminance(r: int, g: int, b: int) -> float:
    return (r + g + b) / 3.0


def _border_mean_lum(im: Image.Image) -> float:
    w, h = im.size
    px = im.load()
    samples = []
    for x in range(w):
        for y in (0, h - 1):
            r, g, b, _ = px[x, y]
            samples.append(_luminance(r, g, b))
    for y in range(1, h - 1):
        for x in (0, w - 1):
            r, g, b, _ = px[x, y]
            samples.append(_luminance(r, g, b))
    return sum(samples) / max(len(samples), 1)


def build(
    source: Path,
    *,
    threshold: float | None = None,
    mode: str = "auto",
) -> tuple[int, int]:
    im = Image.open(source).convert("RGBA")
    w, h = im.size
    px = im.load()

    lums: list[float] = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lums.append(_luminance(r, g, b))
    mx = max(lums)
    mn = min(lums)

    if mode == "auto":
        # Near-black field → light strokes; otherwise assume dark hairlines on mid-gray.
        if mx < 28:
            mode = "light_on_black"
        else:
            mode = "dark_on_gray"

    if threshold is None:
        if mode == "light_on_black":
            t = 4.5
        else:
            # Dark strokes: slightly above noise, below typical background
            border = _border_mean_lum(im)
            t = min(22.0, max(12.0, border - 14.0))
        threshold = t

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lum = _luminance(r, g, b)
            if mode == "light_on_black":
                keep = lum > threshold
            else:
                keep = lum < threshold
            if keep:
                px[x, y] = (255, 255, 255, 255)
            else:
                px[x, y] = (0, 0, 0, 0)

    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.save(OUT, "PNG")
    print(
        f"wrote {OUT} ({im.size[0]}×{im.size[1]})  mode={mode}  threshold={threshold}  "
        f"(lum range {mn:.1f}…{mx:.1f})",
    )
    return im.size


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE if DEFAULT_SOURCE.exists() else None,
        help="Flat PNG export. Default: images/logo-jarrett-name-source.png",
    )
    p.add_argument(
        "--mode",
        choices=("auto", "light_on_black", "dark_on_gray"),
        default="auto",
    )
    p.add_argument(
        "--threshold",
        type=float,
        default=None,
        help="Override luminance threshold (see script docstring). Default: auto.",
    )
    args = p.parse_args()
    if not args.source or not args.source.exists():
        raise SystemExit(
            "Pass --source path/to/logo.png or place art at images/logo-jarrett-name-source.png",
        )
    build(args.source, threshold=args.threshold, mode=args.mode)
