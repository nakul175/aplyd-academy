# ADR-P02: Identity from trusted host headers; Caddy as gateway on the droplet

Owner: Nakul Jain · Date recorded: 2026-10-08 (retrospective) · Status: Accepted (as built), with known limits

## Context
The application authenticates nobody itself. `app/chatgpt-auth.ts` reads `oai-authenticated-user-id` and `-email` (and an optional encoded full name) that the original Sites host supplies. On the DigitalOcean droplet there is no such host (deploy/Caddyfile, deploy/README.md).

## Decision
Keep the app unchanged. On the droplet, Caddy performs basic auth against `/etc/saha/aplyd-academy.users` (bcrypt), then sets the identity headers itself (`droplet:<email>`), removing any full-name headers a browser might send; the Worker listens on 127.0.0.1 only; UFW allows 22, 80, 443.

## Consequences
No application change and no new identity code. The security of the whole app rests on Caddy and the network boundary. No MFA, lockout, sign-out or session revocation. Local tests use synthetic headers and cannot prove edge header integrity. A real identity provider remains a pending decision (handoff, design D-04).

## Alternatives considered
Embedding an OIDC library in the app (not done; pending the identity-provider decision).
