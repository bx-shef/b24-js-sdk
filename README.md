[![npm version](https://img.shields.io/npm/v/@bxshefby/b24jssdk)](https://www.npmjs.com/package/@bxshefby/b24jssdk)
[![license](https://img.shields.io/npm/l/@bxshefby/b24jssdk)](./LICENSE)
[![CI](https://github.com/bx-shef/b24-js-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/bx-shef/b24-js-sdk/actions/workflows/ci.yml)

# @bxshefby/b24jssdk

JavaScript/TypeScript SDK для REST API Битрикс24. Поддерживает три сценария использования:

- **B24Frame** — iframe-приложения, встроенные в интерфейс Битрикс24 (токен текущего пользователя используется автоматически)
- **B24Hook** — серверные приложения с постоянным токеном вебхука
- **B24OAuth** — серверные приложения с OAuth 2.0 и обновлением токена

## Установка

```bash
pnpm add @bxshefby/b24jssdk
```

Для проектов на Nuxt:

```bash
pnpm add @bxshefby/b24jssdk-nuxt
```

## Уже на `@bitrix24/b24jssdk`?

Версия `3.1.0` совместима с `@bitrix24/b24jssdk@3.0.0`: переход — смена имени пакета, код не меняется. Как перейти, в том числе без правки импортов, — [«Переход с @bitrix24/b24jssdk»](https://b24-js-sdk.bx-shef.by/docs/getting-started/migration/from-bitrix24/).

## Быстрый старт

### B24Frame (iframe-приложение)

```ts
import { initializeB24Frame } from '@bxshefby/b24jssdk'

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
import { B24Hook } from '@bxshefby/b24jssdk'

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
import { B24OAuth } from '@bxshefby/b24jssdk'

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

Полная документация: [https://b24-js-sdk.bx-shef.by/](https://b24-js-sdk.bx-shef.by/)

## Для AI-агентов

- **MCP-сервер документации:** `https://b24-js-sdk.bx-shef.by/mcp/` — агент сам находит нужные страницы и примеры. Подключение для Claude Code, Cursor, VS Code и Windsurf — [страница «MCP-сервер»](https://b24-js-sdk.bx-shef.by/docs/getting-started/ai/mcp/). Claude Code:

  ```bash
  claude mcp add --transport http b24-jssdk https://b24-js-sdk.bx-shef.by/mcp/
  ```

- **Навыки** (`SKILL.md` под задачи) — каталог [`skills/`](./skills), [описание](https://b24-js-sdk.bx-shef.by/docs/getting-started/ai/skills/).
- **LLMs.txt** — [`/llms.txt`](https://b24-js-sdk.bx-shef.by/llms.txt) (обзор) и [`/llms-full.txt`](https://b24-js-sdk.bx-shef.by/llms-full.txt) (вся документация).

## Участие в разработке

Руководство для контрибьюторов и AI-агентов — в [AGENTS.md](./AGENTS.md).

## Безопасность

Нашли уязвимость? Сообщите о ней приватно —
[см. SECURITY.md](./SECURITY.md): там же объяснено, что относится к этому репозиторию,
а что — к самому Битрикс24.

## Журнал изменений

См. [CHANGELOG.md](./CHANGELOG.md).
