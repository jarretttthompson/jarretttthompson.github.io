# Local Build Tools

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install pillow pillow-avif-plugin fonttools brotli
```

## Generate optimized media

```bash
.venv/bin/python tools/optimize_media.py
```

This generates:
- `optimized/**` AVIF/WEBP/JPEG derivatives
- `slides.optimized.json` for responsive slideshow loading

## Generate WOFF2 fonts

```bash
.venv/bin/python tools/build_fonts.py
```

This generates:
- `fonts/VulfMono-Regular.woff2`
- `fonts/VulfSans-Regular.woff2`
