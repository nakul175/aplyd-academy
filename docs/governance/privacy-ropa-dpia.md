# Privacy: record of processing and impact assessment (item 23, part 1)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when a data category, processor, purpose, hosting location or real-user admission changes.

**Agent-drafted 2026-10-08, not reviewed by a person or counsel; no certification or compliance claimed.** India's Digital Personal Data Protection Act 2023 and GDPR Articles 30 and 35 are used as frameworks for headings only. Today the pilot holds **synthetic data only** (README; handoff), so most entries describe what *would* be processed. Legal roles (controller/fiduciary, processor): TBD (owner: Nakul Jain). Sources: README, docs/implementation-review-v0.13/data-dictionary.tsv, deploy/README.md.

## 1. Record of processing (Art. 30 style)

| Activity | Purpose | Data subjects | Data categories | Recipients | Location | Retention |
|---|---|---|---|---|---|---|
| Sign-in | Admit named people | Pilot users, staff | Email, stable account id, optional display name; password hash (droplet users file) | Caddy, app | Droplet, Bangalore; or owner-private hosted site | Until removed; TBD |
| Personal practice lab | Private learning | Learners | Profile and preferences, goals, plans, lesson/practical drafts, reflections, estimates, sample decisions | The learner only | Personal D1 row | TBD |
| Shared workspace learning | Cohort delivery | Learners, staff | Enrolment, drafts, submitted attempts, scored decisions, appeals, nonaccredited records, feedback | Assigned staff for evidence; owners see counts only | Team D1 row | TBD |
| Discussion and moderation | Cohort conversation | Members | Posts, replies, reports, moderation reasons | Scoped members and moderators | Team D1 row | TBD |
| Networking and sessions | Practice sessions | Members who opt in | Narrow profile, RSVP, attendance | Cohort | Team D1 row | TBD |
| Support requests | Help | Members | Request text, replies, resolution | Requester and assigned handler | Team D1 row | TBD |
| Invitations | Access to workspaces | Invitees | Recipient email, token hash, expiry | Issuer | Token index table | 7-day link expiry; row retention TBD |
| Audit | Accountability and idempotency | Actors | Actor id, action, revision, request hash, detail | Owner roles | Audit tables; older history archived after 200 entries | TBD |
| Data requests | Rights handling | Members | Request kind, status, verification outcome | Owner | Workspace | TBD |
| Server logs | Operations | All | IP, request lines (Caddy, journald) | Operator | Droplet | Journald defaults; TBD |

No sale, no advertising, no analytics beacon, no email, no AI provider, no real partner exchange (README).

## 2. Impact assessment (Art. 35 style), pilot-to-real-users

| Question | Assessment |
|---|---|
| Nature of processing | Educational records and assessment decisions about adults in farming, MSME and public service; learner-authored work |
| Necessity and proportionality | Collect only what a workflow needs (design rule); optional fields opt-in; no occupation/location capture required by design. Not verified field by field |
| Risks | Disclosure of learner work or scores; staff seeing evidence they are not assigned; wrong identity linked to an account; loss of data (no tested backup); data kept without a schedule; basic-auth shared secrets; public-sector learners' employment exposure; low digital literacy making consent not meaningful |
| Existing controls | Server-side scope checks, independence rules, hashed invitation tokens, private by default credentials, droplet firewall, TLS (threat-model.md, access-control-model.md) |
| Residual risk | **High for real data today**: no retention schedule, no tested restore, no MFA, development runtime, single host, no independent review |
| Consultation | None performed. TBD (owner: Nakul Jain) |
| Decision | Do not load real learner records until retention and erasure decisions are made (handoff) and this assessment is reviewed by a person and counsel |

## 3. Open decisions

Controller identity; lawful basis per purpose and notice text (English and Hindi); data residency (droplet is in India; Sites hosting location unknown); children and age gate; processor contracts with DigitalOcean and any hosting provider; cross-border transfer; named privacy contact (SECURITY.md address is the only contact today).
