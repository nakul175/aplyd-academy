# Release and deploy process (item 17)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when deploy/*.sh, the branching rule or the hosting target changes. Facts from deploy/README.md, deploy/update.sh and docs/CLAUDE-HANDOFF.md.

## Flow

1. Work on a branch from current `origin/main`; open a **draft** PR (CONTRIBUTING.md). The `verify` job (`.github/workflows/ci.yml`) runs lint ratchet, typecheck, build and the pure suites on the PR; browser and API evidence is still produced by hand.
2. Evidence before merge: typecheck, build, the pure/read-only suites named in the newest `docs/as-built-*/release-evidence.json`. Mutating fictional-fixture suites stay held until the owner approves (handoff).
3. The owner merges. Agents never merge `main`.
4. Droplet: `aplyd-academy-update.timer` runs `/usr/local/bin/aplyd-academy-update` every 3 minutes. If `origin/main` moved it runs `npm ci`, `npm run build`, stops the service, applies pending `drizzle/*.sql` once each, restarts, waits 5 s and checks `http://127.0.0.1:3500/`. Result is written to `/var/lib/aplyd-academy/deploy-status.json` (`ok` or `failed`, commit, time).
5. Builds share one lock with other apps on the droplet (`/var/lock/saha-build.lock`).

## Hosted Site (separate path)

The owner-private Sites copy is published by the owner through the Sites workflow; Claude does not hold that credential (handoff "Current state"). At the time of the handoff it served v0.15.0, native version 16. Not verified since.

## Rollback

Revert the commit on `main`; the next timer run redeploys. A migration is not reversed by a code revert; write a new additive migration instead (runbooks.md).

## Versioning

No tagged releases exist; versions are named in docs (as-built folders, release notes, CHANGELOG.md). `package.json` still says `0.1.0` (starter name `site-creator-vinext-starter`). TBD (owner: Nakul Jain): adopt tags.

## Gaps

- Automatic deploy on merge with no CI gate and no staging environment: a bad merge reaches the droplet within about 3 minutes. Proposed: protect `main` and add a CI check (not done; owner decision).
- Deploy kit has not yet been run on a real droplet (deploy/README.md status line).
