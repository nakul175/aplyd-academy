#!/usr/bin/env bash
# Install one release on the Academy server and roll back automatically if it is unhealthy (ACA-US-1.5).
# Usage (as the deploy user): release.sh <release-tarball> <release-id>
#   1. unpack into $APP_ROOT/releases/<id>        4. point $APP_ROOT/current at the new release, restart
#   2. snapshot the database (sqlite .backup)     5. health check for up to 60 s
#   3. apply new migrations                       6. on failure: restore the snapshot, point back, restart
# Layout and service names can be overridden for local tests (see tests/node-runtime/release-rollback.test.mjs).
set -euo pipefail
TARBALL="$1"; ID="$2"
APP_ROOT="${APP_ROOT:-/srv/academy}"
DB="${ACADEMY_DATABASE_PATH:-/var/lib/academy/academy.sqlite}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
RESTART="${RESTART_CMD:-sudo systemctl restart academy}"
KEEP="${KEEP_RELEASES:-5}"
[[ "$ID" =~ ^[A-Za-z0-9._-]{1,64}$ ]] || { echo "invalid release id"; exit 2; }
log() { echo "[release $ID] $*"; }

new="$APP_ROOT/releases/$ID"; previous="$(readlink -f "$APP_ROOT/current" 2>/dev/null || true)"
mkdir -p "$APP_ROOT/releases" "$APP_ROOT/snapshots"
rm -rf "$new.tmp"; mkdir -p "$new.tmp"; tar -xzf "$TARBALL" -C "$new.tmp"; rm -rf "$new"; mv "$new.tmp" "$new"
log "unpacked"

snapshot="$APP_ROOT/snapshots/before-$ID.sqlite"
if [ -f "$DB" ]; then
  node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(process.argv[1]);d.exec(\"VACUUM INTO '\"+process.argv[2].replace(/'/g,\"''\")+\"'\");d.close()" "$DB" "$snapshot"
  log "database snapshot $snapshot"
fi

rollback() {
  log "ROLLBACK: $1"
  if [ -f "$snapshot" ]; then cp "$snapshot" "$DB.restore" && rm -f "$DB-wal" "$DB-shm" && mv "$DB.restore" "$DB"; log "database restored from snapshot"; fi
  if [ -n "$previous" ]; then ln -sfn "$previous" "$APP_ROOT/current.next" && mv -T "$APP_ROOT/current.next" "$APP_ROOT/current"; fi
  $RESTART || true
  local prev_id; prev_id="$(basename "${previous:-none}")"
  for i in $(seq 1 30); do
    if curl -fsS --max-time 2 "$HEALTH_URL" 2>/dev/null | grep -q "\"release\":\"$prev_id\""; then log "rolled back; $prev_id is healthy"; exit 1; fi
    sleep 2
  done
  log "ROLLED BACK BUT $prev_id IS NOT HEALTHY: the site is down, act now"
  exit 3
}

ACADEMY_DATABASE_PATH="$DB" node --no-warnings "$new/scripts/migrate.mjs" || rollback "migration failed"
ln -sfn "$new" "$APP_ROOT/current.next" && mv -T "$APP_ROOT/current.next" "$APP_ROOT/current"
$RESTART || rollback "restart failed"

for i in $(seq 1 30); do
  if curl -fsS --max-time 2 "$HEALTH_URL" 2>/dev/null | grep -q "\"release\":\"$ID\""; then
    log "healthy"
    ls -1dt "$APP_ROOT"/releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf
    ls -1t "$APP_ROOT"/snapshots/*.sqlite 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
    exit 0
  fi
  sleep 2
done
rollback "health check did not pass within 60 s"
