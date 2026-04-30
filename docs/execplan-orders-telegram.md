# Implement orders API and Telegram admin notification

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document is maintained according to `docs/PLANS.md`.

verified at 2026-04-29

## Purpose / Big Picture

After this change, users will be able to submit an order payload through REST API, the backend will persist order and order items in PostgreSQL, and the system will send an admin notification to Telegram. This is the first complete implementation of the core business flow from catalog browsing to order submission.

## Progress

- [x] (2026-04-29 19:47Z) Confirmed current repo state and spec requirements for next MVP step.
- [x] (2026-04-29 19:53Z) Added Prisma data model for orders and order items.
- [x] (2026-04-29 19:56Z) Implemented Orders module structure (Controller, Service, Repository, DTO).
- [x] (2026-04-29 19:57Z) Implemented Telegram notification service and failure persistence behavior.
- [x] (2026-04-29 20:02Z) Ran Prisma generate, TypeScript validation, and build checks.
- [x] (2026-04-29 20:03Z) Updated `docs/spec.md`, `docs/solutions.md`, and `release.md` to reflect implemented functionality.
- [ ] Execute HTTP smoke checks on host with running PostgreSQL (blocked in current local environment).

## Surprises & Discoveries

- Observation: Prisma is imported from generated `.prisma/client` path in this repository to keep type exports stable in current environment.
  Evidence: existing modules (`catalog`, `prisma`) already use `.prisma/client` imports.

- Observation: `prisma migrate diff --from-migrations` requires shadow database URL and cannot run purely offline.
  Evidence: CLI error `You must pass the --shadow-database-url if you want to diff a migrations directory`.

## Decision Log

- Decision: Use model name `OrderRequest` instead of `Order`.
  Rationale: avoids potential conflict with SQL reserved keyword `ORDER` and keeps DB naming simpler.
  Date/Author: 2026-04-29 / Codex

- Decision: Keep notification failure non-fatal for order creation.
  Rationale: business rule requires order persistence even when Telegram delivery fails.
  Date/Author: 2026-04-29 / Codex

- Decision: Calculate totals from integer cents in service logic.
  Rationale: avoid floating-point precision drift and keep deterministic monetary arithmetic before writing decimal strings to DB.
  Date/Author: 2026-04-29 / Codex

## Outcomes & Retrospective

Orders MVP is implemented in backend API and persistence layer. Telegram admin notification is integrated with safe failure mode (order persistence is never rolled back by notification failure). Prisma schema and migration are prepared. Remaining gap is runtime HTTP smoke validation against live PostgreSQL in this environment.

## Context and Orientation

Current API already exposes catalog read endpoints and has production deployment setup. Missing business-critical part was order submission and admin notification.

Relevant paths for this work:

- `prisma/schema.prisma`
- `src/modules/orders/*`
- `src/app.module.ts`
- `docs/spec.md`

## Plan of Work

Add order data models, implement order creation/read endpoints, compute monetary totals deterministically, persist order items with snapshot price values, and call Telegram API for admin notification. Persist notification errors without rolling back order creation.

## Concrete Steps

From repository root (`/Users/Andrey/Documents/Projects/majormodels`):

1. Update Prisma schema with `OrderRequest`, `OrderItem`, and `OrderStatus` enum.
2. Implement module files in `src/modules/orders`.
3. Wire module in root `AppModule`.
4. Run validation:
   - `npm run prisma:generate`
   - `npm run lint`
   - `npm run build`

Executed during implementation:

- `npm run prisma:generate` (success)
- `npm run lint` (success)
- `npm run build` (success)

## Validation and Acceptance

Acceptance criteria:

- `POST /api/v1/orders` creates order and items in DB.
- `GET /api/v1/orders/:id` returns persisted order details.
- Missing products in order payload return validation/business error.
- Telegram send failures do not remove created order; failure reason is stored.
- TypeScript checks pass. (completed)
- HTTP smoke checks with real DB are pending in current environment.

## Idempotence and Recovery

Schema and code changes are additive. If migration cannot be applied in environment, fallback is to generate SQL diff and apply on target DB later. API behavior remains backward compatible for existing endpoints.

## Artifacts and Notes

Primary artifacts:

- `src/modules/orders/*`
- `prisma/migrations/20260429195900_orders_and_notifications/migration.sql`
- `docs/spec.md` (updated with implemented order functionality)

Validation evidence:

    > npm run prisma:generate
    ✔ Generated Prisma Client (v6.19.3)

    > npm run lint
    > tsc -p tsconfig.json --noEmit

    > npm run build
    > tsc -p tsconfig.build.json

## Interfaces and Dependencies

New interfaces:

- `POST /api/v1/orders`
- `GET /api/v1/orders/:id`

New module components:

- `OrdersController`
- `OrdersService`
- `OrdersRepository`
- `OrdersTelegramService`

New persistence models:

- `OrderRequest`
- `OrderItem`
- `OrderStatus`

Revision note (2026-04-29): updated plan after implementation with completed milestones, migration generation constraint, and validation evidence.
