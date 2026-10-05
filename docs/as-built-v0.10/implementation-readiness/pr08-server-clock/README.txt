PR-08 actual local server-clock attendance acceptance

Portable test: tests/network-attendance-clock.mjs. Copy to checkout tests/ for
adoption; it imports current tests/local-qa.mjs and uses fresh synthetic accounts.
Run only after root announces a stable local Worker; local-qa rejects non-loopback
URLs. Optional ACADEMY_PR08_QA_OUT writes evidence outside the checkout.
ACADEMY_PR08_WORKER records the announced session; ACADEMY_APP_PATH selects the
checkout when running the outside candidate.

The test schedules an exact ISO session30seconds in the future, reserves both
learners before start, checks a premature refusal and unchanged revision, then
waits once for the actual clock. No SQL, stored fixture or server clock is injected.
A current host marks a fictional label after the real server start and saves a
reasoned correction. Exact server timestamps and both immutable history entries
are checked. Wrong-actor refusal, peer privacy, removed own history, current host
roster removal and the narrower current-eligibility marking policy are checked.
Attendance must never change enrollment/lesson/assessment/record state.

Export assertions verify the caller's own API projection and the exact current
preferences export field contract (sessionHistory uses team.network.history).
They are not a claim that an actual browser download was executed. No export
endpoint is invented. The generated projection-backed JSON keeps own marks and
correction reasons and excludes joining instructions, peer roster and platform IDs.

A passed run verifies the local start boundary only. It does not observe a human,
prove attendance/competence, wait seven real days for expiry, exercise hosted
identity, establish institutional policy or demonstrate production throughput.
If the future time is rejected/unclear, any response is unreadable or the bounded
wait condition is violated, the test stops and records failure rather than retrying
an uncertain POST. Ordinary current-revision API actions are deliberate test steps.

Actual executed result is in evidence/network-attendance-clock-result.json.
Read its passed status and exact timestamps/count; this README does not substitute
for completed evidence. Root build/typecheck/browser acceptance are separate.
