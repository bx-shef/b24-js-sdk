# Транспорты и результаты

<sub>Последняя проверка: 2026-09-08.</sub>

> **Зеркало для агентов:** та же область с точки зрения агентов, пишущих код использования, лежит в [`skills/b24jssdk-rest/SKILL.md`](../../skills/b24jssdk-rest/SKILL.md), [`skills/b24jssdk-filtering/SKILL.md`](../../skills/b24jssdk-filtering/SKILL.md) и [`skills/b24jssdk-core/SKILL.md`](../../skills/b24jssdk-core/SKILL.md). Держите это руководство и эти навыки синхронными, когда меняется базовый API.

Это «дизайн-токены» SDK — сквозные типы и политики, которым должно следовать любое изменение, затрагивающее транспорт. Прочитайте это, прежде чем добавлять пути HTTP-кода, типы ошибок или логику лимитеров.

## Файлы

```text
packages/jssdk/src/core/
├── result.ts                            # Result<T> — uniform return type
├── sdk-error.ts                         # SdkError — invariant violations
├── actions/                             # public action surface: b24.actions.vX.<name>.make()
│   ├── v2/                              # call / batch / call-list / fetch-list (REST v2)
│   └── v3/                              # same shape for REST v3
└── http/
    ├── abstract-http.ts                 # AbstractHttp implements TypeHttp
    ├── ajax-result.ts                   # AjaxResult — Result + paging
    ├── ajax-error.ts                    # AjaxError — HTTP-level errors
    ├── v2.ts                            # REST v2 transport
    ├── v3.ts                            # REST v3 transport
    └── limiters/
        ├── rate-limiter.ts              # client-side QPS cap
        ├── operating-limiter.ts         # server "operating reset" handling
        ├── adaptive-delayer.ts          # dynamic backoff
        └── params-factory.ts            # ParamsFactory — preset bundles
```

## Тип Result

`Result` — единый тип возвращаемого значения для каждого предметного метода. Он несёт данные, ошибки и (для постраничных конечных точек) указатель на следующую страницу. **Никогда не возвращайте сырые ответы axios.**

// @check-ignore: SDK-internal excerpt; the import is relative to `packages/jssdk/src/<area>/` and the real file is compiled by `package-jssdk:typecheck`

```ts
import { Result } from '../core/result'

async function load(): Promise<Result> {
  // build payload …
  return new Result(payload)
}
```

> Пример с проверкой компиляции: [`transports-and-results-result-type.ts`](../../test/some-code-from-docs/contributing/transports-and-results-result-type.ts)

Вызывающий код использует его через поверхность действий (`b24.actions.vX.<action>.make({ ... })`):

```ts
const result = await b24.actions.v3.call.make({
  method: 'user.get',
  params: { ID: 1 },
  requestId: 'app/user.get'
})

if (!result.isSuccess) {
  // result.getErrorMessages() / result.getErrors() — see below
}

const user = result.getData().result
```

`AjaxResult` расширяет `Result` для транспортных вызовов и добавляет постраничную выборку — только v2:

```ts
import { ApiVersion } from '@bxshefby/b24jssdk'

const result = await b24.actions.v2.call.make({
  method: 'crm.deal.list',
  params: { filter: {}, select: ['ID', 'TITLE'] }, // filter: {} — replace with any valid filter object
  requestId: 'app/crm.deal.list'
})

if (result.isMore()) {
  const next = await result.getNext(b24.getHttpClient(ApiVersion.v2)) // continues the cursor
}
```

> Пример с проверкой компиляции: [`test/some-code-from-docs/contributing/transports-and-results-paging.ts`](../../test/some-code-from-docs/contributing/transports-and-results-paging.ts)

