#!/usr/bin/env bash
# scripts/screenshot-frame.sh
#
# Apply a brand-colored backdrop (and rounded corners) to raw store screenshots,
# producing framed assets ready for App Store Connect / Google Play upload.
#
# Inputs:  assets/store/screenshots/{ios,android}/{en,ar,de}/*.png
# Outputs: assets/store/screenshots-framed/{ios,android}/{en,ar,de}/*.png
#
# Requires: ImageMagick 7+ (`magick` binary). On macOS:  brew install imagemagick
#
# Brand backdrop color: #8B1E2D  (matches app.json adaptiveIcon backgroundColor)
#
# Usage:
#   bash scripts/screenshot-frame.sh                # frame everything
#   bash scripts/screenshot-frame.sh ios en         # frame just one platform/locale
#
# Notes:
#   This is intentionally a simple framer: backdrop + padding + rounded corners + a
#   subtle drop-shadow. For full device-frame mockups (iPhone bezel etc.) drop the
#   official Apple/Google device frame PNGs into `assets/store/device-frames/`
#   and extend the `frame_one` function below to compose them in.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_ROOT="$ROOT/assets/store/screenshots"
OUT_ROOT="$ROOT/assets/store/screenshots-framed"

BRAND_BG="#8B1E2D"
PADDING=80              # pixels of brand backdrop around the screenshot
RADIUS=48               # screenshot rounded-corner radius
SHADOW="50x10+0+8"      # ImageMagick -shadow argument (opacity x sigma + offsets)

if ! command -v magick >/dev/null 2>&1; then
  echo "ERROR: ImageMagick (\`magick\`) not found. Install via: brew install imagemagick" >&2
  exit 1
fi

frame_one() {
  local in="$1" out="$2"
  mkdir -p "$(dirname "$out")"

  # 1. Round the corners of the source screenshot.
  # 2. Add a soft drop shadow.
  # 3. Composite onto a brand-colored backdrop with PADDING on all sides.
  magick "$in" \
    \( +clone -alpha extract \
       -draw "fill black polygon 0,0 0,$RADIUS $RADIUS,0 fill white circle $RADIUS,$RADIUS $RADIUS,0" \
       \( +clone -flip \) -compose Multiply -composite \
       \( +clone -flop \) -compose Multiply -composite \
    \) -alpha off -compose CopyOpacity -composite \
    \( +clone -background black -shadow "$SHADOW" \) +swap -background none -layers merge +repage \
    -bordercolor "$BRAND_BG" -border "${PADDING}x${PADDING}" \
    -background "$BRAND_BG" -alpha remove -alpha off \
    "$out"
}

run_locale() {
  local platform="$1" locale="$2"
  local src_dir="$SRC_ROOT/$platform/$locale"
  local out_dir="$OUT_ROOT/$platform/$locale"
  shopt -s nullglob
  local files=("$src_dir"/*.png)
  shopt -u nullglob
  if [ ${#files[@]} -eq 0 ]; then
    echo "  (no screenshots in $src_dir — skipping)"
    return
  fi
  for f in "${files[@]}"; do
    local base
    base="$(basename "$f")"
    echo "  $platform/$locale/$base"
    frame_one "$f" "$out_dir/$base"
  done
}

PLATFORMS=("ios" "android")
LOCALES=("en" "ar" "de")

if [ $# -ge 1 ]; then PLATFORMS=("$1"); fi
if [ $# -ge 2 ]; then LOCALES=("$2"); fi

for p in "${PLATFORMS[@]}"; do
  for l in "${LOCALES[@]}"; do
    echo "Framing $p/$l"
    run_locale "$p" "$l"
  done
done

echo "Done. Framed assets are under $OUT_ROOT/"
