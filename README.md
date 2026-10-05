# Aplyd Academy working pilot · v0.10.1

A durable learning application for farmers, MSME owners and public servants. Learners practise on fictional source packets, check supplied AI drafts, submit practical evidence, receive reasoned feedback and reflect on their work.

## What works

- Three pinned draft pathways, nine lessons and 27 explained quiz checks, with an immutable archived-content resolver and exact references on new cohorts/enrollments.
- Private learning goals, weekly budgets, timezone-aware plans, four activity types, evidence-derived completion, optional in-app due notices and truthful next actions.
- Saved lesson/practical drafts, sequential progression, immutable submissions, critical-gate rubrics, three attempts and 14-day independent appeals.
- A **personal practice lab** with sample staff roles, private discussion, explicit ecosystem summary/expiry choices and local contract receipts, learning export and lab-data deletion.
- Separate **shared workspaces** with account-bound invitations, memberships, scoped staff roles, cohorts, capacity enforcement and withdrawal.
- Explicit assessment/appeal assignments to signed-in accounts. Self-review and original-assessor appeal review are forbidden. Owners/facilitators receive progress summaries without private evidence.
- Cohort discussion with prepublication moderation, restricted reports and reasoned moderation history.
- Nonaccredited practice records with review provenance, adverse-appeal suspension, downloads and learner exports.
- Explicitly opted-in cohort directory, real scheduled practice sessions, atomic RSVP capacity, cancellations and observed attendance with correction history. Own session history remains readable/exportable after access ends.
- Reading mode, browser read-aloud, accurate lesson resume, nullable work-reflection estimates and keyboard/dialog focus recovery.
- Owner content studio with ordinary editing fields, independent owner review, immutable private publication, exact cohort offerings and retained archive/retirement history.
- Private in-app support requests with independent handlers, current scoped access, preserved resolution history and own export.
- Protected storage reserve and atomic archival administrative/moderation history with current scoped reads.
- Read-only workspace operations for current owners and scoped facilitators, with exact queue counts, review dates, session observations and reference-only navigation.
- Denied-read privacy masking, account-specific in-memory drafts and current-authority attendance dialogs.

- Searchable reference library: five supplied collections and20 unchanged Word/PDF/PowerPoint originals, source filenames, audience recommendations and review notes. Browsing and downloads do not alter learning or issue records.

## Access

The hosted site remains owner-private. Platform sign-in provides server-side account identity. **Site access and Academy membership are separate gates:** an Academy invitation cannot change the hosting audience or admit its recipient to the private site. Hosting access must be arranged before a real participant can sign in and accept. Links are copied manually; this app sends no invitation email or other messages.

The personal lab never becomes a shared workspace. Creating/joining a workspace starts fresh and does not copy lab drafts, sample decisions or posts. Shared evidence is limited to its learner and explicitly assigned staff. Ownership alone does not grant evidence access. Members whose access is removed retain read-only access to their own saved learning history and records; they lose discussion and protected actions.

## Persistence and concurrency

D1 stores private owner documents and separate shared-workspace documents. Protected shared operations use one workspace revision and an atomic state/audit batch. Membership revocation, review assignment/finalization, invitations, moderation and seat allocation contend on that same revision. Stale writes are refused and the client refreshes while retaining form input. Action references and request hashes provide durable idempotency; changed-body reuse is refused.

Globally unique invitation-token hashes are indexed in a separate table and committed with the workspace mutation. Tokens expire after seven days, are recipient-email bound, and cannot be reused. An issuer losing owner authority invalidates its outstanding invitations. The platform supplies the email; invitation request fields cannot impersonate a recipient.

This is a bounded pilot architecture: up to ten created workspaces per account, 100 members, 20 cohorts and 200 historical invitations per workspace, one megabyte per personal lab, a 1.2 MB ordinary shared-content budget and a 1.8 MB protective ceiling. Older administrative/moderation history is archived atomically. Aggregate contention and membership-directory scanning require a normalized repository before large cohorts or broad rollout. No load-capacity claim is made.

## Development and verification

Use the configured Node/npm runtime and retained Sites installer/build workflow. `npm run dev` opens the local sign-in simulator. Generate additive D1 schema changes with `npm run db:generate`; inspect every migration, preserve applied history, and apply only pending migrations to the local test database. Sites applies generated migrations during deployment.

Run TypeScript checking with `node node_modules/typescript/bin/tsc --noEmit`. Bundle `lib/academy-engine.ts`, `lib/academy-teams.ts` and `lib/academy-storage.ts` with the installed esbuild into `.sites-runtime/engine.mjs` and the corresponding teams/storage bundles (also curriculum, plan and ecosystem-guard for their test suites), then run the appropriate `.test.mjs` suites. Authoring adds `.sites-runtime/authoring.mjs` and `tests/authoring.test.mjs`; `node tests/build-authoring-security.mjs` builds the single integrated security bundle before `node --test tests/authoring-security.test.mjs tests/authoring-farm-duplicate.test.mjs`.

`tests/api-integration.mjs`, `tests/teams-api.mjs`, networking/archive scripts and `tests/teams-browser.mjs` target the **built local worker at port 8787**, using synthetic identity headers. Never point them at a hosted Academy. Other browser regression scripts use the local development sign-in simulator at port 5173; set `ACADEMY_QA_BUILT=1` for the built Worker fixture. Set `QA_LOCAL_DB_SQL=1` for direct archive/audit consistency checks. `tests/archive-failure.mjs` injects and removes a constraint fault only in its new isolated local fixture. Browser scripts reference this workspace's Playwright runtime and Chrome; adjust those paths elsewhere. Local fixtures are never seeded into the published database.

See `docs/workspace-operations.md`, `docs/as-built-v0.7/`, `docs/as-built-v0.9/`, `docs/as-built-v0.10/`, `docs/release-notes.md`, `docs/test-evidence.json` , `docs/shared-workspaces.md` and `docs/networking-and-history.md` and `docs/plans-and-pinned-content.md` and `docs/support-and-refresh.md` and `docs/private-content-studio.md` for actual checks, permission rules and limits.

## Remaining production work

Approve sector content and validate real learner journeys; arrange site access and exercise actual participant sign-in; establish staff recruitment, assessor calibration and turnaround; validate private curriculum adaptation and independent content-review operations; validate reviewed translations, low-bandwidth/offline and assisted/oral journeys; connect one real partner; define formal retention/erasure, recovery, accessibility and capacity controls. Recognized credentials require issuer authority and public verification/revocation policy.

External event/mentor-provider bookings, host reassignment, commerce, uploads, clinical training and embedded AI remain unimplemented. No external partner receives the ecosystem simulation, and no AI service is called. Existing BRD/FSD/HLD/LLD describe the broader target; the six-table SQLite implementation does not claim the full reference PostgreSQL schema or API contract.
