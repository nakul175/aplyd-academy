#!/usr/bin/env bash
# One-time setup of the dedicated Academy droplet (Ubuntu 24.04, region BLR1). Run as root.
# Installs Node 22, Caddy, Litestream; creates users, folders, the service and the backup service.
# Secrets are written by the owner afterwards into /etc/academy/*.env; this script never sees them.
set -euo pipefail
LITESTREAM_VERSION=0.3.13
apt-get update && apt-get -y upgrade
apt-get -y install curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https sqlite3 ufw unattended-upgrades
# Node 22 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get -y install nodejs
# Caddy (official repository)
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get -y install caddy
# Litestream
curl -fsSL -o /tmp/litestream.deb "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-amd64.deb"
dpkg -i /tmp/litestream.deb
# Users and folders
id academy >/dev/null 2>&1 || useradd --system --home /srv/academy --shell /usr/sbin/nologin academy
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
mkdir -p /srv/academy/releases /srv/academy/snapshots /srv/academy/bin /var/lib/academy /etc/academy
chown -R academy:academy /var/lib/academy && chmod 700 /var/lib/academy
chown -R deploy:academy /srv/academy && chmod 750 /srv/academy
chmod 700 /etc/academy
# The deploy user may restart only this service.
echo 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart academy' > /etc/sudoers.d/academy-deploy && chmod 440 /etc/sudoers.d/academy-deploy
# Service, proxy, backup
install -m 755 "$(dirname "$0")/run.sh" /srv/academy/bin/run.sh
install -m 755 "$(dirname "$0")/release.sh" /srv/academy/bin/release.sh
install -m 755 "$(dirname "$0")/restore-drill.sh" /srv/academy/bin/restore-drill.sh
install -m 644 "$(dirname "$0")/academy.service" /etc/systemd/system/academy.service
install -m 644 "$(dirname "$0")/Caddyfile" /etc/caddy/Caddyfile
install -m 644 "$(dirname "$0")/litestream.yml" /etc/litestream.yml
mkdir -p /etc/systemd/system/litestream.service.d
printf '[Service]\nEnvironmentFile=/etc/academy/litestream.env\n' > /etc/systemd/system/litestream.service.d/env.conf
systemctl daemon-reload && systemctl enable academy litestream caddy
# Firewall: SSH and web only
ufw default deny incoming && ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
echo "Provisioned. Next: write /etc/academy/academy.env and /etc/academy/litestream.env (mode 600), point DNS, run the first release."
