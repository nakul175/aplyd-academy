#!/usr/bin/env bash
# ACA-US-1.3 local check: Litestream replicates the Academy database continuously and a restore brings back
# every row. Uses a local file replica in place of DigitalOcean Spaces. Usage: backup-restore.sh <litestream-binary>
set -uo pipefail
LS="$1"; REPO="$(cd "$(dirname "$0")/../.." && pwd)"; W="$(mktemp -d)"
export ACADEMY_DATABASE_PATH="$W/academy.sqlite"
node --no-warnings "$REPO/scripts/migrate.mjs" > /dev/null
printf 'dbs:\n  - path: %s\n    replicas:\n      - type: file\n        path: %s\n        sync-interval: 1s\n' "$W/academy.sqlite" "$W/replica" > "$W/ls.yml"
"$LS" replicate -config "$W/ls.yml" > "$W/ls.log" 2>&1 & LP=$!
sleep 2
node --no-warnings -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(process.argv[1]);for(let i=0;i<500;i++)d.prepare('INSERT INTO academy_users(id,email_hash,email,created_at) VALUES(?,?,?,?)').run('u'+i,'h'+i,i+'@example.test','2026-10-12')" "$W/academy.sqlite"
sleep 4; kill $LP; wait $LP 2>/dev/null
rm -f "$W"/academy.sqlite*                         # the droplet is lost
start=$(date +%s)
"$LS" restore -config "$W/ls.yml" -o "$W/restored.sqlite" "$W/academy.sqlite" || { echo '{"passed":false,"step":"restore"}'; exit 1; }
node --no-warnings -e "
const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(process.argv[1]);
const r={integrity:d.prepare('PRAGMA integrity_check').get().integrity_check,users:d.prepare('SELECT count(*) n FROM academy_users').get().n,migrations:d.prepare('SELECT count(*) n FROM academy_migrations').get().n,restoreSeconds:+process.argv[2]};
r.passed=r.integrity==='ok'&&r.users===500&&r.migrations>=9;console.log(JSON.stringify(r));process.exit(r.passed?0:1)" "$W/restored.sqlite" "$(( $(date +%s) - start ))"
