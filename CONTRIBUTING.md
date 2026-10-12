# Contributing

Work follows the APLYD Delivery System v1.0: every change traces to a Linear story (ACA-US-x.y) and its acceptance criteria.

- Branch per story: `aca/us-<x.y>-<short-name>`; commit messages name the story.
- Owner values are never hard-coded: add a key to `DECISIONS` in `lib/loop/core.ts` and use `requireDecision`.
- Every permission check lives in `lib/loop`, and every refusal goes through `refuse()` so it is audited.
- Migrations are new files only (`drizzle/00NN_*.sql` plus a `_journal.json` entry); never edit an applied one.
- Run before a pull request: `node --test tests/loop/*.test.mjs`, `npx tsc --noEmit -p .`, `node scripts/gen-loop-docs.mjs` (commit the regenerated docs), and the browser journey for screen changes.
- Synthetic data only in tests. Never point a test at the hosted Academy.
- Plain English in the interface: short sentences, no jargon, say what the person can do next.
