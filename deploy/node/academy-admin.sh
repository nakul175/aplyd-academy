#!/usr/bin/env bash
# Run one repository script from an installed release as the academy user, against the live database.
# Root-only; the deploy user may call it through sudo (see provision.sh). Used by release.sh for migrations and
# the one-time decision seed, and by hand for scripts/loop-admin.mjs (grant, notice, list-operators).
# Usage: academy-admin.sh <release-id> <script.mjs> [args...]
set -euo pipefail
ID="${1:-}"; SCRIPT="${2:-}"; shift 2 || { echo "usage: academy-admin.sh <release-id> <script.mjs> [args]"; exit 2; }
[[ "$ID" =~ ^[A-Za-z0-9._-]{1,64}$ ]] || { echo "invalid release id"; exit 2; }
[[ "$SCRIPT" =~ ^[a-z0-9-]+\.mjs$ ]] || { echo "invalid script name"; exit 2; }
APP_ROOT="${APP_ROOT:-/srv/academy}"
REL="$APP_ROOT/releases/$ID"
[ -f "$REL/scripts/$SCRIPT" ] || { echo "no such script in release $ID: scripts/$SCRIPT"; exit 2; }
set -a; . /etc/academy/academy.env; set +a
cd "$REL"
exec runuser -u academy -- node --no-warnings "scripts/$SCRIPT" "$@"
