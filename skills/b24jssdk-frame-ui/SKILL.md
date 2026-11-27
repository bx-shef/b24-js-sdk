---
name: b24jssdk-frame-ui
description: Используйте UI-менеджеры B24Frame (slider, dialog, parent, placement, options, auth) из приложения во встройке (placement iframe) Битрикс24. Охватывает открытие слайдеров с мобильным запасным вариантом, выбор пользователей и сущностей CRM, изменение размера родительского окна, placement setValue, сохранение опций приложения и пользователя. Загружайте при генерации UI-кода внутри фрейма. Используйте также на просьбы «встройка», «приложение в Битрикс24», «слайдер», «диалог выбора сотрудника», «окно приложения», «placement», «размер фрейма», «открыть карточку CRM».
---

# UI во фрейме b24jssdk

Эти менеджеры существуют **только** в `B24Frame`. Ни один из них не работает с `B24Hook` или `B24OAuth`. Всегда инициализируйте так:

```ts
import { initializeB24Frame } from '@bxshefby/b24jssdk'
const $b24 = await initializeB24Frame()
```

…и вызывайте `$b24.destroy()`, когда страница/компонент размонтируется.

## Слайдер — открытие путей и страниц приложения

```ts
// 1. Open a portal path in a slider
const url = $b24.slider.getUrl('/crm/deal/details/1')
const status = await $b24.slider.openPath(url, /* width */ 1640)

if (status.isOpenAtNewWindow) {
  // Mobile fallback: it opened a new tab and polled for close
}

// 2. Open YOUR app's page as a slider. Settles with '' when it is CLOSED — don't await to "open"
$b24.slider.openSliderAppPage({ some: 'param' }).then(() => { /* the slider was closed */ }).catch(() => {})

// Inside the slider: closing from code never settles, and on a cloud portal it
// left the page unclickable (#486). Prefer the portal's ✕.
$b24.slider.closeSliderAppPage().catch(() => {})
```

`openPath` возвращается, когда слайдер закрывается (или закрывается всплывающее окно на мобильном). Если вы полагаетесь на определение закрытия, всегда проверяйте `isOpenAtNewWindow`.

`openPath` открывает путь **портала**; `openSliderAppPage` заново открывает **URL вашего собственного зарегистрированного обработчика**. Если направить `openPath` на страницу приложения, портал вернёт 404.

