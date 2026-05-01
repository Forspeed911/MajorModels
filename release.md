# Release Notes

## v0.11.0
- Added product image storage metadata:
  - new Prisma model `ProductImage`
  - migration `20260430135600_product_images`
  - product responses now include `images: string[]`
  - `imageUrl` remains as the first image URL for compatibility.
- Added media serving endpoint:
  - `GET /api/v1/media/products/:article/:filename`
  - supports `.jpg`, `.jpeg`, `.png`, `.webp`
- Added product image import command:
  - `npm run product-images:import -- <path-to-products-images>`
  - `npm run product-images:import -- <path-to-products-images> --dry-run`
  - local TypeScript runner: `npm run product-images:import:dev`
- Added production media mount:
  - host `/opt/majormodels-media`
  - container `/app/media` read-only
- Updated Telegram product cards:
  - product lists stay text-only
  - cards upload the product photo into Telegram
  - multiple photos can be browsed inside the card.
- Added `manual.md` with operator instructions for deployment, price-list updates, and product photo updates.

## v0.10.0
- Added promo-code support to order checkout:
  - `PROMO10` = 10%
  - `PROMO15` = 15%
  - `PROMO20` = 20%
- Added order pricing snapshot fields:
  - `subtotal`
  - `discountTotal`
  - final `total` after discount
- Added delivery/contact checkout data:
  - `deliveryMethod` (`CDEK` / `OZON`)
  - `pickupPointAddress`
  - `customerPhone`
  - `customerFullName`
- Updated Telegram bot checkout UX:
  - cart has a `Промокод` button
  - promo input/error prompts are concise
  - product list buttons show only product names
  - product details open as a separate card with article, name, price, and navigation buttons
  - checkout asks delivery method, pickup-point address, phone, and full name before submitting.
- Added Prisma migration `20260430114900_checkout_promo_delivery`.

## v0.9.0
- Fixed production startup resilience:
  - Telegram polling now starts asynchronously and no longer blocks HTTP API startup/health checks.
- Improved local/test order behavior:
  - placeholder Telegram credentials (`replace_me`) are treated as missing config for admin notifications.
- Added catalog Excel import command:
  - `npm run catalog:import -- <path-to-xlsx>`
  - `npm run catalog:import -- <path-to-xlsx> --dry-run`
  - production command now runs compiled JS from `dist/scripts`
  - local TypeScript runner is available as `npm run catalog:import:dev`
- Included the default price-list workbook in the production Docker image for container-side imports.
- Supported the current price-list workbook format:
  - sheet `Продукция`
  - required columns `Категория`, `Артикул`, `Наименование`, `Цена`
- Import behavior is idempotent:
  - categories are upserted by `name`
  - products are upserted by `article`
  - products missing from Excel are not deleted
- Added `docs/execplan-catalog-excel-import.md` and updated `docs/spec.md` / `docs/solutions.md`.

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
