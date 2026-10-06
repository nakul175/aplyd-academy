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

3 cohorts (farm cap 5 with 4 filled, MSME cap 10, public servant cap 12); 15 learners (plus the wave 4 learners below) at varied progress (new, mid-lesson with draft, lessons done, submitted awaiting review, pass, critical-gate fail, appeal open, appeal resolved by another reviewer, withdrawn); admin, 2 facilitators (different cohorts), 2 assessors, reviewer, moderator; 5 posts with a reply, one open report and one hidden post; 2 sessions (one with RSVPs and attendance, one two days out); 3 directory profiles; 1 support request; one personal-lab learner with a completed pathway and weekly plan.

## Wave 4 data (added after the original 33 assertions; those still run first and unchanged)

New identity keys (only ever added): `learner-accommodation` (pending request), `learner-revoked` (observed-task pass, credential revoked by the reviewer with a reason, share on), `learner-suspended` (oral pass, then an adverse appeal suspends the credential, share off), `learner-recovery-new` (new account, pending recovery request, NOT approved so approval can be shown live), `assisted-invitee` (assisted invitation, not accepted). The partner link sits on the existing `personal-learner` (partner links live in the personal lab, and the demo proxy already keeps that identity out of the workspace).

- BR-33: one open HIGH escalation raised by the moderator; one MEDIUM escalation resolved by the owner with the post hidden and the generic reporter notice.
- BR-24/27: one pending accommodation (MSME) and two approved; one approved is shown on assessor-1's assigned review; decisions recorded as `observed` and `oral`, one stamped with the accommodation it considered.
- BR-15: learner-failed-gate (failed critical gate) carries the data the "what to do next" routes are built from.
- BR-29/30: credentials active (learner-complete, share on, public `/verify/<token>` works), active private (learner-ps-complete, off), suspended (off), revoked (on). Public tokens are in each learner's own view; the overview links the shared ones.
- BR-44: one data request each in received, verified, verification-failed, completed (export) and held (erasure).
- BR-04: one pending recovery request and one assisted invitation.
- BR-41: the owner rollup over 3 cohorts, with counts of 3 or more and several `<3` cells.
- BR-46: audit readable by the owner only.
- BR-42/43: only when `DEMO_PARTNER_URL` is set (see below).

## Partner link

    PORT=0 ACADEMY_URL=http://127.0.0.1:<worker port> node scripts/demo/dummy-partner.mjs   # prints its loopback URL
    CLOUDFLARE_INCLUDE_PROCESS_ENV=true ACADEMY_DUMMY_PARTNER_URL=<that url> DEMO_PARTNER_URL=<that url> bash scripts/demo/run-demo.sh

The worker needs `ACADEMY_DUMMY_PARTNER_URL` (wrangler picks it up from the process with `CLOUDFLARE_INCLUDE_PROCESS_ENV=true`); the seed needs `DEMO_PARTNER_URL`. Unset, the partner step prints a note and is skipped.

## Known app defects found while seeding (not fixable from scripts/demo)

1. `lib/academy-partner-dummy-service.ts` calls `fetch(..., {redirect: 'error'})` (member lookup and delivery). workerd rejects that value (`TypeError: Invalid redirect value`), so every partner call returns 503 in the real worker and the partner link cannot be created. Use `redirect: 'manual'` and check the status. The seed step was verified end to end only against a locally patched build; with the unpatched build it prints a skip note.
2. `lib/academy-partner-dummy.ts` `validatePayload`: for `completion.completed === true` the expression `canonicalTime(...)` returns a truthy string, so the check fails with "Completion is invalid". A learner who has completed can therefore never deliver with the `completion` scope granted. The seed grants `progress` and `credential-status` only.
3. `lib/academy-audit-detail.ts` `COMMAND_TYPES` lacks the newer commands, so escalations, data requests, recovery, accommodations and credential lifecycle are audited as type `other`.

## Not seeded

- Overdue data requests and overdue escalations: the server stamps the clock and no API input accepts a past time. Counts read 0; the logic is covered by unit tests.
- Edition 0.2 and the Hindi draft are not the default edition; catalogue facets, recommendations and pre-enrolment are computed in the app and need no data.
- No partner or observer identity: the API has only the roles admin, learner, facilitator, assessor, reviewer, moderator.
