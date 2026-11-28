import uuidv7 from './uuidv7'
import { Type } from './type'

/**
 * Text helpers the SDK core needs, without Luxon.
 *
 * `Text` is a singleton class, so importing it for one method pulls in the whole class — and with it
 * Luxon (~22 KB gzip) — even for a plain webhook call. The core, frame, Pull client and logger import
 * these functions instead; `Text` delegates to them, so the behaviour lives in one place (#115).
 *
 * @internal Not part of the public API — use `Text`.
 */

/** Current local timestamp for log lines, `yyyy-MM-dd HH:mm:ss`. */
export function getDateForLog(date: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Random RFC 4122 version 4 identifier (`Math.random()`, not cryptographically secure). */
export function getUniqId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.trunc(Math.random() * 16)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Time-ordered UUID version 7. */
export function getUuidRfc4122(): string {
  return uuidv7()
}

/** `Number.parseFloat`, or `0` when the value is not a number. */
export function toNumber(value: any): number {
  const parsedValue = Number.parseFloat(value)

  if (Type.isNumber(parsedValue)) {
    return parsedValue
  }

  return 0.0
}

/** `Number.parseInt(value, 10)`, or `0` when the value is not a number. */
export function toInteger(value: any): number {
  return toNumber(Number.parseInt(value, 10))
}

/** `true` for `'true'`, `'y'`, `'1'`, `1`, `true` and any of `trueValues` (strings compared in lower case). */
export function toBoolean(value: any, trueValues: string[] = []): boolean {
  const transformedValue = Type.isString(value) ? value.toLowerCase() : value
  return ['true', 'y', '1', 1, true, ...trueValues].includes(transformedValue)
}

/** Upper-cases the first character. */
export function capitalize(str: string): string {
  if (!Type.isStringFilled(str)) {
    return str
  }

  return str[0]!.toUpperCase() + str.slice(1)
}

/** `application/x-www-form-urlencoded` string without the leading `?`; arrays become `key[0]=a&key[1]=b`. */
export function buildQueryString(params: any): string {
  if (Type.isNil(params)) {
    return ''
  }

  const pairs: string[] = []

  for (const [key, value] of Object.entries(params)) {
    if (Type.isArray(value)) {
      value.forEach((valueElement: any, index: number) => {
        pairs.push(
          `${encodeURIComponent(`${key}[${index}]`)}=${encodeURIComponent(valueElement)}`
        )
      })
    } else {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value as any)}`)
    }
  }

  return pairs.join('&')
}
