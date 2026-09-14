# syntax=docker/dockerfile:1.7

# ===== Stage 1: base runtime =====
FROM node:22-bookworm-slim AS base
SHELL ["/bin/bash", "-eo", "pipefail", "-c"]
ENV NODE_ENV=production
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl tini \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENTRYPOINT ["/usr/bin/tini", "--"]

# ===== Stage 2: installer-dev (pnpm + TODAS as deps, incluindo dev) =====
FROM base AS installer-dev
ENV NODE_ENV=development
ENV PNPM_HOME=/pnpm
ENV PNPM_STORE_DIR=/root/.local/share/pnpm/store
ENV PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml .npmrc pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
WORKDIR /app
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store,sharing=locked \
    set -eux; \
    rm -f .npmrc; \
    printf "package-manager-strict=false\nnode-linker=hoisted\n" > .npmrc; \
    pnpm install --ignore-scripts --no-frozen-lockfile

# ===== Stage 3: installer-prod (herda de installer-dev, remove dev deps) =====
FROM installer-dev AS installer-prod
ENV PNPM_HOME=/pnpm
ENV PNPM_STORE_DIR=/root/.local/share/pnpm/store
ENV PATH=/pnpm:$PATH
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store,sharing=locked \
    set -eux; \
    rm -f .npmrc; \
    printf "package-manager-strict=false\nnode-linker=hoisted\n" > .npmrc; \
    CI=true pnpm install --prod --ignore-scripts --no-frozen-lockfile

# ===== Stage 4: builder (typechecks/builds com tsc/vite root resolvidos + cd workspace) =====
FROM installer-dev AS builder
ENV NODE_ENV=development
ENV PNPM_HOME=/pnpm
ENV PNPM_STORE_DIR=/root/.local/share/pnpm/store
ENV PATH=/pnpm:$PATH
COPY . .
WORKDIR /app
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store,sharing=locked \
    set -eux; \
    rm -f .npmrc; \
    printf "package-manager-strict=false\nnode-linker=hoisted\n" > .npmrc; \
    CI=true pnpm install --ignore-scripts --no-frozen-lockfile; \
    TSC_BIN=$(node -e "const p=require.resolve('typescript/package.json'); console.log(require('path').dirname(p)+'/bin/tsc');"); \
    VITE_BIN=$(node -e "const p=require.resolve('vite/package.json'); console.log(require('path').dirname(p)+'/bin/vite.js');"); \
    echo "[builder] tsc root:  $TSC_BIN"; \
    echo "[builder] vite root: $VITE_BIN"; \
    cd /app/packages/shared && node "$TSC_BIN" -p tsconfig.build.json --noEmit; \
    cd /app/apps/api && node "$TSC_BIN" -p tsconfig.build.json --noEmit; \
    cd /app/apps/web && node "$TSC_BIN" -p tsconfig.json --noEmit; \
    cd /app/packages/shared && node "$TSC_BIN" -p tsconfig.build.json; \
    cd /app/apps/api && node "$TSC_BIN" -p tsconfig.build.json; \
    cd /app/apps/web && node "$VITE_BIN" build; \
    cd /app && (cp apps/api/dist/db/migrate.js apps/api/dist/migrate.js 2>/dev/null || cp apps/api/dist/src/db/migrate.js apps/api/dist/migrate.js 2>/dev/null || true)

# ===== Stage 5: runner (imagem final, non-root, só runtime deps + artefatos) =====
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV RUN_MIGRATIONS_ON_STARTUP=true
ENV TINI_SUBREAPER=1
RUN groupadd --gid 1001 wikicat && useradd --uid 1001 --gid wikicat --shell /bin/bash --create-home wikicat
WORKDIR /app
COPY --from=installer-prod --chown=wikicat:wikicat /app/package.json /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=installer-prod --chown=wikicat:wikicat /app/node_modules ./node_modules
COPY --from=installer-prod --chown=wikicat:wikicat /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=installer-prod --chown=wikicat:wikicat /app/apps/api/package.json ./apps/api/package.json
COPY --from=installer-prod --chown=wikicat:wikicat /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder --chown=wikicat:wikicat /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=wikicat:wikicat /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=wikicat:wikicat /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=builder --chown=wikicat:wikicat /app/apps/web/dist ./apps/web/dist
COPY --chown=wikicat:wikicat deploy/entrypoint.sh /app/entrypoint.sh
RUN mkdir -p /app/node_modules/@wikicat \
 && ln -s ../../packages/shared /app/node_modules/@wikicat/shared \
 && chmod +x /app/entrypoint.sh \
 && mkdir -p /attachments /attachments-large \
 && chown -R wikicat:wikicat /attachments /attachments-large /app
VOLUME ["/attachments", "/attachments-large"]
USER wikicat
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/health || exit 1
CMD ["/app/entrypoint.sh"]
