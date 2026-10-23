#!/usr/bin/env bash
# Build situs untuk Netlify: build portal (Vite) lalu susun folder _site
# (situs utama di root, hasil build portal di /portal/) — sama dengan
# alur .github/workflows/deploy.yml.
set -euo pipefail

(cd portal && npm ci && npm run build)

rm -rf _site
mkdir -p _site/portal
cp index.html robots.txt sitemap.xml _site/
cp -r assets _site/
cp -r portal/dist/. _site/portal/
