# Aplyd Academy quality strategy

Version 0.1 • 5 October 2026 • Design-stage plan

**Product execution status: Not run.** There is no implemented Academy product in this pack. CSV cases specify future verification. Reviewing these documents, checking IDs, or exercising a wireframe does not establish runtime security, correctness, performance, or accessibility.

Read this with [BASELINE.md](BASELINE.md), [FSD.md](FSD.md), [HLD.md](HLD.md), [LLD.md](LLD.md), [test-cases.csv](test-cases.csv), [test-scenarios.csv](test-scenarios.csv), [traceability.csv](traceability.csv), [test-suites.md](test-suites.md), and [UAT.md](UAT.md). The baseline takes precedence over a case if an unresolved product decision changes during implementation; update the requirement, specification and affected cases together.

## Quality objectives

1. Learners can complete useful tasks and demonstrate responsible AI judgment.
2. Progress, evidence, review decisions and credentials remain correct through retries, concurrency, interruption and administrative changes.
3. Permissions hold at every object and tenant boundary. Learner role tags never grant operational permissions.
4. Partners receive only authorized information for their own scope and purpose.
5. Selected audiences can use the complete journey in their supported language and access conditions.
6. Failures are visible, recoverable and explainable without exposing private data.

## Coverage and release boundaries

The register contains 168 cases: 149 R1 cases, 18 R2 cases and one R3 readiness review. There are 21 scenario groups and 46 business-requirement mappings. R1 includes recovery, immutable learning versions, practical human-reviewed assessment, appeals, credential lifecycle, cohort discussion, administration, privacy and one partner journey.

R2 cases apply only when the associated feature is designed and enabled: diagnostics, recommendations, live sessions, selected offline packages, networking, mentoring, events, renewal and commerce. They are not pilot blockers when these features are absent. Before any paid launch, the commerce cases become blockers. The R3 assistant case is an approval/readiness review, not executable assistant coverage; a separate runtime and model evaluation suite is required before that capability launches.

BR references identify the business requirement being evidenced. F references identify canonical functional modules and WF references identify affected screens; a screen reference does not imply that a backend or security case can be proved by its wireframe. Nonfunctional cases link to the nearest affected BR modules and to BASELINE hypotheses; they do not create new service commitments.

## Test layers and distinct responsibilities

| Layer | Purpose and examples | Execution location |
|---|---|---|
| Unit | Pure policy and transition rules: 69/70 threshold, critical criteria, retries, expiry, completion, HMAC raw body | Deterministic domain unit runner with controlled clock |
| Component | Forms, filters, stale display states, language switching, peer/approved-content labeling | UI component harness with mocked interfaces |
| API integration | Real authorization/persistence/transactions: version pinning, ETag, exports, concurrent issue, outbox | Isolated backend and relational/object-store test dependencies |
| Partner contract | OIDC adapter, OAuth scopes, webhook schema/signature/window, duplicate events and permitted sharing | Approved partner simulator and later partner sandbox |
| E2E | Learner/assessor/admin workflow across browser, API and worker | Staging with isolated synthetic tenants |
| UAT | Relevance, understandable feedback, professional judgment, operations and partner usefulness | Facilitated pilot acceptance environment |
| Security/privacy | Object/tenant boundary, account recovery, input safety, SSRF, session/browser protections and minimized output | Isolated security environment; authorized scope |
| Accessibility/usability | Keyboard, assistive technology, translated meaning, mobile/reflow and first-time comprehension | Representative user/device matrix, manual and automated tools |
| Performance/resilience | Defined pilot mix, interrupted writes, worker restart, recovery and observable failure | Representative staging, controlled fault injection |

The pack proposes 17 unit, 6 component, 39 API integration, 14 partner contract, 14 E2E, 26 UAT, 33 security, 5 accessibility, 2 performance, 11 resilience and 1 usability case. Several cases belong to multiple suites. Automated checks cannot replace human assessment-quality, moderation, localization or usability review.

## Synthetic fixture catalogue

All fixtures are fabricated. Do not copy production learner profiles, real medical information, government records, commercial secrets, real credentials, or real payment data.

