# ACA-US-1.4: email code sign-in (local)

Story: ACA-US-1.4 (Linear APL-2221) · Owner decisions, 12 October 2026: sign-in by email one-time code; rules "Standard".
Status: **built and tested locally; not accepted.** Email provider: Resend (owner decision, 12 October 2026). Real emails need a Resend account, a verified sending domain and the keys below.

## Rules (as decided)

| Rule | Value |
| --- | --- |
| Code | 6 digits, valid 10 minutes, single use |
| Wrong codes | 5 within 15 minutes lock the email for 15 minutes (also blocks new codes) |
| Code requests | at most 3 per email in 15 minutes |
| Session | 30 days maximum; ends after 7 days without use; sign-out ends it on the server |

## How it works

- `/signin`: enter email → code by email → enter code. Phone first, numeric keypad, one-time-code autofill, errors read out by screen readers.
- `POST /api/auth/request-code`, `POST /api/auth/verify` (sets an HttpOnly, SameSite=Lax cookie; Secure on HTTPS), `POST /signout`.
- Stored: email and code as HMAC with `ACADEMY_AUTH_SECRET`; the email address on the user row (needed to send codes); session tokens as SHA-256. Requests never reveal whether an email has an account.
- Identity headers from ChatGPT Sites stay ignored unless the local test flag is set.

## Configuration

| Variable | Meaning |
| --- | --- |
| `ACADEMY_AUTH_SECRET` | 32+ random characters; sign-in refuses to run without it |
| `ACADEMY_MAIL_TRANSPORT` | `resend` in production; `outbox` for local tests only (stores codes in plain text) |
| `RESEND_API_KEY`, `ACADEMY_MAIL_FROM` | Resend API key and sender, for example `Aplyd Academy <no-reply@aplyd.org>` on a domain verified in Resend |
| `ACADEMY_ENVIRONMENT=production` | blocks the outbox transport |

## Tests (12 October 2026, local)

- Rules: 9 of 9 (`tests/node-runtime/email-otp.test.mjs`, fake clock, real SQLite and migrations), including: a failed send does not use up the code limit.
- Resend transport: 3 of 3 against a local fake (`tests/node-runtime/resend-mail.test.mjs`); the real API has not been called.
- End to end on a 390-px phone browser: 8 checks pass (`tests/node-runtime/signin-browser.mjs`).
- Regression: 996 of 996 mocked, 80 of 80 guards, all API suites pass (with the local identity flag).

## Open

- Resend account, domain verification (DNS records on aplyd.org) and API key: owner action.
- Migrating learners from the ChatGPT Sites copy is out of scope; that copy had no real learners.
