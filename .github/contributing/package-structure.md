# Структура пакета

<sub>Последняя проверка: 2026-09-02.</sub>

> **Зеркало для агентов:** опубликованная поверхность с точки зрения агентов, пишущих код использования, лежит в [`b24jssdk-core/`](../../skills/b24jssdk-core/SKILL.md), [`b24jssdk-frame-ui/`](../../skills/b24jssdk-frame-ui/SKILL.md) и [`b24jssdk-helpers/`](../../skills/b24jssdk-helpers/SKILL.md). Держите это руководство и эти навыки синхронными, когда меняется базовый API.

Как писать код внутри `packages/jssdk/src/`. Это опубликованная поверхность `@bitrix24/b24jssdk` — каждое изменение здесь попадает к потребителям.

## Расположение файлов

Исходные файлы лежат в `packages/jssdk/src/` и сгруппированы по ответственности, а не по иерархии классов. Выбирайте каталог по тому, что код *делает*, а не по тому, что он *расширяет*:

| Каталог | Что в нём |
| --- | --- |
| `src/core/` | `AbstractB24`, `Result`, `SdkError`, генерация request-id, менеджер версий |
| `src/core/actions/` | Публичная поверхность действий, разделённая на `v2/` и `v3/`. Имена файлов — kebab-case (`call.ts`, `batch.ts`, `batch-by-chunk.ts`, `call-list.ts`, `fetch-list.ts`); имена API — camelCase (`b24.actions.vX.call.make`, `…batch.make`, `…batchByChunk.make`, `…callList.make`, `…fetchList.make`) |
| `src/core/http/` | Транспорты `Http` (`v2.ts`, `v3.ts`), `AjaxResult`, `AjaxError`, `abstract-http.ts` |
| `src/core/http/limiters/` | `RateLimiter`, `OperatingLimiter`, `AdaptiveDelayer`, `ParamsFactory` |
| `src/frame/` | `B24Frame` и менеджеры, работающие только во фрейме (`auth`, `parent`, `slider`, `dialog`, `placement`, `options`) |
| `src/hook/` | `B24Hook` (авторизация вебхуком на стороне сервера) |
| `src/oauth/` | `B24OAuth` (локальные приложения на OAuth) |
| `src/helper/` | `B24HelperManager`, `useB24Helper`, подчинённые менеджеры (`profile`, `app`, `payment`, `license`, `currency`, `options`) |
| `src/pullClient/` | Клиент Pull (push) — коннекторы WebSocket + long-poll, менеджер каналов, JSON-RPC, декодеры protobuf |
| `src/tools/` | Публичные утилиты — `Text` (Luxon, UUID v7), `Type` (проверки во время выполнения), `Browser`, `useFormatters`, `pick`/`omit`/`getEnumValue`, утилиты прокрутки и окружения |
| `src/types/` | Публичные типы и перечисления (CRM, catalog, bizproc, event, placement, pull, payloads, …) |
| `src/logger/` | `Logger`, `LoggerFactory` |
| `src/index.ts` | Единый публичный баррель экспорта — считайте его контрактом |

Файлы называются `kebab-case.ts`. Имена классов внутри — `PascalCase`. Один основной экспорт на файл.

## Стандартный шаблон модуля

Типичный менеджер в стиле помощника (преобладающая форма в `src/helper/` и `src/frame/`) принимает экземпляр b24 и настраивает логгер через сеттер. Есть два варианта:

- **Самостоятельный менеджер** — форма, показанная в шаблоне ниже. Создаётся явно из кода вызывающего или из другого менеджера. Абстрактных методов для реализации нет.
- **Подчинённый менеджер `B24HelperManager`** — расширяет [packages/jssdk/src/helper/abstract-helper.ts](../../packages/jssdk/src/helper/abstract-helper.ts), который добавляет обязательный геттер `abstract get data(): any` и хуки жизненного цикла. Канонический пример подчинённого менеджера — [packages/jssdk/src/helper/profile-manager.ts](../../packages/jssdk/src/helper/profile-manager.ts). Не копируйте самостоятельный шаблон ниже для подчинённых менеджеров — он не скомпилируется.

`B24HelperManager` ([packages/jssdk/src/helper/helper-manager.ts](../../packages/jssdk/src/helper/helper-manager.ts)) — агрегатор, который владеет этими подчинёнными менеджерами и пробрасывает им `setLogger`; базовым классом он не является.

Шаблон ниже — **самостоятельный** вариант:

