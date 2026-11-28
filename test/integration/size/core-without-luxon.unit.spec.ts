/**
 * Unit tests for the Luxon-free core helpers (#115).
 *
 * The SDK core, frame, Pull client and logger used to call the `Text` singleton (and the logger
 * formatters used Luxon directly). Both put Luxon (~22 KB gzip) into every consumer bundle, even a
 * single webhook call. They now use `tools/text-core.ts` and `logger/formatter/date-format.ts`.
 *
 * Luxon is still a dependency of the package (`Text.toDateTime`, `Text.toB24Format`, helper), so
 * these tests use it as the reference: the new code must produce exactly what Luxon produced.
 *
 * Portal-free (`jsSdk:unit`).
 */
import { describe, it, expect } from 'vitest'
// luxon — зависимость пакета, а не корня: берём из него
import { DateTime } from '../../../packages/jssdk/node_modules/luxon'
import * as core from '../../../packages/jssdk/src/tools/text-core'
import { Text } from '../../../packages/jssdk/src/tools/text'
import { formatDate } from '../../../packages/jssdk/src/logger/formatter/date-format'
import { LineFormatter } from '../../../packages/jssdk/src/logger/formatter/line-formatter'
import { LogLevel } from '../../../packages/jssdk/src/types/logger'

// A morning, an afternoon and midnight; single- and double-digit fields; milliseconds
const DATES = [
  new Date(2026, 0, 5, 9, 3, 7, 4),
  new Date(2026, 10, 28, 17, 45, 59, 999),
  new Date(1999, 11, 31, 0, 0, 0, 0)
]

const FORMATS = [
  'yyyy-MM-dd HH:mm:ss',
  'yy-M-d H:m:s',
  'dd.MM.yyyy hh:mm a',
  'h a',
  'yyyy-MM-dd\'T\'HH:mm:ss.SSSZZ',
  'HH:mm:ss.S',
  'ZZZ Z',
  'd MMM yyyy',
  'MMMM, EEEE',
  'LLL LLLL L LL',
  'ccc cccc',
  '\'year\' yyyy, \'\'',
  '[yyyy] / x X',
  'q qq o ooo E c',
  'u uu uuu'
]

describe('formatDate — same output as Luxon toFormat()', () => {
  for (const date of DATES) {
    for (const format of FORMATS) {
      it(`${format} @ ${date.toISOString()}`, () => {
        expect(formatDate(date, format)).toBe(DateTime.fromJSDate(date).toFormat(format))
      })
    }
  }
})

describe('formatDate — documented narrowing', () => {
  it('Luxon locale macros, week numbers and era are copied as is', () => {
    const date = DATES[0]!
    expect(formatDate(date, 't T f F W k G')).toBe('t T f F W k G')
  })
})

describe('formatDate — a record without a usable date', () => {
  it('gives the same text as Luxon instead of throwing', () => {
    for (const bad of [undefined, new Date(Number.NaN)]) {
      expect(formatDate(bad as any, 'yyyy')).toBe(DateTime.fromJSDate(bad as any).toFormat('yyyy'))
    }
  })
})

describe('logger formatters', () => {
  it('LineFormatter keeps the default date and the unix timestamp', () => {
    const timestamp = new Date(2026, 10, 28, 17, 45, 59, 999)
    const line = new LineFormatter('{timestamp} {date}').format({
      channel: 'c',
      level: LogLevel.INFO,
      levelName: 'INFO',
      message: 'm',
      context: {},
      extra: {},
      timestamp
    } as any)
    const dt = DateTime.fromJSDate(timestamp)
    expect(line).toBe(`${Math.floor(dt.toSeconds()).toFixed(0)} ${dt.toFormat('yyyy-MM-dd HH:mm:ss')}`)
  })

  it('a record without timestamp is formatted like before, not thrown on', () => {
    const line = new LineFormatter('{timestamp} {date}').format({ channel: 'c', level: LogLevel.INFO, levelName: 'INFO', message: 'm', context: {}, extra: {} } as any)
    const dt = DateTime.fromJSDate(undefined as any)
    expect(line).toBe(`${Math.floor(dt.toSeconds()).toFixed(0)} ${dt.toFormat('yyyy-MM-dd HH:mm:ss')}`)
  })
})

describe('text-core — same results as before', () => {
  it('getDateForLog matches the Luxon format it replaced', () => {
    const date = new Date(2026, 0, 5, 9, 3, 7)
    expect(core.getDateForLog(date)).toBe(DateTime.fromJSDate(date).toFormat('yyyy-MM-dd HH:mm:ss'))
    expect(Text.getDateForLog()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('numbers and booleans', () => {
    for (const value of ['42.9', 'abc', '', null, undefined, 7, '0x1A', ' 12 ']) {
      expect(core.toNumber(value)).toBe(Text.toNumber(value))
      expect(core.toInteger(value)).toBe(Text.toInteger(value))
    }
    expect(core.toInteger('42.9')).toBe(42)
    expect(core.toInteger('abc')).toBe(0)
    expect(core.toBoolean('Y')).toBe(true)
    expect(core.toBoolean('no')).toBe(false)
    expect(core.toBoolean('да', ['да'])).toBe(true)
  })

  it('identifiers, capitalize and query strings', () => {
    expect(core.getUniqId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(core.getUuidRfc4122()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(core.capitalize('pull')).toBe('Pull')
    expect(core.capitalize('')).toBe('')
    expect(core.buildQueryString({ id: 7, tag: ['a', 'b'] })).toBe('id=7&tag%5B0%5D=a&tag%5B1%5D=b')
    expect(core.buildQueryString(null)).toBe('')
  })
})
