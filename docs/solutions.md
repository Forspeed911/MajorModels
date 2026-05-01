# Solutions Log

## 2026-04-30

### Problem: product cards need article-specific photos without bloating git or Docker images
- Context: product photos will be uploaded as folders named by article, with one or more files inside each folder. Storing binaries in git, Docker images, or PostgreSQL would make deploys and backups heavier than needed.
- Resolution: added `ProductImage` metadata table, product image import command, safe media file endpoint, and a production read-only mount from `/opt/majormodels-media` to `/app/media`.
- Result: product API responses now include `images`; a local test import for article `ММ309` produced two image URLs and `/api/v1/media/products/%D0%9C%D0%9C309/1.jpg` returned HTTP 200.
- Note: if an article folder exists but no supported images remain in it, the import clears that product's image metadata so removed files do not leave stale API URLs.

### Problem: Telegram must show photos only in product cards, while media URLs may be private
- Context: category product lists should stay compact, and Telegram cloud servers cannot fetch private/internal URLs such as `http://127.0.0.1:3000/api/v1/media/...`.
- Resolution: product list buttons now open a card; the bot fetches image bytes from the backend media endpoint and uploads them to Telegram with the card caption. Multiple images are browsed with previous/next buttons inside the card.
- Result: product photos are visible only after opening a product card, and the design works even when backend media URLs are not publicly reachable.

### Problem: operators need one place for deployment, price-list, and photo update instructions
- Context: deployment, Excel import, and product photo sync were documented across multiple files and implementation notes.
- Resolution: added root `manual.md` with production paths, deploy commands, price-list update workflow, photo directory rules, and sync commands.
- Result: routine operations can be performed from one document without reading ExecPlans or source files.

### Problem: production updates can fail on small disks during Docker build
- Context: `docker compose up -d --build` builds a new image and can fail around `npm ci` or layer extraction when Docker cache/images consume too much disk. The npm version notice is not the failure cause; the actionable error appears above it.
- Resolution: added low-disk recovery commands to `manual.md` and updated `Dockerfile` to prune dev dependencies and npm cache after building.
- Result: operators have a safe cleanup path that avoids deleting PostgreSQL volumes, and the runtime image keeps fewer unnecessary build-time packages.

### Problem: checkout needed promo discounts and fulfillment details before order submission
- Context: the Telegram cart previously submitted only product items and Telegram profile data, so the admin did not receive promo, delivery method, pickup-point address, phone, or customer full name.
- Resolution: added static promo codes (`PROMO10`, `PROMO15`, `PROMO20`), persisted subtotal/discount/final total, added `DeliveryMethod` (`CDEK`, `OZON`) and checkout contact fields, and extended the Telegram bot flow to collect promo, delivery, address, phone, and FIO.
- Result: API order creation returns discount and fulfillment fields; local smoke test with `PROMO15` on a 1320 subtotal returned discount `198` and total `1122`.

### Problem: Telegram product list was too dense for browsing
- Context: category product buttons included article and price, which made long product names harder to scan and skipped a dedicated product-card step.
- Resolution: changed category product buttons to show only product names; selecting a product opens a card with article, name, price, and buttons `В корзину`, `Назад`, `В меню`.
- Result: browsing is cleaner while product details remain available before adding to cart.

### Problem: API container stayed unhealthy when Telegram polling blocked startup
- Context: production logs showed NestJS registered routes but never opened port `3000`; health checks returned `Connection refused`. The Telegram bot startup was awaited in `onModuleInit`, so a slow or blocked `bot.launch()` could prevent the HTTP API from listening.
- Resolution: changed Telegram polling startup to run asynchronously after handler registration, logging polling failures without blocking NestJS HTTP startup.
- Result: API health endpoint can start independently from Telegram polling availability; bot errors remain visible in application logs.

### Problem: placeholder Telegram credentials caused unnecessary network attempts during local order tests
- Context: local `.env` uses `TELEGRAM_BOT_TOKEN=replace_me` and `TELEGRAM_ADMIN_CHAT_ID=replace_me`. Order creation treated those placeholders as configured credentials and attempted Telegram API delivery before recording notification failure.
- Resolution: updated order notification config validation to treat empty values and `replace_me` placeholders as missing configuration.
- Result: local order creation records a deterministic configuration error without waiting on an external Telegram request.

