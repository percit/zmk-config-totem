#!/bin/sh
# Generuje układy wszystkich klawiatur. Keymapy czyta z gałęzi tego repo
# (jedna gałąź na klawiaturę), więc nie trzeba przełączać gałęzi.
set -e
cd "$(dirname "$0")/.."
REPO="$(git rev-parse --show-toplevel)"
TMP="$(mktemp -d)"
git -C "$REPO" fetch -q origin || true
for KB in redox totem; do
  git -C "$REPO" show "origin/$KB:config/$KB.keymap" > "$TMP/$KB.keymap"
  python3 tools/export_layout.py "$KB" "$TMP/$KB.keymap" "gałąź $KB @ $(git -C "$REPO" rev-parse --short "origin/$KB")"
done
python3 tools/export_layout.py corne keymaps/corne.keymap "trainer/keymaps/corne.keymap (szkic)"
rm -rf "$TMP"