// @check-ignore: template for a file the reader is about to create; `MyManager` does not exist and the imports are relative to `packages/jssdk/src/<area>/`

```ts
// 1. Type imports first (always separate)
import type { LoggerInterface } from '../logger'
import type { TypeB24 } from '../types/b24'

// 2. Value imports
import { LoggerFactory } from '../logger'
import { SdkError } from '../core/sdk-error'

// 3. Class — one primary export per file, named export.
//    Fields are `protected` so the class can serve as a base or be extended;
//    use `private` only if the class is intentionally final.
export class MyManager {
  protected _b24: TypeB24
  protected _logger: LoggerInterface

  // 4. Manager takes the b24 instance, not a raw transport.
  //    Logger starts as a null logger and is replaced via setLogger().
  constructor(b24: TypeB24) {
    this._b24 = b24
    this._logger = LoggerFactory.createNullLogger()
  }

  setLogger(logger: LoggerInterface): void {
    this._logger = logger
  }

  getLogger(): LoggerInterface {
    return this._logger
  }

  // 5. Public methods go through the action surface and return Result / AjaxResult.
  async fetch(id: number) {
    if (id <= 0) {
      // 6. Use SdkError for invariant violations, AjaxError surfaces via Result.
      //    SdkError takes a SdkErrorDetails object — see packages/jssdk/src/core/sdk-error.ts.
      throw new SdkError({
        code: 'MY_MANAGER_BAD_ID',
        description: 'MyManager.fetch: id must be positive',
        status: 400
      })
    }

    return this._b24.actions.v3.call.make<{ item: { id: number } }>({
      method: 'my.entity.get',
      params: { id },
      requestId: 'my-manager/fetch'
    })
  }
}
```

> Пример с проверкой компиляции: [`test/some-code-from-docs/contributing/package-structure-manager.ts`](../../test/some-code-from-docs/contributing/package-structure-manager.ts)

Для действий транспортного уровня (в `src/core/actions/v2/` и `v3/`) вместо этого расширяйте `AbstractAction` (`packages/jssdk/src/core/actions/abstract-action.ts`) — канонический пример см. в [packages/jssdk/src/core/actions/v3/call.ts](../../packages/jssdk/src/core/actions/v3/call.ts).

## Добавление в публичную поверхность

Символ становится публичным *только* после реэкспорта из `packages/jssdk/src/index.ts`. Внутренние помощники остаются неэкспортированными.

// @check-ignore: `./my-area/my-manager` is the file the reader is about to add, not one that exists

```ts
// packages/jssdk/src/index.ts
export { MyManager } from './my-area/my-manager'
export type { TypeMyPayload } from './types/payloads'
```

- Для публичных типов предпочитайте `export { Foo } from './…'` вместо реэкспорта звёздочкой — так контракт остаётся проверяемым.
- Член экспортируемого типа — тоже часть этого контракта, **если он не помечен
  `@internal`**, и это единственное исключение. `@internal` означает внутреннюю
  обвязку SDK, раскрытую только потому, что тип экспортируется, и больше ни по какой причине:
  её нет на сайте документации, её можно убрать в любом релизе, и
  цикл устаревания на неё не распространяется. Используйте это только там, где альтернативой
  было бы закрепить переключатель, которым никому вне SDK не следует щёлкать, и
  скажите в JSDoc, что делает его временным и что его завершит. `TypePullClientParams.protobufCodec`
  — текущий пример, см. [`pull-protobuf.md`](pull-protobuf.md).
