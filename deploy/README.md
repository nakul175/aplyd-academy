# Hosting Aplyd Academy on DigitalOcean

Status: deployment kit, not yet run on a droplet. Synthetic data only. Real identity provider, paid AI and real-recipient delivery stay disabled, as in docs/CLAUDE-HANDOFF.md.

## What runs where

- One droplet, Ubuntu 24.04, **2 GB RAM or more** (the build needs it; a 1 GB droplet runs out of memory), Bangalore region.
- The app is the same build that ran on Cloudflare. It runs in the open-source Workers runtime (`wrangler dev --local`) under systemd, with its D1 database stored as a SQLite file in `/var/lib/aplyd-academy/state`. No application code changed.
- Caddy terminates HTTPS (automatic certificate) and proxies to `127.0.0.1:3500`. Firewall allows 22, 80 and 443 only.
- The droplet pulls `main` every 3 minutes (`aplyd-academy-update.timer`), builds, applies any new `drizzle/*.sql` once (ledger in `/var/lib/aplyd-academy/applied-migrations.txt`) and restarts. Nothing connects in from outside to deploy.
- Release status: `/var/lib/aplyd-academy/deploy-status.json` (commit, state, time).

## First-time setup

1. Merge this change into `main` (the droplet clones `main`).
2. Create the droplet. Create a GitHub fine-grained token with read-only "Contents" access to this repository only.
3. On the droplet, as root:

```bash
# the repository is private: copy deploy/provision.sh to the droplet (scp, or paste it into a file)
SAHA_GIT_TOKEN=<token> SAHA_HOST=agriculture.<ip-with-dashes>.sslip.io SAHA_FIRST_USER=<your email> bash provision.sh
```

A custom domain works the same way: point an A record at the droplet and pass it as `SAHA_HOST`.

## Operate

```bash
systemctl status aplyd-academy            # journalctl -u aplyd-academy -f
journalctl -u aplyd-academy-update -n 50
cat /var/lib/aplyd-academy/deploy-status.json
```

Rollback: revert the commit on `main`; the next timer run redeploys it. Data is untouched by a redeploy.

## Known limits

- `wrangler dev --local` is a development runtime, acceptable for the private synthetic demo and not for production or real farmer data.
- The D1 database is one file on the droplet. Turn on DigitalOcean droplet backups (about 20% of the droplet price) before relying on it.
- Sign-in: the application only accepts the identity headers the original host supplied. On the droplet Caddy is that host: people sign in with an email address and a password (browser basic-auth), and Caddy sets the headers itself, overriding anything a browser sends. Add or reset a person with `aplyd-academy-add-user <email>` (password shown once, only a bcrypt hash is kept in `/etc/saha/aplyd-academy.users`). There is no sign-out other than closing the browser, no lockout and no multi-factor step. This is acceptable for a private synthetic demo for named people and is not real identity management; a real identity provider needs an application change.

## Academy-specific notes

- Build measured on 7 October 2026: `npm run build` took about 12 s and peaked at about 1.2 GB resident (one sandbox run). A 2 GB droplet with the swapfile `provision.sh` adds is enough.
- The built Worker was smoke-tested locally: without the identity headers `/` redirects to sign-in (307); with them it answers 200. Not yet run on a droplet.
- This replaces the Cloudflare/Sites copy only when you decide it should. The hosted Site stays owner-private and untouched. Never point the local synthetic-identity test fixtures at the droplet (see README.md).
- Access: only people given a sign-in with `aplyd-academy-add-user <email>` can reach the app, and Academy membership is a separate gate inside it.
- Data on the droplet is a pilot database in one SQLite file; keep droplet backups on and do not load real learner records until the retention and erasure decisions in docs/CLAUDE-HANDOFF.md are made.

## Sharing one droplet with other Saha apps

Several apps can run on one droplet (recommended: 8 GB RAM for four apps). Each app has its own port, system service, database file and sign-in list. Run each app's `provision.sh` in turn with its own `SAHA_HOST` (for example `health.<ip-dashed>.sslip.io`, `agriculture.<ip-dashed>.sslip.io`).

- Caddy: each app writes `/etc/caddy/conf.d/<app>.caddy`; `/etc/caddy/Caddyfile` only imports that folder.
- Builds share one lock (`/var/lock/saha-build.lock`), so update timers never build two apps at once.
- Failure domain: one droplet means one crash, disk or build problem affects every app on it, and one backup covers all of them.

## Git access: token or deploy key

`provision.sh` reaches the private repository in one of two ways:

- `SAHA_GIT_TOKEN` set: a fine-grained GitHub token with read-only Contents access, stored in `/etc/saha/<app>.git-token`. Fine-grained tokens expire (30 days by default), after which the 3-minute updates stop until the file is replaced.
- `SAHA_GIT_TOKEN` unset: an ed25519 deploy key generated on the droplet at `/etc/saha/<app>.deploy-key`. The first run only prints the public key; add it to the repository under Settings > Deploy keys (read-only), then run `provision.sh` again. GitHub's SSH host keys are fetched from `api.github.com/meta` over TLS into `/etc/ssh/ssh_known_hosts`. Deploy keys do not expire and are scoped to one repository.

Both the first clone and every later update use the same method; `update.sh` picks the key automatically when the file exists.
