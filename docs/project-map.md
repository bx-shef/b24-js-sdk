# Карта проекта bx-shef/b24-js-sdk

<sub>Последняя сверка: 2026-11-28.</sub>

Срез состояния: что это, где мы, что дальше, что ждёт решения владельца. Обновляется в том же PR, что меняет состояние (выпуск, сайт, крупная задача). План на конкретный день — в задаче-плане (сейчас [#65](https://github.com/bx-shef/b24-js-sdk/issues/65)), вопросы владельцу — в `.claude/owner-questions.md`.

## Цель

Форк [bitrix24/b24jssdk](https://github.com/bitrix24/b24jssdk) — JS/TS SDK для REST API Битрикс24 — со своими пакетами в npm, русской документацией и своим сайтом. С родителем синхронизируемся по одному коммиту (`.sync/`), свои правки держат сторожевые тесты (`scripts/__tests__/fork-guards.test.mjs`).

## Где мы

| Что | Состояние |
|---|---|
| Пакеты npm | `@bxshefby/b24jssdk` и `@bxshefby/b24jssdk-nuxt` 3.1.0, с provenance. Старые `@bitrix24/*` помечены deprecated владельцем |
| Выпуск | release-please копит изменения в PR `chore(main): release X.Y.Z`; владелец мержит его руками, когда нужен выпуск, — публикация в npm идёт сама (`RELEASING.md`, раздел «Форк») |
| Сайт | https://b24-js-sdk.bx-shef.by — Docker-образ из `main` (`docs-image.yml`), сервер bx-shef, обновляет Watchtower (`deploy/README.md`). Номер сборки — в подвале. При выкладке сайт 2–3 минуты отвечает 502 |
| Сайт для AI-агентов | MCP-сервер `/mcp/` (страница «MCP-сервер»), навыки `skills/` и `/.well-known/skills/`, `llms.txt` и `llms-full.txt` |
| Чат помощника | DeepSeek через MCP-инструменты сайта; заявка на разработку — форма Битрикс24 |
| Аналитика | Яндекс Метрика (цели заведены), баннер согласия на cookie |
| Синхронизация с родителем | Запланированная задача каждый понедельник; правила переноса — `.sync/PORTING.md` |
| Живые тесты SDK | 64–67 из 68 на тестовом портале; записи готовит `make test-fixtures` |
| Соседи | UI-библиотека — [bx-shef/b24-ui](https://github.com/bx-shef/b24-ui) (https://b24-ui.bx-shef.by), иконки — [bx-shef/b24-icons](https://github.com/bx-shef/b24-icons) (https://b24-icons.bx-shef.by); правки там делают их сессии |

## Что дальше

1. **Сайт:** светлая тема ([#70](https://github.com/bx-shef/b24-js-sdk/issues/70), вместе с правками «Василька» [#49](https://github.com/bx-shef/b24-js-sdk/issues/49)); поиск, английские тексты, 404, телефон ([#71](https://github.com/bx-shef/b24-js-sdk/issues/71), остаток обхода [#64](https://github.com/bx-shef/b24-js-sdk/issues/64)).
2. **Синхронизация:** не терять правообладателя ООО «БэИксШефБай» ([#78](https://github.com/bx-shef/b24-js-sdk/issues/78)).
3. **Размер пакета:** не публиковать `.map` и дубли (архив 3,4 → ~0,7 МБ) — первый шаг [#63](https://github.com/bx-shef/b24-js-sdk/issues/63).
4. **Шаблон и главная** ([#66](https://github.com/bx-shef/b24-js-sdk/issues/66)).
5. **Pull-клиент** ([#61](https://github.com/bx-shef/b24-js-sdk/issues/61)) — после доступа к коду ядра Битрикс24.
6. **Нестабильные живые тесты** ([#48](https://github.com/bx-shef/b24-js-sdk/issues/48)) — позже (решение владельца).

После каждой порции правок сайта — тест в браузере обеими темами и на телефоне (промпт для Chrome-плагина — в комментариях к #65).

## Ждёт решения или действия владельца

- Чат, заявка и Метрика — один вариант с b24-ui ([#44](https://github.com/bx-shef/b24-js-sdk/issues/44)).
- Доступ к коду ядра Битрикс24 — нужен для #61.
- Настройки репозитория и название сайта в логотипе — `.claude/owner-questions.md`.

## Где что лежит

| Что | Где |
|---|---|
| Правила для агентов и контрибьюторов | `AGENTS.md`, `.github/contributing/` |
| Выпуск | `RELEASING.md`, `release-please-config.json`, `.github/workflows/release-please.yml`, `npm-publish-*.yml` |
| Сайт и сервер | `docs/`, `deploy/` (`install-server.sh`, `README.md`), `.github/workflows/docs-image.yml` |
| Синхронизация с родителем | `.sync/` (`PORTING.md`, `b24jssdk.json`, `docs-map.json`, `log/`) |
| Уровни ревью PR | `tools/review-tier.sh` |
