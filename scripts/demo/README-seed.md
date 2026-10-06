# Demo seed

Fills a LOCAL Aplyd Academy worker with a fictional "DEMO — synthetic" workspace through the public HTTP API only (`/api/teams`, `/api/academy`). Loopback hosts only; the script refuses anything else.

## Run

    npm run build
    # one-time per persist dir: apply migrations
    for f in drizzle/0*.sql; do node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --config dist/server/wrangler.json --local --persist-to .wrangler/demo-state --file $f; done
    node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to .wrangler/demo-state --ip 127.0.0.1 --port 8791 --inspector-port 0 &
    DEMO_BASE_URL=http://127.0.0.1:8791 node scripts/demo/seed.mjs

Takes about 60 seconds: it waits ~40 s so one session's start passes before attendance can be recorded (server rule). Re-runnable: each run uses a new nonce and creates a new workspace with new identities.

## Outputs

- `demo-identities.json`: `{baseUrl, teamId, identities:[{key,label,role,id,email,name}]}`. Send headers `oai-authenticated-user-id`, `oai-authenticated-user-email`, `oai-authenticated-user-full-name` (percent-encoded, plus `...-encoding: percent-encoded-utf-8`).
- `seed-summary.json`: cohort and session ids, learner states, verification result.

## What is seeded

3 cohorts (farm cap 5 with 4 filled, MSME cap 10, public servant cap 12); 15 learners at varied progress (new, mid-lesson with draft, lessons done, submitted awaiting review, pass, critical-gate fail, appeal open, appeal resolved by another reviewer, withdrawn); admin, 2 facilitators (different cohorts), 2 assessors, reviewer, moderator; 5 posts with a reply, one open report and one hidden post; 2 sessions (one with RSVPs and attendance, one two days out); 3 directory profiles; 1 support request; one personal-lab learner with a completed pathway and weekly plan.

## Not seeded

No partner or observer identity: the API has only the roles admin, learner, facilitator, assessor, reviewer, moderator.
