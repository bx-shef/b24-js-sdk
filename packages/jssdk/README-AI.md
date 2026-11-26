# Bitrix24 JS SDK — руководство для ИИ

> ⚠️ **Этот файл переходный и будет удалён.**
>
> Его содержимое постепенно переносится в [`AGENTS.md`](../../AGENTS.md) (корневое руководство для агентов) и четыре тематических руководства в [`.github/contributing/`](../../.github/contributing/). Следующие PR продолжат переносить разделы отсюда, пока файл не удастся удалить.
>
> **Пока этого не произошло:**
>
> - Если это руководство расходится с `AGENTS.md` или руководствами в `.github/contributing/`, **верх берёт `AGENTS.md`**. Не «исправляйте» `AGENTS.md`, подгоняя его под этот файл.
> - **Не добавляйте сюда новый материал.** Новые соглашения, примеры и паттерны относятся в `AGENTS.md` или в соответствующее руководство для контрибьюторов.
> - Исправления ошибок в существующих разделах допустимы (например, поправить устаревшее имя API), но по возможности их нужно отразить в каноническом месте в том же PR.

---

Назначение: дать ИИ-агентам точный, ориентированный на код обзор SDK, чтобы они генерировали рабочие приложения Битрикс24. С помощью этого SDK можно:

- вызывать REST API Битрикс24 из приложений, встроенных в Битрикс24 (iframe), и из серверных сервисов;
- работать с интерфейсом Битрикс24: открывать слайдеры и диалоги, менять размер фрейма, задавать заголовок страницы внутри приложения (`#pagetitle`, а не вкладки браузера), интеграции с IM и т. д.;
- управлять опциями приложения и пользователя через родительский портал;
- использовать хелперы (профиль, приложение, опции, валюты, лицензии, платежи) и клиент Pull.

Основные строительные блоки:

- Фронтенд во фрейме: B24Frame + initializeB24Frame()
- Бэкенд/сервис: B24Hook (на основе вебхука)
- Утилиты REST: actions.v{2,3}.{call,callList,fetchList,batch,batchByChunk}.make
- Менеджеры интерфейса: parent, slider, dialog, placement, options, auth
- Хелперы: B24HelperManager и хук useB24Helper; клиент Pull

Примечание: пакет поставляется в сборках ESM, CommonJS и UMD. Рекомендуемая точка входа — ESM; CommonJS поддерживается через `require('@bitrix24/b24jssdk')`, а UMD-сборка предназначена для подключения через `<script>` в браузере.

## Удалено в 3.0.0 — никогда не генерируйте это