- Реэкспорт звёздочкой допустим для `src/types/index.ts`, потому что этот файл — внутренний агрегатор.
- Удаление или переименование публичного экспорта — **ломающее изменение** и должно пройти цикл устаревания.

  **Сначала решите, нужно ли вообще объявлять его устаревшим** — см.
  [`deprecations.md`](deprecations.md). Проверка такова: существует ли замена,
  которая ничего не стоит вызывающему; член без замены — не кандидат
  на устаревание, а ломающее изменение под видом тега. Эта страница
  существует потому, что на этот вопрос дважды ответили неверно за один цикл, уже после того, как
  ответ был выпущен.

  Когда решение принято, требуются три вещи, а не одна:

  1. **JSDoc**: пометьте старый символ `@deprecated` с указанием замены, а также `@removed X.Y.Z` с целевой версией удаления. Добавьте `@memo`, если у устаревания есть неочевидная причина (например, «только для `restApi:v2`»).
  2. **Предупреждение во время выполнения** (для методов, которые вызывающие могут ещё вызывать): выдайте предупреждение через `LoggerFactory.forcedLog`. Сигнатура — `(logger, action, message, context)`, **четыре аргумента**, а не три:

      ```ts
      LoggerFactory.forcedLog(
        this._logger,
        'warning',
        'SomeClass.someMethod() is deprecated and will be removed in version X.Y.Z. Use b24.actions.vX.call.make(options) instead.',
        {
          class: 'AbstractB24',
          method: 'someMethod',
          replacement: 'b24.actions.vX.call.make(options)',
          removalVersion: 'X.Y.Z'
        }
      )
      ```

      > Пример с проверкой компиляции: [`package-structure-deprecation-warning.ts`](../../test/some-code-from-docs/contributing/package-structure-deprecation-warning.ts)

      Ключ контекста — `removalVersion`, а не `removeInVersion`. Канонический образец лежит в [packages/jssdk/src/core/abstract-b24.ts](../../packages/jssdk/src/core/abstract-b24.ts) (ищите `@deprecated` + `forcedLog`).
  3. **Оба символа выходят вместе** не менее одного минорного релиза.

## Какую часть блока JSDoc держать в коде

