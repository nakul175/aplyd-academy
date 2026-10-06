#!/usr/bin/env bash
# One command local demo: build, fresh DEMO database, local worker, seed fictional data, role-switcher proxy.
# Loopback only. Never touches the hosted Site or the default .wrangler/state.
set -euo pipefail
cd "$(dirname "$0")/../.."
PORT=${DEMO_WORKER_PORT:-8791}; PROXY=${DEMO_PROXY_PORT:-8788}; STATE=${DEMO_STATE_DIR:-.wrangler/demo-state}
W="node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js"
[ "${SKIP_BUILD:-0}" = 1 ] || npm run build
rm -rf "$STATE"; mkdir -p "$STATE"
for f in drizzle/0*.sql; do $W d1 execute DB --config dist/server/wrangler.json --local --persist-to "$STATE" --file "$f" >/dev/null; done
$W dev --config dist/server/wrangler.json --local --persist-to "$STATE" --ip 127.0.0.1 --port "$PORT" --inspector-port 0 > "$STATE.worker.log" 2>&1 &
echo $! > "$STATE.worker.pid"
for i in $(seq 1 60); do curl -fsS -o /dev/null "http://127.0.0.1:$PORT/api/academy" 2>/dev/null && break; curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/" | grep -qE '^(200|401|302|307)$' && break; sleep 1; done
DEMO_BASE_URL="http://127.0.0.1:$PORT" node scripts/demo/seed.mjs
DEMO_UPSTREAM="http://127.0.0.1:$PORT" DEMO_PORT="$PROXY" node scripts/demo/demo-server.mjs > "$STATE.proxy.log" 2>&1 &
echo $! > "$STATE.proxy.pid"
sleep 2; echo "DEMO READY: open http://127.0.0.1:$PROXY/   (overview: /demo/overview)"
