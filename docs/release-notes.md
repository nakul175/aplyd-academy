# Shared workspace release · v0.2

## Result

Aplyd Academy now has shared workspaces alongside the existing personal practice lab. Owners create cohorts, invite named platform accounts, grant cohort-scoped roles and assign separate staff to assessment and appeals. Learners enroll, save practice/drafts, submit immutable evidence, receive feedback, request independent review and participate in moderated cohort discussion.

Personal lab data is preserved and never copied into shared workspaces. Sample staff actors remain available only in the lab. Shared decisions use authenticated account subjects and explicit assignments; ownership alone cannot expose private evidence. Appeals reject both learner self-review and the original assessor. Records remain nonaccredited practice records for draft content.

Invitations are email-bound, expire after seven days, retain only a globally unique token hash and have accepted/revoked history. Removing an issuer's owner authority invalidates its outstanding links. Links are copied manually; no email or messages are sent. Membership removal stops protected actions and releases pending staff assignments; the last owner cannot be removed. Removed members can read/export their own history.

Cohorts pin the draft version, enforce capacity atomically, and support open, closed and paused states. A permitted withdrawal releases a place while retaining history. Moderator permission applies to selected cohorts. Posts/replies wait for moderation; reports and reasoned moderation history are restricted. Owners/facilitators see operational status without submitted fields, rubric scores or private feedback.

## Verification actually executed

- **29 rule tests passed:** 15 personal-lab regression tests and 14 shared-workspace tests. They cover scoring/gates, immutable decisions, draft exclusion, role/scope and last-owner boundaries, invitation recipient/expiry/reuse/issuer rules, capacity/withdrawal, cohort state, assigned review, independence, record provenance, moderation/report handling and removed-member history.
- **163 database assertions passed:** 36 personal-lab assertions plus 127 shared-workspace assertions. These are assertions in scenario scripts, not 163 independent test cases. Tests use separate synthetic identities against the built local Worker and D1. Actual concurrent same-revision seat requests and conflicting finalizations produce one success; token registration races across workspaces commit one invitation and roll back the loser. Populated private-lab canaries, other workspace/cohort data and editable drafts remain outside staff projections. Revocation checks refuse stale requests. No deterministic barrier inside an already-authorized request was exercised.
- **Browser smoke and full personal-lab journey passed.** Seven secondary routes, enrollment/reload, three lessons/nine quiz checks, practical draft reload, sample rubric review, record download control and moderated discussion; no page errors.
- **Full shared browser journey passed with three separate test identities:** workspace/cohort creation, recipient acceptance, preserved invitation input after a stale conflict, scoped staff grant, lesson progression, shared draft and selected-workspace reload, assigned assessment, distinct independent appeal, adverse record suspension and moderated cohort discussion; no page errors.
- **114 layout checks passed:** 54 personal-lab checks and 60 shared-view/tab checks at desktop/tablet/phone widths and normal/200% text. No document overflow. Final desktop/mobile screenshots were visually inspected; tab wrapping was improved after that inspection.
- TypeScript and Cloudflare-compatible Worker build passed. New generated migrations 0002/0003 were inspected and applied to the local database without changing earlier migrations.

Local identity headers are fixtures. These tests **do not verify** hosted authentication/header-spoofing resistance, actual recipient access to the privately hosted site, real people, field usability, accessibility conformance, approved sector content, load/recovery capacity, partner interoperability, AI service behavior or accredited issuance. Optional WebMCP is feature-detected; its execution remains unavailable in the tested browser.

## Rollout boundary

Hosting remains owner-private. **An Academy invitation does not grant access to the Site.** Arrange authorized participant hosting access before a real pilot; no real person was invited or contacted during this development. Local fixtures are excluded from the deployment.

The release uses a bounded shared aggregate with one revision and atomic audit/unique-token registration, alongside private lab aggregates. It is not the full reference PostgreSQL schema or API contract. Shared data is capped at 1.5 MB per workspace; membership lookup scans bounded documents. Broad rollout needs a normalized repository, stronger operational monitoring, formal retention/erasure and recovery work.

Draft version `0.1-review-draft` remains unchanged. Sector approval, a durable multi-version registry, assessor recruitment/calibration and turnaround, reviewed translations, assisted/oral and offline journeys, one real ecosystem integration, recognized issuer/public verification arrangements, real events/mentor bookings, commerce, uploads and embedded AI remain launch work. Health Saha is still a domain-review placeholder.

