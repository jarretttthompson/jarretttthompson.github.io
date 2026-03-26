# Security notes (public GitHub repo)

## What “invisible on GitHub” can and cannot mean

- **Anything shipped to the browser** (HTML, JS, JSON loaded by the site) is visible to visitors via **View Source**, **Network**, or saved pages. You can still keep it **out of the git repo** (see below), but you **cannot** hide it from someone inspecting the live site.
- **True secrets** (API keys, private keys, passwords, OAuth client secrets) must **never** be committed. They belong in a **backend**, **GitHub Actions secrets** (for build/deploy only), or another vault—not in static files.

## This repo today

- A routine scan did **not** find typical API key / private key patterns in source files.
- The **Google Apps Script** URL used by the calendar “Add an event” form is a **public web endpoint**, similar to any public form `action` URL. It is **not** the same as a private API key, but it **can** receive spam—mitigate in the Apps Script (validation, quotas, abuse checks).

## Optional: keep `formAction` out of `index.html`

1. Copy `js/site.secrets.example.json` → **`js/site.secrets.json`** (this path is **gitignored**).
2. Put your real `formAction` URL in that file.
3. Remove or blank the `action="..."` on `#calendarSubmitForm` in `index.html` when you are ready (the app prefers `site.secrets.json` when present and falls back to the form’s `action` attribute).
4. For **GitHub Pages**, you still need **some** deploy path that places `js/site.secrets.json` on the server **without** committing it—typically **GitHub Actions** that writes the file from a **repository secret** during deploy, or a small build step. Doing that is optional and depends how you host.

## Files to never commit

- `.env`, `.env.local`, and similar
- Private keys (`*.pem`, `*.key`, `id_rsa`, etc.)
- Service account JSON, `credentials.json`
- Any file containing tokens/passwords

See also `.gitignore`.
