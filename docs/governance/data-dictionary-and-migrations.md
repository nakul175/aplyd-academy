# Data dictionary and migrations (item 11)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when `db/schema.ts` or `drizzle/` changes, or an as-built dictionary supersedes these.

## Physical schema (current)

Seven SQLite/D1 tables in [`db/schema.ts`](../../db/schema.ts): `academy_workspaces`, `academy_audit`, `academy_teams`, `academy_team_directory`, `academy_team_audit`, `academy_invite_tokens`, `academy_team_history`. Learner, course, cohort and submission data are JSON aggregates inside `data` columns, not separate tables. The reference PostgreSQL design ([schema.sql](../product-specifications/schema.sql), [data-dictionary.csv](../product-specifications/data-dictionary.csv)) is the target, not the implementation.

## Which dictionary to read

There is no single cumulative dictionary. Read in this order:

1. [`implementation-review-v0.13/data-dictionary.tsv`](../implementation-review-v0.13/data-dictionary.tsv) (110 rows): physical columns and aggregate fields as of v0.13. Base.
2. Deltas, newest wins on conflict: [as-built-v0.14](../as-built-v0.14/data-dictionary.tsv) (55 rows), [as-built-v0.15](../as-built-v0.15/data-dictionary.tsv) (26), [as-built-v0.15.1](../as-built-v0.15.1/data-dictionary.tsv) (10, derived plan fields only; no stored field changed).
3. [as-built-v0.11](../as-built-v0.11/data-dictionary.tsv) (107 rows) and v0.13 are earlier snapshots; see docs/governance/README.md for superseded copies.

Fields added by the v0.17.0 candidate (registration, recovery, credentials, rooms, accommodations) are described in docs/CLAUDE-HANDOFF.md and `lib/`, not yet in a dictionary. Gap, below.

## Migrations (applied history is never edited)

| File | Adds |
|---|---|
| `0000_strange_dazzler.sql` | `academy_workspaces`, `academy_audit` |
| `0001_complex_deathbird.sql` | audit `request_hash`, unique (owner, event) |
| `0002_silky_tempest.sql` | `academy_teams`, `academy_team_audit` |
| `0003_massive_franklin_storm.sql` | `academy_invite_tokens` |
| `0004_red_trauma.sql` | `academy_team_history` |
| `0005_tearful_angel.sql` | `academy_team_directory`, `directory_projected`, triggers |
| `0006_audit_detail.sql` | `detail` on both audit tables |

Generation: `npm run db:generate` (drizzle-kit); inspect every file. On the droplet each new `drizzle/*.sql` is applied once in name order, recorded in `/var/lib/aplyd-academy/applied-migrations.txt` (deploy/update.sh). There are no down migrations; rollback is "revert the commit", and data is untouched by a redeploy (deploy/README.md).

## Gaps

- No cumulative dictionary after v0.15.1 and none for v0.16 and v0.17 candidate fields. TBD (owner: Nakul Jain).
- No database-level JSON validity checks (`implementation-review-v0.13` notes none); validation is in application code.
