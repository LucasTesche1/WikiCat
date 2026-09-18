# Deploy To RHEL With Podman

Use `podman-compose.yml` as the production base.

## Prerequisites

- RHEL-like host with Podman 4.9+.
- `podman-compose` 1.2+.
- Ports 80 and 443 open.
- DNS name for `WIKICAT_DOMAIN`.

## Setup

```bash
cd /opt
git clone <repo-url> wikicat
cd wikicat
cp .env.example .env
```

Edit `.env`:

- `DB_PASSWORD`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `INIT_ADMIN_EMAIL`
- `INIT_ADMIN_PASSWORD`
- `PUBLIC_BASE_URL`
- `WEB_ORIGIN`
- `WIKICAT_DOMAIN`

Generate secrets:

```bash
openssl rand -hex 32
```

## Start

```bash
podman-compose up -d --build
podman ps
```

API startup waits for DB and runs migrations when `RUN_MIGRATIONS_ON_STARTUP=true`.

## Verify

```bash
curl -k https://localhost/health
```

Then open:

```text
https://<WIKICAT_DOMAIN>/
```

Verify:

- Caddy serves frontend.
- Caddy proxies `/api` and `/health`.
- Login succeeds and survives refresh.
- Attachment upload/download works.
- DB and attachment volumes survive container recreation.

## Volumes

Persistent volumes:

- `wikicat-db-data`
- `wikicat-attachments`
- `wikicat-attachments-large`
- `wikicat-caddy-data`
- `wikicat-caddy-config`

## Logs

```bash
podman logs -f wikicat-api
podman logs -f wikicat-db
podman logs -f wikicat-proxy
```
