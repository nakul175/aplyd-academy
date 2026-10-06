# M5 exact offering navigation: functional design

Status: current adopted M5 source; final local acceptance complete. Git/native publication is recorded in the handoff receipt after commit.

## Concrete problem

Two open shared-workspace cohorts can refer to two publications of one private program. The existing collapsed catalog uses its last eligible cohort document, while the course preview independently chooses the first open cohort. A learner can therefore click a revised title and read earlier prerequisites. Each snapshot is valid; the selection journey disagrees. The [original M4 reproduction](evidence/m4-catalog-preview-mismatch.txt) is retained without rewriting its historical outcome.

## Intended behavior

**FS-M5-01 — Preserve the card’s exact offering.** Keep the existing catalog, program ordering and canonical course documents. A derived entry pairs a private program with its accepted workspace ID, cohort ID and full content reference. The card displays `Preview: <cohort title>` and carries that same intent to the course view from Learning pathways or Overview. It changes navigation only; it does not enroll, publish, mark progress or save a preference.

**FS-M5-02 — Validate the explicit intent against current accepted data.** The course view matches current workspace, program, cohort and complete pin before resolving content. Missing/repointed cohorts, cross-workspace targets, invalid/extra fields and malformed explicit URLs show the selected-offering unavailable state. Missing exact publication uses the existing unavailable-content/support/export state. Neither branch silently substitutes another cohort, global document or later edition. A deliberate new choice is required.

**FS-M5-03 — Preserve own non-withdrawn enrollment first.** An existing own enrollment determines the displayed course and saved pin even when an URL names another offering. A conflicting or invalid explicit intent produces the explanation “You’re continuing your enrolled edition. Your saved course has not changed.” Its own unavailable snapshot remains unavailable even when a newer offering exists. Withdrawn history does not override a new current offering. No navigation changes enrollment ID, saved evidence, pin or progress.

**FS-M5-04 — Keep deliberate selection through navigation.** The bounded hash carries only workspace/cohort/content reference IDs. Reload, Back and Forward are intended to reconstruct the same explicit target from a fresh accepted projection. Manual picker change updates the existing navigation target/hash without invoking the generic navigation scroll/main-focus behavior; its mounted component key excludes offering metadata. History/card navigation keeps the existing main-focus pattern. The final browser cases accept manual picker focus and exact reload/Back/Forward/main-focus behavior in their recorded scope. End/Escape, actual zoom and field accessibility remain extensions. No localStorage or new persistent navigation field is introduced.

**FS-M5-05 — Preserve generic learning links.** Existing generic pathway and lesson/assessment/feedback shapes remain supported. Without an offering intent, a shared preview retains its existing first-open/first-cohort behavior and does not enable Start until deliberate exact cohort selection. Personal global navigation and existing Plan/next-action callbacks retain their original meaning. Malformed explicit intent is distinct from absence of an intent.

**FS-M5-06 — Keep Start separate and authoritative.** An exact URL may preselect an eligible cohort but never invokes a command. The client enables Start only for explicit current selection with matching resolved source, active learner membership, open cohort/content and an integer remaining capacity, plus existing busy/paused gates. The existing server independently enforces access, capacity, exact source and optimistic revision/CAS. This read-only acceptance plan inspects enabled/disabled controls and never clicks Start or any save/complete/withdraw control.

## Acceptance and limits

The integrated source passes 727 model/domain entries (0 failures), full application TypeScript and Worker build. The 30 navigation and 22 export model groups are included in 727. The 80 network-free request guards are separate. Final acceptance passes 30/30 read-only browser scenarios, including five captured local JSON downloads, at 2026-10-05T22:03:32.923Z on Worker 69950. Source, harness, built/frozen entry and all downloaded-file hashes match. Actual personal, other-personal and workspace projections have equal before/after state, revision, team and contentVersions. There are zero forbidden requests and page errors. Body-text enlargement is not actual browser zoom; local fixtures are not hosted participant acceptance. No protected Start/save/complete action ran.

[Final browser report](evidence/final-browser-30.json) and [release evidence](release-evidence.json) bind the current source. Historical failures and the pre-fix 705/25 results remain in evidence with their original hashes. Feedback-tab legacy navigation was exercised; unlocked lesson/assessment, Overview parity, real zoom and full protected command/CAS UAT remain separate.