Проблема не в длинных комментариях — именно те, что объясняют *почему*, — самое
ценное в этой кодовой базе. Проблема — **размещение** (#420).

Раньше этот раздел начинался с чисел — самый длинный блок, сколько их длиннее
тридцати строк. Они оказались неверными уже через два прохода, потому что их никто не измеряет. Либо
это делает скрипт, и тогда числа можно цитировать, либо в прозе их быть не должно.
Пока такого скрипта нет, измеряйте, прежде чем ссылаться.

### Порог

> Блок JSDoc, который длиннее функции, которую он описывает, — повод спросить,
> где этому тексту место.

Это не правило линтера и не предел. Многим коротким функциям нужно длинное
объяснение; вопрос в том, нужно ли *этому* читателю, открывшему *этот* файл,
всё это перед глазами.

### Что всегда остаётся в коде

Контракт сигнатуры: смысл параметров, `@returns`, `@throws`,
`@deprecated` / `@removed` и **любой инвариант, который читатель может нарушить, правя
именно этот файл**. Если ошибка здесь что-то ломает, это остаётся
здесь.

### Что лучше вынести в руководство

Рассуждения, рассмотренные альтернативы, историю и разобранные примеры. Две причины,
одна из них измерима:

- **Устаревшее утверждение в коде тихо гниёт.** `docs-lint`, `md-internal-links`
  и проверки типов в блоках кода следят, чтобы ссылки Markdown-руководств, их отметки
  свежести и компилируемость их кода были в порядке. За предложением в комментарии
  никто не следит.

  Это оставшаяся причина, и стоит честно сказать, как исчезла
  другая. Исходный аргумент состоял в том, что примеры JSDoc не компилировал ничто, тогда как блоки `ts`
  в руководствах компилируются при каждом запуске CI — 57 блоков `@example`, около 460 строк,
  непроверенных, три из них сломаны.
  **Этот разрыв закрыт:** `jsdoc:typecheck-blocks` компилирует их с #439,
  43 блока при каждом запуске, а три сломанных исправлены. Пример над
  функцией теперь проверяется точно так же, как пример в руководстве, так что это
  больше не причина что-то переносить.

  Отметим также, что гниёт, а что нет. Абзац, который вы читаете,
  сам был устаревшим два дня после того, как #439 влился, — проза в руководстве не безопаснее
  прозы в комментарии. Проверки защищают *код* в обоих местах;
  предложения вокруг него остаются на нас в любом случае.

### Форма, которая работает

Отработана в #417 и обобщена здесь. Укажите на канонический текст, затем перечислите
только то, что важно при редактировании:

```ts
/**
 * Executes a batch request … (one or two lines)
 *
 * **The full argument reference, the three `calls` formats and worked examples
 * live in [the batch page](…) — that copy is compiled in CI, this one would
 * not be.**
 *
 * What matters while editing this file:
 *   - at most 50 commands …
 *   - flags belong in `options` …
 */
```

Двенадцать строк вместо девяноста, аргумент в одном месте под линтером и
указатель, который переживёт правки.

### Делайте это попутно

Когда файл в следующий раз затрагивается по другой причине. Массовый перенос был бы огромным
диффом без изменения поведения и с высоким риском потерять что-то
по дороге.

## Иерархии классов

Четыре канонических класса наследуются от одной абстрактной базы. При расширении выбирайте самый нижний подходящий — не дублируйте логику в `B24Frame`/`B24Hook`/`B24OAuth`, если она может жить в `AbstractB24`.

```text
AbstractB24                       packages/jssdk/src/core/abstract-b24.ts
├── B24Frame                      packages/jssdk/src/frame/b24.ts
├── B24Hook                       packages/jssdk/src/hook/b24.ts
└── B24OAuth                      packages/jssdk/src/oauth/b24.ts
```

`AbstractB24` уже владеет:

- публичной поверхностью `actions.vX.<name>` (`call`, `batch`, `batchByChunk`, `callList`, `fetchList` для v2 и v3),
- HTTP-клиентами v2 + v3, доступными через `getHttpClient(version)`,
- стеком лимитеров,
- логгером (заменяется через `setLogger(logger)`),
- устаревшими сокращениями `callMethod` / `callBatch` / `callListMethod` / `fetchListMethod` / `callBatchByChunk` — **удалены в 3.0.0** (#277). Их больше нет; замены — `b24.actions.v{2,3}.{call,batch,callList,fetchList,batchByChunk}.make(options)`.

Если новая возможность не зависит от типа авторизации, поместите её в `AbstractB24`. Специализируйте в подклассе, только когда нужны iframe `postMessage`, разбор URL вебхука или обработка refresh-токена OAuth.

## Модули-менеджеры

Менеджеры в стиле помощника (в `src/helper/`, менеджеры iframe в `src/frame/`) следуют форме [стандартного шаблона модуля](#стандартный-шаблон-модуля):

- Конструктор принимает `b24: TypeB24`. Никакой прямой подстановки http, никаких синглтонов уровня модуля.
- Логгер начинается как `LoggerFactory.createNullLogger()` и заменяется через `setLogger(logger: LoggerInterface)`. Подчинённые менеджеры внутри менеджера получают логгер, проброшенный в `setLogger()` — канонический разветвлённый проброс см. в [packages/jssdk/src/helper/helper-manager.ts](../../packages/jssdk/src/helper/helper-manager.ts).
- `loadData()` / `load()` — соглашение для одноразовой жадной инициализации; последующие вызовы ничего не делают или бросают `SdkError`.
- Менеджеры жизненного цикла предоставляют `destroy()`, если держат подписки (например, Pull).

Композабл [`useB24Helper()`](../../packages/jssdk/src/helper/use-b24-helper.ts) — композабл на замыканиях; он связывает init/destroy и подписку Pull. Новые сквозные помощники должны подключаться к нему, а не вводить параллельный код жизненного цикла.

## Frame, Hook, OAuth

Это три точки входа для вызывающего кода, и правила для них строже:

- **`B24Frame`** — инициализируйте **только** через [`initializeB24Frame()`](../../packages/jssdk/src/loader-b24frame.ts). Он дедуплицирует параллельные инициализации и разбирает `window.name` для рукопожатия с порталом. Не экспортируйте альтернативный путь конструктора.
- **`B24Hook`** — **использовать только в серверном коде (Node.js / edge runtime)**. URL вебхука содержит секретный ключ доступа; отправка его в браузерный бандл раскрывает ключ каждому посетителю. Создавайте через статическую фабрику `B24Hook.fromWebhookUrl(url)`. Прямой `new B24Hook()` — внутренний. Класс выдаёт предупреждение во время выполнения, когда обнаруживает браузерный контекст, — не подавляйте его через `offClientSideWarning()` в рабочем коде (он предназначен только для тестов / SSR-заглушек).
- **`B24OAuth`** — владеет обработкой ошибок refresh-токена. Новые потоки OAuth должны переиспользовать его сообщения об ошибках, а не заново реализовывать обновление токена.

## Типы и перечисления

- Все публичные типы лежат в `src/types/` и организованы по предметным областям (`crm.ts`, `catalog.ts`, `bizproc.ts`, `event.ts`, `placement.ts`, `pull.ts`, `payloads.ts`, …).
- Перечисления вроде `EnumCrmEntityTypeId` предпочтительно импортировать из корня пакета, а не по глубокому пути.
- Файлы типов содержат *только* типы и перечисления. Никаких классов времени выполнения — они идут в отдельный модуль.
- Добавляя новую предметную область, создайте новый файл, а не раздувайте не связанный с ней.

## Инструменты

`src/tools/` — дом для утилит, ориентированных на вызывающий код:

- `Text` — помощники дат на основе Luxon, помощники чисел/форматов, генерация UUID v7.
- `Type` — проверки во время выполнения (`Type.isString`, `Type.isPlainObject`, …).
- `Browser` — определение окружения.
- `useFormatters` — форматирование валюты / локали.
- Прочее: `pick`, `omit`, `getEnumValue`, утилиты прокрутки.

Внутренние помощники идут в `src/core/tools/`. Не экспортируйте их из `index.ts`.

## Логгер

- Каждый модуль, выдающий диагностический вывод, держит `LoggerInterface` (импортируется из `../logger`) и начинает с `LoggerFactory.createNullLogger()`.
- Активный логгер подставляется методом `setLogger(logger)`, а не через конструктор. `AbstractB24` и `B24HelperManager` следуют этой форме — копируйте её.
- Настоящий логгер создаётся через `LoggerFactory.createForBrowser(name, isDev)` (из `packages/jssdk/src/logger/logger-factory.ts`); `name` становится префиксом в выводе консоли. Вызывающий код передаёт его в `b24.setLogger(...)`.

## Токены сборки

Сборка подставляет эти заглушки на этапе бандлинга (см. [packages/jssdk/build.config.ts](../../packages/jssdk/build.config.ts) и [packages/jssdk-nuxt/build.config.ts](../../packages/jssdk-nuxt/build.config.ts) для `meta.version` модуля Nuxt):

- `__SDK_VERSION__` → `version` из `packages/jssdk/package.json` (модуль Nuxt подставляет тот же токен из `packages/jssdk-nuxt/package.json` в свой `meta.version`)
- `__SDK_USER_AGENT__` → строка user-agent, отправляемая при вызовах REST

Используйте заглушки напрямую — никогда не читайте `package.json` во время выполнения и не прописывайте строку версии вручную.

## Ключевые паттерны

| Паттерн | Применение |
| --- | --- |
| Только именованные экспорты | `export class Foo`, `export function bar` — без `export default` |
| Конструктор принимает `TypeB24` | Менеджеры в стиле помощника принимают `b24: TypeB24` — никаких синглтонов уровня модуля |
| Логгер через сеттер | По умолчанию `LoggerFactory.createNullLogger()`; заменяется через `setLogger(logger)` |
| `Result` / `AjaxResult` | Все транспортные / предметные методы возвращают их — никогда не сырые ответы axios |
| `SdkError` | Нарушения инвариантов и ошибки уровня SDK, создаются с `{ code, description, status }` |
| `AjaxError` | Ошибки уровня HTTP, выводятся через `Result.getErrors()` |
| JSDoc `@deprecated` | Обязателен для любого публичного символа, который выводится из обращения |
| Реэкспорт звёздочкой | Разрешён только во внутренних агрегаторах (например, `src/types/index.ts`) |
| Токены сборки | `__SDK_VERSION__`, `__SDK_USER_AGENT__` — никогда не буквальные версии |

## Экспорт типов

Добавьте в `packages/jssdk/src/index.ts`:

// @check-ignore: same hypothetical module as above

```ts
export { MyManager } from './my-area/my-manager'
export type { MyManagerOptions } from './my-area/my-manager'
```

## Учёт соседних пакетов

Модуль Nuxt ([packages/jssdk-nuxt/src/module.ts](../../packages/jssdk-nuxt/src/module.ts)) намеренно крошечный — он лишь регистрирует `runtime/plugin`. Любая новая поверхность SDK, которой нужны автоимпорт Nuxt или обработка SSR, должна подключаться через этот runtime-плагин.

Когда вы меняете API ядра SDK:

1. Заново запустите `pnpm run package-jssdk-nuxt:typecheck`.
2. Если новая поверхность связана с Nuxt (композаблы, интеграция с app-config, настройка на этапе плагина), обновите `packages/jssdk-nuxt/src/runtime/plugin` в том же PR.
3. Если [packages/jssdk/README-AI.md](../../packages/jssdk/README-AI.md) показывает использование изменённой поверхности, обновите его — но учтите, что этот файл **переходный** (будет поглощён `AGENTS.md` и руководствами для участников в будущих PR). Когда содержимое README-AI расходится с `AGENTS.md`, побеждает `AGENTS.md`. См. примечание о разрешении конфликтов в [AGENTS.md Resources](../../AGENTS.md#ресурсы).
