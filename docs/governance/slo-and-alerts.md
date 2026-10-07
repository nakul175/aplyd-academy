# SLOs and alert catalogue (item 13)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when monitoring exists, hosting changes, or real users are admitted.

**These are proposed targets, not measured.** No SLI has been collected, no monitor, pager or dashboard exists, and the pilot has no users beyond the owner-private synthetic demo. No commitment is made to anyone.

## Proposed SLOs (pilot, droplet)

| ID | Service level indicator | Proposed target | Measured today |
|---|---|---|---|
| SLO-1 | Share of 5-minute checks where `GET /` through Caddy returns 200/307 for a signed-in test user | 99% per month | Not measured |
| SLO-2 | Updater runs that end `ok` in `deploy-status.json` | 95% of runs that find a new commit | Not measured |
| SLO-3 | Learner save (`POST /api/academy`) succeeds without 5xx | 99% of requests | Not measured |
| SLO-4 | Recovery: RPO 24 h, RTO 8 h (from docs/product-specifications/operations.md, "subject to approval") | as stated | No restore ever performed (backup-dr.md) |

Rationale: pilot-grade; one droplet, one SQLite file, no redundancy (deploy/README.md known limits). Error budget policy: TBD (owner: Nakul Jain).

## Alert catalogue (what should exist; none is wired)

| Alert | Signal available today | Proposed threshold | Action |
|---|---|---|---|
| Site down | `curl` to the public host; `systemctl is-active aplyd-academy` | 3 failed checks in 15 min | runbooks.md section 3 |
| Deploy failed | `deploy-status.json` `"state":"failed"` | any | journalctl -u aplyd-academy-update; rollback |
| Updates stalled | age of `at` in `deploy-status.json` is not the signal (it changes only on a new commit); compare with `git ls-remote` | main moved and not deployed for 15 min | check token expiry (secrets-register.md) |
| Disk low | `df /var/lib/aplyd-academy` | under 20% free | clear build caches; resize |
| Memory pressure during build | kernel OOM in journal | any | confirm 2 GB swap; raise droplet size |
| Certificate renewal failure | Caddy journal | any | journalctl -u caddy |
| Repeated 5xx | Caddy/app journal | TBD | incident-process.md |

Where it would live: DigitalOcean monitoring or an external uptime check. Not chosen. TBD (owner: Nakul Jain).

## Gaps

- No log shipping, metrics or error tracking. Logs live in journald on the droplet.
- Application availability signals (503 "temporarily unavailable" when `DB` is missing) exist in routes but are not counted.
