# Aplyd Academy Functional Specification Document

Version 0.1. Dated 5 October 2026. Proposed design for review.

This specification translates BR-01–BR-46 into observable product behavior. It is a design artifact; no system implementation, accreditation, or executed acceptance tests are implied. [BASELINE.md](BASELINE.md) defines the canonical contracts. Read alongside [HLD.md](HLD.md), [LLD.md](LLD.md), [UX.md](UX.md), [data-dictionary.md](data-dictionary.md), and the test documents.

## 1. Release boundaries and conventions

**R1:** Adult responsive-web pilot with direct and one partner identity route, multi-role profiles, versioned pathways, tenant offerings, cohorts, resumable learning, practical assessment, human review and appeals, credentials, moderated community, support, scoped reports, consent, and one partner integration. Approved external AI tools and synthetic exercises are used; no embedded AI assistant, paid commerce, offline submission, or open networking in R1.

**R2:** Diagnostics, explainable recommendations, live scheduling, selected offline resources, mentoring and networking, renewal, additional languages and partners, and commerce controls before any paid launch. **R3:** Richer personalization, portfolio, advanced integrations, optional AI assistant after separate design approval.

“Must” refers to the release offering the associated capability. A later feature does not defer its privacy, accessibility, authorization, or integrity requirements.

Identifier conventions: F-01–F-12 modules; WF-01–WF-14 screens; BR IDs refer to the BRD. Examples use fictional adults, synthetic information, a direct Academy tenant and an Agri Saha partner tenant. These examples establish neither the selected pilot ecosystem nor production language support.

## 2. Actor and permission contract

An account identifies a person globally. Role tags such as farmer or MSME owner personalize content; they grant no permission. A delivery tenant is the security boundary; ecosystem is contextual configuration. Membership and role assignment define permissions within a tenant and optionally organization/cohort. Every read and write is checked server-side; hiding a UI control is insufficient.

| Actor | Permitted scope | Prohibited by default |
|---|---|---|
| Learner | Own profile, enrollments, submissions, feedback, credentials, consent; communities where a member | Another learner’s private records; administrative actions |
| Trainer/facilitator | Assigned cohorts, participation, learning support and approved resources | Assessment decisions unless separately assigned assessor role; unrelated cohorts |
| Assessor | Assigned attempts and associated rubric/evidence | Self-assessment; unassigned submissions; learner-wide history |
| Content author | Authorized draft programs and activities | Publishing own draft without configured review approval |
| Content reviewer | Assigned content review and approval | Learner records unrelated to a review function |
| Moderator | Assigned communities, reports and moderation actions | Private assessments or cross-community access |
| Organization administrator | Assigned organization enrollment and authorized reports | Other organizations, full assessment evidence by default |
| Ecosystem/tenant administrator | Tenant configuration, authorized memberships and reports | Other tenants or arbitrary learner-private profile access |
| Platform operator | Explicit operational permissions and audited support access | Routine unrestricted browsing of learner content |
| Partner client | Named API scopes, one tenant, authorized purpose and current sharing permission | Personal aggregate history, other tenant affiliations, private evidence |
| Public verifier | Shared token response with minimal approved display information | Scores, submissions, contact data, or other ecosystem memberships |

People may have multiple assignments. The active administrative workspace is explicit. Removing an assignment takes effect on the next protected request. A learner context switch changes catalog and navigation, while personal records remain available through an authorized own-record view.

## 3. Common functional rules

Numeric field limits are proposed validation defaults for review. Assessment windows are offering-specific and captured in the enrollment policy snapshot; shared assessment standards carry competency rules rather than absolute cohort dates. Published program-specific assessment thresholds and allowances are authoritative.

