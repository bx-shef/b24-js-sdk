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
import { formatDate, TOKEN_NAMES } from '../../../packages/jssdk/src/logger/formatter/date-format'
import { LineFormatter } from '../../../packages/jssdk/src/logger/formatter/line-formatter'
import { LogLevel } from '../../../packages/jssdk/src/types/logger'

// A morning, an afternoon, noon, half past noon and midnight; single- and double-digit fields; milliseconds
const DATES = [
  new Date(2026, 0, 5, 9, 3, 7, 4),
  new Date(2026, 10, 28, 17, 45, 59, 999),
  new Date(2026, 2, 1, 12, 0, 0, 50),
  new Date(2026, 5, 15, 12, 30, 0, 0),
  new Date(1999, 11, 31, 0, 0, 0, 0)
]

// Offsets with minutes and negative ones too — CI runs in UTC, where `+5:30` would never be checked
const ZONES = ['UTC', 'Europe/Minsk', 'America/St_Johns', 'Asia/Kolkata', 'America/Los_Angeles']

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
  'u uu uuu',
  'y yy yyyy',
  'MMMMM EEEEE LLLLL ccccc'
]

describe('formatDate — same output as Luxon toFormat()', () => {
  for (const zone of ZONES) {
    it(`all formats and dates, TZ=${zone}`, () => {
      const saved = process.env.TZ
      process.env.TZ = zone
      try {
        for (const date of DATES) {
          for (const format of FORMATS) {
            // Same wall-clock fields in each zone: rebuild the date there
            const local = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds())
            expect(formatDate(local, format), `${format} @ ${local.toString()}`).toBe(DateTime.fromJSDate(local).toFormat(format))
          }
        }
      } finally {
        process.env.TZ = saved
      }
    })
  }

  it('names are English whatever the system locale, as Luxon prints them by default', () => {
    const date = new Date(2026, 0, 5, 9, 0, 0)
    expect(formatDate(date, 'MMM MMMM EEE EEEE')).toBe('Jan January Mon Monday')
  })

  it('every token in the list is implemented', () => {
    const date = new Date(2026, 0, 5, 9, 3, 7, 4)
    for (const token of TOKEN_NAMES) {
      expect(formatDate(date, token), token).not.toBe(token)
    }
  })
})

describe('formatDate — documented narrowing', () => {
  it('Luxon locale macros, week numbers and era are copied as is', () => {
    const date = DATES[0]!
    expect(formatDate(date, 't T f F W k G')).toBe('t T f F W k G')
    expect(formatDate(date, 'ZZZZ')).toBe(formatDate(date, 'ZZZ') + formatDate(date, 'Z'))
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
