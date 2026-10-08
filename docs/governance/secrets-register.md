# Secrets and key register (item 22)

Owner: Nakul Jain · Last reviewed: 2026-10-08 · Update when any secret, key or credential is added, moved or rotated. **Names, owners, locations and rotation only. Values never appear here or in Git.**

| Name | Purpose | Location | Owner | Rotation | Last rotated | Revocation |
|---|---|---|---|---|---|---|
| `SAHA_GIT_TOKEN` / `/etc/saha/aplyd-academy.git-token` | Read-only GitHub access for the 3-minute pull | Droplet, root-only file (0600) | Nakul Jain | Fine-grained tokens expire (30 days default per deploy/README.md); replace on expiry or suspicion (runbooks.md 4) | TBD | Revoke token in GitHub settings |
| `/etc/saha/aplyd-academy.deploy-key` (alternative) | SSH deploy key, read-only | Droplet | Nakul Jain | No expiry; rotate yearly (proposed) | TBD | Delete key in repo Settings > Deploy keys |
| `/etc/saha/aplyd-academy.users` | bcrypt hashes of per-person sign-in passwords | Droplet, root:caddy 0640 | Nakul Jain | On request via `aplyd-academy-add-user`; on role change | TBD | Remove line, reload Caddy |
| Per-person passwords | Sign-in | Shown once at creation; not stored | Each person | Reset on suspicion | n/a | as above |
| TLS certificate keys | HTTPS | Caddy automatic storage | Caddy / Nakul Jain | Automatic | n/a | Caddy |
| DigitalOcean account access | Droplet, backups | DigitalOcean | Nakul Jain | TBD | TBD | TBD |
| GitHub account access | Repo, tokens | GitHub | Nakul Jain | TBD | TBD | TBD |
| Sites publish credential | Owner's hosted publication | Owner only; Claude must not obtain or handle it (handoff) | Nakul Jain | Short-lived per publish | per use | n/a |
| Live AI provider key | Not chosen, not stored | none exists | Nakul Jain (decision pending) | n/a | n/a | n/a |
| SSH access to droplet (root) | Operations | Admin keys | Nakul Jain | TBD | TBD | TBD |

## Not secrets, but look like them

- `DEMO_SHARED_SECRET` in `lib/academy-partner-dummy.ts` is a labelled demo-only constant for the local dummy partner and the fixed public demo key of the DUMMY credential issuer. Do not reuse either anywhere real.
- Invitation tokens are bearer links created at runtime; only a hash is stored (README).

## Rules

- No secret in Git, commit messages, issues, PRs, logs or screenshots. If one leaks: revoke first, then record in an incident (incident-process.md).
- The application reads no secret from its environment (env-config-reference.md).
- There is no secrets manager. TBD (owner: Nakul Jain).