- Required fields have visible labels and inline errors. Trim incidental whitespace; retain meaningful internal text. Validate on the client for convenience and on the server authoritatively.
- IDs are UUIDs. Timestamps use UTC RFC3339 in storage and the learner’s display timezone. Browser local time never decides expiry or assessment deadlines.
- API failures distinguish invalid input, unauthenticated access, forbidden actions, out-of-scope/not-found objects, conflicting state, stale edits, business-rule failure, throttling and temporary unavailability. Show correlation IDs for support without exposing sensitive details.
- Retryable mutations require an idempotency key. Repeating the same operation returns its prior result; changing the body under the same key returns conflict. Draft edits use version checks to avoid silently overwriting others’ work.
- Unsaved work receives navigation confirmation. Saved draft status and last saved time are visible. Autosave failure must not display “Saved.”
- User-generated material is rendered safely. Attachments use configured format/size limits, private storage and authorized access; unsafe files are withheld from reviewers pending policy handling.
- Configuration limits, such as submission size, appeal window and retries, are published before enrollment. Changes cannot silently worsen an active learner’s agreed policy snapshot.
- Tenant context is server resolved from authenticated membership, never trusted solely from a URL or form value.

## 4. F-01 Identity and context

**Coverage:** BR-01, BR-02, BR-03, BR-04. **Screens:** WF-01, WF-02. **Release:** R1.

**Preconditions:** A supported direct offering or approved partner entry exists. Direct onboarding is for adults; age eligibility confirmation is required without collecting date of birth by default.

**Main flow:** (1) Learner chooses direct sign-in/registration or partner sign-in. (2) Approved identity service verifies the account. (3) Learner confirms adult eligibility and required service terms, separately from optional sharing choices. (4) Profile captures display name, language, goal and optional role tags. (5) Eligible memberships and ecosystem contexts are loaded. (6) Home opens with explicit active context.

**Alternates:** Existing account resumes onboarding; verified recovery returns to the same account. A new partner issuer/subject can be linked only through approved proof of existing account ownership. Same email across identities is not proof. Disabled membership does not regain access through a context switch. Unsupported language shows the supported options. Ineligible age stops enrollment and offers support information.

**Fields/rules:** Display name 1–100 characters; language must be supported; timezone must be valid; at least one stated goal or “Explore” option; optional role tags from an extensible controlled list with multiple selections. Optional biography is not needed in R1. Private contact details never become discoverable through profile completion. Legal-consent versions and acceptance time are recorded.

**Acceptance:** A learner can register, recover access, revise goals, and switch between permitted contexts while retaining their own records. Role-tag edits never add administrative or partner privileges. Identity collision and withdrawn membership produce safe, explainable outcomes.

## 5. F-02 Discovery and enrollment

**Coverage:** BR-05, BR-06, BR-07, BR-11. **Screens:** WF-03, WF-04. **Release:** Catalog and enrollment R1; diagnostics/recommendations R2.

**Preconditions:** Offering is visible to the learner’s tenant and audience; associated published program version exists.

**Main flow:** (1) Search/filter by topic, role, language, level and format. (2) Open pathway details showing outcomes, prerequisite, effort, delivery, assessment and credential claim. (3) Verify eligibility and capacity. (4) Review published submission, retry, appeal and sharing policies. (5) Enroll or accept invitation. (6) Store immutable program version and policy snapshot; open the first activity.

**Alternates:** No matches offers removable filters and relevant support. Closed or full cohorts explain availability; an optional waitlist requires later approval and is not silently assumed. Missing prerequisite offers a defined foundation route. Existing active enrollment opens its progress instead of duplicating it. Invitation acceptance is bound to the intended account and valid offering; expired invitation needs reissue. Suspended or withdrawn enrollment cannot continue until an authorized transition.

**Fields/rules:** Search query up to 200 characters; filters use valid catalog values. Eligibility is determined from published policy, membership and verified prerequisites. Program edits create a new version; existing enrollments are not automatically migrated. There is no payment gate in R1.

**Acceptance:** Published detail matches the enrolled snapshot. Two concurrent enrollment requests produce one effective enrollment. Completed learning is not erased by filtering or context switching. R2 diagnostics are optional unless a pathway transparently requires them; recommendations state their basis and assigned learning is clearly labeled.

## 6. F-03 Learning and cohorts

**Coverage:** BR-08, BR-09, BR-10, BR-12, BR-13, BR-14, BR-15, BR-16, BR-17. **Screens:** WF-02, WF-05. **Release:** Core R1; live scheduling and selected offline resources R2.

**Preconditions:** Active enrollment or explicitly permitted continuing access exists; required prerequisite activities are complete.

