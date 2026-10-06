# Aplyd Academy Technical References

Official sources consulted on 5 October 2026 support the proposed interface and schema conventions. They do not select a vendor, certify implementation or establish regulatory compliance.

- The contract draft chooses OpenAPI 3.1.0 as its compatibility target. Its interface-description structure follows the [OpenAPI 3.1.0 specification](https://spec.openapis.org/oas/v3.1.0.html). This is a deliberate target rather than a claim about the latest release.
- Proposed identity federation uses issuer and subject linkage and an approved adapter. Token and authentication-flow requirements must be implemented against [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html).
- The reference relational schema uses primary, unique, foreign-key and check constraints. Their PostgreSQL behavior is described in the [official constraints documentation](https://www.postgresql.org/docs/current/ddl-constraints.html). The selected server version still requires migration execution testing.
- Request status, conditional update and cache semantics should follow [HTTP Semantics RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html). Application-specific idempotency, purpose authorization and webhook delivery rules are proposed Academy contracts.

These sources support technical conventions. Product purpose, audience and business requirements come from the user's direction and the BRD in this conversation.
