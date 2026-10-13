# Environment reference

All settings are environment variables in `/etc/academy/academy.env` on the server (see `deploy/node/academy.env.example`). Values are never committed.

| Variable | Required | Meaning |
| --- | --- | --- |
| `ACADEMY_ENVIRONMENT` | production: `production` | Turns off local-only transports (outbox, fake AI). |
| `ACADEMY_PUBLIC_ORIGIN` | production | Origin used for links in emails and origin checks, e.g. `https://academy.aplyd.org`. |
| `ACADEMY_DATABASE_PATH` | yes | SQLite file. |
| `ACADEMY_FILES_PATH` | for uploads | Folder for learner files (mode 700, owner `academy`). |
| `ACADEMY_AUTH_SECRET` | yes | 32+ characters; HMAC key for sign-in. |
| `ACADEMY_MAIL_TRANSPORT` | yes | `resend` (production) or `outbox` (local tests only). |
| `RESEND_API_KEY`, `ACADEMY_MAIL_FROM` | with `resend` | Email provider key and sender. |
| `ACADEMY_AI_PROVIDER` | yes | `off`, `anthropic`, `openai-compatible`, `fake` (tests only). |
| `ACADEMY_AI_MODEL` | when AI is on | Provider model id; never defaulted. |
| `ANTHROPIC_API_KEY` / `ACADEMY_AI_BASE_URL`, `ACADEMY_AI_API_KEY` | per provider | AI credentials. |
| `ACADEMY_AI_TIMEOUT_MS` | no | Default 30000. |
| `ACADEMY_JOBS_SECRET` | for the daily timer | 32+ characters. |
| `ACADEMY_INBOUND_SECRET` | when a WhatsApp/SMS provider exists | 32+ characters. |
| `ACADEMY_MESSAGE_TRANSPORT` | tests only | `outbox` enables the local WhatsApp/SMS outbox outside production. |
| `ACADEMY_PAYMENTS_SECRET` | when a payment provider exists (R4) | 32+ characters; shared secret on `POST /api/loop/payments`. |
| `ACADEMY_SPEECH_PROVIDER` | R4 voice input | `off` (default), `openai-compatible`, `fake` (tests only). |
| `ACADEMY_SPEECH_BASE_URL`, `ACADEMY_SPEECH_API_KEY`, `ACADEMY_SPEECH_MODEL` | with `openai-compatible` | Speech-to-text endpoint, key and model (never defaulted). |
| `ACADEMY_RELEASE` | set by `deploy/node/run.sh` | Release id shown by `/api/health`. |
| `ACADEMY_TRUST_IDENTITY_HEADERS` | never in production | `1` only in v0.17 local tests. |
