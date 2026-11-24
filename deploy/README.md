# Публикация сайта документации

Сайт — Nuxt-приложение `docs/` в режиме Node-сервера: страницы, `llms.txt`, навыки
(`/.well-known/skills/`), MCP-сервер (`/mcp/`) и чат помощника на DeepSeek. Схема та же, что у
соседних сайтов (bx-shef/toolsai, `site/landing/deploy/`): образ в ghcr.io, на сервере — compose за
общим nginx-proxy с acme-companion, обновляет общий Watchtower.

## Образ

- `deploy/Dockerfile`, контекст — корень репозитория. Сборка: `pnpm install`, подготовка пакетов,
  `pnpm run docs:build`. В образе только `docs/.output`, процесс от `node`, порт 3000.
- Воркфлоу `.github/workflows/docs-image.yml`: на PR — сборка и дымовая проверка; на push в `main` —
  публикация `ghcr.io/bx-shef/b24-js-sdk-docs:latest` и `:sha-…`.
- Адрес сайта для sitemap, canonical и og — переменная репозитория `SITE_URL`
  (Settings → Secrets and variables → Actions → Variables). Пусто — ссылки относительные.
- MCP включён при сборке (`NUXT_MCP_ENABLED=true`). Чат включён при сборке флагом
  `NUXT_PUBLIC_BX_ASSISTANT_ENABLED=true`, а показывается, только если при запуске
  `ASSISTANT_ENABLED=true` и задан `DEEPSEEK_API_KEY`. `ASSISTANT_ENABLED=false` выключает и
  серверную часть: `/api/ai` и поиск помощника отвечают 404. Флаг без ключа — чат виден, ответы 503.
- Каждый запрос чата тратит ключ DeepSeek: лимит с одного клиента в минуту
  (`ASSISTANT_RATE_PER_MINUTE`, клиент — по `X-Forwarded-For` от nginx-proxy) и общий за сутки
  (`ASSISTANT_DAILY_LIMIT`).

## Сервер

1. Прокси `proxy-net` с nginx-proxy и acme-companion — если его ещё нет, по
   `site/landing/deploy/proxy.compose.yml` из bx-shef/toolsai.
2. Каталог, например `/opt/b24-js-sdk-docs`: `docker-compose.prod.yml` и `.env` из `.env.example`.
3. `docker compose -f docker-compose.prod.yml up -d`.
4. Проверка: `https://<DOMAIN>/llms.txt` — 200, `https://<DOMAIN>/mcp/` — MCP-сервер.

Новые версии ставит Watchtower по метке `com.centurylinklabs.watchtower.enable=true`.
