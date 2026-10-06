# Aplyd Academy Partner Integration Contract

This proposed contract defines how a partner ecosystem launches learning, enrolls participants and receives authorized achievements. Partner teams should review it with the [OpenAPI draft](openapi.json), [LLD](LLD.md) and [security design](security-and-privacy.md). It does not establish a live connection or exchange real learner information.

Version 0.1 dated 5 October 2026. Initial partner, endpoints, credentials, identity provider and final exchange fields are open decisions.

## Integration journey

1. The partner displays a relevant learning opportunity.
2. The learner opens an allowlisted Academy link containing an offering or invitation reference.
3. Academy authenticates through the approved identity adapter or offers direct login.
4. Issuer and subject resolve to a linked Academy account. Linking is not inferred from email.
5. Academy checks active membership, offering access and the published enrollment policy.
6. The learner sees the pathway and the reporting or sharing arrangements before enrollment.
7. Learning, assessment and award run in the Academy.
8. An authorized event or partner API makes permitted achievement information available.
9. A return link restores the partner's permitted destination without carrying private learning evidence in the URL.

## Ownership and sources of truth

| Information | Authoritative owner | Partner handling |
|---|---|---|
| Authentication subject | Approved identity issuer | Supply stable issuer and subject |
| Academy tenant permissions | Academy membership and role policy | Request provisioning; cannot set arbitrary permissions |
| Source participant reference | Partner within agreed tenant | Treat as scoped opaque reference |
| Published pathway | Academy content and offering record | Link to a version-aware offering |
| Enrollment and progress | Academy learning module | Receive permitted status |
| Assessment result | Academy authorized assessor and policy | Receive agreed summary only |
| Credential status | Academy credential module and issuer | Verify current status; do not infer from old events |
| Sharing permission | Current Academy permission record | Honor purpose, expiry and withdrawal contract |

## Proposed service operations

| Operation | Purpose | Authorization |
|---|---|---|
| Browser learning launch | Open a specified offering | Authenticated learner plus offering access |
| POST /api/v1/partner/enrollments | Invite or enroll an eligible linked participant | Client scope and tenant; enrollment policy |
| GET /api/v1/partner/achievements | Read permitted achievement summaries | Client scope, tenant, purpose and current sharing authorization |
| POST /api/v1/partner/webhook-subscriptions | Register an approved recipient endpoint | Privileged partner client; endpoint validation |
| Signed achievement webhook | Deliver a permitted lifecycle event | Registered endpoint; send-time permission check |

The OpenAPI file defines the precise draft schemas. Endpoint authorization combines client scopes with tenant and subject permissions; possession of a valid client token alone is insufficient.

## Request and response rules

Use versioned JSON endpoints, UUID object references, UTC RFC3339 timestamps and opaque cursor pagination. Retryable state changes require Idempotency-Key. The key is scoped to actor or client, tenant and route, with the request hash recorded. Repeating an identical request returns the original result; reusing the key for a changed body returns a conflict.

Responses expose correlation_id for support. Error categories distinguish unauthenticated requests, permitted disclosure of forbidden access, absent or out-of-scope objects, conflicts, stale updates, invalid business transitions, throttling and transient unavailability. A partner must not interpret a timeout as proof that enrollment failed.

Personal information, tokens and full assessment evidence must not appear in launch links, idempotency keys, support URLs or error messages.

## Event envelope

The event envelope contains event_id, event_type, version, occurred_at, tenant_id, a scoped subject reference and minimal permitted payload. Proposed events include enrollment.created, learning.completed, assessment.decided, credential.issued, credential.suspended, credential.revoked, credential.expired and consent.changed. Each subscription must authorize its event types and fields.

An assessment.decided event does not grant access to rubric comments or a submission. Credential events carry a stable credential reference and status; public verification is a separate learner-controlled function.

## Delivery and authenticity

1. Domain state and outbox event commit in one transaction.
2. Worker resolves the current subscription, client permissions and sharing grant.
3. Worker creates a delivery record and signs timestamp plus the raw request body using a managed signing key.
4. Consumer validates signature and timestamp before processing.
5. Consumer records event_id and applies its effect idempotently.
6. An acknowledged delivery stops retries. Failures follow bounded backoff and eventually enter a dead-letter state.

Delivery is at least once. Event order cannot be assumed across separate subscriptions. Consumers should query the current permitted status or apply version-aware updates when an older event arrives later. Proposed replay window is five minutes; final clock tolerance and signature header names require contract acceptance.

Retries and manual replay recheck current sharing authorization. Withdrawal after the event was created must stop optional disclosure that has not yet occurred.

## Destination safety

Register endpoints through a controlled process. Require HTTPS, validate host and resolved address, prohibit private and internal destinations, and disallow unsafe redirects. Revalidate on delivery to account for address changes. Secrets and response bodies are redacted from operator logs.

## Partner acceptance checklist

- Identity collision, authenticated linking, logout and membership removal.
- Eligible and ineligible enrollment; duplicate request; changed-body key reuse.
- Correct return destination; rejected external redirect.
- Authorized achievement fields; rejected cross-tenant and unshared reads.
- Correct signature; changed body; stale timestamp; duplicate and out-of-order events.
- Partner outage; recovery; dead-letter handling; permission withdrawal before replay.
- Credential suspension, revocation, correction and expiry reflected correctly.
- Support correlation IDs, documented ownership and incident contacts.

These checks map to the planned integration and security cases in [test suites](test-suites.md). Production connection requires actual execution evidence and joint signoff.
