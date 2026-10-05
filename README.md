# Aplyd Academy working pilot · v0.2

A durable learning application for farmers, MSME owners and public servants. Learners practise on fictional source packets, check supplied AI drafts, submit practical evidence, receive reasoned feedback and reflect on their work.

## What works

- Three pinned draft pathways, nine lessons and 27 explained quiz checks.
- Saved lesson/practical drafts, sequential progression, immutable submissions, critical-gate rubrics, three attempts and 14-day independent appeals.
- A **personal practice lab** with sample staff roles, private discussion, ecosystem payload simulation, learning export and lab-data deletion.
- Separate **shared workspaces** with account-bound invitations, memberships, scoped staff roles, cohorts, capacity enforcement and withdrawal.
- Explicit assessment/appeal assignments to signed-in accounts. Self-review and original-assessor appeal review are forbidden. Owners/facilitators receive progress summaries without private evidence.
- Cohort discussion with prepublication moderation, restricted reports and reasoned moderation history.
- Nonaccredited practice records with review provenance, adverse-appeal suspension, downloads and learner exports.
- Reading mode, browser read-aloud, saved peer-learning interests and work reflections.

## Access

The hosted site remains owner-private. Platform sign-in provides server-side account identity. **Site access and Academy membership are separate gates:** an Academy invitation cannot change the hosting audience or admit its recipient to the private site. Hosting access must be arranged before a real participant can sign in and accept. Links are copied manually; this app sends no invitation email or other messages.

The personal lab never becomes a shared workspace. Creating/joining a workspace starts fresh and does not copy lab drafts, sample decisions or posts. Shared evidence is limited to its learner and explicitly assigned staff. Ownership alone does not grant evidence access. Members whose access is removed retain read-only access to their own saved learning history and records; they lose discussion and protected actions.

## Persistence and concurrency

D1 stores private owner documents and separate shared-workspace documents. Protected shared operations use one workspace revision and an atomic state/audit batch. Membership revocation, review assignment/finalization, invitations, moderation and seat allocation contend on that same revision. Stale writes are refused and the client refreshes while retaining form input. Action references and request hashes provide durable idempotency; changed-body reuse is refused.

Globally unique invitation-token hashes are indexed in a separate table and committed with the workspace mutation. Tokens expire after seven days, are recipient-email bound, and cannot be reused. An issuer losing owner authority invalidates its outstanding invitations. The platform supplies the email; invitation request fields cannot impersonate a recipient.

This is a bounded pilot architecture: up to ten created workspaces per account, 100 members, 20 cohorts and 200 historical invitations per workspace, one megabyte per personal lab and 1.5 megabytes per shared workspace. Aggregate contention and membership-directory scanning require a normalized repository before large cohorts or broad rollout. No load-capacity claim is made.

## Development and verification

Use the configured Node/npm runtime and retained Sites installer/build workflow. `npm run dev` opens the local sign-in simulator. Generate additive D1 schema changes with `npm run db:generate`; inspect every migration, preserve applied history, and apply only pending migrations to the local test database. Sites applies generated migrations during deployment.

Run TypeScript checking with `node node_modules/typescript/bin/tsc --noEmit`. Bundle `lib/academy-engine.ts` and `lib/academy-teams.ts` with the installed esbuild into `.sites-runtime/engine.mjs` and `.sites-runtime/teams.mjs`, then run `node --test tests/engine.test.mjs tests/teams.test.mjs`.

`tests/api-integration.mjs`, `tests/teams-api.mjs` and `tests/teams-browser.mjs` target the **built local worker at port 8787**, using synthetic identity headers. Never point them at a hosted Academy. Other browser regression scripts use the local development sign-in simulator at port 5173. Browser scripts reference this workspace's Playwright runtime and Chrome; adjust those paths elsewhere. Local fixtures are never seeded into the published database.

See `docs/release-notes.md`, `docs/test-evidence.json` and `docs/shared-workspaces.md` for actual checks, permission rules and limits.

## Remaining production work

Approve sector content and validate real learner journeys; arrange site access and exercise actual participant sign-in; establish staff recruitment, assessor calibration and turnaround; implement a durable multi-version curriculum registry; validate reviewed translations, low-bandwidth/offline and assisted/oral journeys; connect one real partner; define formal retention/erasure, recovery, accessibility and capacity controls. Recognized credentials require issuer authority and public verification/revocation policy.

Real event/mentor bookings, commerce, uploads, clinical training and embedded AI remain unimplemented. No external partner receives the ecosystem simulation, and no AI service is called. Existing BRD/FSD/HLD/LLD describe the broader target; the five-table SQLite implementation does not claim the full reference PostgreSQL schema or API contract.
