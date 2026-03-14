#!/usr/bin/env python3
"""Generate WOFF2 versions of local OTF fonts."""

from pathlib import Path
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FONTS = [
    ROOT / "fonts" / "VulfMono-Regular.otf",
    ROOT / "fonts" / "VulfSans-Regular.otf",
]


def build_woff2(source: Path) -> Path:
    target = source.with_suffix(".woff2")
    font = TTFont(str(source))
    font.flavor = "woff2"
    font.save(str(target))
    return target


def main() -> None:
    for font_path in FONTS:
        if not font_path.exists():
            print(f"Missing font: {font_path}")
            continue
        out = build_woff2(font_path)
        print(f"Built {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
