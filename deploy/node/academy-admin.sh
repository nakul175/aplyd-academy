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
# Scripts that run as root through sudo must not be writable by the deploy user (hosts provisioned before
# 13 October 2026 had /srv/academy/bin owned by deploy). Harmless when already root-owned.
if [ "$(id -u)" = 0 ] && [ -d "$APP_ROOT/bin" ]; then chown -R root:root "$APP_ROOT/bin" && chmod 755 "$APP_ROOT/bin"; fi
REL="$APP_ROOT/releases/$ID"
[ -f "$REL/scripts/$SCRIPT" ] || { echo "no such script in release $ID: scripts/$SCRIPT"; exit 2; }
# Read the env file the way systemd's EnvironmentFile does (KEY=value per line, value taken literally), not by
# sourcing it: values such as ACADEMY_MAIL_FROM=Aplyd Academy <no-reply@aplyd.org> are not valid shell.
ENV_ARGS=()
while IFS= read -r line || [ -n "$line" ]; do
  [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
  ENV_ARGS+=("$line")
done < /etc/academy/academy.env
cd "$REL"
exec runuser -u academy -- env "${ENV_ARGS[@]}" node --no-warnings "scripts/$SCRIPT" "$@"
