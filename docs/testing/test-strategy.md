# Test strategy

**Data rule.** Tests use synthetic people, decisions and files only, and run against local in-memory or temporary SQLite and a local server on 127.0.0.1. They never touch the hosted Academy.

| Layer | What | How to run |
| --- | --- | --- |
| Domain rules (practice loop) | Every acceptance criterion with a fixed clock, including refusals and audit | `node --test tests/loop/*.test.mjs` |
| Documents | Data dictionary and API contract match the code; required documents exist | part of the above |
| Browser journey | Operator → admin → expert → learner → facilitator → confirmer on the real Node server at phone width, with WCAG 2.2 AA checks (axe-core) on 23 screens, including the R3/R4 school, guardian, class, sponsor and annotation screens | `QA_TRUST_HEADERS=0 ACADEMY_MAIL_TRANSPORT=outbox ACADEMY_AUTH_SECRET=<32+ chars> ACADEMY_AI_PROVIDER=fake ACADEMY_AI_MODEL=synthetic-model ACADEMY_FILES_PATH=$(mktemp -d) scripts/node-local-qa.sh tests/loop/browser-r1-journey.mjs` |
| Node runtime | Sign-in, erasure, release rollback, backup and restore | `tests/node-runtime/*` |
| v0.17 regression | The earlier pilot's suites (about 1,000 tests) | `scripts/full-regression.sh` |
| Types | `npx tsc --noEmit -p .` | |
| Dependencies | `npm audit --omit=dev` must report 0 high or critical | |

Mutation checks were run by hand on 13 October 2026 (changing the 35% rule and disabling a role check) to confirm the tests fail when a rule breaks.

Not covered automatically: the manual screen-reader walkthrough (`docs/accessibility/screen-reader-check.md`), real email/WhatsApp delivery, and the real AI provider (covered by the evaluation set once AI is approved).
