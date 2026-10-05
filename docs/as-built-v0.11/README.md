# Aplyd Academy 0.11 release specification

This release adds personal offline practice, private learning-help preferences, declared human read-back, fresh personal exports and stricter response acceptance. It preserves existing course editions and learner history.

The implemented design is described in [FSD](fsd-delta.md), [HLD](hld-delta.md), [LLD](lld-delta.md), [API contracts](api-and-commands.json) and the [data dictionary](data-dictionary.tsv). Earlier architecture plans remain reference designs; they do not override these actual contracts.

## Verified local behavior

The combined source passed 427 rule tests and the Worker build. Integrated fixtures passed 628 API assertions over 544 loopback calls, 16 local directory/audit checks and 43 response/recovery browser scenarios. Mobile and offline suites passed 156 assertions. The fresh personal snapshot endpoint passed four API checks and six browser checks. These counts describe separate suites and should not be added into a single test total.

[evidence](evidence/) preserves transcripts, source hashes and execution limits. [Release evidence](release-evidence.json) records the final build and publication boundary. The additive directory migration was applied locally; deployment and live schema verification are separate release steps.

## User journeys

- Download exact global draft lesson reading as static HTML or JSON. The downloaded HTML opens without a connection and contains no personal evidence or answer keys.
- Prepare fictional personal drafts, optionally seal them on the device with a passphrase, refresh current saved progress, compare conflicting text and explicitly save a draft. This never completes a lesson, submits evidence or issues a record. Authenticated Academy screens still require an online session.
- Request language or reading/capture help privately. Existing editions remain English. A local browser voice can read exact lesson text after an explicit action. An assisted practical submission records the learner's read-back declaration.
- Export the freshest own saved personal snapshot and inspect a local file's format/checksum without uploading or importing it. A checksum establishes byte consistency, not identity or certification.
- Reject a successful response that cannot establish the current account, requested workspace or advancing save. A failed acknowledgement retains unsent inputs for deliberate review and sends no automatic retry.

## Remaining product dependencies

Live AI needs the pending credential choice; partner delivery needs a real partner contract and receiving account. Recognized certification, reviewed translations, field-user acceptance and production recovery/load evidence are not established. Practice-record status, partner readiness and content attention remain separate candidates until adopted and tested in a subsequent release.

Main merge and the successful native publication are recorded outside the source archive in the current development-status artifact. This checkpoint does not conclude the eight-hour sprint.
