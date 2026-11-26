---
name: b24jssdk-filtering
description: Построение параметров filter, order и select для REST-методов Битрикс24, вызываемых через API actions.v{2,3}.* из b24jssdk. Охватывает префиксный диалект v2 (>=, <=, !, %, =%), диалект v3 из массива троек ([['field', 'op', value]]) и типизированный построитель FilterV3 (eq/in/between/and/or/not/build), NOT, множественные значения (IN), даты через Text.toB24Format и правило удаления order в callList. Загружайте при построении запросов с фильтрами. Используйте также на просьбы «фильтр», «отбор записей», «сортировка», «выбрать поля», «условие по дате», «поиск сделок и лидов по фильтру», «список записей с условием».
---

# Фильтры b24jssdk

В Битрикс24 **два диалекта фильтров**. Они не взаимозаменяемы — каждая версия API принимает только свой. Выбирайте диалект, соответствующий используемому API actions.

## v2 — объект с ключами-префиксами

Используется в `$b24.actions.v2.{call,callList,fetchList}.make({ params: { filter: ... }})`. Оператор — это префикс в имени поля.

```ts
const params = {
  filter: {
    '>=opportunity': 50000,
    '<=opportunity': 200000,
    '!stageId': 'LOST',
    '=%title': 'A%'
  }
}
```

### Операторы v2

| Префикс | Значение | Пример |
| --- | --- | --- |
| (нет) | точное совпадение | `{ stageId: 'NEW' }` |
| `>=` | больше или равно | `{ '>=opportunity': 50000 }` |
| `>` | больше | `{ '>id': 100 }` |
| `<=` | меньше или равно | `{ '<=opportunity': 200000 }` |
| `<` | меньше | `{ '<closeDate': '2026-01-01' }` |
| `!` | не равно | `{ '!stageId': 'LOST' }` |
| `!=` | не равно (альтернативная запись) | `{ '!=stageId': 'LOST' }` |
| `%` | LIKE (подстрока, без учёта регистра) | `{ '%title': 'поставка' }` |
| `=%` | LIKE с явным шаблоном (`%`/`_`) | `{ '=%title': 'A%' }` |
| `!%` | NOT LIKE | `{ '!%title': 'тест' }` |

Несколько ключей объединяются через AND. Два оператора для одного поля требуют двух отдельных ключей: `{ '>=opportunity': 50000, '<=opportunity': 200000 }`.

### IN / множественные значения в v2

Обычный массив означает `IN`:

```ts
const params = { filter: { stageId: ['NEW', 'PREPARATION', 'EXECUTING'] } }
```

Для «не входит в»:

```ts
const params = { filter: { '!stageId': ['LOST', 'WON'] } }
```

## v3 — массив троек

Используется в `$b24.actions.v3.{call,callList,fetchList}.make({ params: { filter: ... }})`. Фильтр — это JSON-**массив**, каждый элемент которого — условие.

```ts
filter: [
  ['stageId', '=', 'NEW'],
  ['createdTime', '>=', '2026-01-01T00:00:00+03:00'],
  ['responsible', 'in', [1, 2, 3]]
]
```

### Операторы v3 — исчерпывающий список (только эти 8)

```text
=   !=   >   >=   <   <=   in   between
```

> На уровне протокола v3 **нет `%`, `like`, `~` и вообще оператора подстроки** — `Filtering/Operator.php` его не определяет. Поиск по подстроке сейчас доступен только в v2.

Значение `between` должно быть массивом из двух элементов: `[min, max]`.
Значение `in` должно быть массивом.

### Формы условий v3

Двухаргументная форма — синтаксический сахар:

```ts
const equals = ['id', 42]              // same as ['id', '=', 42]
const oneOf = ['stageId', ['A', 'B']]  // same as ['stageId', 'in', ['A', 'B']]
```

Длинная структурная форма поддерживает вложенные группы с логикой `or` и отрицанием (в пользовательском коде нужна редко):

```ts
filter: [
  ['status', '=', 'OPEN'],
  {
    type: 'filter',
    logic: 'or',
    negative: false,
    conditions: [
      ['priority', '=', 'HIGH'],
      ['responsible', '=', 42]
    ]
  }
]
```

