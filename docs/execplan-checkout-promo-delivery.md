# Add promo codes and delivery details to checkout

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document follows `docs/PLANS.md`.

## Purpose / Big Picture

After this change, a Telegram user can apply a static promo code in the cart, see the order total recalculated, choose where the order will be shipped, enter a pickup-point address, phone number, and full name, and then submit the order. The admin Telegram notification and order API response will include the discount and delivery/contact details, so the order can be fulfilled without a separate clarification chat.

## Progress

- [x] (2026-04-30 11:49Z) Reviewed current order DTOs, repository, response mapping, notification service, and Telegram bot cart flow.
- [x] (2026-04-30 11:49Z) Chose static promo mapping: `PROMO10 = 10%`, `PROMO15 = 15%`, `PROMO20 = 20%`.
- [x] (2026-04-30 11:52Z) Extended Prisma schema and migration for promo, subtotal/discount, delivery method, pickup-point address, customer phone, and customer full name.
- [x] (2026-04-30 11:52Z) Extended order API DTOs, service calculations, persistence, response DTOs, and Telegram admin notification text.
- [x] (2026-04-30 11:53Z) Extended Telegram bot cart and checkout flow with promo input and delivery/contact steps.
- [x] (2026-04-30 11:54Z) Validated with `npm run lint`, `npm run build`, migration deploy, and a local order API smoke test.
- [x] (2026-04-30 11:55Z) Updated `docs/spec.md`, `docs/solutions.md`, and `release.md`.

## Surprises & Discoveries

- Observation: Local API smoke test confirmed integer-cent discount calculation.
  Evidence: two units of product `ММ309` at `660` each produced `subtotal: "1320"`, `discountTotal: "198"` for `PROMO15`, and final `total: "1122"`.

## Decision Log

- Decision: Use `PROMO10`, `PROMO15`, and `PROMO20` as exact static promo codes with 10%, 15%, and 20% discounts.
  Rationale: the prompt named those three codes and asked for static behavior; keeping the mapping in code avoids adding a promotions admin model before it is needed.
  Date/Author: 2026-04-30 / Codex.

- Decision: Store both subtotal and discount total on `OrderRequest`, while keeping existing `total` as the final amount after discount.
  Rationale: existing clients already read `total`; preserving it as payable total keeps the contract intuitive while adding audit fields for discount calculation.
  Date/Author: 2026-04-30 / Codex.

- Decision: Add `DeliveryMethod` enum with values `CDEK` and `OZON`.
  Rationale: the checkout must offer the delivery providers CDEK and OZON; `CDEK` is the corrected spelling for the first provider.
  Date/Author: 2026-04-30 / Codex.

## Outcomes & Retrospective

Completed. The API and Telegram bot now support static promo codes and required delivery/contact data. The local smoke test demonstrated the new response fields and discount calculation.

## Context and Orientation

The backend is a NestJS application with Prisma and PostgreSQL. Order creation is handled by `src/modules/orders/orders.service.ts`, DB access by `src/modules/orders/repositories/orders.repository.ts`, request validation by DTOs in `src/modules/orders/dto`, and admin notification by `src/modules/orders/services/orders-telegram.service.ts`.

The Telegram user bot is implemented in `src/modules/telegram-bot/telegram-bot.service.ts`. It currently stores a per-user in-memory cart, shows cart contents, and submits a basic order through the existing REST API using `TelegramBackendRepository`.

## Plan of Work

First, update `prisma/schema.prisma` and add a migration that extends `OrderRequest`. The new fields are additive except delivery/contact fields, which will be required for newly created orders at API validation level but stored as nullable in the database migration to avoid unsafe changes against existing historical rows.

Second, update API DTOs and service logic. The service will normalize and validate promo codes, calculate subtotal from item snapshots, calculate discount in cents, calculate final total, and persist all order checkout details.

Third, update Telegram bot UX. The cart will include a `Промокод` button. When the user presses it, the bot asks for a promo code as text. Valid codes update the cart and recalculate the visible total. Checkout then asks for delivery method, pickup-point address, phone, and full name before creating the order.

Fourth, update docs and release notes, then run compile checks and smoke-test order creation.

## Concrete Steps

Run from repository root:

    npm run lint
    npm run build

With local PostgreSQL running and migrated, create an order through API with `promoCode`, `deliveryMethod`, `pickupPointAddress`, `customerPhone`, and `customerFullName`. The response should include `subtotal`, `discountTotal`, final `total`, promo details, and delivery details.

## Validation and Acceptance

Acceptance is met when the project builds, order creation persists and returns discount/delivery/contact fields, and the Telegram cart flow can collect a valid promo, delivery method, pickup-point address, phone, and full name before submitting an order.

## Idempotence and Recovery

The database migration is additive and safe to re-run through Prisma migration tracking. If the Telegram flow is interrupted, the in-memory cart remains available and the user can return to `/cart` to restart checkout steps.

## Artifacts and Notes

None yet.

## Interfaces and Dependencies

No new third-party dependencies are required. The implementation uses existing NestJS, class-validator, Prisma, and Telegraf dependencies.
