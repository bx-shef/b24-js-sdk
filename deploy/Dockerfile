# Сайт документации SDK (Nuxt, docs/) — Node-сервер: страницы, MCP (/mcp/) и чат помощника.
# Контекст сборки — корень репозитория: docs/ берёт SDK из packages/ и навыки из skills/.
# Ключ DeepSeek в образ не попадает: чат включается при сборке флагом, ключ — только при запуске
# (deploy/docker-compose.prod.yml, .env). Сервер — deploy/README.md.

FROM node:22-bookworm-slim AS build
WORKDIR /src
RUN corepack enable && corepack prepare pnpm@12.8.1 --activate
# Адрес сайта попадает в sitemap, canonical и og-разметку при сборке.
ARG SITE_URL=""
# Номер счётчика Яндекс Метрики (публичный: он и так виден в коде страницы). Пусто — ни Метрики,
# ни баннера cookie.
ARG YANDEX_METRIKA_ID=""
ARG GIT_URL="https://github.com/bx-shef/b24-js-sdk"
ENV NUXT_PUBLIC_SITE_URL=${SITE_URL} \
    NUXT_PUBLIC_CANONICAL_URL=${SITE_URL} \
    NUXT_PUBLIC_BASE_URL="" \
    NUXT_PUBLIC_GIT_URL=${GIT_URL} \
    NUXT_PUBLIC_USE_AI=false \
    NUXT_PUBLIC_YANDEX_METRIKA_ID=${YANDEX_METRIKA_ID} \
    NUXT_MCP_ENABLED=true \
    NUXT_PUBLIC_BX_ASSISTANT_ENABLED=true \
    NUXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm run package-jssdk:prepare \
 && pnpm run package-jssdk-nuxt:prepare \
 && pnpm run docs:build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 NUXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /src/docs/.output ./
EXPOSE 3000
LABEL org.opencontainers.image.source=https://github.com/bx-shef/b24-js-sdk
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server/index.mjs"]
