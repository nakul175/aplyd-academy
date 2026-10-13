# Owner decisions of 13 October 2026 (recorded under delegated authority)

Owner: Nakul Jain. Recorded by: Claude. Last reviewed: 2026-10-13.

On 13 October 2026, in chat, the owner instructed Claude to take the open product decisions itself ("bhai sab khud se kar sakta hai. dont upward delegate") after Claude had listed them with recommendations. The values below are therefore Claude's recommendations, adopted on the owner's instruction. They are stored in `loop_decisions` by `scripts/seed-decisions.mjs` (run by every release through `deploy/node/academy-admin.sh`) with `decided_by = "delegated:claude"` and a source naming this delegation, so the audit trail never says the owner recorded them himself. The owner overrides any of them by recording a new decision in Operations; the seed never overwrites an existing record.

## Decisions recorded (global scope)

| # | Key | Value | Why this value |
| --- | --- | --- | --- |
| 1 | `notice.approved` | `v1.0` (`docs/privacy/notice-v1.0.md`) | Nobody can join without an approved notice. v1.0 answers the three open items of the draft; the provider facts come from `docs/privacy/ai-provider-review.md`. |
| 2 | `placement.instrument` | The 5-question draft; bands L1 Starting 0-4, L2 Practising 5-9, L3 Confident 10-14 | Mixed-role cohort; the bands can be redrawn from week-2 data. The draft had been written for owner review and no objection was raised. |
| 3 | `access.notice_days` | 30 | Time to arrange a renewal. |
| 4 | `ai.enabled` | true | The coach is the core of the loop. It still serves nobody until the evaluation set passes `ai.thresholds` on the recorded model (ACA-US-7.2), and `ACADEMY_AI_PROVIDER=off` on the server stops it regardless. F-08 assessment: `docs/privacy/ai-provider-review.md`. |
| 5 | `ai.thresholds` | overall 0.90; hint_first 1.00; refusal 1.00; uncertainty 0.90 | Hint-first and refusal are safety rules: no misses allowed. |
| 6 | `ai.files_to_provider` | not allowed | Matches the owner's 12 October position (decide after legal review). |
| 7 | `reminders.channel` | email | No WhatsApp or SMS provider chosen; shop-floor staff may not read email, so a provider should be chosen within a month of the workshop. |
| 8 | `reminders.default_cadence` | weekly, Monday | One default; a cohort-level A/B (`reminders.cadences`, scope cohort) can be added once the cohort exists. |
| 9 | `followup.inactive_weeks` | 2 | Catches drop-off well before the week-6 decision. |
| 10 | `metrics.min_group_size` | 5 | Stops an association identifying individuals in small groups. |
| 11 | `retention.periods` | login codes 1 day; sessions 30; unused invites 30; message outbox 90. No automatic deletion of practice records, coach messages, files, audit, help reports or posts | The owner's 12 October rule: keep learner data until the learner asks for deletion. Only short-lived security and delivery records expire. |
| 12 | `help.security_contact` | nakul.jain@aplyd.com | Already the address in SECURITY.md. |
| 13 | `sessions.format` | monthly, 45 minutes, Google Meet | Keeps the community alive without a heavy facilitator load; the owner's organisation runs on Google Workspace. |

## Decisions taken in code or configuration (not `loop_decisions` keys)

| Decision | Value | Where |
| --- | --- | --- |
| Who counts as enrolled for A-01 | Everyone the association listed, including people who never joined. The week-6 report shows both shares (listed and joined); the decision rule applies to the listed denominator | `lib/loop/metrics.ts` (`a01`), `tests/loop/review-fixes.test.mjs` |
| AI provider and model | `anthropic`, `claude-sonnet-5-5` (quality adequate for a hint-first coach at a cost the pilot can carry) | `/etc/academy/academy.env` via cloud-init (`deploy/node/make-cloud-init.mjs`) |
| Release scope for the textile pilot | R1 only. `scope.release` stays unrecorded, so R3 and R4 features (schools, briefs, sector workspaces, language, voice, annotations, billing) refuse with "not in scope yet" | `lib/loop/core.ts` (`requireEpic`) |
| Backup of learner files (F-05) | Weekly DigitalOcean droplet backups (covers `/var/lib/academy/files`) plus Litestream for the database to Spaces. Not the nightly Spaces file sync first proposed: one mechanism, no new script | DigitalOcean droplet settings; `deploy/node/litestream.yml` |
| Shared-droplet safety | `pnpm run build` stays the Worker build, so merging to `main` cannot break the live demo; the Node runtime builds with `pnpm run build:node` | `package.json`, `docs/operations/cutover-plan.md` |
| GitHub `production` environment | No required reviewer during pilot setup, so deploys do not wait for a click. The owner can add himself as a required reviewer in Settings > Environments at any time (ACA-US-1.5 asks for that gate once the pilot has real learners) | GitHub repository settings |

## Deferred on purpose (not needed before the textile pilot)

| Decision | Recommendation | Decide by |
| --- | --- | --- |
| `pricing.workshop` (scope: the association's organisation) | per workshop, cap 40; the price is a commercial figure the owner sets when the organisation is created | Organisation creation |
| `pricing.renewal` | set from the week-6 A-01 result | Month 10 of the cohort |
| `reminders.cadences` (scope: cohort) | compare Monday with Monday + Thursday | When the cohort is created |
| Deletion requests from members of shared team workspaces | Option A: delete the person's own data, show "former member" in shared records | Before any team workspace has real users |
| WhatsApp or SMS provider | one with Indian template approval and a signed inbound webhook (F-09) | Within a month of the workshop |
| External penetration test (F-10) | before schools or a second paying organisation | Before scaling |
| Student pilot gates (`student.*`), `speech.provider`, `language.local`, `brief.max_words` | unchanged: R3 and R4 | After the week-6 decision |

## Facts only the owner can supply (not decisions)

- APLYD's registered legal entity and address for the notice's first line. No public source states them (the APLYD site and Athena Infonomics pages name no entity; Indian registries list several Athena entities). Add to `notice-v1.1.md` before the first real learner joins.
- The textile workshop date. Not found in the owner's calendar on 13 October 2026.
- Account actions Claude is not permitted to take: paying for the droplet and Spaces bucket, creating and pasting API keys (Resend, Anthropic, Spaces) and the deploy SSH key. Listed with exact steps in `docs/operations/cutover-plan.md`.
