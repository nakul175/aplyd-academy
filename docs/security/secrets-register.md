# Secrets register (ACA-US-12.2, ACA-US-12.4)

Names and handling only. **No values are ever written to the repository, Linear or these documents.**

| Secret | Used for | Where it lives | Who can read | Rotation | Owner |
| --- | --- | --- | --- | --- | --- |
| `ACADEMY_AUTH_SECRET` | HMAC of sign-in codes and email hashes | `/etc/academy/academy.env` (root, 600) | root, service user via systemd | On suspicion of leak; rotating invalidates pending codes and changes email hashes (users must sign in again, accounts keyed by hash need a migration first) | Nakul Jain |
| `RESEND_API_KEY` | Sending email | same file | root | Yearly or on leak, from the Resend dashboard | Nakul Jain |
| `ANTHROPIC_API_KEY` / `ACADEMY_AI_API_KEY` | AI provider | same file | root | On leak or provider change | Nakul Jain |
| `ACADEMY_JOBS_SECRET` | Timer → jobs endpoint | same file | root | Yearly | Nakul Jain |
| `ACADEMY_INBOUND_SECRET` | Provider → STOP webhook | same file and the provider console | root | When the provider is chosen, then yearly | Nakul Jain |
| `ACADEMY_PAYMENTS_SECRET` | Payment provider → payment confirmation (R4) | `/etc/academy/academy.env` | root | When the provider is chosen, then yearly | Nakul Jain |
| `ACADEMY_SPEECH_API_KEY` | Speech-to-text provider (R4) | same file | root | On leak or provider change | Nakul Jain |
| `LITESTREAM_ACCESS_KEY_ID` / `LITESTREAM_SECRET_ACCESS_KEY` | Backups to Spaces (bucket-scoped key) | `/etc/academy/litestream.env` (root, 600) | root | Yearly | Nakul Jain |
| `ACADEMY_DEPLOY_SSH_KEY`, `ACADEMY_DEPLOY_KNOWN_HOSTS` | CI deploy | GitHub environment `production` secrets | GitHub, required reviewer | On staff change | Nakul Jain |

Status on 13 October 2026: none of these exist yet; they are created during the one-time setup in `deploy/node/README.md`.
