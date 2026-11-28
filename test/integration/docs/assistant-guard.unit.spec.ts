import { describe, it, expect, vi } from 'vitest'

// h3 is a dependency of the docs app, not of the root workspace the unit project runs in.
vi.mock('h3', () => ({
  createError: (o: { status: number, message: string }) => Object.assign(new Error(o.message), o),
  getHeader: () => undefined,
  getRequestIP: () => undefined
}))
import { assertMessages, messageText, trimToolOutputs } from '../../../docs/modules/bx-assistant/runtime/server/utils/guard'

const user = (text: string) => ({ id: 'u', role: 'user', parts: [{ type: 'text', text }] })
// What the chat window sends back after an answer that read a documentation page:
// the tool result is the whole page, tens of KB.
const assistantWithTool = (pageSize: number) => ({
  id: 'a',
  role: 'assistant',
  parts: [
    { type: 'step-start' },
    { type: 'tool-get-documentation-page', toolCallId: 't1', state: 'output-available', input: { path: '/docs/actions/batch' }, output: { content: 'x'.repeat(pageSize) } },
    { type: 'text', text: 'Используйте B24Hook.fromWebhookUrl(...).' }
  ]
})

describe('assistant guard — assertMessages', () => {
  it('a follow-up question after an answer that read a large page passes (was 400)', () => {
    expect(() => assertMessages([user('Как подключить SDK?'), assistantWithTool(56_000), user('А пакетный запрос?')])).not.toThrow()
  })

  it('a message a person typed over the limit is rejected', () => {
    expect(() => assertMessages([user('x'.repeat(32_001))])).toThrow(/maximum allowed length/)
  })

  it('the whole history is bounded', () => {
    expect(() => assertMessages([user('q'), assistantWithTool(1_600_000), user('q')])).toThrow(/too long/)
  })

  it('too many messages and a non-array are rejected', () => {
    expect(() => assertMessages(Array.from({ length: 31 }, () => user('q')))).toThrow(/Too many/)
    expect(() => assertMessages({})).toThrow(/Invalid/)
  })

  it('messageText takes string content or the text parts only', () => {
    expect(messageText({ content: 'abc' })).toBe('abc')
    expect(messageText(assistantWithTool(10))).toBe('Используйте B24Hook.fromWebhookUrl(...).')
    expect(messageText({})).toBe('')
  })

  it('a short string content does not hide long text parts', () => {
    expect(() => assertMessages([{ role: 'user', content: 'a', parts: [{ type: 'text', text: 'x'.repeat(32_001) }] }])).toThrow(/maximum allowed length/)
  })
})

describe('assistant guard — trimToolOutputs', () => {
  it('cuts long tool results, keeps text, type and state', () => {
    const [, a] = trimToolOutputs([user('q'), assistantWithTool(56_000)]) as any[]
    const tool = a.parts.find((p: any) => p.type.startsWith('tool-'))
    expect(tool.state).toBe('output-available')
    expect(tool.toolCallId).toBe('t1')
    expect(tool.output.length).toBeLessThan(1_200)
    expect(tool.output).toMatch(/обрезано/)
    expect(a.parts.find((p: any) => p.type === 'text').text).toBe('Используйте B24Hook.fromWebhookUrl(...).')
  })

  it('leaves short results and user messages as they are', () => {
    const msgs = [user('q'), assistantWithTool(100)]
    expect(trimToolOutputs(msgs)).toEqual(msgs)
  })
})

describe('assistant guard — chat errors', () => {
  it('429 is recognised directly and after retries (RetryError.lastError)', async () => {
    const { APICallError, RetryError } = await import('ai')
    const { chatErrorStatus, chatErrorText } = await import('../../../docs/modules/bx-assistant/runtime/server/utils/guard')
    const busy = new APICallError({ message: 'Too Many Requests', url: 'https://api.deepseek.com', requestBodyValues: { messages: ['secret'] }, statusCode: 429 })
    const retried = new RetryError({ message: 'Failed after 3 attempts', reason: 'maxRetriesExceeded', errors: [busy, busy] })
    expect(chatErrorStatus(busy)).toBe(429)
    expect(chatErrorStatus(retried)).toBe(429)
    expect(chatErrorText(retried)).toMatch(/слишком много запросов/)
    expect(chatErrorText(new Error('x'))).toMatch(/Не получилось ответить/)
  })
})
