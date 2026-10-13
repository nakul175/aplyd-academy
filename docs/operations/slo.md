# Service level objectives: proposal (not decided)

**Status: proposed by Claude for Nakul Jain; no SLO is in force until he records it.** Measured by the DigitalOcean uptime check on `/api/health` and the server logs.

| Objective | Proposed target | Measured how |
| --- | --- | --- |
| Availability of `/loop` during IST daytime (07:00–23:00) | 99.5% per month | Uptime check, 1-minute interval |
| Weekly reminders sent on the learner's day | 99% of due reminders by 10:00 IST | `loop_reminders` status `sent` vs due |
| Upload completes on a slow connection (resume) | No lost upload in the monthly sample | Upload status rows still `uploading` after 24 h |
| Restore drill | Monthly, succeeds | `restore-drill.sh` record in Linear |
| Data loss on server failure | at most about 10 seconds of database writes | Litestream replication interval |

Error budget, alert routing and on-call: to be decided with the SLOs.
