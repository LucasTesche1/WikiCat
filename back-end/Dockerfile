# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml ./
COPY shared ./shared
RUN pnpm install --no-frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV RUN_MIGRATIONS_ON_STARTUP=true
ENV DB_WAIT_TIMEOUT_SECONDS=180
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl tini \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 1001 wikicat \
 && useradd --uid 1001 --gid wikicat --shell /bin/bash --create-home wikicat
COPY --from=builder --chown=wikicat:wikicat /app/package.json ./
COPY --from=builder --chown=wikicat:wikicat /app/node_modules ./node_modules
COPY --from=builder --chown=wikicat:wikicat /app/shared/package.json ./shared/package.json
COPY --from=builder --chown=wikicat:wikicat /app/shared/node_modules ./shared/node_modules
COPY --from=builder --chown=wikicat:wikicat /app/shared/dist ./shared/dist
COPY --from=builder --chown=wikicat:wikicat /app/dist ./dist
RUN cp dist/db/migrate.js dist/migrate.js 2>/dev/null || true
COPY --from=builder --chown=wikicat:wikicat /app/drizzle ./drizzle
COPY --chown=wikicat:wikicat entrypoint.sh ./entrypoint.sh
RUN mkdir -p /app/node_modules/@wikicat \
 && ln -s ../../shared /app/node_modules/@wikicat/shared \
 && chmod +x /app/entrypoint.sh \
 && mkdir -p /attachments /attachments-large \
 && chown -R wikicat:wikicat /app /attachments /attachments-large
USER wikicat
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/health || exit 1
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/app/entrypoint.sh"]
