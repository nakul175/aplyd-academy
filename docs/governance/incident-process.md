# Incident process (item 14)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when a real incident occurs, staff are named, or real learners are admitted.

Status: proposed process for a pilot with synthetic data and one named owner. It builds on the severity table in docs/product-specifications/operations.md and has never been exercised. Named on-call people, acknowledgement targets and external notification duties: TBD (owner: Nakul Jain). No automatic notification to third parties is authorised.

## Severity

| Level | Example | First action |
|---|---|---|
| Critical | Cross-user or cross-workspace disclosure; wrong person gets staff access; a fixture run against a hosted URL | Contain (stop service or remove access), preserve evidence, tell the owner |
| High | Site down, saves failing, deploy loop | Restore service via runbooks.md |
| Medium | One workspace affected, or stale dashboard data | Bound the scope, workaround |
| Low | Cosmetic or content error | Normal change path |

## Steps

1. **Detect and declare**: whoever notices writes the time, symptom and who they told. Security reports arrive at nakul.jain@aplyd.com (SECURITY.md).
2. **Contain**: for suspected disclosure, `systemctl stop aplyd-academy` or remove the affected sign-in from `/etc/saha/aplyd-academy.users` and reload Caddy.
3. **Preserve**: copy `journalctl -u aplyd-academy`, `journalctl -u caddy`, `deploy-status.json` and the relevant database file before changing anything. Do not paste secrets or learner content into tickets.
4. **Diagnose and fix** using the runbooks; fix forward with a draft PR, or revert.
5. **Communicate**: owner decides who is told. With synthetic data only there are no data-subject notification duties; this changes the day real data is loaded (privacy-ropa-dpia.md).
6. **Close**: write a blameless postmortem within 5 working days for High and Critical, using [postmortem-template.md](postmortem-template.md). Store it in `docs/governance/postmortems/` (folder created at first use).

## Specific runbooks inherited from the design

Delayed partner delivery and credential discrepancy are in docs/product-specifications/operations.md. The partner link is a local dummy in the pilot, so the delivery runbook applies only when a real partner exists.

## Gaps

- Never tested; no tabletop exercise held.
- Forensic logging is whatever journald keeps; retention TBD (owner: Nakul Jain).
