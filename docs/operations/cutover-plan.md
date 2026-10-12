# Cutover plan: Worker build to Node runtime

Owner: Nakul Jain. Status: **draft, not approved**. Last reviewed: 2026-10-13. Update when any step below is done or the hosting decision changes.

## Why this exists

The repository has two deploy kits:

| Kit | Runtime | Who runs it | What it serves |
| --- | --- | --- | --- |
| `deploy/` | Cloudflare-style Worker build run locally by wrangler (`pnpm run build:worker` on this branch, `pnpm run build` on `main`), local D1 state | `aplyd-academy-update.timer` on the shared DigitalOcean droplet pulls `main` every 3 minutes (`deploy/update.sh`) | https://academy.aplyd.org (synthetic data, Caddy password wall) |
| `deploy/node/` | Next.js standalone on Node 22, SQLite (`node:sqlite`), email one-time-code sign-in (ADR-0001 Option A) | Nobody yet: needs its own droplet | Nothing yet |

On branch `aca/practice-loop`, `pnpm run build` produces the Node build, not the Worker build. `deploy/update.sh` runs `pnpm run build` and then expects `dist/server/wrangler.json`. **Merging this branch into `main` before cutover would make the next timer run fail its build and leave the live site on a failed deploy.**

## Rule until cutover

Do not merge `aca/practice-loop` (or `aca/practice-loop-sync`) into `main`. Draft pull requests are fine: CI runs on them and nothing deploys.

## Steps (each needs the owner)

1. **Choose the target.** Owner decision: new droplet for the Node runtime (DigitalOcean BLR1 proposed in ADR-0001) or the shared droplet. Not decided.
2. **Provision the Node host** with `deploy/node/provision.sh`; set secrets from `deploy/node/academy.env.example` (mail provider key, session secret, backup bucket). Secrets are created by the owner, never by Claude.
3. **Restore drill** with `deploy/node/restore-drill.sh` on the new host before any traffic.
4. **Stop the old auto-update.** On the shared droplet: `systemctl disable --now aplyd-academy-update.timer` (owner or the droplet operator).
5. **Merge to `main`** only after step 4, so no timer pulls the Node build into the Worker kit.
6. **Release** with `deploy/node/release.sh`; check `/api/health`.
7. **Move DNS** for academy.aplyd.org to the new host, keeping the password wall until the owner lifts it.
8. **Data.** The live site holds synthetic data only. Nothing is migrated from the D1 state; the Node database starts from `pnpm run migrate`. If the owner wants the synthetic records kept, that is a separate export step.
9. **Rollback.** Until step 7, point DNS back and re-enable the old timer on a commit of `main` before the merge. After step 7, `deploy/node/release.sh` keeps the previous release for rollback (tested by `tests/node-runtime/release-rollback.sh`).

## Open

- Hosting target and region (step 1).
- Mail provider domain (Resend) verification.
- GitHub `production` environment and secrets for `.github/workflows/academy-ci-deploy.yml`.
