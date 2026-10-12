#!/usr/bin/env bash
# Monthly restore drill (ACA-US-1.3): restore the latest backup from Spaces into a scratch file, check it opens,
# check its integrity and compare row counts with the live database. Never touches the live file.
# Run on the server as root: /srv/academy/bin/restore-drill.sh  (needs /etc/academy/litestream.env)
set -euo pipefail
set -a; . /etc/academy/litestream.env; set +a
LIVE=/var/lib/academy/academy.sqlite; OUT="$(mktemp -d)/restored.sqlite"
start=$(date +%s)
litestream restore -config /etc/litestream.yml -o "$OUT" "$LIVE"
[ "$(sqlite3 "$OUT" 'PRAGMA integrity_check;')" = "ok" ] || { echo "DRILL FAILED: integrity"; exit 1; }
for t in academy_workspaces academy_teams academy_users academy_audit; do
  live=$(sqlite3 "file:$LIVE?mode=ro" "SELECT count(*) FROM $t;"); restored=$(sqlite3 "$OUT" "SELECT count(*) FROM $t;")
  echo "$t live=$live restored=$restored"
done
echo "DRILL OK in $(( $(date +%s) - start ))s; restored copy: $OUT (delete after review)"
