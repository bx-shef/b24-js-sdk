/**
 * Яндекс Метрика — как на посадочных линейки bx-shef (bx-shef/toolsai, site/landing):
 * баннер согласия `cookie-consent.js` (копия из bx-shef/Lp), Метрика — только после согласия
 * на аналитику, без Вебвизора (он записывал бы ввод, в том числе вопросы чату).
 * Номер счётчика — `NUXT_PUBLIC_YANDEX_METRIKA_ID` при запуске; пусто или не число — ничего
 * не грузится, баннера тоже нет. Цели — `useAnalytics().track()` → `reachGoal`.
 * В Метрику уходит адрес страницы без query и hash.
 */
declare global {
  interface Window {
    BxConsent?: { onAnalytics: (fn: () => void) => void, granted: () => boolean, open: () => void }
    ym?: (id: number, method: string, ...args: unknown[]) => void
    __bxMetrikaInit?: boolean
  }
}

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const raw = String(config.public.yandexMetrikaId ?? '').trim()
  if (!/^\d+$/.test(raw) || window.__bxMetrikaInit) {
    return
  }
  window.__bxMetrikaInit = true
  const id = Number(raw)
  const baseUrl = config.app.baseURL.replace(/\/$/, '')
  // Контекст Nuxt — здесь, а не в асинхронном onload.
  const router = useRouter()
  useState('yandex-metrika-id', () => id)

  const pageUrl = (path: string) => `${location.origin}${path}`
  let lastUrl = ''
  const hit = (url: string) => {
    if (url === lastUrl || !window.BxConsent?.granted()) {
      return
    }
    lastUrl = url
    window.ym?.(id, 'hit', url, { title: document.title })
  }

  const consent = document.createElement('script')
  consent.src = `${baseUrl}/cookie-consent.js`
  consent.setAttribute('data-policy', COOKIE_POLICY_URL)
  consent.setAttribute('data-services', 'Яндекс Метрику (статистика посещений)')
  consent.onload = () => {
    window.BxConsent?.onAnalytics(() => {
      if (!window.ym) {
        const queue = function (...args: unknown[]) {
          ((queue as unknown as { a: unknown[] }).a ||= []).push(args)
        }
        ;(queue as unknown as { l: number }).l = Date.now()
        window.ym = queue as Window['ym']
      }
      const tag = document.createElement('script')
      tag.async = true
      tag.src = 'https://mc.yandex.ru/metrika/tag.js'
      document.head.appendChild(tag)
      window.ym!(id, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false, defer: true })
      // Одностраничное приложение: хиты вручную (defer: true) — первый просмотр и каждый переход.
      router.isReady().then(() => {
        hit(pageUrl(location.pathname))
        router.afterEach((to) => {
          nextTick(() => hit(pageUrl(to.path)))
        })
      })
    })
  }
  document.head.appendChild(consent)
})
