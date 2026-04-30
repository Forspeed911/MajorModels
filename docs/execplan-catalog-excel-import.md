# Add idempotent catalog import from Excel

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document follows `docs/PLANS.md`.

## Purpose / Big Picture

After this change, an operator can upload or edit an Excel price-list file on the server and run one npm command to load catalog data into PostgreSQL. The import command reads categories and products from the workbook, creates missing categories, inserts new products, and updates existing products by article. The behavior is observable by running the command and then querying the existing `/api/v1/categories` and `/api/v1/products` endpoints.

## Progress

- [x] (2026-04-30 05:08Z) Inspected the current workbook `docs/majormodelsprice.xlsx`.
- [x] (2026-04-30 05:08Z) Confirmed the workbook has one sheet named `Продукция` with headers `Категория`, `Артикул`, `Наименование`, `Цена`.
- [x] (2026-04-30 05:08Z) Chose an import design that uses only Node.js built-in modules plus the existing Prisma client.
- [x] (2026-04-30 05:12Z) Implemented `scripts/import-catalog.ts` and npm command `catalog:import`.
- [x] (2026-04-30 05:13Z) Validated TypeScript lint/build and ran dry-run against the checked-in workbook.
- [x] (2026-04-30 05:14Z) Attempted real DB import; blocked because local PostgreSQL at `localhost:5432` is not reachable and Docker daemon is not running.
- [x] (2026-04-30 05:15Z) Updated `docs/spec.md`, `docs/solutions.md`, and `release.md`.

## Surprises & Discoveries

- Observation: The workbook does not need a complex mapping layer today.
  Evidence: the sheet preview showed one worksheet named `Продукция`, and the first row is exactly `Категория`, `Артикул`, `Наименование`, `Цена`.

- Observation: The local environment cannot complete a real DB import until PostgreSQL is running.
  Evidence: `docker compose up -d` failed with `failed to connect to the docker API`, and `npm run catalog:import -- docs/majormodelsprice.xlsx` failed with `Can't reach database server at localhost:5432`.

## Decision Log

- Decision: Import products by unique `article`, and categories by unique `name`.
  Rationale: `prisma/schema.prisma` already defines `Category.name` and `Product.article` as unique fields, so these are the stable business keys available without changing the database schema.
  Date/Author: 2026-04-30 / Codex.

- Decision: Do not delete products missing from the Excel file in this version.
  Rationale: the current schema has no `isActive` or archival flag, and hard deletion could break existing order history because `OrderItem.productId` uses `onDelete: Restrict`. Safe update/insert behavior is enough for test data and price-list refreshes.
  Date/Author: 2026-04-30 / Codex.

- Decision: Implement a minimal XLSX reader with Node built-ins instead of adding an npm dependency.
  Rationale: importing one simple worksheet requires only reading zipped XML parts from the `.xlsx` file. Avoiding a new dependency keeps deployment simpler and does not require package installation on the server.
  Date/Author: 2026-04-30 / Codex.

## Outcomes & Retrospective

Completed for code and dry-run validation. The command reads the checked-in workbook, validates 189 product rows across 10 categories, and can import into PostgreSQL once `DATABASE_URL` points to a reachable database. Local full import could not be completed because Docker is not running and no PostgreSQL server is reachable at `localhost:5432`.

## Context and Orientation

The project is a NestJS backend with Prisma and PostgreSQL. The catalog database schema is in `prisma/schema.prisma`. `Category` has a unique `name`, and `Product` has a unique `article`, a required `name`, a required decimal `price`, and an optional `imageUrl`.

The checked-in price list is `docs/majormodelsprice.xlsx`. It currently contains a single worksheet named `Продукция`. Row 1 is the header row. Each product row has category name in column A, article in column B, product name in column C, and price in column D.

This change adds an operational import command, not a public API endpoint. It must use the existing Prisma client directly because it is a server-side maintenance command and not part of the NestJS request path. The runtime command still respects the domain model by writing only `Category` and `Product` rows.

## Plan of Work

Create `scripts/import-catalog.ts`. The script will accept an optional file path argument. If no path is passed, it will read `docs/majormodelsprice.xlsx`. It will parse the workbook, validate required headers, normalize row values, and stop with a clear error if any row has missing category, article, name, or price.

The script will use Prisma transactions in small deterministic steps. For each normalized row, it will upsert the category by name, then upsert the product by article. Product updates will set category, name, price, and optional image URL if a supported image column exists in a future workbook.

Update `package.json` with `catalog:import`. The command should run through `ts-node` so no separate build step is needed on a server checkout.

Update `docs/spec.md` to include the import command in implemented scope and define the workbook contract. Update `release.md` with a new version entry. Update `docs/solutions.md` with the dependency-free XLSX import decision.

## Concrete Steps

From the repository root `/Users/Andrey/Documents/Projects/majormodels`, run:

    npm run catalog:import -- docs/majormodelsprice.xlsx --dry-run

Expected result after implementation: the command parses the workbook, prints how many rows, categories, and products it would import, and exits without writing to the database.

Actual result:

    Catalog dry-run completed
    Rows: 189
    Categories: 10

Then run against a configured PostgreSQL database:

    npm run catalog:import -- docs/majormodelsprice.xlsx

Expected result: the command writes or updates categories and products, prints inserted/updated counts, and exits with code 0.

Actual local result on 2026-04-30: blocked by unavailable PostgreSQL.

    Catalog import failed: Can't reach database server at `localhost:5432`

## Validation and Acceptance

The implementation is accepted when `npm run lint` and `npm run build` both pass. The import parser must also successfully dry-run the checked-in Excel file. Full write validation requires `DATABASE_URL` pointing to a reachable PostgreSQL database; if no database is running locally, dry-run validation is still enough to prove workbook parsing and row normalization.

After a successful non-dry import, `GET /api/v1/categories` should return the imported categories, and `GET /api/v1/products?limit=10` should return products from the workbook.

## Idempotence and Recovery

The import is safe to run repeatedly because it uses unique keys and upsert behavior. Re-running the same workbook updates products to the same values instead of creating duplicates. If a run fails on validation, no database writes should happen. If a run fails during database access, re-running the command is safe because completed rows are upserted again.

The command intentionally does not delete missing rows. Removing products from the catalog should be designed separately because current order history depends on product rows.

## Artifacts and Notes

Workbook preview evidence:

    Sheet: Продукция
    Headers: Категория | Артикул | Наименование | Цена
    First data row: Химия | ММ100 | Клей для моделей супертекучий (Extra thin cement), 30 мл стекло | 270

## Interfaces and Dependencies

Define `scripts/import-catalog.ts` as an executable TypeScript script. It must expose no public library API, but internally it should have small functions for reading XLSX XML parts, extracting rows, validating headers, normalizing prices, and importing with Prisma.

Add this npm script:

    "catalog:import": "ts-node scripts/import-catalog.ts"

The script depends only on Node built-ins and the existing generated Prisma client import path `.prisma/client`.
