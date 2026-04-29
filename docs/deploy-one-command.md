# One-command server bootstrap (curl + git)

verified at 2026-04-29

This method installs missing components on a Linux VM and deploys the project automatically.

## What the script does

`scripts/bootstrap-server.sh` will:

1. detect package manager (`apt`, `dnf`, `yum`)
2. install missing base tools (`curl`, `git`, certificates)
3. install missing `docker` and `docker compose`
4. install missing `node`/`npm` (optional)
5. install missing `postgresql` (optional)
6. clone or update repository from GitHub
7. prepare `.env.production`
8. run deployment:
   `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`

## Quick start (recommended)

Run on server:

```bash
curl -fsSL https://raw.githubusercontent.com/Forspeed911/MajorModels/main/scripts/bootstrap-server.sh | sudo bash
```

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
- `INSTALL_POSTGRESQL` (`1`/`0`, default `1`)
- `SKIP_DEPLOY` (`1`/`0`, default `0`)
- `ALLOW_PLACEHOLDER_ENV` (`1`/`0`, default `0`)

## Notes

- Script is idempotent and can be run repeatedly for updates.
- If `.env.production` still contains placeholders (`replace_me`, `change_me_strong_password`), script stops unless `ALLOW_PLACEHOLDER_ENV=1`.
- For production, use real secrets and avoid placeholder mode.
