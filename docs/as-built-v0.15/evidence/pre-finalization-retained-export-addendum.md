# M5 publication hold: retained-learning download consistency

M5 has not been committed or published. Root is holding adoption/publication for **M6-RET-01 (P2)**, a concrete source finding after the accepted navigation run. The current published baseline remains M4 v0.14/main `13f7f0b6173a03b043c4f8dbd9ae0012fc50a35c`. The source audit is [preserved](evidence/retained-journey-audit.json); [finding and proposed acceptance](evidence/retained-journey-findings.txt) distinguish source diagnosis from unexecuted checks.

## Trigger and observed source behavior

An own non-withdrawn older enrollment has an unavailable exact source, while another same-program cohort remains open with a newer pin. LearningView correctly keeps the own enrollment’s unavailable course view. However, its generic default cohort selection is independent of the own enrollment: `selectPreviewCohort(team, programId, undefined)` chooses first open content. The existing local download then serializes `{enrollment:e, cohort:selectedCohort}`. The older retained enrollment can therefore be paired with unrelated newer cohort metadata in that file.

This is a download consistency finding. No saved enrollment change, silent pin upgrade, authority gain or cross-account leak was established by the source audit. The accepted25 browser cases checked the unavailable view and own-pin precedence, but did not inspect that download. Passing view/equality evidence does not negate this uncovered branch.

## Proposed functional/implementation delta — not yet accepted

**FS-M5-RET-01:** for an own-enrollment export, attach only a current accepted cohort whose ID equals `e.cohortId` and whose complete validated pinned reference equals the own enrollment’s full pin. Return null when it is missing, repointed, mismatched or unverifiable. Preserve the own enrollment bytes. Omitting cohort for an own enrollment is also safe; root’s selected minimal design will determine the final implementation description.

A missing own content snapshot does not justify replacing its metadata with a newer default. A matching own cohort may still describe unavailable/closed retained content; matching metadata is not current enrollment authority. Personal no-cohort enrollment yields no unrelated cohort. Preview-only export with no own enrollment remains governed by its exact selected preview and must retain its current behavior. Course display resolution, enrollment, pins, roles, API/schema/storage and server capacity/CAS remain unchanged.

No new implementation helper path is asserted yet. The fix is being staged outside checkout for independent source review. Root remains the sole application writer and owner of new typecheck/build/frozen acceptance.

## Required acceptance — planned, not executed

- Pure no-fetch checks: older own enrollment plus newer open default; exact matching own cohort; reordered, missing, repointed and malformed own/cohort pins; personal no-cohort enrollment; no-enrollment preview-only case. Assert enrollment and all inputs remain unchanged; attached own cohort is full-pin exact or null.
- Read-only integrated download: reuse the existing approved reader and labelled memory-only own-unavailable/alternate-present GET variant. Capture only the deliberate local retained-learning download; inspect JSON for exact own enrollment and matching own cohort or null. Reject newer default cohort/title/pin attachment. Compare actual saved state/team/contentVersions/revision before/after under the redirect-safe GET/HEAD guard.
- Revalidation: actual adopted source/helper typecheck, full model regression, application build and relevant frozen navigation/download cases must bind new hashes. Do not carry the pre-fix whole-bundle acceptance forward as acceptance of changed source.

The full705 model entries/0 failures,80 separate guard cases,30 included offering groups, typecheck/build exit0 and25/25 frozen navigation cases remain valid **pre-fix** evidence for their recorded hashes. Primary pre-fix entry is `43eaf4bec71591646c1d4e169e38d7ab6043ed34bc54dada3252242fe03a594a`; LearningView is `091f51fecbc44ebc4f791f92b09b864d76376cd934c3b9b282271d9a791b1cae`. Original timing/sandbox failures also remain preserved. No fixed/new-source acceptance or publication is claimed.

The separate protected fictional-fixture mutation permission remains pending. This local GET/display/download plan creates no persisted fixture or enrollment and does not authorize protected command/CAS workflows.
