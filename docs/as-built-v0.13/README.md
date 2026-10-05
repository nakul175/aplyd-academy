# Aplyd Academy v0.13 implementation checkpoint

This release adds exact content-review/cohort attention, learner-controlled help details and local partner-choice inspection, and removes private exception details from unexpected request logs. The v0.12 templates, private record checks and learner guidance remain applicable.

[Functional design](functional-design.md), [HLD/LLD/API contract](architecture-and-contract.md), [additive data dictionary](data-dictionary.tsv), [test matrix](test-matrix.tsv) and [source-bound evidence](release-evidence.json) describe the shipped scope. The seven-table dictionary and migrations remain unchanged.

635 actual model/domain test entries passed. Separate actual-handler mocked-host checks passed27 groups/309 assertions. The final frozen build passed32 native endpoint cases/193 assertions, including immediate recovery after an oversized request. Help passed200 selected browser assertions in18 scenarios; partner inspection passed20 read-only browser scenarios. These are separate test scopes, not one combined assertion total. TypeScript and the final Worker build passed.

An actual help-append focus defect was corrected and checked across keyboard, user intent, cancellation and navigation. All browser suites used current fictional loopback identities, blocked protected writes/external requests, preserved saved state and closed their browsers. Display-only variants are not proof of stored server conditions or real learner trials.

The proposed streaming request reader is excluded. Three variants failed native immediate-next-request recovery; the restored existing reader passed the differential. Failed research evidence is retained and is not counted as shipped validation. No new incremental-memory guarantee is claimed.

Full mutating template and record browser workflows remain unexecuted pending explicit user fictional-test approval after automatic-review rejection. Live AI, live partner delivery, recognized certification, reviewed translations, hosted participant authorization, field-user usability, staffing, load and restore acceptance remain separate dependencies.

This is an intermediate checkpoint in the eight-hour sprint ending2026-10-06 at08:47:29 IST. Native publication and the exact merged main commit are recorded after publication in the external current development status. The Site audience remains owner-private.
