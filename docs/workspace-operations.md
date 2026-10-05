# Workspace operations · v0.7

Current active owners and facilitators have a Workspace operations view. It derives metadata from the existing, authenticated workspace projection; it adds no endpoint, database table, privileged command or stored dashboard record. A direct operations link without current authority shows an unavailable state.

## What staff see

Owners see permitted workspace cohort counts, pending assessment/appeal assignment metadata, independently reviewed content attention, support handling metadata and eligible session observations. Facilitators see only cohorts they currently manage, their own assigned reviews, support within their current allowed category/cohort scope and their own host observations. Learner-visible cohorts outside facilitator scope are excluded from their totals.

Cohort figures count nonwithdrawn enrollment records and saved lesson completions, not unique people or verified job impact. Record status, pending assessment and open appeal are independent observations: an active practice record can coexist with an open appeal. No appeal automatically suspends a valid record. An adverse independent appeal retains the original decision history and suspends the current record through the existing command.

Queue ages are whole elapsed days from recorded creation/opening times. Unknown, invalid or future timestamps show unavailable observations. Content due dates and session windows use a visible client observation time; authoritative actions still use server validation. The interface promises no turnaround time or staffed response SLA. Lists display at most eight rows, with whole bounded totals and a remaining-row count. Oversized or malformed inputs refuse the dashboard instead of inventing partial totals.

## Boundaries

The model omits practical evidence, rubric scores, decision notes, support titles/bodies/replies/resolutions, private learning plans, content source bodies, joining instructions and participant rosters. An authorized destination may show its own permitted details after navigation. Links carry only workspace-bound item references, select against the current projection and never perform a save, claim, review, publication or attendance action.

Refreshing performs read operations only: manual refresh, a 30-second visible-page interval and refresh on returning to visibility. Refresh pauses during a write or load; only a successful current response changes the observation time. Earlier reads cannot overwrite a subsequently acknowledged save.

Current selected-workspace or directory GET 401/403/404 clears private versions, server-derived state and destination caches. Restoring confirmed access reloads canonical content. Own unsent form text remains only in memory under an unambiguous account/workspace/form tuple. A confirmed different account clears prior scratch. Account mismatch between the selected response and directory masks the projection. These local guarantees do not establish hosted sign-in behavior or detect access loss before a response arrives. Ordinary transient read failure shows an error while retaining the prior snapshot.

A successful shared POST is acknowledged even if its follow-up directory refresh fails; the app asks for access refresh and never automatically repeats the write. Current network attendance/cancellation dialogs retain item IDs only and derive participant/session details from the current permitted projection. Missing current authority closes the dialog.

## Verification and rollout

See test-evidence.json for executed synthetic local API/browser evidence, and as-built-v0.7 for the functional, low-level and dictionary deltas. The operator acceptance checklist remains NOT RUN until an operator records real evidence. The global draft curriculum archive is unchanged. No new migration is required.

Hosting remains owner-private. Academy invitations cannot grant Site access. Hosted authentication, real participant sign-in, sector content approval, workload/recovery capacity, formal accessibility, retention/erasure, recognized credential authority and partner interoperability still require evidence before broader launch. No external message, partner request or live AI call is made.
