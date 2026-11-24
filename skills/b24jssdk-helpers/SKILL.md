---
name: b24jssdk-helpers
description: Используйте B24HelperManager / useB24Helper, чтобы заранее загрузить данные портала (профиль, приложение, валюты, опции, лицензию, оплату), форматировать валюту и подписываться на клиент Pull (push). Рассчитан в первую очередь на приложения во фрейме; помощники могут работать и с B24Hook / B24OAuth для данных только на чтение.
---

# Помощники b24jssdk и Pull

Композабл `useB24Helper()` оборачивает `B24HelperManager` и жизненный цикл клиента Pull. Это рекомендуемый способ один раз при запуске приложения загрузить контекст всего портала (валюты, информацию об установке вашего приложения, текущего пользователя).

## Первоначальная настройка

```ts
import {
  initializeB24Frame,
  useB24Helper,
  LoadDataType,
  type TypePullMessage
} from '@bitrix24/b24jssdk'

const {
  initB24Helper,
  isInitB24Helper,
  destroyB24Helper,
  getB24Helper,
  usePullClient,
  useSubscribePullClient,
  startPullClient
} = useB24Helper()

const $b24 = await initializeB24Frame()

await initB24Helper(
  $b24,
  [
    LoadDataType.Profile,
    LoadDataType.App,
    LoadDataType.Currency,
    LoadDataType.AppOptions,
    LoadDataType.UserOptions
  ],
  /* requestId */ 'app-boot'
)

const helper = getB24Helper()
```

Передавайте только те флаги `LoadDataType`, которые действительно нужны, — `initB24Helper` выполняет один пакетный REST-вызов (внутри это `$b24.actions.v2.batch.make`), и каждый флаг добавляет в него работы. Минимум обычно — `Profile` и `App` (значения по умолчанию).

`isInitB24Helper()` возвращает `true`, как только `initB24Helper` завершился, — удобно для проверок-защит.

## Чтение данных помощника

```ts
const me = helper.profileInfo.data
// { id, name, lastName, isAdmin, … }

const app = helper.appInfo.data
const status = helper.appInfo.statusCode  // EnumAppStatus

const license = helper.licenseInfo  // for enterprise checks
const payment = helper.paymentInfo

const baseCurrency = helper.currency.baseCurrency
```

Обращение к `helper.profileInfo` до завершения `initB24Helper` бросает `B24HelperManager.profileInfo not initialized`. Если загрузка асинхронна относительно вашего UI, используйте `isInitB24Helper()` как защиту.

## Форматирование валюты

```ts
const symbol  = helper.currency.getCurrencyLiteral('USD', 'en')   // '$'
const full    = helper.currency.getCurrencyFullName('USD', 'en')  // 'US Dollar'
const pretty  = helper.currency.format(1234.56, 'USD', 'en')      // '$1,234.56'
```

`format` учитывает правила каждой валюты (число знаков после запятой, разделители), загруженные с портала.

## Массовые опции с уведомлением

`OptionsManager` уровня помощника умеет сохранять много ключей одним пакетным запросом и рассылать событие Pull:

```ts
await helper.appOptions.save(
  {
    featureFlags: helper.appOptions.encode({ exportCsv: true, beta: false }),
    lastSyncAt: new Date().toISOString()
  },
  {
    moduleId: 'application',
    command: 'FEATURES_UPDATED',
    params: { source: 'app' }
  }
)

// `getJsonObject` returns `object` — it takes no type argument. Cast at the
// callsite if you want a shape.
const flags = helper.appOptions.getJsonObject(
  'featureFlags',
  { exportCsv: false, beta: false }
)
```

`encode` сериализует значение в JSON-строку, совместимую с Битрикс24; `getJsonObject` выполняет обратное преобразование с типизированным значением по умолчанию.

## Клиент Pull (push-события)

