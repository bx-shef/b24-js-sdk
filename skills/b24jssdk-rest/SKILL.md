---
name: b24jssdk-rest
description: Вызов REST API Битрикс24 через b24jssdk с помощью канонического API actions.v{2,3}.*.make(). Охватывает call, batch, callList, fetchList, batchByChunk (а также нативные keyset-методы callTail/fetchTail, только v3, и фоновый deferredBatch) для обеих версий API, выбор между v2 и v3 и правила новой формы AjaxResult. Устаревший API callMethod/callBatch/callListMethod/fetchListMethod удалён в 3.0.0 — не генерируйте код против него. Используйте также на просьбы «вызвать метод REST», «сделка», «лид», «контакт», «компания», «вебхук», «пакетный запрос», «список записей», «постраничная выборка», «создать задачу», «фильтр», «идемпотентность».
---

# REST-паттерны b24jssdk (API actions)

Во всех примерах используется `$b24` типа `TypeB24`, поэтому один и тот же код работает на `B24Hook`, `B24Frame` и `B24OAuth`. API actions публикуется отдельно для каждой версии API: `$b24.actions.v2.*` и `$b24.actions.v3.*`.

> Прежний API SDK — `callMethod`, `callBatch`, `callBatchByChunk`, `callListMethod`, `fetchListMethod` — был **удалён в `3.0.0`** и больше не существует (см. `packages/jssdk/README-AI.md`, «Removed in 3.0.0»). Код, который его вызывает, не компилируется.
>
> Члены `AjaxResult` для постраничной выборки — `isMore()`, `hasMore()`, `getTotal()`, `getNext()`, `fetchNext()` — в этот набор **не** входят и не объявлены устаревшими. Они работают только в `restApi:v2`; см. «Члены постраничной выборки restApi:v2» ниже.

## Выбор версии API

SDK предоставляет и `v2`, и `v3` в `$b24.actions`. **SDK больше не хранит жёстко заданный список разрешённых методов v3** — источником истины о том, какие методы есть на портале, служит сервер (авторитетный список — собственный документ OpenAPI портала, `rest.documentation.openapi`). Поэтому `$b24.actions.v3.*` отправит *любой* метод на endpoint v3; если метод не относится к v3, сервер вернёт `METHODNOTFOUNDEXCEPTION` (мягкая ошибка в `AjaxResult`, а не исключение SDK).

Семейства методов, которые на сегодня заведомо существуют в v3 (список неисчерпывающий): `tasks.task.*` (включая `list`), `mail.*`, `humanresources.*`, `timeman.record.*` (только чтение), `main.eventlog.*` (включая нативный `tail`), `note.*`, `rest.application.*`, `rest.incomingwebhook.*`, а также инфраструктурные (`batch`, `scopes`, `rest.scope.list`, `rest.documentation.openapi`).

Практическое правило:

- По умолчанию используйте `$b24.actions.v2.*` — он работает для каждого классического метода.
- Используйте `$b24.actions.v3.*`, когда вам нужно именно представление метода в v3 (поля в camelCase, единый конверт `{result}`, нативные `tail`/курсор, выбор связей через точку). Если сомневаетесь, подтвердите наличие метода в v3 этого портала через `rest.documentation.openapi`.
- Автоопределения версии нет: прежние прослойки `callMethod`/`callBatch`, по умолчанию использовавшие v2, удалены, поэтому протокол — всегда тот, который вы назвали через `actions.v2.*` / `actions.v3.*`.

## Дерево решений

