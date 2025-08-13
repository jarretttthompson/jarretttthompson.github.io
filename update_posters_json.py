#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).parent
POSTERS_DIR = ROOT / 'posterPortfolio'
OUTPUT = ROOT / 'posters.json'

EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.avif', '.JPG', '.JPEG', '.PNG', '.WEBP', '.AVIF'}

def main():
    if not POSTERS_DIR.exists():
        raise SystemExit(f"Folder not found: {POSTERS_DIR}")

    files = [p.name for p in sorted(POSTERS_DIR.iterdir()) if p.suffix in EXTS and p.is_file()]

    # Optional: stable sort placing common poster prefixes together; currently simple name sort
    OUTPUT.write_text(json.dumps(files, indent=2))
    print(f"Wrote {len(files)} entries to {OUTPUT}")

if __name__ == '__main__':
    main()
