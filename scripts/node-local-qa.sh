#!/usr/bin/env bash
# Local regression run on the Node runtime (ADR-0001, ACA-US-1.2 AC3).
# Builds the standalone Node server, migrates a throwaway SQLite database, starts the server on 127.0.0.1:8787
# with synthetic identity headers trusted unless QA_TRUST_HEADERS=0 (local only), runs the given test scripts and records each exit code.
# Never point this at a hosted Academy. Usage: scripts/node-local-qa.sh tests/api-integration.mjs tests/teams-api.mjs ...
set -u
cd "$(dirname "$0")/.."
RUN="${QA_RUN_DIR:-.sites-runtime/node-qa/$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$RUN" .sites-runtime
if [ "${QA_SKIP_BUILD:-0}" != "1" ]; then
  npm run build > "$RUN/build.log" 2>&1 || { echo "build failed: $RUN/build.log"; exit 1; }
fi
if curl -s -o /dev/null http://127.0.0.1:8787/; then echo "port 8787 is already in use; stop that server first"; exit 1; fi
export ACADEMY_DATABASE_PATH="$(mktemp -d)/academy.sqlite"
node --no-warnings scripts/migrate.mjs > "$RUN/migrate.json" || exit 1
( cd .next/standalone && ACADEMY_TRUST_IDENTITY_HEADERS=${QA_TRUST_HEADERS:-1} PORT=8787 HOSTNAME=127.0.0.1 exec node --no-warnings server.js ) > "$RUN/server.log" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
for i in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:8787/api/academy && break; sleep 0.5; done
echo "test,exit,seconds" > "$RUN/results.csv"
for t in "$@"; do
  name=$(echo "$t" | tr '/' '_')
  start=$(date +%s)
  timeout 900 node --no-warnings "$t" > "$RUN/$name.log" 2>&1; code=$?
  echo "$t,$code,$(( $(date +%s) - start ))" >> "$RUN/results.csv"
done
cat "$RUN/results.csv"
echo "run dir: $RUN"
