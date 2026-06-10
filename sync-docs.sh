#!/usr/bin/env bash
# Copy modern-gold build into docs/ for GitHub Pages.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/versions/modern-gold"
DEST="$ROOT/docs"
rm -rf "$DEST"
mkdir -p "$DEST"
rsync -a --delete "$SRC/" "$DEST/"
echo "Synced $SRC -> $DEST"
