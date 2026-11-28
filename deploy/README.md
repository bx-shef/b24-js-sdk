# Публикация сайта документации

Сайт — Nuxt-приложение `docs/` в режиме Node-сервера: страницы, `llms.txt`, навыки
(`/.well-known/skills/`), MCP-сервер (`/mcp/`) и чат помощника на DeepSeek. Схема та же, что у
соседних сайтов: образ в ghcr.io, на сервере — compose за общим прокси (на сервере bx-shef — обычный nginx,
см. «Сервер»), обновляет общий Watchtower.

## Образ

- `deploy/Dockerfile`, контекст — корень репозитория. Сборка: `pnpm install`, подготовка пакетов,
  `pnpm run docs:build`. В образе только `docs/.output`, процесс от `node`, порт 3000.
- Воркфлоу `.github/workflows/docs-image.yml`: на PR — сборка и дымовая проверка; на push в `main` —
  публикация `ghcr.io/bx-shef/b24-js-sdk-docs:latest` и `:sha-…`.
- Адрес сайта для sitemap, canonical и og — секрет репозитория `DOCS_SITE_URL` (или переменная
  `SITE_URL`; Settings → Secrets and variables → Actions). Пусто — ссылки относительные.
- MCP включён при сборке (`NUXT_MCP_ENABLED=true`). Чат включён при сборке флагом
  `NUXT_PUBLIC_BX_ASSISTANT_ENABLED=true`, а показывается, только если при запуске
  `ASSISTANT_ENABLED=true` и задан `DEEPSEEK_API_KEY`. `ASSISTANT_ENABLED=false` выключает и
  серверную часть: `/api/ai` и поиск помощника отвечают 404. Флаг без ключа — чат виден, ответы 503.
- Каждый запрос чата тратит ключ DeepSeek: лимит с одного клиента в минуту
  (`ASSISTANT_RATE_PER_MINUTE`, клиент — по `X-Forwarded-For` от nginx-proxy) и общий за сутки
  (`ASSISTANT_DAILY_LIMIT`).

- Яндекс Метрика — номер счётчика в секрете репозитория `YANDEX_METRIKA_ID`, вшивается в образ при
  сборке; на сервере заменить его можно переменной `NUXT_PUBLIC_YANDEX_METRIKA_ID`. Метрика грузится только после
  согласия посетителя в баннере cookie (`docs/public/cookie-consent.js`, как на посадочных bx-shef),
  без Вебвизора; события сайта (поиск, чат, переключение версии API, действия со страницей) уходят
  целями `reachGoal` (`docs/app/composables/useAnalytics.ts`).

## Сервер

Сайт стоит на сервере bx-shef с 2026-11-27: **https://b24-js-sdk.bx-shef.by**.

Как устроен сервер (так у всех сайтов bx-shef на нём):

- **Прокси** — обычный nginx в контейнере `proxy` (папка `/home/bitrix/b24-proxy`, сеть `proxy-net`), а не
  `nginx-proxy`: сайты он сам не находит. Все сайты — блоками в одном `conf.d/default.conf`; его когда-то
  собирал скрипт `gen.py`, которого на сервере нет, — правки ручные.
- **Сертификаты** — certbot (webroot `/usr/share/nginx/html`, том `b24-ui_html`) кладёт их в том
  `b24_letsencrypt`, копии — в том `b24-ui_certs` под именем домена (`<домен>.crt/.key/.chain.pem/.dhparam.pem`).
  Продление — `renew-certs.sh` по крону (понедельник 04:17) для доменов из его списка `DOMAINS`.
- **Обновление** — Watchtower: новый `:latest` из ghcr ставится сам (метка в compose). Вход в `ghcr.io` на
  сервере уже есть.
- Переменные `VIRTUAL_HOST`/`LETSENCRYPT_*` в compose этим прокси не читаются — они для `nginx-proxy`, если
  сайт переедет на сервер с ним.

**Установка или переезд** — один скрипт [`install-server.sh`](install-server.sh) на сервере от пользователя `bitrix`:

```bash
curl -fsSLO https://raw.githubusercontent.com/bx-shef/b24-js-sdk/main/deploy/install-server.sh && bash install-server.sh
```

Он идемпотентен (повторный запуск ничего не дублирует и доделывает недоделанное), спрашивает ключ DeepSeek
(ввод не виден), поднимает контейнер, выпускает сертификат, дописывает два блока в `default.conf` и добавляет
домен в продление. Перед первой правкой `default.conf` кладёт копию рядом (`.backup-default.conf.<время>`) и при
любом сбое дальше возвращает её — общий конфиг всех сайтов не остаётся полуправленным.

Чему научила первая установка:

- DNS-запись домена должна смотреть на сервер **до** запуска — иначе certbot не пройдёт проверку.
- С самого сервера его внешний адрес может не открываться (`curl` даёт `000`) — проверять снаружи.
- Ответы чата идут потоком: в блоке `:443` нужен `proxy_buffering off`, иначе текст приходит целиком в конце.
- Адрес посетителя прокси передаёт последним в `X-Forwarded-For` (глобальные `proxy_set_header` в начале
  `default.conf`) — на нём держится лимит частоты чата (`NUXT_TRUST_PROXY=true`).
- MCP (`/mcp/`) принимает POST от AI-клиентов; браузер он перенаправляет на страницу «MCP-сервер», `curl` без `Accept: text/html` получает 405.

Проверка: `https://<домен>/` и `/llms.txt` — 200, на странице есть номер Метрики (`yandexMetrikaId`),
чат отвечает (`POST /api/ai` — поток `data: …`).
