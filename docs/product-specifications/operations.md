# Aplyd Academy Operations and Content Governance

This document defines proposed ownership, operating workflows and release procedures for a reliable pilot. Product, program, support and engineering owners must finalize staffing and response targets before launch. No live environment or support service is established by this document.

Version 0.1 dated 5 October 2026. Related documents: [security](security-and-privacy.md), [test suites](test-suites.md), [roadmap](decisions-and-roadmap.md).

## Operational ownership

| Activity | Accountable role | Working role | Review participants |
|---|---|---|---|
| Product scope and release acceptance | Product owner | Delivery lead | Program, engineering and quality |
| Learning outcomes and content | Program owner | Authors and reviewers | Sector experts and accessibility reviewer |
| Assessment standards | Assessment owner | Assessors | Subject experts and quality |
| Credential claims and lifecycle | Credential issuer | Authorized credential operator | Assessment and program owners |
| Communities and reports | Community owner | Moderators and facilitators | Support and sector experts |
| Permissions and privacy workflows | Named information governance owner | Authorized operations | Security, product and partner |
| Service reliability | Engineering owner | Operations team | Quality and support |
| Partner exchange | Integration owner | Partner engineering and operations | Information governance |
| Learner support | Support owner | Support team | Trainers and operations |

Roles are placeholders for assignment, not assertions of current staffing.

## Content publication workflow

Drafts state intended audience, language, competencies, prerequisites, activity requirements, assessment policy and supporting references. The reviewer checks accuracy, sector fit, comprehensibility, accessibility and responsible AI guidance. The issuer or program owner verifies credential claims.

Publishing creates an immutable version. Changes create a new version; existing enrollments retain their original snapshot unless an approved migration is needed. An urgent content correction may require a visible notice or suspension of an unsafe activity. Record the reason, affected cohorts and learner communication decision.

Every item has a review date and owner. Review prioritization considers material inaccuracies, changing tools or work practices, assessment feedback and learner reports. Translation must receive content review, not only mechanical conversion. Retired versions remain available only to the extent required for enrolled learners and historical integrity.

## Assessment operations

Assessors work from assigned queues and the published rubric. Train and calibrate assessors on sample evidence before live assessment. Review disagreement patterns, excessive backlogs and conflicts of interest. An assessor must not approve their own work or bypass a critical criterion.

Submission feedback explains each material gap and the approved retry process. Appeals receive independent review where feasible. An overturned appeal creates a superseding decision and any associated credential action; it does not remove the original decision. Turnaround targets and escalation timing remain open.

## Moderation and support

Communities need a named owner before learners can post. Reports capture content reference, category, reporter and status. Actions include retaining, restricting or removing content, warning a participant, limiting participation and escalating a case. Retain sufficient restricted evidence for review according to the approved policy.

Support verifies identity before account or data actions. Categorize account, learning, accessibility, submission, credential, moderation and integration problems. Route assessment disagreement to appeals rather than treating it as a technical correction. Provide a correlation ID and communicate the next step in plain language.

## Severity and response

| Severity | Example | Immediate action |
|---|---|---|
| Critical | Cross-tenant disclosure or unauthorized credential issuance | Contain affected path, preserve evidence, notify named incident owner |
| High | Widespread login, submission or verification failure | Activate engineering response and learner communication owner |
| Medium | Limited cohort issue or delayed partner deliveries | Triage, bound scope, provide workaround where valid |
| Low | Cosmetic issue or nonblocking content correction | Schedule correction through normal ownership |

Support hours, acknowledgement targets and external communication obligations require agreement. No automatic notification to third parties is authorized by this planning document.

## Runbook for delayed partner delivery

1. Check outbox lag, worker health and delivery response classes.
2. Confirm whether Academy records committed; do not re-enroll learners blindly.
3. Validate current subscription, signing configuration and permission without displaying secrets.
4. Distinguish partner unavailability, rejection, malformed payload and internal failure.
5. Contain invalid repeated delivery and coordinate through the assigned integration owner.
6. Replay only approved entries, with current-permission checks and deduplication.
7. Record resolution and reconcile current partner achievement status.

## Runbook for credential discrepancy

1. Retrieve the authoritative credential and linked assessment or completion decision.
2. Check effective expiry, suspension, revocation, replacement and verification sharing.
3. Verify whether cache or partner event lag caused stale information.
4. If eligibility is wrong, escalate to the assessment or issuer owner; support cannot edit it directly.
5. Apply the authorized correction with linked history and audit record.
6. Invalidate affected public cache and produce permitted lifecycle notifications.
7. Confirm the learner's and partner's permitted views reflect the resolution.

## Backup and recovery

Back up the database and private object references under the approved access policy. Encrypt and restrict backup access. Proposed pilot RPO is 24 hours and RTO is 8 hours, subject to approval.

A restore exercise must prove account linkage, tenant boundaries, enrollment state, assessment evidence access, credential status, outbox deduplication and object completeness. Reconcile completed deletions and permission withdrawals before re-enabling external delivery. Restore evidence must include measured duration, point recovered, exceptions and owner disposition.

## Deployment and rollback

1. Confirm the release scope, change history and required test evidence.
2. Check migration compatibility with running backend and worker versions.
3. Back up or establish the approved recovery point.
4. Deploy to staging and execute smoke and selected regression suites.
5. Apply the approved production rollout and monitor authoritative workflows.
6. If rollback is required, preserve submissions and awards committed during rollout. Do not assume code rollback reverses a data migration.
7. Re-run smoke after rollback or completion and reconcile queued integration events.

Destructive migrations require a separate reviewed plan and recovery strategy. Feature controls should permit disabling optional networking, live sessions or external delivery without losing authoritative learning records.

## Analytics event specification

| Event | Trigger | Allowed analytical fields | Purpose |
|---|---|---|---|
| learner.activated | First meaningful activity | Pseudonymous learner key, tenant, pathway, role category | Onboarding effectiveness |
| enrollment.started | Enrollment becomes active | Tenant, offering, version, acquisition channel | Participation |
| activity.completed | Server accepts completion evidence | Enrollment key, activity type, language, timestamp | Progress and access gaps |
| assessment.submitted | Submission committed | Attempt key, assessment version, cohort | Queue planning |
| assessment.decided | Authorized decision committed | Outcome, competency level, criterion categories | Capability measures |
| credential.issued | Award committed | Credential kind, standard version, issuer | Achievement measures |
| workplace.application_recorded | Learner supplies approved follow-up evidence | Pathway, evidence category, follow-up interval | Practical application |
| community.help_resolved | Facilitator or learner marks help resolved | Community, topic category, resolution interval | Community usefulness |

Exclude names, contact information, prompts, document text and full assessor comments from analytics events. Pseudonymous keys remain controlled information. Do not equate a page view with learning or course completion with demonstrated capability. Reports state metric definitions, denominators, response rates, freshness and limits.

Help-resolution marking is an R2 extension and does not add an unmodeled R1 community action. Workplace follow-up requires an approved pilot evaluation source, collection process and retention policy before collection; the event above is a proposed measurement contract, not an implemented endpoint. Each event must have an owned source and tested field allowlist before instrumentation is enabled.
