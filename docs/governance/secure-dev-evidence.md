# Secure development and supply-chain evidence (item 24)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when CI, scanning or review practice changes.

Only what exists is listed. Nothing here is a certification.

| Practice | Evidence | Status |
|---|---|---|
| Reproducible install | `npm run install:ci` from `package-lock.json`; `npm ci` on the droplet (deploy/update.sh) | Present |
| Dependency inventory | [sbom/aplyd-academy.cdx.json](sbom/aplyd-academy.cdx.json) generated 2026-10-08 (third-party-inventory.md) | Present, one-off, not automated |
| Typecheck, build | `tsc --noEmit` and Worker build reported passing for v0.15.1 and the v0.17.0 candidate (as-built-v0.15.1/evidence, handoff) | Manual runs |
| Automated tests | model/domain suite (738 entries at v0.15.1; 995 reported for the v0.17.0 candidate), 80 request-guard cases, read-only browser suites | Manual; not re-run for this documentation change |
| Independent review of changes | A separate agent reviewer re-derived v0.15.1 claims; independent security source review of the exact-offering candidate (as-built-v0.15/evidence/security-findings.txt, independent-security.json) | Agent review only; no human review recorded |
| Code review gate | None enforced; PRs are drafts the owner merges | Gap |
| CI | `.github/workflows/ci.yml`, job `verify`: `npm ci`, lint ratchet against `.lint-baseline.json`, `tsc --noEmit`, Worker build, `npm test` (pure suites and guard) on every pull request and push to `main` | Present; not required by branch protection |
| Vulnerability scan (`npm audit`, Dependabot, secret scanning) | none run for this bundle | Gap |
| SAST / DAST / penetration test | none | Gap |
| Signed commits | Agent commits signed per handoff ("workspace's commit signing") | Partly |
| Branch protection / CODEOWNERS enforcement | CODEOWNERS file added; protection not configured | Gap |
| Artifact provenance | Worker builds embed a random build ID; compare source commits, not bundle hashes (handoff) | No SLSA/provenance |
| Secrets in repo | Policy only; no scanner run | Gap |

## Proposed next steps (owner decision)

1. Enable GitHub secret scanning and Dependabot alerts (no workflow file needed).
2. Make the `verify` check required on `main` (branch protection) and lower the lint baseline as the `any` clean-up lands.
3. Re-generate the SBOM on each release: `npx @cyclonedx/cyclonedx-npm --package-lock-only --output-format JSON --spec-version 1.5 --output-file docs/governance/sbom/aplyd-academy.cdx.json`.
4. Protect `main` (require PR and review) because the droplet deploys it automatically.
