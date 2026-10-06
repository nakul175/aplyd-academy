# Aplyd Academy test suites and release gates

Version 0.1 • 5 October 2026 • All listed product tests: **Not run**

Suite membership is explicit in [test-cases.csv](test-cases.csv); the lists below are its release-filtered projections. One case can belong to several suites and should reuse one execution result only when the same build, configuration, fixtures and environment satisfy each suite. A manual case in Smoke needs a person; automated green checks alone cannot complete the suite.

## Suite definitions

### Smoke

- **Owner:** QA + release operator
- **Cadence:** After every deployment and before full release/UAT
- **Environment / fixtures:** Pilot staging; SYN-IDENTITY, SYN-CONTENT, SYN-ASSESS, SYN-LIFECYCLE, SYN-PARTNER
- **Gate / evidence:** All in-scope cases pass. Includes human content/report spot checks; retain workflow/correlation evidence. Restore clean seeded fixture before each run.
- **Exact case IDs:** TC-001, TC-004, TC-011, TC-018, TC-020, TC-026, TC-029, TC-048, TC-061, TC-067, TC-070, TC-075, TC-080, TC-089, TC-098, TC-116
- **Execution status:** Not run

### Unit

- **Owner:** Engineering
- **Cadence:** Each change and merge
- **Environment / fixtures:** Domain runner; controlled clock; SYN-ASSESS/LIFECYCLE; deterministic crypto fixture
- **Gate / evidence:** All policy/transition cases pass. Record input, exact policy version and expected decision; no network required.
- **Exact case IDs:** TC-022, TC-028, TC-030, TC-031, TC-044, TC-047, TC-050, TC-051, TC-054, TC-056, TC-062, TC-069, TC-076, TC-092, TC-108, TC-160, TC-161
- **Execution status:** Not run

### Component

- **Owner:** Engineering + QA
- **Cadence:** Each UI change and merge
- **Environment / fixtures:** UI harness; error and language fixtures
- **Gate / evidence:** All relevant cases pass; capture meaningful accessibility names, validation and state; supplement with manual accessibility suite.
- **Exact case IDs:** TC-002, TC-017, TC-084, TC-128, TC-157
- **Execution status:** Not run

### Integration

- **Owner:** QA + backend engineering
- **Cadence:** Each domain/API change; mandatory before release
- **Environment / fixtures:** Real isolated relational/object storage/worker; SYN-TENANCY and affected fixtures
- **Gate / evidence:** All P0 pass; P1 complete and adjudicated; inspect persisted state, atomicity and authorized response—not only HTTP status.
- **Exact case IDs:** TC-003, TC-013, TC-015, TC-020, TC-021, TC-023, TC-024, TC-025, TC-027, TC-036, TC-037, TC-043, TC-049, TC-053, TC-055, TC-063, TC-064, TC-068, TC-073, TC-074, TC-077, TC-085, TC-087, TC-090, TC-091, TC-093, TC-095, TC-106, TC-111, TC-119, TC-139, TC-158, TC-162, TC-166
- **Execution status:** Not run

### Contract

- **Owner:** Integration lead + named pilot partner
- **Cadence:** Any identity/partner/event change; partner onboarding; before release
- **Environment / fixtures:** Approved adapter and receiver simulators then partner sandbox; controlled HMAC and clock
- **Gate / evidence:** All P0 pass with both sides’ sanitized request/response/event evidence. Real sandbox compatibility required before enabling partner.
- **Exact case IDs:** TC-006, TC-007, TC-008, TC-098, TC-099, TC-100, TC-101, TC-102, TC-103, TC-104, TC-105, TC-107, TC-108, TC-109, TC-110, TC-111, TC-112, TC-113, TC-114, TC-115, TC-165
- **Execution status:** Not run

### Security

