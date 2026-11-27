---
name: b24jssdk-core
description: Выбор и инициализация нужной точки входа b24jssdk (B24Hook для бэкендов, B24Frame для приложений во фрейме, B24OAuth для приложений, установленных по OAuth), настройка логирования, обработка ошибок и настройка повторов менеджера ограничений (hardErrorCodes, softErrorCodes, retryOnNetworkError). Загружайте первым при генерации любого кода на b24jssdk. Используйте также на просьбы «подключить SDK к Битрикс24», «вебхук», «входящий вебхук», «токен приложения», «инициализировать клиент», «обработка ошибок REST», «логирование запросов».
---

# Ядро b24jssdk

Три точки входа используют один и тот же REST API, доступный через `$b24.actions.v{2,3}.*`. Выбирайте по тому, **где выполняется код**:

| Точка входа | Где | Источник авторизации |
| --- | --- | --- |
| `B24Hook` | Node.js / скрипты / serverless | URL входящего вебхука (`/rest/<userId>/<secret>`) |
| `B24Frame` | Браузер, **внутри** iframe встройки (placement) Битрикс24 | рукопожатие через `postMessage` с родительским окном |
| `B24OAuth` | Серверная часть приложения Битрикс24, установленного по OAuth | `accessToken` + `refreshToken` из событий установки Битрикс24 |

> После инициализации пишите остальной код против абстрактного типа `TypeB24`, чтобы одна и та же логика работала с любой из трёх.

## B24Hook (бэкенд / скрипты)

```ts
import { B24Hook, ConsoleV2Handler, LogLevel, Logger } from '@bxshefby/b24jssdk'

// Node, so the handler is created explicitly with `useStyles: false`; the
// browser factory below emits CSS styling a terminal prints as literal noise.
const logger = Logger.create('Srv')
logger.pushHandler(new ConsoleV2Handler(LogLevel.INFO, { useStyles: false }))

const $b24 = B24Hook.fromWebhookUrl(
  // Format: https://<portal>.bitrix24.<tld>/rest/<userId>/<secret>
  process.env.B24_HOOK!
)

const me = await $b24.actions.v2.call.make<{ NAME: string; ID: number }>({
  method: 'profile',
  requestId: 'profile-1'
})
logger.info(`Hello, ${me.getData()!.result.NAME}`)
```

Альтернативный конструктор (части задаются вручную):

```ts
import { B24Hook } from '@bxshefby/b24jssdk'
const $b24 = new B24Hook({
  b24Url: 'https://your_domain.bitrix24.com',
  userId: 1,
  secret: 'k32t88gf3azpmwv3'
})
```

Примечания:

- Используйте `B24Hook` только на стороне сервера. URL вебхука содержит долгоживущий секрет.
- Поддерживаемый Node: `>=22` (Node 20 исключён в 3.0.0 — он EOL).

## B24Frame (приложение во фрейме)

```ts
import { initializeB24Frame, LoggerFactory, type B24Frame } from '@bxshefby/b24jssdk'

const logger = LoggerFactory.createForBrowser('App', import.meta.env?.DEV === true)
let $b24: B24Frame

async function boot() {
  $b24 = await initializeB24Frame()
  // The frame handles auth transparently; refresh on 401 is automatic.
  // If you pass the token to your OWN backend instead of calling through $b24,
  // that path never runs — use `initializeB24Frame({ keepAuthFresh: true })`.
  // See the `b24jssdk-frame-ui` skill.
}

function teardown() {
  $b24?.destroy()
}
```

`initializeB24Frame()` дедуплицирует параллельные вызовы — его безопасно ожидать из нескольких мест.

**Если приложение находится в режиме установки, завершите установку.** Пока не вызван `installFinish()`,
портал считает приложение наполовину установленным и **не доставляет ему событий** —
обработчики ботов, обработчики `event.bind` и другие исходящие вызовы не приходят, и
ничто громко об этом не сообщает:

```ts
if ($b24.isInstallMode) {
  // provision whatever the app needs, then finish — the portal reloads the page
  // in response, so this is the last statement of the flow.
  await $b24.installFinish()
}
```

Полное правило см. в навыке `b24jssdk-frame-ui`. Учтите, что это шаг **жизненного цикла**,
а не безопасности — эндпоинт установки/удаления по OAuth всё равно проверяет
`application_token` (см. чек-лист безопасности ниже).

