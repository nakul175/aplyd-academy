#!/usr/bin/env bash
# Package the built standalone server with its migrations into one tarball (ACA-US-1.5).
# Usage: pnpm run build:node && scripts/package-release.sh <out.tar.gz>
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$1"; STAGE="$(mktemp -d)"
# mktemp -d is mode 700 and tar stores that on the "./" entry: the release folder would then be unreadable by the
# academy user that runs the server and the migrations (deploy unpacks it, academy reads it).
chmod 755 "$STAGE"
cp -r .next/standalone/. "$STAGE/"
mkdir -p "$STAGE/scripts" "$STAGE/docs/decisions" "$STAGE/docs/privacy"
cp scripts/migrate.mjs scripts/seed-decisions.mjs scripts/loop-admin.mjs scripts/db-snapshot.mjs "$STAGE/scripts/" && cp -r drizzle "$STAGE/drizzle"
# The decision seed reads these two files (owner decisions taken on 13 October 2026 and the notice text they approve).
mkdir -p "$STAGE/docs/ai" && cp docs/ai/evaluation-set-draft.json "$STAGE/docs/ai/"
cp docs/decisions/owner-decisions-2026-10-13.json "$STAGE/docs/decisions/" && cp docs/privacy/notice-v1.0.md "$STAGE/docs/privacy/"
# Host scripts travel with the release so a host whose /srv/academy/bin is still deploy-writable can be updated.
mkdir -p "$STAGE/deploy-kit" && cp deploy/node/*.sh "$STAGE/deploy-kit/"
tar -czf "$OUT" -C "$STAGE" .
rm -rf "$STAGE"
echo "packaged $OUT ($(du -h "$OUT" | cut -f1))"
