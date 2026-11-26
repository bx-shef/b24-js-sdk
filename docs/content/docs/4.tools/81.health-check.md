---
title: HealthCheck.make()
description: 'Метод проверки доступности REST API Битрикс24. Выполняет простой запрос к REST API, чтобы проверить работоспособность сервиса.'
category: 'tools'
audited: 2026-09-05
navigation.title: HealthCheck
links:
  - label: HealthCheck
    iconName: GitHubIcon
    to: https://github.com/bitrix24/b24jssdk/blob/main/packages/jssdk/src/core/tools/healthcheck.ts
---

## Обзор

Используйте `HealthCheck.make()`{lang="ts-type"}, чтобы проверить доступность REST API Битрикс24. Метод возвращает `Promise` с булевым значением, указывающим доступность API.

```ts
// Basic usage
const isHealthy = await $b24.tools.healthCheck.make()

if (isHealthy) {
  console.log('Bitrix24 API is available')
} else {
  console.error('Problems accessing Bitrix24 API')
}
```

## Сигнатура метода

```ts-type
make(
  options?: { requestId?: string }
): Promise<boolean>
```

### Параметры

| Параметр | Тип | Обязательный | Описание |
|----|----|----|----|
| **`requestId`** | `string`{lang="ts-type"} | Нет | Уникальный идентификатор запроса для отслеживания и отладки — передаётся как параметр запроса `bx24_request_id`. Он ничего не дедуплицирует; для этого см. `idempotencyKey` (restApi:v3). |

### Возвращаемое значение

`Promise<boolean>`{lang="ts-type"} — промис, который разрешается булевым значением:

- **`true`** — REST API доступен и отвечает, вебхук настроен правильно.
- **`false`** — REST API недоступен, произошла ошибка или не хватает прав доступа.

## Обработка ошибок

`HealthCheck.make()`{lang="ts-type"} никогда не выбрасывает исключение. Сбои сети, ошибки HTTP, отсутствующие области доступа и тайм-ауты сводятся к возвращаемому значению `false`. Метод намеренно служит зондом «чёрного ящика» — для получения подробностей об ошибке вызовите нужный метод напрямую через [`CallV2.make()`](/docs/working-with-the-rest-api/call-rest-api-ver2/) и изучите `AjaxResult` (`isSuccess`, `getErrorMessages()`).

## Примеры

### Проверка доступности

::code-example
---
name: 'tools-health-check'
---
::

## Альтернативы и рекомендации

* **Для измерения скорости ответа**: используйте [`Ping`](/docs/working-with-the-rest-api/tools-ping/).
* **Для проверки конкретных прав**: выполните тестовый запрос к нужному методу API.
* **На стороне клиента (в браузере):** используйте встроенный объект [`B24Frame`](/docs/getting-started/installation/vue/#инициализация).
