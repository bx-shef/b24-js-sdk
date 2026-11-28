import { ru } from '@bitrix24/b24ui-nuxt/locale'

/**
 * Русская локаль b24ui с правками сайта (#71). «Размышление заняло {duration}»: длительность b24ui собирает
 * через Intl в именительном падеже («1 секунда»), и выходило «заняло 1 секунда». Фраза-подпись грамотна при
 * любом числе.
 */
export const siteLocale = extendLocale(ru, {
  messages: {
    chatReasoning: {
      thoughtFor: 'Время размышления: {duration}'
    }
  }
})