```ts
import type { TypePullMessage } from '@bitrix24/b24jssdk'
usePullClient()

useSubscribePullClient((m: TypePullMessage) => {
  if (m.command === 'FEATURES_UPDATED') {
    // re-read options, update UI
  }
}, /* moduleId */ 'application')

startPullClient()
```

> Подписывайтесь **до** `startPullClient()` — клиент подключается после запуска. `useSubscribePullClient` и `startPullClient` бросают исключение, если `usePullClient` не был вызван первым.

### Публикуйте с бэкенда, а не из клиента Pull

Чтобы положить сообщение в канал, вызовите по REST `pull.application.event.add`
— по `MODULE_ID` фильтруют ваши подписчики:

```ts
import type { B24Frame } from '@bitrix24/b24jssdk'
declare const $b24: B24Frame

await $b24.actions.v2.call.make({
  method: 'pull.application.event.add',
  params: {
    COMMAND: 'FEATURES_UPDATED',
    PARAMS: { source: 'app' },
    MODULE_ID: 'application'
  }
})
```

`PullClient` предоставляет `sendMessage()`, но ему нужен `pull.channel.public.list`,
чтобы определить каналы получателей, а этого метода нет в REST-поверхности приложения
— обычно он отклоняется с `JSSDK_PULL_PUBLIC_IDS_UNAVAILABLE`. Не
генерируйте код, который вызывает его из приложения.

«Обычно» — потому что поиск пропускается, если у каждого получателя уже есть
неистёкший кешированный канал, который вызов стартовой конфигурации заполняет из
`publicChannels`, — поэтому отправка текущему пользователю может пройти без отказа.
Это не повод его использовать: отправка по-прежнему не подтверждает доставку, а
то, что приходит обратно, поступает в подписку `SubscriptionType.Client`, а не в
`Server`, которую по умолчанию создаёт `subscribe()`.

Кроме того, ничто в SDK не ограничивает публикацию тем, что это приложение, —
`isPublishingEnabled()` читает только `serverVersion > 3 && publish_enabled`. А
`sendMessageToChannels()` берёт идентификаторы каналов у вызывающего, поэтому никогда
не делает поиск и вообще не выбрасывает этот код. Рекомендация выше — о том, какой
путь ПОДДЕРЖИВАЕТСЯ, а не о том, какой путь допускает код.

Несколько подписок на разные `moduleId` поддерживаются — вызывайте `useSubscribePullClient` по разу на канал:

```ts
useSubscribePullClient(handleAppEvent, 'application')
useSubscribePullClient(handleImEvent, 'im')
useSubscribePullClient(handleCrmEvent, 'crm')
```

Чтобы завершить работу (клиент Pull тоже будет остановлен):

```ts
import { useB24Helper } from '@bitrix24/b24jssdk'

const { destroyB24Helper } = useB24Helper()
destroyB24Helper()
```

## Помощники с B24Hook / B24OAuth

Сам `B24HelperManager` работает с любым `TypeB24`. Композабл рассчитан на жизненный цикл во фрейме, но для бэкенд-кода можно создать менеджер напрямую:

```ts
import { B24HelperManager, LoadDataType } from '@bitrix24/b24jssdk'

const helper = new B24HelperManager($b24)
await helper.loadData([LoadDataType.Profile, LoadDataType.Currency])
const baseCurrency = helper.currency.baseCurrency
```

Pull имеет смысл только в интерактивном контексте. Не вызывайте `startPullClient()` из CLI-скрипта.

## Антипаттерны

- ❌ Вызывать `initB24Helper` дважды без `destroyB24Helper` между ними — второй вызов ничего не делает (ранний выход по `$isInitB24Helper`), данные НЕ обновляются.
- ❌ `usePullClient` без `useSubscribePullClient` — соединение работает, но сообщения никто не обрабатывает.
- ❌ Загружать все `LoadDataType` «на всякий случай» — каждый лишний флаг добавляет REST-работы в пакетный запрос.
- ❌ Читать `helper.profileInfo.data` до завершения `initB24Helper`.
