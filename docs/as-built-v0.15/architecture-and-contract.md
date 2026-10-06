# M5 navigation: architecture and low-level delta

Status: current adopted M5 source; final local acceptance complete. Git/native publication is recorded in the handoff receipt after commit.

## FSD → HLD → LLD

| Requirement | Boundary | Candidate implementation |
| --- | --- | --- |
| FS-M5-01: card/preview agree | Pair exact metadata with the existing canonical private catalog document | `derivePrivateCatalogEntries`; shell `catalogOfferingTargets`; PathwayCard carries `{offering}` and renders its current cohort label |
| FS-M5-02: current exact intent | Revalidate current workspace/cohort/program/pin; no explicit-target fallback | `validIntent`, `selectPreviewCohort`, existing `resolvePinned` |
| FS-M5-03: own saved precedence | Existing non-withdrawn own enrollment remains the first content source | LearningView finds own enrollment before applying intent; `continuingOwnEdition` adds explanation only |
| FS-M5-04: history/manual picker | Hash-only navigation; existing shell state; no new persistence | `learningNavigationHash`, `parseLearningTarget`, shell `selectPreviewOffering`; LearningPage key remains enrollment/program + legacy tab/lesson |
| FS-M5-05: legacy learning | Preserve existing generic/tab/lesson shapes | Existing `go`/hash callback delegates offering syntax to the parser; generic targets remain unchanged |
| FS-M5-06: explicit Start | Current client gates; existing server remains authoritative | `canStartPreviewCohort`; existing `cmd({type:'enroll',programId,cohortId})` only on separate Start click |

Candidate paths are `lib/academy-offering-navigation.ts`, `app/academy.tsx`, `app/academy-learning.tsx` within the external reviewed kit. Root has applied the reviewed hunks; the navigation helper/shell match the staged candidate; LearningView now also contains the reviewed export correction. The navigation hunks were subsequently augmented by the retained-export correction. The adopted source paths are [navigation helper](../../lib/academy-offering-navigation.ts), [shell](../../app/academy.tsx) and [LearningView](../../app/academy-learning.tsx). Root retains ownership of further integration edits/freeze. Exact hashes are in [release-evidence.json](release-evidence.json).

## Exact data and parser rules

`OfferingIntent` has exactly three own keys: workspaceId, cohortId, contentRef. Workspace syntax is `tw-` plus 20–80 ASCII letters/digits/hyphens; cohort ID uses the existing 1–100 alphanumeric/hyphen identifier shape. Existing `contentRef` validates exactly scope/programId/versionId. A private scope must equal the target workspace; global references are also representable for explicitly chosen shared global cohorts. The hash is `#learn/<programId>/offering/<workspaceId>/<cohortId>/<scope>/<versionId>`, exactly seven slash-delimited segments, bounded to 700 characters. It contains no title, course body, learner ID, token, answer or score; URLs may contain internal workspace/cohort identifiers and must not be treated as credentials.

The parser returns `{offering:null}` for malformed explicit offering syntax. This preserves the difference from `undefined` (no explicit intent) and prevents default selection. `selectPreviewCohort` requires accepted current team ID, program ID, existing exact cohort ID and equality of full `contentKey(pinnedRef(cohort))`. With no explicit intent it preserves existing first-open/first-cohort behavior. A valid explicit cohort can still be closed/full/currently unavailable; matching intent is not authorization to start.

The private catalog preserves existing cohort ordering and one program entry. It resolves only current workspace-private content and pairs each chosen program with that same cohort’s pin; a non-withdrawn own private enrollment overwrites the entry with no alternative offering target. The map is derived only. If an own pin is unavailable, the existing PathwayCard own-enrollment branch masks its course body rather than borrowing the candidate preview. LearningView always resolves the own enrollment first.

`canStartPreviewCohort` requires selection.available + selection.explicit, a current cohort, team.active exactly true, learner role, available resolved snapshot with identical full pin, open status, contentOpen not false, positive integer capacity and nonnegative integer occupied below capacity. Existing busy/paused controls additionally gate the button. The helper does not reserve a seat or repeat server/CAS logic. Concurrent change is still decided by the existing server command; a UI URL cannot grant access or persist enrollment.

Manual selection updates target/hash and cancels any pending operation, without generic `go` focus/scroll. The mounted LearningPage key omits offering metadata, so manual changes are intended to retain picker focus. Generic go and hash history retain main focus. Workspace selection retains its existing clear/read sequence and discards private selection. The final browser report accepts recorded reload/Back/Forward, main focus, and manual Home/Enter selection with restored picker focus. It does not exercise End/Escape, real zoom, field users or formal conformance.

## Unchanged service and data boundary

No new API/method/envelope/command/schema/migration/role or stored reference field is proposed. Existing routes remain `/api/academy`, `/api/academy/export`, `/api/academy/records/check`, `/api/teams`, `/api/teams/history`. Existing accepted response subject/workspace masks, pin registry permissions and server role/capacity/CAS remain authoritative. No provider, recipient, connection, recognized credential or content publication is created by navigation. [Derived dictionary](data-dictionary.tsv) documents navigation-only metadata; the [M4 dictionary](../as-built-v0.14/data-dictionary.tsv) and archived v0.13 entity/permission review remain baseline references.

## Retained download contract

LearningView passes its existing own enrollment, accepted team, activeWorkspace and selected preview to retainedLearningExportCohort. With an enrollment, validate workspace/team equality, exactly one matching cohortId, actual pinnedRef semantics and full contentKey equality. A private own scope must equal that workspace. Return a detached matching cohort or null; never substitute the newer default. Personal own history yields null cohort. With no enrollment, preserve the selected preview or null. The enrollment is serialized unchanged. Missing source body does not invalidate exact matching metadata or grant authority. No API, schema, command, role, persistent field or server/CAS rule changes.

## Harness boundary and evidence

The shared read-only helper checks same-origin GET/HEAD before every intercepted fetch, uses maxRedirects:0, and refuses redirect status/Location/foreign response origin before JSON/fulfilment. No route.continue follows redirect hops. Its 80 source-bound cases and independent review are preserved. Semantic option-focus waits correct the earlier Home/Enter automation race without weakening exact-reference assertions.

The integrated source passes 727 model/domain entries (0 failures), full application TypeScript and Worker build. The 30 navigation and 22 export model groups are included in 727. The 80 network-free request guards are separate. Final acceptance passes 30/30 read-only browser scenarios, including five captured local JSON downloads, at 2026-10-05T22:03:32.923Z on Worker 69950. Source, harness, built/frozen entry and all downloaded-file hashes match. Actual personal, other-personal and workspace projections have equal before/after state, revision, team and contentVersions. There are zero forbidden requests and page errors. Body-text enlargement is not actual browser zoom; local fixtures are not hosted participant acceptance. No protected Start/save/complete action ran.
