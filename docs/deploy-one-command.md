# One-command server bootstrap (curl + git)

verified at 2026-04-30

This method installs missing components on a Linux VM and deploys the project automatically.
Database runs on the same server in Docker (`db` service from `docker-compose.prod.yml`).

## What the script does

`scripts/bootstrap-server.sh` will:

1. detect package manager (`apt`, `dnf`, `yum`)
2. install missing base tools (`curl`, `git`, certificates)
3. install missing `docker` and `docker compose`
4. install missing `node`/`npm` (optional)
5. install missing host `postgresql` tools (optional, disabled by default)
6. clone or update repository from GitHub
7. prepare `.env.production` for local same-server DB (`DATABASE_URL` -> `db:5432`)
8. request secrets interactively on first setup:
   - `POSTGRES_PASSWORD`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ADMIN_CHAT_ID`
9. create persistent external Docker volume for DB data (`DB_VOLUME_NAME`)
10. run deployment:
   `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`

## Quick start (recommended)

Run on server:

```bash
curl -fsSL https://raw.githubusercontent.com/Forspeed911/MajorModels/main/scripts/bootstrap-server.sh | sudo bash
```

During this command, installer asks for Telegram credentials and DB password in interactive mode.

## With custom configuration

Example with custom target path and branch:

```bash
curl -fsSL https://raw.githubusercontent.com/Forspeed911/MajorModels/main/scripts/bootstrap-server.sh | \
  sudo REPO_BRANCH=main PROJECT_DIR=/opt/majormodels bash
```

Example with ready environment file URL:

```bash
curl -fsSL https://raw.githubusercontent.com/Forspeed911/MajorModels/main/scripts/bootstrap-server.sh | \
  sudo ENV_FILE_URL="https://example.com/majormodels.env" bash
```

## Supported env variables

- `REPO_URL` (default `https://github.com/Forspeed911/MajorModels.git`)
- `REPO_BRANCH` (default `main`)
- `PROJECT_DIR` (default `/opt/majormodels`)
- `ENV_FILE_PATH` (default `.env.production`)
- `ENV_FILE_URL` (optional URL for env file download)
- `INSTALL_NODE` (`1`/`0`, default `1`)
- `INSTALL_POSTGRESQL` (`1`/`0`, default `0`)
- `SKIP_DEPLOY` (`1`/`0`, default `0`)
- `ALLOW_PLACEHOLDER_ENV` (`1`/`0`, default `0`)
- `PROMPT_FOR_SECRETS` (`1`/`0`, default `1`)
- `DB_VOLUME_NAME` (default `majormodels_postgres_data_prod`)

## Notes

- Script is idempotent and can be run repeatedly for updates.
- If `.env.production` contains placeholders, script asks for values (when `PROMPT_FOR_SECRETS=1`).
- If interactive input is disabled/unavailable and placeholders remain, script stops unless `ALLOW_PLACEHOLDER_ENV=1`.
- For production, use real secrets and avoid placeholder mode.
- To force bot API routing through a specific host, set `TELEGRAM_BACKEND_BASE_URL` in `.env.production`.
- Auto-generated `DATABASE_URL` requires URL-safe password characters (`A-Z a-z 0-9 . _ ~ -`).
- DB storage uses external volume `DB_VOLUME_NAME`, so `docker compose down -v` does not remove DB data.