Массив верхнего уровня неявно имеет `logic: 'and'`. Ключ `type: 'filter'` выше необязателен — сервер определяет его сам, — поэтому построитель `FilterV3` ниже выдаёт более короткую форму `{ logic, conditions }` (проверено вживую), и принимаются обе.

### v3 — типизированный построитель (`FilterV3`)

Для всего, что сложнее плоского списка троек, предпочитайте построитель `FilterV3` ручному написанию структур — он проверяет операторы и формы `in`/`between` на клиенте (опечатка падает сразу, а не как серверный `UNKNOWNFILTEROPERATOREXCEPTION`):

```ts
import { Text } from '@bitrix24/b24jssdk'
import { FilterV3 as F } from '@bitrix24/b24jssdk'

// status = NEW  AND  (id in [1,2]  OR  id > 100)
const filter = F.build(
  F.eq('status', 'NEW'),
  F.or(
    F.in('id', [1, 2]),
    F.gt('id', 100)
  )
)
await $b24.actions.v3.call.make({ method: 'tasks.task.list', params: { filter } })
```

- Листья: `F.eq` / `F.ne` / `F.gt` / `F.ge` / `F.lt` / `F.le` / `F.in(field, array)` / `F.between(field, from, to)`.
- Группы: `F.and(...)`, `F.or(...)`, `F.not(node)` (отрицает условие или группу).
- `F.build(...nodes)` возвращает массив верхнего уровня (объединённый через AND) для `params.filter`; ложные узлы пропускаются, поэтому `F.build(F.eq('a', 1), flag && F.gt('b', 2))` встраивает условные части.

> Внутри **пакетного запроса v3 (batch)** значение фильтра может ссылаться на вывод более раннего команды через маркер `$ref`/`$refArray` — стройте их с помощью `BatchRefV3` (`import { BatchRefV3 } from '@bitrix24/b24jssdk'`), например `['id', 'in', BatchRefV3.refArray('tasks.id')]`. Подстановку выполняет сервер; см. навык `b24jssdk-rest` / документацию по пакетным запросам v3.

## Правило `order` для callList / fetchList

И `actions.v{2,3}.callList.make`, и `fetchList.make` **удаляют переданный пользователем `order`** и принудительно ставят `{ [cursorIdKey]: 'ASC' }` (где `cursorIdKey` по умолчанию равен `idKey`), потому что действие использует курсорную постраничную выборку по ключу. Если вы передадите `order`, SDK запишет предупреждение (`callList.make: user-provided 'order' parameter is ignored…`) и отбросит его (см. предупреждение про `order` в `packages/jssdk/src/core/actions/v2/call-list.ts` и его аналог для v3).

Если нужна определённая сортировка, спуститесь до `call.make` и листайте страницы вручную — но почти наверняка вам лучше сузить фильтр.

## `order` для одиночного `call.make`

- **v2**: объект со значениями `'asc' | 'desc' | 'ASC' | 'DESC'` — `order: { id: 'asc', amount: 'desc' }`.
- **v3**: **только** объектная форма (`{ field: 'asc' | 'desc' }`). Массивы бросают `InvalidOrderException`. Поле DTO должно иметь на сервере атрибут `#[Sortable]`, иначе запрос **отклоняется**: HTTP 400 с `BITRIX_REST_V3_EXCEPTION_VALIDATION_REQUESTVALIDATIONEXCEPTION` и именем поля в `validation[].field`. (Конкретный PHP-класс — `DtoFieldRequiredAttributeException`, но он наследует этот код и своего не получает, поэтому сопоставляйте по коду и полю — никогда по сообщению, которое локализовано.) `<entity>.field.list` сообщает, какие поля `sortable`, ещё до отправки.

## Булевому условию нужно тело JSON

Булево значение в `filter` сохраняется, только если тело запроса — **JSON**. При отправке как
`application/x-www-form-urlencoded` оно приходит строкой `"false"`, условие отбрасывается,
и вызов отвечает строками, которые должен был исключить, — ошибки нет ни с одной стороны.
Измерено на `user.get` / `ACTIVE`: JSON
`{ ACTIVE: false }` → 0 строк, form-encoded → 1 строка.

SDK указывает `Content-Type: application/json` в каждом запросе отдельно, так что
это обработано — но есть два способа это испортить:

- **перехватчик запросов** на `getHttpClient(v).ajaxClient`, который задаёт
  `Content-Type`, выполняется после конфигурации SDK и меняет кодировку;
