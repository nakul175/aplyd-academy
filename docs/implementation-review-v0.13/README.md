# Aplyd Academy implementation review

This pack describes the implemented pilot through the published v0.13 checkpoint. Its native deployment succeeded on 5 October 2026 at 21:06:00 UTC, with main commit `8a769a24415169ea24b45b6f97ae89e050c99b19` and native Site version 14. Its purpose is to make product behavior, server authority, data ownership and validation traceable without treating the broader Academy vision as completed implementation.

The implementation has personal practice and shared workspaces, exact course editions, assigned practical assessment and independent appeals, moderated discussion, scoped networking, learner planning, private support, owner content review, reference-library access, personal offline draft preparation, and read-only private record checks. Ecosystem returns remain local simulations. Practice records are nonaccredited. Requested languages and assistance are learner preferences, not delivery commitments.

| Review artifact | Use |
| --- | --- |
| [Implemented design](implementation-review.md) | Functional behavior, architecture, low-level rules and API linkage |
| [Permission matrix](permission-matrix.tsv) | Action and read boundaries from actual server enforcement |
| [Data dictionary](data-dictionary.tsv) | Seven physical tables, aggregate entities, references and derived values |
| [API contracts](api-contracts.json) | Existing routes, envelopes, validation order and side effects |
| [Test traceability](test-traceability.tsv) | Meaningful smoke, unit, integration and regression cases with executed status |
| [Evidence register](evidence-register.json) | Exact evidence paths, counts, source agreement and limitations |
| [Review discrepancies](review-discrepancies.json) | Specific documentation reconciliation items and deferred work |
| [Source manifest](source-manifest.json) | Source snapshot and byte hashes used for this review |

The matrix uses the stored `admin` role for the product's “workspace owner” label. Roles combine, but they do not waive assignment, scope, independence, active-membership, exact-reference or lifecycle checks. Physical table fields and aggregate fields are distinguished in the dictionary; collections such as courses and submissions live inside the canonical JSON aggregates rather than new relational tables.

The evidence register keeps suites separate. The post-deferral v0.13 rule transcript reports 635 passing test entries; the fixed-log handler suite reports 27 groups and 309 assertions, while the retained-reader native suite reports 32 cases and 193 assertions. These are different validation units and are not an overall test total. Earlier source-bound evidence remains useful only for its unchanged modules and described scope.

The prepared template API/browser workflow and the full mutating record browser workflow are held pending the explicit local fictional-test-data decision. Existing local read-only browser runs use fictional identities and, for selected display cases, intercepted GET copies. They do not establish hosted authentication, partner receipt, production load/restore, human screen-reader certification, field usability or recognized issuer authority.

Weekly review, next-step partner onboarding and before-start candidates are separate M4 proposals. They become implemented behavior only after root adoption, current-source verification and a recorded release boundary. Streaming request-body research is deferred after failed native recovery checks; current routes retain `Request.text()` and the existing post-read limits.

No product command, database write, browser test, server, build or deployment was executed by this documentation workstream. All changes in this pack were staged outside the product checkout. Root remains responsible for final release metadata, main merge and native publication.

The [v0.13 publication receipt](/Users/athena/.codex/.chatgpt-projects/g-p-6ab89116b65c81919bb561fed2d716c0/outputs/aplyd-academy-eight-hour/m3-publication.json) confirms the exact merged commit, successful deployment and preserved owner-private audience. The current demo is [Aplyd Academy](https://aplyd-academy.nakul1729233.chatgpt.site/). This intermediate checkpoint does not conclude the eight-hour sprint.
