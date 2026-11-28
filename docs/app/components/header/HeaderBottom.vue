<script setup lang="ts">
import type { BreadcrumbItem } from '@bitrix24/b24ui-nuxt'
import type { ContentNavigationItem } from '@nuxt/content'
import { findPageBreadcrumb } from '@nuxt/content/utils'
import { withoutTrailingSlash } from 'ufo'

const route = useRoute()

const navigation = inject<Ref<ContentNavigationItem[]>>('navigation')

// Разделы — в верхнем меню (useHeader). Здесь — путь к открытой странице: раздел → группа → страница (#87).
// Ссылкой — только пункт, у которого есть своя страница: у групп меню («AI», «Установка», «Миграция»)
// её нет, и ссылка вела бы на пустой адрес (сборка создавала для них заглушки без CSP).
function hasPage(item: ContentNavigationItem): boolean {
  if (item.page === false) {
    return false
  }
  return !item.children?.length || item.children.some(child => withoutTrailingSlash(child.path) === withoutTrailingSlash(item.path))
}

const items = computed<BreadcrumbItem[]>(() => {
  const path = withoutTrailingSlash(route.path)
  const trail: BreadcrumbItem[] = []
  for (const item of findPageBreadcrumb(navigation?.value, path, { current: true, indexAsChild: true })) {
    const itemPath = withoutTrailingSlash(item.path)
    if (itemPath === '/docs' || !item.title || trail.at(-1)?.label === item.title) {
      continue
    }
    const isCurrent = itemPath === path
    trail.push({ label: item.title, to: !isCurrent && hasPage(item) ? itemPath : undefined })
  }
  return trail
})
</script>

<template>
  <B24Separator class="hidden lg:flex" />

  <!-- С открытой панелью чата строка уже ~700 px: путь сжимается (обрезается многоточием), переключатель версии
       не сжимается (перенос строки сломал бы фиксированную высоту шапки, 112 px) -->
  <B24Container class="hidden lg:flex items-center justify-between gap-4 pt-2.5 pb-2 px-0 min-h-11">
    <B24Breadcrumb :items="items" class="ps-2px min-w-0" />

    <RestApiVersionTabs class="shrink-0" />
  </B24Container>
</template>
