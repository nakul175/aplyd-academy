# Cutover plan: Worker demo to the Node runtime

Owner: Nakul Jain. Status: **in progress, 13 October 2026**. Last reviewed: 2026-10-13. Update when a step below is done.

## Why this exists

The repository has two deploy kits:

| Kit | Runtime | Who runs it | What it serves |
| --- | --- | --- | --- |
| `deploy/` | Worker build run locally by wrangler (`pnpm run build`), local D1 state | `aplyd-academy-update.timer` on the shared DigitalOcean droplet `saha-apps` (64.227.190.72) pulls `main` every 3 minutes (`deploy/update.sh`) | https://academy.aplyd.org today (synthetic data, Caddy password wall) |
| `deploy/node/` | Next.js standalone on Node 22, SQLite (`node:sqlite`), email one-time-code sign-in (ADR-0001 Option A); `pnpm run build:node` | GitHub Actions deploy job (`.github/workflows/academy-ci-deploy.yml`) over SSH as the `deploy` user | https://academy.aplyd.org after step 5 |

`pnpm run build` is the Worker build on this branch as on `main`, so merging does **not** break the shared droplet: it keeps building and serving the Worker version. The Node runtime is built and deployed separately. Decided 13 October 2026 under delegation (`docs/decisions/owner-decisions-2026-10-13.md`).

## Order

1. **Host.** Create the droplet `academy-blr1` (Ubuntu 24.04, BLR1, 4 GB) with the user-data from `node deploy/node/make-cloud-init.mjs` pasted into the create form and a dedicated SSH key. First boot provisions everything (Node, Caddy, Litestream, users, services, firewall, local secrets). No repository access is needed on the host.
2. **Secrets in GitHub.** Environment `production` on `nakul175/aplyd-academy` with `ACADEMY_DEPLOY_HOST` (the droplet's IP), `ACADEMY_DEPLOY_SSH_KEY` (private half of the key from step 1), and the provider keys `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY`. The deploy job carries the provider keys to `/etc/academy/*.env` through `set-secret.sh`; nothing else ever handles them.
3. **First release from the sync branch.** Run the "Academy node runtime" workflow by hand on `aca/practice-loop-sync` with `deploy = true`. The release applies migrations, seeds the 13 October decisions and notice v1.0, and must pass `/api/health`. The job prints the host key it trusted: pin it as `ACADEMY_DEPLOY_KNOWN_HOSTS`.
4. **Restore drill** on the host (`sudo /srv/academy/bin/restore-drill.sh`) once Litestream has taken its first snapshot (within a day of the Spaces keys arriving). Record the result in `docs/operations/runbook-practice-loop.md`.
5. **DNS.** Point the GoDaddy A record `academy.aplyd.org` at the new droplet. Caddy obtains the certificate within a minute of the record propagating. Smoke test: sign in with a one-time code, join a synthetic cohort, open a task. The Worker demo keeps running on the shared droplet but is no longer reachable by that name.
6. **Merge PR #14 to `main`.** Safe after step 5 and also before it: the shared droplet builds the Worker version of the merged code (its sign-in needs `ACADEMY_TRUST_IDENTITY_HEADERS=1`, which that droplet does not set, so the old demo stops authenticating on that host; nobody is pointed at it any more). Then disable `aplyd-academy-update.timer` and `aplyd-academy.service` on `saha-apps` when convenient.
7. **Owner account.** The owner signs in once at academy.aplyd.org, then on the host: `sudo /srv/academy/bin/academy-admin.sh <release-id> loop-admin.mjs grant nakul.jain@aplyd.com owner`. Then run the AI evaluation set in Operations; the coach serves learners only once it passes (ACA-US-7.2).
8. **Password wall.** The Node host has none (the sign-in is the wall). The owner decides when the public site may be indexed; until then `robots` stays `noindex` (default in the app).

## Rollback

- Before step 5: nothing to roll back; the old demo keeps serving.
- After step 5: point DNS back at 64.227.190.72 (the Worker demo still runs there until step 6's cleanup).
- A bad release on the Node host rolls itself back (`release.sh`, tested by `tests/node-runtime/release-rollback.sh`).

## What is in this branch for it

- `deploy/node/make-cloud-init.mjs`: self-contained first-boot provisioning.
- `deploy/node/academy-admin.sh`, `set-secret.sh`: the only two root actions the deploy user may take, besides restarting the service.
- `scripts/seed-decisions.mjs` and `docs/decisions/owner-decisions-2026-10-13.json`: the delegated decisions, inserted once per database.
- `.github/workflows/academy-ci-deploy.yml`: manual dispatch with deploy, secrets carried to the host, host-key pinning.

## Open

- Steps 1 and 2 need the owner's accounts (DigitalOcean billing, GitHub secrets, Resend and Anthropic keys, Spaces keys). Claude is not permitted to spend money or paste credentials, so these are the owner's; everything else is ready.
- The textile workshop date (not found in the calendar on 13 October 2026).
