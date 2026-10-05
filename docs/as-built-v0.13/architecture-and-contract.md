# v0.13 HLD, LLD and API contract delta

## High-level design

The React shell continues to own accepted account/workspace state, read-generation and authority masking. Three presentation modules derive minimal read-only models from that accepted projection. The support intake adds only scoped in-memory fields and an explicit append operation. All protected writes continue through existing commands and atomic state/audit batches. The seven D1 tables and all migration history remain unchanged.

Content attention replaces the existing owner content section instead of adding another queue. Partner inspection derives on each render from current personal state and the observation clock; it does not retain another private snapshot. The own-help wrapper remounts its choices when context or input changes. No new route, grant, role, shared preference projection or external message is introduced.

## Low-level boundaries

`deriveOperationsContentAttention` selects only owner content attention and exact references from `deriveContentReadiness`. It excludes support bodies and preference state. Missing/invalid dates have unknown age rather than invented urgency. `ownSelectedLearningHelpCourse` requires explicit own enrollment, current selected cohort and agreement among original, resolved and offered references. `appendOwnLearningHelpDescription` returns only the proposed description and checks the full final length before mutation. `supportIntakeConsentKey` is an in-memory equality fence; it must never be placed in storage, logs, URLs, DOM attributes or commands.

The partner inspection model never authorizes delivery, local testing or receiving-account access. Its generic discussion brief is detached from learner state. The existing receipt reader now receives the informational clock, so future-created receipts fail presentation validation; canonical history is neither rewritten nor erased.

## API and error handling

All three existing APIs retain native Request.text reading and their post-read limits: personal/shared commands allow up to100,000 decoded UTF-16 units; private record checks allow up to2,000 decoded units and4,000 decoded UTF-8 bytes. Origin/media/JSON/envelope/identity validation, CAS, idempotency, audits and response shapes are unchanged. Malformed JSON returns400, origin denial403, media denial415 and size denial413. Existing personal malformed action references retain default422; shared malformed envelopes retain400. Error JSON retains no-store and nosniff. Record checks remain read-only.

The only adopted route change removes exception-message arguments from unexpected personal/shared logs. The expected invitation-token conflict classification remains before the generic logger. Private record unexpected errors continue to produce a sanitized503 without private logs. A separate actual-handler mocked-host suite checks these boundaries without running SQL or HTTP.

Streaming body-reader prototypes were tested and deferred outside the release. Original, bounded-cancellation and size-only-release policies each failed the same immediate oversized-upload-to-next-request native sequence. Existing Request.text reading passed32native cases/193assertions, including that sequence. The Wrangler proxy's generic message cannot alone prove a worker restart; the differential actual-route test is the release decision evidence.

## Validation and scope

Pure tests bundle actual adopted modules. Mocked route tests use the real route/domain imports with explicit in-memory authentication/D1 stubs, disabled fetch and a host that refuses SQL writes. Native malformed-input tests are constrained to incapable envelopes and read-only calls. Browser tests use existing fictional loopback accounts and response-intercepted display variants; no new protected write or live partner/provider call is permitted while the explicit local fixture approval remains pending. Such tests do not establish hosted identity, field use, institutional authority, load capacity or production readiness.
