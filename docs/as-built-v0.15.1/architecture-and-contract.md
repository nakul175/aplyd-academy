# M6 reflection completion: architecture and low-level contract

## Where the change sits

`taskProgress(state, task, options)` in `lib/academy-plan.ts` is a pure function used in the browser and in tests. It reads the learner's own aggregate only. Its result flows to:

1. `projectPlanTasks` and `learningPlanSummary` (`completedActivitiesThisWeek`, reminders, next action);
2. `app/academy-plan.tsx`, which shows the task label and "Saved completion" date;
3. `deriveOwnWeeklyReview` in `lib/academy-weekly-review.mjs`, which places completed plan items in the current plan week, and its JSON and printable recap downloads in `app/academy-weekly-review.tsx`.

The server does not persist `taskProgress` output. Plan commands call it for the duplicate-activity and open-activity checks, which depend on `status` only.

## Algorithm

For a plan item of kind `reflection` linked to enrollment `e`:

1. `createdAt = Date.parse(task.createdAt)`.
2. Scan `state.followups` once, in stored order. An entry qualifies when `f.enrollmentId === e.id`, `f.createdAt` is a string, its parsed value is finite, and that value is `>= createdAt`.
3. Keep the qualifying entry with the strictly smallest parsed value. On an exact tie the entry met first is kept; tied entries carry the same instant.
4. `completed = qualifying entry exists`; `completedAt` is that entry's stored `createdAt` string, otherwise `null`.

The array is neither sorted nor copied, and no input is mutated. Cost stays O(number of reflections), as before.

## Difference from v0.15.0

For well-formed data only `completedAt` changes: earliest qualifying instead of newest qualifying. `completed`, and so `status`, label and blocked reasons, are unchanged because a qualifying entry exists exactly when an earliest one exists. Two malformed-data edges differ: a `null` entry in `followups` no longer throws, and a non-string `createdAt` never qualifies. The engine always stores `new Date().toISOString()` strings, and the route passes the same, so these edges do not arise from the application's own writes.

## Contracts

- HTTP API: unchanged. No route, request body, response envelope or status code changed.
- Commands and permissions: unchanged. Assignment and scope checks, independent review, self-review and original-assessor prohibitions, revision and idempotency fences, and denied-read masking are not touched.
- Storage: unchanged. Seven D1 tables, no migration, no new or changed stored field.
- Isolation: the derivation reads only the authenticated learner's own aggregate, as before. The personal lab and shared workspaces are unaffected.
- Curriculum: no pin, version or archive is read differently. An unavailable pinned edition keeps completed own history and is never replaced.

## Related branches, unchanged

- Practical items take `attempts.find(submittedAt >= createdAt)`. The engine appends attempts, so the first match is the earliest. This relies on stored order; the reflection branch does not.
- Lesson items read `e.practice[lessonId].completedAt`, which the engine overwrites when the `lesson` command runs again for a completed lesson. See the known adjacent defect in [README](README.md).

## Test harness design

`tests/reflection-completion-qa/build-model.mjs` bundles the actual engine, plan, curriculum and weekly review into one pure module, records SHA-256 for every bundled source, fails if any source changes during bundling, and strict-typechecks the plan.

`tests/reflection-completion-qa/browser-readonly.mjs` requires an explicit Worker-ready flag, a named Worker session, a frozen dist whose entry equals the checked build entry, and a loopback URL. Every request passes `tests/exact-offering-qa/read-only-routing.mjs`: anything other than same-origin GET or HEAD is aborted and recorded, and redirects are refused. `/api/academy` and `/api/teams` GET responses are fulfilled inside the browser from states built by the actual engine and never reach the Worker or D1. Any other API path is aborted and fails the run. The run fails unless source, harness, model and runtime hashes are unchanged at the end, the in-memory states are unchanged, and there are no forbidden requests or page errors.
