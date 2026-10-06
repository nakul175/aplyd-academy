# Aplyd Academy user acceptance plan and scripts

Version 0.1 • 5 October 2026 • **All scripts: Not run; no signoff obtained**

This plan tests whether a release candidate is useful and usable for its supported audience, and whether partner, trainer, assessor and admin operations uphold the product promise. It is separate from a learner's competency assessment: a learner failing a deliberately unsafe exercise may demonstrate that the product's assessment controls work correctly.

Reference [test-strategy.md](test-strategy.md), [test-cases.csv](test-cases.csv), [FSD.md](FSD.md), [UX.md](UX.md) and [BASELINE.md](BASELINE.md). Use synthetic tasks and accounts. No live business, agricultural, health or government decision is made during UAT.

## Preparation and facilitation

The pilot must choose its actual ecosystem, languages, identity adapter, credential issuer, content owners and assessment/retry/appeal rules before UAT. Farmer, MSME and bureaucrat scripts are reusable sector variants; execute those selected for the release rather than claiming all sectors supported.

Recruit adult participants representative of the chosen audience, including varied digital confidence, supported language, device/connectivity and accessibility needs. Define and report sample size before running. Record recruitment limitations. A small convenience sample cannot establish that the product works for everyone.

Use a release candidate that has passed applicable technical gates. Seed two tenants and scoped roles. Give participants task cards without revealing expected answers. Facilitators may provide planned onboarding assistance, but must record each intervention. Do not teach a participant the required AI-judgment answer while scoring that task.

### UAT task scoring

| Score | Observation |
|---|---|
| 0 | Cannot complete, incorrect result, or critical control/meaning failure |
| 1 | Completes only after unplanned substantive intervention or encounters a significant barrier |
| 2 | Completes correctly with the assistance explicitly planned for the audience |
| 3 | Completes correctly independently |
| N/A | Outside approved release scope; reason recorded before signoff |

Record the score and evidence for each step. Do not average away a critical failure. Proposed acceptance requires every mandatory in-scope task to score 2 or 3 and all critical controls to pass, with no unresolved S1/S2 defect. Treat scores as evidence for stakeholder review, not an approved numeric promise. Separate product defects, content confusion, missing assistance and learner knowledge gaps.

For competency evaluation use the pathway's pinned rubric; the reference policy is at least 70/100 plus every critical criterion. UAT scores do not award credentials.

## UAT-01 Farmer learner — practical learning with careful AI use

**Role:** Adult farmer learner, preferred supported language, limited digital confidence.  
**Context:** Tenant A example agricultural offering; approved guided synthetic task.  
**Fixtures:** L-FARM, O-A1/PV-1, captions/transcript, synthetic crop information with uncertain local relevance; incomplete and complete evidence bundles.  
**Trace:** BR-02, BR-04, BR-11–13, BR-16, BR-18–21, BR-24, BR-29. F-01/F-02/F-03/F-04/F-05/F-06. WF-01/04/05/06/07/08.  
**Cases:** TC-010, TC-011, TC-157, TC-018, TC-026, TC-033, TC-034, TC-038, TC-039, TC-043, TC-048, TC-067, TC-127, TC-129.

| Step | Participant task | Expected business outcome | Critical? |
|---|---|---|---|
| 1 | Join with planned facilitator support and choose role/language | Minimal profile created; no unnecessary personal information requested | No |
| 2 | Find pathway and explain what it will help them do | Learner identifies outcomes, effort, task and achievement type before enrolling | No |
| 3 | Open text/audio alternative, begin learning, leave and return | Suitable format usable; approved progress resumes | No |
| 4 | Interpret supplied synthetic note using approved AI practice | Learner identifies missing local context and prepares questions/checks before acting | Yes |
| 5 | Explain which information is safe to include and when to ask an expert | Appropriate information handling and escalation demonstrated | Yes |
| 6 | Submit draft, checks, corrections and final artifact | Complete evidence reaches assessor; polished output alone cannot establish competence | Yes |
| 7 | Read feedback and locate remedial activity | Learner understands gap and next step | No |
| 8 | After seeded valid pass, inspect credential and decide whether to share | Claim understood; sharing remains private unless explicitly enabled | Yes |

