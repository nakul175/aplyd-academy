Portable actual-root sanitized route errors proof

Adopt repository-tests/* under tests/route-errors/ (root sole checkout writer).
Run from checkout:
node tests/route-errors/build-route-model.mjs
node tests/route-errors/route-errors.test.mjs
Generated model/evidence goes only to .sites-runtime/route-errors.
ACADEMY_APP_PATH and ACADEMY_ROUTE_ERROR_QA_OUTPUT optional overrides.

Strict read-only native acceptance (wait for root explicit final stable Worker):
ACADEMY_BODY_M3_WORKER_READY=1 node tests/route-errors/native-readonly.mjs
Optional ACADEMY_BODY_RUNTIME_DIST=/absolute/frozen/dist identifies entry/config.
32 unchanged cases verify media/JSON/Unicode/BOM/code-unit/decoded-byte boundaries
and recovery. There are no auth headers, actionId or command on mutating paths;
hard preflight rejects any such pair. Record-check POST is read-only. This test
requires source-evidence.json from compiler and hashes its actual20 baseline
imports before/after, never unused deferredhelper. Optional readonly SQLite
snapshot helper supplied but default disabled; do not claim rowhashunchanged
without successful before/after mode=ro inspection. Evidence outside tests folder.

Compiler imports actual current personal/shared/record-check route handlers and
their real domain modules. Only cloudflare:workers env and chatgpt-auth are
explicit in-memory test host stubs. No next-header runtime, real network or SQL.
Metafile captures actual used source imports/hashes, excluding deferred helper.
Test fetch is disabled and fake DB batches/run always throw; no valid write used.

Proof covers DB/corrupt stored JSON/Request.text exceptions hiding private
message/cause/canaries; personal/shared fixed category logs and record no logs;
known auth/DB/media/JSON/schema statuses stay unchanged and quiet. Personal
incomplete schema stays422, shared/record400. Textfault baseline503 is preserved.

This kit is accepted baseline native Request.text provenance. It is distinct
from deferred streaming helper diagnosis under sibling body-stream-qa, where
frozen original/bounded/release variants all failed recovery but restored main
Request.text passed strict32 native cases/193 assertions. No streaming adoption
or memory/preallocation fix claim. Main mutating template QA still needs approval.