- построение того же вызова **вручную** (`curl`, тестер вебхуков, собственный клиент)
  с отправкой данных формы.

```ts
// ✅ through the SDK — JSON, so the condition holds
await $b24.actions.v2.call.make({ method: 'user.get', params: { filter: { ACTIVE: false } } })
```

## Даты

Используйте помощник SDK `Text.toB24Format(date)` — он выдаёт формат Битрикс24 `yyyy-MM-dd'T'HH:mm:ssZZ` и обрабатывает входные значения `Date | DateTime | string` (см. `Text.toB24Format` в `packages/jssdk/src/tools/text.ts`).

```ts
import { Text } from '@bitrix24/b24jssdk'

const sixMonthsAgo = new Date()
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

// v2
const paramsV2 = { filter: { '>=createdTime': Text.toB24Format(sixMonthsAgo) } }

// v3
const paramsV3 = { filter: [['createdTime', '>=', Text.toB24Format(sixMonthsAgo)]] }
```

## Имена полей — два регистра внутри v2

Одно и то же логическое поле называется по-разному в зависимости от метода:

| Логическое | Методы UPPER_SNAKE (`crm.deal.list`, …) | Методы camelCase (`crm.item.list`) |
| --- | --- | --- |
| ID | `ID` | `id` |
| Название | `TITLE` | `title` |
| Стадия | `STAGE_ID` | `stageId` |
| Сумма | `OPPORTUNITY` | `opportunity` |
| Валюта | `CURRENCY_ID` | `currencyId` |
| Создано | `DATE_CREATE` | `createdTime` |
| Изменено | `DATE_MODIFY` | `updatedTime` |
| Ответственный | `ASSIGNED_BY_ID` | `assignedById` |
| Пользовательское поле | `UF_CRM_INN` | `ufCrmInn` |

> Обе формы относятся к API v2, и ни одна не является «стилем v3»: регистр здесь зависит от метода, а не от версии API. `crm.item.*` пишется в camelCase по собственным причинам и **не** является методом v3 — v3 вообще не публикует `crm.item.*`. В `restApi:v3` camelCase *и есть* правило, без исключений среди измеренных 108 описаний полей; если сомневаетесь, спросите `<entity>.field.list`. Используйте один и тот же регистр в `filter`, `select` и (где применимо) `order`. Смешение стилей молча ломает постраничную выборку.