**Main flow:** (1) Open next activity from the pathway outline. (2) Read/listen/watch supported material. (3) Complete a practice task with instructions, sample inputs and expected evidence. (4) Save work. (5) Meet server-checked activity completion rule. (6) Receive feedback or move to next available activity. (7) View cohort resources and facilitator support.

**Alternates:** Interrupted connection preserves acknowledged progress; unsent local work remains marked unsent. Locked activity states the dependency. Missing/retired resource shows an alternative or support route without granting completion. Facilitator cancellation must not falsely mark attendance. Accessible alternate content should satisfy the same learning objective. Retries resume rather than duplicate progress records.

**Rules:** A click on “complete” or a client percentage cannot itself establish mandatory task completion. Video watch metrics can support participation but are insufficient evidence of competence. Progress is bound to enrollment and immutable activity version. Completed enrollment requires all mandatory activities and a final passing assessment when specified. Trainers see assigned cohorts only.

**R2 contracts:** Live sessions specify timezone, join instructions, attendance basis, cancellation and accessibility arrangements; recording access requires appropriate permissions. Offline packages carry version and access expiry, keep private data minimal, and clearly state stale content. R2 package downloads do not imply offline assessment submission; that requires a separate approved conflict and security design.

**Acceptance:** Progress resumes on a supported device after interruption. A completion attempt fails with a specific unmet requirement. Supported-language and accessible variants are available for every activity required by the pilot audience. Remedial feedback links to relevant practice.

## 7. F-04 Responsible AI practice

**Coverage:** BR-18, BR-19, BR-20, BR-21, BR-22, BR-23. **Screens:** WF-05, WF-06. **Release:** Instruction and assessed practice R1; optional assistant R3.

**Preconditions:** Program defines suitable approved tools and synthetic or authorized task material.

**Main flow:** (1) Learner identifies the task and intended audience. (2) Classifies the information they propose to use. (3) Chooses an approved tool or declines AI where unsuitable. (4) Records instructions and generated draft as evidence. (5) Checks claims and missing context using appropriate sources. (6) Revises the work and describes limitations or escalation. (7) Submits the final artifact and judgment evidence.

**Alternates:** Learner identifies restricted information and substitutes synthetic input. Unsupported factual claim triggers verification rather than forced acceptance. AI unavailable allows a documented alternative activity where approved. A high-consequence sector scenario asks for expert referral rather than an unsupported decision. A learner may demonstrate that AI should not be used; suitability is assessed independently of enthusiasm for AI.

**Evidence fields:** Task, audience, inputs classification, prompt/instructions, draft, checks and source references, identified errors, revised output, final judgment. No API credentials or sensitive real-world records are requested. Source references support verification but are not automatically treated as authoritative.

**Rules:** Rubric dimensions include task quality, verification, information handling and judgment. Critical privacy or judgment failures cannot be averaged away. Published AI-assisted content has accountable human approval and versioning. The R3 assistant requires a separate data-use contract, content quality evaluation, permitted tools, limitation disclosure, escalation and cost controls; it cannot issue credentials or decide appeals autonomously.

**Acceptance:** The learner can complete and explain a suitable task, detect planted errors, refuse inappropriate inputs and identify when expert help is needed. Final output quality alone cannot pass an assessment requiring process evidence.

## 8. F-05 Assessment and appeal

**Coverage:** BR-24, BR-25, BR-26, BR-27. **Screens:** WF-06, WF-07, WF-10. **Release:** R1.

**Preconditions:** Learner is eligible under enrollment snapshot; published assessment/rubric version exists; attempt allowance remains; submission window is open.

**Learner flow:** (1) Read evidence and scoring requirements. (2) Create draft attempt. (3) Save responses and allowed attachments. (4) Validate all required evidence and acknowledge submission declaration. (5) Submit once. (6) Receive submitted/under-review status. (7) Receive criterion-level feedback and decision. (8) Start permitted retry or appeal.

**Assessor flow:** (1) Open authorized assigned queue. (2) Declare/resolve conflict of interest. (3) Claim assigned work with concurrency checks. (4) View safe authorized evidence and published rubric. (5) Score all criteria and mark critical criteria met/unmet. (6) Add actionable feedback. (7) Save draft or finalize decision. (8) Finalization atomically records immutable decision and eligible completion/credential event processing.

