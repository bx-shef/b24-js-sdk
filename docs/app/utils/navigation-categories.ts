/**
 * Категории боковой навигации по разделам документации.
 *
 * Чистый модуль без Vue/Nuxt-импортов: его читают `useNavigation.ts` (подставляет иконки
 * по `icon`) и тест `scripts/__tests__/docs-sections-categories.test.mjs` (читает файл как
 * текст). Каждый элемент — ОДНА строка вида `{ id: '…', title: '…', icon: '…' }`:
 * тест разбирает именно такой формат.
 *
 * Страница с `category`, которой нет в списке раздела, попадает в группу «Прочее»
 * (`OTHER_CATEGORY_TITLE`), а не пропадает из меню.
 */
export type NavigationCategoryIcon = 'layers' | 'item' | 'none'

export type NavigationCategory = {
  id: string
  title: string
  icon: NavigationCategoryIcon
}

export const OTHER_CATEGORY_TITLE = 'Прочее'

export const navigationCategories: Record<string, NavigationCategory[]> = {
  'actions': [
    { id: 'actions', title: 'Методы вызова', icon: 'layers' },
    { id: 'guides', title: 'Руководства', icon: 'item' }
  ],
  'entry-points': [
    { id: 'B24Frame', title: 'B24Frame', icon: 'item' },
    { id: 'B24Hook', title: 'B24Hook', icon: 'item' },
    { id: 'B24OAuth', title: 'B24OAuth', icon: 'item' },
    { id: 'Helper', title: 'Помощники', icon: 'item' },
    { id: 'Pull', title: 'Pull', icon: 'item' }
  ],
  'tools': [
    { id: 'logger', title: 'Логирование', icon: 'item' },
    { id: 'limiters', title: 'Лимитеры', icon: 'item' },
    { id: 'Core', title: 'Ядро', icon: 'item' },
    { id: 'tools', title: 'Утилиты', icon: 'item' },
    { id: 'Types', title: 'Типы', icon: 'item' },
    { id: 'security', title: 'Безопасность', icon: 'item' }
  ],
  'getting-started': [
    { id: 'integrations', title: 'Интеграции', icon: 'none' },
    { id: 'aiTools', title: 'AI-инструменты', icon: 'none' }
  ],
  'examples': [
    { id: 'examples', title: 'Рецепты', icon: 'item' }
  ]
}
