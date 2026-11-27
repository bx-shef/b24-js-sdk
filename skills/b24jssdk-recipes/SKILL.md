---
name: b24jssdk-recipes
description: Готовые мини-приложения на каноническом API actions.v{2,3}.* из b24jssdk — аналитика CRM, синхронизация с ERP, Telegram-бот, массовая рассылка, автоматизация задач, AI-ассистент, веб-поиск + LLM, файлы Диска, обработчик вебхуков, сборник по обработке ошибок, регистрация событий, рукопожатие установки по OAuth, экспорт через отложенный пакет (deferred batch). Каждый рецепт — одна программа на TypeScript с B24Hook на стороне сервера. Загружайте, когда пользователь просит рабочий пример или шаблон для старта. Используйте также на просьбы «пример приложения», «готовый шаблон», «синхронизация с ERP», «рассылка», «бот Telegram», «отчёт по CRM», «файлы Диска», «автоматизация задач».
---

# Рецепты b24jssdk

Тринадцать готовых программ. Каждый рецепт работает на `B24Hook` (Node.js), но тело каждой функции принимает `$b24: TypeB24`, поэтому тот же код работает и во фрейме — достаточно заменить запуск на `initializeB24Frame()`. (Рецепт 13 — исключение, пока не проверен браузер: его файл результата скачивается с портала, см. руководство по DeferredBatch.)

Все рецепты используют канонический API **`$b24.actions.v{2,3}.*.make()`**. Устаревшие `callMethod` / `callBatch` / `callListMethod` / `fetchListMethod` были удалены в 3.0.0 — не генерируйте код против них.

| # | Файл | Стек | Права | Что делает |
| --- | --- | --- | --- | --- |
| 1 | `examples/01-crm-analytics.ts` | Node | `crm` | Потоково читает все сделки через `actions.v2.fetchList.make`, группирует по стадиям, печатает отчёт по воронке (количества, конверсия %, средний чек, доля выигранных) |
| 2 | `examples/02-mass-messaging.ts` | Node | `crm`, `im` | Фильтрует контакты через `actions.v2.call.make`, отправляет `im.notify` ответственным менеджерам |
| 3 | `examples/03-task-automation.ts` | Node, `setInterval` | `crm`, `task` | Опрашивает стадии сделок через `actions.v2.fetchList.make`; при переходе на отслеживаемую стадию создаёт задачу через `actions.v3.call.make('tasks.task.add', …)` |
| 4 | `examples/04-erp-sync.ts` | Node, `node-cron` | `crm` | Двусторонняя синхронизация контактов между Битрикс24 (через `actions.v2.*`) и условной ERP |
| 5 | `examples/05-disk-files.ts` | Node | `disk` | Хранилища → корень → создание папки → список файлов, с круговым проходом через `actions.v2.batch.make` |
| 6 | `examples/06-telegram-bot.ts` | Node, `grammy`, `node-cron` | `crm` | Опрашивает новые сделки через `actions.v2.call.make`, уведомляет чат Telegram |
| 7 | `examples/07-webhook-handler.ts` | Node, `express` | `crm`, `task` | Сервер Express, принимающий исходящие события Битрикс24; загружает подробности через `actions.v2.call.make`, затем создаёт задачу-продолжение с `idempotencyKey`, чтобы повторно доставленное событие не создало её дважды |
| 8 | `examples/08-ai-assistant.ts` | Node, `openai` | `crm`, `task` | Сделка + лента дел → промпт для GPT → задача-продолжение через `actions.v3.call.make('tasks.task.add')` |
| 9 | `examples/09-web-search-llm.ts` | Node, BYOC | `crm` | Двухшаговый RAG; SDK публикует ответ в таймлайне сделки через `actions.v2.call.make('crm.timeline.comment.add')` |
| 10 | `examples/10-error-handling.ts` | Node | любые | Сборник по обработке ошибок: таксономия AjaxError и SdkError; параметры `hardErrorCodes` / `softErrorCodes` / `retryOnNetworkError` через `setRestrictionManagerParams`; безопасность неидемпотентных вызовов, где в v3 ответом служит `idempotencyKey` |
| 11 | `examples/11-event-registration.ts` | Node | `crm` | CLI-утилита — список / привязка / отвязка событий исходящих вебхуков (`event.get`, `event.bind`, `event.unbind`). Работает в паре с рецептом 7. |
| 12 | `examples/12-oauth-install.ts` | Node, `express` | OAuth-приложение | Рукопожатие установки по OAuth: обработка событий `ONAPPINSTALL` / `ONAPPUPDATE` / `ONAPPUNINSTALL`, сохранение токенов по порталам, создание `B24OAuth` по требованию, колбэк обновления записывает новые токены обратно в хранилище |
| 13 | `examples/13-deferred-batch-export.ts` | Node | `task` | Массовый экспорт тысяч задач (страницы списка, поскольку одна упавшая команда проваливает задание) как ОДНО фоновое задание через `actions.v3.deferredBatch` — `make()` с колбэком прогресса `onStatus` или шаги `add` → `waitFor` → `download` → `delete` за два запуска; пишет JSON Lines |

