Root adoption candidate:tests/operations-qa/

Copy this directory after reviewing the final executed evidence. No app source,
existing tests or generated result fixtures are changed by this preparation.
The parent helper import is ../local-qa.mjs, matching existing tests/local-qa.mjs.
qa-paths.mjs detects app root from import.meta.url after repository adoption and
sets ACADEMY_APP_PATH for that shared helper. ACADEMY_APP_PATH may override it.

All generated fixture/evidence/screenshot/bundled model files default to
<app>/.sites-runtime/operations-qa/. No generated data sits beside test code.
Optional ACADEMY_OPERATIONS_QA_OUT changes that generated output destination.
Never use a hosted URL:shared helper enforces loopback ACADEMY_LOCAL_URL only.
Only fictional local workspace/member records are created; nothing is outbound.

Run from app root in this order:
 node tests/operations-qa/bundle-operations.mjs
 node --test tests/operations-qa/operations-truth-candidate.test.mjs
 node tests/operations-qa/operations-api-candidate.mjs
 node tests/operations-qa/operations-browser-candidate.mjs
 node tests/operations-qa/operations-read-denial-candidate.mjs
 node tests/operations-qa/operations-client-races-candidate.mjs
 node tests/operations-qa/operations-polling-candidate.mjs
 node tests/operations-qa/network-attendance-current-authority-candidate.mjs
 node tests/operations-qa/operations-focus-cancellation-candidate.mjs
 node tests/operations-qa/operations-focus-stability-candidate.mjs

Model/API are runnable with installed app esbuild and Node only. Browser tests use
an installed Playwright module or Codex bundled runtime fallback. Set
ACADEMY_PLAYWRIGHT_MODULE to an explicit module path when needed. Set
ACADEMY_CHROME_EXECUTABLE for a system Chromium/Chrome; on current macOS fallback
uses installed Google Chrome. Otherwise Playwright uses its configured browser.
This candidate does not install dependencies or download browser binaries.

One persisted synthetic operations-fixture.json connects the browser checks.
Run these fixture-mutating suites serially. API creates/restores its fixture and
each browser scope/save scenario restores its current permissions in its normal
success path; delayed-read/polling/attendance also restore in finally. Root may
run unrelated tests using separate synthetic workspaces in parallel.

Meaningful assertions are preserved. The small portability changes are path,
runtime module loading and browser configuration only. Final pass evidence lives
in the outside-checkout parent QA candidate until root runs the adopted copies.
