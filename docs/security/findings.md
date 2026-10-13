# Security review findings (ACA-US-12.2, AC2 and AC3)

Review of the production setup as code on branch `aca/practice-loop`, 13 October 2026, by Claude: dependencies (`npm audit`), configuration (`deploy/node/`, `next.config.ts`), secrets handling and organisation isolation (unit tests in `tests/loop`). Severity: critical, high, medium, low. High and critical must be fixed before the go/no-go review. Remaining risks are accepted or rejected only by Nakul Jain, recorded as the `risk.acceptance` decision with the finding id as scope.

| ID | Finding | Severity | Owner | Status |
| --- | --- | --- | --- | --- |
| F-01 | `next` 16.3.4 had published advisories rated critical (RCE in `next/og`, cache poisoning, SSRF in image optimisation). | critical | Claude | **Fixed**: upgraded to 16.4.0; `npm audit --omit=dev` reports 0. |
| F-02 | `sharp` < 0.35.5 (librsvg CVE) reachable through image optimisation. | high | Claude | **Fixed**: override to 0.35.5 and `images.unoptimized: true` (no `next/image` is used). |
| F-03 | No limit on AI coach questions: cost abuse and noisy-neighbour risk. | medium | Claude | **Fixed**: 30 questions per learner per hour (429 after). |
| F-04 | Invite and confirmation links use the request host unless `ACADEMY_PUBLIC_ORIGIN` is set: host-header injection could produce links to another host. | medium | Nakul Jain (setup) | **Mitigated**: `ACADEMY_PUBLIC_ORIGIN` is set in `academy.env.example`; required in production. |
| F-05 | Learner work files under `/var/lib/academy/files` are not in the Litestream backup (it covers the database only). A disk loss loses files. | medium | Nakul Jain (decision) | **Decided 13 Oct 2026 (delegated)**: weekly DigitalOcean droplet backups (whole disk, files included) plus Litestream for the database. Up to a week of files can be lost; accepted for the pilot. `docs/decisions/owner-decisions-2026-10-13.md`. |
| F-06 | Development-only dependencies (vite, wrangler/miniflare, eslint plugins, react-server-dom-webpack dev copy) have high/moderate advisories. | low | Claude | **Open, low impact**: not in the standalone production build; update when the Cloudflare preview path is retired. |
| F-07 | Age at joining is self-declared. | medium | Nakul Jain (legal review) | **Accepted for the textile pilot, 13 Oct 2026 (delegated)**: an adults-at-work cohort enrolled from the association's staff list; the notice states the 18+ rule and that no data about minors is knowingly held. Verifiable consent is required only for the student pilot (R3), which stays gated. |
| F-08 | AI provider receives learner questions; data location and terms are not yet reviewed. | high | Nakul Jain (legal review) | **Closed for the textile pilot, 13 Oct 2026 (delegated), on conditions**: `docs/privacy/ai-provider-review.md` (Anthropic commercial terms: no training, DPA, 30-day deletion; DPDP s.16 / Rule 15: no restricted countries notified). Files never sent; the coach serves learners only after the evaluation passes. Not a lawyer's review; the owner can reverse with `ai.enabled = false`. |
| F-09 | WhatsApp/SMS inbound webhook uses a shared secret, not a provider signature. | low | Claude | **Open until the provider is chosen**; add the provider's signature check in its adapter. |
| F-10 | No external penetration test. | medium | Nakul Jain | **Open (not decided)**. |
| F-11 | Organisation isolation | – | Claude | **Checked**: cross-organisation reads and writes refused and logged in tests (`e2-enrolment`, `e8-e14`), files refused for admin and facilitator in the browser journey. |

Remaining-risk decisions: F-05, F-07 and F-08 were decided on 13 October 2026 by Claude under authority the owner delegated in chat that day (`docs/decisions/owner-decisions-2026-10-13.md`); they are not `risk.acceptance` records by the owner himself, and he can reverse each one.

## Independent code review, 13 October 2026

A separate review agent read `lib/loop`, `app/loop` and `app/api/loop` without seeing how they were built, and confirmed 22 findings with scripts. All were fixed the same night, with regression tests in `tests/loop/review-fixes.test.mjs` and updated tests:

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| R1 | Small groups leaked through suppression (S-03 used events, not people, as the size) | high | Fixed: groups hidden as a whole below the minimum number of people |
| R2 | Old tasks submitted late counted in their original week; A-01 could be met in one sitting | high | Fixed: a cycle counts in the week it is completed |
| R3 | "Thresholds never lowered" could be bypassed by raising, then lowering | high | Fixed: after any failed run nothing may go below the highest value ever recorded |
| R4 | Retention crashed on `invites` (no `id` column) | high | Fixed: key column per record type; every type tested |
| R5 | Any teacher saw every student in the school digest | high | Fixed: own classes only; admin sees the cohort; legal-review gate |
| R6 | Harm-review stop enforced only for new weekly tasks | medium | Fixed: every practice action checks it |
| R7 | Later start groups got a shorter access year | medium | Fixed: the year runs from the group's start |
| R8 | Some deletions (under-18, guardian refusal, end of pilot) were not re-applied after a restore | medium | Fixed: logged by id and re-applied; user re-application covers every account table |
| R9 | Student account deletion skipped part of the account | medium | Fixed: full account erasure |
| R10 | A-01 denominator counts joined people only | medium | **Open question for the owner**: does "enrolled" include people invited who never joined? The week-6 report now shows both numbers |
| R11 | Students' hints-only mode could not be evaluated | medium | Fixed: AI for students needs a passing hints-only case |
| R12 | Help reports could go to the wrong organisation | medium | Fixed: the person chooses; never guessed |
| R13 | Placement could be resubmitted to change one's own level | low | Fixed |
| R14 | Prototype names resolved as actions | low | Fixed |
| R15 | Reminder-only phone numbers shown to facilitators | low | Fixed: removed from the follow-up list |
| R16 | Upload and voice bodies not capped without Content-Length | low | Fixed: streamed with a byte cap |
| R17 | Bad JSON gave 500 instead of 400 | low | Fixed |
| R18 | A failed invite email left a half-enrolled row | low | Fixed: reported as a row problem with "Resend invite" |
| R19 | Some practice actions skipped the access-end check | low | Fixed |
| R20 | Export missed some of the person's records | low | Fixed: export covers what erasure deletes |
| R21 | Risk decision accepted any value as "reject" | low | Fixed |
| R22 | Duplicate refusal audit entries in fix proposals | low | Fixed |
