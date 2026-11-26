type AllowedPropertyValues = string | number | boolean | null | undefined
type PlainFlags = Record<string, unknown>
type FlagsDataInput = (string | PlainFlags)[] | PlainFlags

/**
 * Параметры, которые можно отправить в Метрику. Свободный ввод посетителя (поисковый запрос,
 * текст вопроса чату) сюда не входит: в нём бывают вебхуки, токены и персональные данные.
 */
const ALLOWED_KEYS = new Set(['action', 'page', 'source', 'restapiVersion', 'length'])

/**
 * События сайта → цели Яндекс Метрики (`reachGoal`). Метрика подключается плагином
 * `metrika.client.ts` только при заданном номере счётчика и после согласия на аналитику;
 * до этого и после отзыва согласия вызовы ничего не делают.
 */
export function useAnalytics() {
  const metrikaId = useState<number | undefined>('yandex-metrika-id')

  function track(
    name: string,
    properties?: Record<string, AllowedPropertyValues>,
    _options?: { flags?: FlagsDataInput }
  ): void {
    if (import.meta.server) {
      return
    }
    const id = metrikaId.value
    if (!id || typeof window.ym !== 'function' || !window.BxConsent?.granted()) {
      return
    }
    const params = Object.fromEntries(
      Object.entries(properties ?? {}).filter(([key]) => ALLOWED_KEYS.has(key))
    )
    window.ym(id, 'reachGoal', name, params)
  }

  return {
    track
  }
}
