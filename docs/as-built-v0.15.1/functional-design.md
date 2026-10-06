# M6 reflection completion: functional design

Status: adopted in source commit `059868a`; local acceptance complete; native publication pending.

## Problem

A learner can plan a work reflection for an enrollment that has an active reviewed practice record. The plan item is linked, so it completes when the learner saves a reflection for that enrollment at or after the item was created. The learner can keep saving reflections afterwards, as the product intends for continuous practice.

In v0.15.0 the plan took the first matching reflection in stored order. The engine stores reflections newest first, so after a second reflection the earlier plan item reported the second reflection's date. Its "Saved completion" text changed, the weekly review stopped counting it in the week it was done and counted it in the later week, and the downloaded weekly recap repeated the error. The reproduction is preserved in `docs/candidates/reflection-completion/runtime/before-failure-proof.json` and was repeated for this release in `evidence/baseline-32c8982/before-reproduction/`.

## Requirements

**FS-M6-01 Stable completion date.** A reflection plan item's completion date is the earliest saved reflection for the exact same enrollment whose timestamp is at or after the item's creation. Saving further reflections never changes it.

**FS-M6-02 History is kept and not recounted.** Every saved reflection stays in the learner's own history in its stored order. A later reflection does not make an earlier plan item count in the later week. The weekly recap and its JSON and printable downloads count each plan item once, in the week of its own completion.

**FS-M6-03 New items bind to their own creation.** A reflection plan item created later completes from the first qualifying reflection after its own creation, independently of earlier items.

**FS-M6-04 Existing rules unchanged.** Skipped items stay skipped and show no completion. A reflection saved before the item's creation does not complete it; one saved at the exact creation instant does. Reflections for another enrollment, including another pathway, never complete it. Missing, empty or malformed timestamps never create a completion. A future-dated completion keeps the existing "date needs review" diagnostic and is not counted in the week. Blocked reasons, lifecycle gates, unavailable pinned content handling and recap privacy are unchanged.

Mixed history, stated explicitly because it differs from v0.15.0: when an item has a valid past qualifying reflection and also a later future-dated one (clock skew or imported data), the item completes on the past date and is counted in that week. In v0.15.0 the most recently saved qualifying entry was used; when that entry was the future-dated one, the item was flagged and left out of its real week. The diagnostic concerns the item's own completion date; a future-dated reflection elsewhere in history no longer affects an item completed earlier. That reflection remains visible in the learner's history. This case has no pinned test yet; one is listed as a follow-up in the handoff.

**FS-M6-05 No data migration.** Completion is derived at read time from saved reflections. No stored task, reflection, decision, pin or audit record is rewritten. Saved plans show the corrected date when the new build is served.

## Out of scope

- Commands, permissions and the reflection save rules (an active reviewed record is still required to save a reflection).
- Lesson plan items, which derive completion from `practice[lessonId].completedAt`. See the known adjacent defect in [README](README.md).
- Practical plan items, which take the first attempt at or after creation; attempts are appended oldest first, so that branch already returns the earliest.

## Journey as built

The Plan page, Plan item card, weekly review panel and recap downloads are unchanged in layout. Screenshots in `screenshots/` show the corrected week-2 state: the earlier reflection item reads "Saved completion: 6/10/2026, 9:00:00 am" (6 October, en-IN format, UTC plan timezone) after a second reflection on 12 October.
