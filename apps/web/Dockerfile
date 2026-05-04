# syntax=docker/dockerfile:1.7
# =====================================================
# StarsPay Web — статика, обслуживается nginx
# Финальный образ ~25MB (nginx:alpine + dist)
# =====================================================

ARG NODE_VERSION=20.18-alpine
ARG NGINX_VERSION=1.27-alpine

# ---------- 1. install + build ----------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund
COPY apps/web ./apps/web
# Vite берёт VITE_* переменные на этапе сборки
ARG VITE_API_BASE=""
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build -w @stars-pay/web

# ---------- 2. nginx ----------
FROM nginx:${NGINX_VERSION} AS runner
RUN apk add --no-cache wget
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1
