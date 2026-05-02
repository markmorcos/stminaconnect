#!/usr/bin/env bash
# scripts/screenshot-frame.sh
#
# Composite raw store screenshots onto a brand-colored backdrop, producing
# framed assets ready for App Store Connect / Google Play upload.
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
#   bash scripts/screenshot-frame.sh android        # one platform
#   bash scripts/screenshot-frame.sh android en     # one platform/locale
#
# Optional flags (env vars):
#   ROUNDED=1   add rounded corners on the screenshot (default off)
#   SHADOW=1    add a soft drop shadow under the screenshot (default off)
#
# Implementation notes:
#   The default path is a simple two-step composite — solid brand canvas,
#   then the screenshot centered with PADDING on every side. No alpha
#   tricks. This is intentionally boring because the more elaborate
#   "rounded + shadow in one magick call" recipe people copy off the
#   internet relies on `-alpha off -compose CopyOpacity -composite`,
#   which on IM 7 can produce a fully-transparent result that flattens
#   to a solid panel of the backdrop colour.
#
#   The optional ROUNDED / SHADOW knobs do their work in separate
#   passes so each one can be tested in isolation.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_ROOT="$ROOT/assets/store/screenshots"
OUT_ROOT="$ROOT/assets/store/screenshots-framed"

BRAND_BG="#8B1E2D"
PADDING=80              # pixels of brand backdrop around the screenshot
RADIUS=48               # rounded-corner radius (only used when ROUNDED=1)
SHADOW_PARAMS="50x14+0+12"  # ImageMagick -shadow arg (opacity x sigma + offsets)

ROUNDED="${ROUNDED:-0}"
SHADOW="${SHADOW:-0}"

if ! command -v magick >/dev/null 2>&1; then
  echo "ERROR: ImageMagick (\`magick\`) not found. Install via: brew install imagemagick" >&2
  exit 1
fi

# Round the corners of the input PNG, writing to a temp file. Returns
# the temp path on stdout. Caller is responsible for `rm`-ing it.
#
# Uses pre-computed dimensions because IM 7's `-draw` directive does not
# evaluate FX expressions like `%[fx:w-1]` inline — passing `%[fx:...]`
# silently produces a no-op draw and the corners stay square. With the
# numeric coordinates baked in, the mask is correct.
round_corners() {
  local in="$1"
  local tmp
  tmp="$(mktemp -t scrshot.XXXXXX).png"

  local W H
  read -r W H < <(magick identify -format "%w %h\n" "$in")

  magick "$in" \
    \( -size "${W}x${H}" canvas:black -fill white \
       -draw "roundrectangle 0,0 $((W - 1)),$((H - 1)) $RADIUS,$RADIUS" \
    \) \
    -alpha off -compose CopyOpacity -composite \
    PNG32:"$tmp"
  echo "$tmp"
}

# Add a soft drop shadow underneath the input PNG. Returns a temp path.
add_shadow() {
  local in="$1"
  local tmp
  tmp="$(mktemp -t scrshot.XXXXXX).png"
  magick "$in" \
    \( +clone -background black -shadow "$SHADOW_PARAMS" \) \
    +swap -background none -layers merge +repage \
    PNG32:"$tmp"
  echo "$tmp"
}

frame_one() {
  local in="$1" out="$2"
  mkdir -p "$(dirname "$out")"

  local working="$in"
  local cleanup=()

  if [ "$ROUNDED" = "1" ]; then
    working="$(round_corners "$working")"
    cleanup+=("$working")
  fi
  if [ "$SHADOW" = "1" ]; then
    local next
    next="$(add_shadow "$working")"
    cleanup+=("$next")
    working="$next"
  fi

  # Pad the (possibly-rounded, possibly-shadowed) screenshot to its
  # final size on a brand-color backdrop. `-extent` with `-background`
  # expands the canvas; `-alpha remove -alpha off` resolves any
  # remaining transparency (rounded corners, the area around a drop
  # shadow) to the brand color so the rounded shape and shadow blend
  # seamlessly into the backdrop, instead of revealing white through
  # the transparent corners when the PNG is viewed on a white page.
  local W H
  read -r W H < <(magick identify -format "%w %h\n" "$working")
  local outW=$((W + 2 * PADDING))
  local outH=$((H + 2 * PADDING))

  magick "$working" \
    -background "$BRAND_BG" \
    -gravity center \
    -extent "${outW}x${outH}" \
    -alpha remove -alpha off \
    "$out"

  for f in "${cleanup[@]}"; do
    rm -f "$f"
  done
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

echo
echo "Done. Framed assets are under $OUT_ROOT/"
[ "$ROUNDED" = "1" ] || echo "(re-run with ROUNDED=1 for rounded corners on the screenshot)"
[ "$SHADOW" = "1" ]  || echo "(re-run with SHADOW=1 for a soft drop shadow under the screenshot)"