- **Owner:** Security lead + QA
- **Cadence:** Relevant changes and every release candidate
- **Environment / fixtures:** Isolated authorized staging; hostile synthetic inputs; origin/session/object-store controls
- **Gate / evidence:** No unresolved S1/S2; preserve denial proof and absence of writes/disclosures; provider-specific review added after selection.
- **Exact case IDs:** TC-004, TC-005, TC-007, TC-008, TC-009, TC-012, TC-016, TC-019, TC-027, TC-045, TC-052, TC-058, TC-060, TC-070, TC-071, TC-072, TC-081, TC-083, TC-086, TC-094, TC-099, TC-100, TC-102, TC-105, TC-109, TC-114, TC-117, TC-118, TC-121, TC-135, TC-136, TC-137, TC-159, TC-163, TC-165
- **Execution status:** Not run

### Tenancy

- **Owner:** Security lead + engineering
- **Cadence:** Any permission, query, export, membership or integration change; every release
- **Environment / fixtures:** At least two tenants, multiple organizations/cohorts, multi-membership learner and scoped admins
- **Gate / evidence:** Every in-scope case passes. Assert denied response plus no restricted fields, attachments, artifacts or secondary effects.
- **Exact case IDs:** TC-009, TC-010, TC-012, TC-013, TC-016, TC-019, TC-024, TC-032, TC-052, TC-058, TC-060, TC-064, TC-071, TC-077, TC-081, TC-085, TC-086, TC-094, TC-096, TC-102, TC-114, TC-117, TC-118, TC-135, TC-136, TC-159, TC-163, TC-166
- **Execution status:** Not run

### Privacy

- **Owner:** Privacy/business owner + QA
- **Cadence:** Any sharing, profile, export, retention, logging or webhook change; every release
- **Environment / fixtures:** Active/withdrawn consent; shared/private award; synthetic secrets; safe log access
- **Gate / evidence:** No unauthorized disclosure; documented purpose/projection; send/replay/cache withdrawal behavior captured.
- **Exact case IDs:** TC-070, TC-071, TC-072, TC-073, TC-077, TC-088, TC-103, TC-111, TC-112, TC-117, TC-119, TC-120, TC-121, TC-122, TC-163, TC-164
- **Execution status:** Not run

### E2E

- **Owner:** QA
- **Cadence:** Changed journey and release candidate
- **Environment / fixtures:** Browser staging + real API/worker; seeded complete role journeys
- **Gate / evidence:** All P0 pass; failed/blocked P1 resolved or accepted. Collect user-visible state and persistent evidence; no mocked pass decisions.
- **Exact case IDs:** TC-001, TC-011, TC-014, TC-018, TC-026, TC-033, TC-048, TC-061, TC-067, TC-075, TC-080
- **Execution status:** Not run

### Accessibility

- **Owner:** Accessibility lead + QA
- **Cadence:** New/changed core screens; every selected-language release
- **Environment / fixtures:** Agreed browsers/mobile devices; keyboard/screen reader; zoom and media alternatives
- **Gate / evidence:** All mandatory core tasks accessible; no critical barrier; automation complemented by manual evidence.
- **Exact case IDs:** TC-034, TC-057, TC-079, TC-124, TC-125, TC-126
- **Execution status:** Not run

### Performance

- **Owner:** Engineering + operations
- **Cadence:** Before pilot; material workload/deployment change
- **Environment / fixtures:** Representative staging; 100 concurrent, 10 rps steady, 30 rps five-minute burst; defined network
- **Gate / evidence:** Measured against BASELINE hypotheses with documented mix/environment; unmet results require capacity or target review. Not an SLA claim.
- **Exact case IDs:** TC-130, TC-131
- **Execution status:** Not run

### Resilience

- **Owner:** Operations + engineering
- **Cadence:** Before pilot; persistence/worker/recovery changes; scheduled restore rehearsal
- **Environment / fixtures:** Staging fault injection; backup isolation; controlled failure points and clocks
- **Gate / evidence:** No partial/duplicate sensitive state; proposed RPO/RTO evaluated; recoverability and reconciliation demonstrated.
- **Exact case IDs:** TC-029, TC-035, TC-065, TC-110, TC-112, TC-123, TC-132, TC-133, TC-134, TC-138, TC-164
- **Execution status:** Not run

### Usability

