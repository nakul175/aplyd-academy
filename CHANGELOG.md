# Changelog

Owner: Nakul Jain. Last reviewed: 2026-10-08. Update when a release or merged change is recorded.

The detailed release narrative stays in [docs/release-notes.md](docs/release-notes.md) (v0.2 to v0.15 reconciliation) and in the per-version evidence folders. This file is a short index derived from those and from `git log`; it does not restate test counts. If they disagree, the cited source wins.

## Unreleased (on main, not versioned)

- 2026-10-07: DigitalOcean deployment kit (`deploy/`): pull-based update every 3 minutes, Caddy basic-auth gateway, several apps per droplet, explicit `main` clone, writable wrangler scratch directory, bounded health check (PRs #1 to #3). The app has been running on the shared DigitalOcean droplet since 7 October 2026 at https://academy.aplyd.org behind a Caddy password wall, synthetic data only; the `sslip.io` name redirects there since 8 October 2026.
- 2026-10-08: governance documentation bundle (docs/governance/, SECURITY.md, LICENSE placeholder, CONTRIBUTING.md, `.github/` CODEOWNERS and PR template, `.env.example`, SBOM). Documentation only; no application, migration or library change.
- Branch `aca/practice-loop` (not merged, not deployed): practice loop R1 under `/loop` (organisations, enrolment, join with notice and consent, AI-level placement, context packs with expert review, hint-first AI coach behind an evaluation gate, weekly tasks and checks, reminders with STOP, S-01 to S-04 metrics, A-01 report, export, erasure and retention); R3 and R4 behind owner scope decisions (student pilot gates, briefs, year-end report, sector workspaces, local language, voice, annotations, invoices). Node runtime (ADR-0001 Option A: Next.js standalone, SQLite, email one-time-code sign-in) with its own deploy kit in `deploy/node/`, separate from the `deploy/` kit that serves the live site. Documentation set under `docs/` (architecture, API contract, data dictionary, runbook, threat model, findings). None of these stories is accepted yet.

## Candidates (in the repository; the hosted Site was not updated)

- v0.17.0 candidate (2026-10-07): registration/onboarding, workspace recovery with dummy identity checks, catalog facets, accommodations, dummy credentials with a labelled DUMMY issuer, escalation, programme rooms and more. See docs/CLAUDE-HANDOFF.md "v0.17.0 candidate". Hosted Site still serves v0.15.0.
- v0.16.0 candidate (2026-10-06): local demo layer and dummy credentials. See docs/CLAUDE-HANDOFF.md.

## 0.15.2 (2026-10-06, not published to the hosted Site)

- Engine refuses a repeat `lesson` command for a completed lesson (409); owner decision M7. Source: docs/CLAUDE-HANDOFF.md.

## 0.15.1 (2026-10-06)

- Reflection completion (M6): a plan item keeps the date of the first qualifying reflection. Only `lib/academy-plan.ts` changed. docs/as-built-v0.15.1/.

## 0.15.0 and earlier

Per release in docs/release-notes.md: v0.2 shared workspaces, v0.3 cohort networking, v0.4 learning plans and historical content, v0.5 support and safe refresh, v0.6 private course authoring, v0.7 workspace operations; later versions are recorded in docs/as-built-v0.8 to v0.15 and docs/implementation-review-v0.13. The reconciliation is in "Version 0.15 reconciliation and Claude handoff".

## Gaps

- Release notes for v0.8 to v0.14 are in as-built folders, not in docs/release-notes.md. TBD (owner: Nakul Jain): whether to backfill.
