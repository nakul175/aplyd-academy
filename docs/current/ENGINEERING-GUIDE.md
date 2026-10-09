# Engineering guide

Owner: Nakul Jain. Last reviewed: 2026-10-09. Update when a script, a CI step, a folder or a naming rule changes. This guide is for an engineer, human or AI, who has never seen this repository and has no chat history. It does not state the project's current version, hosting state or test counts: those live once, in the status block at the top of [HANDOVER.md](../../HANDOVER.md). Where this guide gives a duration or a number, it says when it was measured; treat it as an example, not a promise.

Contents: 0 standard, 1 what this is, 2 first hour, 3 map, 4 names, 5 writing code, 6 finding things, 7 commands and gates, 8 common tasks, 9 do and don't, 10 keeping it clean, 11 glossary, 12 where things stand.

## 0. The Products standard (identical in every Products repository)

This section is the same in all six repositories (saha-health, saha-education, saha-agriculture, aplyd-academy, impact-platform, sheet-happens-officer). The rest of this guide is specific to this repository. If the two ever disagree, this repository's own safety rules in AGENTS.md win.

### 0.1 Principles

1. **A human must be able to take over.** Anyone who can read English and knows the language of the repository should be productive on day one using only README.md, AGENTS.md, HANDOVER.md and this guide. If a fact is only in someone's head or a chat, it is missing; write it down.
2. **One place per fact.** Version, hosting state, test counts and open items are stated once, in the status block at the top of HANDOVER.md. Everything else links to it. Never copy a number into a second document.
3. **Small, reviewable, reversible.** One purpose per branch and pull request. Prefer deleting code to adding it. Nothing is merged without a green `verify` check and the owner's approval.
4. **Truth over polish.** Say what was and was not run. Never write "done", "passing" or "verified" for something that was not executed. Synthetic data is never described as real; a demo is never described as production.
5. **Server is the authority.** Permission, ownership and validation are decided on the server. The client only displays.
6. **Never destroy history.** Applied migrations, evidence, receipts and audit records are append-only. Corrections add a new record; they do not rewrite the old one.

### 0.2 Root of the repository

Exactly these markdown files may sit at the root: `README.md`, `AGENTS.md`, `CLAUDE.md`, `HANDOVER.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `LICENSE` (some repositories omit one or two). Every other document lives under `docs/`. `CLAUDE.md` is a short pointer to AGENTS.md and HANDOVER.md. `AGENTS.md` holds the rules, commands and safety limits. `HANDOVER.md` starts with the status block.

```
docs/
  DOCUMENTATION-INDEX.md   generated; lists every document; never edit by hand
  current/                 live documents (this guide, architecture, contracts)
  history/                 superseded documents and old receipts; read-only
  governance/              policy bundle where the repository has one
