#!/usr/bin/env bash
# ACA-US-1.5 local check of deploy/release.sh: a good release goes live; a release that crashes and a release
# whose migration fails are both rolled back, with the previous release serving and the data intact.
# Needs a fresh `npm run build`. Uses a temp folder and port 3999; touches nothing else.
set -uo pipefail
cd "$(dirname "$0")/../.."
REPO="$PWD"; WORK="$(mktemp -d)"; export APP_ROOT="$WORK/app" ACADEMY_DATABASE_PATH="$WORK/data/academy.sqlite"
export HEALTH_URL="http://127.0.0.1:3999/api/health" KEEP_RELEASES=3
mkdir -p "$WORK/data"
cat > "$WORK/restart.sh" <<EOF
#!/usr/bin/env bash
[ -f "$WORK/pid" ] && kill \$(cat "$WORK/pid") 2>/dev/null; sleep 0.5
( APP_ROOT="$APP_ROOT" ACADEMY_DATABASE_PATH="$ACADEMY_DATABASE_PATH" PORT=3999 HOSTNAME=127.0.0.1 nohup bash "$REPO/deploy/run.sh" > "$WORK/server.log" 2>&1 & echo \$! > "$WORK/pid" )
EOF
chmod +x "$WORK/restart.sh"; export RESTART_CMD="$WORK/restart.sh"
pass=0; fail=0; check() { if eval "$2"; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL: $1"; fi; }
health() { curl -fsS --max-time 2 "$HEALTH_URL" 2>/dev/null; }

scripts/package-release.sh "$WORK/good.tar.gz" > /dev/null
deploy/release.sh "$WORK/good.tar.gz" r1 > "$WORK/r1.log" 2>&1; check "r1 goes live" '[ $? -eq 0 ] || grep -q healthy "$WORK/r1.log"'
check "r1 serves" 'health | grep -q "\"release\":\"r1\""'
node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync(process.argv[1]).prepare(\"INSERT INTO academy_users(id,email_hash,email,created_at) VALUES('u-keep','h','keep@example.test','2026-10-12')\").run()" "$ACADEMY_DATABASE_PATH"

# r2: the server crashes on start.
mkdir -p "$WORK/bad" && tar -xzf "$WORK/good.tar.gz" -C "$WORK/bad" && echo 'process.exit(1)' > "$WORK/bad/server.js" && tar -czf "$WORK/crash.tar.gz" -C "$WORK/bad" .
deploy/release.sh "$WORK/crash.tar.gz" r2 > "$WORK/r2.log" 2>&1; code=$?
check "r2 reports failure" '[ $code -ne 0 ]'
check "r2 rolled back" 'grep -q "ROLLBACK" "$WORK/r2.log"'
check "r1 serves again" 'health | grep -q "\"release\":\"r1\""'
check "current points at r1" '[ "$(basename "$(readlink -f "$APP_ROOT/current")")" = r1 ]'

# r3: a migration that fails after changing data; the snapshot must undo it.
rm -rf "$WORK/bad" && mkdir -p "$WORK/bad" && tar -xzf "$WORK/good.tar.gz" -C "$WORK/bad"
echo "DELETE FROM academy_users;" > "$WORK/bad/drizzle/9998_delete.sql"   # commits on its own
echo "THIS IS NOT SQL;" > "$WORK/bad/drizzle/9999_broken.sql"           # then fails: only the snapshot can undo 9998
tar -czf "$WORK/badmig.tar.gz" -C "$WORK/bad" .
deploy/release.sh "$WORK/badmig.tar.gz" r3 > "$WORK/r3.log" 2>&1; code=$?
check "r3 reports failure" '[ $code -ne 0 ]'
check "r3 rolled back on migration" 'grep -q "migration failed" "$WORK/r3.log"'
check "data intact after r3" 'node -e "const {DatabaseSync}=require(\"node:sqlite\");process.exit(new DatabaseSync(process.argv[1]).prepare(\"SELECT count(*) n FROM academy_users WHERE id=\x27u-keep\x27\").get().n===1?0:1)" "$ACADEMY_DATABASE_PATH"'
check "r1 still serves" 'health | grep -q "\"release\":\"r1\""'

[ -f "$WORK/pid" ] && kill "$(cat "$WORK/pid")" 2>/dev/null
echo "{\"checks\":$((pass+fail)),\"passed\":$pass,\"failed\":$fail,\"work\":\"$WORK\"}"
[ "$fail" -eq 0 ]
