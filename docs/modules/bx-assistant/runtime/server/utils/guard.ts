import { createError, getHeader, getRequestIP } from 'h3'
import type { H3Event } from 'h3'
import { APICallError, RetryError } from 'ai'

/**
 * Gate shared by the two AI endpoints (`/api/ai` and the assistant search):
 * switch, key, per-client and per-day limits, and the shape of `messages`.
 * Every request spends the site's DeepSeek key, so each one passes here first.
 *
 * In-memory: one server process, as in deploy/docker-compose.prod.yml.
 */

const WINDOW_MS = 60_000
const PER_CLIENT_PER_MINUTE = Number(process.env.ASSISTANT_RATE_PER_MINUTE) || 20
const PER_DAY = Number(process.env.ASSISTANT_DAILY_LIMIT) || 2000
const MAX_MESSAGES = 30
// What a person typed into one message. Tool calls and their results from earlier answers ride along in the
// history (a documentation page is tens of KB) and must not count here — otherwise every follow-up question
// fails with 400 once the first answer has read a page.
const MAX_MESSAGE_LENGTH = 32_000
// The whole history, tool results included: bounds the request body.
const MAX_HISTORY_LENGTH = 1_500_000

const perClient = new Map<string, { count: number, resetAt: number }>()
let day = { count: 0, resetAt: 0 }

setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of perClient) {
    if (now > entry.resetAt) perClient.delete(ip)
  }
}, WINDOW_MS).unref?.()

/**
 * Behind nginx-proxy every request comes from the proxy's address. The proxy
 * appends the address it saw to X-Forwarded-For, so the LAST entry is the one
 * our proxy vouches for; earlier entries are whatever the client sent and would
 * let it pick a fresh bucket per request. Trusted only when the deployment says
 * a proxy is in front (NUXT_TRUST_PROXY=true); a CDN in front of nginx-proxy
 * would need the hop count raised.
 */
function clientKey(event: H3Event): string {
  if (process.env.NUXT_TRUST_PROXY === 'true') {
    const hop = getHeader(event, 'x-forwarded-for')?.split(',').at(-1)?.trim()
    if (hop) return hop
  }
  return getRequestIP(event) ?? 'unknown'
}

function tooMany(retryAfter: number): never {
  throw createError({ status: 429, message: 'Too many requests. Please try again later.', data: { retryAfter } })
}

export function assistantGuard(event: H3Event, enabled: boolean): void {
  if (!enabled) {
    throw createError({ status: 404, message: 'Not found.' })
  }
  if (!process.env.DEEPSEEK_API_KEY?.trim()) {
    throw createError({ status: 503, message: 'The AI assistant is not configured on this server.' })
  }
}

/** Counts a request against both limits. Call after the body is validated, so junk does not spend the day. */
export function chargeAssistant(event: H3Event): void {
  const now = Date.now()
  if (now > day.resetAt) day = { count: 0, resetAt: now + 24 * 60 * 60_000 }
  if (day.count >= PER_DAY) tooMany(Math.ceil((day.resetAt - now) / 1000))

  const key = clientKey(event)
  const entry = perClient.get(key)
  if (!entry || now > entry.resetAt) {
    perClient.set(key, { count: 1, resetAt: now + WINDOW_MS })
  } else if (entry.count >= PER_CLIENT_PER_MINUTE) {
    tooMany(Math.ceil((entry.resetAt - now) / 1000))
  } else {
    entry.count++
  }
  day.count++
}

export function assertMessages(messages: unknown): asserts messages is unknown[] {
  if (!Array.isArray(messages)) {
    throw createError({ status: 400, message: 'Invalid or missing messages array.' })
  }
  if (messages.length > MAX_MESSAGES) {
    throw createError({ status: 400, message: 'Too many messages in conversation.' })
  }
  for (const msg of messages as any[]) {
    if (messageText(msg).length > MAX_MESSAGE_LENGTH) {
      throw createError({ status: 400, message: 'Message content exceeds maximum allowed length.' })
    }
  }
  if (JSON.stringify(messages).length > MAX_HISTORY_LENGTH) {
    throw createError({ status: 413, message: 'Conversation is too long. Start a new chat.' })
  }
}

/**
 * The text of a message: string `content` plus the `text` parts of `parts` / array `content` (AI SDK UI
 * messages). Both are counted — the model reads `parts`, so a short `content` must not hide a long `parts`.
 */
export function messageText(msg: any): string {
  const own = typeof msg?.content === 'string' ? msg.content : ''
  const parts = [
    ...(Array.isArray(msg?.parts) ? msg.parts : []),
    ...(Array.isArray(msg?.content) ? msg.content : [])
  ]
  return own + parts
    .filter((part: any) => part?.type === 'text' && typeof part.text === 'string')
    .map((part: any) => part.text)
    .join('')
}

const TOOL_OUTPUT_KEEP = 1_000

/**
 * The history as it goes to the model: tool results from earlier answers cut to their first
 * {@link TOOL_OUTPUT_KEEP} characters. The chat window sends every page the assistant read back with each
 * question; re-sending them spends the DeepSeek key on every turn and, a few turns in, overflows the model's
 * context. The assistant can call the tool again when it needs a page. Parts keep their type and state,
 * so tool calls stay paired with results.
 */
export function trimToolOutputs<T>(messages: T[]): T[] {
  return messages.map((msg: any) => {
    if (!Array.isArray(msg?.parts)) {
      return msg
    }
    return {
      ...msg,
      parts: msg.parts.map((part: any) => {
        const isTool = typeof part?.type === 'string' && (part.type.startsWith('tool-') || part.type === 'dynamic-tool')
        if (!isTool || part.output === undefined) {
          return part
        }
        const text = typeof part.output === 'string' ? part.output : JSON.stringify(part.output)
        if (text.length <= TOOL_OUTPUT_KEEP) {
          return part
        }
        return { ...part, output: `${text.slice(0, TOOL_OUTPUT_KEEP)}… [обрезано: результат прошлого ответа, при необходимости вызовите инструмент снова]` }
      })
    }
  })
}

/** Код ответа провайдера; после повторов SDK отдаёт RetryError, а ответ провайдера — в `lastError`. */
export function chatErrorStatus(error: unknown): number | undefined {
  const cause = RetryError.isInstance(error) ? error.lastError : error
  return APICallError.isInstance(cause) ? cause.statusCode : undefined
}

/**
 * Ошибка провайдера несёт исходящий запрос (`requestBodyValues`) и сырой ответ — то есть переписку.
 * В лог — только опознавательные поля (как в чате nuxt/ui). Текст `message` — только у ошибки провайдера
 * (короткая фраза API): у ошибок разбора и инструментов он может цитировать переписку.
 */
export function logChatError(error: unknown) {
  const cause = RetryError.isInstance(error) ? error.lastError : error
  console.error('[api/ai] stream error:', {
    name: error instanceof Error ? error.name : 'UnknownError',
    statusCode: chatErrorStatus(error),
    message: APICallError.isInstance(cause) ? cause.message.slice(0, 300) : undefined
  })
}

/** Текст ошибки для окна чата: подробности провайдера пользователю не нужны. */
export function chatErrorText(error: unknown): string {
  return chatErrorStatus(error) === 429
    ? 'Сейчас слишком много запросов к помощнику. Попробуйте через минуту.'
    : 'Не получилось ответить. Попробуйте ещё раз или переформулируйте вопрос.'
}
