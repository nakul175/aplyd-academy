# Threat model (item 20)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when the trust boundary, hosting, identity source or a data flow changes.

**Agent-drafted 2026-10-08, not reviewed by a person or counsel; no certification or compliance claimed.** It is built from files I read, not from testing. The design-level register TH-01 to TH-16 in docs/product-specifications/security-and-privacy.md is a specification for the reference system and "does not prove those controls are working".

## System and trust boundaries

Browser -> Caddy on the droplet (HTTPS, basic auth, sets identity headers) -> Worker runtime on `127.0.0.1:3500` -> local D1 SQLite file. Alternative path: the owner-private Sites host supplies the headers. The app trusts `oai-authenticated-user-*` headers (app/chatgpt-auth.ts). No outbound calls: no AI, no email, no partner (only a loopback dummy). Assets: learner work and evidence, workspace membership, staff assessment decisions, nonaccredited records, library files, sign-in list.

## Threats and status

| ID | Threat | Mitigation present (source) | Residual / status |
|---|---|---|---|
| T1 | Forged identity headers reach the app | Caddy overrides the three headers and strips full-name headers (deploy/Caddyfile); app listens on 127.0.0.1 only; firewall 22/80/443 | Holds only if nothing else can reach port 3500 and the Caddy file is intact. Not verified on a real droplet. Local tests use synthetic headers and "do not prove" hosted header integrity (docs/implementation-review-v0.13) |
| T2 | Shared credentials, weak sign-in | Random 20-char passwords, bcrypt cost 12 (deploy/add-user.sh) | No MFA, no lockout, no sign-out, no per-session revocation (deploy/README.md) |
| T3 | Cross-user or cross-workspace read by changing an ID | Server canonical state; every read checks current member, role, cohort scope, assignment; hidden resources return unavailable (permission-matrix.tsv) | Unit/pure and local suites only; no independent penetration test |
| T4 | Self-review or original-assessor appeal review | Independence enforced in `lib/academy-teams.ts` | Covered by repo tests (counts in release-evidence); not re-run here |
| T5 | Lost update / replay of a command | Revision fence plus actionId + SHA-256 request hash (app/api/academy/route.ts) | Native concurrency suites reported in as-built docs; not re-run here |
| T6 | Invitation token theft or reuse | Token stored as hash; recipient-email bound; 7-day expiry; no reuse | Links are copied manually; email channel absent |
| T7 | Stored script in posts, drafts, content | React rendering; structured fields (bounded sizes) | No specific XSS test evidence read for this bundle. TBD (owner: Nakul Jain) |
| T8 | Resource exhaustion by large state | Byte caps: personal 1 MB, shared 1.2 MB normal / 1.8 MB protective; 100,000-char request cap; workspace/member limits (README) | No rate limiting at Caddy or app. TBD |
| T9 | Public credential verification leaks records | Verify route returns uniform 404 unless learner share is on (handoff, v0.16) | Dummy issuer with a fixed public demo key; not a certifying body |
| T10 | Secret in repo or logs | No app secrets; deploy token on the droplet only (secrets-register.md) | `DEMO_SHARED_SECRET` is a labelled constant in source for the local dummy partner; must never be reused as a real secret |
| T11 | Supply chain: malicious dependency or build | Lockfile install (`npm ci`); SBOM (sbom/) | No audit run, no provenance, build runs as root on the droplet (update.sh) |
| T12 | Droplet compromise or loss | UFW, non-login service user `saha`, systemd hardening (NoNewPrivileges, PrivateTmp, ProtectHome) | Single host, `wrangler dev --local` is a development runtime (deploy/README.md); no backups proven |
| T13 | Auto-deploy of a bad or malicious commit | Pull from `main` only | Anyone able to merge to `main` controls production within 3 minutes; no branch protection recorded |
| T14 | Fixtures run against live URL pollute or expose data | Rule in CLAUDE.md and CONTRIBUTING.md | Procedural only |
| T15 | Deleted data reappears after restore | none | No deletion manifest (TH-16 of the design) |

## Not covered

AI/model threats (no AI call exists: ai-features.md), real email, real partner webhooks, payment. Re-assess before any of these exists.

## Next steps

Independent security review and penetration test: TBD (owner: Nakul Jain).
