# Aplyd Academy M4 architecture and implementation contract

This is a source-bound implementation review of the v0.14 candidate, based on published v0.13 commit `8a769a24415169ea24b45b6f97ae89e050c99b19` plus the M4 files hashed in [release-evidence.json](release-evidence.json). Native v0.14 publication is pending. The application remains the React/Vinext Worker and existing seven-table D1 storage with canonical personal/shared JSON aggregates. M4 introduces no API route, method, command, persistence field, schema/migration, membership role or assessment calculation.

## FSD → HLD → LLD linkage

| Functional requirement | Runtime boundary | Actual implementation |
| --- | --- | --- |
| FS-M4-01/02: own edition prerequisites and supported rule | Existing curriculum/content resolution and server authorization are authoritative | [LearningView](../../app/academy-learning.tsx) → [deriveBeforeStartSummary](../../lib/academy-before-start.mjs), typed by its `.d.mts` |
| FS-M4-03/04: saved own weekly counts | Existing `learningPlanSummary` / `taskProgress` projection and shell subject acceptance | [Plan](../../app/academy-plan.tsx) → [OwnWeeklyReview](../../app/academy-weekly-review.tsx) → [deriveOwnWeeklyReview](../../lib/academy-weekly-review.mjs) |
| FS-M4-05: find own open task | Focus existing own activity element; no route/write | `focusOperationItem('data-plan-task-id', id)` in OwnWeeklyReview |
| FS-M4-06: private local recap | Fresh whitelisted artifact; accepted subject; explicit device download | `prepareOwnWeeklyRecap` / `renderOwnWeeklyRecapHtml` plus local Blob/JSON helper |
| FS-M4-07/08: fixed generic worksheet | Existing personal inspector; fixed key only; no state input | [Partner inspector](../../app/academy-partner-readiness.tsx) → [buildPartnerReviewPack/renderPartnerReviewPack](../../lib/academy-partner-review-pack.mjs) |

The JavaScript projections have typed declarations. They do not choose another content edition, query staff aggregates, recalculate eligibility, authorize enrollment, change membership or write state. Existing command, storage and server modules retain those responsibilities.

## Inputs, validation and failure behavior

Before-start requires a plain resolved snapshot, matching program/reference ID, bounded ID/version syntax, permitted global or `tw-…` scope, and nonblank prerequisite strings. Global policy must match the exact archived seed version and program. Private policy must have `minimumWeightedScore=70`, `scoreMaximum=4`, `criticalGates='all'`; every rubric weight is integer 1–97, totals 100, and each gate is null or a bounded string with at least 30 trimmed characters and at most 2,000 characters. This is a display guard, not a new publication validator. Unsupported private policy yields prerequisites with a null rule; unknown global references yield no summary. There is no fallback to latest/global content.

Weekly inputs are the already projected own summary and valid observation timestamp. Limits: at most 200 unique retained task IDs; planned minutes 5–240 per task; saved weekly budget 10–600; practice titles up to 100 characters, linked titles up to 200 to preserve valid 160-character authored content and reflection prefixes; blocked reasons up to 1,000 characters; existing date/timezone validation. Summary today/week must exactly match the saved timezone and observation. Invalid input returns null. A stored linked-done flag alone cannot manufacture course evidence: completion is taken from existing `taskProgress`. Current blocked reasons and retained historical evidence stay distinct.

Export validates Monday–Sunday dates, saved timezone and safe integer counts (0–200; intended minutes 0–48,000; budget 10–600); lesson/submission/reflection counts must sum to their total. It reconstructs the object and never serializes the view/state/attention titles. Printable HTML escapes text and contains no scripts, links, remote assets, form controls or automatic printing. Its labels wrap while numeric table cells remain on one line. The final 390px/200% check measured 32px body text, 270.55px label width and intact “Completed” wording.

Partner keys are exact strings `agri`, `msme`, `public`. Objects, unknown/prototype-like keys and Health are rejected. The builder detaches a fixed snapshot; all five authority flags remain false. It describes the existing ten envelope and six conditional fields, selected summary scopes, 1/7/30-day choices, 24 retained choices and 100 receipts. These are simulator definitions, not a configured partner exchange. The HTML renderer escapes all content, applies `default-src 'none'` with inline style only and blocks base/form/object sources; there are no active controls or external requests. Screen body/table text is 16px/at least 14px; separate print rules use 14mm page margins. All six A4 pages for each of three partners were inspected, including table headers and whole decision cards.

## API, schema and permission continuity

Existing five route paths remain `/api/academy`, `/api/academy/export`, `/api/academy/records/check`, `/api/teams`, `/api/teams/history`; no new method/envelope is introduced. The read-only review uses existing same-origin GETs; explicit downloads use device-local Blobs. Original BRD target integrations and future identity/issuer capabilities must not be read as implemented routes. [Published v0.13 API and permission review](../implementation-review-v0.13/README.md) and its [seven-table/entity dictionary](../implementation-review-v0.13/data-dictionary.tsv) remain the storage/permission baseline; [M4 derived-field dictionary](data-dictionary.tsv) is additive.

| Actor/scope | M4 view/download authority |
| --- | --- |
| Accepted personal account | Own weekly view/recap; permitted resolved course preview; generic partner worksheet in existing personal inspector |
| Accepted shared-workspace learner | Own plan/history and permitted edition only; no personal partner inspector |
| Inactive/removed own member | Accepted retained own history may be exported; current learning authority is not restored |
| Owner/facilitator/assigned assessor | No new access to anyone else’s private plan or recap; existing server role/assignment rules apply |
| Missing/wrong subject, loading/read error or save in progress | Recap export disabled; invalid review shows no export; the saving condition is source-inspected |

## Bound evidence windows

Final weekly acceptance is 18 scenarios / 138 assertions on frozen Worker 97593, entry SHA-256 `a7d4229dc48e16451de6df8623cd15716601ed0b1f0f5d4a5f68014bb8caa46b`; configuration SHA-256 `40037e9c9498735a53ecbe4fcaecbf765e98afbbd00b35a63c311843592b8397`. Report time: 2026-10-05T21:27:07.102Z. Source, build and frozen-runtime hashes stayed equal, four saved snapshots stayed equal, and there were zero write attempts, external requests or page errors. Earlier weekly 18/134 on the previous bundle is historical, not added to the final assertion count.

Before-start 16 cases and partner 11 cases/18 A4 pages ran on Worker 91739, entry `0cb0efb9052fdf7e03b48a0d22edbb3a5d02dba4a48ff687158997bc6ad3233f`, same configuration. All their named nine/ten module source hashes still match the final checkout. The later delta affected only weekly standalone HTML count-column CSS. This is source-bound unchanged-module acceptance, not a claim that those suites reran on the a7d whole bundle. Final partner 21 static/32 domain reports use the adopted `e8f2258c…` module. Detailed evidence paths, exact hashes and limitations are in [release-evidence.json](release-evidence.json).

Root owns source commit, deployment archive and native private Site publication. No production HTTP probe was performed by this review. A native receipt, exact new main commit and preserved audience must be recorded after publication; pending publication must not be reported as hosted acceptance.