## Общая библиотека (`lib/`)

Чистые помощники без ввода-вывода, вынесенные из рецептов, чтобы их можно было тестировать без живого портала.

`lib/` — для помощников, у которых вторая вручную написанная копия — это *дефект*: примитив безопасности
или логика с краевыми случаями, которые закрепляет тест. Это не место для общей обвязки: перед нами
рецепты, и каждое выделение лишает читателя возможности взять один файл и запустить
его. Если сомневаетесь, оставьте код в рецепте.

Разобранный пример правила: `bootB24()` побайтно одинаков в двенадцати из тринадцати
рецептов и остаётся таким намеренно. У него нет краевых случаев, которые нужно закреплять, и нет
значения для безопасности, и это первое, что читателю нужно увидеть, открыв рецепт, —
спрятать его за импортом обойдётся дороже, чем дублирование.

Рецепты 06 и 12 заканчиваются защитой вместо голого вызова `main()`:

```ts
import { pathToFileURL } from 'node:url'

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e: unknown) => {
    // Raw console.error, so structured-logger formatting cannot hide the trace.
    console.error('\n[recipe failed]', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    process.exitCode = 1
  })
}
```

`npx tsx 06-telegram-bot.ts` по-прежнему запускается ровно как раньше — защита ложна только тогда,
когда файл *импортируется*, а именно так поступают модульные тесты, чтобы проверить логику курсора `tick`
и проверку токена удаления, не открывая соединение с Telegram и не занимая порт. Сохраняйте её при копировании этих двух рецептов. Прежде чем добавлять её в третий, предпочтите путь
через `lib/` выше: выделите логику и протестируйте её там. Обращайтесь к защите, только когда
функция не может разумно покинуть рецепт — `tick` замыкается на живого бота и
курсор опроса, `handleUninstall` — обработчик Express, — потому что две формы рецепта —
это уже на одну больше идеала, а распространение защиты на все тринадцать тихо отменило бы
соглашение о `lib/`. Экспортируемые `function` в этих файлах экспортируются по той же
причине, а `export` не действует, когда файл запускается напрямую.

Одно замечание по развёртыванию: защита сравнивает `import.meta.url` с `process.argv[1]`.
При экзотическом запускающем средстве, которое переписывает любое из них, — обёртка CLI, некоторые прослойки загрузчиков, —
сравнение может оказаться ложным, и процесс завершится с кодом 0, ничего не запустив.
Проверяйте строку лога запуска рецепта, а не полагайтесь на код выхода.

| Файл | Экспорты | Где используется |
| --- | --- | --- |
| `lib/funnel.ts` | `baseStage`, `analyseFunnel`, `DealRow`, `StageStat` | рецепты 01, 03, 06 |
| `lib/crypto.ts` | `safeEqual` | рецепты 07, 12 |
| `lib/portal-url.ts` | `checkPortalUrls` | рецепт 12 |

`baseStage(s)` отбрасывает префикс категории мультиворонки (`"C2:WON"` → `"WON"`),
возвращая исходную строку, если часть после двоеточия пуста (`"C2:"` → `"C2:"`).
Импортируйте его из `lib/funnel`, а не объявляйте заново в рецепте: в 03 и 06 была
своя копия, возвращавшая `""` в этом случае. Поток управления ни одного рецепта на самом деле
не отличался — ни `""`, ни `"C2:"` не совпадают с ключом стадии, — но копии
незаметно разошлись с протестированной, а следующее расхождение может оказаться небезобидным.  
`analyseFunnel(deals)` группирует сделки по исходному ключу `stageId`, суммируя количества и суммы сделок.

`safeEqual(a, b)` — сравнение за постоянное время для секретов и токенов. У него была та же
проблема двух копий, что у `baseStage`, в рецептах 07 и 12. Никогда не объявляйте его заново: сравнение за постоянное время,
разошедшееся в одной из двух копий, — это уязвимость, выглядящая как рефакторинг, а `===` для токена —
это именно тот баг, от которого оно защищает.

## Фрагмент запуска (общий для всех рецептов)

```ts
import { B24Hook, ConsoleV2Handler, LogLevel, Logger, type TypeB24 } from '@bxshefby/b24jssdk'

export function bootB24(): TypeB24 {
  const url = process.env.B24_HOOK
  if (!url) throw new Error('B24_HOOK env var is required (incoming webhook URL)')
  const $b24 = B24Hook.fromWebhookUrl(url)
  return $b24
}

// Recipes run under Node, so the console handler is created explicitly with
// `useStyles: false` — the browser factory emits ANSI-free CSS styling that a
// terminal prints as literal noise.
export const logger = Logger.create('Recipe')
logger.pushHandler(new ConsoleV2Handler(
  process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.INFO,
  { useStyles: false }
))
```

Фрагмент встроен в каждый файл рецепта для удобства копирования.

## Разделение по версиям API — краткая справка

В рецептах разделение такое:

