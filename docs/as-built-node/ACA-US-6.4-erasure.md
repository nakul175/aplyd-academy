# ACA-US-6.4: delete my data (local)

Owner decision, 12 October 2026: keep learner data with no fixed end date unless the law requires otherwise; delete it when the learner explicitly asks. Legal review must confirm the open-ended retention before R1 (Linear APL-2309).

- `/account` → type DELETE MY DATA → `POST /api/account/erase`: deletes the account, sessions, login codes and locks, the personal practice lab, its audit rows and pseudonymous refusal rows, and (local outbox only) mail; then signs the learner out. A dated count goes to `academy_erasures` with nothing that identifies the person.
- Members of a shared team workspace are refused with a clear message: those records include other people's work, so the workspace admin handles them through the existing data-request flow. Not yet built: real erasure inside team workspaces (v0.17 still holds those requests).
- Test: `tests/node-runtime/erasure-browser.mjs`, 11 of 11 on a phone-size browser. The team-member refusal path is not yet covered by a test.
- Regression: 995 of 996 mocked; the one failure is the known intermittent partner-dummy canary test (passes on rerun), not related to this change.
