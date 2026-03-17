#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────
#  Safe merge: dev-preview → main
#  Strips all files listed in .dev-only and reverts
#  any dev-toolbar references in js/main.js.
# ─────────────────────────────────────────────────────────

ROOT="$(git rev-parse --show-toplevel)"
MANIFEST="$ROOT/.dev-only"
SOURCE_BRANCH="dev-preview"
TARGET_BRANCH="main"

echo ""
echo "══════════════════════════════════════════════"
echo "  Safe merge: $SOURCE_BRANCH → $TARGET_BRANCH"
echo "══════════════════════════════════════════════"
echo ""

# Ensure we're in a clean state
if [ -n "$(git status --porcelain)" ]; then
  echo "✗ Working tree is dirty. Commit or stash changes first."
  exit 1
fi

CURRENT=$(git rev-parse --abbrev-ref HEAD)

# Switch to main
git checkout "$TARGET_BRANCH"

# Merge dev-preview without committing
git merge "$SOURCE_BRANCH" --no-commit --no-ff || true

# Remove dev-only files from the merge
if [ -f "$MANIFEST" ]; then
  while IFS= read -r pattern; do
    pattern="${pattern%%#*}"
    pattern="$(echo "$pattern" | xargs)"
    [ -z "$pattern" ] && continue
    if [ -e "$ROOT/$pattern" ]; then
      git rm -f "$pattern" 2>/dev/null || rm -f "$ROOT/$pattern"
      echo "  ✓ Removed dev-only file: $pattern"
    fi
  done < "$MANIFEST"
fi

# Strip the dev-toolbar import from main.js
if [ -f "$ROOT/js/main.js" ]; then
  sed -i '' '/dev-toolbar/d' "$ROOT/js/main.js"
  git add js/main.js
  echo "  ✓ Stripped dev-toolbar import from js/main.js"
fi

echo ""
echo "Review the staged changes, then commit:"
echo "  git commit -m \"merge dev-preview (dev files stripped)\""
echo "  git push origin main"
echo ""
echo "To return to dev-preview:"
echo "  git checkout dev-preview"
echo ""
