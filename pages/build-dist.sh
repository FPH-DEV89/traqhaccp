#!/usr/bin/env bash
# Construit dist-pages/ = ce qui part réellement sur Cloudflare Pages.
# Exclut docs/ (7 Mo de captures), graphify-out/ (artefact local),
# specs/, .agents/, .hermes/, .github/ : rien de tout ça n'est servi par l'app.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=dist-pages
rm -rf "$OUT"
mkdir -p "$OUT"

cp -r index.html manifest.json sw.js \
      assets css js src "$OUT"/

# Règles de production (équivalent vercel.json)
cp pages/_headers pages/_redirects "$OUT"/
printf '/* /index.html 200\n' > /dev/null  # SPA : laissé à _redirects, pas de catch-all ici

echo "--- poids livré ---"
du -sh "$OUT"
echo "--- fichiers ---"
find "$OUT" -type f | wc -l
