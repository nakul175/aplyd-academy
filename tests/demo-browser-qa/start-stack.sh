#!/usr/bin/env bash
# Starts the acceptance stack on its own ports and state (see README.md). Run from anywhere.
cd "$(dirname "$0")/../.."
export DEMO_WORKER_PORT=${DEMO_WORKER_PORT:-8801} DEMO_PROXY_PORT=${DEMO_PROXY_PORT:-8802} DEMO_STATE_DIR=${DEMO_STATE_DIR:-.wrangler/accept-state}
[ -f "$DEMO_STATE_DIR.proxy.pid" ] && kill "$(cat "$DEMO_STATE_DIR.proxy.pid")" 2>/dev/null
[ -f "$DEMO_STATE_DIR.worker.pid" ] && kill "$(cat "$DEMO_STATE_DIR.worker.pid")" 2>/dev/null
sleep 1
[ -d dist ] || npm run build
SKIP_BUILD=1 bash scripts/demo/run-demo.sh