```

A document that replaces another moves the old one to `docs/history/` in the same pull request. A new document is added to the index in the same pull request (`pnpm run docs:index`; CI runs `docs:index:check`).

### 0.3 Naming

| Thing | Rule | Example |
|---|---|---|
| Source files and folders | `kebab-case`, lower case, no spaces, no version suffix | `reading-review.ts`, `lib/education/` |
| React components | file `kebab-case.tsx`, component `PascalCase` | `reading-review-panel.tsx` exports `ReadingReviewPanel` |
| Functions and variables | `camelCase`, verbs for functions, nouns for values | `loadStudent`, `studentCount` |
| Types, classes | `PascalCase` | `StudentRecord` |
| Constants | `UPPER_SNAKE_CASE` only for true constants | `MAX_UPLOAD_BYTES` |
| Python | `snake_case` modules and functions, `PascalCase` classes | `audit_export.py` |
| Database tables and columns | `snake_case`, plural table names, no abbreviations | `reading_checks.student_id` |
| Migrations | next number, then topic, never edited once applied | `0041_add_reading_review.sql` |
| API routes | nouns, plural, kebab-case; HTTP verb carries the action | `POST /api/reading-checks` |
| Environment variables | `UPPER_SNAKE_CASE`, one prefix per app; listed in README | `EDUCATION_DEMO_LOGIN` |
| Branches | `<type>/<topic>-<yyyy-mm-dd>` with type one of `feat fix docs chore refactor deploy release qa ops handover` | `fix/reading-nonce-2026-10-09` |
| Commits | `type: imperative sentence` (72 characters or fewer), body explains why | `fix: reject a replayed nonce` |
| Pull requests | title like a commit; body states what changed, what was run, what was not run | |
| Documents | `UPPER-CASE.md` for governance and handover files; `Title-Case.md` or `kebab-case.md` as the repository already does, never both in one folder | |
| Dates | ISO `2026-10-09` in file names; "9 October 2026" in prose; never `October2026` | |

Never put a version, date or "final" in a source file name (`index-v2.ts`, `new-api-final.ts`). Version control is the version.

### 0.4 Writing code

1. **Format is not a discussion.** Prettier (config in `.prettierrc.json`, print width 110, single quotes, trailing commas, semicolons) formats everything; `pnpm run format` fixes it, `pnpm run format:check` is a CI gate. Python uses ruff format. Never hand-align, never reformat a file you are not otherwise changing.
2. **Lines under 110 characters; functions under about 40 lines; files under about 400 lines.** If a file grows past that, split it by responsibility, not alphabetically.
3. **Types are real.** TypeScript is `strict`. No `any`; use `unknown` and narrow, or a named type. No `@ts-ignore`; if unavoidable use `@ts-expect-error` with a reason. Python functions that cross a module boundary carry annotations.
4. **One definition per helper.** Before writing `json()`, `sameOrigin()`, `sha256()`, `now()`, `uniqueFailure()` or similar, search the repository (`rg "function name"`); if it exists, import it. A second copy is a defect. Shared helpers live in one place named in section 3 of this guide.
5. **Imports go one way.** Pages and routes import from `lib/`; `lib/` never imports from `app/`. No import cycles. Use the `@/` alias, not `../../..`.
6. **Names say what a thing is.** No `data`, `info`, `tmp`, `util`, `helper`, `manager`, `handle2`. A boolean reads as a question: `isExpired`, `hasConsent`.
7. **Comments explain why, never what.** No commented-out code; delete it (git remembers). A `TODO` carries an owner and a date or does not exist.
8. **Errors are handled or raised, never swallowed.** No empty `catch`. A user-visible error is plain language and says what to do next. A server error never leaks stack traces, SQL or secrets.
9. **Validate at the boundary.** Every request body, query and header is parsed by a schema before use; unknown fields are rejected.
10. **Dependencies are a liability.** Add one only with a reason in the pull request; pin exact versions; prefer the standard library.
11. **Secrets, real personal data, databases, build output and logs never enter git.** Use synthetic fixtures. `.env*` files stay local.
12. **Tests prove behaviour.** A bug fix lands with the test that fails without it. A test names the behaviour (`rejects a replayed nonce`), not the function. Do not edit a test to make it pass; fix the code or explain why the test was wrong.
13. **Lint is a ratchet.** The committed baseline (`.lint-baseline.json`) may only go down. A pull request that raises it is red. Fix warnings in files you touch.

### 0.5 Every change, start to finish

1. Start from current `origin/main`: `git fetch origin main && git switch -c <type>/<topic>-<date> origin/main`.
2. Read the files you will touch and the tests beside them. Search for an existing helper before writing one.
3. Make the smallest change that does the job. Update the documents it affects in the same pull request.
4. Run the gate (section 6 of this guide). Run it again after the last edit.
5. Commit with a clear subject. Push. Open a **draft** pull request that states what was changed, what was run (with results) and what was not run.
6. Wait for CI. Fix every red check, or say plainly why it is unrelated.
7. A person (or a reviewing agent with the full diff) approves and merges. Agents do not merge on their own authority.
8. After a merge to `main`, check the status block in HANDOVER.md still tells the truth; update it if not.

### 0.6 Do and don't (all repositories)

Do:
- Search before writing. Reuse before adding.
- Keep a change to one purpose; split unrelated fixes.
- State what you did not test.
- Use synthetic data; mark demo behaviour as demo.
- Put new documents under `docs/` and in the index.
- Update HANDOVER.md's status block when hosting, version, gates or open items change.

Don't:
- Don't force-push `main`; don't push to `main` at all in repositories that deploy from it.
- Don't merge without a green `verify` and the owner's approval; don't deploy, change hosting, send messages to real people or spend money without being told to.
- Don't add a root-level document, a second status statement, or a count copied from elsewhere.
- Don't commit screenshots, logs, audio, zips, dumps, generated mirrors or test output. Evidence is kept as manifests and hashes; the files live outside git.
- Don't edit an applied migration, a retained evidence file, a receipt or anything under `docs/history/` (except to move a document there).
- Don't weaken a check, raise the lint baseline, add `eslint-disable` or `any` to get a green build.
- Don't retry an uncertain mutation (a payment, a message, a deploy) blindly; find out what happened first.
- Don't claim "production", "accepted", "verified" or "passing" for anything that was not run and observed.

### 0.7 Handing over (when your session ends)

Before you stop: everything is committed and pushed on a branch with a draft pull request; the status block in HANDOVER.md is current; "Open items" lists what is unfinished and why, with the exact next command or file; no uncommitted work remains in the checkout. The next person, human or agent, should be able to continue from HANDOVER.md alone.

### 0.8 Exceptions in this repository

Section 0 is the rule for new work. It is not literally true of the existing tree. Each place it is not, checked on 9 October 2026:

1. **Section numbers.** Section 0.5 says "the gate (section 6 of this guide)". In this guide the gate is section 7, and section 6 is "How to find things". Section 0.4 point 4 says shared helpers are named in section 3; that is correct.
2. **Folders under `docs/`.** There was no `docs/current/` before this guide and there is no `docs/history/`. This repository keeps superseded material in place: the `docs/as-built-*` folders, `docs/implementation-review-v0.13/`, `docs/product-specifications/`, `docs/candidates/` and `docs/development-archive/` stay where they are (AGENTS.md forbids moving or editing them). `docs/governance/` exists and holds the policy bundle. For a new document that is superseded, follow 0.2 and create `docs/history/` on first use.
3. **Prettier does not format everything.** `.prettierignore` excludes `docs/`, `public/`, `components/ui/`, `drizzle/meta/`, `pnpm-lock.yaml`, `tests/evidence/`, `tests/**/screens/`, `media/`, `verification/`, `outputs/`, `*.min.*`, `*.map`, build output and, deliberately, `lib/curriculum.json` and `lib/curriculum-versions/`. The curriculum JSON is excluded because the test builders verify its exact bytes by SHA-256; reformatting it would break pins and learner records. The rest of section 0.4 point 1 holds: print width 110, single quotes, trailing commas, semicolons. No Python formatter is configured (one Python file exists, `tests/route-errors/snapshot-fictional.py`).
4. **The lint baseline is not zero.** 0.4 point 13 describes a ratchet; here the ratchet sits at about a thousand errors (the number is in `.lint-baseline.json`, which is the only place to read it; 1,134 when this guide was written). More than nine in ten are `@typescript-eslint/no-explicit-any`. So "No `any`" (0.4 point 3) is the rule for new code, not a description of the tree. Do not add `any` and do not clean old `any` in unrelated files.
5. **File and function size.** `lib/academy-engine.ts` is over 1,000 lines and `applyCommand` in it is one switch of roughly 700 lines; `app/academy-authoring.tsx` is over 1,500 lines. About 350 lines in `app/` and `lib/` exceed 110 characters (long string literals Prettier cannot break). New files follow 0.4 point 2. Do not split a legacy file inside a pull request that is about something else.
6. **Validation at the boundary (0.4 point 9).** `zod` is in `package.json` but nothing in `app/` or `lib/` imports it. Route handlers validate by hand (content type, size cap, `JSON.parse`, object check, then field checks in `lib/`). Follow that pattern; do not add a second validation style without the owner.
7. **One definition per helper (0.4 point 4).** `lib/http.ts` is the shared place for route helpers. SHA-256 hex is still written inline in at least eight files (`rg "subtle.digest" app lib`), and several routes define their own `fail` or `hash`. These are known duplicates; do not add a ninth, and fold them into one helper only in a pull request whose purpose is exactly that.
8. **Imports (0.4 point 5).** `lib/` never imports from `app/` (verified). The `@/` alias is the norm (about 190 uses) but 19 relative `../` imports remain, mainly route files importing `app/chatgpt-auth.ts`.
9. **Naming (0.3).** See section 4 for the full list. In short: API routes are not all plural nouns and `POST /api/academy` carries the action in a `command.type` field, not in the HTTP verb; migrations 0000 to 0005 have generated random names; environment variable prefixes vary (`ACADEMY_`, `SAHA_`, `DEMO_`, `SITES_`); `package.json` still carries the starter name `site-creator-vinext-starter` and version `0.1.0`.
10. **Dependencies (0.4 point 10).** `package.json` mixes exact pins and caret ranges. The lockfile fixes what is installed. `pnpm-workspace.yaml` adds supply-chain settings: a new package version must be older than `minimumReleaseAge` (10,080 minutes, seven days) and install scripts run only for the packages in `allowBuilds`.
11. **Pull requests and `verify` (0.1 point 3, 0.5, 0.6).** `main` is not protected (CONTRIBUTING.md), so a red `verify` does not block a merge by itself. The `verify` job is skipped entirely for a change that touches only `*.md` files and `docs/**` (`paths-ignore` in `.github/workflows/ci.yml`). A documentation-only pull request therefore shows no check, and `docs:index:check` and `format:check` do not run on it. Run them yourself.
12. **Merging deploys.** 0.6 says not to push to `main` in repositories that deploy from it; here a merge to `main` deploys to the droplet within about three minutes. Agents never merge.
13. **Pull request template.** 0.5 says what a pull request body states. This repository's template, `.github/PULL_REQUEST_TEMPLATE.md`, adds a checklist (no applied migration, curriculum pin, learner evidence or library byte changed; candidates and archive untouched; no credentials; fixtures not run against hosted URLs; paid AI, real recipients and real identity provider still disabled). Fill it in.
14. **Commit identity.** Agents commit as `Claude <noreply@anthropic.com>`, never as the owner (AGENTS.md).

## 1. What this repository is, and where it runs

- Aplyd Academy is a learning application for farmers, MSME owners and public servants. It is a private pilot with synthetic data, not a production system.
- Learners work through pinned draft pathways on fictional source packets, submit evidence, and receive independent review. They also get a personal practice lab and separate shared workspaces for cohorts and staff.
- The code is Next.js 16 on `vinext`, built with Vite for the Cloudflare Workers runtime. Persistence is Cloudflare D1 (SQLite) through seven tables declared with Drizzle in `db/schema.ts`.
- Most learner, course, cohort and submission data is stored as JSON documents inside those tables; a revision number fences every write. The business rules are TypeScript functions in `lib/` that take a state and a command and return a new state.
- Identity comes from request headers the host supplies after sign-in. The application never handles passwords. Access to the site and membership of a workspace are separate gates.
- The same build runs on a shared DigitalOcean droplet behind a Caddy password wall. A timer on the droplet pulls `main` every three minutes, builds, applies new migrations and restarts. Merging to `main` is therefore a release.
- Nothing calls an AI service. Real identity, real partners and real hosting are not connected; "dummy" modules stand in for them and are labelled as dummies.
- The full original product target is preserved under `docs/product-specifications/`. It is not what the code does; `docs/implementation-review-v0.13/` and the newest `docs/as-built-*` folder describe what the code does.
- Current version, hosting state, CI state and pending owner gates: the status block at the top of [HANDOVER.md](../../HANDOVER.md). Nothing else is authoritative for them.
- The repository's own non-negotiables are in [AGENTS.md](../../AGENTS.md). If this guide and AGENTS.md ever disagree, AGENTS.md wins.

## 2. First hour for a newcomer

Durations below were measured on 9 October 2026 on a slow shared Linux sandbox with dependencies already installed. Expect shorter on a laptop.

**Minutes 0 to 15: read.** In order: [AGENTS.md](../../AGENTS.md) (5 minutes), the status block of [HANDOVER.md](../../HANDOVER.md), this guide's sections 3, 5 and 9, then the "Current state" and v0.17.0 sections of [CLAUDE-HANDOFF.md](../CLAUDE-HANDOFF.md). The rest of that handoff is the original text, kept as written.

**Minutes 15 to 25: set up.**

```
node -v                       # needs >= 22.13 (package.json engines); 22.22.0 was used here
corepack enable               # makes the pinned pnpm 11.25.0 available (packageManager in package.json)
git clone https://github.com/nakul175/aplyd-academy.git && cd aplyd-academy
git fetch origin main && git switch -c docs/my-topic-2026-10-09 origin/main
pnpm install --frozen-lockfile    # what CI runs
```

`pnpm run install:ci` is the documented alternative (`bash scripts/install-pnpm.sh`). It wraps pnpm with the Sites runtime store and needs Linux `flock`, GNU `timeout` and Node; it will refuse on a Mac. I did not run either install command (node_modules was linked from an existing checkout), so their timing is unverified.

**Minutes 25 to 45: prove the checkout is healthy.** Run these in order. Each should end as shown.

| Command | What you should see at the end | Measured |
|---|---|---|
| `pnpm run typecheck` | `$ tsc --noEmit` and nothing else, exit 0 | about 20 s |
| `pnpm run build` | `Build complete. Run \`vinext start\`` after a route list that includes the `/api/...` routes | about 25 s |
| `pnpm test` | `OK: N suite file(s) and the guard suite passed.` with the spec reporter showing 0 failures in both runs | about 75 s |
| `pnpm run format:check` | `All matched files use Prettier code style!` | about 35 s |
| `pnpm run docs:index:check` | `docs/DOCUMENTATION-INDEX.md is current (N files).` | about 3 s |
| `pnpm run lint:baseline` | `eslint: N errors (baseline N), ...` with N equal to the baseline | 45 s of CPU, 2 to 3 minutes elapsed here |

`pnpm run lint` shows every problem; `lint:baseline` only compares the count.

**Minutes 45 to 60: look at it run.**

- `pnpm run dev` starts the Vite dev server on port 5173 with a local sign-in simulator (it prints `Sites local sign-in: seedy@sites.test`). In my check the port was already taken by another process, so I saw the start-up banner but did not load the page; treat the page load as unverified.
- `bash scripts/demo/run-demo.sh` builds, creates a fresh demo database under `.wrangler/demo-state`, seeds a fictional workspace and starts a role-switching proxy at `http://127.0.0.1:8788/`. Loopback only. The script calls `npm run build` internally; it was not run end to end for this guide. It rewrites two tracked files, `scripts/demo/demo-identities.json` and `scripts/demo/seed-summary.json`; do not commit those changes.
- Never point any test or demo fixture at `https://academy.aplyd.org` or any hosted URL. The fixtures send synthetic identity headers.

## 3. Map of the repository

Everything tracked in git is listed. Folders that git ignores (`node_modules/`, `dist/`, `.next/`, `.vinext/`, `.wrangler/`, `.sites-runtime/`, `tsconfig.tsbuildinfo`) are build output; never commit them.

### 3.1 Top level

| Path | What lives there | Never put there |
|---|---|---|
| `README.md`, `AGENTS.md`, `CLAUDE.md`, `HANDOVER.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `LICENSE` | The eight root documents. `HANDOVER.md` starts with the status block. `CLAUDE.md` is a short pointer. | Any other `.md` file; a second status statement |
| `app/` | UI and route handlers (Next app router). See 3.2. | Business rules; shared helpers (those go in `lib/`) |
| `lib/` | Domain logic, one `academy-<topic>.ts` per topic, plus pinned curriculum JSON. See 3.3. | Imports from `app/`; `cloudflare:workers`; React |
| `db/` | `schema.ts` (the seven tables) and `index.ts` (a Drizzle factory that nothing calls) | Queries; business rules |
| `drizzle/` | Generated additive SQL migrations `0000` to the latest, plus `meta/` (journal and snapshots) | Hand edits to an applied file |
| `components/` | `components/ui/` is vendored shadcn code; `connector-error.tsx` is platform glue | Academy features (they go in `app/`) |
| `hooks/` | `use-mobile.ts`, vendored from shadcn | New app hooks (put them beside the component in `app/`) |
| `public/` | `favicon.svg` and `public/library/`: 20 original Word, PDF and PowerPoint files, byte-for-byte | Any edit, re-save, rename or re-export of a library file |
| `vendor/` | Vendored shadcn Tailwind stylesheet and licence | Edits |
| `build/` | Platform glue: `sites-worker.ts` (the Worker entry named in `vite.config.ts`), the Vite plugin, connector preview | Application code |
| `scripts/` | Tooling: test runner, lint ratchet, documentation index, curriculum generator, install and environment scripts, `demo/`, `connector-preview/` | Anything the application imports |
| `tests/` | Node tests, builders, browser and API harnesses, per-topic `*-qa/` folders. See 3.4. | Screenshots, logs, run output (git-ignored) |
| `deploy/` | The droplet kit: `provision.sh`, `update.sh`, `add-user.sh`, `Caddyfile`, systemd units, `README.md` | Secrets, tokens, IP-specific private data |
| `docs/` | All documentation except the eight root files. See 3.6. | Source code; generated mirrors |
| `.github/` | `workflows/ci.yml` (job `verify`), `PULL_REQUEST_TEMPLATE.md`, `CODEOWNERS` (records ownership only; branch protection is not configured) | Other workflows without the owner's word |
| `.openai/hosting.json` | Binding name for the database (`DB`) and the old hosted Site's project id | Edits |
| `.lint-baseline.json` | The lint ratchet: `errors`, `warnings`, `updatedAt` | Hand edits (use `node scripts/lint-baseline.mjs --update`) |
| `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `eslint.config.mjs`, `tsconfig.json` | Formatting, lint and type configuration | Loosened rules |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc` | Dependencies and pnpm policy (see 0.8 point 10) | A hand-edited lockfile |
| `vite.config.ts`, `next.config.ts`, `postcss.config.mjs`, `drizzle.config.ts`, `components.json`, `cloudflare-env.d.ts` | Framework, Tailwind, Drizzle (`out: ./drizzle`, schema `./db/schema.ts`, dialect `sqlite`), shadcn aliases, and the `Env` type (`DB`, `BUCKET`) | Secrets |
| `.env.example` | Names of environment variables, no values | Values |

### 3.2 `app/`

- `page.tsx` is the single page: it calls `requireChatGPTUser` (redirects to sign-in when there is no identity) and renders `academy.tsx`, the client shell. `layout.tsx` is the root layout; `globals.css` is Tailwind.
- `academy.tsx` is the client shell and view router. `academy-<area>.tsx` hold one area each (learning, plan, authoring, teams UI, support, library, offline, onboarding, reports, and so on). `academy-ui.tsx`, `academy-context.tsx` and `academy-views.tsx` are shared client pieces.
- Plain `.ts` files beside them are browser helpers, not routes: `academy-download.ts`, `academy-response.ts` (response parsing that never echoes a body), `academy-record-client.ts`, `academy-acceptance.ts`.
- `*.module.css` files (seven) are CSS modules for the component of the same name.
- `chatgpt-auth.ts` is the only reader of the identity headers (`oai-authenticated-user-*`). Every route and server page gets the user from it.
- `join/page.tsx` accepts an invitation link. `verify/[token]/page.tsx` and `verify/lookup.ts` are the public credential check.
- `api/` holds 13 route handlers: `academy` (the personal lab: GET state, POST command), `academy/audit`, `academy/export`, `academy/records/check`, `teams` (shared workspaces), `teams/audit`, `teams/history`, `teams/org`, `partner/links`, `partner/enrol`, `partner/deliver`, `partner/verify/[token]`, `verify/[token]` (public, read-only). Documented from source in `docs/implementation-review-v0.13/api-contracts.json` and `docs/governance/api-contract.md`.

### 3.3 `lib/`

- Domain modules are named `academy-<topic>.ts`. The centre is `academy-engine.ts` (personal workspace state and `applyCommand`) and `academy-teams.ts` (shared workspaces, roles, invitations, `applyTeamCommand`). Others: `academy-curriculum.ts` (pinned content), `academy-plan.ts`, `academy-authoring.ts` (private content studio), `academy-assessment-rules.ts` (retry limit, appeal window, as data), `academy-credential*.ts`, `academy-reports.ts`, `academy-audit-detail.ts`, `academy-storage.ts`, `academy-personal-storage.ts` (size ceilings), `academy-library.ts` (the library manifest with SHA-256 per file) and `academy-partner-dummy*.ts`.
- `.mjs` plus `.d.mts` pairs (`academy-weekly-review`, `academy-learner-guidance`, `academy-before-start`, `academy-content-readiness-adoption`, `academy-partner-review-pack`) are plain JavaScript modules that tests import directly without a build.
- `http.ts` holds the shared route helpers (3.5). `utils.ts` holds `cn()` for class names. `connector-*.ts(x)` and `connectors.ts` are platform glue; leave them alone.
- `curriculum.json` and `curriculum-versions/*.json` are the pinned content archives. Never edit, reformat or regenerate them casually (section 8.3).
- Layer rule, verified by search on 9 October 2026: `lib/` does not import `app/` and does not import `cloudflare:workers`. Database access happens in route handlers (`env.DB.prepare(...)`) and in `app/verify/lookup.ts`; `lib/` receives a database as an argument when it needs one.

### 3.4 `tests/`

- `tests/*.test.mjs` and `tests/<topic>-qa/*.test.mjs` run under `node:test`. `scripts/test.mjs` finds every `*.test.mjs` under `tests/` on its own; a new test file needs no registration.
- A test usually imports a bundle from `.sites-runtime/` (git-ignored) that a builder produced from the real `lib/` sources with esbuild. The builders are listed in the `BUILDERS` array of `scripts/test.mjs` and run before the suites. `tests/build-domain-tests.mjs` builds the nine core bundles: engine, teams, storage, curriculum, plan, ecosystem-guard, authoring, support, operations.
- Each `tests/<topic>-qa/` folder holds one feature's evidence: usually `build-model.mjs` plus `<topic>.test.mjs`.
- `tests/exact-offering-qa/read-only-routing.test.mjs` is the 80-case routing guard. `tests/exact-offering-qa/read-only-routing.mjs` is the helper that makes browser harnesses refuse any request that is not a same-origin GET or HEAD.
- Files that are not `*.test.mjs` (for example `tests/api-integration.mjs`, `tests/teams-api.mjs`, `tests/*-browser.mjs`, `tests/demo-browser-qa/acceptance.mjs`) are harnesses for a running local Worker or a browser. `pnpm test` does not run them.
- Two suites are excluded from `pnpm test` because they rewrite tracked evidence JSON on every run (the `EXCLUDED` map in `scripts/test.mjs` states why). `scripts/demo/test-demo-server.mjs` and `scripts/demo/test-overview.mjs` also sit outside `pnpm test`; run them with `node --test`.
- Output never committed: `tests/**/screens/`, `tests/demo-browser-qa/results.json`, `*.tap`, `*.log`.

### 3.5 Shared helpers (use these, do not re-write them)

| Need | Import | Defined in |
|---|---|---|
| Private-response headers (`Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`) | `NO_STORE_HEADERS` | `lib/http.ts` |
| JSON response with those headers | `noStoreJson(data, status = 200)` (routes alias it as `response` or `respond`) | `lib/http.ts` |
| Cross-site write refusal | `hasForeignOrigin(request)` | `lib/http.ts` |
| The signed-in user | `getChatGPTUser()` (null when absent) or `requireChatGPTUser(returnTo)` | `app/chatgpt-auth.ts` |
| A user-facing rule failure with an HTTP status | `RuleError(message, status = 422)` | `lib/academy-engine.ts` |
| Class names | `cn(...)` | `lib/utils.ts` |
| Pseudonymous audit detail | `pseudonymMap`, `safeDetailJson`, `summarizePersonalCommand`, `summarizeTeamCommand` | `lib/academy-audit-detail.ts` |
| Size ceilings and history split | `ensurePersonalSizing`, `checkMutationBudget`, `separateHistory` | `lib/academy-personal-storage.ts`, `lib/academy-storage.ts` |

The public credential routes use their own `PUBLIC_HEADERS` from `lib/academy-credential-public.ts` because they are not private responses.

### 3.6 `docs/`

- `docs/DOCUMENTATION-INDEX.md` is generated from `git ls-files`; never edit it by hand.
- `docs/current/` holds this guide.
- `docs/governance/` is the 27-document policy bundle (security, privacy, runbooks, release process, threat model, secrets register, ADRs and more). `docs/governance/README.md` maps each topic to one canonical file. The owner has not reviewed documents created on 8 October 2026; they say so.
- `docs/CLAUDE-HANDOFF.md` is the engineering record, newest section first. `docs/release-notes.md` and `CHANGELOG.md` are release narrative.
- The **as-built folders** `docs/as-built-v0.6` to `docs/as-built-v0.15.1` are non-cumulative: each describes only what changed in that version, with its own test evidence. `docs/implementation-review-v0.13/` is the last full as-built review (permission matrix, data dictionary, route contracts). To learn the current behaviour of a topic, start from the newest as-built folder that mentions it, then go back. The newest is the place to add evidence for new work.
- `docs/product-specifications/` is the original target (FSD, HLD, LLD, schema, API, UAT). It is not the implementation.
- `docs/candidates/` and `docs/development-archive/` are preserved research. They are not authority and not active source. Do not edit them.
- Topic documents at `docs/` level (`shared-workspaces.md`, `plans-and-pinned-content.md`, `private-content-studio.md`, `workspace-operations.md`, `networking-and-history.md`, `onboarding-and-registration.md`, `support-and-refresh.md`, `code-loading.md`) describe individual features.
- `docs/test-evidence.json` is validation evidence cited by `README.md`.

## 4. Nomenclature for this repository

Section 0.3 gives the rule. This section gives what the repository actually does, with examples, and the rule going forward where it is inconsistent.

### 4.1 Source files

| Kind | Pattern in use | Example | Going forward |
|---|---|---|---|
| Domain module | `lib/academy-<topic>.ts`, kebab-case | `academy-assessment-rules.ts` | Same. Always the `academy-` prefix in `lib/`. |
| Plain-JS module shared with tests | `lib/academy-<topic>.mjs` with `.d.mts` types | `academy-weekly-review.mjs` | Prefer `.ts` and the builder route. Add `.mjs` only to let a test import without a build. |
| Client area | `app/academy-<area>.tsx` | `academy-onboarding.tsx` | Same. One file per area; it may export several components (`OnboardingFlow`, `JoinInvitation`, `WithoutInvitation`). |
| Client helper (no JSX) | `app/academy-<thing>.ts` | `academy-download.ts` | Same. |
| CSS module | beside its component, `<component>.module.css` | `academy-library.module.css` | Same. |
| Route handler | `app/api/<noun>[/<sub>]/route.ts` | `app/api/teams/history/route.ts` | Nouns, kebab-case. A new route that mutates uses `POST` with a typed `command`, like the existing ones. |
| Platform glue | `connector-*`, `sites-*`, `chatgpt-auth.ts` | `lib/connector-contract.mts` | Do not rename. |
| Vendored | `components/ui/*`, `hooks/use-mobile.ts`, `vendor/*` | `components/ui/button.tsx` | Never edit; they are verbatim shadcn. |

Components: file `kebab-case.tsx`, component `PascalCase` (`OnboardingFlow`). Functions and values `camelCase`. Types `PascalCase` (`Workspace`, `ContentRef`, `Team`). Constants that are true constants `UPPER_SNAKE_CASE` (`MAX_ATTEMPTS`, `APPEAL_WINDOW_DAYS`, `EDITION_PINS`, `TEAM_ROLES`). Errors are classes whose names end in `Error` and that carry an HTTP `status`: `RuleError`, `ContentResolutionError`, `PartnerDummyError`, `PersonalSizingError`, `AuditQueryError`, `AcademyResponseError`.

### 4.2 Commands, ids and routes

- A **command** is a plain object with a kebab-case `type`: `enroll`, `lesson`, `lesson-draft`, `submit`, `assess`, `appeal`, `accommodation-request`, `credential-issue`, `credential-lifecycle`. The personal engine handles them in the `switch` inside `applyCommand`; shared-workspace commands are handled in `applyTeamCommand`. A new command type is a new `case` and a test; audit detail is built by diffing before and after state through whitelists in `lib/academy-audit-detail.ts`, so check that anything you want recorded passes them.
- `actionId`: client-generated, must match `/^[a-z0-9-]{20,80}$/i`. It is the idempotency key stored in the audit table.
- Shared workspace ids start with `tw-` followed by 20 to 80 characters of `[a-z0-9-]`.
- Routes today are not uniform: `/api/academy` and `/api/teams` take a command in the POST body; `/api/academy/records/check`, `/api/partner/enrol` and `/api/partner/deliver` put a verb in the path. New routes: a plural noun path and a `command.type` in the body for mutations; do not invent a new style.

### 4.3 Database

- Tables are prefixed `academy_` and snake_case: `academy_workspaces`, `academy_audit`, `academy_teams`, `academy_team_directory`, `academy_team_audit`, `academy_invite_tokens`, `academy_team_history`. Most are plural; `academy_audit` is singular. Columns are snake_case (`event_id`, `request_hash`, `updated_at`). In TypeScript the Drizzle exports are camelCase (`teamDirectory`, `inviteTokens`).
- Indexes: `idx_academy_<table>_<what>`; checks: `ck_academy_<table>_<what>`.
- Migrations: `drizzle/NNNN_<name>.sql`. Files `0000` to `0005` have generated random names (`0000_strange_dazzler.sql`); `0006_audit_detail.sql` was named by hand. **Going forward every migration gets a topic name**: `pnpm exec drizzle-kit generate --name <topic>` (the `--name` flag exists in drizzle-kit 0.31.10).

### 4.4 Tests and builders

- Test files: `<topic>.test.mjs`; directory `tests/<topic>-qa/` for a feature's evidence; harness scripts `tests/<area>-api.mjs` and `tests/<area>-browser.mjs`.
- Test names say the behaviour, as in section 0.4 point 12: `repeat completion of a completed lesson is refused with a 409 rule error`.
- **Builder scripts.** The `BUILDERS` list in `scripts/test.mjs` has 30 entries with five naming styles: `build-*.mjs` (for example `tests/build-domain-tests.mjs`), `compile-*.mjs` (`tests/compile-offline.mjs`), `bundle-*.mjs` (`tests/operations-qa/bundle-operations.mjs`), `*-compiler.mjs` (`tests/library-test-compiler.mjs`) and, most common, `tests/<topic>-qa/build-model.mjs`. **Going forward:** a new feature gets `tests/<topic>-qa/build-model.mjs` and one line in `BUILDERS`. Do not rename existing builders; as-built evidence and handoff text name them.

### 4.5 Documents

- Governance and handover files: `UPPER-CASE.md` at root and for a few in `docs/` (`CLAUDE-HANDOFF.md`, `DOCUMENTATION-INDEX.md`). Everything else under `docs/` is lower-case kebab (`release-notes.md`, `shared-workspaces.md`). Keep to the convention of the folder you are in.
- **The as-built folders use four naming schemes.** (1) v0.6 to v0.8: `README.txt`, `FSD-v0.X-delta.txt`, `data-dictionary-v0.X.json`, `audit-status.json`. (2) v0.9 and v0.10: `fsd-delta.txt`, `lld-delta.txt`, `operator-acceptance.txt`, `release-status.json`. (3) v0.11: `.md` deltas, `api-and-commands.json`, `evidence-register.json`. (4) v0.12 to v0.15.1: `README.md`, `functional-design.md`, `architecture-and-contract.md`, `data-dictionary.tsv`, `release-evidence.json`, `test-matrix.tsv`, `evidence/`, `screenshots/`. **Going forward use scheme 4** for any new `docs/as-built-v<version>/` folder. Do not rename or reshape the old folders: other documents cite their file names.
- Dates: ISO in file names, "9 October 2026" in prose.

### 4.6 Branches, commits, pull requests

As section 0.3. Recent real branches: `chore/prettier-format-2026-10-08`, `refactor/http-helpers-2026-10-08`, `docs/root-consolidation-2026-10-08`. Commit subjects: `refactor: one set of private-response headers, JSON responder and origin test for the API routes`. History uses merge commits (`Merge pull request #12 from ...`). Environment variables: the app itself needs none; its only binding is the D1 database `DB`. The one optional Worker variable is `ACADEMY_DUMMY_PARTNER_URL` (loopback demo only). Test harnesses use `ACADEMY_*`, the demo proxy `DEMO_*`, the droplet kit `SAHA_*`, tooling `SITES_*` and `WRANGLER_*`. All are listed by name in `.env.example`.

## 5. How to write code here

Section 0.4 is the rule. These are the patterns the code already follows, with short real excerpts. Copy the pattern, not the sloppiness (for example the `any` types).

### 5.1 The shape of a request

1. A route handler in `app/api/**/route.ts` does the input/output: it checks origin, content type and size, parses the body, reads the user, loads state from D1 and writes it back.
2. A function in `lib/` decides: `applyCommand(state, command, now)` returns a new state or throws `RuleError`. It does not touch the database, the clock (the caller passes `now`) or the network.
3. The browser sends a `command` and displays the result. It never decides whether something is allowed.

Why: pure functions are testable without a Worker, and every rule has one home.

### 5.2 An API route

The order matters. This is the real `POST` in `app/api/academy/route.ts`, trimmed:

```ts
import { hasForeignOrigin, noStoreJson as response } from '@/lib/http';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (hasForeignOrigin(request)) throw new RuleError('This action must come from your Academy.', 403);
    if ((request.headers.get('content-type') ?? '').split(';')[0] !== 'application/json')
      throw new RuleError('Use a JSON request.', 415);
    const raw = await request.text();
    if (raw.length > 100000) throw new RuleError('This response is too large.', 413);
    let input: any;
    try {
      input = JSON.parse(raw);
    } catch {
      throw new RuleError('The request is not valid JSON.', 400);
    }
    // ... load the signed-in user and state, check actionId and revision, applyCommand, batch-write ...
    return response({ currentUserId: x.user.userId, state, revision });
  } catch (e) {
    return fail(e);
  }
}
function fail(e: any) {
  if (e instanceof RuleError) return response({ error: e.message }, e.status);
  console.error('Academy request failed');
  return response({ error: 'We could not save or load your work. Keep your response and try again.' }, 503);
}
```

Rules, each with its reason:

- Every private response goes through `noStoreJson` so it cannot be cached or sniffed. Never call `Response.json` directly on a signed-in route.
- Refuse a foreign `Origin` before reading the body. The droplet starts the Worker with the public origin so the check sees the real host (`deploy/README.md`, "Public origin").
- Read the body once as text, cap its size, then parse. A route that reads the body twice or trusts `Content-Length` is a defect.
- Unknown or malformed input is a `RuleError` with a plain-language message and the right status (400, 401, 403, 404, 409, 413, 415, 422, 503). The message is shown to the user, so it says what to do next.
- The catch-all logs a fixed category string, never the error object, and returns a generic 503. Stored data, SQL text and the cause must not reach a log line or a response. `tests/route-errors/` proves this for the personal, shared and record routes.
- Use bound parameters: `env.DB.prepare('... WHERE owner=?').bind(user.userId)`. Never build SQL by concatenating request data.
- Database access is `env.DB` with raw prepared SQL. `db/index.ts` (`getDb`) has no callers; Drizzle is used for the schema and migration generation only.
- Writes that must succeed or fail together use `db.batch([...])`, and the second statement is guarded with `WHERE changes()=1`, as in the audit insert. Afterwards check `results[0].meta.changes === 1`, else answer 409.
- A route is a thin shell. If you are writing a rule in a route file, move it into `lib/`.

### 5.3 Idempotency and concurrency (do not weaken)

Every mutating command carries `actionId` and the client's last `revision`. The server hashes the command (SHA-256 of the JSON), looks up the `actionId` in the audit table, and:

- same `actionId`, same hash: returns the stored state with `replayed: true` (a safe retry);
- same `actionId`, different hash: 409 (`This action reference was already used for a different request.`);
- stale `revision`: 409, the client refreshes and keeps the user's input;
- otherwise applies the command, writes the new state with `revision + 1` and the audit row in one batch.

The rule behind it: never retry an uncertain mutation blindly. If a response is lost, the client re-reads state or re-sends the same `actionId`; it never mints a new one for the same intent.

### 5.4 Identity, authority and isolation

- Identity is only `getChatGPTUser()` in `app/chatgpt-auth.ts`. It reads headers set by the host. Never read `oai-*` headers anywhere else, never accept a user id or email from a request body, and never let an invitation field name the recipient (the platform email is used).
- Personal lab data is keyed by `owner = user.userId` in `academy_workspaces`. Shared workspace data is keyed by team id and reached only after a membership check (`member(team, userId)` in `lib/academy-teams.ts`). A learner's evidence is visible to that learner and to explicitly assigned staff; being an owner or admin is not enough.
- Roles are the `TEAM_ROLES` list: admin, learner, facilitator, assessor, reviewer, moderator. A person cannot review their own submission or decide an appeal on their own original assessment. These prohibitions are in the engine, not the UI.
- Denied reads are masked: a forbidden workspace, token or record returns the same answer as a missing one (`Workspace not found for your account.`, the uniform 404 of the public credential check). Do not add a response that confirms something exists to someone who may not see it.
- Display gating in the browser (for example `lib/academy-extra-views-access.ts`, which says so in its first lines) only hides buttons. The server action behind each view enforces its own check. Never rely on the client.
- Hosting access and Academy membership are two gates. Accepting an invitation must not widen who can reach the site.

### 5.5 A `lib/` module

```ts
/**
 * Published assessment rules as DATA. This module is the single source of truth for the
 * retry limit, appeal window, independence rules, accommodation routes and assessment
 * methods. The engine reads these constants; the UI renders them. Pure: no I/O, no clock.
 */
