Root adoption destination: tests/job-template-qa/{qa-paths.mjs,build-actual-model.mjs,actual-model.test.mjs}.
No candidate application source or overlay is imported. Defaults infer the checkout from import.meta.url and write generated bundles and evidence only under .sites-runtime/job-template-qa. ACADEMY_APP_PATH and ACADEMY_TEMPLATE_QA_OUTPUT are optional explicit overrides.
From checkout:
node tests/job-template-qa/build-actual-model.mjs
node --test tests/job-template-qa/actual-model.test.mjs
The compiler records actual-root source hashes; the test records33 groups with exact assertions. No Worker or provider is needed for pure tests. Future local API/browser scripts require ACADEMY_TEMPLATE_WORKER_READY=1 after explicit root stable-build confirmation.
