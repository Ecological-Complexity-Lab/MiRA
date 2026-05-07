#!/usr/bin/env bash
# Sync the MiRA web app into the EMLN R package's inst/MiRA/.
#
# Whitelist model: only the paths listed below are bundled. As you add
# new runtime files (e.g. another asset dir, a new top-level CSS file),
# add them here. Anything not listed stays in the dev tree only.
#
# Usage: npm run sync:emln  (or: bash scripts/sync-emln.sh)

set -euo pipefail

cd "$(dirname "$0")/.."

DEST="../emln/inst/MiRA"

if [ ! -d "../emln" ]; then
  echo "Error: ../emln not found. Run from a checkout that has emln as a sibling repo." >&2
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
cp -R assets         "$DEST/"

# --- Whitelist: selected docs files (only what's loaded at runtime) ---
cp docs/manual.html  "$DEST/docs/"

# Strip OS noise that can sneak in via cp -R
find "$DEST" -name '.DS_Store' -delete

n_files=$(find "$DEST" -type f | wc -l | tr -d ' ')
size=$(du -sh "$DEST" | cut -f1)
echo "Synced to $DEST  ($n_files files, $size)"
