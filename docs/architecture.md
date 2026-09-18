# WikiCat Architecture

WikiCat uses the monorepo as the source of truth.

- `apps/api`: Fastify API, authentication, migrations, attachment storage, health checks.
- `apps/web`: React/Vite UI. Browser requests use same-origin `/api`.
- `packages/shared`: shared API contracts, types, and markdown utilities.
- `deploy/`: runtime infrastructure for Railway and Podman/RHEL.

`front-end/`, `back-end/`, `db/`, and `proxy/` are legacy split-repo experiments. Keep them only while migrating useful Docker, Nginx, and Caddy pieces into the monorepo. After Railway and Podman deployments are verified, remove the duplicated directories so there is one deploy path.

## Runtime Shape

Railway POC uses separate services:

- `wikicat-api`: Node/Fastify service. Starts on `0.0.0.0:$PORT`, waits for Postgres, runs migrations when `RUN_MIGRATIONS_ON_STARTUP=true`, and stores attachments on mounted volumes.
- `wikicat-web`: Nginx static service. Serves `apps/web/dist` and proxies `/api` plus `/health` to `wikicat-api`.
- `postgres`: Railway managed Postgres.

RHEL/Podman production uses the same logical separation:

- `proxy`: Caddy public entrypoint for TLS, security headers, frontend delivery, `/api`, and `/health`.
- `api`: Fastify runtime service.
- `db`: Postgres.
- Named volumes for Postgres and attachments.

## Browser/API Contract

Frontend calls `/api`. Web/proxy owns same-origin routing. Auth cookies stay simple: `httpOnly`, `secure` in production, `sameSite=lax`. Avoid cross-domain browser cookies between separate Railway domains.
