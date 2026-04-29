# Add one-command server bootstrap and deploy script (curl + git)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document is maintained according to `docs/PLANS.md`.

verified at 2026-04-29

## Purpose / Big Picture

After this change, a fresh Linux server can bootstrap and deploy the project with one command executed via `curl`. The bootstrap script installs missing runtime components (`docker`, `node`, `postgresql`, plus required utilities), synchronizes the repository via `git`, prepares environment files, and starts the production stack.

## Progress

- [x] (2026-04-29 19:27Z) Captured the deployment automation scope and constraints.
- [x] (2026-04-29 19:34Z) Implemented `scripts/bootstrap-server.sh` for dependency checks/installation and deployment flow.
- [x] (2026-04-29 19:35Z) Documented one-command usage and parameters (`docs/deploy-one-command.md`, `docs/deploy-vm.md` update).
- [x] (2026-04-29 19:35Z) Validated script syntax and project build checks.
- [x] (2026-04-29 19:36Z) Updated `docs/solutions.md` and `release.md`.

## Surprises & Discoveries

- Observation: Raw bootstrap path cannot rely on interactive prompts in `curl | bash` mode.
  Evidence: Script design uses environment variables (`ENV_FILE_URL`, `ALLOW_PLACEHOLDER_ENV`, etc.) for non-interactive control.

- Observation: For safety, auto-generated env files can accidentally keep placeholder secrets.
  Evidence: Added explicit guard that blocks deploy when placeholder markers are found unless `ALLOW_PLACEHOLDER_ENV=1`.

## Decision Log

- Decision: Implement bootstrap in Bash and target Linux package managers (`apt`, `dnf`, `yum`).
  Rationale: This maximizes compatibility with common VM images and keeps dependencies minimal.
  Date/Author: 2026-04-29 / Codex

- Decision: Keep bootstrap idempotent and rerunnable for both first install and updates.
  Rationale: Same command should handle clean servers and existing deployments without extra branching for operators.
  Date/Author: 2026-04-29 / Codex

- Decision: Fail deployment on placeholder secrets by default.
  Rationale: Secure-by-default behavior is safer for production operations; override remains available for test setups.
  Date/Author: 2026-04-29 / Codex

## Outcomes & Retrospective

One-command bootstrap/deploy is implemented and documented. Syntax/build validations pass. The flow now supports repeatable server provisioning and deployment from GitHub Raw URL with configurable non-interactive parameters.

## Context and Orientation

Current repository already supports production deploy via `docker-compose.prod.yml` and `docs/deploy-vm.md`, but still requires manual package setup on a VM. We need a script that can be launched remotely from GitHub Raw URL and handles prerequisites + deployment idempotently.

## Plan of Work

First, implement `scripts/bootstrap-server.sh` to detect/install prerequisites, then clone/pull repository and run production compose deployment. The script must support configuration through environment variables so it can be used in one-liner command forms.

Second, update deployment documentation with exact one-command examples (with optional env file URL).

Third, run script syntax checks and existing build checks.

Finally, update project logs.

## Concrete Steps

From repository root (`/Users/Andrey/Documents/Projects/majormodels`):

1. Add bootstrap script and docs updates.
2. Run:
   - `bash -n scripts/bootstrap-server.sh`
   - `npm run lint`
   - `npm run build`
3. Provide one-line command example:
   - `curl -fsSL <raw-bootstrap-url> | bash`

Executed during implementation:

- `bash -n scripts/bootstrap-server.sh` (success)
- `npm run lint` (success)
- `npm run build` (success)

## Validation and Acceptance

Acceptance criteria:

- Script supports Linux and handles `apt`/`dnf`/`yum`.
- Script installs missing `docker`, `node`, `postgresql`, `git`, `curl`.
- Script syncs repo and runs production compose deploy command.
- Docs include one-command execution examples.
- TypeScript build checks stay green.

## Idempotence and Recovery

Script is designed to be rerunnable: if tools already installed, checks skip installation; if repo exists, script runs pull/update path. Recovery for failed deploy is re-running script after fixing the failing dependency.

## Artifacts and Notes

Created artifacts:

- `scripts/bootstrap-server.sh`
- `docs/deploy-one-command.md`
- Updated `docs/deploy-vm.md` with one-command section

Validation evidence:

    $ bash -n scripts/bootstrap-server.sh
    bootstrap_syntax_ok

    > npm run lint
    > tsc -p tsconfig.json --noEmit

    > npm run build
    > tsc -p tsconfig.build.json

## Interfaces and Dependencies

New interface:

- `scripts/bootstrap-server.sh` (entrypoint for remote install/deploy)

Important environment variables:

- `REPO_URL`, `REPO_BRANCH`, `PROJECT_DIR`
- `ENV_FILE_URL`, `ENV_FILE_PATH`
- `INSTALL_NODE`, `INSTALL_POSTGRESQL`, `SKIP_DEPLOY`

Revision note (2026-04-29): marked implementation complete, added decisions/discoveries from bootstrap design, and appended validation evidence.
