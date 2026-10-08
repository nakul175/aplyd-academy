# Runbooks (item 12)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when deploy/ scripts, paths or hosting change.

Status: **written from deploy/README.md and deploy/*.sh. None of these procedures has been exercised as a runbook on the droplet.** The kit itself has been running on the shared DigitalOcean droplet since 7 October 2026 at https://academy.aplyd.org behind a Caddy password wall, synthetic data only, and the `sslip.io` name redirects there since 8 October 2026; only its install (`provision.sh`) and the 3-minute update timer have run there. Treat every other step as proposed until exercised once. Run as root on the droplet. Substitute nothing secret into commands in tickets or chat.

Facts used: app `aplyd-academy`, service on `127.0.0.1:3500`, source `/opt/aplyd-academy/src`, data `/var/lib/aplyd-academy/state` (local D1 SQLite), migration ledger `/var/lib/aplyd-academy/applied-migrations.txt`, status `/var/lib/aplyd-academy/deploy-status.json`, sign-in list `/etc/saha/aplyd-academy.users`, Caddy fragment `/etc/caddy/conf.d/aplyd-academy.caddy`.

## 1. Deploy

Automatic: merge to `main`; the timer deploys within about 3 minutes. Check:
```
cat /var/lib/aplyd-academy/deploy-status.json     # state ok | failed
journalctl -u aplyd-academy-update -n 50
```
Manual: `/usr/local/bin/aplyd-academy-update` (takes a lock; "another update is running" means wait).
First-time setup: deploy/README.md "First-time setup".

## 2. Rollback

1. Revert the offending commit on `main` through a PR (agents do not push `main`).
2. Wait for the next timer run or run the updater manually.
3. Confirm `deploy-status.json` shows the new commit and `ok`.
4. If a migration ran, it stays applied. Fix forward with a new additive migration; never edit an applied file. If data is damaged, go to Restore (section 5).

## 3. Restart

```
systemctl restart aplyd-academy
systemctl status aplyd-academy ; journalctl -u aplyd-academy -f
curl -fsS -m 20 -o /dev/null http://127.0.0.1:3500/ && echo up
systemctl reload caddy      # after editing Caddy files; validate with: caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```
The unit has `Restart=always`, 3 s delay. A restart leaves data intact.

## 4. Secret rotation

Names and owners: [secrets-register.md](secrets-register.md).
- **User password** (a person's sign-in): `aplyd-academy-add-user <email>` regenerates it, shows it once on the terminal, stores only a bcrypt hash, reloads Caddy. Send it out of band, not by email body in clear if avoidable.
- **GitHub read token** (`/etc/saha/aplyd-academy.git-token`): create a new fine-grained read-only Contents token, write it with `umask 077`, `chown root:root`, `chmod 600`, revoke the old token on GitHub, then run the updater to prove the pull works. Fine-grained tokens expire (30 days by default); expiry stops the 3-minute updates silently apart from `journalctl -u aplyd-academy-update`.
- **Deploy key**: generate a new key pair on the droplet, replace the deploy key in GitHub (read-only), remove the old one, run the updater.
- **Revoke a person**: remove their line from `/etc/saha/aplyd-academy.users`, `systemctl reload caddy`. There is no session list; a browser that already authenticated may keep working until it is closed (deploy/README.md: no sign-out, no lockout).
No application-level secret exists to rotate (env-config-reference.md).

## 5. Restore

Details and the empty test log: [backup-dr.md](backup-dr.md). Outline, **untested**:
1. `systemctl stop aplyd-academy`.
2. Restore either the DigitalOcean droplet backup/snapshot (whole droplet) or the directory `/var/lib/aplyd-academy/state` from a copy.
3. Ensure ownership `saha:saha` on `/var/lib/aplyd-academy`.
4. If the restored state is older than `applied-migrations.txt` or the repo's migrations, reconcile the ledger with the schema before starting (the updater would otherwise skip or re-run files).
5. `systemctl start aplyd-academy`, run the health curl, sign in as a test user and open a synthetic workspace.
6. Record the attempt in the restore-test log.

## Gaps

- No monitoring pages anyone; failures are visible only via `deploy-status.json` and journals (slo-and-alerts.md).
- No documented procedure for a lost droplet beyond re-running `provision.sh` and restoring state.