`openSliderAppPage` завершается при **закрытии**, а не при открытии, и всегда со значением `''` (измерено, #486). Он никогда не завершается, если вызывающая страница перезагружается, пока слайдер открыт.

Всё, что вы передаёте в `openSliderAppPage`, пересылается в новый фрейм как `PLACEMENT_OPTIONS`, поэтому `place` — обычный параметр вызова, **а не** зарегистрированная встройка, и `placement.bind` не нужен. `bx24_width` ниже вашей собственной мобильной границы молча включает мобильную раскладку.

### Маршрутизация открытого слайдера на нужный экран (Nuxt)

Работа SDK заканчивается, когда параметр доставлен; маршрутизация — ваша забота. В Nuxt **не просто возвращайте `navigateTo()` из middleware маршрута** — этот редирект молча отбрасывается, если входной маршрут пререндерится, а `nuxt build` делает это для всего из `nitro.prerender.routes` (и, при `crawlLinks`, для всего, что достижимо по ссылке). Портал открывает фрейм со строкой запроса, а для пререндеренной страницы Nuxt выполняет гидратацию на голом пути и затем восстанавливает исходный URL по `app:suspense:resolve`, минуя guards. Никакой ошибки не сообщается; слайдер просто показывает вашу главную страницу.

```ts
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const { $initializeB24Frame } = useNuxtApp()
  const $b24 = await $initializeB24Frame()

  // `options` values are `unknown` — the portal decides what it puts there, so
  // narrow before passing it on. This is the anti-pattern the skill warns about.
  const rawPlace = $b24.placement.options['place']
  const target = routeForPlace('string' === typeof rawPlace ? rawPlace : '')
  // isSamePath must tolerate a trailing slash: a static server serves `/app/`
  // while the router resolves `/app`, and a strict !== cancels every redirect.
  if (!target || isSamePath(to.path, target)) return

  // Query from the ADDRESS BAR, not `to.query` — a prerendered page hydrates on
  // the bare path, so `to` has no query and the target would lose `place`.
  const dest = { path: target, query: Object.fromEntries(new URLSearchParams(location.search)) }

  const nuxtApp = useNuxtApp()
  if (!nuxtApp.isHydrating) return navigateTo(dest, { replace: true })

  onNuxtReady(() => {
    void nuxtApp.runWithContext(async () => {
      const router = useRouter()
      if (!isSamePath(router.currentRoute.value.path, to.path)) return
      // router.replace, not navigateTo: navigateTo RETURNS a route object when it
      // catches another navigation in progress, and nobody would apply it.
      // Check the result — a failed navigation resolves, it does not throw.
      const failure = await router.replace(dest)
      if (failure) console.warn('slider redirect failed', failure.type)
    })
  })
})
```

`onNuxtReady` работает, потому что подключается к тому же `app:suspense:resolve`, но подписывается позже и откладывается до `requestIdleCallback`, выполняясь после восстановления. `app:mounted` слишком рано — он падает с `NavigationFailure: aborted`. `redirectCode` работает только на сервере, `abortNavigation` не умеет перенаправлять, а `external: true` означает полную перезагрузку.

## Диалог — выбор пользователей

```ts
const single = await $b24.dialog.selectUser()
// single: { id, name, lastName, photo, … } | null

const many = await $b24.dialog.selectUsers()
// many: SelectedUser[]
```

## Диалог — выбор сущностей CRM (`selectCRM`)

Активный метод (реализован заново в `packages/jssdk/src/frame/dialog.ts:175-235`). Возвращает объект с группами по типам сущностей, каждая из которых — настоящий `Array`, поэтому можно использовать `.length`/`.map()`/`for..of`. Группы для типов сущностей, которые вы не запрашивали, равны `undefined`.

```ts
import type { SelectCRMParams, SelectedCRM } from '@bxshefby/b24jssdk'

// Pick one contact
const single = await $b24.dialog.selectCRM({
  entityType: ['contact'],
  multiple: false
})
const contact = single.contact?.[0]
// contact: { id: 'C_<n>', title, image, … } | undefined

// Pick multiple deals and companies, with pre-selected values
const picked: SelectedCRM = await $b24.dialog.selectCRM({
  entityType: ['deal', 'company'],
  multiple: true,
  // Numeric ids, not the prefixed `D_42` / `CO_7` form the dialog returns.
  value: { deal: [42], company: [7] }
})

for (const deal of picked.deal ?? []) {
  console.log(deal.id, deal.title) // id type-narrows to `D_${number}`
}
```

Формат id зависит от сущности:

- лид → `L_<n>`
- контакт → `C_<n>`
- компания → `CO_<n>`
- сделка → `D_<n>`
- предложение → `Q_<n>`

## Диалог — выбор получателей доступа (`selectAccess`)

```ts
// The argument is a string[] of permission ids to block, not an options object.
const access = await $b24.dialog.selectAccess([])
```

Используется реже. Возвращает исходные данные выбора доступа от родительского окна — форму см. в документации Битрикс24 по selectAccess.

## Parent — управление iframe в раскладке портала

```ts
await $b24.parent.fitWindow()                // shrink-wrap to content
await $b24.parent.resizeWindow(800, 600)     // explicit size
await $b24.parent.resizeWindowAuto(rootEl, /* minH */ 400, /* minW */ 300)
await $b24.parent.setTitle('My App')         // in-page #pagetitle, NOT the browser tab
await $b24.parent.scrollParentWindow(0)
await $b24.parent.reloadWindow()

// Closing: save first, then close without awaiting (#328).
await $b24.options.appSet('draft', 'value')
$b24.parent.closeApplication().catch(() => {})
```

`setTitle` меняет `#pagetitle` на странице, а не вкладку браузера — чтобы задать заголовок вкладки браузера, откройте слайдер через `slider.openSliderAppPage({ bx24_title: '…' })`.

Для IM:

```ts
await $b24.parent.imCallTo(/* userId */ 5, /* video */ true)
await $b24.parent.imOpenMessenger('chat12')
await $b24.parent.imPhoneTo('+70000000000')
await $b24.parent.imOpenHistory('chat12')
```

**Все четыре — «отправил и забыл».** Обработчики портала не принимают колбэк, поэтому
никто никогда не отвечает: промис завершается по собственному короткому таймеру SDK и означает,
что *команда отправлена*, а не что звонок начался или чат открылся. Никогда не ветвитесь по нему как по
признаку успеха и не считайте сбоем следующую за ним строку лога `action im… stop by
timeout` — это нормальный исход.

Вызов любого из них печатает уведомление об устаревании в консоли **портала**,
рекомендующее `Messenger.startPhoneCall` / `startVideoCall` / `openChat`. Это
методы верхнего окна, и они **недоступны из приложения** — они не входят
в набор команд встройки. Уведомление исходит из собственного слоя
совместимости портала, до которого эти методы всё равно доходят; избежать его нельзя,
и переходить не на что. См. [#331](https://github.com/bitrix24/b24jssdk/issues/331).

`imPhoneTo` принимает второй аргумент `params`, а `imOpenMessenger` — второй
`messageId`, повторяя собственные `startPhoneCall(number, params)` и
`openChat(dialogId, messageId)` портала. **Сегодня портал не передаёт ни тот, ни другой**, так что
они пока не действуют — отправляйте их, только чтобы не пришлось ничего менять, когда это появится.

## Placement — контекст, из которого пользователь открыл ваше приложение

```ts
$b24.placement.title           // string identifier of the placement
$b24.placement.options         // params passed by the placement; Readonly<Record<string, unknown>>, never undefined
$b24.placement.isSliderMode    // boolean

const iface = await $b24.placement.getInterface()

// React to events from the host page
await $b24.placement.bindEvent('onCrmEntityUpdate', (...args) => {
  console.log('host event:', args)
})

// Call host-defined commands
await $b24.placement.call('someCommand', { foo: 'bar' })
await $b24.placement.callCustomBind('someCommand', { opt: 1 }, (...args) => {
  // result callback
})
```

### `placement.setValue` — отправка значения обратно во встройку-хозяин

Используйте `setValue`, когда ваш iframe смонтирован во встройке типа «выбор значения» (например, пользовательский селектор поля CRM). Хост ожидает **JSON-сериализованную строку** и вызывает `JSON.parse` при получении.

```ts
// Convenience helper that serializes for you (preferred)
await $b24.placement.setValue('plain string')
await $b24.placement.setValue({ id: 1, title: 'demo' })
await $b24.placement.setValue([1, 2, 3])
```

Ручная форма через `placement.call('setValue', …)` тоже поддерживается, но `value` ДОЛЖНО быть уже JSON-сериализованной строкой — иначе SDK бросает `TypeError` (см. `packages/jssdk/src/frame/placement.ts:104-113`):

```ts
// Equivalent but requires you to stringify yourself
await $b24.placement.call('setValue', { value: JSON.stringify({ id: 1 }) })
```

## Options — сохранение настроек приложения и пользователя

```ts
// App-level (visible to all users of this app on the portal)
await $b24.options.appSet('installComplete', true)
const installed = $b24.options.appGet('installComplete')

// User-level (per-user on this portal)
await $b24.options.userSet('theme', 'dark')
const theme = $b24.options.userGet('theme')
```

Значения сериализуются в JSON на стороне сервера. Чтение возвращает разобранное значение.

Для пакетных/структурированных опций предпочитайте менеджер опций уровня помощника (см. `b24jssdk-helpers`).

## Auth — окружение, обновление, язык

```ts
const auth = $b24.auth.getAuthData()
// { access_token, refresh_token, expires_in, domain, member_id } | false

if (!auth) {
  await $b24.auth.refreshAuth()
}

const lang = $b24.getLang()    // 'ru' | 'en' | …
const sid = $b24.getAppSid()
```

SDK автоматически обновляет авторизацию при 401 — ручной `refreshAuth()` нужен редко.
Параллельные вызовы `refreshAuth()` склеиваются в одно сообщение родительскому окну.

### Поддержание токена — для приложений, использующих токен вне SDK

Автообновление работает **только на пути запроса**: уже истёкший токен
обновляется перед вызовом (действующий используется как есть), а также при 401.
Приложение, которое читает токен и отправляет его на **собственный бэкенд**, не делает
вызовов `$b24`, поэтому токен никто не обновляет: через `AUTH_EXPIRES` секунд простоя вкладки
токен пропадает, и собственные запросы приложения начинают отвечать 401.

```ts
import { initializeB24Frame } from '@bxshefby/b24jssdk'

// Opt in — off by default, and pass it at the app's FIRST init (the first
// caller's options win). Refreshes ahead of expiry, re-checks when the tab
// becomes visible again, backs off when the parent window refuses. Costs no
// REST call (it is a postMessage), never throws at the app, stops with
// $b24.destroy().
const $b24 = await initializeB24Frame({ keepAuthFresh: true })

// Tune it if the portal hands out short-lived tokens:
// keepAuthFresh: { marginMs: 120_000, minDelayMs: 30_000, maxDelayMs: 120_000 }
```

Включайте, когда токен покидает SDK или когда страница долго остаётся открытой без действий.
Не включайте, если каждый запрос идёт через `$b24` — Битрикс предупреждает, что
слишком частое обновление грозит автоматической блокировкой приложения.

## Шаблон жизненного цикла (Vue 3)

```ts
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { initializeB24Frame, type B24Frame } from '@bxshefby/b24jssdk'

const $b24 = ref<B24Frame | null>(null)

onMounted(async () => {
  $b24.value = await initializeB24Frame()
  await $b24.value.parent.setTitle('My App')
  await $b24.value.parent.fitWindow()
})

onBeforeUnmount(() => {
  $b24.value?.destroy()
})
```

## Режим установки — завершите его, иначе портал ничего вам не отправит

Приложение «устанавливается» с момента, когда пользователь принимает диалог установки,
и до вызова `installFinish()`. Пока этот вызов не дошёл, портал считает приложение
наполовину установленным и **не доставляет ему событий** — обработчики ботов, обработчики,
зарегистрированные через `event.bind`, и другие исходящие вызовы не доходят до ваших эндпоинтов.

Сбой тихий: регистрация проходит, `imbot.register` возвращает `botId`,
обработчики видны при запросе, а трафик не приходит. Поэтому сгенерированный код
должен всегда завершать процесс установки.

<!-- Синхронизировать с: docs 30.frame.md (installFinish), docs 99.examples/20.app-installation-wizard.md, skills/b24jssdk-core/SKILL.md. -->

```ts
import { initializeB24Frame } from '@bxshefby/b24jssdk'
const $b24 = await initializeB24Frame()

if ($b24.isInstallMode) {
  // provision fields, register placements, seed options...

  // Last statement of the flow: the portal reloads the page in response,
  // so anything after this may never run.
  await $b24.installFinish()
}
```

Для **приложения только с API и без интерфейса установки** верно обратное: оно
*не* должно вызывать `installFinish()`. Его установка завершается автоматически, а
метод работает только внутри фрейма с браузерным интерфейсом — поэтому ограничивайте вызов
условием `isInstallMode`, которое истинно только внутри такого фрейма.

Завершение установки — шаг **жизненного цикла**, а не безопасности. Приложение, которое
ещё и держит эндпоинт установки/удаления по OAuth, всё равно обязано проверять `application_token`
в `ONAPPINSTALL` / `ONAPPUNINSTALL` — см. страницу [Security patterns](https://bitrix24.github.io/b24jssdk/docs/working-with-the-rest-api/security/).
Одно не заменяет другое.

Чтобы проверить приложение, которое портал игнорирует, спросите, считает ли он его установленным:
`app.info` возвращает `INSTALLED`, а `false` означает, что `installFinish()` так и не дошёл.

## Антипаттерны

- ❌ Использовать `B24Frame` вне встройки Битрикс24 — `initializeB24Frame()` зависнет в ожидании рукопожатия с родителем. Для контекстов без фрейма используйте `B24Hook`.
- ❌ Вызывать API слайдера / диалога до того, как `await initializeB24Frame()` завершится.
- ❌ Подготавливать приложение в режиме установки и никогда не вызывать `installFinish()` — приложение остаётся наполовину установленным, портал не доставляет ему события, и ничто громко об этом не сообщает.
- ❌ Размещать работу после `await installFinish()` — портал в ответ перезагружает страницу, поэтому она может никогда не выполниться.
- ❌ `$b24.placement.call('setValue', { value: { id: 1 } })` — бросает исключение, потому что `value` не строка. Используйте `$b24.placement.setValue({ id: 1 })` или сериализуйте сами.
- ❌ Хранить секреты в `options.appSet` — опции встройки видны всем, кто имеет к ней доступ.
- ❌ Считать завершившийся промис `parent.im*` доказательством того, что звонок начался или чат открылся, — на эти команды никто не отвечает; промис означает лишь, что сообщение отправлено.
- ❌ Вызывать `parent.closeApplication()` без `.catch(() => {})` и тут же `$b24.destroy()` — `destroy()` отклоняет каждую выполняющуюся команду с `JSSDK_FRAME_DISPOSED`, а брошенный промис превращается в необработанное отклонение. Добавьте `.catch`.
- ❌ `await parent.closeApplication()` — в некоторых сборках портал никогда не отвечает, и ожидание бесконечно (#328). Сначала очистка, затем закрытие без await.
- ❌ Считать отсутствующую группу `selectCRM` пустым массивом — она `undefined`. Используйте `picked.deal ?? []`.
- ❌ `return navigateTo(target)` из middleware маршрута Nuxt для маршрутизации открытого слайдера — молча отбрасывается на пререндеренном входном маршруте. Переходите из `onNuxtReady` во время гидратации.
- ❌ Доверять `$b24.placement.options['place']` без сужения типа — значения `unknown`, потому что данные пересекают границу postMessage от портала. Регистр ключей — тоже выбор портала: для встройки по умолчанию объект **и есть** строка запроса URL фрейма. (С 3.0.0 SDK нормализует формы с пустой строкой и с отсутствием значения (JSON-строка тоже обрабатывается, хотя она относится к пути повторной отправки формы и при рукопожатии не наблюдалась), так что `?.` больше не нужен.)
- ❌ Привязывать диагностику слайдера к `placement.isSliderMode` — он выводится из `PLACEMENT_OPTIONS.IFRAME`, поэтому замолкает ровно тогда, когда данных встройки, которые вы диагностируете, нет.
