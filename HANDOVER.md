# Aplyd Academy handover

## Status

The one place this repository states its current state (verified 8 October 2026 against `origin/main`, the droplet status file and the CI configuration).

| Item | State |
|---|---|
| Application | Working pilot v0.15.1 plus the local v0.15.2 (M7: a repeat `lesson` command for a completed lesson is refused with 409), the v0.16.0 demo layer and the v0.17.0 code-side Musts, all on `main`. Native hosted version of the old Site is still v0.15.0 |
| Hosting | Private copy on the shared DigitalOcean droplet `saha-apps` at https://academy.aplyd.org behind a Caddy password wall, synthetic data only. Merging to `main` deploys it within about three minutes ([deploy/README.md](deploy/README.md)). The old owner-private Sites copy at `aplyd-academy.nakul1729233.chatgpt.site` is not maintained |
| CI | `.github/workflows/ci.yml`, job `verify`: Node 22, lint baseline (1,140 errors, ratchet), typecheck, build, `pnpm test` |
| Evidence | Model/domain suite and the 80-case guard run in `pnpm test`; browser and API harnesses run by hand. Latest recorded counts: [docs/CLAUDE-HANDOFF.md](docs/CLAUDE-HANDOFF.md) "Current state" and the v0.17.0 section. Local and in-memory results are not hosted verification |
| Pending gates (owner) | Mutating fictional-fixture approval; live AI credential choice; real partner, identity and hosting; the decisions listed under the v0.17.0 candidate in the handoff |
| Entry points | [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), [CONTRIBUTING.md](CONTRIBUTING.md), [docs/DOCUMENTATION-INDEX.md](docs/DOCUMENTATION-INDEX.md) |

## Where the detail is

- Engineering record, newest first: [docs/CLAUDE-HANDOFF.md](docs/CLAUDE-HANDOFF.md). Its "Current state" and later sections supersede the original handoff below them.
- Release notes: [docs/release-notes.md](docs/release-notes.md). Change record: [CHANGELOG.md](CHANGELOG.md).
- Exact as-built evidence per version: `docs/as-built-v0.6` to `docs/as-built-v0.15.1` (non-cumulative: each folder describes what changed in that version).
- Original target: `docs/product-specifications/`. Preserved research (not authority): `docs/candidates/`, `docs/development-archive/`.
