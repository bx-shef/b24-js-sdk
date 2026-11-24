import { createError, getRequestIP } from 'h3'
import type { H3Event } from 'h3'

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
const MAX_MESSAGE_LENGTH = 32_000

const perClient = new Map<string, { count: number, resetAt: number }>()
let day = { count: 0, resetAt: 0 }

setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of perClient) {
    if (now > entry.resetAt) perClient.delete(ip)
  }
}, WINDOW_MS).unref?.()

/**
 * Behind nginx-proxy every request comes from the proxy's address, so the client
 * is the first `X-Forwarded-For` entry — trusted only when the deployment says the
 * proxy sets it (NUXT_TRUST_PROXY=true). Otherwise a client could pick its own key.
 */
function clientKey(event: H3Event): string {
  const trustProxy = process.env.NUXT_TRUST_PROXY === 'true'
  return getRequestIP(event, { xForwardedFor: trustProxy }) ?? 'unknown'
}

function tooMany(retryAfter: number): never {
  throw createError({ status: 429, message: 'Too many requests. Please try again later.', data: { retryAfter } })
}

export function assistantGuard(event: H3Event, enabled: boolean): void {
  if (!enabled) {
    throw createError({ status: 404, message: 'Not found.' })
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    throw createError({ status: 503, message: 'The AI assistant is not configured on this server.' })
  }

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
    const content = JSON.stringify(msg?.content ?? msg?.parts ?? '')
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw createError({ status: 400, message: 'Message content exceeds maximum allowed length.' })
    }
  }
}
