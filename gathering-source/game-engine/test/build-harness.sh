#!/bin/sh
# Builds a self-contained page that runs every reference game through runGameChecks.
# Usage: sh build-harness.sh <output-dir>; then serve <output-dir> and call window.runAll().
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=${1:-/tmp/nights-game-harness}
mkdir -p "$OUT"
"$HERE/../../node_modules/.bin/esbuild" "$HERE/harness-entry.mjs" --bundle --format=iife --outfile="$OUT/harness.js" --log-level=warning
printf '<!doctype html><html><body><h3>Nights game checks</h3><script src="harness.js"></script></body></html>' > "$OUT/index.html"
echo "$OUT/index.html"
