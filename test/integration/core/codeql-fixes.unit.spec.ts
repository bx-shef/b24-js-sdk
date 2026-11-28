/**
 * Unit tests for the CodeQL findings fixed in the SDK (#121).
 *
 * - `oauth/auth.ts`: trailing slashes are trimmed by a loop, not `/\/+$/` (polynomial ReDoS);
 *   the derived targets must stay what they were for every spelling of the endpoints.
 * - `logger/formatter/telegram-formatter.ts`: in HTML mode the channel and the message are escaped —
 *   a `<` or `&` in a log line made Telegram reject the whole message; MarkdownV2 escaping now covers `\`.
 * - `pullClient/client.ts`: subscriber maps have no prototype, so a `__proto__` module or command
 *   from the Pull server cannot reach `Object.prototype`.
 *
 * Portal-free (`jsSdk:unit`).
 */
import { describe, it, expect } from 'vitest'
import { AuthOAuthManager } from '../../../packages/jssdk/src/oauth/auth'
import { TelegramFormatter } from '../../../packages/jssdk/src/logger/formatter/telegram-formatter'
import { PullClient } from '../../../packages/jssdk/src/pullClient/client'
import { LogLevel } from '../../../packages/jssdk/src/types/logger'
import type { B24OAuthParams, B24OAuthSecret } from '../../../packages/jssdk/src/types/auth'
import { ApiVersion } from '../../../packages/jssdk/src/types/b24'
import type { TypeB24 } from '../../../packages/jssdk/src/types/b24'

const secret: B24OAuthSecret = { clientId: 'id', clientSecret: 'secret' }
const auth = (clientEndpoint: string, serverEndpoint: string) => new AuthOAuthManager({
  applicationToken: '',
  userId: 1,
  memberId: 'm',
  accessToken: 'a',
  refreshToken: 'r',
  expires: Math.floor(Date.now() / 1000) + 3600,
  expiresIn: 3600,
  scope: 'crm',
  domain: 'example.bitrix24.by',
  clientEndpoint,
  serverEndpoint,
  status: 'L',
  issuer: 'request'
} as B24OAuthParams, secret)

describe('OAuth endpoints without a regex for trailing slashes', () => {
  it('every spelling gives the same targets', () => {
    for (const [client, server] of [
      ['https://example.bitrix24.by/rest/', 'https://oauth.bitrix24.tech/rest/'],
      ['https://example.bitrix24.by/rest', 'https://oauth.bitrix24.tech/rest'],
      ['https://example.bitrix24.by/rest///', 'https://oauth.bitrix24.tech/rest//']
    ] as const) {
      const manager = auth(client, server)
      expect(manager.getTargetOrigin()).toBe('https://example.bitrix24.by')
      expect(manager.getTargetOriginWithPath().get(ApiVersion.v2)).toBe('https://example.bitrix24.by/rest')
    }
  })

  it('a long run of slashes is linear, not polynomial', () => {
    const endpoint = 'https://example.bitrix24.by/rest' + '/'.repeat(100_000) + 'x'
    const started = performance.now()
    auth(endpoint, endpoint)
    expect(performance.now() - started).toBeLessThan(200)
  })
})

describe('Telegram formatter escaping', () => {
  const record = (message: string, channel = 'b24') => ({
    channel,
    level: LogLevel.ERROR,
    levelName: 'ERROR',
    message,
    context: {},
    extra: {},
    timestamp: new Date(2026, 10, 28, 12, 0, 0)
  }) as any

  it('HTML: the message and the channel are escaped', () => {
    const text = new TelegramFormatter(true).format(record('a < b && <a href="x">link</a>', '<ch>'))
    expect(text).toContain('a &lt; b &amp;&amp; &lt;a href=&quot;x&quot;&gt;link&lt;/a&gt;')
    expect(text).toContain('<code>&lt;ch&gt;</code>')
    expect(text).not.toContain('<a href')
  })

  it('a long HTML message is not cut inside an entity', () => {
    const text = new TelegramFormatter(true, 'YYYY', 120).format(record('&'.repeat(200)))
    expect(text.endsWith('...')).toBe(true)
    expect(text.slice(0, -3)).not.toMatch(/&[#a-z0-9]{0,7}$/i)
  })

  it('MarkdownV2 escaping covers the backslash', () => {
    const formatter = new TelegramFormatter(false) as any
    expect(formatter._escapeMarkdownV2('a\\b_c*d.e!')).toBe('a\\\\b\\_c\\*d\\.e\\!')
  })
})

describe('Pull subscribers without a prototype', () => {
  // Настоящий клиент: проверяется инициализация полей класса, а не подставленная карта
  const createClient = () => new PullClient({
    b24: {} as unknown as TypeB24,
    userId: 42,
    serverEnabled: true,
    skipStorageInit: true,
    skipCheckRevision: true
  }) as any

  it('the subscriber maps have no prototype', () => {
    const client = createClient()
    expect(Object.getPrototypeOf(client._subscribers)).toBeNull()
    client.subscribe({ type: 'server', moduleId: '__proto__', command: 'constructor', callback: () => {} })
    expect(Object.getPrototypeOf(client._subscribers.server)).toBeNull()
    expect(Object.hasOwn(client._subscribers.server, '__proto__')).toBe(true)
    expect(Object.getPrototypeOf(client._subscribers.server['__proto__'].commands)).toBeNull()
    expect(({} as any).commands).toBeUndefined()
  })

  it('emit before any subscription: a `constructor` command from the server does not throw', () => {
    const client = createClient()
    expect(() => client.emit({ type: 'server', moduleId: 'im', data: { command: 'constructor', params: {}, extra: {} } })).not.toThrow()
    expect(Object.getPrototypeOf(client._subscribers.server.im.commands)).toBeNull()
  })

  it('user status callbacks: `__proto__` from the server is not a callback list', () => {
    const client = createClient()
    expect(Object.getPrototypeOf(client._userStatusCallbacks)).toBeNull()
  })
})
