# syntax=docker/dockerfile:1.7
# =====================================================
# StarsPay API — multi-stage build
# Финальный образ ~120MB (alpine + только prod-deps + dist + prisma engine)
# =====================================================

ARG NODE_VERSION=20.18-alpine

# ---------- 1. deps ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
# нужно openssl для prisma engine
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
# Корневые workspaces — npm ставит сразу всё, что нужно
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ---------- 2. build ----------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN apk add --no-cache openssl
# npm workspaces полностью хойстят зависимости в корневой /app/node_modules,
# поэтому отдельной apps/api/node_modules не существует — Node резолвит вверх.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# ---------- 3. prod deps only ----------
FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund
# нужно для миграций в рантайме
COPY apps/api/prisma ./apps/api/prisma
RUN cd apps/api && npx prisma generate

# ---------- 4. runner (минимальный образ) ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

RUN apk add --no-cache openssl tini wget && \
    addgroup -S app && adduser -S app -G app

# prod node_modules (с prisma engine) и сгенерённые типы.
# Хойстинг workspaces → всё лежит в корневом /app/node_modules,
# api-процесс резолвит зависимости через walk-up.
COPY --from=prod-deps --chown=app:app /app/node_modules /app/node_modules
COPY --from=prod-deps --chown=app:app /app/apps/api/prisma ./prisma
# наш собранный код
COPY --from=builder --chown=app:app /app/apps/api/dist ./dist
COPY --from=builder --chown=app:app /app/apps/api/package.json ./package.json

# директория для аватарок (примонтируется в volume)
RUN mkdir -p /app/data/avatars && chown -R app:app /app/data
VOLUME ["/app/data/avatars"]

USER app
EXPOSE 4000

# tini — корректные сигналы и reaping zombie-процессов
ENTRYPOINT ["/sbin/tini", "--"]

# Healthcheck — пинг /health
HEALTHCHECK --interval=30s --timeout=4s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

# Прогон миграций перед стартом (идемпотентно)
# Используем npx — он найдёт `prisma` бинарь независимо от того, в какой
# директории node_modules он окажется (root vs workspace).
CMD ["sh", "-c", "npx --no-install prisma migrate deploy && node dist/index.js"]
