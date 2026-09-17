#!/usr/bin/env bash
set -euo pipefail

echo "[wikicat:entrypoint] Node $(node --version)"

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

if [ "${RUN_MIGRATIONS_ON_STARTUP:-true}" = "true" ]; then
  run_migrate
fi

echo "[wikicat:entrypoint] Starting API on http://${HOST:-0.0.0.0}:${PORT:-3000}..."
exec node apps/api/dist/server.js