**Appeal flow:** Learner identifies decision and rationale within the published window. An independent authorized reviewer evaluates it. “Upheld” retains the original decision; “overturned” creates a new superseding decision; history remains intact. Closing an appeal follows notification and recorded resolution. The reviewer cannot silently edit the original record.

**Alternates:** Missing field stays draft with inline error. Deadline crossing is evaluated at server receipt; drafts are not submissions. Duplicate submit returns original receipt. Retry exhaustion offers the published support/appeal route. Unsafe attachment blocks review of that file and follows remediation policy. Stale assessor edit requires reload/reconciliation. Unassigned or self-related attempt is rejected. AI scoring, if later introduced, remains advisory where professional judgment is required.

**Fields/rules:** Text evidence has configured published limits; allowed file types and max size are shown. Reference scoring is ≥70/100 overall and every critical criterion met, but each published assessment specifies its own thresholds. Rubric weights total 100. Decision includes assessor, criterion scores, critical flags, outcome, rationale and timestamp. Appeal rationale 20–4,000 characters; supporting evidence optional under configured limits. Appeal timing and retry counts remain policy decisions and must not be hard-coded from illustrative wireframes.

**Acceptance:** A high aggregate score with one failed critical criterion fails. A submitted attempt becomes read-only to the learner. A retry is a new attempt. Unauthorized, conflicting and repeated finalization cannot create contradictory outcomes. Appeal decisions preserve audit history and trigger consistent downstream credential handling.

## 9. F-06 Credentials

**Coverage:** BR-28, BR-29, BR-30, BR-31. **Screen:** WF-08. **Release:** R1 issue/correct/status/verify; R2 renewal.

**Preconditions:** Defined participation, completion or competency requirements are met and named issuer is authorized.

**Main flow:** (1) Eligibility event or authorized issuance request is evaluated. (2) Issue one credential per enrollment, kind and standard version. (3) Learner views claim, issuer, assessment basis, date, validity and status. (4) Learner may enable public verification and select approved display label. (5) Public verifier receives only permitted fields through an unguessable token.

**Alternates:** Issuance delay shows pending status, not an award. Correction creates traceable correction history under issuer authority. Suspension and revocation include recorded reason, authorized actor, effective time and learner notification. Revoking sharing makes the public route unavailable. Expiry checks current server time even before a scheduled status-update job runs. Revoked credentials cannot be restored through a sharing switch; a separate authorized lifecycle process is necessary.

**Rules:** Completion certificates do not claim demonstrated competence without assessment. No accreditation claim is allowed without approved evidence. Default credential visibility is private. Public verification excludes scores, submissions, contact data and other tenant memberships. Verification tokens and URLs contain no plaintext personal identifiers. Eligibility superseded by an appeal is reevaluated without issuing duplicate awards.

**R2 renewal:** Renewal rule specifies relevant refresher, evidence, timing, price if any, grace treatment and resulting standard version. Expiry does not erase historical achievement, but validity must be unambiguous.

**Acceptance:** Replaying issue events yields one credential. Private verification is unavailable. Shared verification exposes only the approved minimal record and current status. Suspension, revocation, correction and expiry are visible consistently in learner and verifier views.

## 10. F-07 Community and networking

**Coverage:** BR-32, BR-33, BR-34, BR-35, BR-36, BR-37. **Screens:** WF-09, WF-13. **Release:** Moderated cohort community R1; open networking, mentors/events R2.

**Preconditions:** Learner holds active membership in the community and has accepted participation rules.

**Main flow:** Open relevant community; read discussions; create a question or reply; facilitator/peer responds. Optional useful-response marking is an R2 enhancement and has no assessment or credential effect. Report inappropriate material with category and optional details. Moderator evaluates assigned report, records a reasoned action and communicates as appropriate.

**Alternates:** Removed membership stops posting and private reads. Reported content remains pending unless policy triggers immediate hiding; a report alone is not proof. Duplicate posts may be suppressed with confirmation. Removed material shows a safe explanation where appropriate without republishing harmful content. Peer advice is labeled as peer contribution and can be escalated for expert review.

**Fields/rules:** Title 5–160 characters; body 10–5,000 characters; report reason selected from controlled categories with optional detail up to 2,000 characters. Safe rendering, rate limits and attachment policies apply. Reuse outside the original group requires separate permission. Moderation actions and reasons are audited. Contact preferences and blocks prevent prohibited contact.