Полное руководство: [Discovering entity fields](https://bitrix24.github.io/b24jssdk/docs/working-with-the-rest-api/discovering-entity-fields/) — как спросить у сущности её собственный список полей и почему поле с `filterable: false` отклоняется, а не игнорируется.

## Select

Всегда передавайте `select`, чтобы ограничить размер ответа:

```ts
select: ['id', 'title', 'stageId', 'opportunity', 'currencyId']
```

Пользовательские поля перечисляйте явно. В v3 точечный синтаксис раскрывает связи:

```ts
// v3 only
select: ['id', 'title', 'responsible.name', 'responsible.email']
```

## Примеры

### v2 — открытые сделки в диапазоне сумм

```ts
import { EnumCrmEntityTypeId } from '@bitrix24/b24jssdk'
const response = await $b24.actions.v2.callList.make<CrmItem>({
  method: 'crm.item.list',
  params: {
    entityTypeId: EnumCrmEntityTypeId.deal,
    filter: {
      '!stageId': ['WON', 'LOSE'],
      '>=opportunity': 50000,
      '<=opportunity': 200000
    },
    select: ['id', 'title', 'stageId', 'opportunity']
  },
  idKey: 'id',
  customKeyForResult: 'items'
})
```

### v2 — контакты по подстроке телефона

```ts
import { EnumCrmEntityTypeId } from '@bitrix24/b24jssdk'
const response = await $b24.actions.v2.callList.make<CrmItem>({
  method: 'crm.item.list',
  params: {
    entityTypeId: EnumCrmEntityTypeId.contact,
    filter: { '%phone': '+7916' },
    select: ['id', 'name', 'lastName', 'phone']
  },
  idKey: 'id',
  customKeyForResult: 'items'
})
```

### v2 — незавершённые задачи

```ts
const response = await $b24.actions.v2.callList.make<TaskItem>({
  method: 'tasks.task.list',
  params: {
    filter: { '!REAL_STATUS': 5 }, // 5 = COMPLETED
    select: ['ID', 'TITLE', 'STATUS', 'RESPONSIBLE_ID']
  },
  idKey: 'id',                   // tasks.task.list returns lowercase id
  cursorIdKey: 'ID',             // ...but sorts / filters by uppercase ID
  customKeyForResult: 'tasks'
})
```

### v3 — журнал событий за последние 6 месяцев

```ts
import { Text } from '@bitrix24/b24jssdk'
const sixMonthsAgo = new Date()
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
sixMonthsAgo.setHours(0, 0, 0, 0)

const response = await $b24.actions.v3.callList.make<EventItem>({
  method: 'main.eventlog.list',
  params: {
    filter: [['timestampX', '>=', Text.toB24Format(sixMonthsAgo)]],
    select: ['id', 'userId']
  },
  idKey: 'id',
  customKeyForResult: 'items',
  limit: 200
})
```

### v3 — IN / between

```ts
import { Text } from '@bitrix24/b24jssdk'
filter: [
  ['responsibleId', 'in', [1, 2, 3]],
  ['createdTime', 'between', ['2026-01-01T00:00:00+03:00', '2026-03-31T23:59:59+03:00']]
]
```

## Мультиворонки (CRM)

На порталах с несколькими воронками идентификаторы стадий приходят с префиксом: `C2:WON`, `C4:LOSE`. Стратегии:

- Фильтровать по ID категории и базовой стадии: `filter: { categoryId: 2, stageId: 'NEW' }`.
- Явно перечислять полный список: `filter: { stageId: ['C2:WON', 'C4:WON'] }`.
- Не рассчитывать, что голое `'NEW'` совпадёт во всех воронках, — прочитайте актуальный список стадий через `crm.dealcategory.stage.list`.

## Антипаттерны

- ❌ `filter: { stageId: { $gte: 100 } }` — стиль MongoDB. Битрикс24 его не понимает, вернётся 400.
- ❌ `filter: [['title', 'like', 'A%']]` — `like` нет в наборе операторов v3. Для поиска по подстроке используйте v2 + `=%`.
- ❌ Ручная сборка вложенных групп v3 (`{ logic, conditions }`) — используйте построитель `FilterV3`, который проверяет операторы и формы `in`/`between` на клиенте.
- ❌ Передавать одно условие как `params.filter` (`filter: F.eq('a', 1)`) — `filter` должен быть **массивом**; оберните его: `filter: F.build(F.eq('a', 1))` (или `[F.eq('a', 1)]`).
- ⚠️ Требование массива относится только к `callList` / `fetchList`. Они добавляют условие страницы в `filter`, поэтому расширить можно только массив (`JSSDK_ACTION_V3_LIST_FILTER_NOT_ARRAY`). `callTail` / `fetchTail` передают `filter` без изменений, а портал принимает голую логическую группу как весь фильтр, поэтому `filter: F.or(...)` там допустим — отклоняется только объектный диалект v2 (`JSSDK_ACTION_V3_TAIL_FILTER_INVALID`). См. [CallTail](https://bitrix24.github.io/b24jssdk/docs/working-with-the-rest-api/call-tail-rest-api-ver3/) и [FetchTail](https://bitrix24.github.io/b24jssdk/docs/working-with-the-rest-api/fetch-tail-rest-api-ver3/) — и учтите, что эндпоинт `*.tail` встречается редко, поэтому сначала проверьте, есть ли он у метода. Оборачивание в массив работает везде, так что оборачивайте, если хотите единую привычку.
- ❌ Передавать `order` в `callList.make` / `fetchList.make` — молча отбрасывается с предупреждением.
- ❌ Смешивать `STAGE_ID` и `stageId` в `filter` и `select` — это разные поля в разных методах.
- ❌ Забывать часовой пояс в строках дат — порталы Битрикс24 настроены на свой часовой пояс. Используйте `Text.toB24Format()`, чтобы сохранять согласованность.
- ❌ Использовать фильтр v3 из массива троек для `actions.v2.*` — молча неверно разбирается и возвращает неправильные результаты.
- ❌ Использовать префиксный фильтр v2 для `actions.v3.*` — возвращает `UnknownFilterOperatorException`.
