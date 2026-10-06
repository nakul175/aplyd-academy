M6 reflection completion — staged candidate, no app runtime claim

Correction
integration.patch changes only the existing reflection branch of lib/academy-plan.ts. The staged full plan file is a review snapshot; apply the patch instead of replacing unrelated current source. A one-pass scan chooses the earliest finite string timestamp for the exact own enrollment, at or after this task's creation. It does not sort or mutate the followup array. Equal canonical timestamps retain the same completion date. The remaining lifecycle, eligibility, status, blocked reasons and completed-history branches are unchanged.

All reflections remain in history. Later legitimate reflections do not move an old plan item's completion. A deliberately created later plan item can complete from the first action after its own creation. Skipped activities remain skipped. Current future-only completion diagnostics remain as they are; this is not an expansion of date validation or a new evidence policy.

BEFORE proof — unchanged actual root
repository-tests/build-model.mjs bundles unchanged actual engine/plan/curriculum/weekly sources into runtime/before.mjs. reproduce-before.mjs completes the real sample learning workflow in memory: enroll, correct lesson checks, fictional practical submit, sample-assessor review, reflection plan command, and two followup commands. Actual engine insertion is newest first.
The desired stable-date assertion fails: expected 2026-10-06T09:00:00.000Z, actual 2026-10-12T10:00:00.000Z. That assertion failure is deliberately caught and recorded in runtime/before-failure-proof.json; further assertions verify the observed defect, rather than claiming the old behavior passes the desired regression. The old task then contributes zero to its first week and one to the next week.

AFTER proof — actual root except one staged plan override
The compiler replaces only actual academy-plan.ts imports (including the engine and weekly model imports) with the staged plan. All other model sources are the actual checkout, with source hashes recorded separately for BEFORE and AFTER. Strict TypeScript plan check passed.
11 pure groups pass: ten lifecycle/date/privacy cases plus the actual weekly recap effect. Counts and case names are in runtime/after-test-evidence.json. Commands execute only in memory; there is no API, browser, SQL, saved fixture, provider request or app build. Fetch is disabled before test workflows execute.

Meaningful coverage
- Production newest-first followups and unchanged first completion.
- Original week keeps one completed plan item; later reflection week does not count that old task again.
- Reordered history and input immutability.
- Pre-task reflection excluded and exact creation instant included.
- A separately enrolled/reviewed farmer pathway does not affect an MSME task.
- New explicit later plan item receives its own later completion.
- Skipped items and retained history after authority/lifecycle changes.
- Existing suspension and blocked reasons; rejected new save leaves input unchanged.
- Invalid/missing matches and preserved future-only recap diagnostic.
- Unavailable old exact pin retains completed own history; private reflection body, notes, goals and IDs remain absent from recap export.

Portable adoption after root review/publication
Copy repository-tests/build-model.mjs, workflow.mjs and reflection-completion.test.mjs to tests/reflection-completion-qa/. Scripts detect application root from their own location or ACADEMY_APP_PATH. Adopted scripts compile the actual root plan, with outputs defaulting to .sites-runtime/reflection-completion-qa, or ACADEMY_REFLECTION_QA_OUTPUT.
reproduce-before.mjs is historical reproduction only: it intentionally requires the unfixed BEFORE behavior and should remain with the outside evidence. It must not be part of the post-fix regression command.

Before adoption, from workspace root:
node outputs/aplyd-academy-eight-hour/m6-reflection-completion/repository-tests/build-model.mjs
node outputs/aplyd-academy-eight-hour/m6-reflection-completion/repository-tests/reproduce-before.mjs
node --test outputs/aplyd-academy-eight-hour/m6-reflection-completion/repository-tests/reflection-completion.test.mjs

After adoption, from application root:
node tests/reflection-completion-qa/build-model.mjs
node --test tests/reflection-completion-qa/reflection-completion.test.mjs

No command, API, schema, persisted task field, authority, pin, immutable curriculum, authoring document or followup history is altered. Root remains sole checkout/build/merge/publication owner. Root browser acceptance may use existing approved readers or clearly labelled in-memory GET-display variants after a stable signal; no such acceptance was run by this kit.
