import { describe, it, expect, vi } from 'vitest'

// h3 is a dependency of the docs app, not of the root workspace the unit project runs in.
vi.mock('h3', () => ({
  createError: (o: { status: number, message: string }) => Object.assign(new Error(o.message), o),
  getHeader: () => undefined,
  getRequestIP: () => undefined
}))
import { assertMessages, messageText } from '../../../docs/modules/bx-assistant/runtime/server/utils/guard'

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
})
