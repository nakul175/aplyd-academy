#!/usr/bin/env bash
# Package the built standalone server with its migrations into one tarball (ACA-US-1.5).
# Usage: pnpm run build && scripts/package-release.sh <out.tar.gz>
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$1"; STAGE="$(mktemp -d)"
cp -r .next/standalone/. "$STAGE/"
mkdir -p "$STAGE/scripts" && cp scripts/migrate.mjs "$STAGE/scripts/" && cp -r drizzle "$STAGE/drizzle"
tar -czf "$OUT" -C "$STAGE" .
rm -rf "$STAGE"
echo "packaged $OUT ($(du -h "$OUT" | cut -f1))"
