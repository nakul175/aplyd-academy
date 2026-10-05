# Aplyd Academy working pilot

A private, durable learning application for farmers, MSME owners and public servants. Learners choose a work goal, complete guided lessons with fictional source packets, check an AI draft, submit practical evidence and track feedback and work reflections.

## Implemented experience

- Three versioned draft pathways; nine substantive lessons; 27 explained quiz checks.
- Saved lesson practice and practical-assessment drafts, sequential progression and immutable submission snapshots.
- Manual sample assessor studio, weighted rubrics, evidence references, critical gates, retry limits and independent sample-actor appeals.
- Clearly labelled nonaccredited practice completion records, downloads and chosen profile export.
- Moderated owner-private discussions/replies/reports and saved peer-learning interests.
- Work-trigger mappings and bounded ecosystem return-payload simulation with separate grants. No real partner calls.
- Reading mode, optional browser read-aloud, profile preferences, data export and learning-data deletion.

## Access and persistence

Hosted access remains owner-private. ChatGPT sign-in is handled by the platform; API identity is verified server-side from dispatcher-provided headers. Local development uses the bundled local sign-in simulator. The built local worker is used with explicit synthetic identity fixtures for isolation tests; that does not test the hosted dispatcher.

Each authenticated owner has an isolated database workspace. Its aggregate document uses a revision for compare-and-swap updates. State and minimal action audit commit atomically. Action references and request fingerprints provide durable idempotency. No browser storage is the authoritative learning record. A one-megabyte workspace limit bounds this first pilot. This aggregate design must be evolved for real multi-person cohorts and high-volume operation.

The private owner intentionally operates all sample staff roles. The server requires different named sample actors for appeals, but these actors are not independently authenticated employees. Sample outcomes are practice records. Real staff authorization and issuer authority are prerequisites for recognized credentials.

## Development

Use the configured Node/npm runtime. Install dependencies with the Sites installer. Run `npm run dev` and visit the printed local URL. `npm run db:generate` appends schema migrations. Build and apply pending local SQL migrations following the retained starter instructions before database-backed preview. Do not reapply recorded SQL.

Run `node node_modules/typescript/bin/tsc --noEmit`. Bundle the pure rules with `./node_modules/esbuild/bin/esbuild lib/academy-engine.ts --bundle --platform=node --format=esm --outfile=.sites-runtime/engine.mjs`, then run `node --test tests/engine.test.mjs`. Browser QA scripts currently reference this workspace's supplied Playwright runtime and installed Chrome; adjust those paths elsewhere.

`tests/api-integration.mjs` targets the built LOCAL worker at port 8787 using synthetic identity headers. Never point this test at a hosted Academy. Browser tests use the local development sign-in simulator. Test data is local and is not seeded into the published database.

## Curriculum evolution

The content version is `0.1-review-draft`. Enrollment records carry that version; unavailable versions block actions rather than using a new standard under an old label. Before adding a new curriculum version, preserve the old program, prompts, rubric, policy and issuer claim in a version registry and resolve both server and learner views from the enrollment version. Do not edit the published seed in place.

## Launch work

This is a functioning private pilot, not the complete production specification. It has no recognized issuer, separately authenticated staff, real partner exchange, public learner onboarding, cross-person community, clinical training, content authoring/version registry UI, file uploads, oral-assessment accommodation authority, reviewed translations, real events/mentor bookings, payment, or embedded AI assistant. Existing FSD/HLD/LLD are the target design; this release does not implement their complete API or reference PostgreSQL schema.

See `docs/release-notes.md` and `docs/test-evidence.json` for actual checks and limits. Sector approval, field accessibility/usability studies, operational capacity, security review, production load/recovery tests and partner contract tests remain required before broad rollout.
