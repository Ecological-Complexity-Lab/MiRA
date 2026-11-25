#!/usr/bin/env bash
# Sync the MiRA web app into the ggmira R package's inst/MiRA/.
#
# Whitelist model: only the paths listed below are bundled. As you add
# new runtime files (e.g. another asset dir, a new top-level CSS file),
# add them here. Anything not listed stays in the dev tree only.
#
# Usage: npm run sync:ggmira  (or: bash scripts/sync-ggmira.sh)
#
# ggmira's inst/MiRA is only ever changed by this script: fix MiRA, then
# sync. The bundled commit is recorded in inst/MiRA/MIRA_COMMIT, and
# ggmira's CI fails if the bundle differs from a fresh sync of it.
# GGMIRA_DIR overrides where ggmira is (default: the sibling ../ggmira).

set -euo pipefail

cd "$(dirname "$0")/.."

GGMIRA_DIR="${GGMIRA_DIR:-../ggmira}"
DEST="$GGMIRA_DIR/inst/MiRA"

if [ ! -d "$GGMIRA_DIR" ]; then
  echo "Error: $GGMIRA_DIR not found. Run from a checkout that has ggmira as a sibling repo, or set GGMIRA_DIR." >&2
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

# --- Links to site pages that are not bundled ---
# The app and the manual link to pages of the website (About, tutorials,
# data format) with relative links, which work on the site. Those pages are
# not bundled, so in ggmira the links point to the website instead, in a new
# tab so the plot stays open. Links to bundled files stay relative.
SITE="https://mira.ecomplab.com"
for f in index.html docs/manual.html; do
  DEST="$DEST" SITE="$SITE" DIR="$(dirname "$f")" perl -pi -e '
    s{<a\b([^>]*?)\bhref="((?:\.\./)?)([A-Za-z0-9_-]+\.html)((?:#[^"]*)?)"([^>]*)>}{
      my ($pre, $up, $page, $hash, $post) = ($1, $2, $3, $4, $5);
      my $target = ($up || $ENV{DIR} eq ".") ? "$ENV{DEST}/$page" : "$ENV{DEST}/$ENV{DIR}/$page";
      if (-e $target) { $& }
      else {
        my $attrs = "$pre$post";
        my $extra = $attrs =~ /\btarget=/ ? "" : q{ target="_blank" rel="noopener"};
        qq{<a${pre}href="$ENV{SITE}/$page$hash"$post$extra>}
      }
    }ge' "$DEST/$f"
done

# --- Record which MiRA commit was bundled ---
# ggmira's CI re-syncs from this commit and fails if inst/MiRA differs, so
# the bundle is only ever changed here, never edited by hand in ggmira.
commit=$(git rev-parse HEAD)
if [ -n "$(git status --porcelain -- index.html README.md css js assets docs/manual.html scripts/sync-ggmira.sh)" ]; then
  echo "Warning: MiRA has uncommitted changes in bundled files; recording $commit-dirty." >&2
  echo "         Commit them in MiRA and sync again before committing the bundle in ggmira." >&2
  commit="$commit-dirty"
fi
echo "$commit" > "$DEST/MIRA_COMMIT"

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
