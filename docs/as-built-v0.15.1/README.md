# Aplyd Academy version 0.15.1 implementation review

M6 fixes how the learning plan dates a completed reflection item. In v0.15.0 a learner who planned a work reflection, saved it, and later saved another reflection for the same enrollment saw the old plan item's "Saved completion" date jump to the newer reflection. The weekly review then counted that item in the later week and no longer in the week it was actually done. The cause was ordering: the engine stores reflections newest first and the plan took the first matching entry.

The plan item now keeps the date of the first reflection saved at or after the item was created. Every reflection stays in the learner's history. A plan item created later still completes from the first reflection after its own creation. Completion is derived when the plan is read, so saved plans show the corrected date as soon as this build is served. No stored data is rewritten.

## What changed

- `lib/academy-plan.ts`, reflection branch of `taskProgress` only. This is `docs/candidates/reflection-completion/integration.patch` applied unchanged; the resulting file is byte-identical to the reviewed candidate snapshot (SHA-256 `fd9ae324…`).
- `tests/reflection-completion-qa/`: the candidate's 11-entry, 62-assertion regression adopted with an actual-checkout single-model compiler, plus a new strictly read-only Plan/weekly browser harness with 11 scenarios.
- No change to API routes, commands, schema, migrations, stored fields, permissions, curriculum pins, library bytes or UI layout.

Tested source commit: `059868abc3ae9667980d8caad6395efe4e70f55a` on top of `32c89826ca410794396a0380a8994ee7bf5dadac` (code tree `cbf74c740ebeafcc0a2a40ed9c88dd955b9f1c3c`). The documentation commit that follows it adds no application or test code.

## What was tested

All runs used a Linux x86_64 workspace, Node 22.22.0, dependencies installed with `npm run install:ci` from `package-lock.json`, and Playwright 1.56.0 with headless Chromium. None ran on the owner's Mac or against the hosted Site.

| Check | Source | Result |
|---|---|---|
| Baseline model/domain suite (exact v0.15 invocation) | `32c8982` | 727/727 pass |
| Baseline request guards (separate suite) | `32c8982` | 80/80 pass |
| Baseline TypeScript and Worker build | `32c8982` | pass |
| Candidate BEFORE reproduction | `32c8982` | defect reproduced: completion moves to 2026-10-12, week 1 counts 0, week 2 counts 1 |
| Adopted regression against unpatched plan (control) | `32c8982` | 3 pass, 8 fail, as expected for a real regression |
| Focused regression | `059868a` | 11/11 entries, 62 assertions, recorded inside the full run below; an independent standalone re-run on the same code tree gave the same result |
| Full model/domain suite plus the new file | `059868a` | 738/738 pass; the 11 additions are the only new names |
| Request guards (separate suite) | `059868a` | 80/80 pass |
| TypeScript `--noEmit` | `059868a` | exit code 0, no output, on a clean export of the commit ([tsc-exit.txt](evidence/final-059868a/tsc-exit.txt)) |
| Worker build | `059868a` | pass; built entry `09ca54ac…` |
| Read-only Plan/weekly browser acceptance on that frozen build | `059868a` | 11/11, 3 actual local downloads, 456 requests all GET, 0 forbidden, 0 page errors |
| Same browser harness against an unpatched build (contrast) | `32c8982` | 4 pass, 7 fail; the unpatched page shows "Saved completion: 12/10/2026, 10:00:00 am" for the earlier item. The build came from an export whose 700 tracked files are byte-identical to `32c8982`; its entry is `30239c32…` ([contrast-source.json](evidence/browser-before-contrast/contrast-source.json)) |

Counts are not additive. The 738 entries contain the 727 earlier entries and the 11 new ones; the 62 assertions sit inside those 11 entries; the 80 guards and the browser scenarios are separate suites. Earlier v0.15 browser results (30 scenarios) were not re-run and remain in their original scope.

In the contrast evidence, `sourceHashes` and `modelHash` describe the harness's expectation model, built from the patched checkout. The runtime under test is identified by its frozen entry hash.

## Independent check

A separate reviewer that had not seen the work re-derived the claims from the first committed version of this release (see Provenance; same code tree `cbf74c74…`) and its raw evidence. It confirmed that the code commit changes product source only in `lib/academy-plan.ts`, exactly as `integration.patch`; that the documentation contained no application or test code; that the 11 adopted test bodies are unchanged from the candidate; and that every count matched the raw files. It re-ran the focused regression (11/11, 62 assertions). It raised the evidence gaps closed in this pack (contrast provenance, recorded typecheck exit code) and the residual risks listed under Limits. All figures in this pack were then regenerated from a fresh run on `059868a`; they are identical, including the downloaded recap bytes.

## Provenance

The commits in this release are authored and committed by Claude and signed. A first version of this release (`e4ed7ca`, `aa7f147`, `fbc36ec`) was committed under the owner's identity by mistake and was replaced before publication. The replacement code commit has the identical tree; the documentation was regenerated in a single commit with evidence from a fresh run on `059868a`. Nothing built on the replaced commits.

## Limits

- The browser harness fulfils `/api/academy` and `/api/teams` GET responses inside the page from states built by the actual engine. The server routes and D1 were not exercised. The envelope mirrors the route source.
- The page clock is fixed per scenario to show the learner's current week. Real elapsed time was not tested.
- 32 px body text tests enlargement, not browser zoom. Layout checks are not an accessibility audit.
- Worker builds embed a random build ID, so bundle bytes differ between builds of the same source. The release boundary is the source commit; the tested runtime hash applies to this local build only.
- Mutating fictional-fixture tests remain held pending the owner's explicit answer. Nothing here created a learner, draft, cohort or record anywhere.
- The browser guard is registered on the page, not the browser context, so a popup or WebSocket would bypass it. The harness opens neither and the app has no WebSocket, EventSource or beacon code. The `/api/` match uses the raw path; an unprefixed or encoded variant would be forwarded as a GET, and every current GET handler is read-only. Both are candidates for hardening.
- `evidence/lesson-sibling-probe.mjs` is a standalone probe script kept as evidence. It is not referenced by any build or test command.

## Known adjacent defect, not fixed here

Running the `lesson` command again for an already completed lesson is accepted by the engine and overwrites `practice[lessonId].completedAt`, which moves that lesson's plan item to the later week. The Learn view offers "Next step" instead of "Complete lesson" for a completed lesson and stale tabs are refused by the revision check, so this is reachable only through a direct API call on the learner's own data. Probe: [evidence/lesson-sibling-probe.json](evidence/lesson-sibling-probe.json). Fixing it changes engine command semantics and needs a decision (refuse re-completion, or keep the first completion date while allowing a revised practice answer).

## Publication

Not published. The hosted Site remains v0.15.0, native version 16, owner-private. Publishing needs a fresh credential from the owner's Sites workflow, which this environment cannot obtain. The external release receipt records the main commit and publication state.

- [Functional design](functional-design.md)
- [Architecture and low-level contract](architecture-and-contract.md)
- [Data dictionary](data-dictionary.tsv)
- [Test traceability](test-matrix.tsv)
- [Release evidence](release-evidence.json)
- Journey screenshots: [week 1](screenshots/week1-plan.png), [week 2](screenshots/week2-plan.png), [390 px](screenshots/week2-plan-390-normal.png), [390 px with 32 px text](screenshots/week2-plan-390-body32.png)
