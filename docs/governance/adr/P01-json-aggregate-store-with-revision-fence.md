# ADR-P01: Seven-table D1 store with JSON aggregates and a revision fence

Owner: Nakul Jain · Date recorded: 2026-10-08 (retrospective) · Status: Accepted (as built)

## Context
The pilot runs as a Cloudflare-style Worker with a D1/SQLite database (db/schema.ts, drizzle/0000 to 0006). The reference design wants PostgreSQL and an 87-path API, which the pilot does not claim (README; IMPLEMENTATION-STATUS.md).

## Decision
Store personal labs and shared workspaces as one JSON aggregate per owner or workspace in seven tables. Every protected mutation carries an expected `revision` and an `actionId`; the write updates the row only at that revision in an atomic batch with an audit row; replay with the same request hash returns the current state, a different hash conflicts (app/api/academy/route.ts; docs/shared-workspaces.md).

## Consequences
Simple atomic updates and strong concurrency semantics per workspace; every workspace writer contends on one row. Size is bounded (1 MB personal, 1.2/1.8 MB shared) and older history is archived. No relational constraints on learner data; validation lives in code. A move to PostgreSQL would be a migration project, not a configuration change.

## Alternatives considered
Relational tables per entity (the reference schema.sql): rejected for the pilot per README; not re-evaluated.
