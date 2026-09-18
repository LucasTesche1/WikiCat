#!/usr/bin/env bash
set -euo pipefail

echo "[wikicat:entrypoint] Node $(node --version)"

resolve_database_url() {
  if [ -n "${DATABASE_PRIVATE_URL:-}" ]; then
    export DATABASE_URL="$DATABASE_PRIVATE_URL"
    echo "[wikicat:entrypoint] Using DATABASE_PRIVATE_URL."
  elif [ -n "${DATABASE_URL:-}" ]; then
    echo "[wikicat:entrypoint] Using DATABASE_URL."
  elif [ -n "${DATABASE_PUBLIC_URL:-}" ]; then
    export DATABASE_URL="$DATABASE_PUBLIC_URL"
    echo "[wikicat:entrypoint] Using DATABASE_PUBLIC_URL."
  else
    echo "[wikicat:entrypoint] No database URL set. Expected DATABASE_PRIVATE_URL, DATABASE_URL, or DATABASE_PUBLIC_URL."
    return 1
  fi

  node --input-type=module -e "const url = new URL(process.env.DATABASE_URL); console.log(\`[wikicat:entrypoint] Database target: \${url.protocol}//\${url.hostname}:\${url.port || '5432'}\${url.pathname}\`); if (process.env.NODE_ENV === 'production' && ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) { console.error('[wikicat:entrypoint] Invalid production DATABASE_URL: localhost points to the app container, not Railway Postgres. Use Railway Postgres connection variables, preferably DATABASE_PRIVATE_URL.'); process.exit(1); }"
}

wait_for_database() {
  resolve_database_url

  local timeout="${DB_WAIT_TIMEOUT_SECONDS:-180}"
  local start
  local last_error=""
  start="$(date +%s)"

  echo "[wikicat:entrypoint] Waiting for database..."
  while true; do
    if last_error="$(node --input-type=module -e "import postgres from 'postgres'; const sslMode = process.env.DB_SSL_MODE || process.env.PGSSLMODE; const opts = { max: 1, connect_timeout: 5, ...(sslMode === 'require' ? { ssl: 'require' } : {}) }; const sql = postgres(process.env.DATABASE_URL, opts); await sql\`select 1\`; await sql.end();" 2>&1 >/dev/null)"; then
      echo "[wikicat:entrypoint] Database is ready."
      return 0
    fi

    local now
    now="$(date +%s)"
    if [ $((now - start)) -ge "$timeout" ]; then
      echo "[wikicat:entrypoint] Database did not become ready within ${timeout}s."
      echo "[wikicat:entrypoint] Last database error: ${last_error}"
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
  if [ -f "dist/migrate.js" ]; then
    node dist/migrate.js
  elif [ -f "dist/db/migrate.js" ]; then
    node dist/db/migrate.js
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
exec node dist/server.js
