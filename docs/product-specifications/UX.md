# Aplyd Academy UX, Information Architecture and Wireframe Specification

Version 0.1. Dated 5 October 2026. Proposed design.

Open [wireframes.html](wireframes.html) in a browser for the standalone offline prototype. Use the numbered navigation to inspect each screen or follow the learner journey below. Read this alongside [FSD.md](FSD.md) and [BASELINE.md](BASELINE.md).

The prototype is a layout and flow demonstration with fictional records stored locally in the browser. It is not a live Academy, identity system, access-control implementation, credential issuer, networking service or integration service. It makes no external network requests. Do not enter actual personal, professional or sensitive information. Reset clears this prototype's local demonstration state; it does not touch any other application.

## 1. Experience goals

- A learner understands what a pathway helps them do and how they will demonstrate it.
- Learners with limited digital confidence can identify the next step and obtain help.
- Responsible AI judgment appears inside tasks rather than only in a policy page.
- Learning, feedback and assessment status are unambiguous.
- The learner controls optional sharing and networking visibility.
- Staff workspaces show their assigned scope and explain consequential actions.
- Learners can use the supported journey on mobile and recover from interruption.

## 2. Information architecture

### Learner navigation

**Home:** Continue learning, next steps, achievement summary, support and sharing entry.

**Discover:** Search/filter catalog → pathway details → enrollment.

**My learning:** Pathway outline → activity → saved progress → assessment → feedback/retry/appeal.

**Achievements:** Private learning record → credential details → optional verification sharing.

**Community:** Cohort discussion → contributions → reports; R2 mentor/network connections.

**Settings and support:** Profile, role tags, language, timezone, context, sharing, notification preferences and data requests.

### Staff navigation

Only assigned roles see the corresponding workspace in the production design:

- Trainer: Cohorts, participation and learner support.
- Assessor: Assigned queue, rubric, evidence, decisions; independent appeal review if separately assigned.
- Author/reviewer: Content drafts, version comparison, review and approval.
- Moderator: Assigned community reports and action history.
- Organization administrator: Authorized enrollment and reports.
- Tenant/integration administrator: Tenant offerings, memberships, configuration and approved partner controls.

The prototype intentionally exposes all screens as a review index. Production navigation must not expose staff workflows without assignment, and server authorization applies regardless of navigation visibility.

### Context and record model

The header names active ecosystem and learner role context. Switching it changes discovery relevance and tenant workspace; it grants no role permissions. A learner may also see an aggregate of their own authorized records. Each record identifies its originating tenant/context. No partner may see that aggregate through its integration.

The context selector offers fictional Agri Saha, MSME, Government, Health Saha and direct Academy examples with tailored pathway titles and practice framing. The prototype permits one active sample enrollment. Its originating context is snapshotted so changing the header does not relabel the learning or credential. Sharing switches are separate per simulated context. Multiple simultaneous enrollments, tenant authorization and identity linkage remain specifications.

## 3. Screen inventory and state design