### Problem: catalog needed repeatable price-list import from Excel without manual SQL
- Context: the project has `docs/majormodelsprice.xlsx` as the source price list, and operators need to update product data on a server by editing/uploading Excel and running a command.
- Resolution: added `scripts/import-catalog.ts` and `npm run catalog:import` with a dry-run mode; the script reads the simple XLSX XML structure using Node built-ins and writes through the existing Prisma client.
- Result: the checked-in workbook dry-runs successfully with 189 products and 10 categories; full DB import is idempotent when PostgreSQL is reachable.

### Problem: production import command could not see the default Excel workbook inside the API container
- Context: `.dockerignore` excluded `docs`, and the runtime Docker image copied only package files, node_modules, Prisma, dist, and scripts. The command `npm run catalog:import -- docs/majormodelsprice.xlsx` is intended to run inside the API container.
- Resolution: allowed `docs/majormodelsprice.xlsx` into the Docker build context and copied it into the production runtime image.
- Result: after a successful image rebuild, the container-side import command can read the default workbook path.

### Problem: production import command failed to run TypeScript through ts-node
- Context: inside the production API container, `npm run catalog:import` failed with `ERR_UNKNOWN_FILE_EXTENSION` for `scripts/import-catalog.ts`.
- Resolution: added `tsconfig.scripts.json` so build produces `dist/scripts/import-catalog.js`, changed `catalog:import` to run the compiled JS, and kept `catalog:import:dev` for local TypeScript execution.
- Result: production imports no longer depend on `ts-node` runtime behavior.

### Problem: importing Excel could introduce package/deployment friction
- Context: adding a new XLSX npm package would require dependency installation and extra deployment surface for a simple four-column workbook.
- Resolution: implemented a minimal XLSX reader for the current workbook contract using ZIP central directory parsing and XML extraction with Node built-ins (`fs`, `zlib`).
- Result: no new runtime dependency is required for price-list import.

### Problem: DB data could be lost via `docker compose down -v` on production stack
- Context: named volume managed directly by Compose can be removed in destructive cleanup flows, which conflicts with strict persistence requirements.
- Resolution: converted PostgreSQL storage to external Docker volume (`DB_VOLUME_NAME`) in `docker-compose.prod.yml` and added bootstrap step to auto-create that volume before deployment.
- Result: standard compose teardown no longer removes DB storage; data persistence is decoupled from compose lifecycle.

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

### Problem: generating incremental Prisma SQL from migrations directory requires shadow database
- Context: `prisma migrate diff --from-migrations ...` failed in local environment because `--shadow-database-url` is required and no shadow DB is available.
- Resolution: generated migration SQL by diffing previous committed schema vs current schema (`git show HEAD:prisma/schema.prisma` -> `--from-schema-datamodel`).
- Result: created incremental migration file for orders/notifications without requiring live DB.

### Problem: order creation must not fail when Telegram delivery fails
- Context: business flow requires preserving user orders even if Telegram notification is temporarily unavailable.
- Resolution: implemented non-fatal notification path: order is stored first, Telegram send runs next, and failure is persisted to `notificationError` while order stays in `NEW`.
- Result: data durability for orders is preserved; failed notifications remain observable and recoverable.

### Problem: Telegram bot typing via `typegram` import failed in local dependency graph
- Context: initial implementation used `import type { User } from 'typegram'`, but strict TS build failed (`TS2307`) because the package is not directly available for imports in this setup.
- Resolution: removed external `typegram` dependency usage from module code and introduced local `TelegramUser` interface mapped from `ctx.from`.
- Result: `npm run lint` and `npm run build` pass with strict TypeScript checks.

### Problem: installer could not safely request Telegram credentials in `curl | bash` mode
- Context: in piped bootstrap execution, stdin is occupied by script stream, so ordinary `read` prompts are unreliable.
- Resolution: switched interactive input to `/dev/tty` in `scripts/bootstrap-server.sh` and added guarded secret prompts for `POSTGRES_PASSWORD`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_ADMIN_CHAT_ID`.
- Result: one-command installer now supports interactive secret entry while keeping same-server Docker DB deployment flow deterministic.
