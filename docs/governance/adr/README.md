# Architecture decision records (item 9)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when a decision is taken, superseded or reversed. Add a new numbered file; never rewrite an accepted record, supersede it.

Two series exist because the design and the pilot diverge:

1. **Design series ADR-01 to ADR-10**: "Proposed architecture decisions" for the reference system, in [decisions-and-roadmap.md](../../product-specifications/decisions-and-roadmap.md). Status: Proposed. Not renumbered or edited. Open decisions D-01 to D-14 are in the same file.
2. **Pilot series ADR-P01 onward**: decisions visible in the implemented code and deployment, recorded retrospectively on 2026-10-08 by an agent from the files cited in each record. They are descriptions of what was built, not evidence that each was a deliberate, reviewed decision. The owner has not reviewed them.

| ID | Title | Status |
|---|---|---|
| [ADR-P01](P01-json-aggregate-store-with-revision-fence.md) | Seven-table D1 store with JSON aggregates and a revision fence | Accepted (as built) |
| [ADR-P02](P02-trusted-host-identity-headers.md) | Identity from trusted host headers; Caddy as gateway on the droplet | Accepted (as built), with known limits |
| [ADR-P03](P03-exact-curriculum-pins.md) | Exact immutable curriculum pins; no fallback to latest | Accepted (as built) |
| [ADR-P04](P04-pull-based-deploy-on-droplet.md) | Pull-based deploy of `main` to a single droplet running the Workers runtime locally | Accepted for synthetic pilot only |

Template: [_template.md](_template.md).