| Метод | API actions | Почему |
| --- | --- | --- |
| `crm.item.{get,list,add,update,delete}` | `actions.v2.*` | Классический API, здесь используется через v2 |
| `crm.activity.list`, `crm.timeline.comment.add` | `actions.v2.*` | Классический API, только v2 |
| `tasks.task.{add,get,update,delete,list}` | **`actions.v3.*`** | Используется через v3 (camelCase, `result.items`) |
| `disk.*`, `im.*`, `profile`, `user.*` | `actions.v2.*` | Классический API, только v2 |
| `main.eventlog.{list,get,tail}` | **`actions.v3.*`** | v3, включая встроенный `tail` |

> SDK больше не ограничивает v3 жёстко заданным списком разрешённых методов: `actions.v3.*` отправляет любой метод на endpoint v3, а проверяет его сервер (неизвестный метод возвращает `METHODNOTFOUNDEXCEPTION` как мягкую ошибку в `AjaxResult`, а не исключение SDK). Рецепты выбирают API для каждого метода по тому, что читается лучше для этих данных, а не по белому списку.

## Выбор именования полей

Более новые методы CRM (`crm.item.list`) используют поля в camelCase: `stageId`, `assignedById`, `opportunity`, `createdTime`. Классические (`tasks.task.add`, `crm.activity.list`, `crm.timeline.comment.add`) — в верхнем регистре: `TITLE`, `DESCRIPTION`, `OWNER_TYPE_ID`. Рецепты следуют этому разделению. Оба относятся к `restApi:v2` — `crm.item.*` написан в camelCase по собственным причинам, а не потому, что это v3; endpoint v3 не публикует `crm.item.*`. В `restApi:v3` camelCase — правило везде, а `<entity>.field.list` отвечает на него для каждой сущности — см. [Обнаружение полей сущности](https://b24-js-sdk.bx-shef.by/docs/actions/discovering-entity-fields/).

## Запуск

```bash
# 1. Install: at the repo root or in a fresh project
pnpm add @bxshefby/b24jssdk
# Copying a single recipe out of this repo? Some recipes import a shared
# helper and need it copied alongside, keeping the ../lib/ path:
#   recipes 1, 3, 6:  lib/funnel.ts  (baseStage)
#   recipes 7, 12:    lib/crypto.ts  (safeEqual)
# Every other recipe is standalone.
# Recipe-specific deps as needed:
#   recipe 4: pnpm add node-cron
#   recipe 6: pnpm add grammy node-cron
#   recipe 7: pnpm add express
#   recipe 8: pnpm add openai
#   recipe 9: pnpm add openai
#   recipe 12: pnpm add express
# Recipe 12 also honours B24_OAUTH_STORE — where to write the OAuth token
# store. Defaults to .oauth-store.json in the working directory, which is
# rarely where portal credentials should live on a real server.

# 2. Set env
export B24_HOOK='https://YOUR_PORTAL.bitrix24.com/rest/1/k32t88gf3azpmwv3'

# 3. Run with tsx (no build step)
npx tsx examples/01-crm-analytics.ts
```

## Оговорки, действующие во всех рецептах

- **Мультиворонки**: идентификаторы стадий могут нести префикс категории (`C2:WON`, `C4:LOSE`). Рецепты 1, 3 и 6 отбрасывают префикс при проверке базовой стадии.
- **`order` в `callList.make`**: молча отбрасывается (действие принудительно ставит `cursorIdKey ASC`, по умолчанию `idKey`, ради стабильности курсора). Для сужения используйте `filter`.
- **`customKeyForResult`**: `'items'` для `crm.item.list`, для классических методов опустите или укажите `'tasks'`. Неверное значение → молча пустой массив.
- **`idKey` / `cursorIdKey`**: `idKey: 'id'` для `crm.item.list`; `'ID'` (по умолчанию) для классических методов. `tasks.task.list` — исключение **в v2**: он возвращает `id` строчными, но сортирует по `ID`, поэтому используйте `idKey: 'id', cursorIdKey: 'ID'` (и `customKeyForResult: 'tasks'`); в **v3** всё строчными: `idKey: 'id'` (по умолчанию), без `cursorIdKey`, `customKeyForResult: 'items'`.
- **Обработка ошибок**: неудачные вызовы бросают `AjaxError` для ошибок REST; рецепты логируют и продолжают там, где это разумно. Настраивайте через `setRestrictionManagerParams`, если нужно другое поведение повторов (см. `b24jssdk-core`).
- **События вебхуков** (рецепт 7): регистрация самих исходящих вебхуков (какие события куда идут) — разовая настройка. Рецепт 11 (`11-event-registration.ts`) — небольшой CLI для этого: `list` / `bind` / `unbind` через `event.get` / `event.bind` / `event.unbind`.

## Перекрёстные ссылки

За низкоуровневыми деталями v3 (грамматика фильтров, `$ref`/`$refArray` в пакетных запросах, курсорная постраничная выборка) обращайтесь к навыкам `b24jssdk-rest` и `b24jssdk-filtering`.
