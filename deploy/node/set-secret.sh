#!/usr/bin/env bash
# Set one value in /etc/academy/academy.env (or litestream.env for LITESTREAM_* keys) and restart the service that
# reads it. The value is read from standard input, never from the command line, so it does not appear in process
# lists or shell history. Root-only; the deploy user may call it through sudo, which is how the GitHub deploy job
# carries the owner's keys (Resend, AI provider, Spaces) from GitHub environment secrets to the server.
# Usage: printf '%s' "$VALUE" | set-secret.sh KEY_NAME
set -euo pipefail
KEY="${1:-}"
[[ "$KEY" =~ ^[A-Z][A-Z0-9_]{1,63}$ ]] || { echo "invalid key name"; exit 2; }
IFS= read -r VALUE || true
[ -n "$VALUE" ] || { echo "empty value for $KEY; nothing changed"; exit 0; }
case "$VALUE" in *$'\n'*|*$'\r'*) echo "value must be one line"; exit 2;; esac
if [[ "$KEY" == LITESTREAM_* ]]; then FILE=/etc/academy/litestream.env; SERVICE=litestream; else FILE=/etc/academy/academy.env; SERVICE=academy; fi
umask 077
touch "$FILE"
TMP="$(mktemp /etc/academy/.env.XXXXXX)"
grep -v "^${KEY}=" "$FILE" > "$TMP" || true
printf '%s=%s\n' "$KEY" "$VALUE" >> "$TMP"
chmod 600 "$TMP" && mv "$TMP" "$FILE"
if [ "$SERVICE" = litestream ]; then
  # Litestream starts only once both Spaces keys are present.
  if grep -q '^LITESTREAM_ACCESS_KEY_ID=' "$FILE" && grep -q '^LITESTREAM_SECRET_ACCESS_KEY=' "$FILE"; then
    systemctl enable --now litestream >/dev/null 2>&1 || true
    systemctl restart litestream || true
  fi
else
  # Restart only if the app is already running a release; the first release starts it anyway.
  if [ -e /srv/academy/current ]; then systemctl restart academy || true; fi
fi
echo "set $KEY in $FILE"
