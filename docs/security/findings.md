# Security review findings (ACA-US-12.2, AC2 and AC3)

Review of the production setup as code on branch `aca/practice-loop`, 13 October 2026, by Claude: dependencies (`npm audit`), configuration (`deploy/`, `next.config.ts`), secrets handling and organisation isolation (unit tests in `tests/loop`). Severity: critical, high, medium, low. High and critical must be fixed before the go/no-go review. Remaining risks are accepted or rejected only by Nakul Jain, recorded as the `risk.acceptance` decision with the finding id as scope.

| ID | Finding | Severity | Owner | Status |
| --- | --- | --- | --- | --- |
| F-01 | `next` 16.3.4 had published advisories rated critical (RCE in `next/og`, cache poisoning, SSRF in image optimisation). | critical | Claude | **Fixed**: upgraded to 16.4.0; `npm audit --omit=dev` reports 0. |
| F-02 | `sharp` < 0.35.5 (librsvg CVE) reachable through image optimisation. | high | Claude | **Fixed**: override to 0.35.5 and `images.unoptimized: true` (no `next/image` is used). |
| F-03 | No limit on AI coach questions: cost abuse and noisy-neighbour risk. | medium | Claude | **Fixed**: 30 questions per learner per hour (429 after). |
| F-04 | Invite and confirmation links use the request host unless `ACADEMY_PUBLIC_ORIGIN` is set: host-header injection could produce links to another host. | medium | Nakul Jain (setup) | **Mitigated**: `ACADEMY_PUBLIC_ORIGIN` is set in `academy.env.example`; required in production. |
| F-05 | Learner work files under `/var/lib/academy/files` are not in the Litestream backup (it covers the database only). A disk loss loses files. | medium | Nakul Jain (decision) | **Open**: choose between a nightly encrypted Spaces sync of the file store, or accepting that files are not backed up (minimal data). |
| F-06 | Development-only dependencies (vite, wrangler/miniflare, eslint plugins, react-server-dom-webpack dev copy) have high/moderate advisories. | low | Claude | **Open, low impact**: not in the standalone production build; update when the Cloudflare preview path is retired. |
| F-07 | Age at joining is self-declared. | medium | Nakul Jain (legal review) | **Open**: depends on the legal review (DPDP verifiable consent applies to children; R1 is adults only). |
| F-08 | AI provider receives learner questions; data location and terms are not yet reviewed. | high | Nakul Jain (legal review) | **Open, blocks AI for real learners**: AI stays `off` until AIA-ACADEMY-01 is approved and the evaluation passes. |
| F-09 | WhatsApp/SMS inbound webhook uses a shared secret, not a provider signature. | low | Claude | **Open until the provider is chosen**; add the provider's signature check in its adapter. |
| F-10 | No external penetration test. | medium | Nakul Jain | **Open (not decided)**. |
| F-11 | Organisation isolation | – | Claude | **Checked**: cross-organisation reads and writes refused and logged in tests (`e2-enrolment`, `e8-e14`), files refused for admin and facilitator in the browser journey. |

Remaining-risk decisions by Nakul Jain: none recorded yet.
