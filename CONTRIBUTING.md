# Contributing

Owner: Nakul Jain. Last reviewed: 2026-10-08. Update when the branching, test or deploy process changes.

Read [CLAUDE.md](CLAUDE.md), [docs/CLAUDE-HANDOFF.md](docs/CLAUDE-HANDOFF.md) ("Current state" first) and [README.md](README.md) before changing anything. Full process: [docs/governance/release-process.md](docs/governance/release-process.md).

## Rules that are not negotiable

- Branch from current `origin/main`. Open a **draft** pull request. Never push to or merge `main` yourself; the droplet deploys `main` within about 3 minutes of a merge.
- Preserve exact curriculum pins, learner evidence, applied `drizzle/*.sql` migrations (additive only; inspect generated SQL), user/workspace isolation and the original bytes under `public/library/`.
- `docs/candidates/` and `docs/development-archive/` are preserved research. Do not edit them.
- Synthetic data only. Never run synthetic-identity fixtures against the hosted Site or the droplet.
- Respect the pending gates in the handoff: mutating fictional-fixture approval, live AI credential choice, real partner/identity/hosting. Do not enable paid AI or real recipients.
- No credentials in Git, commit messages, issues or logs. Names of secrets live in docs/governance/secrets-register.md.
- Server authority stays on the server; client projections never grant access.

## Workflow

1. `git fetch origin && git switch -c <type>/<topic> origin/main`.
2. `npm run install:ci` from the lockfile (Node >= 22.13).
3. Make one reviewable change. Run what applies: `node node_modules/typescript/bin/tsc --noEmit`, `npm run lint`, `npm run build`, and the pure/read-only test suites listed in the latest `docs/as-built-*/release-evidence.json`.
4. Update release notes or the as-built docs if behaviour changed. Report real results only; say what was not run.
5. Commit, push the branch, open a draft PR using the template in `.github/`.
6. Commit as `Claude <noreply@anthropic.com>` for agent work (handoff), never the owner's identity by mistake.

## Documentation changes

Follow docs/governance/README.md: one canonical document per topic, link rather than copy, and record owner, last-reviewed date and an update trigger in every governance document.

## Gaps

- No CI workflow exists (`.github/workflows/` absent); checks are run by hand. Recorded in docs/governance/secure-dev-evidence.md.
