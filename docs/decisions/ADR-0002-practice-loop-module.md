# ADR-0002: Build the practice loop as a separate module on the Node runtime

Status: proposed by Claude, 13 October 2026; for review by Nakul Jain.

## Context

The vision and strategy (VISION-ACADEMY-01, STRATEGY-ACADEMY-01) replace the v0.17 course-and-lesson pilot with a weekly practice loop on learners' own work, for association cohorts first. The v0.17 code keeps each learner's workspace as one versioned JSON document with a large command engine (`lib/academy-engine.ts`); it has no organisations-with-cohorts-from-a-list, consent records, AI levels, packs with expert review, reminders or practice metrics. ADR-0001 moved the app to Node and SQLite and kept the v0.17 SQL running.

## Decision

Build the practice loop as a new module, `lib/loop` with screens under `/loop` and one action endpoint `/api/loop`, on relational `loop_*` tables (migrations 0010 onwards, additive only). Reuse from v0.17: the Node runtime and D1-compatible adapter, email-code sign-in and sessions, request-origin checks, the mail transport, the AI provider adapter (ACA-US-7.1) and account erasure (extended to loop data). Do not change the v0.17 screens or their data.

Owner values (level bands, thresholds, notice text, minimum group size, retention periods, cadences, go/no-go) live in an append-only decision table and are never defaulted in code; features that need one refuse with a "waiting for the owner" message.

## Consequences

- The R1 journey is testable end to end on synthetic data without touching v0.17 behaviour; the full v0.17 regression still passes.
- Two products live in one app until the owner decides what happens to the v0.17 screens (retire, keep for the personal lab, or link from `/loop`). **Open decision for the owner.**
- Relational tables make metrics (S-01 to S-05) plain SQL with exact denominators.
