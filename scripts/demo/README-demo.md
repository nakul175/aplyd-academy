# Aplyd Academy local demo proxy

`demo-server.mjs` is a zero-dependency reverse proxy for a LOCAL demo. It sits in front of the local worker, picks a synthetic demo identity, injects the `oai-authenticated-user-*` headers, and overlays a demo bar.

## Run

```
# worker already running locally (default upstream http://127.0.0.1:8787)
node scripts/demo/demo-server.mjs            # listens on http://127.0.0.1:8788
```

Env: `DEMO_UPSTREAM` (default `http://127.0.0.1:8787`), `DEMO_PORT` (8788), `DEMO_HOST` (127.0.0.1), `DEMO_IDENTITIES`, `DEMO_SCRIPT`, `DEMO_OVERVIEW` (path overrides, used by tests).

Inputs (re-read on every request, so re-seeding needs no restart):

- `scripts/demo/demo-identities.json` `{baseUrl, teamId, identities:[{key,label,role,id,email,name}]}`
- `scripts/demo/demo-script.json` (optional) `{title, steps:[{id, role, title, say, do, link}]}`
- `scripts/demo/overview.mjs` (optional) exports `renderOverview({fetchAs, identities, teamId, baseUrl})`

Routes: `/demo/switch?as=<key>&next=/path`, `/demo/overview`, `/demo/health`. Everything else is proxied.

## Behaviour

- Active identity from cookie `demo_as` (default `admin`, else first). Client-supplied `oai-*` headers are dropped; the `demo_as` cookie is not forwarded.
- HTML responses are decompressed (upstream is asked for `identity`) and get a demo bar plus guide panel. The bar lives in a shadow root appended to `<html>` (outside React's `<body>` tree, so no hydration mismatch, no app CSS leakage) and is re-attached by a MutationObserver if removed. Body gets `padding-top:40px`.
- Role dropdown sets the cookie then reloads in place (hash route preserved). Guide step buttons go through `/demo/switch` with `next=<link>`.
- Non-HTML is streamed untouched. Upstream `Set-Cookie` is kept.

## Safety

- Refuses to start if the upstream or listen host is not loopback (`127.x`, `localhost`, `::1`). Never point it at the hosted URL; the identities are synthetic fixtures.
- Not part of the build. Evidence: the build entry is `build/sites-worker.ts` (vite.config.ts `main`), built via `vinext build`; nothing in `build/`, `app/`, `lib/` imports `scripts/demo`; `tsconfig.json` includes only `**/*.ts, **/*.tsx, **/*.mts` (these are `.mjs`), and `scripts/*.mjs` are only run by `npm run dev/build/start` wrappers. The file is a dev-time Node script and ships nowhere.

## Tests

`node --test scripts/demo/test-demo-server.mjs`

## Limits

- No WebSocket/upgrade proxying (not needed for `wrangler dev` start; Vite HMR not supported through the proxy).
- If the app ever sends a strict CSP, the inline bar script would be blocked.
- The demo bar is client-side overlay: a user with devtools can hide it. It only guards against the app removing it.

## Overview and guide (wave 4)

`/demo/overview` now also shows escalations, accommodations and assessment methods, credentials by status, data requests, recovery, the programme rollup (with `<3` cells), the partner link, audit counts by type, and a "dummy, partial or not built" strip. `demo-script.json` has 18 steps (8 added for the newer features). The overview reads the audit log and each role view with GET only and never prints emails.