## B24OAuth (серверная часть OAuth-приложения)

```ts
import { B24OAuth } from '@bxshefby/b24jssdk'

// `b24OAuthParams` come from the install/refresh events of your Bitrix24 app
// (applicationToken, accessToken, refreshToken, expires, expiresIn, domain, …)
// `oAuthSecret` is your registered app's clientId/clientSecret pair.
const $b24 = new B24OAuth(b24OAuthParams, { clientId, clientSecret })

// Persist refreshed credentials so the next process gets the latest tokens
$b24.setCallbackRefreshAuth(async ({ authData, b24OAuthParams }) => {
  await db.appCredentials.upsert(b24OAuthParams)
})

await $b24.initIsAdmin() // populates auth.isAdmin
```

`B24OAuth` автоматически обновляет токен доступа при 401. **Всегда регистрируйте `setCallbackRefreshAuth` на сервере**, чтобы обновлённые токены сохранялись.

## Логирование

В браузере достаточно одного вызова фабрики:

```ts
import { LoggerFactory } from '@bxshefby/b24jssdk'

const logger = LoggerFactory.createForBrowser('AppName', /* isDev */ true)
```

В Node собирайте логгер явно, чтобы вывод не был оформлен для консоли браузера:

```ts
import { ConsoleV2Handler, LogLevel, Logger } from '@bxshefby/b24jssdk'

const logger = Logger.create('AppName')
logger.pushHandler(new ConsoleV2Handler(LogLevel.INFO, { useStyles: false }))
```

В обоих случаях вызовы логирования одинаковы. **Второй аргумент — объект контекста,
а не второе сообщение** — каждый уровень принимает `(message: string, context?:
Record<string, any>)`, поэтому подставляйте значения в сообщение или передавайте их как
именованные поля:

```ts
logger.info('starting up')
logger.warning('something looks off', { retries: 2 })

try {
  await risky()
} catch (err) {
  // Never `logger.error('failure', err)` — an Error's message and stack are not
  // own enumerable properties, so it serialises to `{}` and the reason is lost.
  logger.error('failure', {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined
  })
}
```

Обратите внимание: `warning`, а не `warn`. `isDev` включает подробный вывод. Чтобы получать внутренние
трассировки SDK:

```ts
$b24.setLogger(logger)
```

## Обработка ошибок

`actions.v{2,3}.call.make` возвращает `AjaxResult`. Сбои на уровне REST бросают `AjaxError`. Сбои на уровне SDK (неверная версия API для метода и т. п.) бросают `SdkError`.

```ts
import { AjaxError, SdkError } from '@bxshefby/b24jssdk'

async function loadDeal() {
  try {
    const res = await $b24.actions.v2.call.make<{ item: Deal }>({
      method: 'crm.item.get',
      params: { entityTypeId: 2, id: 999_999 }
    })
    if (!res.isSuccess) {
      // Soft errors only (see softErrorCodes below). Most failures throw.
      logger.warning('non-success result', { errors: res.getErrorMessages() })
      return
    }
    return res.getData()!.result.item
  } catch (e) {
    if (e instanceof AjaxError) {
      logger.error('REST error', { code: e.code, status: e.status, message: e.message, requestInfo: e.requestInfo })
      // restApi:v3 only: `e.validation` names the field that failed, which
      // `message` does not. Both `field` and `message` are optional.
      for (const detail of e.validation ?? []) {
        logger.error('invalid field', { field: detail.field, message: detail.message })
      }
    } else if (e instanceof SdkError) {
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

Распространённые коды AjaxError, которые стоит обрабатывать:

- `ERROR_NOT_FOUND` — такого id нет (404)
- `INVALID_CREDENTIALS` / `EXPIRED_TOKEN` (401) — SDK автоматически обновляет токен и один раз повторяет запрос на любой точке входа; для `B24Hook` обновление — пустая операция, так что неверный вебхук по-прежнему падает
- `QUERY_LIMIT_EXCEEDED` — ограничение частоты. SDK уже притормаживает запросы, но вместо плотного цикла может понадобиться `batchByChunk`.
- `INTERNAL_SERVER_ERROR` (50x) — временная ошибка. SDK повторяет запрос автоматически до `maxRetries`.

Распространённые коды SdkError:

- `JSSDK_CORE_METHOD_NOT_SUPPORT_IN_API_V3` — бросается только `AjaxResult.getNext()` / `fetchNext()` для клиента v3 — они работают только в `restApi:v2` (не устарели), а в v3 нет смещения `next`, по которому можно идти дальше. `actions.v3.*.make` его больше не бросает: SDK отказался от списка разрешённых методов v3, поэтому неизвестный метод v3 возвращается как мягкая ошибка `METHODNOTFOUNDEXCEPTION` в результате.

## Настройка повторов / поведения при выбросе ошибок

Менеджер ограничений решает, как неудачный вызов дойдёт до вас: **hard** означает, что промис отклоняется и вы ловите `AjaxError`; **soft** означает, что он завершается успешно, а `response.isSuccess === false`. Это способ доставки, а не серьёзность — ни то ни другое не влияет на повторы (любой 4xx, кроме 408/429, останавливает повторы в обоих случаях), и **всё, что не отнесено к soft, бросается**, включая коды, которых нет в списках.

По умолчанию закреплены известные коды Битрикс24; расширяйте для своего приложения через `RestrictionParams`.

```ts
import { B24Hook, ParamsFactory, ApiVersion } from '@bxshefby/b24jssdk'

