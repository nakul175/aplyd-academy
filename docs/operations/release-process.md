# Release process

1. Work on a branch per story (`aca/...`). Every change that alters behaviour, data or configuration updates the affected documents in the same change (`tests/loop/docs.test.mjs` fails if the generated data dictionary or API contract are stale).
2. Open a pull request to `main`. CI (`.github/workflows/academy-ci-deploy.yml`) runs the tests and the build.
3. Nakul Jain reviews and merges.
4. The `production` job waits for his approval, then copies the release to the droplet and runs `deploy/release.sh`: database snapshot, migrations, switch, health check, automatic rollback (details in `deploy/README.md`).
5. Record the release in `CHANGELOG.md` and the Linear story evidence.

Migrations are additive and never edited after they are applied (`scripts/migrate.mjs` refuses a changed applied file).
