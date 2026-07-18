#!/bin/sh
# Kopieert CHANGELOG.md (zonder de "# Changelog"-titel) naar het blok tussen de
# CHANGELOG-markers onderaan README.md. De community-plugins-pagina in Obsidian
# toont de README van de repo — release notes en CHANGELOG.md verschijnen daar
# nooit — dus zo blijft de volledige changelog op de pluginpagina zichtbaar.
# Draaien na elke wijziging aan CHANGELOG.md (zie RELEASING.md).
set -e
cd "$(dirname "$0")/.."
awk '
  FNR == NR { if (FNR > 1) chlog = chlog $0 "\n"; next }
  /<!-- CHANGELOG:BEGIN/ { print; printf "%s", chlog; skip = 1; next }
  /<!-- CHANGELOG:END/   { skip = 0 }
  !skip { print }
' CHANGELOG.md README.md > README.md.tmp
mv README.md.tmp README.md
echo "README.md bijgewerkt vanuit CHANGELOG.md"
