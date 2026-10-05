# v0.12 architecture and contract — release candidate

The existing authenticated Academy shell remains the authority boundary for accepted own state and current team projection. Presentation modules consume that state rather than maintaining independent protected copies. The shell changes its authority epoch synchronously and fences reads/writes with request generations. The private record widget adds an abort/sequence guard and invalidates results on scope changes. Local export checks the live scope again.

Job templates flow through the existing shared command route and single aggregate CAS. The template adapter composes copy and tailored save before returning an aggregate; errors and sizing failures leave the original untouched. Existing atomic audit/history and indexed directory behavior are unchanged. There is no new database table or migration in v0.12.

Record checks run a read-only service over the authenticated personal row or a fresh canonical team projection. They perform SELECT queries only, validate exact source and rubric-derived history, hash a thin result, then check the source revision again. GET/load does not create or repair rows. The client checks exact response keys, classification, digest, subject/source binding and captured-data consistency.

### POST /api/academy/records/check

JSON input: workspaceId (null or exact shared workspace), sourceRevision (nonnegative safe integer), and exactly one of recordId/decisionId. No actor, learner, rubric, claimed status or authority field is accepted. Body bound:2000 UTF16 code units and4000 UTF8 bytes.

Successful envelope: format, formatVersion, currentUserId, workspaceId, sourceRevision, checkedAt, target and result. Result is checked with thin snapshot+integrity, or unavailable with bounded explanation. Responses are no-store/nosniff/no-referrer. Error classes include invalid input400, unauthenticated401, invalid origin403, undisclosed/unavailable scope404, changed revision409, oversized413, incorrect media415 and temporary503. Responses do not authorize further actions.

### Shared content command

{type: content-job-template, templateId: one of four fixed template identifiers}. Existing teamId/revision/actionId envelope and supported actor context remain required. The one accepted aggregate write receives a new revision and audit event. Replay retains the existing exact action UUID/request hash semantics.

### Additive data dictionary

Draft.templateOrigin: optional historical provenance (schema/version/template/source references); no permission, reviewer approval or content pin.
Record-check envelope and snapshot: ephemeral authenticated response, not a stored table or public credential. checkedAt/asOfRevision describe this saved-state observation. Decision actor labels describe historical provenance, not current staff authority.
Learner guidance model: transient presentation of existing next action. Draft notice: exact comparison of selected input keys with accepted draft; returns no input values or answer choices.

### Required acceptance evidence

Actual-root pure rules/typecheck/build; record authentication/source/revision/history API checks; malformed/rehashed response and late-scope client checks; template atomicity/review/capacity/source-reference checks; guidance draft recovery/browse/filter/mobile/keyboard checks. Loopback trusted-header fixtures do not prove hosted authentication, human screen-reader usability, recognized issuer approval or partner receipt. Template mutating local API/browser workflow remains pending explicit user test-data approval after automatic-review rejection.
