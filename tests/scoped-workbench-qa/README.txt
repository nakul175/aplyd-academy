Adoption candidate: tests/scoped-workbench-qa/

Copy this directory only after reviewing executed evidence. Root owns checkout
adoption and all app builds/server starts. The common helper import is
../local-qa.mjs. qa-paths sets the app root before that helper reads its default.
App root is detected from import.meta.url or ACADEMY_APP_PATH. Generated outputs
default to <app>/.sites-runtime/scoped-workbench-qa, never beside test source.
Optional ACADEMY_SCOPED_QA_OUT overrides the evidence directory. Strict shared
helper rejects any non-loopback ACADEMY_LOCAL_URL. All accounts are synthetic;
no test invokes a partner, email, real user data, or hosted Site.

Run from app root:
 node tests/scoped-workbench-qa/bundle-domain.mjs
 node --test tests/scoped-workbench-qa/scoped-workbench-correction.test.mjs
 node tests/scoped-workbench-qa/scoped-workbench-api.mjs
 node tests/scoped-workbench-qa/scoped-workbench-browser.mjs
 node tests/scoped-workbench-qa/scoped-workbench-storage-api.mjs

API creates small main/shared/capacity fixtures. Browser requires them and must
follow API serially on the same stable worker. It deliberately deletes only a
separate synthetic reset fixture; it does not delete main/shared QA data. Rerun
API for a fresh main fixture before repeating the full browser journey, since
browser cases replace/withdraw choices and stop its earlier boolean preference.
Storage uses its own isolated account and may run independently. It uses only
supported API writes, fills exact effective1MB, and closes its valid choice.
No SQL row injection is used. Four correction cases are pure actual-source tests
with in-memory boundary padding, no server calls. Distinguish those evidence types.

Browser runtime uses installed Playwright first or the local Codex bundled module.
ACADEMY_PLAYWRIGHT_MODULE and ACADEMY_CHROME_EXECUTABLE may select explicit local
paths. No test installs dependencies or downloads browsers. Library bundling uses
the app's existing esbuild and writes only the ignored runtime evidence directory.
This isolated pure-test bundle is not an app build or deploy.

Meaningful assertions remain unchanged in portable copies; only output/import
paths and browser configuration are adapted. API/browser actual pass is pending
the parent's stable v0.9 worker announcement. Do not confuse syntax checks with
executed product evidence. Migration of old tests is documented separately in
the parent QA candidate directory.
