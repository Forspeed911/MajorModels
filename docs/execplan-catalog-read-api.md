# Implement catalog read API (categories + products)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document is maintained according to `docs/PLANS.md`.

## Purpose / Big Picture

After this change, the project will expose a usable catalog read API for the Telegram bot flow. A client will be able to request categories, list/search products, and open a single product card. This is the minimal backend behavior needed before implementing cart/request flow.

## Progress

- [x] (2026-04-29 19:04Z) Captured implementation plan and target interfaces.
- [x] (2026-04-29 19:06Z) Added Prisma data model for categories/products with relation and required constraints.
- [x] (2026-04-29 19:07Z) Implemented infrastructure layer (`PrismaModule`, `PrismaService`) and catalog repository.
- [x] (2026-04-29 19:08Z) Implemented service/controller/DTO endpoints for category list and product list/detail.
- [x] (2026-04-29 19:10Z) Validated `prisma generate`, `lint`, `build`.
- [x] (2026-04-29 19:12Z) Added initial SQL migration via `prisma migrate diff` without DB connection.
- [x] (2026-04-29 19:13Z) Updated `docs/solutions.md` and `release.md`.
- [ ] Smoke-check HTTP 200 responses for catalog endpoints against running PostgreSQL (blocked: Docker daemon unavailable in current environment).

## Surprises & Discoveries

- Observation: TypeScript did not resolve generated model exports/delegates through `@prisma/client` in this environment, despite successful `prisma generate`.
  Evidence: `TS2305` (`Category`/`Product` not exported) and missing delegate properties (`category`, `product`) before import path fix.

- Observation: Runtime API validation was blocked by unavailable Docker daemon and absent PostgreSQL process.
  Evidence: `docker compose up -d` failed with Docker socket error; app startup failed with Prisma `P1001` (cannot reach `localhost:5432`).

## Decision Log

- Decision: Implement read-only catalog API first, not admin CRUD.
  Rationale: `docs/spec.md` describes buyer flow first (browse and select), while admin web UI is explicitly out of scope for phase 1.
  Date/Author: 2026-04-29 / Codex

- Decision: Keep startup-time Prisma connection check (`onModuleInit`) and do not hide DB unavailability.
  Rationale: Fail-fast behavior is preferable for backend reliability and surfaces infrastructure issues early.
  Date/Author: 2026-04-29 / Codex

- Decision: Use generated client import path `.prisma/client` for typing/runtime integration in this environment.
  Rationale: `@prisma/client` stub re-export did not expose generated model types for TypeScript checks here; direct generated client import restored strict typing and delegate access.
  Date/Author: 2026-04-29 / Codex

## Outcomes & Retrospective

Catalog read API (categories/products) is implemented with layered architecture and passes compile-time validation (`prisma generate`, `lint`, `build`). Initial SQL migration is prepared and checked into `prisma/migrations`. The remaining gap is runtime endpoint smoke-testing against a live PostgreSQL instance, blocked by infrastructure in the current environment (Docker daemon unavailable).

## Context and Orientation

Current repository had only a health module and base NestJS bootstrap. Relevant files before this plan are:

- `src/main.ts` (global prefix `/api/v1`, global `ValidationPipe`)
- `src/app.module.ts` (module composition)
- `prisma/schema.prisma` (empty data model)

We need to add persistent catalog entities and keep strict layering: `Controller -> Service -> Repository`, with database calls only in repository classes.

## Plan of Work

First, extend `prisma/schema.prisma` with models `Category` and `Product`. `Product` will include `article`, `name`, `price`, optional `imageUrl`, and `categoryId` foreign key.

Second, introduce database infrastructure module under `src/modules/prisma` so Prisma client lifecycle is managed by NestJS DI.

Third, create `src/modules/catalog` with DTOs, repository, service, and controller:

- `GET /api/v1/categories`
- `GET /api/v1/products` with query filters (`search`, `categoryId`, `limit`, `offset`)
- `GET /api/v1/products/:id`

Fourth, wire `CatalogModule` into `AppModule` and run compile checks.

Finally, document issues/resolutions and release notes.

## Concrete Steps

From repository root (`/Users/Andrey/Documents/Projects/majormodels`):

1. Edit Prisma schema and add new NestJS module files.
2. Run:
   - `npm run prisma:generate`
   - `npm run lint`
   - `npm run build`
3. Run smoke check with local process:
   - `node dist/main.js`
   - `curl -i http://127.0.0.1:3000/api/v1/categories`
   - `curl -i "http://127.0.0.1:3000/api/v1/products?limit=5&offset=0"`

Expected behavior: endpoints return HTTP 200 with JSON payloads (`[]` or `{ items: [], total: 0, ... }`) on empty DB.

Executed during implementation:

- `npm run prisma:generate` (success)
- `npm run lint` (success)
- `npm run build` (success)
- `docker compose up -d` (failed due unavailable Docker daemon)
- `node dist/main.js` (fails fast with Prisma `P1001` without reachable DB)
- `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20260429191200_init_catalog/migration.sql` (success)

## Validation and Acceptance

Acceptance criteria:

- Server starts without runtime errors. (blocked by unavailable local PostgreSQL in current environment)
- `GET /api/v1/categories` responds `200` with JSON array. (blocked by unavailable local PostgreSQL in current environment)
- `GET /api/v1/products` responds `200` with paginated JSON structure. (blocked by unavailable local PostgreSQL in current environment)
- `GET /api/v1/products/:id` returns `404` for unknown UUID and `200` for existing record. (blocked by unavailable local PostgreSQL in current environment)
- TypeScript checks pass (`lint`, `build`). (completed)

## Idempotence and Recovery

All file edits are additive and can be rerun safely. `prisma generate` is idempotent. If schema mistakes break generation, rollback by restoring last valid `prisma/schema.prisma` and rerunning generation.

## Artifacts and Notes

Key artifacts:

- `prisma/schema.prisma` with `Category`/`Product` models and relation.
- `src/modules/prisma/*` for DB infrastructure.
- `src/modules/catalog/*` for repository/service/controllers/DTO.
- `prisma/migrations/20260429191200_init_catalog/migration.sql` for initial catalog schema migration.

Evidence snippets:

    > npm run lint
    > tsc -p tsconfig.json --noEmit

    > npm run build
    > tsc -p tsconfig.build.json

    PrismaClientInitializationError: Can't reach database server at `localhost:5432`

## Interfaces and Dependencies

New interfaces to exist after implementation:

- `CatalogRepository` class methods:
  - `findCategories(): Promise<Category[]>`
  - `findProducts(params): Promise<{ items: Product[]; total: number }>`
  - `findProductById(id: string): Promise<Product | null>`
- `CatalogService` class methods:
  - `getCategories()`
  - `getProducts(queryDto)`
  - `getProductById(id)`
- Controller routes under `/api/v1`:
  - `GET /categories`
  - `GET /products`
  - `GET /products/:id`

Dependencies used:

- NestJS DI/modules/controllers
- Prisma client for PostgreSQL access
- `class-validator` and `class-transformer` for request DTO validation and coercion

Revision note (2026-04-29): updated the plan after implementation to reflect completed steps, recorded runtime validation blocker (Docker/PostgreSQL unavailable), and appended concrete evidence and decisions made during execution.