export const MAX_ATTEMPTS = 3;
export const APPEAL_WINDOW_DAYS = 14;
export const ACCOMMODATION_LIMITS = Object.freeze({ detailMax: 600, reasonMin: 10, maxPending: 3 });
```

Pattern: a header comment saying what the module owns and what it must not do; named exports; frozen data for rules; no hidden state; the caller supplies `now`. A rule that appears in both the UI and the engine lives here once.

Errors in `lib/` are thrown, with a status the route can pass on:

```ts
export class RuleError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}
```

### 5.6 A component

```tsx
'use client';
import { useReducer, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAcademy } from './academy-context';
import styles from './academy-onboarding.module.css';
import { ONBOARDING_STEPS, startFlow, flowReducer, completeCommand } from '@/lib/academy-onboarding';
```

Pattern: `'use client'` at the top of client files; UI primitives from `@/components/ui/*`; shared state through `useAcademy()`; copy, option lists and the decision logic imported from a `lib/academy-<topic>.ts` module (so a test can cover them without a browser); a CSS module only when Tailwind classes are not enough. The component sends a command through the context and shows what the server returns. Responses are parsed with `readAcademyResponse` from `app/academy-response.ts`, which never echoes the received body.

Accessibility is part of the work: keyboard and focus recovery in dialogs, plain-language labels, reading mode. Existing browser harnesses (`tests/plan-accessibility.mjs`, `tests/network-accessibility.mjs`, `tests/library-keyboard.mjs`) show what is checked. No conformance claim exists (`docs/governance/accessibility-statement.md`).

### 5.7 A test

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, freshWorkspace, programs, RuleError } from '../.sites-runtime/engine.mjs';

const p = programs[1];
const apply = (s, c) => applyCommand(s, c, '2026-10-05T12:00:00.000Z');   // fixed clock, never Date.now()
const enroll = () => apply(freshWorkspace(), { type: 'enroll', programId: p.id });
```

Pattern: import the bundle built from the real source (not a copy), pass a fixed ISO timestamp, build state from `freshWorkspace()` through real commands, use only fictional text, assert on behaviour and on the `RuleError` status. Block the network when the suite is pure (`globalThis.fetch = () => { throw ... }`). A bug fix ships with the test that failed before it; the handoff records that 2 of the 4 lesson-recompletion entries fail against the unpatched engine, which is the intended proof.

### 5.8 The gates the owner has not opened

Read the "Pending tests and external dependencies" and v0.17.0 "Decisions waiting for the owner" sections of [CLAUDE-HANDOFF.md](../CLAUDE-HANDOFF.md) before touching any of these. Status lives in the HANDOVER.md status block ("Pending gates").

- **Mutating fictional-fixture workflows.** An automatic approval review rejected launches of local workflows that create fictional learners, drafts and cohorts through the API. The question to the owner was never answered. Do not run such a harness, do not route around the refusal with another tool or agent, and do not infer approval from a broad instruction to develop. Pure, mocked and strictly read-only suites are permitted.
- **Live AI.** No AI provider, SDK, key or URL exists in the code, and none is to be added. Choosing a credential workflow is the owner's decision. "AI drafts" in the curriculum are static teaching text. `docs/governance/ai-features.md` lists what must exist before any AI feature ships.
- **Real partner, real identity, real hosting, real recipients.** The partner, credential issuer and recovery checks are labelled dummies (`lib/academy-partner-dummy*.ts`, `lib/academy-credential.ts`). The app sends no invitation emails; links are copied by hand. Do not wire real ones.
- **Erasure.** Data requests are recorded but erasure is held and never executed until the owner decides a retention policy.
- **Hosted verification.** A local or in-memory pass is never hosted verification. The hosted site was last verified against the version the status block names; do not claim more.

## 6. How to find things

Run from the repository root. `rg` is ripgrep. All commands are read-only.

| I need to ... | Look in | Command |
|---|---|---|
| Find where a command is handled | `lib/academy-engine.ts` (personal) or `lib/academy-teams.ts` (shared) | `rg -n "case 'submit'" lib/academy-engine.ts` |
| List every command type the engine knows | the switch in `applyCommand` | `rg -n "^    case '" lib/academy-engine.ts` |
| Find which route serves a URL | `app/api/<path>/route.ts` | `find app/api -name route.ts` |
| See what a route imports and checks | the route file | `sed -n 1,60p app/api/teams/route.ts` |
| Find a UI screen by its title text | `app/academy-*.tsx` | `rg -n "Support request" app` |
| Find all users of a function before changing it | whole tree | `rg -n "applyTeamCommand" app lib tests scripts` |
| Find the test for a module | `tests/` | `rg -l "sites-runtime/teams" tests` |
| Find who checks a role | `lib/` | `rg -n "roles.includes\|\.roles\b" lib/academy-teams.ts` |
| Read the table definitions | `db/schema.ts` | `sed -n 1,200p db/schema.ts` |
| Read the real SQL a table was created with | `drizzle/` | `rg -n "CREATE TABLE" drizzle/*.sql` |
| Find which migration added a column | `drizzle/` | `rg -n "request_hash" drizzle/*.sql` |
| Find the curriculum pins | `lib/academy-curriculum.ts` | `rg -n "EDITION_PINS\|sha256" lib/academy-curriculum.ts` |
| Find the library file hashes | `lib/academy-library.ts` | `rg -n "sha256" lib/academy-library.ts` |
| Find the retry, appeal and size limits | `lib/academy-assessment-rules.ts`, `lib/academy-storage.ts`, `lib/academy-personal-storage.ts` | `rg -n "MAX_\|_DAYS\|LIMITS" lib/academy-assessment-rules.ts lib/academy-storage.ts lib/academy-personal-storage.ts` |
| Find what is written to the audit log | `lib/academy-audit-detail.ts` | `rg -n "COMMAND_TYPES\|MAX_DETAIL_BYTES" lib/academy-audit-detail.ts` |
| Find an environment variable | `.env.example`, `docs/governance/env-config-reference.md` | `rg -n "ACADEMY_" .env.example app lib` |
| Find a secret's name and owner (never its value) | `docs/governance/secrets-register.md` | `sed -n 1,25p docs/governance/secrets-register.md` |
| Find what changed in a version | the matching `docs/as-built-v*/README.*`, then `docs/release-notes.md` | `ls docs/as-built-*` |
| Find the permission matrix | `docs/implementation-review-v0.13/permission-matrix.tsv` | `head docs/implementation-review-v0.13/permission-matrix.tsv` |
| Find the data dictionary | `docs/implementation-review-v0.13/data-dictionary.tsv`, then each later `as-built` delta | `ls docs/as-built-v0.1*/data-dictionary.tsv` |
| Find a document by topic | the generated index | `rg -n -i "backup" docs/DOCUMENTATION-INDEX.md` |
| Find the canonical document for a topic | `docs/governance/README.md` | `sed -n 40,80p docs/governance/README.md` |
| Find how deploys work and what the droplet runs | `deploy/README.md`, `deploy/update.sh` | `sed -n 1,30p deploy/README.md` |
| Find who owns a path | `.github/CODEOWNERS` | `cat .github/CODEOWNERS` |
| Find when and why a file changed | git | `git log --follow --oneline -- lib/academy-engine.ts` |
| Find a line's author and commit | git | `git blame -L 380,400 lib/academy-engine.ts` |
| Find how a builder wires a test | the builder | `sed -n 1,40p tests/before-start-qa/build-model.mjs` |
| Find what pnpm test runs and skips | `scripts/test.mjs` | `sed -n 1,80p scripts/test.mjs` |
| Find open decisions for the owner | handoff and status block | `rg -n "Decisions waiting" docs/CLAUDE-HANDOFF.md` |

## 7. Commands and gates

### 7.1 Scripts in `package.json`

| Command | What it does | Proves | Does not prove |
|---|---|---|---|
| `pnpm run install:ci` | `bash scripts/install-pnpm.sh`: pinned pnpm with the Sites store (Linux `flock`, GNU `timeout`) | Dependencies match the lockfile | Anything about the code |
| `pnpm run dev` | Vite dev server via `scripts/run-framework.mjs`, port 5173, local sign-in simulator | The app starts locally | Behaviour on the Worker runtime |
| `pnpm run build` | `vinext build` (via `scripts/run-framework.mjs`; the managed-Linux profile uses `build-verified.sh` with a 3 minute bound) into `dist/` | The Worker bundle compiles | Any runtime behaviour |
| `pnpm start` | `wrangler dev --local` against `dist/server/wrangler.json`, state in `.wrangler/state`; the API harnesses expect it on port 8787 (wrangler's default; I did not start it for this guide, so unverified) | The built Worker serves locally | Hosted behaviour |
| `pnpm run typecheck` | `tsc --noEmit` | No type errors, strict mode | Correct logic |
| `pnpm run lint` | ESLint over everything, shows every problem | Nothing alone | |
| `pnpm run lint:baseline` | ESLint, then compares the error count with `.lint-baseline.json`; fails only if errors rose | No new lint errors | That the old ones are fine |
| `node scripts/lint-baseline.mjs --update` | Rewrites the baseline with today's counts | Use only after real fixes | Never to excuse new errors |
| `pnpm test` | See 7.2 | Pure model and domain behaviour, routing guard | Browser, hosted, real database |
| `pnpm run format` / `format:check` | Prettier write / check over the whole repository (minus `.prettierignore`) | Style | |
| `pnpm run docs:index` / `docs:index:check` | Regenerate / verify `docs/DOCUMENTATION-INDEX.md` from `git ls-files` | Every tracked doc is indexed | That documents are true |
| `pnpm run db:generate` | `drizzle-kit generate`: diff `db/schema.ts` against `drizzle/meta`, write a new migration | The SQL exists | That it is safe: read it |

Other scripts: `node scripts/build-curriculum-0.2.mjs` regenerates the two 0.2 edition files from the 0.1 archive and rewrites them in place. I ran it on 9 October 2026 and it produced byte-identical files (`git status` stayed clean), so it is deterministic; still, run it only when you mean to, and expect hashes to change if you change its inputs. `scripts/curriculum-0.2-hindi.mjs` holds the Hindi strings it imports. `scripts/demo/*` is the local demo (3.4 and section 2). `scripts/connector-preview/*`, `scripts/pnpm-install.mjs`, `scripts/sites-env.*`, `scripts/execution-profile.mjs` and `scripts/build-verified.sh` are platform tooling.

### 7.2 What `pnpm test` does

`scripts/test.mjs`, in three steps:

1. Run every builder in `BUILDERS` (esbuild bundles of the real `lib/` code into `.sites-runtime/`; nothing tracked is written).
2. Run every `tests/**/*.test.mjs` except the `EXCLUDED` ones under `node --test` with `--experimental-transform-types`. On 9 October 2026 that was 996 passing entries across 61 files.
3. Run the 80-case read-only routing guard on its own, counted separately.

Options: `node scripts/test.mjs --no-build` reuses existing bundles; `node scripts/test.mjs engine plan` runs only suites whose path contains a word (the guard still runs). After editing a `lib/` file you must rebuild (do not use `--no-build`), or tests run against the old bundle.

It proves the model and domain rules, curriculum and library byte pins, route error sanitising against in-memory stubs, and the guard that browser harnesses cannot write. It does not prove: browser behaviour, accessibility in a real browser, a real D1, the Worker runtime, concurrency, the droplet, or any hosted state. It does not apply every migration to a database (one test, `tests/audit-detail-qa/migration.test.mjs`, applies migration 0006 with a shim).

### 7.3 CI (`.github/workflows/ci.yml`)

One job, `verify`, on `ubuntu-latest`, Node 22, 30 minute limit. It runs on pull requests and on pushes to `main`, and can be started by hand. It is skipped for changes that touch only `**.md` or `docs/**`. A newer run on the same ref cancels an older one. Steps in order: checkout; `corepack enable`; `pnpm install --frozen-lockfile`; `lint:baseline`; `docs:index:check`; `format:check`; `typecheck`; `build`; `test`.

CI does not run: the browser and API harnesses, dependency audit (`audit=false` in `.npmrc`), secret scanning, accessibility checks, migrations on a real database, or deploys. `main` is not protected, so a red check does not stop a merge by itself. The merge button is the owner's.

### 7.4 The sequence to be green before a pull request

Run from a clean branch off current `origin/main`, and again after your last edit:

```
pnpm run format:check      # fix with: pnpm exec prettier --write <your changed files>
pnpm run typecheck
pnpm run lint:baseline
pnpm run docs:index:check  # if you added, moved or retitled a document: pnpm run docs:index
pnpm run build
pnpm test
git status --short         # nothing unexpected: no .sites-runtime, no dist, no evidence rewritten
```

Then, if your change touches what a harness covers (routing, workspaces, plan, support, library, offline, partner), run the matching harness by hand against a local Worker and say so. Say in the PR what you did not run. A documentation-only change gets no CI, so run `format:check` and `docs:index:check` yourself.

## 8. Common tasks, step by step

Every task starts the same way: `git fetch origin main && git switch -c <type>/<topic>-<yyyy-mm-dd> origin/main`, and ends with section 7.4 and a draft pull request.

### 8.1 Add an API route

1. Decide whether it needs a route at all. A new learner action is usually a new `case` in `applyCommand` on the existing `/api/academy` or `/api/teams` route.
2. Put the rule in a `lib/academy-<topic>.ts` function that takes state and input and returns a result or throws `RuleError`.
3. Create `app/api/<noun>/route.ts` (a dynamic segment is a folder named `[token]`). Add `export const dynamic = 'force-dynamic';`.
4. Follow 5.2 exactly: `hasForeignOrigin`, content type, size cap, parse, user (`getChatGPTUser`, 401 when null), `env.DB` present (503 when not), bound SQL, `noStoreJson`, fixed-string catch.
5. If it mutates: `actionId`, `revision`, request hash and the batched audit row as in 5.3. Add a whitelisted entry for what to record in `lib/academy-audit-detail.ts`; free text must never reach the audit.
6. Test the rule in `lib/` with a `.test.mjs`. Add a route case to `tests/route-errors/` if the route reads stored JSON.
7. Update `docs/governance/api-contract.md` and describe the route in the newest as-built folder (or a new one, scheme 4).
8. Remember a merge deploys. Hold the route behind the owner's decision if it touches a pending gate (5.8).

### 8.2 Add a table or column (a migration)

1. Edit `db/schema.ts`. Keep names snake_case and `academy_`-prefixed (4.3). Everything in a migration is additive: add tables, columns and indexes; never drop, rename or retype.
2. `pnpm exec drizzle-kit generate --name <topic>`. (`pnpm run db:generate` also works but gives a random name.) Commit the new `drizzle/NNNN_<topic>.sql`, the new `drizzle/meta/NNNN_snapshot.json` and the changed `drizzle/meta/_journal.json` together.
3. Read the SQL. If it recreates a table or drops anything, stop and redesign.
4. Never edit an applied migration. The droplet applies each `drizzle/*.sql` file once, in name order, and records it in `/var/lib/aplyd-academy/applied-migrations.txt`; an edited old file is never re-run, so the droplet and a fresh clone would diverge. There are no down migrations. Undo means a new additive migration.
5. Add a test that applies it (see `tests/audit-detail-qa/migration.test.mjs` and its `d1-shim.mjs`).
6. Update `docs/governance/data-dictionary-and-migrations.md` (the migration table) and the data dictionary in the newest as-built folder.
7. Remember: the migration runs on the droplet within about three minutes of merge, before you can review the result. Test on a local fresh database first (`scripts/demo/run-demo.sh` applies all `drizzle/0*.sql` to a throw-away state).

### 8.3 Add a curriculum item without changing any pin

The pinned archives are immutable. `lib/curriculum-versions/0.1-review-draft.json` (also `lib/curriculum.json`, same bytes), `0.2-review-draft.json` and `0.2-review-draft-hi.json` each have a SHA-256 and byte length in `EDITION_PINS` in `lib/academy-curriculum.ts`; tests recompute them (`tests/curriculum.test.mjs`, `tests/content-qa/content-qa.test.mjs`). A saved enrollment or cohort holds an exact reference (scope, program, version); an unavailable exact source stays unavailable, never "upgraded".

So: you do not add an item to an existing edition. You add a new edition.

1. Create a new file `lib/curriculum-versions/<new-version>.json`, either by hand or by a deterministic generator in `scripts/` modelled on `scripts/build-curriculum-0.2.mjs` (which reads 0.1 and only writes the new files). Keep it out of Prettier (the folder is already ignored) and keep content synthetic and labelled a review draft.
2. Compute its SHA-256 and byte length. In `lib/academy-curriculum.ts`, import it, add a version constant and an `EDITION_PINS` entry, and register it in the registry the same way the 0.2 editions are.
3. Do not change `CONTENT_VERSION` (the default for new enrollments). Making a new edition reachable by real enrolments is an owner decision (v0.17.0 decision 3 in the handoff).
4. Extend `tests/content-qa/content-qa.test.mjs` with the new pin and assert the old three hashes are unchanged.
5. Run `pnpm test` and confirm `tests/curriculum.test.mjs` still passes unchanged: `9fc83c8d...78b7e4` is the 0.1 hash and must never move.
6. The 64 KiB per-pathway limit applies to English editions that can be copied into a private studio.

Library files in `public/library/` follow the same logic: never modify one; a new file is added with its hash in `lib/academy-library.ts`, and `tests/library-manifest-check.mjs` checks bytes and hashes.

### 8.4 Add a page or screen

1. A new top-level URL is `app/<name>/page.tsx` as a server component that calls `requireChatGPTUser(returnTo)` first (see `app/page.tsx` and `app/join/page.tsx`).
2. A new area inside the existing app is `app/academy-<area>.tsx` (client component), a decision/copy module `lib/academy-<area>.ts`, wired into `academy.tsx`/`academy-views.tsx`. Put every rule and string list in `lib/`.
3. Decide visibility on the server too: if only some roles should see it, add the check in the route that serves its data, and use an access helper like `lib/academy-extra-views-access.ts` only to hide the link.
4. Test the `lib/` module. Add keyboard and focus behaviour to an existing accessibility harness if you add a dialog.
5. Update the newest as-built `functional-design.md`.

### 8.5 Add a test

1. A pure rule in an existing core module (engine, teams, storage, curriculum, plan, ecosystem-guard, authoring, support, operations): create `tests/<topic>.test.mjs` importing from `../.sites-runtime/<name>.mjs`. No registration is needed; `scripts/test.mjs` discovers it.
2. A rule in another `lib/` file: create `tests/<topic>-qa/build-model.mjs` (esbuild entry exporting what you need; copy `tests/before-start-qa/build-model.mjs`), the test file beside it, and add the builder path to `BUILDERS` in `scripts/test.mjs`.
3. A plain `.mjs` in `lib/`: import it directly, as `tests/learner-guidance.test.mjs` does.
4. Use a fixed clock, fictional text and no network. Name the test by behaviour.
5. Run `node scripts/test.mjs <word>` then the full `pnpm test`.
6. If your test writes evidence files, it does not belong in `pnpm test`: add it to the `EXCLUDED` map with the reason, or stop it writing tracked files.

### 8.6 Change a document

1. Find the canonical document for the topic (`docs/governance/README.md`). Edit that one; link from elsewhere rather than copying.
2. Never edit a preserved file: `docs/candidates/`, `docs/development-archive/`, an old `docs/as-built-*` or `docs/implementation-review-v0.13/` file, anything in `docs/product-specifications/`. A correction is a new line in a current document, or a new as-built folder.
3. New or moved or retitled document: `pnpm run docs:index`, commit the result. Do not hand-edit `docs/DOCUMENTATION-INDEX.md`.
4. Governance documents carry owner, last-reviewed date and an update trigger; update the date when you review.
5. Do not copy a count, version or date of "current state" into a second place. Link to the status block.

### 8.7 Update the status block

When version, hosting, CI, evidence or pending gates change (a deploy, a new gate, a decision by the owner), edit the table at the top of `HANDOVER.md` and its "verified on <date> against ..." line. State only what you checked; keep one row per item; link to detail rather than pasting it. Read the lint count from `.lint-baseline.json`, not from memory. After any merge to `main`, re-read it and fix what is no longer true. Also update `docs/CLAUDE-HANDOFF.md` with a dated section if you changed behaviour; do not rewrite earlier sections.

### 8.8 Add a dependency

1. Search first: `package.json` already has React, zod, date-fns, Radix, Recharts, Tailwind and more. Prefer the platform and the standard library.
2. `pnpm add <pkg>@<exact version>`. The version must be at least seven days old (`minimumReleaseAge`). If the package needs an install script, it must be allowed in `pnpm-workspace.yaml` `allowBuilds`, which is the owner's call.
3. Commit `package.json` and `pnpm-lock.yaml` together. Never hand-edit the lockfile.
4. Say in the pull request why it is needed and what you looked at instead. Update `docs/governance/third-party-inventory.md` and note the SBOM in `docs/governance/sbom/` is stale until regenerated.
5. Confirm `pnpm run build` still works: the target is the Workers runtime, so Node-only packages can fail at runtime and not at install.
6. Never add an AI SDK or provider client (5.8).

## 9. Do and don't for this repository

### Do

- Branch from current `origin/main`, one purpose per branch, draft pull request, `Claude <noreply@anthropic.com>` as the commit identity for agents. Reason: a merge deploys.
- Read the touched file and its test first, then `rg` for an existing helper. Reason: sha256 and `fail` are already duplicated; do not add more.
- Keep rules in `lib/` and make them pure with a passed-in `now`. Reason: they can be tested in milliseconds and cannot read the clock or the database by accident.
- Return plain-language errors with the correct status, log only fixed strings. Reason: logs and responses are a leak path for private learner text.
- Use bound parameters and the revision plus `actionId` fence for every write. Reason: it is what makes retries safe and concurrent edits visible.
- Write tests with fixed timestamps and fictional text. Reason: reproducible, and no real data enters git.
- Add migrations as new numbered, named, additive files, and inspect the SQL. Reason: the droplet applies each once and never again.
- Say exactly what you ran and what you did not, with results, in the pull request. Reason: "verified" is a claim about the world.
- Update the newest as-built folder, the data dictionary and the governance map when behaviour changes. Reason: the next engineer starts from them.
- Lower `.lint-baseline.json` when you fix errors in files you touch (`node scripts/lint-baseline.mjs --update`). Reason: the ratchet only works if gains are locked in.
- Treat "dummy" modules as dummies in every sentence you write about them. Reason: no real issuer, partner or identity provider exists.
- Run `pnpm exec prettier --write` on the files you changed, and only those.

### Don't

- Don't edit `lib/curriculum.json`, anything in `lib/curriculum-versions/`, any applied `drizzle/*.sql` or `drizzle/meta/*`, or anything in `public/library/`. Reason: pins, learner records and library hashes are byte-bound; a changed byte invalidates saved enrollments and evidence.
- Don't reformat those files either, and don't let an editor "save" a library Word/PDF/PowerPoint file. Reason: a re-save changes bytes.
- Don't edit `docs/candidates/`, `docs/development-archive/`, old as-built folders or `docs/product-specifications/`. Reason: preserved research and evidence; corrections append.
- Don't push to or merge `main`. Don't "just fix it on main". Reason: the droplet deploys it in three minutes with no gate.
- Don't point any harness, demo identity or fixture at `https://academy.aplyd.org` or any hosted URL. Reason: they send synthetic identity headers and mutate data. Loopback only.
- Don't run mutating fictional-fixture workflows or bypass the refusal (5.8).
- Don't add a paid AI call, an AI SDK, a real email or messaging call, or a real identity or partner integration. Don't widen who can reach the site.
- Don't trust the client: no authorisation, ownership or validation that exists only in a React component. Reason: anyone can send any request.
- Don't read identity from anywhere but `app/chatgpt-auth.ts`; don't accept a user id, email or role from a request body.
- Don't add a response that confirms a record exists to someone who may not read it. Reason: existence oracles were found and fixed once (BR-39).
- Don't copy the audit-log pattern to include free text, emails, tokens or names. Reason: audit detail is a strict whitelist by design.
- Don't retry a mutation with a new `actionId` after an uncertain failure.
- Don't add a root-level `.md`, a second status statement, or a copied count or version. Reason: one place per fact.
- Don't commit `.env*`, secrets, databases, `.wrangler/`, `dist/`, `.sites-runtime/`, screenshots, logs, run output or a symlinked `node_modules`. Reason: git history is permanent.
- Don't add `any`, `@ts-ignore`, `eslint-disable` or a rule exception to get green; don't raise the baseline; don't weaken or delete a test to pass. Reason: the ratchet exists so debt only goes down.
- Don't reformat or restructure unrelated code in your pull request. Reason: reviewable diffs. (The old "never reformat minified lines" rule is withdrawn; Prettier is the standard, but only on files you are changing.)
- Don't run `node scripts/build-curriculum-0.2.mjs` or `scripts/demo/seed.mjs` casually. The first overwrites tracked curriculum files; the second rewrites tracked demo fixtures.
- Don't restart the previous scheduler. The owner handed development to Claude.
- Don't describe the pilot as production, a hosted or local run as the other, or a pending gate as open.

## 10. Keeping it clean

### 10.1 Rules that stop mess coming back, and what enforces each

| Rule | Enforced by | Not enforced (you are the check) |
|---|---|---|
| Lint errors only go down | `lint:baseline` in CI | Warnings (recorded, not gated) |
| Code is Prettier-formatted | `format:check` in CI | Files in `.prettierignore` |
| Types compile (strict) | `typecheck` in CI | `any` inside the tolerated set |
| The app builds for Workers | `build` in CI | Runtime behaviour |
| Model and domain rules hold; curriculum and library bytes are pinned; browser harnesses stay read-only | `pnpm test` in CI | Browser, hosted, database behaviour |
| Every tracked document is in the index | `docs:index:check` in CI | Whether the document is true; docs-only PRs skip CI |
| Applied migrations are not edited | Review, `CODEOWNERS` entry for `/drizzle/` (ownership only) | Nothing automatic |
| No secrets or real data in git | Review; `.gitignore` for `.env*` | No secret scanner exists |
| One status statement | Review | Nothing automatic |
| No pushes to `main` | Owner discipline; no branch protection | A red check does not block a merge |
| No hosted fixtures | AGENTS.md and the PR checklist | Nothing automatic |

The honest summary: CI catches formatting, types, lint growth, build and model regressions. It does not catch a stale document, a leaked secret, an edited migration, or a bad merge. Those depend on the checklist in the PR template and on you.

### 10.2 Habits

- Delete what you replace in the same pull request. No commented-out code, no `-old` or `-v2` files, no unused exports left behind. Git remembers.
- Evidence is hashes and manifests in git; screenshots and run output live outside it.
- A document that stops being true is corrected or moved (to `docs/history/` if it is new, left in place if it is a preserved as-built or archive), never left to mislead.
- Leave the checkout clean: `git status --short` shows only your intended changes.
- Update the status block when you leave (section 0.7).

### 10.3 Monthly hygiene checklist (about ten minutes)

Run on a fresh branch from `origin/main`. Fix what is small; list what is not in the status block's open items.

1. `git fetch origin && git status --short && git branch -r --merged origin/main` — no stray files; list merged remote branches that can be deleted (the owner deletes them).
2. `cat .lint-baseline.json`, then `pnpm run lint:baseline` — is the count the same or lower? If lower, run `node scripts/lint-baseline.mjs --update` and commit.
3. `pnpm run docs:index:check` — current? If not, `pnpm run docs:index`.
4. `rg -n "TODO|FIXME|XXX" app lib db scripts deploy` — each has an owner and a date, or is removed.
5. `rg -c "subtle.digest" app lib` and `rg -n "function fail|const fail" app/api` — has the duplicate count grown? It must not.
6. `git ls-files | rg "\.(log|tap|zip|png|jpg|mov|mp4|sql\.bak)$"` — nothing new that is not intended (the library and `docs/` screenshots are known).
7. `git ls-files | rg -i "old|final|copy|backup|v2" | rg -v "^docs/"` — no stray versions in source.
8. `pnpm outdated` and `pnpm audit` if the network allows — note findings; do not upgrade in this pass.
9. Read the HANDOVER.md status block against `deploy-status.json` on the droplet (the owner can read it) and CI on `main`; fix any row that is no longer true.
10. Open `docs/governance/secrets-register.md` and `third-party-inventory.md`: any token due to expire (the fine-grained deploy token expires, by default after 30 days) or dependency added since?

## 11. Glossary

| Term | Meaning here |
|---|---|
| Academy | The product. Also "the pilot". Not the full original target. |
| Pilot | The implemented private version: synthetic data, named testers, no real learners. |
| Pathway / program | A pinned course of lessons (three in the original edition). Code calls it `program`; the UI says pathway. |
| Edition / content version | One immutable curriculum archive, such as `0.1-review-draft`. Identified by version id and SHA-256. |
| Pin | The exact reference (scope, program id, version id) an enrollment or cohort holds, so content never changes under a learner. |
| Content scope | `global` or a workspace's `tw-...` id. A private copy lives in a workspace. |
| Command | A JSON object with a `type` that asks the server to change state (`enroll`, `submit`, ...). |
| `applyCommand` | The pure function in `lib/academy-engine.ts` that applies a personal-workspace command. Shared workspaces use `applyTeamCommand`. |
| `RuleError` | The error class for a refused action; carries the HTTP status and a plain-language message. |
| Revision | An integer on each stored document. A write must present the current one or get 409. |
| `actionId` | Client-generated id of one intended action; with the request hash it makes a retry safe. |
| Aggregate | A whole learner, course, cohort or submission collection stored as one JSON document, not as rows. |
| Personal lab | A learner's private practice space with sample staff roles. Never becomes a shared workspace. |
| Shared workspace / team | A separate space (`tw-...`) with members, roles, cohorts and its own audit. Code says `team`. |
| Cohort | A group within a workspace taking a pinned edition together. |
| Independent review | Assessment by a different signed-in person from the learner; self-review and original-assessor appeals are forbidden. |
| Critical gate | A rubric item that fails the practical regardless of other scores (for example an unsupported claim kept in). |
| Appeal | A learner's request for second review within the appeal window (`APPEAL_WINDOW_DAYS`). |
| Fictional source packet | Synthetic facts a learner works from; supplied AI drafts are static teaching text. |
| Nonaccredited record | A practice record with review provenance. Not a certificate from a recognised body. |
| DUMMY issuer / partner | Labelled stand-ins (fixed public demo key) for a real credential issuer or partner. Not real. |
| Audit detail | The whitelisted who-changed-what summary stored with each audit row (BR-46). |
| BR-nn | A business requirement number from the original target, cited in code comments and docs. |
| As-built folder | `docs/as-built-v<version>/`: the delta and test evidence for one version. Not cumulative. |
| Builder | A script that bundles real `lib/` source into `.sites-runtime/` for tests. |
| Guard (the 80-case guard) | `read-only-routing.test.mjs`: proves browser harness helpers refuse non-GET/HEAD or cross-origin requests. |
| Baseline | `.lint-baseline.json`: the ceiling on lint errors; it can only fall. |
| Sites | The platform that hosted the earlier owner-private copy; `build/`, `.openai/` and `scripts/sites-*` come from it. |
| Droplet | The shared DigitalOcean server (`saha-apps`) that runs this app behind Caddy and deploys `main`. |
| Status block | The table at the top of `HANDOVER.md`: the one statement of current state. |
| Gate (pending) | A decision only the owner can open: fixture approval, live AI credential, real partner/identity/hosting. |

## 12. Where things stand and what is next

Read the status block at the top of [HANDOVER.md](../../HANDOVER.md). It is the single statement of the current version, hosting state, CI state, evidence and pending gates. The decisions waiting for the owner, and the known gaps, are in the v0.17.0 section of [CLAUDE-HANDOFF.md](../CLAUDE-HANDOFF.md). Every other document is listed in [DOCUMENTATION-INDEX.md](../DOCUMENTATION-INDEX.md). When you leave, make sure all three still tell the truth.
