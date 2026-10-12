# ADR-P04: Pull-based deploy of `main` to a single droplet running the Workers runtime locally

Owner: Nakul Jain · Date recorded: 2026-10-08 (retrospective) · Status: Accepted for the synthetic pilot only

## Context
The owner wants copies of the Saha apps hosted on DigitalOcean (deploy kit PRs #1 to #3, 2026-10-07). Nothing may connect inward to deploy.

## Decision
Each droplet pulls `main` every 3 minutes with a read-only token or deploy key, builds, applies new `drizzle/*.sql` once each, and restarts the app under systemd. The app runs under `wrangler dev --local` with a local SQLite D1 file. Several apps may share one droplet with one Caddy and one build lock (deploy/README.md; deploy/update.sh).

## Consequences
No inbound deploy access and simple rollback by revert. `wrangler dev --local` is a development runtime, not for production or real farmer data. No CI gate, so a merge to `main` reaches the droplet within about 3 minutes. One host is one failure domain. The kit has been running on the shared DigitalOcean droplet since 7 October 2026 at https://academy.aplyd.org behind a Caddy password wall, synthetic data only; the `sslip.io` name redirects there since 8 October 2026.

## Alternatives considered
Push-based deploy over SSH (rejected in the kit design: no inbound access); managed platform (not chosen; hosting decision for production TBD, owner: Nakul Jain).
