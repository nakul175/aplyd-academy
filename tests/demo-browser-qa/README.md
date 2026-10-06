# Demo browser acceptance

Drives the LOCAL demo proxy as different synthetic identities with Playwright/Chromium. Loopback only; mutating flows run against a throw-away D1.

    bash tests/demo-browser-qa/start-stack.sh          # ports 8801 worker, 8802 proxy, state .wrangler/accept-state (reseeds)
    PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
    AXE_PATH=/path/to/axe-core/axe.min.js node tests/demo-browser-qa/acceptance.mjs

- `AXE_PATH` is optional (install axe-core in a scratch dir, not the repo). `SKIP_PARTNER=1` skips the dummy-partner round trip, which restarts the acceptance worker with `ACADEMY_DUMMY_PARTNER_URL` (it only ever kills the PID in `.wrangler/accept-state.worker.pid`).
- Screenshots go to `screens/`, structured results to `results.json`. Downloads go to `.wrangler/accept-scratch` (not committed).
- Re-run `start-stack.sh` before each run: flows mutate state (the recovery flow moves a seeded learner's record).
- `audit-types.test.mjs` is the pure regression test for the acceptance fixes: `node --experimental-transform-types --test tests/demo-browser-qa/audit-types.test.mjs`.
- `scripts/demo/demo-identities.json` and `seed-summary.json` are rewritten by seeding; do not commit those changes.
