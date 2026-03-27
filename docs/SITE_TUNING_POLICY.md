# Site Tuning tool — repository policy

## Rule

The **Site Tuner** (interactive dev UI and related modules) **must not be merged or pushed to the default `main` branch** in a state that **ships the tuner to production** (e.g. GitHub Pages for this site).

In practice:

1. **`js/main.js`** — The dynamic import of `site-tune.js` (and any equivalent loader for `element-tune.js` / `image-tune.js`) must **not** run for **public production** builds on `main`. Acceptable patterns:
   - Gate the import behind **`localhost` / `127.0.0.1`** (and optional LAN dev hosts), **or**
   - Remove the import on `main` and keep tuning only on a **non-production branch** (e.g. `dev/tuning`), **or**
   - Build a **separate local entry** (e.g. `main.tune.js`) that is never linked from production HTML.

2. **`css/site-tune-overrides.css`** — May stay in the repo as a **small, intentional** shared override file. **Do not** commit large blobs of **machine-local** slider output meant only for your machine; prefer merging distilled values into `terminal-site.css` or a named tune file when the look should ship.

3. **PR checklist** — Before merging to `main`: confirm the live site does not load the full Site Tuner panel for visitors.

## Rationale

The tuner is a **development convenience** (layout/CSS experimentation). Shipping it to everyone increases bundle size, attack surface, and confusion for readers.

## Implementation (this repo)

- **`js/main.js`** loads `site-tune.js` only when **`location.hostname`** is `localhost`, `127.0.0.1`, `[::1]`, or ends with **`.local`**. Production hostnames (e.g. GitHub Pages) do not load the tuner.
- **`sw.js`** does not precache `site-tune.js` (optional offline cache only for modules that ship).

## Related files

| Piece | Role |
|-------|------|
| `js/modules/site-tune.js` | Unified tuning UI |
| `js/modules/element-tune.js` | Element layout editor (legacy / split) |
| `js/modules/image-tune.js` | Image-focused tuning (legacy) |
| `css/site-tune-overrides.css` | Optional overrides written by the tool |
| `run_site.py` | References overrides path for local workflows |

See also: **DESIGN_LANGUAGE.md** (Tech conventions) and **`.cursor/rules/site-tuning-policy.mdc`**.
