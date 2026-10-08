# Governance map: the 27 standard documents

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when any document below moves, is created, or is superseded.

Decision (owner, October 2026): every app carries all 27 standard documents. This page maps each to **one canonical path**, its status, and the review date. Documents created on 2026-10-08 were **agent-drafted from files in this repository and have not been reviewed by a person or counsel**; threat, privacy and compliance documents claim no certification. Unknowns are marked `TBD (owner: Nakul Jain)`. Nothing here changes application code, migrations, curriculum pins, library bytes, `docs/candidates/` or `docs/development-archive/`.

## The 27 items

Status: **Present** (existed, mapped), **Fixed** (existed in part, completed), **Created** (was missing). All last-reviewed 2026-10-08.

| # | Item | Canonical path | Status |
|---|---|---|---|
| 1 | README | [README.md](../../README.md) (docs links added) | Present |
| 2 | LICENSE, CODEOWNERS | [LICENSE](../../LICENSE) (placeholder, no licence chosen), [.github/CODEOWNERS](../../.github/CODEOWNERS) | Created |
| 3 | Contributing, PR template | [CONTRIBUTING.md](../../CONTRIBUTING.md), [.github/PULL_REQUEST_TEMPLATE.md](../../.github/PULL_REQUEST_TEMPLATE.md) | Created |
| 4 | Env/config reference | [.env.example](../../.env.example), [env-config-reference.md](env-config-reference.md) | Created |
| 5 | Changelog | [CHANGELOG.md](../../CHANGELOG.md) over [docs/release-notes.md](../release-notes.md) | Fixed |
| 6 | Security policy | [SECURITY.md](../../SECURITY.md) | Fixed |
| 7 | Architecture overview | [implementation-review-v0.13/implementation-review.md](../implementation-review-v0.13/implementation-review.md) (as built); target: [HLD.md](../product-specifications/HLD.md) | Present |
| 8 | Design docs / RFC process | [FSD](../product-specifications/FSD.md), [HLD](../product-specifications/HLD.md), [LLD](../product-specifications/LLD.md); change control in [decisions-and-roadmap.md](../product-specifications/decisions-and-roadmap.md) ("Documentation change control"); contribution flow in CONTRIBUTING.md | Present |
| 9 | ADRs | [adr/README.md](adr/README.md) | Fixed |
| 10 | API contract | [api-contract.md](api-contract.md) (openapi.json does not match the routes) | Fixed |
| 11 | Data dictionary, migrations | [data-dictionary-and-migrations.md](data-dictionary-and-migrations.md) | Present, indexed |
| 12 | Runbooks | [runbooks.md](runbooks.md) | Fixed |
| 13 | SLOs, alerts | [slo-and-alerts.md](slo-and-alerts.md) (proposed, not measured) | Created |
| 14 | Incident process, postmortem | [incident-process.md](incident-process.md), [postmortem-template.md](postmortem-template.md) | Fixed |
| 15 | Backup/DR, restore log | [backup-dr.md](backup-dr.md) (zero restore tests) | Fixed |
| 16 | Test strategy | [test-strategy.md](../product-specifications/test-strategy.md) (plan); executed results: [as-built-v0.15.1/test-matrix.tsv](../as-built-v0.15.1/test-matrix.tsv) | Present |
| 17 | Release/deploy process | [release-process.md](release-process.md) | Fixed |
| 18 | User and admin guides | [user-and-admin-guide.md](user-and-admin-guide.md) | Fixed |
| 19 | Third-party inventory, SBOM | [third-party-inventory.md](third-party-inventory.md), [sbom/](sbom/aplyd-academy.cdx.json) | Fixed |
| 20 | Threat model | [threat-model.md](threat-model.md) | Fixed |
| 21 | Access-control model | [access-control-model.md](access-control-model.md) | Fixed |
| 22 | Secrets/key register | [secrets-register.md](secrets-register.md) (no values) | Created |
| 23 | Privacy docs | [privacy-ropa-dpia.md](privacy-ropa-dpia.md), [privacy-retention-dsr.md](privacy-retention-dsr.md) | Fixed |
| 24 | Secure-dev / supply-chain evidence | [secure-dev-evidence.md](secure-dev-evidence.md) | Fixed |
| 25 | Accessibility statement | [accessibility-statement.md](accessibility-statement.md) (no conformance claimed) | Created |
| 26 | AI-feature docs | [ai-features.md](ai-features.md) (no AI enabled) | Created |
| 27 | Compliance control mapping | [compliance-control-mapping.md](compliance-control-mapping.md) | Created |

