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
3. Make one reviewable change. Run the checks below before pushing; run the browser and API harnesses too when the change touches what they cover.
4. Update release notes or the as-built docs if behaviour changed. Report real results only; say what was not run.
5. Commit, push the branch, open a draft PR using the template in `.github/`.
6. Commit as `Claude <noreply@anthropic.com>` for agent work (handoff), never the owner's identity by mistake.

## Checks

Four commands gate every pull request, locally and in the `verify` job of `.github/workflows/ci.yml` (Node 22, `npm ci`):

- `npm run lint:baseline` runs ESLint and compares the error count with `.lint-baseline.json`. The count may fall, never rise; when you fix problems, lower the baseline with `node scripts/lint-baseline.mjs --update` in the same PR. `npm run lint` still shows every problem.
- `npm run typecheck` is `tsc --noEmit`; it must report 0 errors.
- `npm run build` is the Worker build.
- `npm test` runs `scripts/test.mjs`: the esbuild bundling scripts, then every `tests/**/*.test.mjs` under `node:test` and the 80-case read-only routing guard. It needs no browser, network or local stack. The script lists what it excludes and why; the browser and API harnesses are run by hand (tests/demo-browser-qa/README.md).

Formatting follows `.editorconfig` (2-space indent, LF, final newline). A PR that raises the lint baseline or turns any of the four red is not ready for review.

## Documentation changes

Follow docs/governance/README.md: one canonical document per topic, link rather than copy, and record owner, last-reviewed date and an update trigger in every governance document.

## Gaps

- The `verify` job is the only automated gate; browser and API harnesses, dependency and secret scanning are still run by hand or not at all (docs/governance/secure-dev-evidence.md). `main` is not protected, so a red check does not block a merge by itself.
