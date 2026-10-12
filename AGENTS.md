# AGENTS.md — Aplyd Academy

Entry point for any coding agent or engineer. Short on purpose: rules, commands, safety and the repository map. The current state is the status block at the top of [HANDOVER.md](HANDOVER.md); the process is [CONTRIBUTING.md](CONTRIBUTING.md); every document is listed in [docs/DOCUMENTATION-INDEX.md](docs/DOCUMENTATION-INDEX.md).

## What this is

A durable learning application for farmers, MSME owners and public servants: pinned draft curriculum, practice on fictional source packets, evidence submission with independent review, personal practice lab and separate shared workspaces. It is the implemented private pilot, not the full original target (that is preserved under `docs/product-specifications/`). Next.js 16 / vinext on Cloudflare Workers with D1 (Drizzle), seven tables in `db/schema.ts`; learner, course, cohort and submission collections are JSON aggregates.

## Read in this order

1. [HANDOVER.md](HANDOVER.md): status block, then pointers.
2. [docs/CLAUDE-HANDOFF.md](docs/CLAUDE-HANDOFF.md): its "Current state" section is the latest engineering record; the rest is the original handoff, kept as written. One rule there is withdrawn: **"never reformat minified lines"** no longer applies. Prettier is the standard (owner decision, 8 October 2026).
3. [README.md](README.md) and the newest as-built folder, `docs/as-built-v0.15.1/`.
4. [docs/current/ENGINEERING-GUIDE.md](docs/current/ENGINEERING-GUIDE.md): map, naming, how to write code, how to find things, step-by-step tasks, do and don't.

## Rules that must not be broken

- Preserve exact curriculum pins, learner evidence and decisions, applied `drizzle/*.sql` migrations (additive only, inspect generated SQL), user/workspace isolation and the original bytes under `public/library/`. `lib/curriculum.json` and `lib/curriculum-versions/` are byte-verified by the test builders and are excluded from Prettier.
- Server authority stays on the server; client projections never grant access. Hosting access and Academy membership are separate. Staff evidence needs explicit current assignment and scope; ownership alone is not enough. Self-assessment and original-assessor appeals are prohibited.
- Synthetic data only. Never run the local synthetic identity fixtures against the hosted site or the droplet. No credentials in Git, messages or logs; names of secrets are in `docs/governance/secrets-register.md`.
- Pending gates stay closed until the owner opens them: mutating fictional-fixture approval, the live AI credential choice, real partner/identity/hosting. No paid AI, no real recipients.
- `docs/candidates/` and `docs/development-archive/` are preserved research, not executable authority or active source. Source mirrors in the parent project's `sources/` folder are read-only.
- Do not restart the previous scheduler; the owner handed development to Claude.
- Never present a local or in-memory result as hosted verification. Say what was not run.

## Commands

```
pnpm run install:ci      # from the lockfile (Node >= 22.13, pnpm 11.25.0)
pnpm run lint:baseline   # ESLint error count must not rise above .lint-baseline.json
pnpm run typecheck       # tsc --noEmit, must be 0 errors
pnpm run build           # Node standalone build on this branch (pnpm run build:worker for the Worker kit; see docs/operations/cutover-plan.md)
pnpm test                # esbuild builders, tests/**/*.test.mjs under node:test, 80-case routing guard
pnpm run format:check    # Prettier (pnpm run format to fix)
```

Browser and API harnesses (`tests/demo-browser-qa`, `tests/*-browser.mjs`) are run by hand; each folder has a README. `scripts/demo/run-demo.sh` starts a local synthetic demo.

## Safety

- The droplet deploys `main` within about three minutes of a merge (`deploy/README.md`). Open a draft pull request from `<type>/<topic>`; never push to or merge `main` without the owner's word.
- Commit as `Claude <noreply@anthropic.com>` for agent work; never use the owner's identity.
- Ask before anything that costs money or cannot be undone.

## Map

| Path              | Contents                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `app/`            | React UI (one `academy-*.tsx` per area), `app/api/` route handlers                                              |
| `lib/`            | Engine (`academy-engine.ts`), teams, authoring, credentials, storage; pinned curriculum JSON                    |
| `db/`, `drizzle/` | Schema and additive migrations                                                                                  |
| `public/library/` | Original library bytes; do not touch                                                                            |
| `tests/`          | Node tests and builders, browser/API harnesses, `route-errors/`, QA folders                                     |
| `scripts/`        | Test runner, lint baseline, demo, install and environment scripts                                               |
| `deploy/`         | Droplet kit (provision, update, Caddy, add-user)                                                                |
| `docs/`           | `governance/`, `as-built-*/` (non-cumulative), `product-specifications/`, `candidates/`, `development-archive/` |
