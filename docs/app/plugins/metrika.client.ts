/**
 * Яндекс Метрика — как на посадочных линейки bx-shef (bx-shef/toolsai, site/landing):
 * баннер согласия `cookie-consent.js` (копия из bx-shef/Lp), Метрика — только после согласия
 * на аналитику, без Вебвизора (он записывал бы ввод, в том числе вопросы чату).
 * Номер счётчика — `NUXT_PUBLIC_YANDEX_METRIKA_ID` при запуске; пусто или не число — ничего
 * не грузится, баннера тоже нет. Цели — `useAnalytics().track()` → `reachGoal`.
 */
declare global {
  interface Window {
    BxConsent?: { onAnalytics: (fn: () => void) => void }
    ym?: (id: number, method: string, ...args: unknown[]) => void
  }
}

export default defineNuxtPlugin(() => {
  const raw = String(useRuntimeConfig().public.yandexMetrikaId ?? '').trim()
  if (!/^\d+$/.test(raw)) {
    return
  }
  const id = Number(raw)
  const baseUrl = useRuntimeConfig().app.baseURL.replace(/\/$/, '')

  const consent = document.createElement('script')
  consent.src = `${baseUrl}/cookie-consent.js`
  consent.setAttribute('data-policy', 'https://offer.bx-shef.by/privacy')
  consent.setAttribute('data-services', 'Яндекс Метрику (статистика посещений)')
  consent.onload = () => {
    window.BxConsent?.onAnalytics(() => {
      const w = window as unknown as Record<string, unknown> & Window
      if (!w.ym) {
        const queue = function (...args: unknown[]) {
          ((queue as unknown as { a: unknown[] }).a ||= []).push(args)
        }
        ;(queue as unknown as { l: number }).l = Date.now()
        w.ym = queue as Window['ym']
      }
      const tag = document.createElement('script')
      tag.async = true
      tag.src = 'https://mc.yandex.ru/metrika/tag.js'
      document.head.appendChild(tag)
      w.ym!(id, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false, defer: true })
      // Сайт — одностраничное приложение: первый просмотр и каждый переход — хит вручную (defer: true).
      w.ym!(id, 'hit', location.href, { title: document.title })
      useRouter().afterEach((to) => {
        nextTick(() => w.ym?.(id, 'hit', new URL(to.fullPath, location.origin).href, { title: document.title }))
      })
    })
  }
  document.head.appendChild(consent)

  useState('yandex-metrika-id', () => id)
})
