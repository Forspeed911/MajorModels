# Add product image import and media serving

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document follows `docs/PLANS.md`.

## Purpose / Big Picture

After this change, operators can upload product photos to a server directory using article-named folders, run an import command, and have product API responses include image URLs. Telegram product cards use those image URLs to upload the current product photo into Telegram only when a user opens the card; category product lists remain text-only. Media files remain outside git and outside the Docker image, so updating photos does not require rebuilding application code.

## Progress

- [x] (2026-04-30 13:56Z) Reviewed current product DTOs, catalog repository, Docker Compose production file, and compiled script setup.
- [x] (2026-04-30 13:56Z) Chose external media root `/opt/majormodels-media` on host mounted as `/app/media` in the API container.
- [x] (2026-04-30 13:58Z) Added Prisma `ProductImage` model and migration.
- [x] (2026-04-30 13:59Z) Added product image import command with dry-run.
- [x] (2026-04-30 14:00Z) Added safe media file serving endpoint under `/api/v1/media/products/...`.
- [x] (2026-04-30 14:00Z) Included image arrays in product API responses.
- [x] (2026-04-30 14:01Z) Validated with lint/build, local migration deploy, test import, product API response, and media endpoint.
- [x] (2026-04-30 14:02Z) Updated docs and release notes.
- [x] (2026-05-01 00:00Z) Updated Telegram product cards to upload photos only when the card is opened, with previous/next navigation when multiple photos exist.
- [x] (2026-05-01 00:00Z) Adjusted image import so an empty matched article folder clears that product's image metadata instead of leaving stale DB rows.

## Surprises & Discoveries

- Observation: The first lint run raced Prisma Client generation and saw stale relation types.
  Evidence: re-running after `npm run prisma:generate` removed `ProductInclude` errors for `images`.

- Observation: The media endpoint can serve URL-encoded Cyrillic article paths.
  Evidence: local GET `/api/v1/media/products/%D0%9C%D0%9C309/1.jpg` returned HTTP 200.

- Observation: To be a true sync, an existing article folder with no supported image files must still be treated as matched.
  Evidence: `scripts/import-product-images.ts` now pushes matched folders even when `files.length` is zero, so the non-dry-run transaction deletes previous `ProductImage` rows and sets `Product.imageUrl` to null.

- Observation: In this local environment, Prisma CLI could connect through `localhost`, but the TypeScript import script needed `127.0.0.1` to reach the Docker-published Postgres port.
  Evidence: `npm run product-images:import:dev -- /private/tmp/majormodels-empty-images --dry-run` failed with `Can't reach database server at localhost:5432`; the same command with `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/majormodels?schema=public` completed with zero folders scanned.

## Decision Log

- Decision: Store images in the filesystem and store only URLs in the database.
  Rationale: product photos are binary media that can be large and frequently updated; keeping them out of PostgreSQL, git, and the Docker image avoids bloated backups and slow deploys.
  Date/Author: 2026-04-30 / Codex.

- Decision: Use `ProductImage` table instead of only `Product.imageUrl`.
  Rationale: the user expects many articles to have photos and future product cards may need multiple photos. A separate table supports one or many images while keeping the existing `imageUrl` field backward compatible as the first image.
  Date/Author: 2026-04-30 / Codex.

- Decision: Match image folders by exact article first, then by a normalized article key that converts common Cyrillic lookalike letters to Latin.
  Rationale: the catalog has articles with both Cyrillic `ММ` and Latin `MM`; operators may name folders either way.
  Date/Author: 2026-04-30 / Codex.

- Decision: Telegram sends product photos by uploading bytes fetched from the backend media endpoint instead of asking Telegram to fetch the URL directly.
  Rationale: the media URLs can be internal application URLs such as `http://127.0.0.1:3000/api/v1/media/...`, which Telegram cloud servers cannot reach. Uploading bytes from the bot process works with private/internal media serving.
  Date/Author: 2026-05-01 / Codex.

## Outcomes & Retrospective

Completed. The backend now supports filesystem-backed product images, DB metadata, import from article folders, and safe media serving. Telegram category lists stay text-only, and product cards upload the selected photo into Telegram when a user opens a card.

## Context and Orientation

Products are stored in Prisma model `Product` in `prisma/schema.prisma`. Catalog API responses are built by `src/modules/catalog/dto/product-response.dto.ts` and loaded by `src/modules/catalog/repositories/catalog.repository.ts`.

The production API runs inside Docker from `docker-compose.prod.yml`. Product images should be uploaded to the host directory `/opt/majormodels-media/products/<article>/...` and mounted read-only into the API container at `/app/media/products/<article>/...`.

## Plan of Work

Add `ProductImage` to Prisma with fields `id`, `productId`, `url`, `sortOrder`, `createdAt`, and a uniqueness constraint on product and URL. Add a migration that creates the table and indexes.

Add `scripts/import-product-images.ts`. The command accepts a folder path, supports `--dry-run`, scans article folders for image extensions, matches folders to products, replaces existing images for matched products with the current folder contents, updates `Product.imageUrl` to the first image, and prints imported/skipped counts.

Add a media controller under the catalog module that safely serves files from `MEDIA_ROOT` or `/app/media` by default. It must reject path traversal and only serve supported image extensions.

Extend product responses with `images: string[]`, preserving `imageUrl` as the first image URL or null.

Update `src/modules/telegram-bot/telegram-bot.service.ts` so category product buttons open a product card. A product card fetches `GET /products/:id`, uses the first URL from `images` or `imageUrl`, asks `TelegramBackendRepository` to fetch that image as bytes through the backend API, and sends it with `ctx.replyWithPhoto`. If more than one image exists, the card includes previous and next photo buttons. If image upload fails, the bot logs a warning and falls back to the text card.

## Concrete Steps

Expected commands from the repository root:

    npm run product-images:import:dev -- /path/to/products --dry-run
    npm run lint
    npm run build

In production after uploading files:

    docker compose -f docker-compose.prod.yml --env-file .env.production exec api npm run product-images:import -- /app/media/products

## Validation and Acceptance

The change is accepted when the project builds, the import command dry-runs a folder tree without DB writes, and product API responses include `images` arrays. A photo URL returned by the API should be fetchable through `/api/v1/media/products/<article>/<filename>`. In Telegram, opening a product from a category should show a card; if the product has imported photos, that card should contain the photo and show photo navigation only inside the card.

## Idempotence and Recovery

The image import is safe to run repeatedly. For matched products, it replaces DB image rows with the current files in the folder, so re-running after adding/removing images synchronizes the database to the filesystem. It does not delete physical files.

## Artifacts and Notes

Validation transcripts from 2026-05-01:

    npm run lint
    # tsc -p tsconfig.json --noEmit && tsc -p tsconfig.scripts.json --noEmit
    # exit code 0

    npm run build
    # tsc -p tsconfig.build.json && tsc -p tsconfig.scripts.json
    # exit code 0

    DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/majormodels?schema=public' npm run product-images:import:dev -- /private/tmp/majormodels-empty-images --dry-run
    # Product images dry-run completed
    # Root: /private/tmp/majormodels-empty-images
    # Folders scanned: 0
    # Products matched: 0
    # Images found: 0

## Interfaces and Dependencies

No new npm packages are required. The implementation uses Node built-ins, existing Prisma, NestJS, and existing Telegraf APIs.

Revision note, 2026-05-01: added Telegram card photo delivery to match the product decision that photos are shown only inside product cards, not in category product lists.

Revision note, 2026-05-01: changed empty matched article folders from skipped folders to sync targets so image removals on disk are reflected in the database.