## One canonical document per topic

Newest as-built folder is **docs/as-built-v0.15.1** (CLAUDE.md). It records only the v0.15.1 delta; for older facts the earlier folders remain the source, as below. Where this table names a different folder it is because the newer folders do not repeat that topic.

| Topic | Canonical | Why |
|---|---|---|
| Current state, gates, decisions | [CLAUDE-HANDOFF.md](../CLAUDE-HANDOFF.md) "Current state" and later sections | CLAUDE.md |
| Behaviour as built (functional) | [as-built-v0.15.1/functional-design.md](../as-built-v0.15.1/functional-design.md) for the M6 change; base: [implementation-review-v0.13/implementation-review.md](../implementation-review-v0.13/implementation-review.md) | v0.15.1 is a delta |
| Low-level contract | [as-built-v0.15.1/architecture-and-contract.md](../as-built-v0.15.1/architecture-and-contract.md) (delta); routes: [implementation-review-v0.13/api-contracts.json](../implementation-review-v0.13/api-contracts.json) | See api-contract.md |
| Data dictionary | [implementation-review-v0.13/data-dictionary.tsv](../implementation-review-v0.13/data-dictionary.tsv) then v0.14, v0.15, v0.15.1 deltas | No cumulative file (data-dictionary-and-migrations.md) |
| Permissions | [implementation-review-v0.13/permission-matrix.tsv](../implementation-review-v0.13/permission-matrix.tsv) | Only full matrix |
| Test evidence, newest | [as-built-v0.15.1/release-evidence.json](../as-built-v0.15.1/release-evidence.json) and `test-matrix.tsv` | Newest tested commit |
| Release notes | [release-notes.md](../release-notes.md) (v0.2 to v0.7 and the v0.15 reconciliation) | |
| Original product target | [product-specifications/](../product-specifications/) | Target, not as built |
| Deploy to droplet | [deploy/README.md](../../deploy/README.md) | |

## Superseded or duplicate copies (kept, not deleted or moved)

Do not edit these; use the canonical item above.

- **docs/as-built-v0.15/** (README, architecture-and-contract, functional-design, test-matrix, data-dictionary, wireframes): superseded by v0.15.1 for plan completion only; still canonical for v0.15 retained-export facts (`retained-export-addendum.md`) and the 30-scenario browser run. Its `evidence/pre-finalization-*` files (README, architecture, functional design, test matrix, wireframes, documentation.json, retained-export addendum) are earlier drafts of the final files beside them.
- **docs/as-built-v0.14/**, **v0.13/**, **v0.12/**, **v0.11/**: each holds the same file names (README, architecture-and-contract, functional-design, data-dictionary, test-matrix, release-evidence) with different, version-scoped contents (data-dictionary, architecture, functional-design and test-matrix compared by checksum 2026-10-08: no two are byte-identical). Superseded for current behaviour; v0.11 still holds an `api-and-commands.json` not repeated later; v0.14 holds the weekly review and before-start rules.
- **docs/as-built-v0.6 to v0.10**: historical deltas (text and JSON).
- **docs/test-evidence.json**: points to release 0.15.0; stale relative to as-built-v0.15.1/release-evidence.json.
- **README.md header** says v0.15.1 while the handoff describes v0.16/v0.17 candidates on `main`; trust the handoff.
- **docs/candidates/** and **docs/development-archive/**: preserved research, not authority.

## Not done (gaps recorded in each document)

No CI workflow added (`.github/workflows/` absent; recorded in secure-dev-evidence.md). No licence chosen. No restore test, SLO measurement, accessibility audit, DPIA review, or penetration test exists. Deploy kit not yet run on a droplet.
