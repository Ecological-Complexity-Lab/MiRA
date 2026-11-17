#!/usr/bin/env bash
# Sync the MiRA web app into the ggmira R package's inst/MiRA/.
#
# Whitelist model: only the paths listed below are bundled. As you add
# new runtime files (e.g. another asset dir, a new top-level CSS file),
# add them here. Anything not listed stays in the dev tree only.
#
# Usage: npm run sync:ggmira  (or: bash scripts/sync-ggmira.sh)

set -euo pipefail

cd "$(dirname "$0")/.."

DEST="../ggmira/inst/MiRA"

if [ ! -d "../ggmira" ]; then
  echo "Error: ../ggmira not found. Run from a checkout that has ggmira as a sibling repo." >&2
  exit 1
fi

# Wipe destination so files removed from MiRA don't linger in the bundle.
rm -rf "$DEST"
mkdir -p "$DEST/docs"

# --- Whitelist: top-level files ---
cp index.html        "$DEST/"
cp README.md         "$DEST/"

# --- Whitelist: asset directories (copied recursively) ---
cp -R css            "$DEST/"
cp -R js             "$DEST/"

# --- Whitelist: images the app and the manual use ---
# Not the whole assets/ folder: the About page's images (screenshots, the
# multilayer figure) are not used by the app and would only make ggmira
# larger. Add an image here when the app or the manual starts using it;
# the check below fails if one is missing.
mkdir -p "$DEST/assets"
for f in MiRA_logo.svg ecomplab_logo.png favicon.svg ggmira-logo.png \
         mira-at-a-glance.png social-card.png; do
  cp "assets/$f" "$DEST/assets/"
done

# --- Whitelist: selected docs files (only what's loaded at runtime) ---
cp docs/manual.html  "$DEST/docs/"

# Strip OS noise that can sneak in via cp -R
find "$DEST" -name '.DS_Store' -delete

# Every image the bundled files refer to must have been copied
missing=0
for ref in $(grep -ohE 'assets/[A-Za-z0-9._-]+' "$DEST/index.html" "$DEST"/js/*.js "$DEST"/css/*.css "$DEST/docs/manual.html" | sort -u); do
  if [ ! -f "$DEST/$ref" ]; then
    echo "Error: $ref is used by the app or the manual but not bundled; add it to the image list in $0" >&2
    missing=1
  fi
done
[ "$missing" -eq 0 ] || exit 1

n_files=$(find "$DEST" -type f | wc -l | tr -d ' ')
size=$(du -sh "$DEST" | cut -f1)
echo "Synced to $DEST  ($n_files files, $size)"
