export default defineAppConfig({
  toaster: {
    position: 'top-right' as const,
    duration: 5000,
    max: 5,
    expand: true
  },
  b24ui: {},
  colorMode: true,
  // Тёмная тема сайта — штатная `dark` с фоном «Василька» (main.css). У `edge-dark` в b24ui тёмный только фон,
  // а окна с `base-mode` (поиск, панель чата) остаются светлыми — белые «островки» (#70, #49).
  colorModeInitialValue: 'dark' as const, // dark | edge-dark | edge-light | light
  // Светлая тема сайта — `edge-light` (светлый перелив «Василька», main.css). Было `edge-dark`: режим «light»
  // ставил тот же тёмный класс, и светлая тема не включалась (#70).
  colorModeTypeLight: 'edge-light' as const, // edge-dark | edge-light | light
  bxAssistant: {
    icons: {
      explain: undefined,
      trigger: undefined
    },
    floatingInput: true,
    explainWithAi: true,
    shortcuts: {
      focusInput: 'meta_i'
    },
    faqQuestions: [
      {
        category: 'С чего начать',
        items: [
          'Как подключить SDK к порталу через вебхук?',
          'Чем B24Hook отличается от B24Frame и B24OAuth?',
          'Как вызвать метод REST API v3?'
        ]
      },
      {
        category: 'Работа с данными',
        items: [
          'Как получить все сделки, если их больше 50?',
          'Как выполнить пакетный запрос (batch)?',
          'Как обработать ошибку вызова метода?'
        ]
      }
    ]
  }
})
