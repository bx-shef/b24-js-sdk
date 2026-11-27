# Навыки b24jssdk

Проектные навыки для рабочего пространства `@bxshefby/b24jssdk`. Источники истины:

- `packages/jssdk/README-AI.md` — руководство по API для вызывающего кода
- `test/integration/js-docs/actions-v{2,3}.spec.ts` — канонические примеры API

## Навыки

| Навык | Когда использовать |
| --- | --- |
| **b24jssdk-core** | Загружается первым. Выбирает нужную точку входа (B24Hook / B24Frame / B24OAuth), показывает запуск и завершение работы, обработку ошибок, настройку hardErrorCodes/softErrorCodes/retryOnNetworkError. |
| **b24jssdk-rest** | Канонический REST API: `actions.v{2,3}.{call,batch,callList,fetchList,batchByChunk}.make()` и `actions.v3.deferredBatch`. Выбор между v2 и v3, форма AjaxResult, семантика пакетных запросов (batch). |
| **b24jssdk-filtering** | Два диалекта фильтров: v2 — объекты с ключами-префиксами (`'>=createdTime'`) и v3 — массив троек (`[['fld', '>=', v]]`). NOT, IN, даты через `Text.toB24Format`, правило удаления `order` в `callList`. |
| **b24jssdk-frame-ui** | UI-менеджеры, доступные только внутри iframe Битрикс24: слайдер, диалог (`selectUser/Users/CRM/Access`), parent, встройка (placement) с `setValue`, options, auth. |
| **b24jssdk-helpers** | `useB24Helper`, `B24HelperManager`, клиент Pull, форматирование валют, опции приложения и пользователя. |
| **b24jssdk-recipes** | Тринадцать готовых мини-приложений (аналитика CRM, синхронизация с ERP, Telegram-бот, массовая рассылка, автоматизация задач, AI-ассистент, веб-поиск + LLM, файлы Диска, обработчик вебхуков, обработка ошибок, регистрация событий, установка по OAuth, экспорт через отложенный пакет) — построены на `actions.v{2,3}.*`. |
| **b24jssdk-vibecode** | Как использовать SDK вместе с HTTP API VibeCode. В основном — никак: держите их раздельно. Единственное разумное сочетание — шаблон «AI-надстройка». |

## Статус проверки

Фрагменты кода в каждом навыке проверяются компилятором в CI (`pnpm run skills:typecheck`).
С живым порталом они **ещё не** сверены — это задача #113, и проход по ней описан в
[`VERIFICATION.md`](VERIFICATION.md): `pnpm run skills:verify` покрывает всё, до чего
дотягивается вебхук, а ручной чек-лист — менеджеры, работающие только во фрейме, для
которых нужно приложение, открытое внутри настоящей встройки.

## Документы верхнего уровня

- `.github/contributing/maintenance.md` — правила еженедельной проверки `docs/llms-full.txt`.
- `.github/contributing/report.md` — открытые вопросы, конспект сомнительных мест, журнал миграции.
- `.github/contributing/suggested-examples.md` — пробелы в текущем наборе примеров, отранжированные по отдаче.

## Соглашения во всех навыках

- TypeScript / ESM. Голые импорты из `@bxshefby/b24jssdk`.
- Активный клиент всегда называется `$b24` и трактуется как `TypeB24` — каждый пример работает для `B24Hook`, `B24Frame` и `B24OAuth`, потому что API actions живёт в `AbstractB24`.
- Всегда используйте **`$b24.actions.v{2,3}.*.make()`** — устаревшие `callMethod`/`callBatch`/`callListMethod`/`fetchListMethod` были **удалены в 3.0.0** и больше не существуют.
- Жёстко заданного списка разрешённых методов v3 в SDK больше нет — `actions.v3.*` отправляет любой метод на endpoint v3, а проверяет его сервер (неизвестный метод → `METHODNOTFOUNDEXCEPTION`). По умолчанию берите `v2`; `v3` используйте, когда нужно v3-представление метода (`tasks.task.*`, `main.eventlog.*`, `note.*`, `rest.application.*`, …).
- Сущности v3 (`crm.item.*`) при вызове через v2 по-прежнему требуют `idKey: 'id'` (строчными) и `customKeyForResult: 'items'` для списочных помощников; классические методы (`crm.deal.*`) используют `idKey: 'ID'` по умолчанию. `tasks.task.list` зависит от endpoint: в **v2** сортирует и фильтрует по `ID`, но возвращает `id` строчными, поэтому нужны `idKey: 'id', cursorIdKey: 'ID'` (и `customKeyForResult: 'tasks'`); в **v3** всё строчными — `idKey: 'id'` (по умолчанию), без `cursorIdKey`, `customKeyForResult: 'items'`.
- Фильтры: v2 — объект с ключами-префиксами; v3 — массив троек `[field, op, value]`. Никогда не смешивайте.
- Даты: используйте `Text.toB24Format(date)` для канонического формата `yyyy-MM-dd'T'HH:mm:ssZZ`.

## Заметка о миграции

Этот набор навыков переписан в 2026-05, чтобы уйти от устаревшего API SDK, полностью удалённого в 3.0.0. Если в остальном репозитории (docs/, playgrounds/) вам попадутся примеры с `b24.callMethod(...)`, этот код больше не компилируется — отметьте его для миграции. Актуальная форма — `b24.actions.v{2,3}.call.make({ method, params, requestId? })`.