const $b24 = B24Hook.fromWebhookUrl(process.env.B24_HOOK!)

await $b24.setRestrictionManagerParams({
  ...ParamsFactory.getDefault(),

  // Codes that must throw immediately (no retry). Use for business-specific
  // error codes that the SDK doesn't know about — otherwise the SDK treats
  // unknown codes as transient and retries with backoff.
  hardErrorCodes: [
    'DOCUMENT_GENERATOR_ALREADY_IN_QUEUE',
    'MY_APP_BAD_PAYLOAD'
  ],

  // Codes that should be returned in AjaxResult as soft errors instead of
  // thrown — useful when you want control-flow on a specific REST error.
  softErrorCodes: [
    'CUSTOM_VALIDATION_ERROR'
  ],

  // For NON-IDEMPOTENT methods (any *.add, file uploads) — set to false so the
  // SDK does NOT retry on NETWORK_ERROR / REQUEST_TIMEOUT. A client-side
  // timeout doesn't mean the server didn't process the call; retrying creates
  // duplicates.
  retryOnNetworkError: false,

  maxRetries: 3,
  retryDelay: 1_000
})
```

**Правило категорий не требует настройки.** В `restApi:v3` ошибка, пришедшая в конверте ошибки v3 с кодом 4xx, отличным от 401/408/429, считается soft независимо от своего кода. В линейке `2.x` это включалось параметром `classifyV3ErrorsByCategory`; с `3.0.0` это просто поведение, а параметра больше нет — его передача приводит к ошибке компиляции, и исправление — удалить строку.

**Зачем нужно правило категорий.** Встроенный soft-список содержит девять кодов v3; одна сборка для портала на собственной инфраструктуре, как измерено, поставляла как минимум 39, и набор растёт с каждым модулем портала. Поэтому классификация по списку зависит от даты поставки модуля, а не от вида ошибки: `INVALIDSELECTEXCEPTION` — soft, а `INVALIDPAGINATIONEXCEPTION` — та же ошибка вызывающего, тот же запрос, тот же HTTP 400 — бросается. Закреплённые коды (встроенные и ваши) по-прежнему главнее правила; 5xx, 401, 408, 429 и весь `restApi:v2` не затрагиваются; 403 — soft, как и уже закреплённый `…ACCESSDENIEDEXCEPTION` — за исключением `…INSUFFICIENTSCOPEEXCEPTION`, закреплённого как hard, потому что это отсутствие разрешения OAuth, а его двойник в v2 `insufficient_scope` всегда бросался.

**Никогда не сопоставляйте по префиксу `BITRIX_REST_V3_EXCEPTION_`** — модули поставляют коды без префикса, например `NOTE_SEARCH_QUERY_TOO_SHORT`. И никогда не сопоставляйте по `message`: он локализован.

**`…ACCESSDENIEDEXCEPTION` — не сигнал о правах.** В v3 это универсальный код для *любого* сбоя аутентификации: неверные учётные данные, отсутствующие и верные, отправленные по обычному HTTP, — все отвечают им с **401**, побайтно одинаково — портал сводит любой сбой `checkAuth()` к этому одному исключению и отбрасывает причину. Тот же код приходит с **403** по совершенно другому поводу: метод или контроллер отключён на портале. Так что сам по себе код говорит лишь «не авторизован». SDK отдаёт его **как soft при обоих статусах** — он входит во встроенный soft-список, который `isSoftError` проверяет раньше любого статуса, и 401 здесь не запускает обновление токена (для этого дополнительно нужны `expired_token` / `invalid_token`). Поэтому сочетайте код со `status`, чтобы решить, что *делать*, а не чтобы предсказать, как он придёт, и если учётные данные вам известны как верные, проверьте схему URL, прежде чем проверять права. (`restApi:v2` их различает: `INVALID_CREDENTIALS` против `INVALID_REQUEST` / *Https required.*)

`hardErrorCodes` и `softErrorCodes` **аддитивны** — встроенные списки (коды авторизации/фатальные) всегда hard, и вы не можете их убрать, только расширить (согласно `packages/jssdk/src/types/limiters.ts:120-146`).

`setRestrictionManagerParams` **заменяет указанные вами параметры и сохраняет остальные** — `setRestrictionManagerParams({ maxRetries: 5 })` после блока выше оставляет `hardErrorCodes` и прочие нетронутыми; ключ со значением `undefined` считается неуказанным. Слияние **поверхностное**: `rateLimit` / `operatingLimit` / `adaptiveConfig` заменяются целиком, у их типов нет необязательных полей, а неполный блок из JavaScript отклоняется с `JSSDK_LIMITER_INVALID_CONFIG_BLOCK`, а не попадает в лимитер недособранным. Чтобы очистить список, передайте `hardErrorCodes: []` — разворачивание `...ParamsFactory.getDefault()` его не очищает, потому что такого ключа у фабрики нет. `getRestrictionManagerParams()` возвращает копию, включая вложенные блоки. (Раньше метод заменял всю конфигурацию, поэтому частичное обновление сбрасывало всё, что не упомянуто, — #479.)

**`OperatingLimiter` ничего не делает на портале на собственной инфраструктуре (self-hosted) с настройками по умолчанию, и это правильно.** Он работает по счётчикам `operating` / `operating_reset_at` в блоке `time` ответа, которые коробка присылает, только пока включён её собственный `LoadLimiter` — по умолчанию он выключен, и в продукте ничто его не включает. Тот же переключатель управляет применением ограничения, поэтому такой портал вызовы тоже не отклоняет: молчащий лимитер соответствует порталу, а не что-то упускает. `RateLimiter` и `AdaptiveDelayer` по-прежнему действуют. Владельцу коробки, который *хочет* это ограничение, нужно включить его и вручную подключить Redis — измеренные шаги и неверную настройку, которая молча выглядит как успех, см. в [Система ограничений → Включение лимитера времени операций на self-hosted портале](https://b24-js-sdk.bx-shef.by/docs/tools/limiters/#включение-лимитера-времени-операций-на-self-hosted-портале). Не читайте `time.duration` или `time.processing` для измерения времени: в сборке, на которой это измерялось (`main 26.700.0`), портал усекает метки времени, из которых они выводятся, что завышает `duration` до секунды и оставляет `processing` равным `0` почти для каждого вызова.

> **Область действия:** `setRestrictionManagerParams` обновляет политику на **экземпляре `$b24`**, а не на вызове, который вы собираетесь сделать. Каждый параллельный или последующий вызов на том же `$b24` видит новые параметры, пока вы не зададите их снова. В путях кода, где на одном `$b24` смешиваются идемпотентные чтения и неидемпотентные записи, используйте для неидемпотентного потока отдельный экземпляр `$b24`, а не переключайте политику на лету. В `restApi:v3` есть ответ лучше обоих: передайте `idempotencyKey` самой записи и позвольте порталу дедуплицировать — см. [Idempotency-Key](https://b24-js-sdk.bx-shef.by/docs/actions/call/#idempotency-key). В `restApi:v2`, где портал игнорирует заголовок, остаётся лишь токен идемпотентности для каждого метода плюс ручная сверка.

Для тяжёлых долгих вызовов также увеличьте таймаут axios у базового HTTP-клиента:

```ts
import { ApiVersion } from '@bxshefby/b24jssdk'
const clientAxios = $b24.getHttpClient(ApiVersion.v2).ajaxClient
clientAxios.defaults.timeout = 120_000
```

Есть и второй канал, к которому стоит обратиться, когда настройка должна действовать с первого запроса: `httpOptions` при создании — в
`initializeB24Frame` (запуск фрейма — он пересылает опцию в `B24Frame`
без изменений), `B24Hook`, `B24Hook.fromWebhookUrl` и `B24OAuth`; они накладываются поверх
собственных значений axios по умолчанию в SDK.

```ts
import { B24Hook } from '@bxshefby/b24jssdk'