**Observe:** Terminology comprehension, comfort with forms, practical relevance, facilitator effort and connection barriers.  
**Evidence:** Step scores; synthetic artifact and verification notes; resume capture; feedback comprehension; private/share state.  
**Signoff:** Learner representative + agricultural content owner + product owner. Status: Not run.

## UAT-02 MSME owner — productivity with information protection

**Role:** MSME owner or staff member with basic digital experience.  
**Fixtures:** L-MSME, MSME pathway, fabricated customer request and customer table with confidential fields; no live business data.  
**Trace:** BR-03, BR-11–13, BR-15, BR-19–21, BR-24–29, BR-32/34. F-01/F-03/F-04/F-05/F-06/F-07. WF-02/04/05/06/07/08/09.  
**Cases:** TC-014, TC-018, TC-026, TC-033, TC-040, TC-042, TC-043, TC-048, TC-055, TC-067, TC-080.

| Step | Participant task | Expected business outcome | Critical? |
|---|---|---|---|
| 1 | Choose operations/customer-communication pathway | Concrete task and expected outcome understood | No |
| 2 | Prepare customer-response draft using approved AI instructions | Relevant context included; confidential details minimized or excluded | Yes |
| 3 | Check draft against supplied facts and edit final response | Unsupported promises/errors corrected; checks recorded | Yes |
| 4 | Compare assisted task with comparable unassisted synthetic task | Record time and quality separately; no unsupported productivity claim | No |
| 5 | Submit evidence, read feedback and use allowed retry if necessary | New attempt preserves original evidence; feedback actionable | Yes |
| 6 | Ask peers a process question and distinguish responses from approved guidance | Community supports learning; peer contribution not presented as authoritative curriculum | No |
| 7 | Inspect resulting achievement and sharing choice | Category matches evidence; learner controls disclosure | Yes |

**Observe:** Business usefulness, verification effort, quality relative to baseline, understandable feedback.  
**Signoff:** MSME representative + content owner + assessment owner. Status: Not run.

## UAT-03 Bureaucrat — permitted material and source accountability

**Role:** Public-sector learner with simulated administrative task.  
**Fixtures:** L-GOV learner role only; fabricated permitted brief; official-source fixture; fabricated reference GOV-X.  
**Trace:** BR-03, BR-18–21, BR-24–26, BR-39, BR-44/46. F-01/F-04/F-05/F-10. WF-01/05/06/07/11.  
**Cases:** TC-012, TC-038, TC-041, TC-042, TC-043, TC-044, TC-048, TC-050, TC-060, TC-121.

| Step | Participant task | Expected business outcome | Critical? |
|---|---|---|---|
| 1 | Select bureaucrat context and open learner task | Context adapts; role tag does not grant admin access | Yes |
| 2 | Explain what material is permitted for exercise | Information boundaries identified before using AI | Yes |
| 3 | Summarize fabricated brief and verify references | Fabricated source identified; unsupported claims corrected | Yes |
| 4 | Record changes and retain accountable human review | Evidence shows checks and why output fits intended use | Yes |
| 5 | Submit flawed fixture with high quality score but failed critical criterion | Product fails it; overall score cannot override critical failure | Yes |
| 6 | Review feedback and remediation path | Reason and permitted next steps understood | No |

**Observe:** Trust versus source checks, role-language clarity and accountability comprehension.  
**Signoff:** Public-sector representative + responsible AI/assessment owner. Status: Not run.

## UAT-04 Partner operator — complete ecosystem journey and scoped sharing

**Role:** Pilot ecosystem integration owner; partner A tenant-scoped client.  
**Fixtures:** Approved adapter/simulator; linked and unlinked identities; O-A1; tenant B credential; active/withdrawn consent; queued failed event.  
**Trace:** BR-01, BR-38/39, BR-42/43/46. F-01/F-09/F-10. WF-01/04/12/11.  
**Cases:** TC-006–009, TC-098–115, TC-117, TC-165.

