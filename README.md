[![npm version](https://img.shields.io/npm/v/@bitrix24/b24jssdk)](https://www.npmjs.com/package/@bitrix24/b24jssdk)
[![license](https://img.shields.io/npm/l/@bitrix24/b24jssdk)](./LICENSE)
[![CI](https://github.com/bitrix24/b24jssdk/actions/workflows/ci.yml/badge.svg)](https://github.com/bitrix24/b24jssdk/actions/workflows/ci.yml)

# @bitrix24/b24jssdk

JavaScript/TypeScript SDK для REST API Битрикс24. Поддерживает три сценария использования:

- **B24Frame** — iframe-приложения, встроенные в интерфейс Битрикс24 (токен текущего пользователя используется автоматически)
- **B24Hook** — серверные приложения с постоянным токеном вебхука
- **B24OAuth** — серверные приложения с OAuth 2.0 и обновлением токена

## Установка

```bash
pnpm add @bitrix24/b24jssdk
```

Для проектов на Nuxt:

```bash
pnpm add @bitrix24/b24jssdk-nuxt
```

## Быстрый старт

### B24Frame (iframe-приложение)

```ts
import { initializeB24Frame } from '@bitrix24/b24jssdk'

const $b24 = await initializeB24Frame()

const response = await $b24.actions.v2.call.make({
  method: 'user.current',
  requestId: 'get-current-user'
})

if (response.isSuccess) {
  console.log(response.getData())
}

$b24.destroy()
```

### B24Hook (серверный вебхук)

```ts
import { B24Hook } from '@bitrix24/b24jssdk'

const $b24 = B24Hook.fromWebhookUrl(process.env.B24_HOOK!)

const response = await $b24.actions.v2.call.make({
  method: 'user.current',
  requestId: 'get-current-user'
})

if (response.isSuccess) {
  console.log(response.getData())
}

$b24.destroy()
```

### B24OAuth (приложение с OAuth)

```ts
import { B24OAuth } from '@bitrix24/b24jssdk'

const $b24 = new B24OAuth(tokenData, appCredentials)

const response = await $b24.actions.v2.call.make({
  method: 'user.current',
  requestId: 'get-current-user'
})

if (response.isSuccess) {
  console.log(response.getData())
}

$b24.destroy()
```

## Документация

Полная документация: [https://bitrix24.github.io/b24jssdk/](https://bitrix24.github.io/b24jssdk/)

## Участие в разработке

Руководство для контрибьюторов и ИИ-агентов — в [AGENTS.md](./AGENTS.md).

## Безопасность

Нашли уязвимость? Сообщите о ней приватно —
[см. SECURITY.md](./SECURITY.md): там же объяснено, что относится к этому репозиторию,
а что — к самому Битрикс24.

## Журнал изменений

См. [CHANGELOG.md](./CHANGELOG.md).
