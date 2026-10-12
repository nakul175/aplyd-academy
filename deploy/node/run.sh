#!/usr/bin/env bash
# Started by systemd (academy.service): runs the release that $APP_ROOT/current points to.
set -euo pipefail
APP_ROOT="${APP_ROOT:-/srv/academy}"
current="$(readlink -f "$APP_ROOT/current")"
export ACADEMY_RELEASE="$(basename "$current")"
cd "$current"
exec node --no-warnings server.js
