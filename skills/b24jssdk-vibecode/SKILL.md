---
name: b24jssdk-vibecode
description: Как сочетать SDK b24jssdk с HTTP API VibeCode (vibecode.bitrix24.tech). Большинству команд НЕ нужно смешивать их — выберите одно. Навык объясняет почему, где они пересекаются и единственный практичный шаблон, когда нужны оба. Загружайте, только если пользователь прямо упоминает VibeCode.
---

# b24jssdk × VibeCode

VibeCode (`https://vibecode.bitrix24.tech`) — это **отдельный HTTP-сервис**, построенный поверх REST Битрикс24. Он предоставляет JSON Entity API (`/v1/deals`, `/v1/contacts`, …), AI Router (`/v1/ai/chat/completions`), веб-поиск (`/v1/search`) и «инфраструктурный» API для размещаемых развёртываний. Это **не** REST Битрикс24.

`@bitrix24/b24jssdk` — тонкая TypeScript-обёртка над **самим REST Битрикс24**. Эти два продукта решают разные задачи и используют разные транспорты.

## Матрица выбора

| Вы хотите… | Используйте |
| --- | --- |
| Читать/писать сущности Битрикс24 (CRM, задачи, диск, IM) с сервера или из приложения во фрейме | **b24jssdk** (`B24Hook`/`B24Frame`/`B24OAuth`) |
| Чтобы LLM развернула приложение поверх Битрикс24 со своими ключами (`vibe_api_…`/`vibe_app_…`) | **VibeCode** напрямую (без SDK) |
| Использовать размещённый AI Router или прокси веб-поиска Битрикс24 | **VibeCode** напрямую |
| Работать на сервере под управлением VibeCode *и* по-прежнему читать/писать Битрикс24 обычным способом | **Ключ VibeCode для AI/поиска + b24jssdk для Битрикс24** |

Для всего, что связано с Битрикс24, по умолчанию берите b24jssdk. К VibeCode обращайтесь, только когда вам нужны именно AI Router, веб-поиск или инфраструктура VibeCode.

## Почему не стоит смешивать их для вызовов сущностей

Имена полей и диалект фильтров в Entity API отличаются от REST Битрикс24:

| Битрикс24 (b24jssdk) | VibeCode |
| --- | --- |
| `actions.v2.callList.make({ method: 'crm.item.list', params: { filter: { '>=opportunity': 50000 } } })` | `POST /v1/deals/search`, тело `{ "amount": { "$gte": 50000 } }` |
| Операторы фильтра: `>=`, `<=`, `!`, `%`, `=%` (v2) или `[['fld','>=','v']]` (v3) | В стиле MongoDB: `$gte`, `$lte`, `$ne`, `$contains`, `$in` |
| `phone: [{ VALUE, VALUE_TYPE }]` (множественное значение) | `phone: "+7..."` (часто одна строка) |
| `STAGE_ID` / `stageId` (зависит от версии метода) | всегда camelCase |
| Авторизация: секрет вебхука в URL или токены OAuth | Авторизация: `X-Api-Key: vibe_api_…` |

Чтобы превратить работающий запрос b24jssdk в тело запроса VibeCode, нужно **переписать** синтаксис операторов и имена полей. Это не бесплатная замена. Выбрав одно, вы сохраняете согласованность кода.

## Шаблон «AI-надстройка» (VibeCode только для AI)

Если у вашего портала есть ключ `vibe_api_…`, а вам нужны только AI Router или веб-поиск, оставьте b24jssdk для Битрикс24 и вызывайте эндпоинты VibeCode обычным `fetch`:

```ts
import {
  B24Hook,
  EnumCrmEntityTypeId,
  type TypeB24
} from '@bitrix24/b24jssdk'

const $b24: TypeB24 = B24Hook.fromWebhookUrl(process.env.B24_HOOK!)

// 1. Read a deal via b24jssdk (Bitrix24 REST)
const dealRes = await $b24.actions.v2.call.make<{ item: { id: number; title: string } }>({
  method: 'crm.item.get',
  params: {
    entityTypeId: EnumCrmEntityTypeId.deal,
    id: 42
  }
})
if (!dealRes.isSuccess) throw new Error(dealRes.getErrorMessages().join('; '))
const deal = dealRes.getData()!.result.item

// 2. Ask the VibeCode AI Router (HTTP, no SDK)
const aiRes = await fetch('https://vibecode.bitrix24.tech/v1/ai/chat/completions', {
  method: 'POST',
  headers: {
    'X-Api-Key': process.env.VIBE_API_KEY!,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'bitrix/bitrixgpt-5',
    messages: [{ role: 'user', content: `Suggest a follow-up for: ${deal.title}` }]
  })
})
const ai = await aiRes.json()
const advice = ai.choices[0].message.content as string

// 3. Write the result back via b24jssdk
await $b24.actions.v2.call.make({
  method: 'crm.timeline.comment.add',
  params: {
    fields: { ENTITY_ID: 42, ENTITY_TYPE: 'deal', COMMENT: `[AI] ${advice}` }
  }
})
```

Вот и всё: VibeCode — для AI/поиска, b24jssdk — для всего, что связано с Битрикс24. Расширять SDK не нужно; не пытайтесь научить `B24Hook` общаться с `/v1/...`.

## Антипаттерны

- ❌ Подставлять `vibe_api_…` в `B24Hook.fromWebhookUrl()` — он ожидает URL вебхука Битрикс24, а не ключ VibeCode.
- ❌ Передавать фильтры в стиле MongoDB (`$gt`, `$lt`, `$ne`, `$contains`) в `actions.v{2,3}.*.make` — REST Битрикс24 их не понимает и возвращает 400 (v3) или неверные строки (v2 игнорирует неизвестные операторы).
- ❌ Вызывать `/v1/deals/search` из кода во фрейме, а затем `crm.item.list` для тех же сделок «для согласованности». Выберите один источник.
- ❌ Хранить ключ VibeCode в `B24Frame.options.appSet` — опции встройки (placement) видны всем пользователям, имеющим доступ к ней.

## Когда пользователи говорят «VibeCode», а имеют в виду «Битрикс24»

Документация VibeCode иногда ссылается на методы REST Битрикс24 (например, `tasks.task.add`), а иногда — на собственные эндпоинты Entity API (например, `POST /v1/tasks`). Уточните это, прежде чем генерировать код:

- Если в примере есть импорт `'@bitrix24/b24jssdk'` или речь идёт о `B24Hook` / `B24Frame` / `B24OAuth` — используйте SDK.
- Если в примере `fetch('https://vibecode.bitrix24.tech/v1/...')` с `X-Api-Key` — это VibeCode.

Если сомневаетесь, спросите пользователя, на чьей стороне он хочет жить.
