# Working pilot release

## Result

A real server-backed private Academy now runs the central learning journey. It has three draft pathways for farmers, MSME owners and public servants, nine lessons, 27 explained checks, practical evidence, criterion scoring, critical safety gates, appeals, nonaccredited practice records, moderated discussions, interests, work reflections and ecosystem return simulations.

## Product boundary

Learning records and drafts persist in D1 and survive reloads. Sign-in identifies the workspace owner. The entire review studio and community are owner-private. Sample assessor A and sample reviewer B are manually operated by that owner; their distinct actor labels test rules without representing independently verified human staff. All completion records clearly state the practice and nonaccredited nature of the outcome.

Agri Saha, MSME and public-service task mappings link into relevant pathways. Return tests require a separate grant and include only an opaque enrollment reference, pathway, completed-lesson count and record status. No partner receives the test. Health Saha remains a domain-review placeholder with no clinical pathway. No embedded AI service is called; supplied fictional AI drafts make practice usable without an account or key.

Peer-learning formats are proposed opportunities. Saving interest does not book an event or contact anyone. Forum content stays private, and publication/reply visibility is controlled by moderation. Preferences, raw workspace export, selected-record profile export, and deletion are implemented. Deletion clears learner content; minimal action audit references remain.

## Design and implementation differences

The earlier BRD/FSD/HLD/LLD pack is the target product design. This first implementation uses a small owner-scoped aggregate database and one command API, not the full PostgreSQL reference schema or the 100-operation contract. A database revision provides atomic conflict detection. The state update and audit insert use one transaction batch. Unique action references plus request hashes make replay durable and reject changed-body reuse.

A stored content version prevents silently changing the standard attached to an enrollment. Only version 0.1-review-draft is currently supported; unavailable versions block actions. Versioned authoring, archive resolution and migration tooling must be added before publishing changed curricula. A one-megabyte aggregate limit bounds each private pilot workspace.

## Verification

Fifteen pure-rule tests passed. They cover exact score boundaries, critical-gate failure at maximum score, invalid scoring vectors, prerequisites, premature award prevention, immutable evidence/decisions, independent sample-review rules, adverse-appeal suspension, grant withdrawal, inherited-property rejection, draft preservation, content pause, unsupported versions, moderation report handling and reset.

Thirty-six database-backed assertions passed against the built local Worker and local D1. They include identity-required API access, two synthetic owners, denied foreign-enrollment mutation, an actual concurrent same-revision race with one successful write, idempotency mismatch and replay after reset, lesson progression, appeal decisions, durable reload and sharing/grant independence.

Browser smoke passed across seven secondary views and learner enrollment/reload. The complete MSME browser journey passed: three lessons, nine explained quiz checks, saved practical draft after reload, evidence submission, four-criterion manual sample review, practice record and moderated discussion. No page errors were recorded. Desktop and phone screenshots were visually inspected. All 54 screen/viewport checks passed across desktop, tablet, phone, and 200% text enlargement without document overflow.

TypeScript checking and the Worker build passed. Optional WebMCP exposes read-progress and navigate-to-pathway tools only in browsers supporting the proposed document API; real supported-browser tool execution remains unverified. No claim of WCAG conformance, load capacity, security certification, real learner success, production recovery, partner compatibility, accredited issuance or independent staff authorization is made by these local tests.

## Required next release work

Before a real multi-person field pilot: select and recruit the audience; approve sector content with qualified reviewers; validate assisted/low-literacy journeys and reviewed languages; establish actual organization memberships and separately authorized staff; calibrate assessors and define staffing/turnaround; connect and test one real partner; arrange issuer authority and a correct public verification/revocation projection if recognized credentials are intended; validate privacy retention/deletion, accessibility, recovery and operational capacity. Real networking and community participation require consented invite and visibility rules.
