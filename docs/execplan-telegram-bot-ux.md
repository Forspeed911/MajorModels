# Implement Telegram bot UX for catalog browsing and order submission

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document is maintained according to `docs/PLANS.md`.

verified at 2026-04-29

## Purpose / Big Picture

After this change, a Telegram user will be able to interact with the bot via commands/buttons: browse categories, view products, add items to a cart, review cart, and submit an order. Bot submission will call backend order API and return confirmation to the user.

## Progress

- [x] (2026-04-29 20:09Z) Captured feature scope and constraints from `docs/spec.md`.
- [x] (2026-04-29 20:47Z) Added `telegraf` dependency and wired `TelegramBotModule` in `src/app.module.ts`.
- [x] (2026-04-29 20:55Z) Implemented bot runtime with `/start`, `/catalog`, `/cart`, callback handlers, in-memory cart, and checkout flow.
- [x] (2026-04-29 20:58Z) Implemented backend API repository for bot calls to `/categories`, `/products`, `/products/:id`, `/orders`.
- [x] (2026-04-29 21:07Z) Validated `npm run lint` and `npm run build`; updated `docs/spec.md`, `docs/solutions.md`, and `release.md`.

## Surprises & Discoveries

- Observation: Direct `typegram` import was not available in this workspace dependency graph and failed strict TS compile.
  Evidence: `src/modules/telegram-bot/telegram-bot.service.ts` initial error `TS2307 Cannot find module 'typegram'`; resolved by local `TelegramUser` interface mapped from `ctx.from`.

## Decision Log

- Decision: Use Telegraf directly inside NestJS module instead of an additional Nest wrapper package.
  Rationale: keeps dependencies minimal and explicit lifecycle control in service hooks.
  Date/Author: 2026-04-29 / Codex

- Decision: Keep bot-to-backend integration through REST calls instead of direct Nest service injection.
  Rationale: preserves explicit API contract usage and mirrors production interaction regardless of process boundaries.
  Date/Author: 2026-04-29 / Codex

- Decision: Keep cart storage in-memory for current stage and explicitly record persistence as next-stage scope in spec.
  Rationale: matches current MVP target while avoiding premature schema/session complexity.
  Date/Author: 2026-04-29 / Codex

## Outcomes & Retrospective

Telegram UX stage is implemented end-to-end: user can navigate categories, add items, inspect cart, and submit order from Telegram. Build/type checks are green. Remaining gap is operational hardening (persistent cart/retry flow), now documented in `docs/spec.md`.

## Context and Orientation

Backend API already supports catalog and order creation. Missing layer is interactive user UX in Telegram itself. This plan adds a dedicated module that starts Telegram polling (if token configured) and orchestrates user flow against existing REST API.

## Plan of Work

Implement `TelegramBotModule` with a service that launches Telegraf, keeps in-memory per-user cart state, and maps inline-button actions to backend API calls. Ensure absence of bot token does not break API startup.

## Concrete Steps

From repository root (`/Users/Andrey/Documents/Projects/majormodels`):

1. Add module files under `src/modules/telegram-bot`.
2. Wire `TelegramBotModule` in `src/app.module.ts`.
3. Run validation:
   - `npm run lint`
   - `npm run build`
4. Update docs.

## Validation and Acceptance

Acceptance criteria:

- `/start` in Telegram shows main menu buttons.
- User can open categories and products.
- User can add products to in-memory cart.
- User can submit cart; bot calls `POST /api/v1/orders`.
- On success bot returns order id and total.
- TypeScript checks pass.

## Idempotence and Recovery

Bot module is additive and guarded by token presence. If token is absent, module logs warning and remains inactive without impacting API endpoints.

## Artifacts and Notes

- Validation output:
  - `npm run lint` -> success (`tsc -p tsconfig.json --noEmit`)
  - `npm run build` -> success (`tsc -p tsconfig.build.json`)
- Added files:
  - `src/modules/telegram-bot/telegram-bot.module.ts`
  - `src/modules/telegram-bot/telegram-bot.service.ts`
  - `src/modules/telegram-bot/repositories/telegram-backend.repository.ts`
  - `src/modules/telegram-bot/dto/telegram-backend.dto.ts`
  - `src/modules/telegram-bot/utils/money.ts`

## Interfaces and Dependencies

New components:

- `TelegramBotModule`
- `TelegramBotService`
- `TelegramBackendRepository`
- Telegram DTO definitions in `src/modules/telegram-bot/dto/telegram-backend.dto.ts`

Dependencies:

- `telegraf` for Telegram interaction
- existing backend REST API endpoints for catalog/order operations

Revision note (2026-04-29): Updated progress, discoveries, decisions, outcomes, and interface names after full implementation and validation so the plan reflects actual delivered state.
