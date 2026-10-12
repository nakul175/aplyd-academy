# Backup and disaster recovery (item 15)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when a backup is enabled, a restore is tested, or hosting changes.

## What there is today (verified from files)

- Droplet data: one SQLite/D1 file set under `/var/lib/aplyd-academy/state` (deploy/README.md).
- deploy/README.md says to turn on DigitalOcean droplet backups "before relying on it". **Whether they are on: TBD (owner: Nakul Jain).** The kit contains no backup job, no off-droplet copy and no encryption of copies.
- Source and migrations are in Git (GitHub); the droplet rebuilds from `main`. Curriculum and library bytes are in Git. The only unrecoverable-from-Git data is learner/workspace state in the database.
- The hosted Sites copy has its own platform storage; its backup behaviour is not documented here.
- The pilot holds synthetic data only. Loading real learner records is blocked until retention and erasure decisions are made (handoff; privacy-retention-dsr.md).

## Recovery objectives

Proposed in docs/product-specifications/operations.md "subject to approval": **RPO 24 hours, RTO 8 hours.** They are proposals. Nothing has demonstrated them. Droplet backups, if enabled, are typically less frequent than daily on weekly plans; confirm before claiming RPO. TBD (owner: Nakul Jain).

## Procedure

[runbooks.md](runbooks.md) section 5. A restore must prove (from the design): account linkage, workspace boundaries, enrolment state, evidence access, record status, and that completed deletions are reapplied before anything is re-enabled. The current app has no deletion manifest, so deletion replay after restore is not possible (threat-model.md, TH-16 equivalent).

## Restore-test log

**No restore test has been performed on a real host.**

| Date | Who | Backup source and age | Target host | Result | Time to restore | Findings |
|---|---|---|---|---|---|---|
| (no entries) | | | | | | |

Add a row each time; do not backfill from assumptions. First test is due before any real data is loaded.

## Gaps

- No scheduled backup, no off-site copy, no integrity check, no encryption-at-rest statement, no tested restore, no deletion reconciliation.
- Single droplet: one crash, disk or build problem takes every app on it down (deploy/README.md).
