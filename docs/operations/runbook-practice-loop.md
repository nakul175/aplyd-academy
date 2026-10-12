# Runbook: practice loop operations

Server setup, deploy and backups: `deploy/node/README.md`. This runbook covers the practice loop.

## First-time bootstrap (after the first release)

1. Nakul Jain signs in once at `/signin`. On the server: `sudo -u academy ACADEMY_DATABASE_PATH=/var/lib/academy/academy.sqlite node /srv/academy/current/scripts/loop-admin.mjs grant <his email> owner`. Operators the same way with `operator`.
2. Load the approved notice text: `... loop-admin.mjs notice <version> <file.md>`, then in Operations record `notice.approved` = `{"version":"<version>"}`.
3. In Operations, record the other owner decisions the cohort needs (the table there shows what is waiting): placement instrument, minimum group size, inactivity weeks, access notice days, retention periods, security contact, sessions format.
4. Create the pack, name the expert, import the draft, let the expert approve and publish, attach the pack to the cohort.
5. AI stays `off` until AIA-ACADEMY-01 is approved and the evaluation passes: import `docs/ai/evaluation-set-draft.json` (after review), record `ai.thresholds`, set `ACADEMY_AI_PROVIDER` and `ACADEMY_AI_MODEL`, restart, run the evaluation in Operations.

## Daily

`academy-jobs.timer` runs `/srv/academy/bin/jobs.sh all` at 09:00 IST: weekly reminders on each learner's day and the retention job. Check: `journalctl -u academy-jobs --since today`. Manual run: `sudo /srv/academy/bin/jobs.sh reminders`.

## Switching AI off now

Operations → AI assurance → "Switch AI off now" (owner). Learners immediately see the task and checked guidance with a "paused" notice. Or set `ACADEMY_AI_PROVIDER=off` and restart. Log the incident in Operations.

## Restoring from backup

1. Follow `deploy/node/README.md` to restore the database with Litestream and start the service.
2. **Re-apply deletions:** `sudo /srv/academy/bin/jobs.sh reapply-deletions`. Records deleted after the backup was taken (erasures and retention) are deleted again. The run is logged in Operations → Retention runs.
3. Learner files are not in the database backup (finding F-05); restore them from their own backup if the owner chose one.

## A learner asks for deletion and cannot use the app

The owner signs in as operator, confirms the person's identity outside the app, and deletes on their behalf only through the account erasure function (no manual SQL); record the request and the date in the owner's DPDP request log.

## Demonstrations

Never demonstrate with real learners. Build a fictional database with `node scripts/demo-synthetic.mjs /tmp/academy-demo.sqlite` and run a local server against it (instructions at the top of the script).

## Later releases

R3 and R4 features stay closed until the owner records `scope.release` with the epic (Operations → Owner decisions). The student pilot additionally needs, per school, `student.agreement` and `student.legal_review`; harm reviews need `student.harm_baseline` per cohort; the end of the pilot needs the school's instruction as `school.end_instruction`.
