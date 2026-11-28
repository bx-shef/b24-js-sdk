<script setup lang="ts">
import type { BreadcrumbItem } from '@bitrix24/b24ui-nuxt'
import type { ContentNavigationItem } from '@nuxt/content'
import { withoutTrailingSlash } from 'ufo'

const route = useRoute()

const navigation = inject<Ref<ContentNavigationItem[]>>('navigation')
const { findBreadcrumb } = useNavigation(navigation!)

// Разделы — в верхнем меню (useHeader). Здесь — путь к открытой странице: раздел → группа → страница (#87).
function findTitle(items: ContentNavigationItem[] | undefined, path: string): string | undefined {
  for (const item of items ?? []) {
    if (withoutTrailingSlash(item.path) === path && !item.children?.length) {
      return item.title
    }
    const found = findTitle(item.children, path)
    if (found) {
      return found
    }
  }
  return undefined
}

const items = computed<BreadcrumbItem[]>(() => {
  const path = withoutTrailingSlash(route.path)
  const trail = findBreadcrumb(path)
    .filter(link => link.label && withoutTrailingSlash(String(link.to ?? '')) !== '/docs')
    .map(link => ({ label: link.label, to: link.to ? withoutTrailingSlash(String(link.to)) : undefined }))
  const title = findTitle(navigation?.value, path)
  if (title && trail.at(-1)?.label !== title) {
    trail.push({ label: title, to: undefined })
  }
  return trail
})
</script>

<template>
  <B24Separator class="hidden lg:flex" />

  <B24Container class="hidden lg:flex items-center justify-between gap-4 pt-2.5 pb-2 px-0 min-h-11">
    <B24Breadcrumb :items="items" class="ps-2px min-w-0" />

    <RestApiVersionTabs />
  </B24Container>
</template>