const b24 = B24Hook.fromWebhookUrl(
  'https://your-portal.bitrix24.com/rest/1/SECRET',
  { httpOptions: { adapter: 'xhr' } }
)
```

Главное назначение — `adapter`. В браузере — или в воркере, который SDK здесь
рассматривает так же, — он просит у axios `fetch`: если оставить как есть, axios перебирает `['xhr', 'http', 'fetch']` и берёт XHR по порядку в списке,
а не по достоинствам; вне браузера он ничего не запрашивает. Передайте `{ adapter: 'xhr' }`, чтобы
вернуться назад, — это же ответ для набора тестов на `jsdom`, где тестовый двойник подменяет
`XMLHttpRequest`.

`httpOptions` — узкий срез `AxiosRequestConfig` (`TypeHttpOptions`):
`adapter`, `timeout`, `timeoutErrorMessage`, `proxy`, `httpAgent`, `httpsAgent`,
`maxRedirects`, `maxContentLength`, `maxBodyLength`, `decompress`,
`withCredentials`. `baseURL`, `transformRequest`, `paramsSerializer`
и `validateStatus` — это то, как SDK достаёт до портала, и их там нет:
ключ вне списка отбрасывается при создании, а его имя логируется
(предупреждение читается как `httpOptions: keys not accepted at construction were
dropped`), поскольку тип не может остановить значение, пришедшее через переменную или
из чистого JavaScript. `headers` тоже не предлагается — тип его отклоняет, —
хотя транспорт по-прежнему сливает его, если он дошёл из нетипизированного кода, как
это делалось с #144. Всё это остаётся доступным через `defaults` выше, где это
выглядит как осознанное действие.

Список отсекает то, что случайно ломает SDK; это не граница
безопасности. `adapter` заменяет весь транспорт, а `proxy` / `httpAgent` направляют
трафик с токенами туда, куда укажет вызывающий, — оба в списке,
потому что `adapter` и есть то, ради чего опция существует. И она действует только на два REST-транспорта: клиент обновления токена OAuth собирает собственный экземпляр axios, поэтому
`adapter`, `timeout` и `proxy` не применяются к запросу, который отправляет
`client_secret` на сервер OAuth. Обратите внимание, что `defaults.headers['Content-Type']` больше не меняет
трафик SDK: SDK указывает тип содержимого JSON в каждом запросе (почему это важно, см. навык
`b24jssdk-filtering`).

## Лимиты Enterprise

`LicenseManager` (из `useB24Helper`) автоматически подставляет параметры ограничений для enterprise, если портал enterprise. Вручную:

```ts
import { ParamsFactory } from '@bxshefby/b24jssdk'

