import type { Formatter, LogRecord } from '../../types/logger'
import { formatDate } from './date-format'

/**
 * Base class for log formatters: the date in `{date}` and the Unix time in `{timestamp}`.
 *
 * `dateFormat` uses `YYYY`, `YY`, `DD`, `D` for year and day (they are converted to `yyyy`, `yy`, `dd`,
 * `d`); every other token is the Luxon one — `MM`, `MMM`, `HH`, `hh`, `mm`, `ss`, `SSS`, `a`, `ZZ`…
 * The full list is in `date-format.ts`. Default: `YYYY-MM-DD HH:mm:ss`.
 */
export abstract class AbstractFormatter implements Formatter {
  protected dateFormat: string

  constructor(
    dateFormat: string = 'YYYY-MM-DD HH:mm:ss'
  ) {
    this.dateFormat = dateFormat
  }

  public abstract format(record: LogRecord): string

  protected _formatTimestamp(date: Date): string {
    // As Luxon: no usable date gives 'NaN', not an exception
    return Math.floor((date instanceof Date ? date.getTime() : Number.NaN) / 1000).toFixed(0)
  }

  protected _formatDate(date: Date): string {
    return formatDate(date, this.dateFormat
      .replace(/YYYY/g, 'yyyy')
      .replace(/YY/g, 'yy')
      .replace(/DD/g, 'dd')
      .replace(/D/g, 'd')
    )
  }
}
