# Postmortem template (blameless)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when the incident process changes. Copy this file to `docs/governance/postmortems/YYYY-MM-DD-<slug>.md`. No postmortem has been written yet.

Rules: describe systems and decisions, not people's faults. No secrets, no real personal data.

- **Title / ID**:
- **Severity** (incident-process.md) and **status**:
- **Author and reviewers** (owner: Nakul Jain):
- **Date, duration, who was affected** (counts, not names):

## Summary
Two or three sentences: what happened and the impact.

## Timeline (UTC)
| Time | Event | Source (log, status file, message) |
|---|---|---|

## Impact
Learners, workspaces, data integrity, security exposure. State what is unknown.

## Root cause and contributing factors
Use "why" five times. Include process and tooling factors (no CI gate, auto-deploy, no alerts).

## What went well / what was lucky / what went badly

## Detection and response
How was it noticed, how long to contain, how long to restore.

## Action items
| Action | Type (prevent / detect / mitigate) | Owner | Due | Tracked in |
|---|---|---|---|---|

## Evidence kept
Paths to preserved logs and database copies (not pasted here).

## Data and notification check
Was personal data involved? Decision on notification by the owner: TBD (owner: Nakul Jain).
