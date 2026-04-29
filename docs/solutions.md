# Solutions Log

## 2026-04-29

### Problem: Prisma 7 schema incompatibility
- Context: `prisma generate` failed with `P1012` because Prisma 7 changed datasource URL handling.
- Resolution: Pinned Prisma packages to v6 (`prisma@6`, `@prisma/client@6`) and kept standard `datasource db { url = env("DATABASE_URL") }` in `prisma/schema.prisma`.
- Result: `npm run prisma:generate` succeeds.

### Problem: TypeScript 6 deprecation blocker for moduleResolution
- Context: `tsc` failed with `TS5107` due deprecated `moduleResolution: "node"` alias.
- Resolution: Added `"ignoreDeprecations": "6.0"` to `tsconfig.json` to keep NestJS commonjs setup stable for bootstrap.
- Result: `npm run lint` and `npm run build` succeed.

### Problem: Prisma generated types are not visible via `@prisma/client` in TS check
- Context: after adding `Category` and `Product` models, TypeScript reported missing exports and missing delegates (`category`, `product`) while `prisma generate` succeeded.
- Resolution: switched Prisma imports to direct generated client entry `.prisma/client` for both runtime client and model types.
- Result: model types and delegates resolve correctly; `npm run lint` and `npm run build` pass.

### Problem: local DB validation blocked by disabled Docker daemon
- Context: `docker compose up -d` failed because Docker API socket is unavailable in current environment, and app startup fails with Prisma `P1001` (cannot reach `localhost:5432`).
- Resolution: generated SQL migration offline via `prisma migrate diff --from-empty --to-schema-datamodel ... --script` and validated compile/build steps.
- Result: code and migration are ready; runtime endpoint verification requires starting PostgreSQL (Docker daemon or external Postgres).

### Problem: production compose config requires `.env.production` at validation time
- Context: `docker compose ... config` failed because `docker-compose.prod.yml` includes `env_file: .env.production`.
- Resolution: added `.env.production.example` and created `.env.production` from template before validation.
- Result: `docker compose -f docker-compose.prod.yml --env-file .env.production config` renders successfully.

### Problem: deploy flow needed DB migrations to run automatically on VM startup
- Context: without explicit startup orchestration, schema deployment can be skipped and API may start against outdated DB schema.
- Resolution: added `scripts/start-prod.sh` to run `./node_modules/.bin/prisma migrate deploy` with retry before `node dist/main.js`; wired it in Docker `CMD`.
- Result: production container startup now enforces migration application before API process launch.

### Problem: VM bootstrap still required manual package installation before deployment
- Context: existing deployment flow expected Docker and other system dependencies to be preinstalled on target server.
- Resolution: added `scripts/bootstrap-server.sh` entrypoint to detect/install missing `docker`, `node`, `postgresql`, `git`, and `curl`, then clone/pull repo and run production deploy.
- Result: server provisioning + deployment is available through one `curl | bash` command.

### Problem: unsafe placeholders in `.env.production` could accidentally reach deployment
- Context: auto-generated env file from template may keep placeholder values (`replace_me`, `change_me_strong_password`), leading to unsafe startup.
- Resolution: bootstrap script validates env file and stops by default if placeholders are present; explicit override requires `ALLOW_PLACEHOLDER_ENV=1`.
- Result: safer default deployment behavior with explicit opt-in for test-only placeholder runs.
