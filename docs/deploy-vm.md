# VM Deployment Guide (Docker Compose)

verified at 2026-04-30

## 0. One-command bootstrap option

If you want full bootstrap + deploy in one command, use:

```bash
curl -fsSL https://raw.githubusercontent.com/Forspeed911/MajorModels/main/scripts/bootstrap-server.sh | sudo bash
```

Installer will ask interactively for:
- `POSTGRES_PASSWORD`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`

Detailed parameters are documented in `docs/deploy-one-command.md`.

## 1. VM prerequisites

Install on VM:

- Docker Engine
- Docker Compose plugin (`docker compose`)

Check:

```bash
docker --version
docker compose version
```

## 2. Upload project to VM

Copy repository to VM, for example to `/opt/majormodels`.

## 3. Prepare production env

In project root on VM:

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and set strong secrets:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`
- `TELEGRAM_BACKEND_BASE_URL` (optional, default `http://127.0.0.1:${PORT}/api/v1`)

## 4. First deploy

Run in project root:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

What happens:

1. PostgreSQL container starts.
2. API container starts after DB is healthy.
3. API entrypoint runs `prisma migrate deploy`.
4. API starts with `node dist/main.js`.

## 5. Health checks

API health:

```bash
curl -i http://127.0.0.1:3000/api/v1/health
```

Compose status:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

Logs:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f api
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f db
```

## 6. Update deploy

After code update on VM:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

`prisma migrate deploy` will apply only pending migrations.

## 7. Stop / start

Stop:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production down
```

Start:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## 8. Data persistence

PostgreSQL data is stored in Docker volume `postgres_data_prod`.
It survives container recreation.

## 9. Minimal rollback

If a new deploy is bad:

1. Roll back code to previous commit/tag on VM.
2. Rebuild and restart stack:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

If schema migration already changed DB, rollback requires dedicated reverse migration.