| Step | Operator task | Expected business outcome | Critical? |
|---|---|---|---|
| 1 | Enter approved pathway from partner A with valid identity | Correct learner/context; issuer+subject linkage; no email-only merging | Yes |
| 2 | Enroll, drop response and retry | One effective enrollment with stable result | Yes |
| 3 | Complete seeded pathway; request achievement without sharing authorization | Protected status not disclosed without permitted basis | Yes |
| 4 | Grant intended purpose and request achievement | Only agreed minimal A-scoped status visible | Yes |
| 5 | Request learner's tenant B achievement | No disclosure through partner endpoint or learner aggregate | Yes |
| 6 | Fail delivery, withdraw permission and request replay | Send/replay recheck current permission; no prohibited delivery | Yes |
| 7 | Deliver revoke event before delayed issue event | Partner preserves authoritative revoked status | Yes |
| 8 | Inspect failure diagnostics and escalation | Safe correlation; replay authorized/audited; no secrets in evidence | Yes |

**Evidence:** Both sides' sanitized contracts, event IDs, scopes, projection, consent timeline and dedupe/replay state.  
**Signoff:** Partner owner + integration lead + privacy/security owner. Status: Not run.

## UAT-05 Trainer and facilitator — supported cohort delivery

**Role:** Trainer TR-A assigned COH-1 only.  
**Fixtures:** Active cohort, learner gaps, private feedback, out-of-scope COH-2, approved resources and peer posts.  
**Trace:** BR-09, BR-13/15, BR-32–34, BR-38/39/41. F-03/F-07/F-08/F-10. WF-05/09/11.  
**Cases:** TC-025, TC-032–034, TC-080, TC-084, TC-096, TC-116, TC-118.

| Step | Trainer task | Expected business outcome | Critical? |
|---|---|---|---|
| 1 | Review assigned cohort participation and learning needs | Correct scoped roster and authorized progress | Yes |
| 2 | Identify learner needing support and provide relevant guidance | Useful next action within approved route | No |
| 3 | Facilitate discussion using approved resource and peer example | Contribution/resource status distinguished | No |
| 4 | Request private assessment details without assessor permission | Evidence denied; permitted participation view retained | Yes |
| 5 | Request another cohort's roster | Out-of-scope access denied | Yes |
| 6 | Escalate misleading post or access problem | Clear moderation/support route and owner | Yes |

**Observe:** Workload, report usefulness, contact mechanism and handoffs.  
**Signoff:** Trainer representative + program operations owner. Status: Not run.

## UAT-06 Assessor and independent appeal reviewer — evidence-based decisions

**Roles:** AS-A assigned assessor; AS-B unassigned; APR-A independent appeal reviewer.  
**Fixtures:** Complete/incomplete evidence; score 69/70; 95 with critical failure; allowed/exhausted retries; failed D-1 and appeal.  
**Trace:** BR-15/21, BR-24–30, BR-39/46. F-05/F-06. WF-06/07/10/08.  
**Cases:** TC-043/044, TC-048–069, TC-074/075, TC-095, TC-160/161/162/166.

| Step | Assessor task | Expected business outcome | Critical? |
|---|---|---|---|
| 1 | Open assigned queue; examine task/checks/revisions/final artifact | Evidence sufficient for rubric; out-of-scope attempts hidden | Yes |
| 2 | Score threshold and critical-failure fixtures | 69 fails; 70 passes; 95 with critical failure fails | Yes |
| 3 | Give feedback and permit configured retry | Actionable feedback; new attempt preserves old evidence | Yes |
| 4 | Review appeal independently and record upheld | Original decision stands; no new valid credential | Yes |
| 5 | On separate fixture record overturned plus superseding pass | Original retained; new decision linked; completion/award eligibility reevaluated | Yes |
| 6 | Attempt self-review or stale concurrent decision | Conflict rules and stale-write protection hold | Yes |
| 7 | Inspect credential basis and correction/revocation history | Claim follows current evidence; audit available to appropriate roles | Yes |

**Evidence:** Rubric values, reasons, attempts, appeal lineage, eligibility and audit.  
**Calibration:** Two assessors independently score an approved bundle; resolve differences and clarify rubric before credential launch. Record agreement and limitations.  
**Signoff:** Assessment owner + issuer + independent appeal owner. Status: Not run.

## UAT-07 Content and organization administrator — governed operations