| Fixture | Required setup |
|---|---|
| SYN-IDENTITY | Test identity issuers IDP-A and IDP-B; same subject 42 with differing issuers; shared display email; valid/expired/wrong-audience tokens; one-time recovery token |
| SYN-TENANCY | Tenant A (Agri example) and tenant B (MSME example); org A1/A2/B1; L-FARM, L-MSME, L-GOV, L-MULTI and L-PEER accounts; explicit enabled/disabled memberships |
| SYN-ROLES | Trainer TR-A scoped COH-1; AUTHOR-A, REVIEW-A, AS-A, AS-B, APR-A, MOD-A, ADMIN-A1, ADMIN-B, platform admin; helper with minimal onboarding permissions |
| SYN-CONTENT | Global approved program PV-1 and draft PV-D; PV-2 with changed activities/rubric; tenant offering O-A1; required A-1/A-2 and optional activity; captions, transcripts and safe resource |
| SYN-ASSESS | AV-1 reference threshold 70 with critical verification/information_handling/judgment criteria; AV-2 threshold 80; scores 69/70/75/95; valid and missing evidence bundles |
| SYN-LIFECYCLE | Invited/active/completed/withdrawn/suspended enrollments; draft/submitted/under_review/passed/failed/voided attempts; appeal/decision supersession; private/shared/suspended/revoked/expired credentials |
| SYN-PARTNER | Tenant-scoped OAuth clients and approved identity adapter; allowlisted local test simulator; controlled HMAC key in test secret store; synthetic receiver responses; no arbitrary external delivery |
| SYN-PRIVACY | Active/withdrawn sharing grants with explicit purpose; controlled replay; private scores/submissions; known reporting counts; export ownership fixtures |
| SYN-NETWORK | Device/browser and network profiles agreed before measurements; fault points for lost responses, DB rollback, unavailable media and worker death |
| SYN-R2 | Future diagnostics, mentor capacity, visibility/blocking, approved payment-provider sandbox events, sponsorship/expiry/renewal rules; only after future specifications exist |

Seed/reset routines should be deterministic and versioned. Use a controlled server clock for boundaries; use actual clock synchronization checks for partner compatibility. Cases must not mutate the same fixture in parallel unless the case explicitly tests concurrency. Negative cases have their own isolated fixture copies.

## Provisional performance and recovery tests

The following are hypotheses from BASELINE, not SLAs or launch promises:

- 1,000 monthly active learners, 100 concurrent sessions, 10 requests/second steady and 30 requests/second for a five-minute burst.
- Interactive read API p95 at or below 800 ms, excluding media and partner latency.
- First meaningful learner content at or below three seconds on a defined simulated network.
- 99.5% monthly availability excluding agreed maintenance.
- Pilot recovery-point objective 24 hours and recovery-time objective eight hours.

Agree request mix, test duration, device/network shape, cold/warm cache behavior, environment comparability, sample size, observation window and exclusions before executing. A five-minute load test cannot prove monthly availability. A restore rehearsal cannot prove all future recoveries; report observed integrity, timing and scope. Benchmark write success and correctness alongside latency so fast failures never count as success.

## Execution workflow

1. Confirm release scope, approved requirements, configured policy and test environment.
2. Run fixture seeding and dependency health checks.
3. Execute relevant unit/component/API tests during implementation.
4. Run smoke after deployment, then relevant change-based regression and mandatory cross-cutting suites.
5. Execute partner sandbox contract, full release regression, accessibility, security and recovery/performance gates.
6. Conduct role-based UAT on the release candidate.
7. Publish observed results, defects, exceptions and signoff; never convert Not run to Pass from document review alone.

Each execution record must contain case ID, observed status (Pass/Fail/Blocked/Not run), release/build, configuration and policy version, fixture version, environment, operator or runner, UTC start/end, observed output, expected-output comparison, redacted evidence, linked defects and retest result. Logs must redact PII, secret values and full submissions. Retain actual product test results separately from the design CSV or add execution-run references rather than overwriting its expected results.

## Defect severity and disposition

| Severity | Examples | Default decision |
|---|---|---|
| S1 Critical | Cross-tenant disclosure, credential awarded without eligibility, private partner disclosure, irreversible evidence loss | Stop release; fix and rerun affected/core suites |
| S2 High | Core learning blocked, false pass, failed revocation, unrecoverable progress, unsupported core-language journey | Block relevant release until fixed |
| S3 Medium | Recoverable noncritical workflow issue, incorrect optional report presentation | Assess affected audience and documented workaround |
| S4 Low | Minor presentation defect without access or meaning impact | Prioritize normally |

Priority (P0/P1) in the register expresses business risk and scheduling, not defect severity. P0 cases must all pass for the in-scope release; P1 cases must execute, with any failed case explicitly assessed. Blocked tests are unresolved evidence, never a pass. Exceptions require accountable business and technical owners, narrow scope, expiry, mitigation and retest date. Critical access/privacy/credential-integrity failures cannot be accepted as ordinary cosmetic exceptions.

## Entry and exit evidence

Entry requires a deployable build, approved pilot roles/languages/partner/issuer, configured assessment/retry/appeal/retention policies, deterministic test data, safe sandbox endpoints, operational owners and accessible test tooling.

Exit requires the mandatory suites in test-suites.md, approved UAT scripts, no unresolved S1/S2 in release scope, verified migrations and restore, passing privacy/tenant/credential checks, support/moderation ownership, and explicit known-gap review. If a prerequisite is undecided, mark the relevant case Blocked during execution and identify the decision owner.

## Design validation versus product execution

Design validation can check CSV schemas, case references, all 46 BR links, consistent phase/screen/module IDs, realistic state rules, suite membership and missing decisions. It can also check the prototype for navigation and specification consistency. These are documentation checks.

Planned product tests require an implemented application and supporting services. None have been executed here. External accreditation, official credential recognition, provider-specific security, true localization quality, actual network performance and production operation remain unverified.
