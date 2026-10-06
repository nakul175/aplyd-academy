# Aplyd Academy Decisions and Delivery Roadmap

This register separates the user's established product direction from proposed design choices and unresolved implementation decisions. It provides a sequenced backlog and review gates for product and engineering planning. No delivery dates, approved budgets or team capacity are assumed.

Version 0.1 dated 5 October 2026.

## Established product direction

Aplyd Academy serves a broad learner audience, including farmers, MSME owners and bureaucrats. It helps them do their jobs well, improve day-to-day productivity and use AI carefully. It includes training, engagement forums, networking, continuous learning, assessment and certification, with tailored integration into ecosystems such as Agri Saha, Health Saha and MSME.

The BRD in this conversation is the business reference. Its 46 functional requirement IDs remain stable throughout this pack. Release ordering and technical choices below are proposed.

## Proposed architecture decisions

| ID | Decision | Reason | Status and consequence |
|---|---|---|---|
| ADR-01 | Start with a modular monolith | Local consistency and simpler pilot operations | Proposed; extract services only for demonstrated need |
| ADR-02 | Separate global account from tenant delivery records | Multi-ecosystem learners need private continuity | Proposed; affects schema and all authorization paths |
| ADR-03 | Treat ecosystems as configuration rather than permission boundaries | One ecosystem may support multiple delivery workspaces | Proposed; tenant membership governs access |
| ADR-04 | Pin immutable published versions at enrollment | Preserve learning and credential meaning | Proposed; later content does not silently change old awards |
| ADR-05 | Require critical assessment gates | Responsible AI judgment cannot be averaged away | Proposed policy; thresholds reviewed per program |
| ADR-06 | Use an outbox with at-least-once delivery | Avoid lost events and inconsistent external state | Proposed; consumers must deduplicate |
| ADR-07 | Keep credential verification private by default | Learners control optional public exposure | Proposed; public access uses an enabled opaque token |
| ADR-08 | Use external approved AI tools in R1 practice | AI learning does not require an embedded assistant | Proposed; separate assistant design in R3 |
| ADR-09 | Use responsive web for the pilot | One maintainable access surface | Proposed; native applications depend on validated need |
| ADR-10 | Generate schema dictionary from one manifest | Prevent field drift | Proposed tooling choice; physical schema still needs engineering review |

## Open decision register

| ID | Decision needed | Owner to assign | Blocking impact |
|---|---|---|---|
| D-01 | First partner ecosystem and learner segment | Product and business | Pilot exercises, integration and recruitment |
| D-02 | Initial capability promise and pathway | Program owner | Content, rubric and pilot success measures |
| D-03 | Initial languages and accessibility support | Product and program | UX, localization and UAT fixtures |
| D-04 | Identity provider and account-linking policy | Engineering and information governance | Authentication implementation |
| D-05 | Credential issuer, wording and external recognition | Business and assessment | Credential claims and verification |
| D-06 | Data residency, retention and privacy obligations | Named governance owner | Hosting and record lifecycle |
| D-07 | Partner exchange purposes and exact fields | Partner and governance | Production exchange authorization |
| D-08 | Technology stack and hosting provider | Engineering | Build and deployment setup |
| D-09 | Assessment retries, appeals and turnaround | Assessment and support | Published policy and staffing |
| D-10 | Pilot size, budget and service targets | Sponsor and engineering | Capacity, restore and support acceptance |
| D-11 | Commercial model and sponsored access | Business | Payments and entitlements before paid release |
| D-12 | Approved AI tools and information-handling instructions | Program and governance | Practice design |
| D-13 | Mentor eligibility, scope and conduct | Community owner | R2 mentor launch |
| D-14 | Credential expiry and renewal rules | Issuer and program | R2 renewal design |

## Delivery backlog

| Epic | Release | Deliverable and acceptance | Dependencies |
|---|---|---|---|
| EP-01 Identity and tenant context | R1 | Registration, recovery, account linking, scoped roles and context tests | D-04, tenant-model review |
| EP-02 Content and catalog | R1 | Reviewed immutable pathway version with locale and access rules | D-01, D-02, D-03 |
| EP-03 Enrollment and learning | R1 | Eligible enrollment, resumable activities and authoritative completion | EP-01, EP-02 |
| EP-04 Applied assessment | R1 | Submission, assigned assessment, critical gates and appeal history | Rubric policy, EP-03 |
| EP-05 Credentials | R1 | Idempotent award, correction, status and controlled verification | D-05, EP-04 |
| EP-06 Cohort community | R1 | Scoped discussions, reporting and moderation | Named moderation owner |
| EP-07 Partner integration | R1 | Identity launch, enrollment and permitted achievement round trip | D-07, partner sandbox |
| EP-08 Reporting and operations | R1 | Defined metrics, support, audit, backup and restore evidence | D-06, D-10 |
| EP-09 Continuous learning | R2 | Diagnostics, recommendations, refreshers and notifications | Pilot evidence and preferences |
| EP-10 Networking and mentoring | R2 | Opt-in discovery, contact control and scoped mentor workflow | D-13, moderation capacity |
| EP-11 Expanded delivery | R2 | Live sessions, further locales and selected offline packages | Audience research and content capacity |
| EP-12 Commercial access | R2 if paid | Pricing, entitlement, payment and refund operations | D-11 and financial-operating review |
| EP-13 Ecosystem scale and optional AI assistance | R3 | Further partner configuration and separately reviewed assistant | Demand, quality and operating-cost evidence |

Each epic must be broken into implementation stories with FSD acceptance criteria and associated test IDs. No effort estimate is invented without team review.

## Review gates

**Gate 1 Product agreement:** Confirm scope, personas, role-specific promises, pilot partner and release boundaries. Review FSD and wireframes with representative learners.

**Gate 2 Design agreement:** Review tenancy, identity, assessment, credentials, dictionary, API contracts, privacy rules and proposed nonfunctional targets. Assign open decision owners.

**Gate 3 Build readiness:** Confirm stack, environments, content owners, synthetic test fixtures, integration sandbox and backlog acceptance criteria. Validate schema migrations and contract compatibility in the chosen runtime.

**Gate 4 Pilot readiness:** Execute required suites, restore drill and UAT. Resolve blocking defects and record approved residual risks. Confirm program, assessor, moderator and support staffing.

**Gate 5 Scale decision:** Evaluate capability outcomes, workplace application, learner access gaps, partner value and cost. Select R2 investment from evidence.

## Documentation change control

Requirement changes retain IDs and record the reason, owner and affected documents. An accepted change to assessment policy, tenant model or sharing affects FSD, LLD, dictionary, APIs, wireframes and tests together. Mark obsolete cases explicitly rather than silently reusing their IDs for unrelated behavior.

The pack is a coherent design baseline for review. Outstanding decisions do not prevent useful design discussion, but they prevent treating provider settings, service levels or credential recognition as approved implementation requirements.
