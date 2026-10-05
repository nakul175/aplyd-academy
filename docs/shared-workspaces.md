# Shared Academy workspaces · implementation contract v0.2

## Separation and authority

Private labs remain in `academy_workspaces`/`academy_audit`, indexed by authenticated owner. Shared records are in `academy_teams`, indexed by workspace ID; their protected revision audit is in `academy_team_audit`. `academy_invite_tokens` indexes globally unique token hashes to their workspace/invitation. No API returns the complete shared document.

Platform identity supplies stable account subject and email. The local Worker uses synthetic identity headers for tests; those headers do not exercise hosted identity verification. UI work context and display name affect relevance/presentation only. Roles, scope, current membership and explicit assignments are server authority.

| Role | Authorized data/actions | Additional boundary |
| --- | --- | --- |
| Owner | Members, invitations, cohorts, administrative history, assignment/status summaries | No automatic private-evidence access |
| Learner | Own drafts, lessons, submitted attempts, feedback, appeals, practice records; enrolled cohort boards | No other learner's evidence |
| Facilitator | Selected-cohort roster/progress summaries and visible board content | No submitted fields, scores or private feedback |
| Assessor | Explicitly assigned submission in an authorized cohort | Cannot be that learner |
| Appeal reviewer | Assigned appeal, its submission and original decision | Cannot be that learner or the immutable original assessor |
| Moderator | Selected-cohort posts/replies/reports and moderation history | No reporter identity in projection; no grading authority |

Staff scope names actual cohorts. Learner invitations create membership; learners enroll separately. Invitations reserve no places. Owners must explicitly add new cohorts to staff scope. Removed staff assignments return to the unassigned queue; restoring a role does not silently restore an assignment. Removing the last owner is forbidden.

## State and private projection

Shared document: workspace identity/purpose/context; members with roles, cohort scopes and active status; invitations with hash, recipient, issuer, permissions, scope, expiry and acceptance; pinned cohorts; per-learner learning states; review assignments; cohort posts/replies; reports; administrative and moderation history.

Learner learning state reuses the existing progression engine and carries cohort ID and pinned claim policy. Drafts and lesson practice belong only to that learner. Assessor projections include a minimal enrollment reference and immutable submitted attempt; they exclude editable drafts and lesson practice. Appeal projections include only the relevant attempt/decision/appeal. Owner/facilitator progress includes learner display name, cohort, completed-lesson count and broad status. Reports exclude reporter account identity. Emails are confined to owner membership/invitation views and the recipient's own invitation preview; missing names default to “Academy member.”

Shared completion records say **Reviewed practice record · draft learning content, nonaccredited**. They include workspace issuer, effective decision reference, reviewer display name and review date. Decisions bind the real authenticated subject, independently of mutable display names. Original decisions remain immutable. An adverse appeal suspends the record in the same protected update; a passing retry cites its own current decision. No recognized certification or clinical qualification is asserted.

## Lifecycle

- Invitation: active → accepted or revoked; expired active links are refused. Seven-day expiry. Exact token hash cannot be reused, even after acceptance/revocation. Wrong recipient receives an unavailable result. Removed membership cannot be restored by accepting an old invitation. An invitation issuer losing active owner authority invalidates outstanding invitations.
- Cohort: open → closed or paused, with owner-controlled resumption. Open accepts learners while capacity remains. Closed stops new enrollment but permits current learning. Paused retains work and stops learning/review actions; timely appeals remain available. Completed participants count toward capacity.
- Enrollment: learning → submitted review → decision → optional appeal/retry → reviewed practice record. Withdrawal releases capacity and retains history, provided no record or pending review/appeal prevents withdrawal. One active enrollment per pathway per learner in a workspace.
- Assessment: waiting for assignment → assigned eligible account → immutable final decision. Three attempts, at least 70/100 and every critical gate required.
- Appeal: open/waiting for independent reviewer → assigned eligible account → immutable superseding resolution. Original actor identity, not reassignment, determines independence. Fourteen-day window from the assessment decision.
- Discussion/reply: pending → visible or hidden. Only author and scoped moderator see pending content. Moderation requires a reason and retains actor, target, before/after state and time. A reply action does not close reports on its parent; explicit parent moderation resolves its reports.

## API

`GET /api/teams` lists only the caller's active or historical memberships. `GET /api/teams?id=...` projects the current workspace to the caller. `GET /api/teams?invite=...` previews a valid invitation for the authenticated recipient. `/join?token=...` preserves invitation context through platform sign-in.

`POST /api/teams` accepts `{teamId?, revision, actionId, command}`. Commands: create, invite, revoke-invite, accept, member, cohort-create, cohort-status, assign; scoped assess/resolve; cohort post/reply/report/moderate; and own profile/enroll/lesson-draft/lesson/draft/submit/appeal/share/withdraw/followup/interest. Sample staff actors, private-lab reset, global content pause and ecosystem simulation cannot grant shared-workspace authority.

Success or identical authorized replay returns 200. Unauthenticated access returns 401; unavailable/out-of-scope resources 404; forbidden permissions/conflicts of interest 403; malformed input 400; stale revision, idempotency mismatch or lifecycle conflict 409; evidence/rubric validation 422. Size/type boundaries may return 413/415; storage failures 503. Replies use no-store caching. POST checks request Origin when present and requires JSON.

Each operation loads current authority, validates the command and prepares the projected next state. An atomic D1 batch updates the shared row only at the expected revision, optionally registers an invite hash under its unique key, and appends the command audit only when the preceding write succeeded. A failed token registration rolls back the whole batch. Any intervening revocation or assignment change advances the same revision, so a stale finalization cannot commit. This CAS serialization is bounded pilot behavior; no claim of a deterministic after-authorization race barrier or production throughput testing is made.

## Rollout and outstanding gates

Migrations 0002/0003 are additive and schema-only. Previous production held only private labs, so no shared-data backfill is required for this release. Existing source and migration history remain recoverable. Rollback to the previous Worker leaves the new tables intact and simply stops exposing shared routes; do not remove submitted data to roll back.

Site audience remains owner-private; Academy invitations alone cannot grant hosted access. Actual recipient sign-in, hosted header-spoofing resistance and end-to-end hosting permissions still need verification with authorized real accounts. Local fixtures prove application behavior under supplied test identities.

Before broad rollout: approved content, real recruitment/consent, staff capacity/calibration, formal support and response targets, retention/erasure, version-registry archives, penetration/accessibility/load/recovery testing and one authenticated partner contract. Shared aggregate limits and conflict refresh behavior remain material pilot limitations.
