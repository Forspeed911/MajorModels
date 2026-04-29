# Release Notes

## v0.4.0
- Added one-command Linux server bootstrap/deploy script:
  - `scripts/bootstrap-server.sh`
- Script capabilities:
  - detects package manager (`apt`/`dnf`/`yum`)
  - installs missing components (`docker`, `docker compose`, `node`, `postgresql`, `git`, `curl`)
  - clones/updates repository from GitHub
  - prepares `.env.production` (optional download via `ENV_FILE_URL`)
  - deploys stack via `docker compose ... up -d --build`
- Added safety check for placeholder secrets in env file (override: `ALLOW_PLACEHOLDER_ENV=1`).
- Added one-command deployment docs:
  - `docs/deploy-one-command.md`
  - updated `docs/deploy-vm.md` with bootstrap shortcut

## v0.3.0
- Added VM production deployment package:
  - `Dockerfile` (multi-stage build/runtime)
  - `.dockerignore`
  - `docker-compose.prod.yml` (API + PostgreSQL, healthchecks, persistent volume)
  - `scripts/start-prod.sh` (runs `prisma migrate deploy` with retry before API start)
  - `.env.production.example`
  - `docs/deploy-vm.md` (operator runbook)
- Added production npm scripts:
  - `migrate:deploy`
  - `start:prod`

## v0.2.0
- Added catalog data model in Prisma: `Category` and `Product` with relation, uniqueness constraints, indexes, and decimal price.
- Added initial SQL migration: `prisma/migrations/20260429191200_init_catalog/migration.sql`.
- Added global Prisma infrastructure module (`PrismaModule`/`PrismaService`) for NestJS DI lifecycle.
- Implemented layered catalog API modules (`Controller -> Service -> Repository`) with DTO validation:
  - `GET /api/v1/categories`
  - `GET /api/v1/products` (`categoryId`, `search`, `limit`, `offset`)
  - `GET /api/v1/products/:id`
- Connected `CatalogModule` and `PrismaModule` in root app module.

## v0.1.0
- Initialized backend scaffold on NestJS + TypeScript (strict) with layered module structure.
- Added API versioning prefix `/api/v1` and global DTO validation via `ValidationPipe`.
- Implemented base health endpoint `GET /api/v1/health` returning `{ "status": "ok" }`.
- Added Prisma baseline setup (`prisma/schema.prisma`) and generation scripts.
- Added local PostgreSQL runtime via `docker-compose.yml` and environment template `.env.example`.