| Цель | Что использовать |
| --- | --- |
| Один REST-вызов | `actions.v{2,3}.call.make` |
| 2–50 связанных вызовов за один HTTP-обмен | `actions.v{2,3}.batch.make` |
| Много независимых вызовов (>50) | `actions.v{2,3}.batchByChunk.make` |
| Тысячи вызовов, которые могут выполняться в фоне на портале (`restApi:v3`, если позволяет тариф) | `actions.v3.deferredBatch.make` — один запрос на старт, `onStatus` для прогресса, декодированные строки в конце |
| Прочитать список, достаточно небольшой, чтобы держать его в памяти и обрабатывать там | `actions.v{2,3}.callList.make` |
| Прочитать большой список при малом расходе памяти | `actions.v{2,3}.fetchList.make` (асинхронный итератор) |
| Прочитать метод v3, у которого есть нативное действие `tail` (keyset) — например, `main.eventlog.tail` | `actions.v3.callTail.make` / `actions.v3.fetchTail.make` (только v3) |
| Агрегат (`sum`/`avg`/`min`/`max`/`count`/`countDistinct`) для метода v3, у которого есть действие `*.aggregate` | `actions.v3.aggregate.make` (только v3, **`@experimental`** — контракт измерен, но ни один поставляемый модуль пока не публикует `*.aggregate` ни на одном из измеренных порталов, поэтому, если endpoint'а нет, используйте `callList` + свёртку. Значения приходят **строками**, а `null` — когда фильтр ничего не нашёл) |

Ручной постраничной выборки больше нет — списочные помощники листают страницы за вас. Существует два механизма, и они не взаимозаменяемы:

- **`callList` / `fetchList`** *эмулируют* курсор поверх действия `list`, внедряя условие `[idField, '>', n]` в `filter` и принудительно задавая `order`. Работает для любого метода `*.list` (v2 и v3).
- **`callTail` / `fetchTail`** (только v3) управляют *нативным* действием `tail` сервера через его параметр `cursor: { field, value, order, limit }`. Используйте их, когда метод публикует endpoint `*.tail` — таких модулей немного, поэтому сначала проверьте; страница CallTail показывает, как спросить у портала, какие они. Полные страницы: [CallTail](https://b24-js-sdk.bx-shef.by/docs/actions/call-tail/), [FetchTail](https://b24-js-sdk.bx-shef.by/docs/actions/fetch-tail/). Поле курсора **не должно** присутствовать в `filter` (сервер это отклоняет), оно автоматически добавляется в `select`, а для `order: 'DESC'` требуется явное `initialValue`.

Во всех примерах используется `$b24` типа `TypeB24`, но **`actions.v3.batch` — единственное место, где три точки входа не взаимозаменяемы** — он не работает под `B24Frame`. См. антипаттерны в конце.

`filter` в v3 — это форма массива или логическая группа `FilterV3`, но никогда не объектный диалект v2 (`{ '>id': 100 }`), который портал отклоняет для каждого метода v3. Все четыре обходчика (walker) отклоняют его на стороне клиента. `callList` / `fetchList` дополнительно требуют **массив**, потому что расширяют его условием страницы, и бросают `JSSDK_ACTION_V3_LIST_FILTER_NOT_ARRAY`; `callTail` / `fetchTail` передают `filter` без изменений, поэтому голая группа там допустима, и бросает только диалект v2 — `JSSDK_ACTION_V3_TAIL_FILTER_INVALID`.

Все они — и два списочных обходчика `restApi:v2` — также бросают `JSSDK_ACTION_CURSOR_STALLED`, когда курсор, прочитанный со страницы, равен только что отправленному, и `JSSDK_ACTION_CURSOR_WENT_BACKWARDS`, когда он движется не в ту сторону (сервер, чередующий две страницы, никогда не повторяет только что отправленное значение, поэтому первый код этого не видит). И то и другое означает, что условие страницы потеряно, поэтому обход не может закончиться никогда; он отклоняется, а не собирает одни и те же страницы вечно. Обе проверки выполняются **до** остановки по концу данных, поэтому короткая повторяющаяся страница сообщается как ошибка, а не завершает обход усечённым, перекрывающимся результатом.

```ts
import { B24Hook, FilterV3 } from '@bxshefby/b24jssdk'

const b24 = B24Hook.fromWebhookUrl('https://your-portal.bitrix24.ru/rest/1/SECRET')

// list: the page condition is appended to `filter`, so wrap the group
await b24.actions.v3.callList.make({
  method: 'main.eventlog.list',
  params: { select: ['id'], filter: [FilterV3.or(['severity', '=', 'ERROR'])] },
  idKey: 'id',
  customKeyForResult: 'items'
})

// tail: `filter` is forwarded verbatim, so a bare group is accepted as-is
await b24.actions.v3.callTail.make({
  method: 'main.eventlog.tail',
  cursorField: 'id', // must NOT appear in `filter` — the SDK warns if it does
  params: { select: ['id'], filter: FilterV3.or(['severity', '=', 'ERROR']) },
  customKeyForResult: 'items'
})
```

## `call.make` — одиночный вызов

```ts
import { EnumCrmEntityTypeId } from '@bxshefby/b24jssdk'

interface CrmItem { id: number; title: string; stageId: string }

const response = await $b24.actions.v2.call.make<{ item: CrmItem }>({
  method: 'crm.item.get',
  params: {
    entityTypeId: EnumCrmEntityTypeId.deal,
    id: 42
  },
  requestId: 'deal-42'
})

if (!response.isSuccess) {
  throw new Error(response.getErrorMessages().join('; '))
}

const deal = response.getData()!.result.item
```

Для метода v3:

```ts
interface TaskItem { id: number; title: string }

const response = await $b24.actions.v3.call.make<{ item: TaskItem }>({
  method: 'tasks.task.get',
  params: { id: 1, select: ['id', 'title'] },
  requestId: 'task-1'
})
// v3 wraps a single entity as `result.item` — including tasks, where the v2
// method answered `result.task`.
const task = response.getData()!.result.item
```

### Записи, которые не должны дублироваться (`restApi:v3`)

Для метода v3, который **создаёт, изменяет или удаляет**, передавайте `idempotencyKey`.
Портал хранит успешный ответ по ключу 24 часа и
воспроизводит его вместо повторной записи — это покрывает дубликат, который политика
повторов не может предотвратить: упавший воркер, повторно запускающий своё задание, или исходящее
событие, доставленное дважды.

```ts
// The key names the OPERATION, not the attempt: two attempts at the same
// business operation must produce the same string, in any process, after any
// restart. Derive it from your own identifiers rather than minting a UUID at
// the call site — a restarted worker would mint a different one and write a
// second record.
const orderId = 1042
const responsibleId = 1

const response = await $b24.actions.v3.call.make<{ item: { id: number } }>({
  method: 'tasks.task.add',
  // creatorId and responsibleId are required by tasks.task.add
  params: { fields: { title: 'Ship it', creatorId: responsibleId, responsibleId } },
  idempotencyKey: `task-from-order-${orderId}`
})

if (response.isIdempotentReplay()) {
  // Already done earlier — nothing new was written; skip the side effects
  // (the notification, the counter, the outbound webhook) you would fire on a
  // real create.
}
```

**Случай интеграции — повторный запуск импорта.** У импорта уже есть нужный
ключ: собственный идентификатор исходной системы. Используйте его, и повторный запуск
импорта перестанет создавать дубликаты без чтения перед записью для каждой строки.

```ts
declare const rows: Array<{ externalId: string, title: string }>
declare const ownerId: number

for (const row of rows) {
  await $b24.actions.v3.call.make({
    method: 'tasks.task.add',
    params: { fields: { title: row.title, creatorId: ownerId, responsibleId: ownerId } },
    idempotencyKey: `import-task-${row.externalId}`
  })
}
```

**Но сначала проверьте, что метод существует в v3.** На облачном портале (замер 2026-11-26:
1389 методов / 25 модулей) `crm.deal.add`, `crm.lead.add`, `crm.contact.add`, `crm.company.add`
в v3 есть; на коробке по замеру 2026-09-05 (147 методов / 8 модулей, нового замера нет) CRM в v3
не было, и там запись при интеграции идёт через `crm.*` в `restApi:v2`, где заголовок игнорируется, —
для таких записей храните исходный id в поле и проверяйте его перед вставкой. Поверхность
зависит от портала и прав вебхука, снимок — нижняя граница, а не каталог. Спросите портал через
`rest.documentation.openapi`, а не предполагайте.

Ограничения: 1–255 печатаемых ASCII-символов (иначе SDK бросает
`JSSDK_HTTP_INVALID_IDEMPOTENCY_KEY` до отправки); тот же ключ с
*другим* телом отклоняется, а не дедуплицируется; ответ сохраняется только при
успехе, поэтому для долгих записей тоже держите `retryOnNetworkError: false`; `batch`
ключ не принимает; а `restApi:v2` заголовок игнорирует — транспорт v2 его отбрасывает
и выдаёт предупреждение. Полное руководство:
[Idempotency-Key](https://b24-js-sdk.bx-shef.by/docs/actions/call/#idempotency-key).

## `batch.make` — форма массива

```ts
import { EnumCrmEntityTypeId } from '@bxshefby/b24jssdk'
import type { AjaxResult } from '@bxshefby/b24jssdk'

interface Contact { id: number; name: string }

const response = await $b24.actions.v2.batch.make<{ item: Contact }>({
  calls: [
    ['crm.item.get', { entityTypeId: EnumCrmEntityTypeId.contact, id: 1 }],
    ['crm.item.get', { entityTypeId: EnumCrmEntityTypeId.contact, id: 2 }]
  ],
  options: {
    isHaltOnError: true,
    returnAjaxResult: true,
    requestId: 'batch-1'
  }
})

if (!response.isSuccess) throw new Error(response.getErrorMessages().join('; '))

// When returnAjaxResult: true, results are an array of AjaxResult<T>
const results = response.getData()! as AjaxResult<{ item: Contact }>[]
for (const r of results) {
  if (r.isSuccess) console.log(r.getData()!.result.item)
}
```

## Аргументы команды передаются в `params`, никогда в `query`

В протоколе элемент пакета v3 — это `{ method, query, as, parallel }` — `query` — это
название аргументов у портала, и именно его показывают справочник и каждый пример `curl`.
Ключ SDK — **`params`**, и он выполняет преобразование.

Пакет `v2` теряет их так же, но другим путём: там аргументы
сериализуются в строку запроса `cmd` из `params`, поэтому команда, записанная
через `query`, уходит как `method?` без чего-либо после. Измерено на `user.get` с
`filter: { ACTIVE: 'N' }` на портале, единственный пользователь которого активен: при `params`
портал ответил 0 строк — фильтр сработал, — а тот же запрос,
записанный через `query`, ответил 1 строкой — активным пользователем, которого фильтр
должен был исключить.

```ts
// ✅
await $b24.actions.v3.batch.make({ calls: [{ method: 'main.eventlog.list', params: { select: ['id'] } }] })

// ❌ arguments read by nobody — the command goes out with an empty `query`, which
// the portal accepts. Measured on main.eventlog.list with select+limit: 2 rows of
// 1 field under `params`, 50 rows of 13 fields spelled `query` — the whole
// default page, HTTP 200, no error. A wrong answer, not a failure.
await $b24.actions.v3.batch.make({ calls: [{ method: 'main.eventlog.list', query: { select: ['id'] } } as never] })
```

Новый объектный литерал — это ошибка компиляции. Литерал, сначала присвоенный переменной,
или команды, собранные из объекта конфигурации, `JSON.parse` или обычного
JavaScript, — нет: SDK вместо этого предупреждает во время выполнения, по одной строке на каждый пакетный
запрос, называя проигнорированные ключи и команды, которые их несли. Он предупреждает только там, где
аргументы действительно потеряны: у команды нет `params` или в ней назван `query`.
Ваши собственные `id` или `label` рядом с заполненным `params` не затрагиваются.

## `batch.make` — форма с именованным объектом

```ts
import type { AjaxResult } from '@bxshefby/b24jssdk'
interface Contact { id: number; name: string }
interface Deal { id: number; title: string }

const response = await $b24.actions.v2.batch.make<{ item: Contact } | { item: Deal }>({
  calls: {
    Contact: { method: 'crm.item.get', params: { entityTypeId: 3, id: 1 } },
    Deal: ['crm.item.get', { entityTypeId: 2, id: 2 }]
  },
  options: { isHaltOnError: true, returnAjaxResult: true, requestId: 'batch-named' }
})

const data = response.getData()! as Record<string, AjaxResult<{ item: Contact } | { item: Deal }>>
console.log(data.Contact.getData()!.result.item)
console.log(data.Deal.getData()!.result.item)
```

## `batch.make` — частичные ошибки (только v2)

Задайте `isHaltOnError: false`, чтобы собирать сбои отдельных команд. **Пакет v3 — «всё или ничего»** — частичные ошибки не показываются. Если какая-либо команда в пакете v3 падает, падает весь пакет (см. `README-AI.md`, «Limitations»).

Чтобы передать вывод одной команды v3 в более позднюю, дайте ей псевдоним `as` и сошлитесь на него маркерами `BatchRefV3` (`import { BatchRefV3 } from '@bxshefby/b24jssdk'`): `BatchRefV3.ref('alias.item.id')` (одно значение) или `BatchRefV3.refArray('alias.id')` (поле, собранное по `items[]` псевдонима). Подстановку выполняет сервер.

```ts
import type { AjaxResult } from '@bxshefby/b24jssdk'
const response = await $b24.actions.v2.batch.make<{ item: Contact }>({
  calls: arrayOfCalls,
  options: { isHaltOnError: false, returnAjaxResult: true }
})

const items = response.getData()! as AjaxResult<{ item: Contact }>[]
const successes = items.filter((r) => r.isSuccess)
const failures = items.filter((r) => !r.isSuccess).map((r) => r.getErrorMessages().join('; '))
```

Для вызовов с **объектом / именованными командами** (`calls: { name: { method, params } }`) внешний `Result` индексирует каждый сбой по имени команды — используйте `response.getErrorsByKey()` / `getErrorMessagesByKey()`, чтобы получить карту `{ name: error }`, вместо перебора результатов по элементам.

## `batchByChunk.make` — большие пакеты

Размер части — 50 согласно ограничению пакета Битрикс24. Действие делит и заново собирает:

```ts
import { EnumCrmEntityTypeId } from '@bxshefby/b24jssdk'
import type { BatchCommandsArrayUniversal } from '@bxshefby/b24jssdk'

const calls: BatchCommandsArrayUniversal = ids.map((id) =>
  ['crm.item.get', { entityTypeId: EnumCrmEntityTypeId.deal, id }] as const
)

const response = await $b24.actions.v2.batchByChunk.make<{ item: CrmItem }>({
  calls,
  options: { isHaltOnError: false, requestId: 'bulk-1' }
})

if (!response.isSuccess) throw new Error(response.getErrorMessages().join('; '))

const data = response.getData()! // Flat array of { item: CrmItem }
const items = data.map((row) => row.item)
```

## `deferredBatch` — тысячи команд как фоновое задание (`restApi:v3`)

`rest.deferredbatch.*` портала: один `add` принимает все команды (измерено 5000, #570),
портал выполняет их в фоне, а результаты возвращаются как файл gzip JSON.
`make()` делает всё это и завершается со строками в порядке команд:

```ts
import type { BatchCommandsArrayUniversal } from '@bxshefby/b24jssdk'

// List pages, not a `get` per id: one failing command fails the whole job.
const calls: BatchCommandsArrayUniversal = Array.from({ length: 200 }, (_, i) =>
  ['tasks.task.list', { select: ['id', 'title'], order: { id: 'ASC' }, pagination: { page: i + 1, limit: 50 } }]
)

const response = await $b24.actions.v3.deferredBatch.make<{ items: Array<{ id: number, title: string }> }>({
  calls,
  onStatus: job => console.log(`job #${job.id}: ${job.status}`) // pending → processing → done
})

if (!response.isSuccess) throw new Error(response.getErrorMessages().join('; '))

const titles = response.getData()!.flatMap(page => page.items.map(task => task.title))
```

Чтобы запустить задание одним запросом, а забрать другим, используйте шаги:
`add({ calls })` → сохраните `getData()!.id` → позже `get(id)` / `waitFor(id)` →
`download(id)` → `delete(id)`. `decode(bytes)` превращает файл, который вы скачали
сами, в строки.

- Нужен тариф с отложенными пакетами; иначе `FEATURE_NOT_AVAILABLE_ON_CURRENT_PLAN` — переходите на `batchByChunk`.
- **Только методы v3**: метод v2 (`user.current`) отклоняется при `add` с `INVALID_METHOD`.
- **Всё или ничего** (измерено): одна упавшая команда (`tasks.task.get` несуществующего id) завершает задание в состоянии `error` **без файла результата** — частичных строк нет. Используйте команды, которые не могут упасть из-за данных, например страницы списка.
- Длительность зависит от метода (5000 дешёвых `get`: секунды; 500 `rest.scope.list`: больше 15 мин) — задайте `timeout`. Задание в состоянии `processing` удалить нельзя (`BATCH_PROCESSING`).
- Никогда не бросает исключение из-за того, что ответил портал: проверяйте `isSuccess`. Коды: `JSSDK_DEFERRED_BATCH_FAILED` (задание `error`; `waitFor(id)` возвращает задание с его `errorMessage`), `_TIMEOUT`, `_ABORTED` (задание продолжает выполняться — сохраните его id из `onStatus`), `_DOWNLOAD_FAILED`, `_DECODE_FAILED`, `_UNEXPECTED_RESPONSE`, `_GZIP_UNSUPPORTED`; до отправки бросается `_EMPTY`.
- Один `idempotencyKey` на запуск, а не на диапазон: по контракту идемпотентности портала (для отложенных пакетов не измерено) ключ, использованный повторно после удаления задания, воспроизвёл бы мёртвый id.
- Измерено через вебхук из Node. В браузере файл результата читается (`Access-Control-Allow-Origin: *`), но `idempotencyKey` там отклоняется (`JSSDK_HTTP_IDEMPOTENCY_KEY_BROWSER`, #573).
- `getDownloadUrl(id)` возвращает URL, содержащий секрет вебхука или токен доступа, — не логируйте его; предпочитайте `download(id)`.

## `callList.make` — небольшие списки в памяти

Проходит по **всему** набору результатов и возвращает его одним массивом — предела на число элементов нет; `limit` задаёт размер страницы, а не итог. Внутри листает курсором keyset по `cursorIdKey` (по умолчанию равен `idKey`).

В v3 `limit` — это **запрос**: каждый метод применяет собственный максимум, и короткая страница — не конец данных. Измерено — `tasks.task.list` отвечает 50 при `limit` 51, 100 и 1000, имея 60 доступных строк, и ничто в ответе не сообщает, что значение было ограничено. Обходчики терпимы к такому ограничению (они останавливаются на самой большой странице, которую вернул сервер); ручная постраничная выборка через `call.make` — нет.

```ts
import { EnumCrmEntityTypeId } from '@bxshefby/b24jssdk'
import { Text } from '@bxshefby/b24jssdk'

interface CrmItem { id: number; title: string }

const sixMonthsAgo = new Date()
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

const response = await $b24.actions.v2.callList.make<CrmItem>({
  method: 'crm.item.list',
  params: {
    entityTypeId: EnumCrmEntityTypeId.company,
    filter: {
      '=%title': 'A%',
      '>=createdTime': Text.toB24Format(sixMonthsAgo)
    },
    select: ['id', 'title']
  },
  idKey: 'id',                    // 'id' for crm.item.*; default is 'ID' for classic methods
  customKeyForResult: 'items',    // 'items' for crm.item.*; omit for classic methods
  requestId: 'companies-1'
})

if (!response.isSuccess) throw new Error(response.getErrorMessages().join('; '))

const items = response.getData()! // CrmItem[]
```

> **`order` игнорируется** в `callList.make`. Действие принудительно задаёт `order: { [cursorIdKey]: 'ASC' }` ради стабильности курсора и **пишет предупреждение**, когда вы передаёте `order` (см. предупреждение про `order` в `actions/v2/call-list.ts`). Для сужения результатов используйте `filter`.

## Ограничение обхода — `maxPages`, `signal`, `progress`

Все шесть обходчиков (`callList` / `fetchList` для обеих версий, `callTail` / `fetchTail` в v3) принимают:

| опция | что делает |
| --- | --- |
| `maxPages?: number` | Потолок. Выбрасывает `JSSDK_ACTION_MAX_PAGES_EXCEEDED` с названием метода. **По умолчанию 10 000** — страховка, а не политика (500 000 строк при размере страницы по умолчанию 50; около 83 минут при скорости выборки по умолчанию). Должно быть положительным целым, иначе при вызове выбрасывается `JSSDK_ACTION_INVALID_MAX_PAGES`. |
| `signal?: AbortSignal` | Бросает `JSSDK_ACTION_ABORTED`. Проверяется в начале каждой итерации, поэтому уже прерванный сигнал не стоит ни одного запроса. |
| `progress?` | `({ pages, rows }) => void`, **только для накапливающих обходчиков** (`callList` / `callTail`). Счётчики, а не проценты — курсорная выборка не читает общее число. Потоковые обходчики вместо этого отдают вам каждую страницу. |

Ни одна из ошибок не отбрасывает данные. Накапливающие обходчики (`callList` / `callTail`) **завершаются** с прочитанными строками и приложенной ошибкой, поэтому проверяйте `isSuccess`, а не предполагайте, что возвращённый список полон, — эти строки корректны, но неполны. `fetchList` / `fetchTail` бросают исключение, уже отдав каждую прочитанную страницу.

Зависший курсор — другое дело, и он по-прежнему бросает везде: там лишние строки — это дубликаты уже имеющихся, поэтому возвращать нечего.

```ts
const controller = new AbortController()

const response = await $b24.actions.v3.callList.make({
  method: 'main.eventlog.list',
  customKeyForResult: 'items',
  idKey: 'id',
  maxPages: 200,
  signal: controller.signal,
  progress: ({ pages, rows }) => console.log(`${pages} pages, ${rows} rows`)
})
```

Потолок по умолчанию не заменяет две защиты курсора, которые срабатывают гораздо раньше и говорят нечто более конкретное: курсор вернулся равным только что отправленному (`JSSDK_ACTION_CURSOR_STALLED`) или перешёл в значение, которое обход уже прошёл (`JSSDK_ACTION_CURSOR_WENT_BACKWARDS` — цикл любой длины где-то шагает назад, и именно этот шаг он ловит). Потолок остаётся для обхода, который по-настоящему больше ожидаемого, или такого, чей курсор SDK не может упорядочить. Строки оцениваются только при равной длине, и то лишь как цифры или как даты-время ISO-8601, указывающие тот же пояс с тем же разделителем; смена типа, id без выравнивающих нулей, значения в разном регистре при нечувствительной к регистру сортировке и метки времени, которые переставляет переход на летнее время — смещение, меняющееся при нём, или вовсе не указанное, — всё это пропускается, потому что ложное «назад» отклонило бы работающий обход.

## В `restApi:v2` условия идут в нижнем регистре `filter` — никогда `FILTER`

Относится к **обоим**: `callList.make` и `fetchList.make`.

Они листают страницы, записывая собственные `filter`, `order` и `start` в нижнем регистре, а портал оставляет только последний из двух ключей верхнего уровня, различающихся регистром. Старые списочные методы (`user.get`, `task.item.list`, …) *задокументированы* с `FILTER` / `SORT` / `ORDER` в верхнем регистре, поэтому следовать этой документации здесь — ошибка.

```ts
// ❌ conditions silently dropped — this returns every user, not employees.
// Note there is no cast here: `TypeCallParams` carries an index signature, so
// this type-checks. Nothing but the runtime warning catches it.
await $b24.actions.v2.callList.make({ method: 'user.get', params: { FILTER: { USER_TYPE: 'employee' } }, idKey: 'ID' })

// ❌ worse — half-migrated. `FILTER` is now the later key, so it overwrites the
// walker's own `>ID` cursor: the same page arrives for ever and the walk throws
// JSSDK_ACTION_CURSOR_STALLED.
await $b24.actions.v2.callList.make({ method: 'user.get', params: { filter: { USER_TYPE: 'employee' }, FILTER: { ACTIVE: 'Y' } }, idKey: 'ID' })

// ✅ moved across, uppercase key removed
await $b24.actions.v2.callList.make({ method: 'user.get', params: { filter: { USER_TYPE: 'employee', ACTIVE: 'Y' } }, idKey: 'ID' })
```

Измерено на `user.get` с четырьмя пользователями: `FILTER: { ID: 4 }` возвращает всех четырёх, `filter: { ID: 4 }` — одного. `SORT` хуже и громче — на `user.get` он заставляет собственный внедрённый `order` обходчика провалить проверку метода, и запрос бросает `ERROR_ARGUMENT` / *"Order must be a string"*. О всём этом сообщается через `warning` (#483), выдаваемое через `LoggerFactory.forcedLog`, поэтому оно доходит до `console.warn` даже с логгером по умолчанию. Это касается только `restApi:v2`; в v3 нет контракта с верхним регистром — его параметры в camelCase, а `filter` — форма массива.

## Булево значение в `filter` требует тела JSON

`false` в фильтре остаётся булевым значением, только пока тело — JSON. В form-encoded оно
становится строкой `"false"`, и портал отбрасывает условие — строки, которые вы хотели
исключить, возвращаются молча. SDK отправляет JSON и указывает заголовок в каждом
запросе, так что обычные вызовы в порядке; перехватчик запросов, установленный на
`getHttpClient(version).ajaxClient`, по-прежнему главнее, а вызов, который вы пересобираете
вручную вне SDK, должен сам задать тип содержимого. См. навык
`b24jssdk-filtering`.

## `fetchList.make` — большие списки, потоково

Асинхронный итератор, отдающий части. Та же форма, что у `callList.make`, плюс необязательный `limit` для v3.

```ts
import { EnumCrmEntityTypeId } from '@bxshefby/b24jssdk'
const generator = $b24.actions.v2.fetchList.make<CrmItem>({
  method: 'crm.item.list',
  params: {
    entityTypeId: EnumCrmEntityTypeId.deal,
    filter: { '!stageId': ['WON', 'LOSE'] },
    select: ['id', 'title', 'stageId']
  },
  idKey: 'id',
  customKeyForResult: 'items'
})

for await (const chunk of generator) {
  for (const deal of chunk) await processDeal(deal)
}
```

Для v3:

```ts
import { Text } from '@bxshefby/b24jssdk'
const generator = $b24.actions.v3.fetchList.make<EventLogItem>({
  method: 'main.eventlog.list',
  params: {
    filter: [['timestampX', '>=', Text.toB24Format(sixMonthsAgo)]],
    select: ['id', 'userId']
  },
  idKey: 'id',
  customKeyForResult: 'items',
  limit: 100
})
```

> **Обратите внимание на различие фильтров v2 и v3.** v2 использует объекты с ключами-префиксами; v3 — массивы троек `[field, op, value]` — для вложенных групп стройте их типизированным помощником `FilterV3` (`import { FilterV3 } from '@bxshefby/b24jssdk'`). См. навык `b24jssdk-filtering`.

## Шпаргалка по `idKey`, `cursorIdKey` и `customKeyForResult`

**Правило, из которого взяты значения по умолчанию: имена полей `restApi:v3` — camelCase, имена `restApi:v2` — UPPER_SNAKE.** Измерено на 108 описаниях полей двух сущностей (`tasks.task` — 95, `main.eventlog` — 13) — ни одно имя v3 не начинается с заглавной буквы. Поэтому `idKey` по умолчанию равен `'id'` в v3 и `'ID'` в v2, и это правило, а не причуда отдельного метода: ожидайте, что оно выполнится и для следующего метода.

`idKey` — поле id **в ответе** (значение из него читает курсор); `cursorIdKey` — поле **в запросе**, используемое для `order` и условия страницы `>`, по умолчанию равное `idKey`. Они различаются, только когда метод пишет id в запросе одним образом, а в ответе другим, — `tasks.task.list` **в v2** — известный случай (в запросе `ID`, в ответе `id`), и он ломается двумя разными способами в зависимости от того, какую половину вы задали неверно. Оставьте `idKey` по умолчанию `'ID'` — и курсор прочитает поле, которого нет в ответе: обход предупредит и остановится после первых 50 строк. Задайте `idKey: 'id'`, но оставьте `cursorIdKey` равным ему по умолчанию — и произойдёт обратное: чтение работает, но запрос фильтрует по `>id`, который метод игнорирует, поэтому та же страница возвращается вечно; теперь это бросает `JSSDK_ACTION_CURSOR_STALLED`, а не зависает. Задавайте оба. На endpoint **v3** тот же метод целиком в нижнем регистре (`id` в обе стороны, строки в `result.items`), поэтому переопределение не нужно.

Спрашивайте портал, а не гадайте: **`<entity>.field.list`** возвращает каждое поле с `type`, `filterable`, `sortable`, `editable` и `requiredGroups` в `result.items`; `<entity>.field.get` возвращает одно в `result.item`. Оба принимают необязательный `select`, сужающий ключи описания. Поле v3 без `Filterable` / `Sortable` **отклоняется**, а не игнорируется — `BITRIX_REST_V3_EXCEPTION_VALIDATION_REQUESTVALIDATIONEXCEPTION` с названием проблемного поля в `validation[].field`. Оно приходит **мягко** (`isSuccess === false`), а не бросается: 4xx в конверте v3 — не исключение. `Filterable` также управляет агрегатным `select`, а не только `filter`. На измеренном портале `tasks.task` показывает ровно одно фильтруемое поле: `id`.

| Метод | `idKey` (ответ) | `cursorIdKey` (запрос) | `customKeyForResult` |
| --- | --- | --- | --- |
| `crm.item.list` (v2) | `'id'` | — (= `idKey`) | `'items'` |
| `crm.deal.list`, `crm.contact.list`, … (классические v2) | `'ID'` (по умолчанию) | — (= `idKey`) | опустить (по умолчанию `result`) |
| `tasks.task.list` (v2) | `'id'` | `'ID'` | `'tasks'` |
| `tasks.task.list` (v3) | `'id'` | — (= `idKey`) | `'items'` |
| `disk.folder.getchildren` | `'ID'` (по умолчанию) | — (= `idKey`) | опустить |
| `main.eventlog.list` (v3) | `'id'` | — (= `idKey`) | `'items'` |

Неверный `customKeyForResult` заставляет `getData()` возвращать пустой массив — без ошибки. Если вы получаете `[]`, а ожидаете данные, проверьте это в первую очередь.

## AjaxResult — новая форма

```ts
const res = await $b24.actions.v2.call.make<{ item: CrmItem }>({
  method: 'crm.item.get',
  params: { entityTypeId: 2, id: 10 }
})

res.isSuccess               // boolean
res.getData()               // SuccessPayload<T> | undefined → { result, time } | undefined
res.getErrorMessages()      // string[] (preferred)
res.getErrors()             // IterableIterator<Error> (values only, no keys)
res.getErrorsByKey()        // Record<string, Error> (batch: keyed by command label, or numeric position for array-mode)
res.getStatus()             // HTTP status
res.getQuery()              // { method, params, requestId }
```

> `getData()` возвращает `undefined`, когда вызов не удался, — новая типизация вынуждает вас либо сначала проверить `isSuccess`, либо утверждать через `!`. Оба шаблона встречаются в канонических тестах SDK (`test/integration/js-docs/actions-v{2,3}.spec.ts`).

### Что возвращает `getData()` для каждого действия

Свойство `result` есть только у `call.make`. Чтение `.result` у остальных даёт `undefined` — без ошибки и предупреждения, просто значение, выглядящее как пустой ответ (#425).

| Действие | `getData()` | Как достать строку |
| --- | --- | --- |
| `call.make` | `{ result, time }` | `getData()!.result` |
| `batch.make` | карта по ключам или массив для формы массива | `getData()!.myKey` |
| `callList.make` | плоский массив | `getData()![0]` |
| `batchByChunk.make` | плоский массив | `getData()![0]` |
| `deferredBatch.make` / `.download` | плоский массив, по строке на команду | `getData()![0]` |
| `fetchList.make` | *(асинхронный генератор)* — отдаёт массивы | `for await (const chunk of …)` |

При `options.returnAjaxResult: true` каждый элемент результата пакета — это `AjaxResult`, а не сырые данные, поэтому строку достают так: `getData()!.myKey.getData()!.result`.

### Члены постраничной выборки `restApi:v2` — сохранены, но только v2

`isMore()` / `hasMore()` / `getTotal()` / `getNext()` / `fetchNext()` **не** объявлены устаревшими и **не** исчезают в `3.0.0`. Они работают напрямую с полями конверта v2 `next` / `total`.

```ts
import type { AjaxResult } from '@bxshefby/b24jssdk'
declare const response: AjaxResult<{ ID: string }[]>
const total: number = response.getTotal()   // restApi:v2 only
const more: boolean = response.isMore()     // restApi:v2 only
```

В ответе **`restApi:v3`** оба возвращают своё пустое значение — `0` и `false` — потому что v3 не присылает таких полей. Это не «ни одна строка не подошла» и не «страниц больше нет»; читать просто нечего. Никогда не ветвитесь по ним в v3.

`getNext(http)` / `fetchNext(http)` повторяют запрос со сообщённого смещения `next`. В `restApi:v3` они **бросают** `JSSDK_CORE_METHOD_NOT_SUPPORT_IN_API_V3`, а не возвращают пустое значение, потому что молчаливое `false` невозможно отличить от «последней страницы». Для нового кода постраничной выборки по-прежнему предпочитайте `callList.make` / `fetchList.make` — они скрывают учёт смещений и работают в обеих версиях.

Для счётчика в v3 используйте `actions.v3.aggregate.make` с `select: { count: ['id'] }` для метода, у которого есть действие `*.aggregate`. Счётчик приходит **строкой** (`'18'`), с ключом по функции, затем по полю — `getData()?.count?.id` — поэтому преобразуйте его через `Text.toNumber()`. Действие остаётся `@experimental`, потому что **ни один поставляемый модуль не публикует `*.aggregate`** ни на одном из четырёх проверенных порталов, а не потому, что форма неизвестна; если endpoint'а нет, сворачивайте `callList` на стороне клиента.

**Каждое агрегируемое поле должно быть фильтруемым**, что не то же самое, что выбираемое. `<entity>.field.list` сообщает флаг `filterable` для каждого поля; агрегировать можно только поля, где он `true` — в `tasks.task` это одно поле из девяноста пяти, поэтому ничего не предполагайте, а спрашивайте. Выбираемое, но не фильтруемое поле отвечает **мягким** `BITRIX_REST_V3_EXCEPTION_VALIDATION_REQUESTVALIDATIONEXCEPTION` с его названием в `validation[].field` — измерено. Сопоставляйте по коду и полю, никогда по сообщению: оно локализовано.

## Null в результате передаётся как есть

`result` отдельной команды внутри пакета может законно быть `null` (например, `im.chat.get` с не подходящими параметрами — см. issue #23). Типизируйте обобщение как `T | null` и обрабатывайте ветку null — SDK больше не приводит его к `{}`.

```ts
import type { AjaxResult } from '@bxshefby/b24jssdk'
const response = await $b24.actions.v2.batch.make<{ result: ChatInfo | null }>({
  calls: { Chat: ['im.chat.get', { chat_id: 999999 }] },
  options: { returnAjaxResult: true }
})
const chat = (response.getData() as Record<string, AjaxResult<{ result: ChatInfo | null }>>)
  .Chat.getData()!.result.result
if (chat === null) {
  // chat not found — expected branch
}
```

## Обработка ошибок — краткий шаблон

```ts
import { AjaxError, SdkError } from '@bxshefby/b24jssdk'

async function loadDeal() {
  try {
    const res = await $b24.actions.v2.call.make<{ item: Deal }>({
      method: 'crm.item.get',
      params: { entityTypeId: 2, id: 999_999 }
    })
    if (!res.isSuccess) {
      // Soft errors (rare; usually you'll see throws)
      logger.warning('non-success', { errors: res.getErrorMessages() })
      return
    }
    return res.getData()!.result.item
  } catch (e) {
    if (e instanceof AjaxError) {
      // Bitrix24 REST error
      logger.error('REST error', { code: e.code, status: e.status, message: e.message, requestInfo: e.requestInfo })
      // restApi:v3 only: `e.validation` names the field that failed, which
      // `message` does not. Both `field` and `message` are optional.
      for (const detail of e.validation ?? []) {
        logger.error('invalid field', { field: detail.field, message: detail.message })
      }
    } else if (e instanceof SdkError) {
      // SDK-level error (wrong API version, etc.)
      logger.error('SDK error', { code: e.code, message: e.message })
    } else {
      throw e
    }
  }
}
```

> **`requestInfo` безопасно логировать, потому что `AjaxError` его очищает, а не
> потому, что вызывающий код аккуратен.** Его конструктор пропускает параметры запроса через
> `redactSensitiveParams`, заменяя `auth`, `token`, `secret`, `access_token`,
> `refresh_token`, `client_secret`, `application_token`, `password`, `sessid`,
> `key` и `signature` на `***REDACTED***`. Поэтому не пересобирайте этот контекст вручную из
> исходных параметров — вручную собранный `{ method, params }` ничего этого не наследует
> и занесёт в лог действующие учётные данные.

О настройке поведения повторов/выбрасывания по кодам ошибок см. раздел про `hardErrorCodes` / `softErrorCodes` / `retryOnNetworkError` в навыке `b24jssdk-core`.

## Как узнать доступные методы v3 (OpenAPI)

Источник истины о существующих методах v3 — портал, SDK не хранит списка разрешённых. Спросите портал через `rest.documentation.openapi` — обычный вызов v3, возвращающий собственный документ OpenAPI 3.0.0 портала (каждый метод v3, доступный *на этом портале*, с полями запроса и формой ответа каждого метода). Полезно агенту перед генерацией вызова: перечислить настоящие имена методов и полей, а не гадать.

```ts
type OpenApiDoc = {
  openapi: string
  tags: Array<{ name: string, description: string }> // one per module
  paths: Record<string, { post?: { tags?: string[], requestBody?: unknown } }> // keyed by "/method.name"
}

const res = await $b24.actions.v3.call.make<OpenApiDoc>({ method: 'rest.documentation.openapi' })
if (!res.isSuccess) {
  throw new Error(res.getErrorMessages().join('; '))
}
const doc = res.getData()?.result

// every available method name
const methods = Object.keys(doc?.paths ?? {}).map(p => p.replace(/^\//, ''))

// does a method exist on this portal's v3?
const hasNotes = Boolean(doc?.paths?.['/note.collection.list'])
```

- Документ **специфичен для портала** (отражает установленные модули и права токена) и **велик** (100 КБ и больше). Получите его **один раз и кешируйте** — он только для ответа и стабилен в рамках сессии; не запрашивайте заново при каждом взаимодействии.
- Схема `paths['/method.name'].post.requestBody` каждого метода перечисляет принимаемые параметры (часто с `example` настоящих имён полей) — читайте её, а не выдумывайте поля `select`.
- Полное руководство: [Обнаружение методов v3](https://b24-js-sdk.bx-shef.by/docs/actions/discovering-v3-methods/).
- Для полей одной сущности и их флагов — более дешёвая половина того же вопроса: [Обнаружение полей сущности](https://b24-js-sdk.bx-shef.by/docs/actions/discovering-entity-fields/).

## Антипаттерны

- ❌ `$b24.callMethod(...)`, `$b24.callBatch(...)` и т. п. — удалены в 3.0.0, теперь это ошибки компиляции. Используйте API actions.
- ❌ `res.getNext()` / `res.fetchNext()` для клиента **v3** — они бросают `JSSDK_CORE_METHOD_NOT_SUPPORT_IN_API_V3`. В v2 они работают и поддерживаются; для нового кода предпочитайте `callList` / `fetchList`, которые работают в обеих версиях.
- ❌ Чтение `res.getTotal()` или `res.isMore()` в ответе **v3** — это не ошибка, но они всегда отвечают `0` / `false`, потому что v3 не присылает `total` / `next`. В v2 они корректны и поддерживаются. Для счётчика в v3 используйте `actions.v3.aggregate.make` (`count`/`countDistinct`) для метода, у которого есть действие `*.aggregate`, — помня, что счётчик — строка, а не число.
<!-- @check-ignore: `crm.item.get` is the deliberate anti-example this bullet is about — v3 publishes no `crm.item.*` -->
- ❌ Вызов `$b24.actions.v3.call.make({ method: 'crm.item.get', ... })` — `crm.*` существует только в v2, поэтому сервер v3 вернёт мягкую ошибку `METHODNOTFOUNDEXCEPTION` (`response.isSuccess === false`); для CRM используйте `actions.v2.*`. (SDK больше не бросает исключение заранее.)
- ❌ Передача `order` в `callList.make` — молча игнорируется с предупреждением. Вместо этого сужайте через `filter`.
- ❌ `customKeyForResult: 'result'` для `crm.item.list` — неверно, используйте `'items'`. Иначе молча получите пустой список.
- ❌ `idKey: 'ID'` для `crm.item.list` — неверно, используйте `'id'`. Классический `crm.deal.list` — наоборот.
- ❌ Один только `idKey: 'ID'` для `tasks.task.list` — id в ответе строчный `id`, поэтому курсор не может его прочитать, и обход предупреждает и останавливается после 50. Используйте `idKey: 'id', cursorIdKey: 'ID'`.
- ❌ Один только `idKey: 'id'` для того же метода — чтение работает, но запрос фильтрует по `>id`, который метод игнорирует, поэтому та же страница повторяется; бросается `JSSDK_ACTION_CURSOR_STALLED`. То же исправление: задайте оба.
- ❌ `Promise.all` поверх `callList.make` для параллельной постраничной выборки — внутренняя курсорная выборка последовательна по замыслу; вы получите дубликаты или пропущенные строки.
- ❌ Ручное листание списочного метода v3 по возвращаемому им `nextCursor` (например, `note.*`) — `callList` / `fetchList` листают через собственный курсор `idKey` и проходят каждую страницу; `nextCursor` носит информационный характер, и SDK его игнорирует. Просто используйте списочные помощники с `idKey` + `customKeyForResult`.
- ❌ `batch.make({ calls, isHaltOnError: false })` — флаги пакета на верхнем уровне **не применяются**. Они относятся под `options: { isHaltOnError, returnAjaxResult, requestId }`. TypeScript теперь отклоняет такой литерал, а SDK пишет предупреждение для вызывающих, которых не видит, но намерение ничто не восстановит: потерянный так `returnAjaxResult` делает `entry.isSuccess` равным `undefined` у простого объекта, поэтому пакет, где всё удалось, читается как пакет, где всё провалилось (#426).
- ❌ Чтение `getData()!.result` у `batch.make` / `callList.make` / `batchByChunk.make` — только `call.make` возвращает этот конверт. См. таблицу выше.
- ❌ Ожидание, что `idempotencyKey` защитит импорт CRM — у `crm.*` нет создания в v3, поэтому запись идёт через v2, и ключ отбрасывается с предупреждением. Проверьте `rest.documentation.openapi`, прежде чем строить на этом проект.
- ❌ Обращение к `batch.make` для массовой загрузки, которая не должна дублироваться, — пакет не несёт ключа. Выполняйте одиночные вызовы в цикле и смиритесь с потерей пропускной способности либо смиритесь с дубликатами.
- ❌ `idempotencyKey: crypto.randomUUID()`, записанный в месте вызова для задания, которое может быть повторено *другим* процессом, — перезапуск создаст новый ключ и всё равно запишет дубликат. Выводите ключ из операции (`deal-${orderId}-create`) или сохраняйте сгенерированный вместе с заданием до вызова.
- ❌ Повторное использование одного `idempotencyKey` для двух разных записей — портал отвечает HTTP 422 `…IDEMPOTENCYKEYREUSEDEXCEPTION`, а не дедуплицирует. Добавляйте префикс по операции: `deal-42-create` против `deal-42-close`.
- ⚠️ `actions.v3.batch.make` / `batchByChunk.make` из браузера (`B24Frame` или `B24OAuth` на клиенте) работает, но учётные данные идут в **строке запроса** — в v3 команды *и есть* тело запроса, так что токену внутри него места нет, а CORS preflight портала разрешает только `origin, content-type, accept`, поэтому заголовок `Authorization` отправить нельзя. Тогда токен попадает в журнал доступа портала, чего не произошло бы с телом запроса. Для пользователя он не становится открытым заново (он и так есть в JavaScript страницы), но если эта серверная запись важна, выполняйте пакет на бэкенде или используйте `actions.v2.batch.make`, где методы есть в v2. `B24Hook` ничего не добавляет — его секрет уже в пути URL.
- ❌ `B24Hook` в бандле для браузера **или воркера** — раскрывает секрет вебхука; скрипт воркера загружается по сети и читается в devtools, как любой другой. Там используйте `B24Frame`.

## Перекрёстные ссылки

О диалекте фильтров v3, сортировке и обработке NULL см. навык `b24jssdk-filtering`.
