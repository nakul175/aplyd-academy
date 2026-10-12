# API contract (item 10)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when a route file under `app/api/` changes, or when the reference OpenAPI is replaced.

## Two different things are called "the API"

1. **Reference contract (target, not implemented):** [`docs/product-specifications/openapi.json`](../product-specifications/openapi.json), "Aplyd Academy R1 reference API" 0.1.0, dated 2026-10-05: 87 paths, 100 operations, all under `/api/v1/...`. Its own description says "Not a deployed service." [IMPLEMENTATION-STATUS.md](../product-specifications/IMPLEMENTATION-STATUS.md) says the pilot does not claim this API.
2. **Implemented routes (the pilot):** 13 route files under `app/api/`, documented from source in [`docs/implementation-review-v0.13/api-contracts.json`](../implementation-review-v0.13/api-contracts.json) (route behaviour, errors, command families) and [`permission-matrix.tsv`](../implementation-review-v0.13/permission-matrix.tsv). Later deltas: [as-built-v0.15.1](../as-built-v0.15.1/architecture-and-contract.md) states no route changed since.

**Canonical for the running system: item 2. Canonical for the target design: item 1.**

## Does openapi.json match the routes? No.

Checked 2026-10-08 by listing every `route.ts` export against the OpenAPI paths:

| Implemented route (methods) | Nearest OpenAPI path | Match |
|---|---|---|
| `/api/academy` (GET, POST) | none (`/api/v1/me`, `/api/v1/me/*` are the closest concepts) | no |
| `/api/academy/export` (GET) | `/api/v1/me/exports` (POST) | different shape |
| `/api/academy/audit` (GET), `/api/academy/records/check` (POST) | none | no |
| `/api/teams` (GET, POST), `/teams/history`, `/teams/org`, `/teams/audit` (GET) | `/api/v1/tenants/{tenant_id}/...` family | different model |
| `/api/partner/enrol` (POST), `/deliver` (POST), `/links` (GET, POST), `/verify/[token]` (GET) | `/api/v1/partner/*` | different paths and shapes |
| `/api/verify/[token]` (GET) | `/api/v1/public/credentials/{verification_token}` (GET) | same intent, different path |

Result: **zero identical paths.** The pilot is two JSON-aggregate endpoints (`/api/academy` personal, `/api/teams` shared) that accept `{revision, actionId, command}` bodies, not a resource-per-operation REST API. The pilot's mismatch is documented in README.md ("does not claim the full reference PostgreSQL schema or API contract"). Per task rules the history was not rewritten and openapi.json was not edited.

## Implemented conventions (from source and the contract JSON)

- Identity: trusted host headers only; no token API. 401 without them.
- Writes: JSON body, same-origin check, content type `application/json`, size caps (personal route refuses over 100,000 characters with 413), `actionId` idempotency keyed with a SHA-256 of the command, `revision` fence (409 on stale).
- Error shape `{ "error": "<safe string>" }`; typical statuses 400, 401, 403, 404, 409, 413, 415, 422, 503. Responses are `no-store`.

## Gaps

- No generated or machine-checked contract for the implemented routes; `api-contracts.json` is hand-read from v0.13 source (observed 2026-10-05) and routes added since (partner dummy, verify) are described in the handoff and as-built notes, not in it. TBD (owner: Nakul Jain): decide whether to generate an OpenAPI for the real routes.
