# Workspace help requests · v0.5

## Implemented journey

An active shared member can create a learning, content, access, technical, accessibility or privacy request after acknowledging its audience. Learners can ask about a visible offering before enrollment or while its cohort is paused. Staff intake respects current scope. Personal labs explain that no staffed desk is connected.

Request bodies and replies are visible only to the requester and current assigned eligible handler. Owners see queue metadata; facilitators see only learning/content metadata in their current cohort scopes. Metadata includes the user-chosen title, category, cohort, requester display name, dates, status and handler display name. General titles and fictional information are required in product guidance. Sensitive categories and requests without a cohort need an owner handler. Queue authority does not grant body access.

An eligible handler must claim a request. Requester and handler must be different accounts. A single-owner's own request remains unhandled until another eligible account is available. Concurrent claims share the workspace revision: one succeeds; the other conflicts. A handler can reply and resolve with an explanation. Requesters can reply, reopen a resolved request with a reason or withdraw it. Messages, resolution history and lifecycle events remain retained. Withdrawal is read-only closure, not deletion.

Current role/scope loss clears the assignment durably. Restoring a role requires a fresh claim; it does not restore private access. Removed members retain only their own readable/exportable requests and cannot write or replay actions. Learner exports contain only requests they opened, even if they also handle somebody else's request. Support does not expose learner drafts, change assessments or award accommodations. Assessment appeals retain their existing workflow.

## Commands and persistence

Exact allowlisted commands: support-open, support-claim, support-reply, support-resolve, support-reopen and support-withdraw. Caller-supplied actor, assignment, timestamps, status and scope are rejected. Authentication, current membership, expected revision, stable action reference and request hash remain enforced by the shared API. The support module translates domain errors through the existing RuleError response contract.

Support remains bounded inside the existing workspace aggregate: 100 total requests, five open per requester, 20 messages and 20 resolutions per request, and 100 ordinary lifecycle events. A final withdrawal can append the closure event. Support storage is limited to 250,000 serialized UTF-8 bytes. Every growing write reserves the exact worst-case closure capacity for every open request, including bounded display names and canonical four-digit-year timestamps. Other shared mutations cannot consume that reserve. Withdrawals retain history and consume their existing closure reservation.

## Client freshness

Visible support screens refresh in-app every 30 seconds and on visibility change; manual refresh is available. Writes are serialized immediately in the client. A write invalidates older reads before it begins and after it is acknowledged, so a delayed GET cannot overwrite saved data. Conflicting or revoked writes refresh current authority without automatically resubmitting.

If support handler authority changes, the former private thread is removed from the displayed state. The handler's own unsent reply/resolution remains separate from that thread, clearly labelled as unsent. Server authorization is always authoritative; browser controls confer no permission.

## Operational boundary

No email, push message or external notification is sent. No response time, staffing availability, emergency service, approved accommodation or erasure is promised. Hosting stays owner-private; Academy memberships do not grant Site access. Local tests use synthetic identity headers only and do not prove hosted dispatcher authentication, real participant access, staffing, formal retention/erasure, recovery capacity or field usability.
