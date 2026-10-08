# Third-party inventory and SBOM (item 19)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when `package.json`/`package-lock.json` change, a hosted service is added, or a library file is replaced. Regenerate the SBOM on each release.

## SBOM

[`sbom/aplyd-academy.cdx.json`](sbom/aplyd-academy.cdx.json): CycloneDX 1.5 JSON, generated **2026-10-08** from `package-lock.json` (`npx @cyclonedx/cyclonedx-npm@6.0.1 --package-lock-only --output-format JSON --spec-version 1.5`; tool timestamp in the file reads 2026-10-07T21:57Z by the generating machine's clock). 722 components, direct: 24 dependencies and 20 devDependencies (`package.json`). It covers npm packages only: not Node, Caddy, Ubuntu, the Workers runtime binaries beyond npm, or fonts/images. No vulnerability scan was run on it.

Licence summary of the 722 components (declared SPDX in the lockfile metadata): MIT 597, Apache-2.0 43, ISC 28, MPL-2.0 16, LGPL-3.0-or-later 10 (all `sharp-libvips-*`, optional platform binaries), BSD-2/3-Clause 15, others small (CC0-1.0, CC-BY-4.0 `caniuse-lite`, Python-2.0 `argparse`, 0BSD, compound expressions). Review before any redistribution: MPL-2.0 (`lightningcss`, `axe-core`, `satori`, `resvg-wasm`, `og`) and LGPL-3.0 (`sharp-libvips`, `sharp` Windows builds). The droplet installs Linux builds only; whether libvips is bundled in the deployed Worker output: TBD (owner: Nakul Jain).

## Vendored and supplied material

| Item | Location | Terms |
|---|---|---|
| shadcn tailwind CSS 4.13.0 | `vendor/` | MIT (`vendor/shadcn-tailwind-4.13.0.LICENSE.md`) |
| Build plugin | `build/sites-vite-plugin.LICENSE` | see file |
| Library originals: 20 Word/PDF/PowerPoint files, five collections | `public/library/` | **Unchanged originals; terms TBD (owner: Nakul Jain).** Not relicensed by this repository's LICENSE placeholder. Preserve bytes. |
| Curriculum and Hindi draft | `lib/`, `scripts/build-curriculum-0.2.mjs`, `scripts/curriculum-0.2-hindi.mjs` | Authored for the project; draft, not sector approved |

## Runtime and hosting services

| Service | Use | Data it sees |
|---|---|---|
| DigitalOcean droplet (Bangalore) | Hosts the app, database file, backups if enabled | All pilot data (synthetic) |
| Caddy (apt repo, cloudsmith) with Let's Encrypt | HTTPS, basic auth, header injection | Credentials hashes file, traffic |
| sslip.io | Wildcard DNS name for the droplet IP | DNS lookups of the host name |
| GitHub | Source, pull-based deploy token/deploy key | Source only |
| NodeSource apt repo; npm registry | Install Node 22 and packages at build | none of the data |
| Cloudflare Workers runtime (open-source `workerd` through wrangler, local mode) | Executes the Worker | In-process; `CLOUDFLARE_CF_FETCH_ENABLED=false`, metrics off |
| Sites hosting (owner's hosted copy) | Owner-private hosted version | Pilot data (synthetic); terms TBD |
| AI provider | **None. No AI service is called.** | n/a |
| Email/SMS/payments/analytics | None | n/a |

## Gaps

- No automated licence check, no vulnerability feed, no SBOM for OS packages.
