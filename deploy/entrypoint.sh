#!/usr/bin/env bash
set -euo pipefail

echo "[wikicat:entrypoint] Node $(node --version)"

wait_for_database() {
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "[wikicat:entrypoint] DATABASE_URL is required."
    return 1
  fi

  local timeout="${DB_WAIT_TIMEOUT_SECONDS:-90}"
  local start
  start="$(date +%s)"

  echo "[wikicat:entrypoint] Waiting for database..."
  while true; do
    if node --input-type=module -e "import postgres from 'postgres'; const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 5 }); await sql\`select 1\`; await sql.end();" >/dev/null 2>&1; then
      echo "[wikicat:entrypoint] Database is ready."
      return 0
    fi

    local now
    now="$(date +%s)"
    if [ $((now - start)) -ge "$timeout" ]; then
      echo "[wikicat:entrypoint] Database did not become ready within ${timeout}s."
      return 1
    fi

    sleep 3
  done
}

run_migrate() {
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "[wikicat:entrypoint] DATABASE_URL is not set. Skipping migrations."
    return 0
  fi

  echo "[wikicat:entrypoint] Applying migrations..."
  if [ -f "apps/api/dist/migrate.js" ]; then
    node apps/api/dist/migrate.js
  elif [ -f "apps/api/dist/db/migrate.js" ]; then
    node apps/api/dist/db/migrate.js
  elif [ -f "apps/api/dist/src/db/migrate.js" ]; then
    node apps/api/dist/src/db/migrate.js
  else
    echo "[wikicat:entrypoint] No compiled migration entry found. Skipping migrations."
    return 0
  fi

  echo "[wikicat:entrypoint] Migrations complete."
}

wait_for_database

if [ "${RUN_MIGRATIONS_ON_STARTUP:-true}" = "true" ]; then
  run_migrate
fi

echo "[wikicat:entrypoint] Starting API on http://${HOST:-0.0.0.0}:${PORT:-3000}..."
exec node apps/api/dist/server.js