See `shared-workspaces.md` for the implemented role matrix, lifecycle and command contract, and `test-evidence.json` for machine-readable executed results.


# v0.3 · Cohort networking and protective operations

Shared members can explicitly share a narrow cohort profile and reserve real scheduled practice sessions. Owners/scoped facilitators host, current eligible participants receive joining instructions, and only hosts receive rosters. Access loss cancels future reservations and removes profile scopes; restoration never resurrects a seat or sharing choice. Session cancellations retain reasons. Host-observed attendance keeps correction history and never affects learning completion. Members retain their own session history after removal.

A shared content flood can no longer consume the capacity needed to remove access. Ordinary growth has a 1.2 MB budget; protective actions have a 1.8 MB ceiling. The previous 1,000-event administrative blocker is removed. Older hot histories are archived with the aggregate update and action receipt in one transaction, and historical reads apply current permissions in one snapshot. Workspace directory reads select summaries rather than retrieving every full evidence aggregate.

Learner resume opens the first unfinished lesson or the relevant practical/feedback stage. Missing reflection estimates remain null; explicit zero is retained. UI changes add one main landmark, navigation focus, controlled-dialog focus restoration, form errors inside open dialogs and wrapping at actual 200% body/input text.

Executed verification is recorded in `test-evidence.json`. Tests use isolated local identity fixtures; no real learner was invited, no external message/meeting request was sent, and hosted authentication remains unverified. Existing draft curriculum remains unchanged and practice records remain nonaccredited. See `networking-and-history.md` for exact scope and deferred operations.

Verification for v0.3: 46 pure rule tests; 295 database assertions across personal/shared learning, networking, archival history and injected D1 packet-failure recovery; full personal, shared and networking browser journeys; 54 personal + 60 shared + 18 networking layout checks; 54 keyboard/dialog/text-size audit checks. Counts in scenario scripts are assertions, not independent test cases. New migration0004 was applied to a populated local database, and the real local D1 constraint-failure check confirmed complete rollback and successful retry.


# v0.4 · Private learning plans and historical content preservation

Learners can save a goal, weekly minute budget, timezone and optional in-app due notices; schedule private practice, pinned lessons, practical submissions and work reflections; edit or skip plans without changing course evidence. Course-linked progress derives from saved learning actions. Private practice is explicitly self-reported. Plans stay out of owner/facilitator/assessor/peer projections and local ecosystem summaries. The next-step card uses actual saved state.

New cohorts and enrollments carry exact content references. Legacy explicit versions resolve against the unchanged archived seed. Unknown, missing or contradictory historical references fail closed. Learning/review screens preserve work and record downloads without showing a newer rubric. A test-only catalog change proves old cohorts and assessment claims remain pinned. Production still contains one unchanged draft content version; content authoring is not part of this release.

Local ecosystem previews now enforce partner/pathway mapping and block Health. Boolean preferences create no scoped grant or external connection. Selections are independent per partner and historical receipts remain readable without being reinterpreted.

Executed checks: 107 checkout rule tests plus 49 historical-content regressions; 356 local database assertions; full personal/shared/planner/ecosystem browser journeys; 138 responsive surfaces; 29 planner keyboard/form checks; ten unavailable-content UI fixtures. The tablet planner overflow at doubled text size was corrected and its complete journey rerun. Details and limits are in plans-and-pinned-content.md and test-evidence.json. No schema migration or content-seed update was required.


# v0.5 · Private support and safe refresh

Shared members can request help, follow private replies, reopen a resolved request or withdraw it while retaining history. Owners and appropriately scoped facilitators arrange independent handling through metadata queues; only a current assigned handler receives bodies. Role/scope loss durably releases the assignment, and restoration requires a fresh claim. Sensitive categories use owner handling. Own export includes only requests opened by that learner. No staffed response time, external notification, emergency service, accommodation approval or erasure is promised.

Client writes now invalidate earlier reads and serialize immediately. Conflicts refresh current authority while retaining own unsent form input. Revoked handlers lose the private thread on refresh. Dynamic byte reservations keep final withdrawal possible for every open request even when support storage is full. Existing private plans, learning, assessments and appeals retain their rules.

See `support-and-refresh.md` for exact permissions and limits, and `test-evidence.json` for executed evidence.