- **Owner:** UX researcher + business UAT owner
- **Cadence:** Pilot discovery and representative release candidate
- **Environment / fixtures:** Consented representative adults; synthetic tasks; realistic devices; record assisted steps
- **Gate / evidence:** All required tasks observed and barriers reported. Sample limits stated; no extrapolation to untested learner populations.
- **Exact case IDs:** TC-129
- **Execution status:** Not run

### UAT

- **Owner:** Business owner + ecosystem representatives
- **Cadence:** Release candidate after mandatory technical suites
- **Environment / fixtures:** Acceptance staging; farmers/MSME/government plus partner/trainer/assessor/admin roles
- **Gate / evidence:** Execute UAT.md scripts. Critical task/judgment/control outcomes pass; no open S1/S2; named signoffs and limitations recorded.
- **Exact case IDs:** TC-001, TC-010, TC-011, TC-017, TC-018, TC-026, TC-032, TC-033, TC-034, TC-038, TC-039, TC-040, TC-041, TC-042, TC-046, TC-048, TC-057, TC-059, TC-061, TC-066, TC-067, TC-075, TC-078, TC-080, TC-082, TC-088, TC-089, TC-096, TC-097, TC-098, TC-116, TC-120, TC-122, TC-124, TC-126, TC-127, TC-129
- **Execution status:** Not run

### Regression

- **Owner:** QA + engineering
- **Cadence:** Change-based selection each merge; full R1 before release
- **Environment / fixtures:** Deterministic clean staging + unit/component runners; all R1 fixtures
- **Gate / evidence:** All 149 R1 case outcomes reported. Applicable P0 pass; no unexplained omission; R2/R3 absent features excluded explicitly.
- **Exact case IDs:** TC-001, TC-002, TC-003, TC-004, TC-005, TC-006, TC-007, TC-008, TC-009, TC-010, TC-011, TC-012, TC-013, TC-014, TC-015, TC-016, TC-017, TC-018, TC-019, TC-020, TC-021, TC-022, TC-023, TC-024, TC-025, TC-026, TC-027, TC-028, TC-029, TC-030, TC-031, TC-032, TC-033, TC-034, TC-035, TC-036, TC-037, TC-038, TC-039, TC-040, TC-041, TC-042, TC-043, TC-044, TC-045, TC-046, TC-047, TC-048, TC-049, TC-050, TC-051, TC-052, TC-053, TC-054, TC-055, TC-056, TC-057, TC-058, TC-059, TC-060, TC-061, TC-062, TC-063, TC-064, TC-065, TC-066, TC-067, TC-068, TC-069, TC-070, TC-071, TC-072, TC-073, TC-074, TC-075, TC-076, TC-077, TC-078, TC-079, TC-080, TC-081, TC-082, TC-083, TC-084, TC-085, TC-086, TC-087, TC-088, TC-089, TC-090, TC-091, TC-092, TC-093, TC-094, TC-095, TC-096, TC-097, TC-098, TC-099, TC-100, TC-101, TC-102, TC-103, TC-104, TC-105, TC-106, TC-107, TC-108, TC-109, TC-110, TC-111, TC-112, TC-113, TC-114, TC-115, TC-116, TC-117, TC-118, TC-119, TC-120, TC-121, TC-122, TC-123, TC-124, TC-125, TC-126, TC-127, TC-128, TC-129, TC-130, TC-131, TC-132, TC-133, TC-134, TC-135, TC-136, TC-137, TC-138, TC-139, TC-157, TC-158, TC-159, TC-160, TC-161, TC-162, TC-163, TC-164, TC-165, TC-166
- **Execution status:** Not run

### R2

- **Owner:** Feature owner + QA
- **Cadence:** Before enabling each R2 capability; full R2 expansion release
- **Environment / fixtures:** Future specifications, supported languages, partner/payment sandbox, R2 fixture set
- **Gate / evidence:** Only implemented in-scope feature cases execute. Commerce P0 blocks any paid launch; privacy and core R1 regression also required.
- **Exact case IDs:** TC-140, TC-141, TC-142, TC-143, TC-144, TC-145, TC-146, TC-147, TC-148, TC-149, TC-150, TC-151, TC-152, TC-153, TC-154, TC-155, TC-167, TC-168
- **Execution status:** Not run