Следующая поверхность была помечена `@deprecated` на протяжении `2.x` и **больше
не существует**. Генерация любой её части даёт код, который не компилируется. Если
вас просят работать с кодовой базой на `2.x`, где она ещё используется, столбец
«Замена» — это то, на что нужно переписать. Полный чек-лист:
[Migration to v3](https://bitrix24.github.io/b24jssdk/docs/getting-started/migration/v3/).

| Удалено в 3.0.0 | Замена |
|---|---|
| `b24.callMethod(method, params, start?)` | `b24.actions.v2.call.make({ method, params })` / `b24.actions.v3.call.make({ method, params })` |
| `b24.callBatch(calls, isHaltOnError?, returnAjaxResult?)` | `b24.actions.v2.batch.make({ calls, options })` / `b24.actions.v3.batch.make(...)` |
| `b24.callBatchByChunk(calls, isHaltOnError)` | `b24.actions.v2.batchByChunk.make({ calls, options })` / `b24.actions.v3.batchByChunk.make(...)` |
| `b24.callListMethod(method, params, progress?, customKey?)` | `b24.actions.v2.callList.make({ method, params, customKeyForResult })` / `b24.actions.v3.callList.make(...)` |
| `b24.fetchListMethod(method, params, idKey?, customKey?)` | `b24.actions.v2.fetchList.make({ method, params, idKey, customKeyForResult })` / `b24.actions.v3.fetchList.make(...)` |
| `LoggerBrowser`, `LoggerType` | `LoggerFactory.createForBrowser(title, isDev)` — у `LoggerType` замены нет (уберите импорт; уровнями управляет `LoggerFactory`). |
**Члены `AjaxResult` для постраничной выборки НЕ объявлены устаревшими.** `#isMore()`,
`#hasMore()`, `#getTotal()`, `#getNext()` и `#fetchNext()` когда-то числились к
удалению в `3.0.0`; этот план отозван. `restApi:v2` в ближайшее время не уйдёт, а
удаление работающих там методов сломало бы действующий код без выгоды — при этом
у `#getTotal()` замены нет вовсе: `SuccessPayload` намеренно опускает `total`,
хелперы списков итерируют, не раскрывая его, а действие `aggregate` есть только в
`restApi:v3`.

Все пять методов — **только для `restApi:v2`**, именно под это и нужно генерировать
код. В `restApi:v3`: `#getTotal()` возвращает `0`, а `#isMore()` — `false`, **потому
что поле отсутствует** (а не «нет строк» / «больше нет страниц» — не ветвитесь по
ним), а `#getNext()` / `#fetchNext()` **бросают**
`JSSDK_CORE_METHOD_NOT_SUPPORT_IN_API_V3`. Для нового кода постраничной выборки
предпочитайте `actions.v{2,3}.{callList,fetchList}` — они скрывают учёт смещения
и работают в обеих версиях. Для подсчёта в `restApi:v3` используйте
`actions.v3.aggregate.make` (`@experimental` — контракт измерен, но **ни один
поставляемый модуль не публикует действие `*.aggregate` ни на одном из четырёх
проверенных порталов**) с `count` / `countDistinct` для метода, у которого есть
действие `*.aggregate` — проверьте `rest.documentation.openapi` и найдите пути,
оканчивающиеся на `.aggregate`, чтобы убедиться, что конечная точка существует;
иначе сводите `callList` на стороне клиента.
**Каждое агрегируемое поле должно быть `filterable`**, а это не то же самое, что
доступное для выборки: поле, которое `list` спокойно возвращает, всё равно
отклоняется в `select` агрегации, если `<entity>.field.list` не сообщает для него
`filterable: true`. В `tasks.task` это одно поле из девяноста пяти, так что
спрашивайте, а не предполагайте. Отказ приходит **мягко** (`isSuccess === false`,
без исключения — 4xx в оболочке v3) как
`BITRIX_REST_V3_EXCEPTION_VALIDATION_REQUESTVALIDATIONEXCEPTION` с указанием поля
в `validation[].field`. Сопоставляйте по коду и полю, но не по сообщению: оно
локализовано.

`AjaxResult.getData()` возвращает ровно `{ result: T, time: PayloadTime }` —
поля `next` и `total`, существующие только в v2, больше не раскрываются в
публичном типе.


## Фронтенд в Битрикс24 (TypeScript, ESM)

Используйте, когда приложение работает внутри Битрикс24 как iframe-встройка (placement). SDK инициализируется обменом сообщениями с родительским окном и автоматически подставляет токены авторизации.

Минимальный контракт

- `initializeB24Frame(options?: { restrictionParams?, httpOptions? }): Promise<B24Frame>` — `httpOptions` — конфигурация axios (прежде всего `adapter`: браузер получает `fetch`, `{ adapter: 'xhr' }` возвращает прежнее поведение) — допускаются только ключи из белого списка, остальные отбрасываются при создании, а их имена логируются; побеждают параметры первого вызова, повторный вызов возвращает уже созданный фрейм
- `B24Frame.isInit`: boolean (после инициализации)
- Автоматическое обновление авторизации при 401 (токен истёк или недействителен)

Пример: инициализация, вызов REST, освобождение ресурсов

```ts
import {
  initializeB24Frame,
  B24Frame,
  EnumCrmEntityTypeId,
  Text,
  LoggerFactory,
  Result,
  type ISODate
} from '@bitrix24/b24jssdk'

const logger = LoggerFactory.createForBrowser('MyApp', import.meta.env?.DEV === true)
let $b24: B24Frame

async function boot() {
  $b24 = await initializeB24Frame()

  // Single method
  const companies = await $b24.actions.v2.call.make({
    method: 'crm.item.list',
    params: {
      entityTypeId: EnumCrmEntityTypeId.company,
      order: { id: 'desc' },
      select: ['id', 'title', 'createdTime']
    }
  })
  logger.info('items', { items: companies.getData().result })

  // Batch (object syntax, with keys). The generic names ONE command's payload;
  // the result is keyed by command name, and the overloads work that out from
  // the arguments. Since 3.0.0 `Result<T>` defaults to `unknown` rather than
  // `any`, so reading a field off an un-narrowed result is a compile error —
  // name the payload, as here.
  type CompanyRow = { id: string, title: string, createdTime: string }
  const batch = await $b24.actions.v2.batch.make<{ items: CompanyRow[] }>({
    calls: {
      CompanyList: {
        method: 'crm.item.list',
        params: {
          entityTypeId: EnumCrmEntityTypeId.company,
          order: { id: 'desc' },
          select: ['id', 'title', 'createdTime']
        }
      }
    },
    options: { isHaltOnError: true }
  })
  // No cast: `batch.make` is overloaded, so passing named commands without
  // `returnAjaxResult` resolves to a record keyed by command name (#518).
  const data = batch.getData()
  const list = (data?.CompanyList?.items ?? []).map(it => ({
    id: Number(it.id),
    title: it.title,
    createdTime: Text.toDateTime(it.createdTime as ISODate)
  }))
  logger.info('batch list', { list })
}

function teardown() {
  $b24?.destroy()
}
```

Полезные геттеры и сервисы B24Frame

- auth: getAuthData(), refreshAuth(), isAdmin; getAppSid()
- parent: fitWindow(), resizeWindow(w,h), resizeWindowAuto(node?, minH?, minW?), setTitle(title), closeApplication(), reloadWindow(), scrollParentWindow(scroll)
- slider: getUrl(path), openPath(url[, width]), openSliderAppPage(params), closeSliderAppPage()
- dialog: selectUser(), selectUsers()  [selectAccess(), selectCRM() устарели]
- placement: title, options, isSliderMode, getInterface(), bindEvent(event, cb), call(command, params), callCustomBind(command, params?, cb)
- options: appGet/set, userGet/set
- getLang(): язык интерфейса портала

Паттерны

- Всегда дожидайтесь initializeB24Frame() перед любым вызовом.
- Уничтожайте фрейм при размонтировании страницы или компонента через $b24.destroy().
- Для больших выборок предпочитайте `actions.v{2,3}.callList.make` (сбор) или `actions.v{2,3}.fetchList.make` (потоковая передача).
- Для больших пакетов используйте `actions.v{2,3}.batchByChunk.make`, чтобы соблюдать лимиты.
- Для тысяч команд на тарифе с отложенными пакетами (deferred batch) `actions.v3.deferredBatch.make({ calls, onStatus })` выполняет их одним фоновым заданием на портале и возвращает декодированные строки; `add` / `get` / `waitFor` / `download` / `delete` — отдельные шаги. Команды должны быть методами v3 (метод v2 отклоняется с `INVALID_METHOD`), а одна упавшая команда проваливает всё задание без файла результата — используйте страницы списков, а не `get` на каждый id. См. документацию: actions/deferred-batch.
- `result` отдельной команды внутри пакета (batch) может быть `null`, когда нижележащий REST-метод законно возвращает `null` (например, `im.chat.get` с неподходящими параметрами). Объявляйте дженерик как `T | null` и обрабатывайте ветку `null` — SDK больше не приводит его к `{}` (см. issue #23).
- Пакет (batch) в `restApi:v3` — всё или ничего: ошибки отдельных команд не возвращаются. Если падает любой вызов, падает весь пакет, а ошибка доступна в `response.getErrorMessages()`.


## Фронтенд через UMD (CDN)

Если собрать ESM нельзя, загрузите глобальный B24Js из CDN внутри iframe-приложения.

```html
<script src="https://unpkg.com/@bitrix24/b24jssdk@3/dist/umd/index.min.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const logger = B24Js.LoggerFactory.createForBrowser('MyApp', true)
      const $b24 = await B24Js.initializeB24Frame()

      const res = await $b24.actions.v2.batch.make({
        calls: {
          CompanyList: {
            method: 'crm.item.list',
            params: {
              entityTypeId: B24Js.EnumCrmEntityTypeId.company,
              order: { id: 'desc' },
              select: ['id', 'title', 'createdTime']
            }
          }
        },
        options: { isHaltOnError: true }
      })

      logger.info('data', { data: res.getData() })
    } catch (e) {
      console.error(e)
    }
  })
</script>
```

Глобальные объекты UMD

- B24Js.initializeB24Frame
- B24Js.B24Frame и менеджеры через свойства (auth, parent, slider, dialog, placement, options)
- Утилиты: LoggerFactory, Text, Type, перечисления (например, EnumCrmEntityTypeId), Result, AjaxError/AjaxResult и др.


## Бэкенд и сервисы (Node.js, ESM) с B24Hook

Используйте B24Hook для вызова REST Битрикс24 с серверов и из скриптов через входящий вебхук. Авторизация встроена в путь вебхука, фрейм не нужен.

Минимальный контракт

- new B24Hook({ b24Url, userId, secret }) or B24Hook.fromWebhookUrl(url)
- actions.v{2,3}.{call,callList,fetchList,batch,batchByChunk}.make

Пример: создание из URL вебхука и вызов API

```ts
import {
  B24Hook,
  EnumCrmEntityTypeId,
  LoggerFactory,
  Result
} from '@bitrix24/b24jssdk'

const logger = LoggerFactory.createForBrowser('Srv', true)

const $b24 = B24Hook.fromWebhookUrl(
  'https://your_domain.bitrix24.com/rest/1/k32t88gf3azpmwv3'
)


// Single method
const res = await $b24.actions.v2.call.make({
  method: 'crm.item.list',
  params: {
    entityTypeId: EnumCrmEntityTypeId.company,
    order: { id: 'desc' }
  }
})
logger.info('companies', { companies: res.getData().result })

// Batch (array syntax)
const batch: Result = await $b24.actions.v2.batch.make({
  calls: [
    ['crm.item.list', { entityTypeId: EnumCrmEntityTypeId.company, select: ['id'] }],
    ['crm.item.list', { entityTypeId: EnumCrmEntityTypeId.contact, select: ['id'] }]
  ],
  options: { isHaltOnError: true }
})
logger.info('batch', { batch: batch.getData() })
```

Хелперы списков

```ts
import { EnumCrmEntityTypeId } from '@bitrix24/b24jssdk'

// Pull a full list with automatic paging
const list = await $b24.actions.v2.callList.make({
  method: 'crm.item.list',
  params: {
    entityTypeId: EnumCrmEntityTypeId.deal,
    select: ['id', 'title']
  },
  idKey: 'id' // crm.item.* returns a lowercase id
})
console.log(list.getData()) // array of items

// Or stream chunks
for await (const chunk of $b24.actions.v2.fetchList.make({
  method: 'crm.item.list',
  params: { entityTypeId: EnumCrmEntityTypeId.deal },
  idKey: 'id'
})) {
  console.log('chunk size', chunk.length)
}
```

Примечания

- Поддерживаемые версии Node: >=22. Node 20 исключён в 3.0.0 (EOL 2026-04-30).
- B24Hook предупреждает при использовании на клиенте; держите его на сервере.


## Интеграции с интерфейсом во фрейме (слайдеры, диалоги, родительское окно)

Для них нужен B24Frame (то есть работа внутри iframe встройки Битрикс24).

Слайдеры

```ts
// Open a portal path in a slider
const url = $b24.slider.getUrl('/crm/deal/details/1')
const result = await $b24.slider.openPath(url, 1640)
if (result.isOpenAtNewWindow) {
  // On mobile, falls back to window.open and returns close status after polling
}

// Open your application page as a slider. Settles with '' when the slider is CLOSED
$b24.slider.openSliderAppPage({ some: 'params' }).then(() => { /* the slider was closed */ }).catch(() => {})
// Inside the slider (never settles; prefer the portal's close button, #486)
$b24.slider.closeSliderAppPage().catch(() => {})
```

Диалоги

```ts
const user = await $b24.dialog.selectUser()         // null | { id, name, ... }
const users = await $b24.dialog.selectUsers()       // SelectedUser[]
// selectAccess() and selectCRM() exist but are deprecated
```

Родительское окно и интеграции с IM

```ts
await $b24.parent.fitWindow()
await $b24.parent.setTitle('My Page')        // in-page #pagetitle, not the browser tab
await $b24.parent.scrollParentWindow(0)
await $b24.parent.imCallTo(5, true)          // video call to user 5
await $b24.parent.imOpenMessenger('chat12')  // open messenger
```

API встройки (placement)

```ts
// Placement meta
console.log($b24.placement.title, $b24.placement.options, $b24.placement.isSliderMode)

// Query interface capabilities
const iface = await $b24.placement.getInterface()

// Bind placement events or custom commands
await $b24.placement.bindEvent('onMessage', (...args) => console.log(args))
await $b24.placement.call('someCommand', { foo: 'bar' })
await $b24.placement.callCustomBind('someCommand', { opt: 1 }, (...args) => {})
```

Опции

```ts
// App-level
await $b24.options.appSet('installComplete', true)
const appFlag = $b24.options.appGet('installComplete')

// User-level
await $b24.options.userSet('theme', 'dark')
const theme = $b24.options.userGet('theme')
```

Авторизация и окружение

```ts
const auth = $b24.auth.getAuthData() // { access_token, refresh_token, expires_in, domain, member_id } | false
if (!auth) {
  await $b24.auth.refreshAuth()
}
const lang = $b24.getLang()          // portal UI language
const sid = $b24.getAppSid()         // app SID in current session
```


## Хелперы и клиент Pull

SDK поставляется с высокоуровневым хелпером для предзагрузки данных портала и приложения и для работы с клиентом Pull.

Шаблон инициализации (после инициализации B24Frame)

```ts
import { initializeB24Frame, useB24Helper, LoadDataType, type TypePullMessage } from '@bitrix24/b24jssdk'

const {
  initB24Helper,
  destroyB24Helper,
  getB24Helper,
  usePullClient,
  useSubscribePullClient,
  startPullClient
} = useB24Helper()

const $b24 = await initializeB24Frame()
await initB24Helper($b24, [
  LoadDataType.Profile,
  LoadDataType.App,
  LoadDataType.Currency,
  LoadDataType.AppOptions,
  LoadDataType.UserOptions,
])

// Enable Pull
usePullClient()              // takes no arguments
useSubscribePullClient((m: TypePullMessage) => {
  // handle Pull messages
}, 'application')
startPullClient()

// Access helper data and extra managers
const helper = getB24Helper()
const userId = helper.profileInfo.data.id
const uniq = $b24.auth.getUniq('prefix') // unique per member
```

Примечания

- Менеджеры хелпера: profile, app, payment, license, currency, options
- Менеджеры валют и опций внутри используют `actions.v2.batch` / `actions.v2.batchByChunk`


## Модель вызова REST и обработка ошибок

Основные утилиты REST находятся в `b24.actions.v{2,3}.*`, по одному действию на примитив:

- `call.make({ method, params, requestId? })` => `Promise<AjaxResult>`
- `batch.make({ calls, options })` => `Promise<Result>`
  - `calls` может быть объектом `{ key: { method, params } }` или массивом `[ [method, params], ... ]`
  - `options.isHaltOnError = false` накапливает ошибки (вызовы в форме объекта индексируются по метке запроса — читайте через `getErrorsByKey()` / `getErrorMessagesByKey()`); `true` останавливается на первой
  - `options.returnAjaxResult = true` возвращает `AjaxResult` для каждой команды
- `callList.make({ method, params, idKey?, cursorIdKey?, customKeyForResult? })` => `Promise<Result>` (автоматическая постраничная выборка)
- `fetchList.make({ … те же параметры … })` => `AsyncGenerator<any[]>`
- `batchByChunk.make({ calls, options })` => `Promise<Result>` (разбивает на части любое число команд)

### Выбор стратегии получения списка (рекомендации)

- `callList.make`: загружает весь набор данных в память — потолка по числу элементов нет, так что граница определяется тем, сколько вы готовы держать. Используйте для выборок, достаточно малых, чтобы поместиться в памяти, а в остальных случаях — `fetchList.make`. В v3 `limit` задаёт размер **страницы**, а не общего итога, и каждый метод применяет свой максимум: `tasks.task.list` отдаёт 50 независимо от запроса.
- `fetchList.make`: передаёт данные частями через асинхронный итератор. Используйте для больших наборов, чтобы расходовать меньше памяти.
- `call.make` (ручная постраничная выборка): управление страницами через курсор `start`, только `restApi:v2`. Используйте, когда нужен точный контроль над пакетами и собственный порядок работы. Для больших данных это обычно менее эффективно и удобно, чем `fetchList.make`.

Ниже приведены полные примеры, которые итерируют, пока не будут получены все данные.

#### A) Малые наборы данных: callList.make (всё в памяти)

Предполагается, что `$b24` уже инициализирован (B24Frame или B24Hook).

```ts
import { EnumCrmEntityTypeId, Result } from '@bitrix24/b24jssdk'

async function loadAllCompaniesSmall($b24: any) {
  // No progress callback: `callList.make` cannot know the total in advance.
  // For a percentage, stream with `fetchList.make` and take the denominator
  // from one `call.make(...).getTotal()` — see the migration guide.
  // `order` is not accepted either: cursor paging must order by the cursor.
  const response: Result = await $b24.actions.v2.callList.make({
    method: 'crm.item.list',
    params: {
      entityTypeId: EnumCrmEntityTypeId.company,
      select: ['id', 'title']
    },
    idKey: 'id' // crm.item.* returns a lowercase id
  })

  const items = response.getData() as any[]
  // Process all items (already fully loaded in memory)
  for (const row of items) {
    // ...process row
  }

  return items
}
```

#### B) Большие наборы данных: fetchList.make (потоковая передача частями)

Для `crm.item.list` используйте `idKey: 'id'`, чтобы стратегия быстрого итератора надёжно работала с сущностями v3.

```ts
import { EnumCrmEntityTypeId } from '@bitrix24/b24jssdk'

async function loadAllDealsStreaming($b24: any) {
  const all: any[] = []

  for await (const chunk of $b24.actions.v2.fetchList.make({
    method: 'crm.item.list',
    params: {
      entityTypeId: EnumCrmEntityTypeId.deal,
      select: ['id', 'title']
    },
    idKey: 'id' // idKey for crm.item.list payloads
  })) {
    // Process current chunk
    for (const row of chunk) {
      // ...process row
    }
    all.push(...chunk)
  }

  return all
}
```

#### C) Ручная постраничная выборка: call.make + следующие страницы

> `isMore()` и `getNext()` **не** объявлены устаревшими, но оба работают только в
> `restApi:v2`: они опираются на поле оболочки `next`, которое `restApi:v3` не
> возвращает, а `getNext()` бросает исключение у клиента v3. Для итерации с
> собственным ограничением скорости предпочитайте
> `b24.actions.v{2,3}.fetchList.make`: этот хелпер скрывает постраничную выборку
> для обеих версий API.

Используйте, когда нужно управлять размерами страниц, паузами или добавить собственное ограничение скорости. Итерируйте, пока `isMore()` не вернёт false, используя `getNext($b24.getHttpClient())`.

```ts
import { EnumCrmEntityTypeId, AjaxResult } from '@bitrix24/b24jssdk'

async function loadAllContactsManual($b24: any) {
  const all: any[] = []

  // First page (start defaults to 0)
  let page: AjaxResult = await $b24.actions.v2.call.make({
    method: 'crm.item.list',
    params: {
      entityTypeId: EnumCrmEntityTypeId.contact,
      order: { id: 'asc' },
      select: ['id', 'name'],
      start: 0
    }
  })

  // Process first page
  all.push(...(page.getData().result as any[]))

  // Follow next cursors until done
  while (page.isMore()) {
    const next = await page.getNext($b24.getHttpClient())
    if (next === false) break

    // Optional: your throttling/backoff here
    // await new Promise(r => setTimeout(r, 50))

    all.push(...(next.getData().result as any[]))
    page = next
  }

  return all
}
```

Основы Result и AjaxResult

```ts
import { AjaxError } from '@bitrix24/b24jssdk'

try {
  const res = await $b24.actions.v2.call.make({ method: 'crm.item.get', params: { entityTypeId: 1, id: 10 } })
  const payload = res.getData()                  // { result, time } — see Deprecation notice
  const ok = res.isSuccess                       // boolean
  // const total = res.getTotal()                // restApi:v2 only — returns 0 on v3, which sends no `total`
} catch (e) {
  if (e instanceof AjaxError) {
    console.error(e.code, e.message, e.status, e.requestInfo)
    // restApi:v3 validation failures also name the field that failed:
    // e.validation?.forEach(d => markInvalid(d.field, d.message))
    // `field` and `message` are both optional; absent under restApi:v2.
  } else {
    console.error(e)
  }
}
```


## Рекомендуемые паттерны генерации (для ИИ)

- Фронтенд
  - Всегда проверяйте контекст фрейма; инициализируйте через await initializeB24Frame()
  - При размонтировании компонента вызывайте $b24.destroy()
  - Для действий с интерфейсом: предпочитайте $b24.slider.openPath и обрабатывайте мобильный запасной вариант через isOpenAtNewWindow в возвращаемом StatusClose
  - Вызывайте $b24.parent.fitWindow() после изменения содержимого
  - Для сохранения настроек используйте $b24.options.appSet/userSet
- Бэкенд
  - По возможности создавайте B24Hook через B24Hook.fromWebhookUrl()
  - Для больших списков используйте `actions.v{2,3}.callList` / `fetchList`
  - Связанные вызовы объединяйте в пакет через `actions.v{2,3}.batch`; большие массивы разбивайте через `batchByChunk`
- Логирование
  - Создайте один раз через LoggerFactory.createForBrowser(appName, isDev) и при необходимости передайте экземплярам
  - Передавайте контекст объектом: `logger.info('message', { key: value })`, а не дополнительными аргументами
- Типы и перечисления
  - Предпочитайте экспортируемые перечисления (например, EnumCrmEntityTypeId) и типы (ISODate, типы полезной нагрузки)


## UMD и ESM: краткая шпаргалка

- UMD: глобальный window.B24Js; загрузка через CDN unpkg; используйте внутри iframe Битрикс24
- ESM: импорт из '@bitrix24/b24jssdk'; работает в браузерах со сборщиками и в Node (на сервере) для B24Hook
- CommonJS: const { B24Hook } = require('@bitrix24/b24jssdk'); работает в проектах Node.js на CJS (полноценная CJS-сборка с внешними зависимостями, дедуплицируемыми с вашим node_modules)


## Оговорки и ограничения

- API, доступные только во фрейме (диалоги, слайдеры, placement, parent, options, обновление авторизации), требуют работы в контексте встройки Битрикс24
- openPath автоматически обрабатывает мобильные устройства: открывает новую вкладку и опрашивает статус закрытия; проверяйте возвращаемый StatusClose
- Вебхук (B24Hook) небезопасен на клиенте; держите его на сервере
- Действуют лимиты пакетов (размер части по умолчанию в SDK — 50)


## Карта экспорта (избранное)

- initializeB24Frame, B24Frame и его менеджеры: auth, parent, slider, dialog, placement, options
- B24Hook (+ B24Hook.fromWebhookUrl)
- Поверхность действий: `actions.v{2,3}.{call,batch,callList,fetchList,batchByChunk}.make`; хелпер `chunkArray` в AbstractB24
- HTTP-типы и классы: AjaxResult, AjaxError, Result
- LoggerFactory, Logger, Text, Type, Browser, tools/use-formatters
- Типы и перечисления: http, b24, auth, payloads, user, slider, handler, placement, crm, catalog, bizproc, event, pull, b24-helper


---
Этот документ основан на исходниках SDK в packages/jssdk/src и документации в docs/reference и docs/guide. Используйте его как авторитетный промпт для генерации кода с этим SDK.


## Дополнительно для ИИ-агентов (хелперы, pull, ядро, инструменты)

### Методы хелпера (высокоуровневый доступ к данным)

- useB24Helper: жизненный цикл хелперов и клиента Pull в приложениях во фрейме (см. раздел выше)
- B24HelperManager: контейнер менеджеров хелпера (profile/app/payment/license/currency/options), доступных через useB24Helper
- ProfileManager: `helper.profileInfo.data` содержит сведения о текущем пользователе
- AppManager: `helper.appInfo.data` и `helper.appInfo.statusCode`
- LicenseManager: автоматически настраивает менеджер ограничений Http для enterprise
- CurrencyManager: форматирует суммы для валюты и языка
  
  ```ts
  const name = helper.currency.getCurrencyFullName('USD', 'en')
  const literal = helper.currency.getCurrencyLiteral('USD', 'en') // currency symbol/wording
  const price = helper.currency.format(1234.56, 'USD', 'en')
  ```
- OptionsManager (уровень хелпера): массовое сохранение опций через REST + необязательное уведомление через pull
 
  
  ```ts
  await helper.appOptions.save({ featureFlags: helper.appOptions.encode({ a: 1 }) }, {
    moduleId: 'application',
    command: 'FEATURES_UPDATED',
    params: { source: 'app' }
  })
  const cfg = helper.appOptions.getJsonObject('featureFlags', {})
  ```

### Push и Pull

- Хелперы клиента Pull предоставляются через useB24Helper
  
  ```ts
  const { usePullClient, useSubscribePullClient, startPullClient } = useB24Helper()
  usePullClient('prefix')
  useSubscribePullClient((m) => { /* handle */ }, 'application')
  startPullClient()
  ```

### Утилиты ядра

- AbstractB24: владеет HTTP-клиентами, поверхностью действий (`actions.v{2,3}.*`) и поверхностью инструментов
- Http: низкоуровневый транспорт; поддерживает ограничение скорости и обновление авторизации
- RestrictionManager: автоматическое ограничение скорости для соблюдения лимитов Битрикс24

// fix
  ```ts
  // Example: increase limits for enterprise (done automatically by LicenseManager)
  // $b24.setRestrictionManagerParams(ParamsFactory.getEnterprise())
  ```
 
- Генератор уникальных ID: идентификаторы запросов добавляются автоматически через Http
- Result / AjaxResult: единообразные объекты результата, агрегация ошибок. (Члены постраничной выборки `isMore`/`hasMore`/`getTotal`/`getNext`/`fetchNext` не объявлены устаревшими, но работают только в `restApi:v2` — см. раздел «Удалено в 3.0.0».)
- Список языков и LoggerFactory / Logger

### Инструменты

- Type: хелперы типов времени выполнения (isStringFilled и др.)
- Text: даты (Luxon), числа (numberFormat), UUID v7, кодирование/декодирование, преобразование регистра
  
  ```ts
  import Text from '@bitrix24/b24jssdk'
  const dt = Text.toDateTime('2024-01-01T10:00:00Z')
  const s = Text.numberFormat(12345.678, 2, '.', ' ')
  const id = Text.getUuidRfc4122()
  ```
 
- Browser: лёгкие утилиты для браузера
- useFormatters: хуки форматирования чисел и дат
- pick/omit/getEnumValue: хелперы для объектов и перечислений
