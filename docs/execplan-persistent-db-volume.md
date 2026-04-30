# Protect PostgreSQL data with external persistent Docker volume

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document is maintained according to `docs/PLANS.md`.

verified at 2026-04-30

## Purpose / Big Picture

After this change, production DB storage no longer depends on the compose-managed lifecycle of the app stack. PostgreSQL data is stored in an external named Docker volume that survives `docker compose down -v`, and bootstrap flow guarantees volume presence before deploy.

## Progress

- [x] (2026-04-30 10:09Z) Reviewed current compose volume behavior and bootstrap flow.
- [x] (2026-04-30 10:14Z) Switched production compose DB volume to external named volume (`DB_VOLUME_NAME`).
- [x] (2026-04-30 10:18Z) Added bootstrap logic to set default `DB_VOLUME_NAME` and create volume automatically before deploy.
- [x] (2026-04-30 10:21Z) Updated env templates and deployment docs/spec/release/solutions.
- [x] (2026-04-30 10:23Z) Validated with `bash -n scripts/bootstrap-server.sh` and `docker compose ... config`.

## Surprises & Discoveries

- Observation: External volumes are explicitly excluded from compose `down` removal behavior.
  Evidence: Docker CLI docs for `docker compose down` state that external volumes are never removed.

## Decision Log

- Decision: Use external named volume instead of bind mount path.
  Rationale: Keeps portability and host-path independence while still decoupling data lifecycle from compose stack lifecycle.
  Date/Author: 2026-04-30 / Codex

- Decision: Keep volume name configurable via env (`DB_VOLUME_NAME`) with stable default.
  Rationale: Supports multiple environments on one host and predictable operations tooling.
  Date/Author: 2026-04-30 / Codex

## Outcomes & Retrospective

Production DB persistence is now materially safer for operational teardown scenarios. Remaining risk is manual destructive Docker operations (`docker volume rm`/`docker system prune --volumes`) that must be controlled by operator policy.

## Context and Orientation

Before this change, PostgreSQL used a compose-declared named volume in `docker-compose.prod.yml`. This could conflict with strict persistence requirements when operators used destructive compose cleanup options. Bootstrap already prepared env and deployed compose stack; it now also ensures persistent external volume creation.

## Plan of Work

Update compose volume definition to `external: true` with explicit `name` bound to env var, then extend bootstrap to populate `DB_VOLUME_NAME` and create the volume if missing. Finally, document new behavior and operator expectations.

## Concrete Steps

From repository root (`/Users/Andrey/Documents/Projects/majormodels`):

1. Edit `docker-compose.prod.yml` volumes section.
2. Edit `scripts/bootstrap-server.sh`:
   - set default volume variable
   - ensure env file has `DB_VOLUME_NAME`
   - add `ensure_database_volume` before deploy
3. Update `.env.production.example`, `.env.example`, and docs.
4. Run validation:
   - `bash -n scripts/bootstrap-server.sh`
   - `docker compose -f docker-compose.prod.yml --env-file .env.production config`

## Validation and Acceptance

Acceptance criteria:

- compose file references external DB volume by name.
- bootstrap creates volume automatically when absent.
- env templates include `DB_VOLUME_NAME`.
- static config render and shell syntax checks pass.

## Idempotence and Recovery

Repeated bootstrap runs are safe: existing volume is detected and reused. Recovery from accidental container deletion uses the same volume by name. If volume itself is manually deleted, bootstrap recreates an empty volume and DB must be restored from backup.

## Artifacts and Notes

- Validation output:
  - `bash -n scripts/bootstrap-server.sh` -> `bootstrap_ok`
  - `docker compose -f docker-compose.prod.yml --env-file .env.production config` -> `compose_config_ok`

## Interfaces and Dependencies

Files touched:

- `docker-compose.prod.yml`
- `scripts/bootstrap-server.sh`
- `.env.production.example`
- `.env.example`

Configuration interface:

- `DB_VOLUME_NAME` env var (default `majormodels_postgres_data_prod`)

Revision note (2026-04-30): Plan added and finalized after implementation and validation in the same iteration.
