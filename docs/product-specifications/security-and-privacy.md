# Aplyd Academy Security and Privacy Design

This document defines proposed information boundaries, threats, security requirements and privacy workflows for engineering and operational review. It is a product control specification, not a statement of legal compliance. Applicable jurisdiction, retention, residency and contractual requirements remain decisions for the relevant owners.

Version 0.1 dated 5 October 2026. Related documents: [HLD](HLD.md), [LLD](LLD.md), [data dictionary](data-dictionary.md), [tests](test-strategy.md).

## Protected information

| Category | Examples | Authorized use | Default exposure |
|---|---|---|---|
| Public approved | Published catalog descriptions and approved issuer details | Discovery | Public only after approval |
| Learner private | Contact information, preferences, identity links | Account and learner services | Learner and specifically authorized support |
| Tenant confidential | Enrollment, cohort membership, progress | Program delivery | Scoped learner, trainers and administrators |
| Restricted evidence | Submissions, criterion scores, appeals | Assessment and review | Learner and assigned authorized reviewers |
| Security sensitive | API credentials, signing secrets, session material | Authentication and integration | Dedicated secret store and service identities |
| Public by learner choice | Minimal achievement verification | Credential sharing | Disabled until enabled by learner |
| Restricted audit | Permission and administrative change history | Accountability and investigation | Named operational roles |

Field classifications in the dictionary should refine these categories. Avoid collecting occupation, location or identity evidence unless the relevant workflow needs it. The pilot uses synthetic AI exercises and synthetic test records.

## Authorization requirements

1. Authentication verifies identity; membership and policy verify access.
2. Role tags in learner profiles never grant administrator, assessor or mentor privileges.
3. Every tenant-scoped lookup verifies scope before exposing existence or details.
4. Object storage retrieval checks current access before issuing a short-lived download URL.
5. Exports, search results, aggregate reports and worker tasks follow the same boundaries as interactive reads.
6. Assignment-scoped assessors cannot browse other submissions by changing an ID.
7. Global personal history is available only to the learner or an explicitly authorized purpose; partner admins cannot query it.
8. Privileged support actions require a documented reason and an audit record. Routine support cannot edit assessment decisions.

## Threat register

| ID | Threat and trigger | Required mitigation | Verification evidence |
|---|---|---|---|
| TH-01 | Tenant ID or object ID changed in a request | Trusted membership resolution and object-level authorization | Cross-tenant read, write, list, export and asset cases |
| TH-02 | Role switch or forged token claims gain permissions | Server-controlled role assignments and token validation | Tampered claims, revoked membership and stale-session tests |
| TH-03 | Email match links the wrong partner identity | Issuer and subject uniqueness; explicit authenticated account linking | Same email across issuers and subject collision cases |
| TH-04 | Duplicate or racing requests create multiple awards | Transaction, uniqueness and scoped idempotency | Lost-response and concurrent issuance cases |
| TH-05 | Direct storage URL bypasses evidence access | Private objects, current policy check and short-lived signed URLs | Unauthorized asset and expired URL cases |
| TH-06 | Malicious upload reaches assessors | Size/type rules, quarantine, scan and safe serving | Spoofed extension, active content and scan-failure cases |
| TH-07 | Forum or content input executes scripts | Validated structured content, safe rendering and sanitization | Stored and reflected script-input cases |
| TH-08 | Credential verification reveals private records | Opaque token, learner-enabled publication and minimal fields | Enumeration, disabled share and field-disclosure cases |
| TH-09 | Outgoing webhook accesses internal services | Destination allowlist, public network resolution, redirect restrictions | Private IP, DNS change and redirect cases |
| TH-10 | Replayed webhook causes an unauthorized change | Signature, timestamp, event deduplication and scope | Altered body, replay window and duplicate delivery cases |
| TH-11 | Queued event sends information after sharing withdrawal | Recheck current permission at send and replay | Withdrawal between commit and delivery cases |
| TH-12 | Logs, exports or analytics leak submissions or secrets | Payload allowlists, redaction and restricted export | Log capture and export-permission checks |
| TH-13 | Assessor edits erase decision history | Immutable decisions and superseding records | Concurrent review and appeal reversal cases |
| TH-14 | Availability abuse blocks learning or verification | Endpoint quotas, upload limits and load shedding | Rate-limit behavior and recovery tests |
| TH-15 | AI tools receive confidential work content | Synthetic exercises, approved-tool rules and explicit learner instruction | Content review and responsible-AI assessment |
| TH-16 | Deleted information reappears after restore | Deletion manifest and restore reconciliation | Restore with a completed deletion request |

## Identity and session controls

Use approved identity adapters with strict issuer, audience, expiry, nonce/state and callback validation. Exact token and session durations are open configuration decisions. Do not let role removal depend solely on long-lived token expiry; check current membership for protected actions. Privileged operator authentication must meet the selected stronger authentication policy.

Account recovery must avoid revealing whether an address exists. Account linking requires authenticated proof of both identities or a reviewed recovery process. Sessions, tokens and signing keys must be rotated and revoked through documented operations.

## Sharing and reporting model

Distinguish operational reporting necessary for a disclosed sponsored program from optional sharing of achievements or profile details. The business owner must document the approved authorization basis for each; a generic consent checkbox is insufficient.

Optional grants specify recipient, tenant, purpose, data categories, effective time, expiry when used, and withdrawal. The learner can review active grants. Withdrawal stops future optional delivery, including retries and replays, but cannot erase copies already lawfully delivered to a partner. The partner contract must define its downstream handling.

Public credential sharing can be enabled and disabled independently of partner sharing. Neither setting publishes assessment evidence. Verification status can change on suspension, revocation, correction or expiry; caches must observe the current authoritative status.

## Data rights and record lifecycle

The support workflow verifies the requester, identifies scope, records the request, assigns an owner and follows the approved retention policy. Export should be understandable and include permitted personal records without other learners' information. Corrections to contact information differ from immutable assessment history; assessment correction uses a new linked record.

Deletion identifies all databases, objects, projections, analytics datasets, queued deliveries and backup categories. Where a retention exception applies, minimize and restrict retained information and communicate the outcome. Backups require a time-bounded expiry and deletion reconciliation after restore. Exact deadlines and durations are open decisions and must not be represented as agreed commitments.

## Audit and secrets

Record actor or service identity, tenant, action, object reference, outcome, reason where needed, timestamp and correlation ID. Do not store raw credentials, full submissions or unrestricted before-and-after personal values in audit events. Integrity protection and retention of the audit store must be decided separately from ordinary application logging.

Store integration and signing secrets outside source code and documentation. Support key rotation with overlapping verification keys where necessary; never expose secret material in export or administrative screens. Partner test credentials are isolated from production.

## Required release evidence

- Object and tenant authorization checks across API, UI, assets and exports.
- Upload quarantine and safe delivery verification.
- Current-permission checks on external delivery and replay.
- Credential disclosure and lifecycle verification.
- Recovery and restore tests including deletion reconciliation.
- Documented open risks and owner-approved disposition of material findings.
- Tested incident escalation and learner-support ownership.

The evidence must come from the implemented system. This specification and the threat register identify planned controls; they do not prove those controls are working.