**R2 contracts:** Learner expressly opts into professional discoverability and selects public fields. Connection request recipient can accept, decline or block; it never reveals private contact details automatically. Mentor listing distinguishes verified scope, availability and fee if any. Requests track requested/accepted/declined/cancelled/completed and prohibit automatic assignment without availability. Events specify audience and participation rules.

**Acceptance:** Nonmembers cannot read a private cohort thread. Learners can report content and moderators can act within their scope. Networking remains opt-in and reversible. The learner can access useful cohort support without exposing a public profile.

## 11. F-08 Content and administration

**Coverage:** BR-38, BR-39, BR-40, BR-46. **Screen:** WF-11. **Release:** R1.

**Preconditions:** Actor has explicit tenant, organization or content permissions.

**Main flow:** Create program draft; define outcomes, activities, evidence and rubric; add translations and review dates; request review; assigned reviewer records approval or required changes; authorized publisher creates immutable published version; administrator creates tenant offering/cohort and assigns eligible staff; monitor delivery and content health.

**Alternates:** Missing owner/outcomes/rubric prevents publication. Critical translation absent blocks publication for that supported audience. Changes after publication require a new version. Reviewer asks for changes with actionable notes. Unauthorized organization IDs fail even under an authorized tenant. Stale configuration edit returns a conflict. Revoking a role preserves historical actions but blocks new actions.

**Fields/rules:** Program title 3–160 characters; summary 20–2,000; owner, audience, language, objectives and review date required. Mandatory activities, assessment rules and credential basis are mutually consistent. Published weights/thresholds validate before approval. Offering contains program version, audience, dates, capacity and policy snapshot. Review and publication are distinct permissions; self-approval exception requires an explicit governance decision rather than assumption.

**Acceptance:** A draft cannot appear in learner catalog. Program updates do not rewrite current enrollments. Organizations cannot see each other’s unauthorized records. Publishing, permission edits, assessor actions and credential changes generate auditable events with actor, scope, time and change reference.

## 12. F-09 Ecosystem integration

**Coverage:** BR-42, BR-43. **Screen:** WF-12. **Release:** One bounded integration R1; more patterns R2/R3.

**Preconditions:** Approved partner client, tenant, interface scopes, identity issuer, data purpose and sharing rules exist.

**Main flow:** (1) Partner deep-links to permitted offering using opaque identifiers. (2) Browser identity adapter authenticates issuer/subject. (3) Approved identity linkage and tenant membership are resolved. (4) Partner enrollment uses purpose-scoped client authorization. (5) Learner completes Academy learning. (6) Transaction writes domain achievement and outbox event. (7) Worker rechecks sharing permission and sends minimal authorized payload. (8) Partner verifies signature and deduplicates event ID.

**Alternates:** Unknown identity prompts approved onboarding/linking. Disabled membership denies access despite valid sign-in. Expired token returns authentication failure. Wrong tenant, scope or purpose returns protected failure. Duplicate enrollment returns original result. Consent withdrawal blocks queued delivery and replay. Delivery failure uses bounded retries; exhausted work reaches controlled dead-letter handling. Unsafe webhook destination is rejected before activation.

**Rules:** OAuth client authorization is not equivalent to learner consent; both relevant controls apply. Partner identity uses issuer/subject, never email matching alone. At-least-once event delivery means consumer deduplication is required. Signature covers timestamp and raw body; proposed replay window five minutes is configurable and must be reviewed. Status sharing does not include private evidence or unrelated history. Replaying an event reevaluates current sharing permission.

**Acceptance:** Partner entry, enrollment and permitted achievement return work end to end. Duplicate, out-of-order, cross-tenant, revoked-permission and unreachable-partner cases have predictable outcomes. Learner sees connected partner, data scope and revocation control. Operational details are restricted to integration administrators.

## 13. F-10 Privacy, support and reporting

**Coverage:** BR-41, BR-44 and cross-cutting BR-39/43/46. **Screens:** WF-02, WF-11, WF-12. **Release:** R1.

**Preconditions:** Actor has applicable own-record or reporting permission.

