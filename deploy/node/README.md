# Production runbook: Aplyd Academy on its own DigitalOcean droplet (ACA-US-1.3, ACA-US-1.5)

> **Two deploy kits exist.** `deploy/` is the kit in use today: the Worker build (`pnpm run build`) on the shared droplet, which pulls `main` every 3 minutes. This kit, `deploy/node/`, is the Node + SQLite setup approved in ADR-0001 for a dedicated BLR1 droplet, built with `pnpm run build:node`. Because `pnpm run build` stays the Worker build, merging to `main` does not break the shared droplet. Order of the cutover: `docs/operations/cutover-plan.md`.

Decisions: ADR-0001 Option A (Node + SQLite); owner decision of 12 October 2026: a dedicated droplet in **Bangalore (BLR1)** serving **academy.aplyd.org**, so learner data stays in India.

**Fastest path (13 October 2026):** `node deploy/node/make-cloud-init.mjs` prints a cloud-init user-data that does everything `provision.sh` does, with every file of this kit embedded, so a fresh droplet provisions itself at first boot with no repository access. The deploy user receives the SSH key chosen in the DigitalOcean form. Provider keys never touch this kit: the GitHub deploy job pipes them from the `production` environment secrets into `set-secret.sh` on the host. Database scripts (migrations, the one-time decision seed, `loop-admin.mjs`) run as the `academy` user through `academy-admin.sh`, which, with `set-secret.sh` and `systemctl restart academy`, is all the deploy user may do as root.

Nothing here has been run against a real server yet.

## What runs where

| Part                              | Where                                                                                                                     | File                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| App (Next.js standalone, Node 22) | `/srv/academy/current` → `/srv/academy/releases/<id>`, port 3000 on localhost                                             | `academy.service`, `run.sh`                             |
| HTTPS                             | Caddy, automatic certificate                                                                                              | `Caddyfile`                                             |
| Database                          | SQLite (WAL) at `/var/lib/academy/academy.sqlite`                                                                         | `scripts/migrate.mjs`                                   |
| Backup                            | Litestream → Spaces bucket `aplyd-academy-backups` (BLR1); about 10 s of writes at risk; 30 days of point-in-time restore | `litestream.yml`                                        |
| Release                           | copy tarball → `release.sh`: snapshot, migrate, switch, health check, automatic rollback                                  | `release.sh`, `.github/workflows/academy-ci-deploy.yml` |
| Monitoring                        | DigitalOcean uptime check on `https://academy.aplyd.org/api/health`                                                       | below                                                   |

## One-time setup (owner or an agent with access)

1. Create the droplet: Ubuntu 24.04, region BLR1, SSH key login only, monitoring agent on. Size: start small and resize on evidence (pricing: https://www.digitalocean.com/pricing).
2. Copy `deploy/node/` to the droplet and run `sudo deploy/node/provision.sh`.
3. Create the Spaces bucket `aplyd-academy-backups` in BLR1 and a Spaces key limited to that bucket. Write `/etc/academy/litestream.env` (mode 600): `LITESTREAM_ACCESS_KEY_ID=…`, `LITESTREAM_SECRET_ACCESS_KEY=…`.
4. Write `/etc/academy/academy.env` from `academy.env.example` (mode 600). Generate the auth secret with `openssl rand -base64 48`.
5. Resend: add and verify the sending domain (DNS records Resend shows), create an API key, put it in `academy.env`.
6. DNS: point `academy.aplyd.org` (A record) at the new droplet. This moves the name away from the shared `saha-apps` droplet, whose Academy copy stops being reachable under that name.
7. GitHub: environment `production` with required reviewer Nakul Jain; secrets `ACADEMY_DEPLOY_SSH_KEY`, `ACADEMY_DEPLOY_HOST`, `ACADEMY_DEPLOY_KNOWN_HOSTS` (deploy user's key and the droplet's host key).
8. Uptime check (DigitalOcean > Monitoring > Uptime): `https://academy.aplyd.org/api/health`, alert by email when down or slower than 2 s.
9. First release from CI, then run the restore drill once: `sudo /srv/academy/bin/restore-drill.sh`.

## Every deploy

Merge to `main` → CI tests and builds → Nakul approves the `production` job → `release.sh` installs it. If the new release fails its migration or health check, the script restores the pre-release database snapshot, switches back to the previous release and checks that it is healthy. Exit code 3 means the previous release is not healthy either: the site is down.

Known gap: during a migration rollback the old server keeps running for a few seconds on the replaced database file; writes in that window are lost. Acceptable for the pilot; revisit before more than one cohort.

## Monthly

Run `restore-drill.sh` and note the result in Linear (ACA-US-1.3). Check the uptime check's history.

## Local evidence (12 October 2026)

- `tests/node-runtime/release-rollback.sh`: 10 of 10. A good release goes live; a crashing release and a failing migration both roll back; data intact; the previous release serves.
- `tests/node-runtime/backup-restore.sh`: Litestream v0.3.13 with a local file replica; after losing the database file, the restore returned all 500 test rows, all migrations, integrity ok.
