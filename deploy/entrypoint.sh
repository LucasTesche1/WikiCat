#!/usr/bin/env bash
set -euo pipefail

echo "[wikicat:entrypoint] Node $(node --version)"

run_migrate() {
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "[wikicat:entrypoint] ⚠ DATABASE_URL não definida. Pulando migrations."
    return 0
  fi
  echo "[wikicat:entrypoint] Aplicando migrations (drizzle ./apps/api/drizzle)..."
  local ok=0
  if [ -f "apps/api/dist/migrate.js" ]; then
    node apps/api/dist/migrate.js && ok=1
  elif [ -f "apps/api/dist/db/migrate.js" ]; then
    node apps/api/dist/db/migrate.js && ok=1
  elif [ -f "apps/api/dist/src/db/migrate.js" ]; then
    node apps/api/dist/src/db/migrate.js && ok=1
  fi
  if [ "$ok" -eq 0 ]; then
    echo "[wikicat:entrypoint] Nenhum .js pré-compilado encontrado; tentando tsx..."
    if [ -x "node_modules/.bin/tsx" ]; then
      node_modules/.bin/tsx apps/api/src/db/migrate.ts && ok=1
    elif [ -x "apps/api/node_modules/.bin/tsx" ]; then
      apps/api/node_modules/.bin/tsx apps/api/src/db/migrate.ts && ok=1
    fi
  fi
  if [ "$ok" -eq 0 ]; then
    echo "[wikicat:entrypoint] ⚠ Falhou aplicar migrations. Rode manualmente:"
    echo "   docker exec -it wikicat-app sh -c 'cd /app && ./node_modules/.bin/tsx apps/api/src/db/migrate.ts'"
    return 1
  fi
  echo "[wikicat:entrypoint] Migrations finalizadas."
}

if [ "${RUN_MIGRATIONS_ON_STARTUP:-true}" = "true" ]; then
  run_migrate || true
fi

echo "[wikicat:entrypoint] Iniciando WikiCat API em http://${HOST:-0.0.0.0}:${PORT:-3000}..."
exec node apps/api/dist/server.js