- Передавайте в `getNext()` http-клиент (из `b24.getHttpClient(version)`) — это сохраняет тот же стек лимитеров.
- **Не** организуйте цикл по сырым параметрам `start`; используйте `isMore()` + `getNext()`.
- **v3 не поддерживает `getNext()`** — он бросает `restApi:v3 not support method getNext`. Для постраничной выборки в v3 используйте `b24.actions.v3.callList.make()` или `b24.actions.v3.fetchList.make()`.
- Устаревшие сокращения в `AbstractB24` (`b24.callMethod`, `callListMethod`, `fetchListMethod`, `callBatch`, `callBatchByChunk`) были **удалены в 3.0.0** (#277). Используйте `b24.actions.v{2,3}.*.make(options)`; см. [руководство по миграции](../../docs/content/docs/1.getting-started/3.migration/2.v3.md).

## Типы ошибок

Два класса ошибок, две цели:

| Класс | Назначение | Как проявляется |
| --- | --- | --- |
| `SdkError` | Нарушения инвариантов уровня SDK (неверные аргументы, недопустимое состояние, отсутствующая конфигурация) | Бросается из публичных методов |
| `AjaxError` | Ошибки HTTP / REST API (4xx, 5xx, некорректные данные) | Возвращается через `Result.getErrors()` |

```ts
import { SdkError, AjaxError } from '@bxshefby/b24jssdk'

declare const url: string | undefined
declare const payload: Record<string, unknown>

// SdkError — throw on guard failures inside the SDK.
// The constructor takes a SdkErrorDetails object, not a string.
if (!url) {
  throw new SdkError({
    code: 'B24_HOOK_URL_REQUIRED',
    description: 'B24Hook.fromWebhookUrl: url is required',
    status: 400
  })
}

// AjaxError — never throw it manually; the transport layer constructs it.
const result = await b24.actions.v3.call.make({
  method: 'crm.lead.add',
  params: payload,
  requestId: 'app/crm.lead.add'
})
const [err] = result.getErrors()
if (err instanceof AjaxError) {
  // AjaxError exposes .code (string), .status (number), .message (string).
  // Note: getCode(), getStatus(), getDescription() do not exist on AjaxError.
}
```

> Пример с проверкой компиляции: [`test/some-code-from-docs/contributing/transports-and-results-error-handling.ts`](../../test/some-code-from-docs/contributing/transports-and-results-error-handling.ts)

Правила:

- Публичные методы могут бросать `SdkError`. Они не должны бросать голый `Error` или строки.
- Публичные методы никогда не должны бросать `AjaxError` — транспорт выводит его через `Result`.
- Новый класс ошибки принадлежит `src/core/` рядом с `SdkError`. Не разносите тип по другим каталогам.
- Добавляя новый код ошибки, задокументируйте его на соответствующей странице документации в разделе «Обработка ошибок» или «Ограничения», чтобы вызывающие могли его распознать.

## HTTP-транспорты

Два транспорта, одна общая база. Оба принадлежат `AbstractB24` и доступны через `b24.getHttpClient(ApiVersion.v2)` / `b24.getHttpClient(ApiVersion.v3)`. Поля **`b24.http` нет** — всегда обращайтесь через `getHttpClient(version)`, чтобы выбирался правильный транспорт / стек лимитеров.

| Транспорт | Файл | Форма конечной точки |
| --- | --- | --- |
| v2 | `packages/jssdk/src/core/http/v2.ts` | `https://<portal>/rest/<method>.json` (устаревшая, устаревание идёт) |
| v3 | `packages/jssdk/src/core/http/v3.ts` | `https://<portal>/rest/v3/<method>` (новые маршруты, внедрение идёт — см. [apidocs.bitrix24.com/api-reference/rest-v3](https://apidocs.bitrix24.com/api-reference/rest-v3/index.html)) |

Когда метод доступен **и** в v2, и в v3, SDK пишет предупреждение, призывающее перейти на v3. Не заглушайте это предупреждение.

Выбор транспорта при добавлении действий:

- Если метод REST есть в v3, предпочитайте v3.
- Если действие только для v2, поместите его в `src/core/actions/v2/`.
- Только для v3 — в `src/core/actions/v3/`.
- Файлы повторяют имя действия (`call.ts`, `batch.ts`, `call-list.ts`, `fetch-list.ts`).

Базовый класс `AbstractHttp` (`packages/jssdk/src/core/http/abstract-http.ts`, реализует `TypeHttp`) владеет повторами, пакетными запросами и интеграцией с лимитерами — расширяйте его, а не дублируйте эти задачи внутри действий.

### Параметры телеметрии в запросе

`_prepareMethod` (в `abstract-http.ts`) добавляет `bx24_request_id` / `bx24_sdk_ver` / `bx24_sdk_type` к URL каждого запроса для трассировки. Единственное исключение: унаследованные позиционные методы `task.*` (`task.commentitem.*`, `task.checklistitem.*`, …) читают строку запроса **позиционно**, так что добавленные параметры сдвигают `Param #0`, и сервер отклоняет вызов (`WRONG_ARGUMENTS: Param #0`). Поэтому телеметрия подавляется только для методов, подходящих под якорный шаблон `^task\.`. НЕ расширяйте это до сопоставления подстроки — иначе телеметрия пропадёт и у современных методов с именованными параметрами `tasks.task.*` / `bizproc.task.*`, для которых она безопасна и которые должны оставаться отслеживаемыми (#272).

### Семантика пакетных запросов

Два пакетных транспорта различаются тем, как выводят сбои отдельных команд. Авторы новых действий с поддержкой пакетов должны это учитывать:

| Транспорт | Модель сбоя | Результат по команде |
| --- | --- | --- |
| v2 batch (`packages/jssdk/src/core/interaction/batch/processing/v2/abstract-processing.ts`) | По командам — успешные записи возвращают данные, неудавшиеся выводят свою ошибку в `AjaxResult.getErrors()` | Каждая запись — `AjaxResult` |
| v3 batch (`packages/jssdk/src/core/interaction/batch/processing/v3/abstract-processing.ts`) | **Всё или ничего** — если падает любая команда, падает весь пакет. `getData()` возвращает пустую карту; ошибки находятся в `response.getErrorMessages()` верхнего уровня | Каждая запись — `AjaxResult` (только при полном успехе) |

Ещё два контракта пакетных запросов, общие для обеих версий:

- **`null` — допустимое значение `result`.** Когда метод REST законно не возвращает данных, `result` команды передаётся как есть (включая `null`). Для методов, допускающих null, типизируйте дженерик как `T | null`. Не превращайте `null` в `{}` — это ломает проверки типов на null у вызывающего.
- **`time` по команде — это время всего пакета**, а не команды. Лимитер скорости не относит длительность пакета к отдельным методам.
- Только v3: успешный ответ без записи результата для команды бросает `JSSDK_INTERACTION_BATCH_STRATEGY_V3_EMPTY_COMMAND_RESPONSE` — это сигнал о некорректном ответе REST, а не ошибке вызывающего.

## Стек лимитеров

Каждый транспортный вызов проходит через три слоя. Пропуск любого из них — ошибка.

```text
caller
  └─> RateLimiter         # client-side QPS cap
       └─> OperatingLimiter  # honours the server "operating reset" header
            └─> AdaptiveDelayer  # dynamic backoff on transient failures
                 └─> axios
```

| Лимитер | Файл | Ответственность |
| --- | --- | --- |
| `RateLimiter` | `src/core/http/limiters/rate-limiter.ts` | Ограничивает число запросов в секунду на стороне клиента |
| `OperatingLimiter` | `src/core/http/limiters/operating-limiter.ts` | Делает паузу по сигналу сервера «operating reset» |
| `AdaptiveDelayer` | `src/core/http/limiters/adaptive-delayer.ts` | Динамическая задержка в ответ на временные сбои |

Правила:

- Не вызывайте axios (или другой HTTP-клиент) напрямую вне `src/core/http/`.
- Не обходите лимитер «ради производительности» — лимиты существуют, чтобы порталы не блокировали интеграцию.
- `LicenseManager` автоматически подставляет параметры ограничений, настроенные для enterprise; не пересматривайте это.

## ParamsFactory

`ParamsFactory` (в `src/core/http/limiters/params-factory.ts`) объединяет параметры лимитеров в именованные пресеты. Выбирайте пресет; не конструируйте произвольные параметры в местах вызова.

| Пресет | Когда использовать | Форма профиля (реальные числа — в [params-factory.ts](../../packages/jssdk/src/core/http/limiters/params-factory.ts)) |
| --- | --- | --- |
| `getDefault()` | `B24Frame`, `B24Hook`, `B24OAuth`, если не переопределено | Стандартный QPS + адаптивная задержка + `retryOnNetworkError: true` |
| `getEnterprise()` | Тарифы Enterprise (выбирается автоматически через `LicenseManager`) | Больший всплеск + большая скорость слива поверх `getDefault()` |
| `getBatchProcessing()` | Массовые импорты / миграции | Меньший QPS, меньший порог тяжёлых запросов, более долгая задержка, больше повторов — используется набором тестов под нагрузкой |
| `getRealtime()` | Сценарии UI, где устаревшие данные хуже брошенной ошибки | Адаптивная задержка отключена, бюджет повторов сокращён до 1 (по-прежнему наследует `retryOnNetworkError: true` из default — отключите явно, если нужен быстрый отказ при ошибках транспорта, см. ниже) |
| `fromTariffPlan(plan)` | Когда `LicenseManager` предоставляет строку тарифа портала | Сопоставляет `enterprise` → `getEnterprise()`, остальные → `getDefault()` |

Вводя новый профиль настройки, добавляйте его как статический `ParamsFactory.getX()`. Конкретные числовые значения живут в исходниках — не дублируйте их в этом руководстве; они молча устареют при следующей подстройке лимитера.

### Переключатели `RestrictionParams`

Помимо пресета, `RestrictionParams` предоставляет переключатели на уровне вызова, которые вызывающий может наложить поверх любого пресета (`{ ...ParamsFactory.getDefault(), <overrides> }`). Добавляя новую опцию, задокументируйте её в [docs/content/docs/4.tools/77.limiters.md](../../docs/content/docs/4.tools/77.limiters.md) — эта страница является каноническим справочником.

| Поле | Назначение |
| --- | --- |
| `maxRetries`, `retryDelay` | Бюджет повторов для мягких ошибок |
| `retryOnNetworkError` | По умолчанию `true`. Ставьте `false` для **неидемпотентных** вызовов (любой `*.add`, загрузка файлов, генерация документов) — клиентский таймаут мог на сервере завершиться успехом, и повтор создаст дубликаты. При `false` SDK немедленно бросает `NETWORK_ERROR` / `REQUEST_TIMEOUT`. Для долгих тяжёлых операций также увеличьте таймаут axios через `b24.getHttpClient(ApiVersion.vX).ajaxClient.defaults.timeout`. |
| `hardErrorCodes` | **Добавляет** пользовательские коды ошибок REST, которые нужно бросать сразу, без повторов. Используйте для **ответов HTTP 2xx с кодом ошибки REST уровня предметной области**, который SDK не распознаёт как окончательный (иначе SDK считает неизвестные коды временными и повторяет их). HTTP 4xx уже автоматически классифицируется как не подлежащий повтору внутри `RestrictionManager` в [packages/jssdk/src/core/http/limiters/manager.ts](../../packages/jssdk/src/core/http/limiters/manager.ts) (приватный метод `#isNonRetryableClientError`) — перечислять здесь коды 4xx не нужно. Список аддитивный (коды авторизации / фатальные всегда жёсткие; встроенные убрать нельзя). |
| `softErrorCodes` | **Добавляет** пользовательские коды, которые должны выводиться внутри `AjaxResult` как мягкая ошибка, а не бросаться. Используйте, когда ваш код ветвится по конкретной ошибке REST как часть обычного потока (например, ошибки валидации из собственной конечной точки v3). |

Добавляя новое поле в `RestrictionParams`:

1. По умолчанию **сохраняйте историческое поведение** — включение по желанию для риска, отключение по желанию для безопасности. Поучительная история — пресет realtime: однострочное изменение «быстрый отказ по умолчанию» молча заменило бросаемый код ошибки с `JSSDK_CALL_ALL_ATTEMPTS_EXHAUSTED` на `REQUEST_TIMEOUT` для всех существующих вызывающих realtime. Изменение откатили на ревью PR (коммит `a21eab7`); урок — держать новые флаги отключёнными по умолчанию, даже когда новое поведение «очевидно лучше».
2. Пробросьте поле через `RestrictionManager` (`packages/jssdk/src/core/http/limiters/manager.ts`) — именно там списки hard/soft объединяются со встроенными.
3. Добавьте интеграционную спецификацию в `test/integration/core/limiters-*.spec.ts`. Фиксируйте число повторов **точными** значениями, а не порогами `>=` — мягкие проверки молча пропускают будущие регрессии границ цикла.

### Быстрый отказ по статусу (с v1.1.2)

`RestrictionManager.handleError()` проверяет каждое решение о повторе сначала по статусу HTTP,
до обращения к спискам кодов ошибок
([`packages/jssdk/src/core/http/limiters/manager.ts:125`](../../packages/jssdk/src/core/http/limiters/manager.ts#L125),
`#isNonRetryableClientError` определён в [строке 192](../../packages/jssdk/src/core/http/limiters/manager.ts#L192)):

| Статус HTTP | Поведение повтора |
| --- | --- |
| `4xx` (кроме `408` / `429`) | **Без повтора.** Детерминированная клиентская ошибка — быстрый отказ с первой попытки. |
| `429` | Повторяется как операционный лимит — сопоставляется `#isOperatingLimitError` (`status === 429` или `code === 'OPERATION_TIME_LIMIT'`), который вычисляется раньше `#isNonRetryableClientError`, так что `429` никогда не доходит до шлюза быстрого отказа. (`503` / `QUERY_LIMIT_EXCEEDED` обрабатывается отдельно через `#isRateLimitError`.) |
| `408` (таймаут запроса) | Временная — повторяется при `retryOnNetworkError` равном `true` (по умолчанию); быстрый отказ при `false`. |
| `5xx`, сетевые ошибки, таймауты | Повторяются с экспоненциальной задержкой + джиттером. |

`hardErrorCodes` и `softErrorCodes` продолжают действовать поверх этого шлюза по статусу. Мягкий код
`4xx` (например, ошибка валидации v3) заставляет `handleError` вернуть `0`
(то есть «без задержки перед следующей попыткой»), а вызывающий в `abstract-http.ts`
затем выводит его как ошибку `AjaxResult`, не расходуя оставшийся бюджет повторов.

Справочник для пользователей: [Customizing Error Classification — 77.limiters.md](../../docs/content/docs/4.tools/77.limiters.md#настройка-классификации-ошибок).

## Дисциплина логирования

Каждый транспорт / лимитер держит `LoggerInterface` (публичная абстракция из `packages/jssdk/src/logger/`). Он инициализируется нулевым логгером через `LoggerFactory.createNullLogger()` и заменяется вызовом `setLogger(logger)` — никогда не передаётся через конструктор.

- Используйте `logger.warn(...)` для того, что вызывающим стоит знать, но что не ломает поток (устаревший метод, неожиданная форма данных).
- Используйте `logger.error(...)` только для невосстановимых сбоев на стороне транспорта.
- Не добавляйте вызовы `console.log` — вызывающие не могут их заглушить.
- Для предупреждений об устаревании во время выполнения на публичных методах с `@deprecated` используйте `LoggerFactory.forcedLog(logger, action, message, context)` — **четыре аргумента**:

  ```ts
  LoggerFactory.forcedLog(
    this._logger,
    'warning',
    'Foo.bar() is deprecated and will be removed in version X.Y.Z. Use Foo.baz() instead.',
    { class: 'Foo', method: 'bar', replacement: 'Foo.baz()', removalVersion: 'X.Y.Z' }
  )
  ```

  > Пример с проверкой компиляции: [`package-structure-deprecation-warning.ts`](../../test/some-code-from-docs/contributing/package-structure-deprecation-warning.ts) (общий с package-structure.md)

  Ключ контекста — `removalVersion`, а не `removeInVersion`. Канонический образец лежит в [packages/jssdk/src/core/abstract-b24.ts](../../packages/jssdk/src/core/abstract-b24.ts) (ищите `@deprecated` + `@removed` + `forcedLog`).
- Новые предупреждения или ошибки нужно упомянуть на соответствующей странице документации, чтобы пользователи могли их распознать.

### Пакет `restApi:v3` — единственный «голый» массив в запросе

`HttpV3.batch` передаёт команды как `params`, а `_makeAxiosRequest` отправляет
их без обёртки, минуя `_prepareParams`, потому что в v3 команды
**и есть** тело. Портал читает каждую запись верхнего уровня как команду и
требует у каждой `method` и `query`, так что запись `auth` роняет весь пакет
с `INVALIDSELECTEXCEPTION` до того, как что-либо выполнится, — как и команда,
у которой нет `query`, поэтому `ParseRow` по умолчанию подставляет `{}`.

Поэтому учётные данные перемещаются по транспортам: вебхук держит их в URL, не-вебхук
транспорт **вне среды с принудительным CORS** отправляет
`Authorization: Bearer`. Браузер — и Web Worker, который является браузерным
контекстом без `window` — сохраняет прежнее тело-объект и остаётся сломанным: предзапрос
портала разрешает только `origin, content-type, accept`, так что запрос
заголовка заменил бы диагностируемый 400 непрозрачной сетевой ошибкой. Не
«чините» эту ветку без изменения на стороне портала.

Ветка определяется версией **и** методом, а не тем, что тело — массив:
у `TypeCallParams` есть индексная сигнатура, так что позиционный вызов `restApi:v2`,
например `task.commentitem.getlist`, тоже приходит сюда массивом, и
ничто из рассуждений выше к нему не относится.

## Скрытие учётных данных (с v1.1.2)

Транспортный слой скрывает учётные данные в строках журнала и сообщениях об ошибках до того, как они попадут в логгер. Модуль скрытия — [packages/jssdk/src/core/http/redact.ts](../../packages/jssdk/src/core/http/redact.ts); полный список скрываемых ключей — **статический** массив `SENSITIVE_PARAM_KEYS` в этом файле (сопоставление **без учёта регистра**, а очистка также маскирует пары `key=value`, встроенные в строковые значения, например `cmd[i]` пакета, и секретный сегмент URL вебхука Битрикс24, который не является ни ключом, ни парой). Список не расширяется автоматически: когда вы вводите новый параметр, несущий учётные данные, на любом пути кода, добавьте его ключ в `SENSITIVE_PARAM_KEYS` в `redact.ts` в том же PR, иначе он появится нескрытым в журналах и в `AjaxError`.

**Заголовок — не параметр, и его не скрывает ничто.** SDK сам ставит
`Authorization: Bearer` в пакете v3 вне среды с принудительным CORS.
`redactSensitiveParams` обходит `params` и никогда не видит заголовок; локальное
правило `no-credential-in-logger` это слово тоже не знает. Поэтому инвариант
«ни один заголовок не попадает в контекст логгера» держится тестом, а не защитой — если вы
добавляете строку журнала рядом с транспортом, не кладите в неё конфигурацию запроса.

Правила для кода в `packages/jssdk/src/`:

- **Никогда не логируйте сырые тела запросов** вне транспортного слоя. Идите через логгер транспорта, чтобы скрытие применялось автоматически. В сомнительных случаях оборачивайте параметры в `redactSensitiveParams(params)` из `redact.ts`.
- **Никогда не логируйте сырой URL запроса для транспорта `B24Hook`.** URL содержит секрет вебхука в сегменте пути (`/rest/<userId>/<secret>/` или `/rest/api/<userId>/<secret>/` в `restApi:v3`). Теперь средство скрытия *маскирует* именно эту форму, в том числе когда она приходит в **теле ответа** (`rest.deferredbatch.downloadresult` возвращает такой URL), — но считайте это страховкой, а не разрешением: оно подходит только под форму вебхука Битрикс24 и ни под что другое, а `originalError.config.url` не покрыт вовсе. Логируйте только имя метода и `requestId`.
- **Никогда не кладите учётные данные в поля `SdkError`.** `code`, `description` и любое значение, переданное в бросаемую ошибку, сериализуются в журналы и в сообщения об ошибках, видимые вызывающему.
- В форме `requestInfo` у `AjaxError` больше нет поля `url` — полный URL вебхука (`/rest/{userId}/{secret}/`) иначе появился бы в выводе `toJSON()` и приёмниках журналов. **Не расширяйте `AjaxQuery`, возвращая `url`.** Очистка пути — вторая линия обороны, а не повод заново открывать первую.
- **Никогда не логируйте и не сериализуйте `AjaxError.originalError` напрямую.** `originalError` содержит сырой `AxiosError`, в чьём `config.url` лежит секрет вебхука, а в `config.headers.Authorization` — токен OAuth. Ни одно из этих полей не покрыто средством скрытия параметров. Логируйте только `err.code`, `err.status`, `err.message` или `err.requestInfo` (он скрыт).

Справочник для пользователей: [Logging & Credential Redaction — 78.logging.md](../../docs/content/docs/4.tools/78.logging.md) (полные правила скрытия, таблица мест вызова и шаблоны аудита URL вебхуков).

## Добавление нового транспортного действия

Чек-лист, повторяющий шаги, проверяемые на ревью кода. Канонический пример — [packages/jssdk/src/core/actions/v3/call.ts](../../packages/jssdk/src/core/actions/v3/call.ts).

```text
- [ ] Picked the version directory (src/core/actions/v2/ or v3/) matching the REST method
- [ ] kebab-case.ts file, one primary export, extends AbstractAction (packages/jssdk/src/core/actions/abstract-action.ts) and overrides make(options)
- [ ] Uses the action's existing http reference — does not instantiate axios; limiter stack is wired by the base class
- [ ] Returns Result or AjaxResult — never a raw axios response
- [ ] Surfaces HTTP errors via Result.getErrors(); throws SdkError({ code, description, status }) only for argument validation and method-support checks
- [ ] Wired into actions.vX.<name> on AbstractB24 so callers reach it via b24.actions.vX.<name>.make({ ... })
- [ ] Re-exported from packages/jssdk/src/index.ts if its types are public
- [ ] Integration test added under test/integration/<area>/ (real portal, no response mocks)
- [ ] Matching docs page under docs/content/docs/ added or updated
```

См. также облегчённый чек-лист [Adding a REST Method to an Existing Action](../../AGENTS.md#добавление-rest-метода-в-существующее-действие) в `AGENTS.md`, когда нужно лишь вызвать новый метод из кода вызывающего, не добавляя новый класс действия.

## Краткая справка

| Задача | Что использовать |
| --- | --- |
| Вернуть данные из предметного метода | `Result` |
| Вернуть данные из транспортного вызова | `AjaxResult` |
| Обойти постраничный список (v2) | `result.isMore()` + `result.getNext(b24.getHttpClient(ApiVersion.v2))` |
| Обойти постраничный список (v3) | `b24.actions.v3.callList.make(...)` / `b24.actions.v3.fetchList.make(...)` (в v3 нет `getNext()`) |
| Отклонить неверные аргументы | `throw new SdkError({ code, description, status })` |
| Проверить сбои HTTP | `result.getErrors()` → экземпляры `AjaxError` |
| Выполнить HTTP-вызов | `b24.actions.v3.call.make({ method, params, requestId })` (или `actions.v2.…`) |
| Получить http-клиент | `b24.getHttpClient(ApiVersion.vX)` (поля `b24.http` нет) |
| Настроить поведение лимитера | Пресет `ParamsFactory.getX()` с наложением переопределений `RestrictionParams` |
| Получить версию SDK во время выполнения | Токен сборки `__SDK_VERSION__` |
