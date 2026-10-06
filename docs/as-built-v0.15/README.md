# Aplyd Academy version 0.15 implementation review

Private cohort cards now open the same exact course edition they advertise. Deliberate cohort choice survives reload and Back/Forward; own saved enrollment remains first. Unavailable own learning exports only matching own cohort metadata or null, preserving enrollment and avoiding an unrelated newer cohort.

The integrated source passes 727 model/domain entries (0 failures), full application TypeScript and Worker build. The 30 navigation and 22 export model groups are included in 727. The 80 network-free request guards are separate. Final acceptance passes 30/30 read-only browser scenarios, including five captured local JSON downloads, at 2026-10-05T22:03:32.923Z on Worker 69950. Source, harness, built/frozen entry and all downloaded-file hashes match. Actual personal, other-personal and workspace projections have equal before/after state, revision, team and contentVersions. There are zero forbidden requests and page errors. Body-text enlargement is not actual browser zoom; local fixtures are not hosted participant acceptance. No protected Start/save/complete action ran.

- [Functional design](functional-design.md)
- [Architecture and low-level contract](architecture-and-contract.md)
- [Data dictionary](data-dictionary.tsv)
- [Executed and deferred test matrix](test-matrix.tsv)
- [As-built journeys](wireframes-and-journeys.html)
- [Retained export resolution](retained-export-addendum.md)
- [Exact acceptance evidence](release-evidence.json)

Publication receipt and actual source/main SHA are recorded after Git commit in the external handoff receipt; the committed acceptance pack does not invent its own commit SHA. Pre-finalization documents and earlier 705/25 results remain historical evidence. Protected fictional-fixture testing still awaits the explicit pending user answer after automatic approval review rejected its launch.