**Main flow:** Learner reviews sharing grants by recipient/purpose; grants or withdraws an optional permission; requests record export or account-data action; receives acknowledgment and request status. Support ticket captures category and safe description. Authorized reporting user chooses in-scope program/organization/date range and views defined metrics.

**Alternates:** Withdrawal does not claim to erase data already legitimately delivered; UI describes applicable partner process. A deletion request cannot bypass documented retention or legal obligations; support explains record-specific disposition after review. Export requires reauthentication where appropriate and uses an expiring private download. Report with no data shows zero/empty appropriately; small-cohort reporting follows approved suppression policy. User cannot attach credentials/secrets to support logs.

**Fields/rules:** Grant has recipient, purpose, specific data scope, active state and validity if used. Required processing is described separately from optional sharing. Support subject 5–160 characters, detail 10–5,000; exclude unnecessary sensitive content. Reporting denominators, filters and “as of” time are visible. Full submissions and criterion scores are not included in ordinary sponsor reports.

**Acceptance:** Revoking optional sharing blocks the next send and replay. Account export contains only the requester’s authorized records. Organization report filters cannot widen permission. Support actions affecting protected data are recorded. No retention duration is implied until governance decides it.

## 14. F-11 Continuous learning

**Coverage:** BR-07, BR-15, BR-31, BR-37 plus continuous-learning BRD objective. **Screen:** WF-14. **Release:** Basic next-pathway/updates R1; richer recommendations/refreshers R2; personalization R3.

**Main flow:** Learner sees a relevant published update or next pathway; understands topic, effort and why it is relevant; chooses to start, save or dismiss; completes a useful activity; receives updated learning record. Notification settings separate essential operational notices from optional learning prompts.

**Rules:** A recommendation cannot alter permissions or an active enrollment. Learner can correct role/goals. Dismissed optional suggestions are respected. Renewal reminders state existing validity rather than implying renewal through opening a link. R3 portfolio sharing is field-selective and private by default. Recommendation evaluation includes usefulness and application rather than maximizing time spent.

**Acceptance:** Learner can identify a next step and control optional reminders. Expiring credentials show honest status. An inaccessible pathway is not recommended as immediately available without explaining prerequisites or access conditions.

## 15. F-12 Commerce

**Coverage:** BR-45. **Screen:** Future checkout derived from WF-04; no R1 payment flow. **Release:** R2 before any paid offering.

**Preconditions:** Approved commercial model, tax/invoice/refund obligations, payment provider and support process exist.

**Main flow:** Show total price, currency, inclusions, access period, sponsorship and refund terms; create purchase intent; redirect through approved payment flow; confirm provider result using trusted server evidence; grant entitlement once; issue receipt; show access state.

**Alternates:** Failed/cancelled/pending payment does not grant paid access. Duplicate notifications cannot duplicate entitlements. A sponsored seat does not charge the learner. Refund, chargeback or subscription expiry follows published entitlement policy and does not rewrite academic decisions. Existing credentials retain truthful historical status according to credential policy.

**Rules:** Money uses currency and integer minor units. Price and terms are frozen for the purchase. Paid access never changes passing criteria. Cancellation must show effective date and access consequences. Billing administrators do not gain access to assessment evidence. Full provider callback, refund and reconciliation contracts are required before commerce implementation.

**Acceptance:** Entitlements reconcile with trusted payments, refunds and expiry; published price equals charged amount; failures can be recovered without repeat charges. Commercial configuration must not affect assessment results.

## 16. State transition contract

| Object | Allowed transitions | Guard/effect |
|---|---|---|
| Enrollment | invited → active; active → completed/withdrawn/suspended; suspended → active/withdrawn | Accept invitation and eligibility; completion requires mandatory work and final pass if required; reinstate only authorized actor |
| Activity progress | not_started → in_progress → completed | Published completion rule checked; retrying save cannot regress completed state |
| Attempt | draft → submitted → under_review → passed/failed; permitted states → voided | Required evidence, timing and allowance; finalized decision immutable; void reason audited |
| Appeal | opened → under_review → upheld/overturned → closed | Eligible window; independent reviewer; overturned creates superseding decision |
| Credential | issue → issued; issued → suspended/revoked/expired; suspended → issued/revoked/expired | Authorized lifecycle action and reason; reinstatement only before expiry if allowed; revoked/expired history retained, renewal is separate |
| Content | draft → in_review → approved → published; in_review → draft; published → retired | Review/approval guard; published version immutable; retirement controls new enrollment without silently removing required material |
| Sharing grant | inactive → active → withdrawn/expired | Explicit purpose and scope; worker checks effective permission on send/replay |
| Moderation report | opened → reviewing → actioned/dismissed → closed | Scoped moderator, recorded reason and appropriate notification |

