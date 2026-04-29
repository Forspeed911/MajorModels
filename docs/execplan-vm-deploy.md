# Prepare production deployment package for external VM

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document is maintained according to `docs/PLANS.md`.

verified at 2026-04-29

## Purpose / Big Picture

After this work, the project can be deployed on a Linux VM using Docker Compose with predictable startup flow: build image, run PostgreSQL, apply Prisma migrations in production mode, and start NestJS API. The deploy package will include environment templates and an operator runbook.

## Progress

- [x] (2026-04-29 19:14Z) Captured deployment scope and wrote execution plan.
- [x] (2026-04-29 19:15Z) Added production containerization files (`Dockerfile`, `.dockerignore`, startup script).
- [x] (2026-04-29 19:15Z) Added production compose stack (`docker-compose.prod.yml`) with healthchecks and persistent volume.
- [x] (2026-04-29 19:15Z) Added runtime env templates for VM deployment.
- [x] (2026-04-29 19:15Z) Added deployment runbook (`docs/deploy-vm.md`) with zero-guess commands.
- [x] (2026-04-29 19:16Z) Ran validation (`npm run prisma:generate`, `npm run lint`, `npm run build`) and summarized constraints.
- [x] (2026-04-29 19:16Z) Updated `docs/solutions.md` and `release.md`.
- [ ] Perform full runtime smoke deployment (`docker compose ... up -d --build` + HTTP checks) on host with active Docker daemon.

## Surprises & Discoveries

- Observation: `docker compose ... config` fails if compose references `env_file: .env.production` and that file does not exist.
  Evidence: compose returned `env file .../.env.production not found`, resolved by creating `.env.production` from template.

- Observation: End-to-end container runtime validation is blocked in current environment when Docker daemon is unavailable.
  Evidence: previously observed Docker socket error (`.../.docker/run/docker.sock: connect: no such file or directory`) for compose startup commands.

## Decision Log

- Decision: Use Docker Compose as primary deployment path for VM.
  Rationale: It bundles app + database + restart policies and is the fastest reliable path for single-VM production rollout.
  Date/Author: 2026-04-29 / Codex

- Decision: Execute Prisma production migrations inside API container startup script before app boot.
  Rationale: Guarantees schema is applied at deploy time without separate manual step; uses `prisma migrate deploy` production-safe path.
  Date/Author: 2026-04-29 / Codex

- Decision: Keep production deployment files additive and explicit (`docker-compose.prod.yml`, `.env.production.example`, runbook) instead of overloading dev compose file.
  Rationale: Reduces operator mistakes and keeps local development and VM deployment concerns separated.
  Date/Author: 2026-04-29 / Codex

## Outcomes & Retrospective

Production deployment package is implemented and compile-validated. Compose configuration is syntactically validated with `.env.production`. Remaining gap is live `docker compose up --build` runtime check on an environment where Docker daemon is active.

## Context and Orientation

Current codebase already has:

- NestJS app with global prefix `/api/v1` in `src/main.ts`
- Prisma schema and SQL migration in `prisma/schema.prisma` and `prisma/migrations/*`
- Catalog read API modules under `src/modules/catalog/*`

What is missing for VM rollout is deployment infrastructure: production image build, startup orchestration, migration execution in production, and run instructions.

## Plan of Work

First, create a multi-stage `Dockerfile` for build and runtime stages. Runtime will include the Prisma client artifacts and a startup script that executes `prisma migrate deploy` and then starts the app.

Second, add `.dockerignore` to keep image context small and stable.

Third, add `docker-compose.prod.yml` with two services (`api`, `db`), persistent DB volume, health checks, and dependency ordering.

Fourth, add `.env` template for production values used by compose.

Fifth, write `docs/deploy-vm.md` with exact commands for first deploy, update deploy, health check, and rollback basics.

Finally, run compile-time checks and update solution/release logs.

## Concrete Steps

From repository root (`/Users/Andrey/Documents/Projects/majormodels`):

1. Create deployment files and scripts.
2. Run validation commands:
   - `npm run prisma:generate`
   - `npm run lint`
   - `npm run build`
3. (If Docker daemon available) run:
   - `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`
   - `curl -i http://127.0.0.1:3000/api/v1/health`

Executed during implementation:

- `npm run prisma:generate` (success)
- `npm run lint` (success)
- `npm run build` (success)
- `docker compose -f docker-compose.prod.yml --env-file .env.production config` (success, after creating `.env.production`)

## Validation and Acceptance

Acceptance criteria:

- Production image builds successfully. (pending runtime validation on Docker-enabled host)
- App startup executes `prisma migrate deploy` before `node dist/main.js`. (implemented in `scripts/start-prod.sh`)
- Compose stack defines persistent PostgreSQL storage and restart policies. (implemented)
- Runbook exists and includes complete deployment commands. (implemented)
- TypeScript and Prisma generate checks pass. (completed)

## Idempotence and Recovery

Deployment files are additive and safe to re-run. Compose restart is idempotent. If deploy fails after image build, previous container can be restored by re-running compose with previous image tag.

## Artifacts and Notes

Primary artifacts created:

- `Dockerfile`
- `.dockerignore`
- `scripts/start-prod.sh`
- `docker-compose.prod.yml`
- `.env.production.example`
- `docs/deploy-vm.md`

Validation evidence:

    > npm run prisma:generate
    ✔ Generated Prisma Client (v6.19.3)

    > npm run lint
    > tsc -p tsconfig.json --noEmit

    > npm run build
    > tsc -p tsconfig.build.json

    docker compose -f docker-compose.prod.yml --env-file .env.production config
    (rendered config with services `api` and `db` and healthchecks)

## Interfaces and Dependencies

Deployment dependencies to formalize:

- Docker Engine + Docker Compose plugin on VM
- `.env.production` values (`DATABASE_URL`, `POSTGRES_*`, `TELEGRAM_*`, `PORT`)
- Prisma migration history directory in source (`prisma/migrations`)

Script interfaces to exist:

- container startup command calling `prisma migrate deploy`
- API health endpoint `/api/v1/health` for readiness checks

Revision note (2026-04-29): updated plan after implementation with completed steps, runtime validation blocker details, and evidence from validation commands.
