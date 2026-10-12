# ACA-US-1.2: v0.17 on the Node runtime (local port)

Story: ACA-US-1.2 (Linear APL-2219) · Decision: ADR-0001 Option A (approved by Nakul Jain, 12 October 2026)
Status: **local port done; not accepted.** Nothing is deployed. The production setup on DigitalOcean waits for access, and GitHub returns HTTP 403, so this branch is not pushed.

## What changed

| Change | Files |
| --- | --- |
| `cloudflare:workers` replaced by a Node environment whose `env.DB` is a D1-compatible SQLite database (`node:sqlite`, WAL); route SQL unchanged | `lib/platform-env.ts`, `lib/sqlite-d1.ts`, 14 route/helper imports, `db/index.ts` |
| Standard Next.js Node build (`output: standalone`); `npm run build`, `npm start`, `npm run migrate`, `npm run dev` now use Node; the vinext Worker scripts are removed | `next.config.ts`, `package.json`, `scripts/copy-standalone-assets.mjs` |
| Migration runner: each `drizzle/*.sql` applied once, in order, in a transaction, recorded with its SHA-256; a changed applied file stops the run | `scripts/migrate.mjs` |
| ChatGPT Sites identity headers are **ignored** unless `ACADEMY_TRUST_IDENTITY_HEADERS=1` (local tests only). On Node any client could send them. Until ACA-US-1.4 a Node deployment has no signed-in users | `app/chatgpt-auth.ts` |
| Same-origin checks compare with `ACADEMY_PUBLIC_ORIGIN` (production must set it), else the forwarded host; Next's Node server rewrites `Host` | `lib/request-origin.ts`, 5 routes |
| AC2: a signed-in user refused another workspace (403/404) is recorded in `academy_access_refusals` with a pseudonymous reference, route path, method and status only | `lib/access-refusal-audit.ts`, 3 team routes, migration `0007_access_refusals.sql`, `db/schema.ts` |
| Test seams that stubbed `cloudflare:workers` also stub `platform-env`; the 0006 migration guard is pinned to 0006 and a 0007 guard added | 4 test builders, `tests/audit-detail-qa/migration.test.mjs` |
| Local Node QA runner and AC1/AC2 test | `scripts/node-local-qa.sh`, `tests/node-runtime/refusal-audit.mjs` |

## Results (12 October 2026, local, synthetic users, throwaway database)

- Pure and mocked regression: **996 of 996** pass (the v0.17 set of 995 plus the new 0007 guard); request guards **80 of 80**; TypeScript clean; Node build clean.
- API suites against the Node server: api-integration (70 checks), teams-api (127), ecosystem-api, authoring-api, read-only routing, and the new refusal audit (16 checks): **all pass**.
- Browser suites (Chromium, Linux paths substituted outside the repo): browser-smoke, browser-journey, ecosystem-browser, network-accessibility and responsive-lab **pass**; **2 fail**.

## Failures kept (AC3: no test weakened)

| Test | Failure | Same on the original Worker? | Owner and fix |
| --- | --- | --- | --- |
| teams-browser | Locator `getByText('suspended')` matches two elements (status tag and the demo credential panel) | **Yes** (unchanged v0.17 Worker, same data) | Claude: scope the locator to the status tag; needs Nakul's OK because it edits a test |
| overview-response-browser | Invalid-shape case: the "could not be verified" notice is not shown | **Yes** | Claude: investigate the hardened response path in `app/academy-response.ts` |
| partner-dummy (mocked) | Intermittent: canary string `93` can occur in random IDs (1 of 6 runs) | Not runtime-related | Claude: use a longer canary; needs Nakul's OK because it edits a test |

Neither browser failure is caused by the port: both fail identically on the unchanged v0.17 Worker build.

## Not done in this story yet

- Running on the production setup (AC1 "signs in on a phone"): needs DigitalOcean access, the droplet, TLS proxy and ACA-US-1.4 sign-in.
- Community, recovery and data-request flows were covered only by the existing suites above, not by new Node-specific tests.

Reproduce: `npm run build`, then `scripts/node-local-qa.sh <test files>`; mocked suite: `scripts/full-regression-final.sh` from the working folder.