Content and moderation states are conceptual workflow states; detailed persistence appears in LLD. If an entity's state requires further governance choices, invalid transitions remain rejected until explicit policy exists.

## 17. BRD coverage register

| BR | Functional delivery | Release |
|---|---|---|
| BR-01 | F-01 direct and partner registration | R1 |
| BR-02 | F-01 minimal editable profile | R1 |
| BR-03 | F-01 multiple roles/memberships | R1 |
| BR-04 | F-01 recovery and assisted onboarding | R1 |
| BR-05 | F-02 diagnostics | R2 |
| BR-06 | F-02 search/filter | R1 |
| BR-07 | F-02/F-11 recommendations and assignments | R2; assigned labeling R1 |
| BR-08 | F-03 content hierarchy | R1 |
| BR-09 | F-03 self-paced/cohorts | R1 |
| BR-10 | F-03 live scheduling/attendance | R2 |
| BR-11 | F-02 published pathway requirements | R1 |
| BR-12 | F-03 resumable progress | R1 |
| BR-13 | F-03 practical exercises | R1 |
| BR-14 | F-03 supported formats | R1 |
| BR-15 | F-03/F-05/F-11 feedback and remediation | R1 |
| BR-16 | F-01/F-03 accessible supported-language journeys | R1 |
| BR-17 | F-03 selected offline resources | R2 |
| BR-18 | F-04 responsible AI foundation | R1 |
| BR-19 | F-04 sector tasks | R1 |
| BR-20 | F-04 suitability scenarios | R1 |
| BR-21 | F-04/F-05 judgment assessment | R1 |
| BR-22 | F-08 human-reviewed AI-assisted content | R1 |
| BR-23 | F-04 embedded assistant | R3 optional |
| BR-24 | F-05 assessment formats | R1 |
| BR-25 | F-05 published rubrics | R1 |
| BR-26 | F-05 authorized human review | R1 |
| BR-27 | F-05 retries/accommodations/appeals | R1 |
| BR-28 | F-06 credential claim distinctions | R1 |
| BR-29 | F-06 verifiable credentials | R1 |
| BR-30 | F-06 lifecycle controls | R1 |
| BR-31 | F-06/F-11 renewal | R2 |
| BR-32 | F-07 cohort/ecosystem discussion | R1 |
| BR-33 | F-07 reporting/moderation | R1 |
| BR-34 | F-03/F-07 peer/facilitator support | R1 |
| BR-35 | F-07 opt-in networking | R2 |
| BR-36 | F-07 mentors | R2 |
| BR-37 | F-07/F-11 continuing events | R2 |
| BR-38 | F-08 administration | R1 |
| BR-39 | F-08/F-10 scoped access | R1 |
| BR-40 | F-08 content lifecycle | R1 |
| BR-41 | F-10 authorized reporting | R1 |
| BR-42 | F-09 bounded integration | R1; expand R2/R3 |
| BR-43 | F-06/F-09/F-10 sharing/verification | R1 |
| BR-44 | F-10 export/data requests | R1 |
| BR-45 | F-12 commercial controls | R2 before paid launch |
| BR-46 | F-08 and all protected mutations audit | R1 |

## 18. Open functional decisions and review checklist

Confirm pilot audience and languages; identity provider and linking/recovery policy; program outcomes; issuer and credential claim; assessment cutoffs, deadlines, retries and appeal windows; attachment limits; cohort access after completion; independent reviewer staffing; moderation standards; sharing scopes; export/retention handling; support arrangements; accommodation policy; partner capabilities; and program retirement treatment.

Review approval requires business owner agreement on outcomes and releases, subject-matter approval of tasks/rubrics, UX review with representative users, security/privacy review of boundaries and sharing, assessor/moderator/support operating readiness, integration contract agreement, and test-case traceability. These are proposed readiness gates, not completed approvals.