| Screen | Primary purpose and components | Expected production states | Functional reference |
|---|---|---|---|
| WF-01 Onboarding | Display name, language, goals, multi-role tags, adult confirmation; partner/direct identity entry | New/partial profile, validation error, verification pending, unsupported language, identity collision, recovery, age ineligible | F-01; BR-01–04 |
| WF-02 Home | Continue card, status/progress, achievement count, responsible AI prompt, community/sharing links | No enrollment, active, review pending, improvement needed, completed; loading, unavailable, support | F-01/F-03/F-10/F-11 |
| WF-03 Catalog | Search, level filter, offering cards, ecosystem relevance | Loading, matches, no matches, unavailable; restricted offerings excluded | F-02; BR-06–07 |
| WF-04 Pathway details | Outcomes, effort, prerequisites, language, assessment, credential basis, published policies and enrollment | Available, enrolled, invited, full, closed, missing prerequisite, withdrawn/suspended; commercial access later | F-02/F-03; BR-08–11 |
| WF-05 Learning | Outline, activity content, practice instructions, safe input reminder, response and completion | Not started, in progress, acknowledged saved, unsent work, locked, completed, missing resource, connection failure | F-03/F-04; BR-12–22 |
| WF-06 Assessment | Evidence fields, rubric, critical criteria, draft/save/submit, declaration | Ineligible, draft, saving/save failed, submitted/read-only, deadline closed, retry exhausted, attachment blocked | F-04/F-05; BR-21/24–27 |
| WF-07 Feedback and appeal | Decision, criterion feedback, remediation, retry, appeal rationale/status | Awaiting review, passed, failed, appeal opened/under review/upheld/overturned/closed | F-05; BR-15/27 |
| WF-08 Credential | Claim, issuer, standard/version, basis, dates, status, visibility and minimal verification | Pending, issued/private, shared, suspended, revoked, expired, corrected; unavailable verification | F-06; BR-28–31/43 |
| WF-09 Community | Cohort scope, facilitator prompt, peer replies, contribution form and report category | Empty, active, locked membership, posting failure, reported, moderated, removed | F-07; BR-32–34 |
| WF-10 Assessor queue | Assigned scope, attempt evidence, published rubric, scores/critical flags, conflict declaration, finalization | Empty queue, submitted, claimed/under review, conflict, stale edit, finalized, reassigned | F-05; BR-25–27 |
| WF-11 Admin | Organization scope, reporting summary, immutable program version, draft-review actions, integration entry | No records, assigned scope, draft/in review/approved/published/retired, stale edit, denied operation | F-08/F-10; BR-38–41/46 |
| WF-12 Integration and sharing | Partner/purpose/data scope, grant switch, delivery status, export/support requests | Disconnected, grant active/withdrawn/expired, send blocked/allowed/pending/failed, request pending/completed | F-09/F-10; BR-42–44 |
| WF-13 Mentor directory | R2 profile cards, expertise/scope, availability, request, discoverability control | No matches, opted out, requested/accepted/declined/cancelled/completed, blocked contact | F-07; BR-35–37 |
| WF-14 Continuous learning | Relevant update, reason, effort, save/start, reminder preference, renewal information | No suggestions, available, saved, dismissed, access restricted, renewal due/expired | F-11; BR-07/15/31/37 |

Not every expected production state is implemented in the prototype. The matrix identifies the required subsequent design variants, which must be added to implementation acceptance coverage.

## 4. Walkthroughs

### Complete learner-to-credential journey

1. WF-01: Enter a fictional name, confirm adult eligibility and save.
2. WF-03: Search the sample catalog; try a term with no results and remove it.
3. WF-04: Read outcomes and assessment basis; enroll locally.
4. WF-05: Describe the unsupported claim and checking process in at least 20 characters; confirm safe practice.
5. WF-06: Enter at least 20 characters in each evidence field, save the draft, confirm the declaration, then submit.
6. WF-07: Observe awaiting-review status.
7. WF-10: Inspect evidence, provide an integer overall score, mark critical criteria and confirm no conflict. Finalize locally.
8. WF-07: Review feedback. A score of at least 70 with all critical criteria met passes.
9. WF-08: Issue the fictional credential, enable the public preview, then withdraw it.
10. WF-12: Attempt delivery with sharing off, then enable it and simulate delivery.
11. WF-14: Save a suggested practice and choose optional reminder preference.

This is a cross-role design-review walkthrough. In the product, learners cannot act as their own assessors, and issuance is an authorized system/issuer process.

### Critical failure, retry and appeal

Submit an attempt and set an overall score of 99 in WF-10 while leaving the critical-criteria checkbox unchecked. The outcome is “Needs improvement.” Use WF-07 to start a local retry, or enter a rationale of at least 20 characters to open an appeal. The prototype does not resolve appeals or retain an immutable attempt history; production rules require both.

### Context and sharing boundaries

Issue a credential in Agri Saha, then choose MSME in the header. The original credential still identifies its originating context. WF-12 has a separate sharing preference for MSME, but even enabling it cannot send the Agri Saha achievement through that simulated connection. This illustrates the boundary; production access checks require authenticated tenant permissions and granular grants.

### Community and staff review

WF-09 lets a reviewer post a fictional reply and acknowledge a report. WF-11 simulates requesting review of a new draft. These show copy and placement only; no person is contacted and no moderation, publishing or staffing workflow executes.

