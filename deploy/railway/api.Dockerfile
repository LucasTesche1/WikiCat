# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
SHELL ["/bin/bash", "-eo", "pipefail", "-c"]
ENV NODE_ENV=production
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl tini \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENTRYPOINT ["/usr/bin/tini", "--"]

FROM base AS installer
ENV NODE_ENV=development
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN printf "package-manager-strict=false\nnode-linker=hoisted\n" > .npmrc \
 && pnpm install --ignore-scripts --frozen-lockfile

FROM installer AS builder
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @wikicat/shared build \
 && pnpm --filter @wikicat/api build \
 && (cp apps/api/dist/db/migrate.js apps/api/dist/migrate.js 2>/dev/null || true)

FROM installer AS prod-deps
ENV NODE_ENV=production
RUN pnpm install --prod --ignore-scripts --frozen-lockfile

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV RUN_MIGRATIONS_ON_STARTUP=true
ENV DB_WAIT_TIMEOUT_SECONDS=180
RUN groupadd --gid 1001 wikicat \
 && useradd --uid 1001 --gid wikicat --shell /bin/bash --create-home wikicat
COPY --from=prod-deps --chown=wikicat:wikicat /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=prod-deps --chown=wikicat:wikicat /app/node_modules ./node_modules
COPY --from=prod-deps --chown=wikicat:wikicat /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=prod-deps --chown=wikicat:wikicat /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=wikicat:wikicat /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=wikicat:wikicat /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=wikicat:wikicat /app/apps/api/drizzle ./apps/api/drizzle
COPY --chown=wikicat:wikicat deploy/entrypoint.sh /app/entrypoint.sh
RUN mkdir -p /app/node_modules/@wikicat /attachments /attachments-large \
 && ln -s ../../packages/shared /app/node_modules/@wikicat/shared \
 && chmod +x /app/entrypoint.sh \
 && chown -R wikicat:wikicat /app /attachments /attachments-large
USER wikicat
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/health || exit 1
CMD ["/app/entrypoint.sh"]