await $b24.setRestrictionManagerParams(ParamsFactory.getEnterprise())
```

## Чек-лист безопасности для рецептов-приёмников событий

Когда код ПОЛУЧАЕТ события от Битрикс24 (обработчики исходящих вебхуков, эндпоинты установки / удаления по OAuth), применяйте этот чек-лист — и против подделки, и против лавины повторов. Конкретные разобранные примеры находятся в рецептах `07-webhook-handler.ts` и `12-oauth-install.ts`.

- [ ] **Сначала отвечайте `200`, проверяйте потом.** Битрикс24 повторяет любой ответ не из 2xx до 24 часов. Отправляйте `res.status(200).send('ok')` сразу при получении данных, а проверку и бизнес-логику выполняйте асинхронно. Сбои в этих асинхронных шагах логируются и отбрасываются, а не вызывают каскад повторов.
- [ ] **Проверяйте `application_token` для исходящих вебхуков.** Сравните `payload.auth?.application_token` со значением из вашей консоли разработчика Битрикс24 (обычно передаётся через переменную окружения). При несовпадении — запишите в лог и проигнорируйте. Без этого любой, кто знает URL, может воспроизвести произвольные события.
- [ ] **Проверяйте `application_token` по сохранённым учётным данным при удалении.** На `ONAPPUNINSTALL` найдите сохранённые данные для пришедшего `member_id`, сравните `application_token` и удаляйте только при совпадении. Без этого любой, кто достанет `/uninstall`, сможет стереть учётные данные любого портала, чей `member_id` угадает.
- [ ] **Сохраняйте обновлённые токены OAuth.** Всегда вызывайте `setCallbackRefreshAuth` на каждом экземпляре `B24OAuth`, чтобы записывать свежие токены в ваше хранилище. Следующий холодный старт ожидает их.
- [ ] **Держите `B24Hook` на стороне сервера.** Он содержит долгоживущий секрет, и ничто в SDK не мешает этому секрету попасть в браузерный бандл — не допустить этого должно приложение. Клиентское предупреждение — это датчик дыма, а не защита: оно срабатывает везде, где действуют правила браузера — в основном потоке и в любом Web, Shared или Service Worker (`_checkClientSideWarning` возвращается раньше при `isServerSide()`, то есть `!isBrowserLikeRuntime()`) — поэтому в Node заглушать нечего, и `offClientSideWarning()` там — пустая операция. Не вызывайте его в коде приложения — согласно [AGENTS.md](https://github.com/bx-shef/b24-js-sdk/blob/main/AGENTS.md), подавление предупреждений предназначено только для тестов. Вызов его в серверном шаблоне хуже, чем бесполезен: он ничего не заглушает там, где стоит, и переезжает вместе с кодом, если тот когда-нибудь скопируют в браузер, унося с собой единственный сигнал об утёкшем секрете.
- [ ] **Экранируйте HTML во вводе пользователя перед отправкой в чат / IM.** При отправке текста CRM через `parse_mode: 'HTML'` (Telegram) или HTML в `im.message.add` экранируйте `<` / `>` / `&` в данных.

## Выбор имён методов

| Задача | Метод | Версия API |
| --- | --- | --- |
| Сущности CRM (сделки, контакты, компании, лиды, смарт-процессы) | `crm.item.{list,get,add,update,delete}` с `entityTypeId` из `EnumCrmEntityTypeId` | v2 |
| Чтение/запись/список задач | `tasks.task.{add,get,update,delete,list}` | **v3** |
| Дополнительно по задачам | `tasks.task.checklistitem.*`, … | v2 |
| Диск | `disk.storage.getlist`, `disk.folder.{getchildren,addsubfolder}`, `disk.file.get` | v2 |
| Профиль / пользователи | `profile`, `user.get`, `user.current` | v2 |
| IM | `im.notify`, `im.message.add` | v2 |
| Журнал событий | `main.eventlog.{list,get,tail}` | **v3** |
| Почта | `mail.mailbox.*`, `mail.message.*`, `mail.recipient.*` | **v3** |
| Структура организации (HR) | `humanresources.node.*`, `humanresources.employee.*` | **v3** |
| Учёт рабочего времени | `timeman.record.*` (только чтение) | **v3** |

> Столбец версии — рекомендация, а не запрет: SDK больше не хранит список разрешённых методов v3, поэтому `actions.v3.*` отправит любой метод на endpoint v3 (его проверяет сервер), а `actions.v2.*` больше не предупреждает о методах, подходящих для v3. Выбирайте версию, которая даёт нужное вам представление.

## Если вы не знаете, с какой точкой входа имеете дело

Пишите функции против `TypeB24`:

```ts
import type { TypeB24 } from '@bxshefby/b24jssdk'
import { EnumCrmEntityTypeId } from '@bxshefby/b24jssdk'

interface Deal { id: number; title: string }

export async function loadDeal($b24: TypeB24, id: number): Promise<Deal> {
  const res = await $b24.actions.v2.call.make<{ item: Deal }>({
    method: 'crm.item.get',
    params: { entityTypeId: EnumCrmEntityTypeId.deal, id }
  })
  if (!res.isSuccess) throw new Error(res.getErrorMessages().join('; '))
  return res.getData()!.result.item
}
```

Один и тот же `loadDeal` работает без изменений с `B24Hook`, `B24Frame` и `B24OAuth`.