## 5. Interaction and copy requirements

### Status language

| Situation | Recommended wording | Required next step |
|---|---|---|
| Empty home | “Choose a pathway that helps with your work.” | Browse catalog |
| Locked activity | “Complete [activity] to start this task.” | Open dependency |
| Draft acknowledged | “Draft saved at [time].” | Continue or submit |
| Save failed | “Your latest changes have not been saved.” | Retry; retain local input safely |
| Submitted | “Submitted for review. Your evidence is now read-only.” | View review status |
| Failed assessment | “Needs improvement.” | Criterion feedback and retry/appeal policy |
| Critical criterion failure | “This critical requirement was not met, so this attempt did not pass.” | Explain evidence needed |
| Passed assessment | “You demonstrated the required capability.” | Award status and next learning |
| Credential pending | “Your award is being prepared.” | Retry status/support; no false award |
| Private verification | “This credential is private.” | Optional sharing control |
| Revoked credential | “This credential is revoked and is not currently valid.” | Issuer explanation/support |
| No sharing grant | “This partner cannot receive new achievement updates.” | Review data scope/choice |
| Network failure | “We could not complete this action. Your acknowledged saved work remains available.” | Retry and correlation ID |
| Out-of-scope object | “This item is unavailable in your current access.” | Context/help; no existence leak |

Never label an attendance record “competency certified.” Distinguish optional sharing from required account processing. Use task language understandable to the learner; interface contract terms belong only in staff/support explanations where useful.

### Form behavior

- Place labels above inputs; examples supplement labels and never replace them.
- Indicate required/optional fields in the final UI. Explain format/length constraints before failure.
- Preserve input after validation failure and place errors near fields; a linked error summary is required for multi-field forms.
- Focus the error summary or first invalid field on submission failure. Do not rely on a toast alone for consequential errors.
- Show saving, acknowledged saved and failed states distinctly.
- Disable duplicate finalization while pending, but server idempotency is still required.
- Confirmation before final submission names consequences and the currently applicable policy.
- Show exact context, role and organization scope at staff actions. Reconfirm revocation, destructive moderation or other consequential lifecycle actions with reason and consequences.

### Loading and failure

Skeletons or progress indicators must not invent completion. Existing data can remain visible with an “Updating” label where safe. A retry must not create a duplicate enrollment, submission, credential or charge. Error handling must preserve learner input without persisting prohibited sensitive material.

## 6. Accessibility and inclusion requirements

- Use semantic landmarks, heading order, explicit labels, native input controls and accessible error associations.
- Provide skip navigation, visible keyboard focus, logical tab order, and no keyboard traps.
- The navigation announces the current page. On route change focus moves to the main content heading/landmark without disrupting input.
- Core actions have at least 44px practical touch areas in this prototype; final accessibility review must measure the agreed standard.
- Status changes announce through a polite live region; urgent errors use a targeted alert rather than repeated broad announcements.
- Meaning does not depend on color. Text states accompany progress, decision, sharing and credential status.
- Layout reflows to a single column on small screens; data tables have contained horizontal scrolling where necessary.
- Support text enlargement, reduced motion and sufficient contrast. This prototype has no animated content.
- Provide captions/transcripts and appropriate audio/text alternatives for course media.
- Alternative assessment formats and accommodations must preserve the competency standard rather than penalize access needs.
- Do not make surveillance-based proctoring the default. Define proportionate verification for the credential claim.
- Choose language after learner research; localize validation, feedback, assessment and support as well as course content. RTL layouts need dedicated review if included.
- Low-bandwidth variants should avoid heavy auto-playing media, retain acknowledged progress and explain downloadable-content limits.

Automated layout checks alone do not constitute accessibility conformance. Screen-reader, keyboard-only, magnification and representative learner testing remain required.

## 7. Responsive layout specification

Desktop: persistent left navigation; header context selector; two-column workspaces and three-column home summaries. Forms use a readable width. Assessment evidence and rubric are adjacent when space permits.

Tablet/mobile: navigation becomes a horizontally scrollable review index in the prototype; cards and form columns stack. The production learner navigation should prioritize the current task and move infrequent destinations into an accessible menu. Primary actions remain visible without overlapping form content; saved state and review status remain close to the task.