**Roles:** AUTHOR-A, REVIEW-A, ADMIN-A1 with distinct scopes.  
**Fixtures:** AI-assisted and translated draft; PV-1/PV-2; known counts; unauthorized org A2/B; audit.  
**Trace:** BR-08/16/22, BR-38–41/46. F-08/F-10. WF-11/04.  
**Cases:** TC-016, TC-023, TC-089–097, TC-116–118, TC-127.

| Step | Operator task | Expected business outcome | Critical? |
|---|---|---|---|
| 1 | Create pathway with outcomes, evidence, owner and review date | Missing accountability metadata blocks publication | Yes |
| 2 | Try unreviewed AI-assisted publish, then complete review | Unapproved publish blocked; reviewer recorded | Yes |
| 3 | Publish PV-2; compare old/new enrollment | Old learner retains PV-1 policy; new enrollment uses PV-2 | Yes |
| 4 | Review translated task/instructions | Meaning/evidence requirements and core-language journey preserved | Yes |
| 5 | Invite eligible cohort and check counts | Scoped membership and metric denominators correct | Yes |
| 6 | Request A2/B reports/exports | Unauthorized rows/artifacts denied | Yes |
| 7 | Inspect audit and retire dated offering | Actions attributable; historical learning/evidence preserved | Yes |

**Observe:** Publishing effort, review usability, explanations of versions and report usefulness.  
**Signoff:** Content owner + org administrator + privacy owner. Status: Not run.

## UAT-08 Moderator, support agent and learner — safe community and help

**Roles:** MOD-A scoped COM-1; limited support agent; reporting learner.  
**Fixtures:** Misleading peer post; out-of-scope community; learner ticket; private contribution/data request.  
**Trace:** BR-04, BR-32–34, BR-39/43/44/46. F-07/F-10. WF-09/11/12.  
**Cases:** TC-081–088, TC-120–122, TC-163/164.

| Step | Operator/learner task | Expected business outcome | Critical? |
|---|---|---|---|
| 1 | Report misleading guidance | Reporting understood; appropriate status without exposure | Yes |
| 2 | Review, hide and escalate | Scoped action/reason; no authority over unrelated community | Yes |
| 3 | Try reuse of private cohort contribution | Unauthorized republication prevented | Yes |
| 4 | Request account help and process ticket | Appropriate help with minimum information | No |
| 5 | Request another tenant's ticket/profile | Access denied consistently | Yes |
| 6 | Request own learning records/account-data handling | Verified authorized records; retention exceptions explained | Yes |
| 7 | Review support/moderation handoff | Named owner, escalation and response expectations configured | Yes |

**Signoff:** Community operations + support owner + privacy owner. Status: Not run.

## Cross-cutting companion tasks

Execute TC-124–129 with selected learner scripts: keyboard navigation, screen-reader errors/status, mobile reflow/touch, supported-language completeness, language switching with saved evidence, and first-time learner observation. Record actual assistive technology, browser/device and language. An automated score cannot replace observed task completion.

Use TC-130/131 reports to state conditions tested. Users cannot prove the 800ms API hypothesis by perception. Test connection interruption with TC-029; document recovery. Observe understanding of private credential defaults and sharing withdrawal using TC-070/073.

R2 UAT is conditional: TC-141/145 (diagnostics/recommendations), TC-150 (mentor scope), TC-154 (refund/cancellation) and technical companion cases require updated scripts when future specifications are approved. TC-156 is R3 readiness review only; no assistant runtime script exists yet.

## Evidence and signoff template

| Field | Record |
|---|---|
| Run/script | Unique run ID; UAT-01..08; exact linked TC IDs |
| Candidate | Build, config, content/rubric/policy and fixture versions |
| Participants | Role, language/access needs, pseudonymous ID |
| Conditions | Browser/device/network; assistance planned/provided |
| Outcomes | Per-step score, critical Pass/Fail, actual result and evidence |
| Value | Concrete useful outcome, verification effort and limitations |
| Defects | Severity, owner, remediation, retest and signoff impact |
| Decision | Accept / Reject / Conditional accept; excluded scope |
| Exceptions | Noncritical case IDs, workaround, owner, expiry, retest |
| Signatories | Named accountable roles, dates and rationale |

**Current decision:** Not run / not signed off.  
**Current gaps:** Audience, languages, issuer, provider, assessment policies, operating owners and commercial decisions remain to be finalized. Technical and UAT evidence is required before acceptance.
