# Improve one-command bootstrap with interactive secrets and same-server DB defaults

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document is maintained according to `docs/PLANS.md`.

verified at 2026-04-30

## Purpose / Big Picture

After this change, a user can run the existing one-command installer on a Linux VM and provide required secrets during installation without manually editing files first. The database remains on the same server via Docker Compose (`db` service), and generated env settings consistently target that local DB.

## Progress

- [x] (2026-04-30 09:40Z) Reviewed current bootstrap flow and identified secret input limitations in piped execution.
- [x] (2026-04-30 09:46Z) Implemented `/dev/tty` interactive secret prompts and env update helpers in `scripts/bootstrap-server.sh`.
- [x] (2026-04-30 09:50Z) Added same-server DB URL generation and defaulted host PostgreSQL installation to optional-off (`INSTALL_POSTGRESQL=0`).
- [x] (2026-04-30 09:55Z) Updated docs (`docs/deploy-one-command.md`, `docs/deploy-vm.md`, `docs/spec.md`, `docs/solutions.md`, `release.md`).
- [x] (2026-04-30 09:57Z) Validated installer script syntax with `bash -n scripts/bootstrap-server.sh`.

## Surprises & Discoveries

- Observation: Installer prompts must read from `/dev/tty` to work reliably in `curl | bash` flow.
  Evidence: Regular stdin reads are not appropriate because stdin is consumed by the piped script content.

## Decision Log

- Decision: Keep prompts enabled by default and gate them with `PROMPT_FOR_SECRETS=1|0`.
  Rationale: Interactive mode is the safest default for first-time setup; automation can disable prompts explicitly.
  Date/Author: 2026-04-30 / Codex

- Decision: Keep host PostgreSQL installation optional and disabled by default.
  Rationale: Project DB is already deployed as `db` container in production compose stack; host package install is not required for standard path.
  Date/Author: 2026-04-30 / Codex

## Outcomes & Retrospective

Bootstrap now supports guided secret entry and deterministic same-server DB configuration in one run. Remaining operational requirement is runtime verification on a real VM with real credentials.

## Context and Orientation

The installer is implemented in `scripts/bootstrap-server.sh` and is invoked from docs through `curl -fsSL ... | sudo bash`. Production compose stack (`docker-compose.prod.yml`) already contains both `api` and `db` services. The change focuses on env preparation and first-run credential handling, not on app runtime logic.

## Plan of Work

Add env helper utilities to read/update key-value pairs, add secure prompt functions that read from `/dev/tty`, and extend env preparation so placeholder credentials are replaced during install. Then document new behavior and update release notes.

## Concrete Steps

From repository root (`/Users/Andrey/Documents/Projects/majormodels`):

1. Edit `scripts/bootstrap-server.sh`:
   - add prompt and env helper functions
   - add placeholder detection and secret prompts
   - add local `DATABASE_URL` generation to `db:5432`
2. Update docs and release notes.
3. Run:
   - `bash -n scripts/bootstrap-server.sh`

## Validation and Acceptance

Acceptance criteria:

- Running installer in interactive terminal prompts for missing `POSTGRES_PASSWORD`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_ADMIN_CHAT_ID`.
- Placeholder values are removed from resulting env file.
- `DATABASE_URL` points to compose DB service (`db:5432`).
- Script syntax check passes.

## Idempotence and Recovery

Installer remains idempotent: repeated runs pull latest code and redeploy stack. If prompts are undesired for automation, operator can set `PROMPT_FOR_SECRETS=0` and provide complete env file beforehand.

## Artifacts and Notes

- Validation output:
  - `bash -n scripts/bootstrap-server.sh` -> `OK`

## Interfaces and Dependencies

Primary interface:

- `scripts/bootstrap-server.sh` env vars:
  - `PROMPT_FOR_SECRETS` (new)
  - existing `INSTALL_POSTGRESQL`, `ENV_FILE_URL`, `ALLOW_PLACEHOLDER_ENV`, `SKIP_DEPLOY`, etc.

Revision note (2026-04-30): Initial plan added and finalized in same work cycle after implementation and validation.
