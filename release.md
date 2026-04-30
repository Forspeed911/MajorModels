# Release Notes

## v0.8.0
- Hardened production DB persistence with external Docker volume:
  - `docker-compose.prod.yml` now uses external volume for PostgreSQL data
  - volume name is configurable via `DB_VOLUME_NAME` (default `majormodels_postgres_data_prod`)
- Updated bootstrap installer:
  - auto-creates persistent DB volume before `docker compose up`
  - writes default `DB_VOLUME_NAME` into `.env.production` when missing
- Updated env templates:
  - added `DB_VOLUME_NAME` to `.env.example` and `.env.production.example`
- Updated deployment/spec docs to reflect external volume behavior and operational commands.

## v0.7.0
- Updated one-command bootstrap installer for same-server DB deployment flow:
  - default `INSTALL_POSTGRESQL=0` (host PostgreSQL install is optional)
  - automatic `DATABASE_URL` generation targeting compose DB service (`db:5432`)
- Added interactive secret prompts in `scripts/bootstrap-server.sh` (works in `curl | bash` flow via `/dev/tty`):
  - `POSTGRES_PASSWORD`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_ADMIN_CHAT_ID`
- Added bootstrap control flag:
  - `PROMPT_FOR_SECRETS` (`1` by default)
- Updated deployment docs and specification for the new installation behavior.

## v0.6.0
- Added Telegram user bot UX module (`src/modules/telegram-bot`):
  - long-polling Telegraf runtime integrated into NestJS lifecycle
  - commands: `/start`, `/catalog`, `/cart`
  - inline flow: categories -> products -> add to cart -> checkout
- Added in-memory per-user cart handling with deterministic subtotal/total formatting in bot responses.
- Added backend API client layer for bot (`GET /categories`, `GET /products`, `GET /products/:id`, `POST /orders`).
- Wired `TelegramBotModule` into root `AppModule`.
- Added optional env var for bot API base URL override:
  - `TELEGRAM_BACKEND_BASE_URL` in `.env.example` and `.env.production.example`
- Updated `docs/spec.md` with implemented Telegram bot UX contract and current next-stage requirements.

## v0.5.0
- Implemented orders workflow API:
  - `POST /api/v1/orders`
  - `GET /api/v1/orders/:id`
- Added new Prisma models and enum:
  - `OrderRequest`
  - `OrderItem`
  - `OrderStatus` (`NEW`, `NOTIFIED`)
- Added business behavior for order submission:
  - aggregation of duplicate product positions
  - snapshot storage of `unitPrice` and `subtotal`
  - deterministic total calculation and persistence
- Added Telegram admin notification service for new orders.
- Added non-fatal Telegram failure handling:
  - order remains persisted
  - notification error is stored in DB
- Added incremental migration:
  - `prisma/migrations/20260429195900_orders_and_notifications/migration.sql`
- Updated `docs/spec.md` to reflect implemented order and notification functionality.

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
