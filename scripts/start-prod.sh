#!/bin/sh
set -eu

echo "[entrypoint] Running Prisma migrations (migrate deploy)"
attempt=0
max_attempts="${DB_MIGRATION_MAX_ATTEMPTS:-20}"
retry_seconds="${DB_MIGRATION_RETRY_SECONDS:-3}"

until ./node_modules/.bin/prisma migrate deploy; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "[entrypoint] Prisma migrate deploy failed after ${max_attempts} attempts"
    exit 1
  fi

  echo "[entrypoint] Migration attempt ${attempt}/${max_attempts} failed, retrying in ${retry_seconds}s"
  sleep "$retry_seconds"
done

echo "[entrypoint] Starting API"
exec node dist/main.js
