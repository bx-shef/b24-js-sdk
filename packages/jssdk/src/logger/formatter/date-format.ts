/**
 * Formats a date with Luxon-style tokens, without Luxon.
 *
 * The logger formatters are reachable from the SDK core (`LoggerFactory` → console handler →
 * `LineFormatter`), so a Luxon import here put Luxon (~22 KB gzip) into every bundle, even a single
 * webhook call (#115). The supported tokens give the same output as Luxon's `toFormat()`, names in
 * English as Luxon prints them by default — `core-without-luxon.unit.spec.ts` compares them:
 *
 * | token | meaning |
 * |---|---|
 * | `yyyy` `yy` `y` | year: four digits / two digits / as is |
 * | `M` `MM` `L` `LL` | month number, padded or not |
 * | `MMM` `MMMM` `MMMMM` (and `L…`) | month name, short / long / narrow |
 * | `d` `dd` | day of month |
 * | `EEE` `EEEE` `EEEEE` (and `c…`) | weekday name, short / long / narrow |
 * | `H` `HH` `h` `hh` | hour, 24 / 12 h |
 * | `m` `mm` `s` `ss` | minutes, seconds |
 * | `S` `SSS` | milliseconds |
 * | `a` | AM / PM |
 * | `Z` `ZZ` `ZZZ` | UTC offset: `+3`, `+03:00`, `+0300` |
 * | `E` `c` | weekday number, 1 (Monday) … 7 |
 * | `q` `qq` | quarter |
 * | `o` `ooo` | day of year |
 * | `u` `uu` `uuu` | fraction of a second: 3 / 2 / 1 digits |
 * | `x` `X` | Unix time, milliseconds / seconds |
 * | `'text'` | literal text; `''` is a single quote |
 *
 * Any other character is copied as is. Unlike Luxon, that includes its locale macros (`t`, `T`, `f`,
 * `F`, `D`…), week numbers (`W`, `k`), era (`G`) and the zone name (`ZZZZ`) — the SDK never used them
 * in log dates.
 *
 * @internal
 */
// Longest first, so `yyyy` is not read as `yy` + `yy`. Kept in step with the table in formatDate().
export const TOKEN_NAMES = [
  'MMMMM', 'LLLLL', 'EEEEE', 'ccccc',
  'yyyy', 'MMMM', 'LLLL', 'EEEE', 'cccc',
  'MMM', 'LLL', 'EEE', 'ccc', 'SSS', 'ooo', 'uuu', 'ZZZ',
  'yy', 'MM', 'LL', 'dd', 'HH', 'hh', 'mm', 'ss', 'qq', 'uu', 'ZZ',
  'y', 'M', 'L', 'd', 'H', 'h', 'm', 's', 'S', 'a', 'E', 'c', 'q', 'o', 'u', 'x', 'X', 'Z'
]

export function formatDate(date: Date, format: string): string {
  // As Luxon: a record without a usable date is logged, not thrown on
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'Invalid DateTime'
  }
  const pad = (value: number, length: number = 2): string => String(Math.trunc(Math.abs(value))).padStart(length, '0')
  // English, as Luxon prints names unless a locale is set (it does not follow the system locale)
  const name = (options: Intl.DateTimeFormatOptions): string => new Intl.DateTimeFormat('en-US', options).format(date)
  const offset = (style: 'short' | 'colon' | 'plain'): string => {
    const minutes = -date.getTimezoneOffset()
    const sign = minutes < 0 ? '-' : '+'
    const hours = Math.trunc(Math.abs(minutes) / 60)
    const rest = Math.abs(minutes) % 60
    if (style === 'short') {
      return rest ? `${sign}${hours}:${pad(rest)}` : `${sign}${hours}`
    }
    return style === 'colon' ? `${sign}${pad(hours)}:${pad(rest)}` : `${sign}${pad(hours)}${pad(rest)}`
  }
  const hours12 = date.getHours() % 12 || 12
  const dayOfYear = Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 1)) / 86_400_000) + 1

  const tokens: Record<string, () => string> = {
    yyyy: () => pad(date.getFullYear(), 4),
    yy: () => pad(date.getFullYear() % 100),
    y: () => String(date.getFullYear()),
    MMMMM: () => name({ month: 'narrow' }),
    LLLLL: () => name({ month: 'narrow' }),
    EEEEE: () => name({ weekday: 'narrow' }),
    ccccc: () => name({ weekday: 'narrow' }),
    MMMM: () => name({ month: 'long' }),
    MMM: () => name({ month: 'short' }),
    MM: () => pad(date.getMonth() + 1),
    M: () => String(date.getMonth() + 1),
    LLLL: () => name({ month: 'long' }),
    LLL: () => name({ month: 'short' }),
    LL: () => pad(date.getMonth() + 1),
    L: () => String(date.getMonth() + 1),
    dd: () => pad(date.getDate()),
    d: () => String(date.getDate()),
    EEEE: () => name({ weekday: 'long' }),
    EEE: () => name({ weekday: 'short' }),
    cccc: () => name({ weekday: 'long' }),
    ccc: () => name({ weekday: 'short' }),
    HH: () => pad(date.getHours()),
    H: () => String(date.getHours()),
    hh: () => pad(hours12),
    h: () => String(hours12),
    mm: () => pad(date.getMinutes()),
    m: () => String(date.getMinutes()),
    ss: () => pad(date.getSeconds()),
    s: () => String(date.getSeconds()),
    SSS: () => pad(date.getMilliseconds(), 3),
    S: () => String(date.getMilliseconds()),
    a: () => (date.getHours() < 12 ? 'AM' : 'PM'),
    E: () => String(date.getDay() || 7),
    c: () => String(date.getDay() || 7),
    qq: () => pad(Math.floor(date.getMonth() / 3) + 1),
    q: () => String(Math.floor(date.getMonth() / 3) + 1),
    ooo: () => pad(dayOfYear, 3),
    o: () => String(dayOfYear),
    uuu: () => String(Math.floor(date.getMilliseconds() / 100)),
    uu: () => pad(Math.floor(date.getMilliseconds() / 10)),
    u: () => pad(date.getMilliseconds(), 3),
    x: () => String(date.getTime()),
    X: () => String(Math.floor(date.getTime() / 1000)),
    ZZZ: () => offset('plain'),
    ZZ: () => offset('colon'),
    Z: () => offset('short')
  }

  let out = ''
  for (let i = 0; i < format.length;) {
    if (format[i] === '\'') {
      const end = format.indexOf('\'', i + 1)
      if (end === i + 1) {
        out += '\''
        i += 2
        continue
      }
      out += end === -1 ? format.slice(i + 1) : format.slice(i + 1, end)
      i = end === -1 ? format.length : end + 1
      continue
    }
    const token = TOKEN_NAMES.find(candidate => format.startsWith(candidate, i))
    if (token) {
      out += tokens[token]!()
      i += token.length
      continue
    }
    out += format[i]
    i++
  }
  return out
}
