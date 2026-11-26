type AllowedPropertyValues = string | number | boolean | null | undefined
type PlainFlags = Record<string, unknown>
type FlagsDataInput = (string | PlainFlags)[] | PlainFlags

/**
 * События сайта → цели Яндекс Метрики (`reachGoal`). Метрика подключается плагином
 * `metrika.client.ts` только при заданном номере счётчика и после согласия на аналитику;
 * до этого вызовы ничего не делают.
 */
export function useAnalytics() {
  function track(
    name: string,
    properties?: Record<string, AllowedPropertyValues>,
    _options?: { flags?: FlagsDataInput }
  ): void {
    if (import.meta.server) {
      return
    }
    const id = useState<number | undefined>('yandex-metrika-id').value
    if (!id || typeof window.ym !== 'function') {
      return
    }
    window.ym(id, 'reachGoal', name, properties ?? {})
  }

  return {
    track
  }
}