Tables are contained in overflow regions. Long learner content wraps safely. A sticky header or action bar requires additional keyboard and zoom testing before adoption.

## 8. Privacy by interface design

- No public profile by default.
- Credential verification sharing is separate from partner achievement sharing.
- Show recipient, purpose, fields and effective preference together.
- Public verification preview contains approved name, issuer, achievement and status only.
- Cross-tenant records must never be inferred from context names or a profile aggregate.
- Avoid collecting exact birth dates where adult confirmation meets the approved requirement.
- Do not request real sensitive records in practice exercises or ordinary support tickets.
- A withdrawn grant states future effect and any separate partner-retention process honestly.
- Staff reporting avoids private evidence unless the actor has the specific assessment permission.
- Identity recovery and account linking need dedicated security-reviewed screens before implementation.

## 9. Prototype implementation and limitations

The single HTML file uses local CSS and JavaScript. Hash routes identify WF screens, local storage holds fictional demo state, and reset removes that state. Dynamic learner text is escaped before rendering. Forms use local validation; catalog search, enrollment, practice, submission, assessor scoring, retry, appeal acknowledgment, credential preview, sharing guard, community posts, introduction request, update saving and fictional JSON export are interactive.

Important limitations:

- One sample enrollment; no real multi-tenant identity or authorization.
- One language, English, for demonstration; selected production languages are undecided.
- Local practice rule is illustrative, not a server completion policy.
- Assessor screen uses aggregate score and critical flags; production requires criterion-level scores and authorized independent assessors.
- Retry replaces local display state; production retains immutable attempt history.
- Appeal resolution, moderation, content approval, identity recovery and credential lifecycle changes are specified but not implemented.
- No server autosave, unsaved-navigation guard, concurrent editing, attachment scanning, secret storage, offline submissions or live media. Save the local draft before leaving an evidence screen.
- Local JSON download demonstrates a record export only; it is not a complete regulated-data export.
- There is no real sharing link, webhook, API, email, payment or scheduled notification.
- Mentor screen and recommendation rationale illustrate R2; no R3 assistant is present.

## 10. Prototype verification record

**Executed on 5 October 2026:** Isolated local headless Chrome automation through bundled Playwright, using fictional records and an offline file URL. The first browser attempt lacked bundled Chromium and a sandboxed Chrome launch was unavailable; isolated headless Chrome outside the process sandbox then ran successfully. A test timing issue was corrected to await rendered screens before assertions.

Successful checks:

- All 14 screens render without JavaScript page errors.
- 1,440px, 390px and 360px viewports were checked; no document-level horizontal overflow at either mobile width across all 14 screens.
- Direct profile demonstration, catalog search/no-results, local enrollment and practice completion.
- Evidence submission, read-only submitted state, 99/100 critical failure, retry and passing review.
- Single local credential issue, verification enable/withdraw, no-grant delivery block, granted simulated delivery and cross-context achievement block.
- Context switch preserves the originating pathway/credential title.
- Local community reply and reporting acknowledgment.
- No HTTP/HTTPS requests from the prototype.

Desktop home and mobile assessment screenshots were visually inspected. This verification concerns only the documentation prototype. Product test scenarios, integration tests, accessibility conformance, security controls, real backend behavior, production performance, and UAT are **Not run**.

## 11. UX review and implementation handoff

Review with representative adult learners from the selected ecosystem, including low digital-confidence and low-bandwidth users. Ask them to find a useful pathway, explain its credential claim, save work, interpret a critical failure, identify a safe AI input, withdraw sharing and seek help.

Record task success, assistance required, misunderstandings, time and accessibility issues. Validate terminology, language selection, effort estimates and community usefulness before expanding the design. Staff review should test rubric interpretation, scope visibility, conflicts, finalization consequences and appeal handling.

Before implementation, complete designs for account recovery/linking, attachment states, detailed criterion scoring, appeals resolution, content authoring/review, credential suspension/revocation/correction, moderation actions, report filters, support/data requests and partner failures. R2 additionally needs live sessions, diagnostic results, connection acceptance, mentor requests, renewal and checkout/refund flows.
