PR-05 supplemental actual local cancellation-versus-reservation race

Executed on parent-confirmed stable Worker65210 at127.0.0.1:8787.41 assertions pass.
Fresh synthetic workspace/accounts use the existing tests/local-qa.mjs API schema.
Existing fixtures are not altered; no SQL or clock injection is used.

The host cancellation and learner reservation are sent concurrently at exactly the
same observed revision. One actual RSVP succeeds200; cancellation loses409.
The observed fresh revision is then read and the host deliberately retries with
that revision and a fresh action reference. Cancellation succeeds200.
All current views show cancelled status/reason and hide joining instructions.
Both later RSVP requests reject409 without changing revision. Earlier confirmed
reservations remain own history with cancelled session status and no attendance.
Enrollment/lesson/record state is unchanged. The test does not infer attendance
from a retained historical going choice.

No automatic retry follows an unreadable/uncertain response; the script fails and
records evidence instead. The one observed nondeterministic race is not a proof
of both scheduling orders, production throughput or a forced internal barrier.

Evidence: evidence/network-cancel-race-result.json (timestamps, revision/status
observations,41 assertion count and source hashes). All API activity has stopped.

Portable adoption: copy tests/network-cancel-race.mjs to checkout tests/.
Default application root then follows the script's parent directory and output
is .sites-runtime/pr05-cancel-race. For the outside candidate set ACADEMY_APP_PATH
explicitly and ACADEMY_PR05_QA_OUT to an outside evidence folder. Set
ACADEMY_LOCAL_URL only to the parent-confirmed stable local Worker; local-qa rejects
non-loopback addresses. ACADEMY_PR05_WORKER can record the announced session.
Run only after a new stable-build signal, never during root rebuild.
No further API/browser test is planned by this completed workstream.
