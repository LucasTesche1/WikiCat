# Deploy WikiCat To Railway

This guide deploys WikiCat as a Railway POC with three services:

- `wikicat-api`: Fastify API, migrations, and attachment storage.
- `wikicat-web`: Nginx static frontend, public domain, and same-origin `/api` proxy.
- `Postgres`: Railway managed database.

The browser only talks to `wikicat-web`. `wikicat-web` proxies `/api` and `/health` to `wikicat-api`, so auth cookies stay same-origin.

## 1. Push The Repository

Push this monorepo to GitHub. Railway deploys each service from the same repo, but with different Dockerfiles:

- API Dockerfile: `deploy/railway/api.Dockerfile`
- Web Dockerfile: `deploy/railway/web.Dockerfile`

## 2. Create The Railway Project

1. Open Railway.
2. Create a new project.
3. Choose **Deploy from GitHub repo**.
4. Select the WikiCat repository.
5. If Railway auto-detects several monorepo services, keep only the services you need, or rename them to match this guide.

Railway supports shared JavaScript monorepos, but this repo uses explicit Dockerfiles so each service builds the correct target.

## 3. Add Postgres

1. In the project canvas, click **New**.
2. Add **Database**.
3. Choose **PostgreSQL**.
4. Wait until Postgres is ready.

Prefer the private Postgres URL for the API. Railway private networking keeps database traffic inside Railway.

## 4. Create The API Service

1. Add another service from the same GitHub repo.
2. Rename it to `wikicat-api`.
3. Open `wikicat-api` settings.
4. Set the Dockerfile path to:

```text
deploy/railway/api.Dockerfile
```

5. Set the service port to `3000` if Railway asks for a port.
6. Add a Railway volume.
7. Mount the volume at:

```text
/attachments
```

If Railway allows a second volume, add one more volume mounted at `/attachments-large`. If only one volume is available for the POC, use `/attachments` for both storage classes:

```env
ATTACHMENTS_DIR=/attachments
ATTACHMENTS_LARGE_DIR=/attachments/large
```

Create the nested `large` directory by uploading one large attachment after deploy, or by temporarily opening a Railway shell and running:

```bash
mkdir -p /attachments/large
```

## 5. Configure API Variables

In `wikicat-api` variables, add:

```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

DATABASE_URL=<Railway Postgres private URL>

JWT_SECRET=<64+ random chars>
COOKIE_SECRET=<64+ random chars>
SESSION_MAX_AGE_SECONDS=604800

PUBLIC_BASE_URL=https://<wikicat-web-public-domain>
WEB_ORIGIN=https://<wikicat-web-public-domain>

ATTACHMENTS_DIR=/attachments
ATTACHMENTS_LARGE_DIR=/attachments-large
MAX_ATTACHMENT_STANDARD_MB=20
MAX_ATTACHMENT_LARGE_MB=2048

INIT_ADMIN_EMAIL=admin@example.com
INIT_ADMIN_PASSWORD=<strong temporary password>
INIT_ADMIN_NAME=WikiCat Admin

RUN_MIGRATIONS_ON_STARTUP=true
DB_WAIT_TIMEOUT_SECONDS=180
```

If you used one volume, set:

```env
ATTACHMENTS_DIR=/attachments
ATTACHMENTS_LARGE_DIR=/attachments/large
```

Only set this when using a public Postgres URL:

```env
DB_SSL_MODE=require
```

Generate secrets locally:

```bash
openssl rand -hex 32
```

On Windows PowerShell:

```powershell
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

## 6. Create The Web Service

1. Add another service from the same GitHub repo.
2. Rename it to `wikicat-web`.
3. Open `wikicat-web` settings.
4. Set the Dockerfile path to:

```text
deploy/railway/web.Dockerfile
```

5. Set the service port to `8080` if Railway asks for a port.
6. Generate a Railway domain for `wikicat-web`.
7. Copy the public domain.
8. Return to `wikicat-api` and update:

```env
PUBLIC_BASE_URL=https://<wikicat-web-public-domain>
WEB_ORIGIN=https://<wikicat-web-public-domain>
```

## 7. Configure Web Variables

In `wikicat-web` variables, add:

```env
PORT=8080
WIKICAT_API_URL=http://wikicat-api.railway.internal:3000
```

If Railway shows a different private domain for the API service, use that exact value. It must include protocol and port:

```env
WIKICAT_API_URL=http://<api-private-host>:3000
```

Do not point the browser frontend directly at the API public domain. Keep browser traffic same-origin through `wikicat-web`.

## 8. Deploy Order

Deploy in this order:

1. Postgres.
2. `wikicat-api`.
3. `wikicat-web`.

`wikicat-api` waits for Postgres before starting. With `RUN_MIGRATIONS_ON_STARTUP=true`, it runs migrations automatically during startup.

## 9. Verify The Deployment

Open:

```text
https://<wikicat-web-public-domain>/
```

Check health:

```text
https://<wikicat-web-public-domain>/health
```

Expected shape:

```json
{
  "status": "ok",
  "db": "ok"
}
```

Then verify:

1. Login with `INIT_ADMIN_EMAIL` and `INIT_ADMIN_PASSWORD`.
2. Refresh the browser.
3. Open `/api/auth/me` from the same web domain.
4. Confirm the session persists.
5. Upload an attachment.
6. Download the attachment.
7. Restart `wikicat-api`.
8. Download the same attachment again.

## 10. Troubleshooting

### API cannot connect to Postgres

Check `wikicat-api` logs. If the hostname is `localhost`, the database URL is wrong. Use Railway Postgres connection variables, preferably the private URL.

### Web loads, but `/api` fails

Check `wikicat-web` variable:

```env
WIKICAT_API_URL=http://wikicat-api.railway.internal:3000
```

Then check the API service name and private host in Railway.

### Login works, then refresh logs out

Check:

```env
PUBLIC_BASE_URL=https://<wikicat-web-public-domain>
WEB_ORIGIN=https://<wikicat-web-public-domain>
```

The values must match the public web domain exactly.

### Uploads disappear after redeploy

The API service volume is missing or mounted at the wrong path. Confirm the volume mount and these variables:

```env
ATTACHMENTS_DIR=/attachments
ATTACHMENTS_LARGE_DIR=/attachments-large
```

### Migrations run repeatedly

This is safe when migrations are idempotent. After the POC is stable, you can set:

```env
RUN_MIGRATIONS_ON_STARTUP=false
```

Then run migrations manually during releases.

## 11. Useful Railway Docs

- Dockerfiles: https://docs.railway.com/builds/dockerfiles
- Monorepos: https://docs.railway.com/deployments/monorepo
- Private networking: https://docs.railway.com/networking/private-networking
- Volumes: https://docs.railway.com/volumes
- PostgreSQL: https://docs.railway.com/databases/postgresql
