# Split Repository Deployment

Each directory can become its own repository:

- `front-end/`
- `back-end/`
- `db/`
- `proxy/`

Build and push each image independently:

```bash
docker build -t registry.example.com/wikicat-front-end:latest ./front-end
docker build -t registry.example.com/wikicat-back-end:latest ./back-end
docker build -t registry.example.com/wikicat-db:latest ./db
docker build -t registry.example.com/wikicat-proxy:latest ./proxy
```

Deploy pulled images with:

```bash
WIKICAT_FRONT_END_IMAGE=registry.example.com/wikicat-front-end:latest \
WIKICAT_BACK_END_IMAGE=registry.example.com/wikicat-back-end:latest \
WIKICAT_DB_IMAGE=registry.example.com/wikicat-db:latest \
WIKICAT_PROXY_IMAGE=registry.example.com/wikicat-proxy:latest \
docker compose -f docker-compose.images.yml up -d
```

Service DNS contract:

- `proxy` routes to `front-end:8080`
- `proxy` routes `/api/*` and `/health` to `back-end:3000`
- `back-end` connects to `db:5432`

For a different server layout, keep those DNS names or edit `proxy/Caddyfile` and `DATABASE_URL`.
