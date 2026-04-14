#!/usr/bin/env python3
"""One-off generator: wrap legacy pages in the shared terminal shell.

Do not re-run after migration — pages are already terminal-themed; re-running
will fail to find <div class="scroll-window glow-pulse"> in the old format.
Keep only for reference or restore pages from git before reusing.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SCRIPT_VER = "20260398"


def extract_scroll_inner(html: str) -> str | None:
    for marker in (
        '<div class="scroll-window glow-pulse">',
        '<div class="scroll-window">',
    ):
        i = html.find(marker)
        if i >= 0:
            i += len(marker)
            break
    else:
        return None
    depth = 1
    pos = i
    while depth and pos < len(html):
        next_open = html.find("<div", pos)
        next_close = html.find("</div>", pos)
        if next_close < 0:
            break
        if next_open >= 0 and next_open < next_close:
            depth += 1
            pos = next_open + 4
        else:
            depth -= 1
            if depth == 0:
                return html[i:next_close].strip()
            pos = next_close + 6
    return None


def shell(
    *,
    title: str,
    page: str,
    module: str,
    h1: str,
    inner: str,
    extra_head: str = "",
) -> str:
    inner_block = inner
    return f"""<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  <link rel="stylesheet" href="css/tailwind-built.css?v={SCRIPT_VER}" />
  <link rel="stylesheet" href="css/terminal-site.css?v={SCRIPT_VER}" />
  {extra_head}
</head>
<body class="terminal-site min-h-screen flex flex-col items-center justify-start py-6 md:py-10 px-4 md:px-8" data-page="{page}" data-terminal-site>
  <div class="crt-overlay" aria-hidden="true"></div>
  <main class="site-main-window lofi-static flex flex-col">
    <h1 class="sr-only">{h1}</h1>
    <header class="site-shell-header flex justify-end items-center w-full px-4 py-3 shrink-0">
      <div class="site-header-logo-wrap" id="lightbulb">
        <span class="site-header-logo" role="img" aria-label="Jarrett T. Thompson"></span>
      </div>
    </header>
    <nav class="nav-boxes" aria-label="Main navigation">
      <span class="nav-loading">Loading navigation…</span>
    </nav>
    <div class="site-shell-content p-4 md:p-6">
      <div class="scroll-window">
{inner_block}
      </div>
    </div>
    <footer class="site-shell-footer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 px-4 md:px-6 py-2 shrink-0">
      <div class="site-footer-left">Jarrett Thompson — Statesboro, GA</div>
      <div class="site-footer-right">thejrummer.github.io</div>
    </footer>
  </main>
  <script type="module" src="js/main.js?v={SCRIPT_VER}"></script>
</body>
</html>
"""


def shell_no_scroll_wrapper(
    *,
    title: str,
    page: str,
    module: str,
    h1: str,
    inner: str,
    extra_head: str = "",
) -> str:
    return f"""<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  <link rel="stylesheet" href="css/tailwind-built.css?v={SCRIPT_VER}" />
  <link rel="stylesheet" href="css/terminal-site.css?v={SCRIPT_VER}" />
  {extra_head}
</head>
<body class="terminal-site min-h-screen flex flex-col items-center justify-start py-6 md:py-10 px-4 md:px-8 photo-album-page" data-page="{page}" data-terminal-site>
  <div class="crt-overlay" aria-hidden="true"></div>
  <main class="site-main-window lofi-static flex flex-col">
    <h1 class="sr-only">{h1}</h1>
    <header class="site-shell-header flex justify-end items-center w-full px-4 py-3 shrink-0">
      <div class="site-header-logo-wrap" id="lightbulb">
        <span class="site-header-logo" role="img" aria-label="Jarrett T. Thompson"></span>
      </div>
    </header>
    <nav class="nav-boxes" aria-label="Main navigation">
      <span class="nav-loading">Loading navigation…</span>
    </nav>
    <div class="site-shell-content p-4 md:p-6">
{inner}
    </div>
    <footer class="site-shell-footer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 px-4 md:px-6 py-2 shrink-0">
      <div class="site-footer-left">Jarrett Thompson — Statesboro, GA</div>
      <div class="site-footer-right">thejrummer.github.io</div>
    </footer>
  </main>
  <script type="module" src="js/main.js?v={SCRIPT_VER}"></script>
</body>
</html>
"""


def main() -> None:
    # Standard scroll-window pages
    pages = [
        ("page2.html", "resume/cv", "page2", "resume/cv", "resume/cv"),
        ("music.html", "music", "music", "MUSIC", "music"),
        ("friends.html", "friends", "friends", "FRIENDS", "friends"),
        ("page3.html", "artwork", "page3", "ARTWORK", "artwork"),
        ("page4.html", "projects", "page4", "PROJECTS", "projects"),
        ("page5.html", "compositions", "page5", "COMPOSITIONS", "compositions"),
    ]
    for filename, title, page, module, h1 in pages:
        path = ROOT / filename
        raw = path.read_text(encoding="utf-8")
        inner = extract_scroll_inner(raw)
        if inner is None:
            raise SystemExit(f"Could not extract scroll-window from {filename}")
        path.write_text(
            shell(title=title, page=page, module=module, h1=h1, inner=inner),
            encoding="utf-8",
        )
        print("wrote", filename)

    # Photo album
    pa = ROOT / "photo-album.html"
    pa_raw = pa.read_text(encoding="utf-8")
    m = re.search(
        r'<main class="album-main">\s*(.*)\s*</main>',
        pa_raw,
        re.S,
    )
    if not m:
        raise SystemExit("photo album main extract failed")
    album_inner = f'    <main class="album-main">\n{m.group(1).strip()}\n    </main>'
    pa.write_text(
        shell_no_scroll_wrapper(
            title="photo album",
            page="photo-album",
            module="PHOTOS",
            h1="PHOTO ALBUM",
            inner=album_inner,
            extra_head='  <link rel="stylesheet" href="photo-album.css" />\n',
        ),
        encoding="utf-8",
    )
    print("wrote photo-album.html")

    # misc
    misc = ROOT / "misc.html"
    misc.write_text(
        shell(
            title="misc",
            page="misc",
            module="MISC",
            h1="MISC",
            inner="    <p class=\"center-text\">(empty)</p>",
        ),
        encoding="utf-8",
    )
    print("wrote misc.html")


if __name__ == "__main__":
    main()
