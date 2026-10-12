#!/usr/bin/env bash
# Daily practice-loop jobs (reminders, retention) on the server, called by academy-jobs.timer. Usage: jobs.sh [all|reminders|retention|reapply-deletions]
set -euo pipefail
SECRET="$(grep -E '^ACADEMY_JOBS_SECRET=' /etc/academy/academy.env | cut -d= -f2-)"
curl -fsS --max-time 600 -X POST -H "Authorization: Bearer ${SECRET}" "http://127.0.0.1:3000/api/loop/jobs?job=${1:-all}"
echo