### R3

- **Owner:** Assistant product/security/quality owners
- **Cadence:** Before any embedded assistant implementation/launch decision
- **Environment / fixtures:** Explicit assistant design and separate evaluation artifact
- **Gate / evidence:** TC-156 review gate plus new model/runtime evaluation suite required; a review pass never establishes runtime assistant quality.
- **Exact case IDs:** TC-156
- **Execution status:** Not run

## Selecting regression after a change

| Change | Minimum additional suites |
|---|---|
| Account, membership or session | Unit/Integration for affected operations + Smoke + Security + Tenancy + Contract identity cases |
| Learning version, activity or completion | Unit/Component/Integration + Smoke + E2E + Accessibility + relevant UAT |
| Rubric, submission, assessment or appeal | Unit/Integration + E2E + Security/Tenancy + credential and responsible-judgment regression |
| Credential or sharing | Unit/Integration + Smoke + Privacy + Tenancy + Contract + credential race/resilience cases |
| Partner endpoint or worker/outbox | Contract + Integration + Security + Privacy + Tenancy + Resilience |
| Content authoring, translation or UI | Component + affected E2E + Accessibility + UAT + content approval/version checks |
| Reports or exports | Integration + Tenancy + Privacy + reporting correctness and audit cases |
| Hosting, database, storage or identity provider | Smoke + Integration + Security + Performance + Resilience + affected Contract |
| R2 paid offering | All commerce cases + R1 permission/assessment/credential regression + payment-provider contract and operations |

Changed-suite selection is additive; it does not replace full R1 candidate execution before initial pilot launch. Once implementation reveals more failure paths, add cases rather than relying only on this initial register.

## Execution order and gates

| Gate | Required evidence | Decision owner |
|---|---|---|
| G0 Design readiness | BR/F/WF/TC references; scope and unresolved decision register reviewed; acceptance policies configured | Product + architecture + quality leads |
| G1 Build readiness | Relevant unit/component/API integration results; reviewed migrations and permission changes | Engineering lead |
| G2 Deployment smoke | All R1 Smoke IDs on deployed candidate; dependency and worker health; safe fixture verification | Release operator + QA |
| G3 Trust and integrity | R1 Security/Tenancy/Privacy/Contract cases; human assessor/appeal/credential checks; no unresolved S1/S2 | Security + assessment/credential + partner owners |
| G4 Operational readiness | Performance/resilience observations; backup/restore evidence; monitoring, support and moderation ownership | Operations + business owner |
| G5 Pilot acceptance | Full R1 Regression results; accessibility and supported-language manual evidence; UAT signoffs | Product + ecosystem + quality leads |
| G6 R2 feature activation | Applicable R2 cases and related R1 regression; updated operations; commerce gate before paid launch | Feature/business owner |
| G7 R3 assistant readiness | TC-156 review and approved separate runtime/model evaluation strategy/results | Assistant product + security + quality owners |

All gates are proposed governance criteria pending stakeholder approval. A signed exception must identify case IDs, scope, impact, mitigation, accountable owner, expiry and retest. Unresolved core authorization, privacy, invalid-award or evidence-loss failures block the affected release. No gate has been executed or signed off in this documentation pack.

## Run evidence template

| Field | Required value |
|---|---|
| Run ID / release / build | Unique run identifier, artifact digest or build version |
| Environment/configuration | Hosting/identity adapter, scope, language, policy and feature flags |
| Data version | Fixture version, seed/reset confirmation |
| Cases | Exact IDs and observed Pass/Fail/Blocked/Not run |
| Timing | UTC execution timestamps and controlled-clock settings if used |
| Evidence | Redacted captures, API/state comparisons, worker/event observations, measured benchmark data |
| Defects | Severity, affected users/scopes, linked fix and retest |
| Approvals | Named owners, outcome, exceptions and dates |

Capture event_id, correlation_id and authorized state for integration investigations. Never store live tokens, HMAC keys, unnecessary PII or raw confidential submissions in shared test evidence.
