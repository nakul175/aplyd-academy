# ADR-0001: Production runtime and database on DigitalOcean

Story: ACA-US-1.1 (Linear APL-2218) · Task: ACA-TT-1.1.1 · Epic: ACA-E1
Status: **Approved: Option A** by Nakul Jain on 12 October 2026, 17:1x IST (exact minute not captured), in conversation with Claude (in-app question: "Production runtime (ADR-0001)..."; answer: "Option A approve (Recommended)"). Claude wrote this record; the approval is the owner's.
Date: 12 October 2026 · Evidence branch: `aca/us-1.1-runtime-spike` (local; GitHub returned HTTP 403, so it is not pushed)

No production resource was created for this spike, and no data was moved.

## Decision needed

Which runtime and database the Academy runs on in production, before any real learner data (strategy bet B2; hosting rule: GitHub repository plus DigitalOcean hosting). Rule B2: port the v0.17 code if porting costs less than rebuilding; otherwise rebuild.

## What the v0.17 code depends on (measured on commit 53cdf1b)

| Dependency | Finding |
| --- | --- |
| Framework | vinext (Next 16.3.4 on Vite) built into a Cloudflare Worker; the droplet copy runs it with `wrangler dev --local`, a development runtime |
| Platform bindings | One only: the D1 database `DB` (`dist/server/wrangler.json`). No KV, R2, queues, AI or Durable Objects |
| Code touching the platform | 15 files import `cloudflare:workers` (13 API routes, `app/verify/lookup.ts`, `db/index.ts`); 32 uses of `env.DB`; 34 raw SQL `prepare()` calls in 10 files |
| Database | SQLite dialect: 7 tables, 7 drizzle migrations; most state is JSON stored per workspace |
| Sign-in | ChatGPT Sites identity headers (`oai-authenticated-user-*`). These do not exist outside ChatGPT Sites, so sign-in must be rebuilt anyway (ACA-US-1.4) |
| AI calls | None; no AI service is called today |

## Measured porting effort for one module

Module: `app/api/academy/route.ts`, the personal workspace API (load, save with revision check, idempotent action IDs, atomic save plus audit row).

- Ran **unchanged** on Node 22 with SQLite (`node:sqlite`) behind a plain Node HTTP server.
- New code: a D1-compatible adapter (`spikes/do-runtime/d1-node.mjs`, about 50 lines) and three import shims (Workers env, Next headers, redirect).
- 11 of 11 checks passed in 1.4 seconds: sign-in required; first read; enrol; idempotent replay; reused action ID refused; stale revision refused; second owner isolated; cross-origin refused; two concurrent writes, one wins; one audit row per saved change; data intact after a restart.
- All 14 server modules (13 routes and the credential lookup) also build for Node with the same three shims. That is a build check only; their behaviour on Node is not tested yet.
- Run it: `node spikes/do-runtime/run-spike.mjs` (writes `.sites-runtime/spike-do/result.json`).

Limits: local only, synthetic identities; the user interface was not built for Node; no load, backup or restore test.

## Options

| Option | Effort | Data location | Backup and restore | Running cost (components) |
| --- | --- | --- | --- | --- |
| **A. Port to Node, SQLite on a dedicated droplet volume** (recommended) | Lowest: route SQL unchanged; swap the D1 binding for the adapter, build the UI for Node, new sign-in | Single SQLite file on a DigitalOcean volume, in the region you pick | Continuous copy to DigitalOcean Spaces (for example Litestream) plus droplet backups; restore drill in ACA-US-1.3 | One droplet, one volume, Spaces |
| B. Port to Node, DigitalOcean Managed PostgreSQL | Medium: rewrite 34 raw SQL calls and the drizzle schema for Postgres, new migrations | Managed database cluster in the region you pick | Managed daily backups and point-in-time restore | One droplet plus the managed database (the larger cost) |
| C. Self-host the Workers runtime (workerd) | Not viable: the D1 binding is a Cloudflare service; locally it is only emulated, which is what runs today [Likely] | — | — | — |
| D. Rebuild on a new stack | Highest: discards v0.17's tested domain logic (S2: 995 domain tests, 318 browser acceptance checks) | Any | Any | Depends |
| E. Move to real Cloudflare Workers and D1 | Low, but breaks the DigitalOcean hosting rule | Cloudflare | Cloudflare | Cloudflare |

Prices are not stated here: Claude could not open DigitalOcean's pricing pages in this session. Check https://www.digitalocean.com/pricing before deciding.

## Recommendation

**Option A**, with a dedicated droplet (not the shared `saha-apps` droplet), SQLite in WAL mode on a volume, continuous backup to Spaces and a tested restore. Revisit option B if the Academy needs more than one app server or a cohort larger than one droplet can serve; the adapter keeps the SQL portable until then.

Confidence: [Likely] that A is cheaper than B and D for a one-cohort pilot, from the measured module. [Guessing] on the UI build for Node; that is the main unmeasured risk and the first thing ACA-US-1.2 must prove.

## What happens next

1. Done: Nakul Jain approved Option A on 12 October 2026 (recorded on APL-2218).
2. If approved: ACA-US-1.2 ports the remaining routes and the UI build, ACA-US-1.3 sets up backups and the restore drill, ACA-US-1.4 replaces ChatGPT Sites sign-in, ACA-US-1.5 adds the deploy pipeline.
3. Needed from Nakul before step 2: DigitalOcean access for Claude agents and working GitHub access (HTTP 403 today).
