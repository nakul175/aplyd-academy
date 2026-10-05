# Private plans and exact course versions · v0.4

Each learner has an optional `learningPlan` inside their own personal or shared-workspace state. Legacy documents receive detached read defaults. Plans never change course evidence, staff roles or another learner. Own exports include them; owners, facilitators, assigned assessors, peers and local ecosystem summaries exclude them.

| Field | Type and constraint | Meaning |
|---|---|---|
| goal | explore / records / check-draft / clear-response / expert-questions | Learner-selected goal theme |
| personalGoal | text, at most 200 characters | Optional private work goal |
| weeklyMinutes | integer 10–600 | Planned weekly budget, not measured learning time |
| timeZone | supported IANA timezone, at most 80 characters | Date-only plan and Monday–Sunday week calculations |
| remindersEnabled | boolean, initially false | Due notices while Academy is open; no message sender |
| tasks | up to 200 total, 30 open | Private planning history |
| task.kind | practice / lesson / practical / reflection | Self-reported or linked activity |
| task.enrollmentId / lessonId | nullable, server-validated own links | Immutable on edit; no client-selected course version |
| task.title | 3–100 characters for practice; derived for linked tasks | A linked title comes from its exact saved content |
| task.dueDate | null or real YYYY-MM-DD, 1900–2200 | Unscheduled remains null, without a fabricated deadline |
| task.plannedMinutes | integer 5–240 | Editable planned allocation |
| task.note | private text, at most 500 characters | General or fictional information only |
| task.status | planned / done / skipped | Manual done only for private practice |
| task.createdAt / updatedAt / completedAt | server times; nullable completion | Distinguishes plans from saved activity evidence |

Commands are `learning-plan`, `plan-task`, `plan-task-status` and `plan-task-remove`, inside existing authenticated revision/action-receipt transactions. Exact fields reject client actors, learner IDs and content references. Shared dispatch supplies current membership, learner permission and cohort state. Removed members retain own readable plans and cannot write. Losing learner permission prevents new linked learning, while private planning and active-record reflection remain available. Paused cohorts preserve plans and block linked learning; withdrawal retains history.

Lesson tasks derive completion from saved lesson progress, practical tasks from a submission made after planning, and reflection tasks from a subsequent own work reflection. A task checkbox cannot create a quiz pass, assessment decision or practice record. Private practice completion is explicitly self-reported. Removing a plan item never removes its linked course evidence. Weekly counts describe saved activity completions, including self-report; they do not establish competence or job impact.

The overview's next action reflects an actual plan or saved enrollment: unfinished lesson, practical preparation, submitted evidence awaiting review, independent appeal, revision, exhausted attempts, paused content, unavailable version, or active-record work reflection. Navigation never enrolls, submits or shares automatically. An explicit planned lesson cannot bypass its prerequisite.

## Immutable content references

New enrollments and cohorts store `{scope, programId, versionId}` in `contentRef`, alongside compatibility `programId` and `version`. Current production scope is `global`. Any disagreement, missing legacy version, unknown version or unsupported private scope fails closed. Historical actions and displays resolve the entire pinned row; they never silently fall back to current catalog content.

The unchanged original seed is preserved in `lib/curriculum-versions/0.1-review-draft.json`, 65,054 bytes, SHA256 `9fc83c8dd615456db8f49d140f56bff566e05c14d32ebb70a14cdcb73078b7e4`. The registry owns detached, deeply frozen snapshots and rejects duplicate keys. Only one production content version is registered in this release. A test-only later catalog proves that original cohorts, assessment rubrics and record titles remain pinned; that fixture is excluded from production.

Unavailable content retains own draft/evidence/decision export and stored record claims. Learning and review forms do not mount a substitute rubric. Cohort enrollment is disabled until exact content is available. Additional workspace publications, authoring, review governance and selected-cohort pre-enrollment detail resolution are later work.

## Local ecosystem preview guard

Existing Boolean `connections` values are local preview preferences, not scoped grants. Agri maps to farmer-work-records, MSME to msme-customer-operations, and public service to public-servant-source-briefs. New previews require matching own active learning, available exact content, no pause, valid saved lesson IDs and current record status. Health enable/preview is blocked pending domain review. Disabling an old Health flag remains permitted.

Per-partner selections are independent. Old own simulated receipts remain unchanged and are labelled historical snapshots; they do not establish partner receipt or current record status. No Boolean value is converted into an enrollment/field/expiry grant. No external partner, identity federation, API, live send or AI provider is connected by this feature.

## Executed verification

107 checkout rule tests and 49 dedicated historical-content regressions pass. 356 local database assertions cover plans, ecosystem guard, personal and shared learning. Browser journeys cover personal learning, separate-account shared assessment/appeal, all four planner kinds and local ecosystem preview; 138 responsive surfaces and 29 planner keyboard/form checks pass. Ten read-only intercepted browser cases exercise unavailable historical content and review selection switching. See `test-evidence.json`; local fixture results do not verify hosted authentication or actual participant access.
