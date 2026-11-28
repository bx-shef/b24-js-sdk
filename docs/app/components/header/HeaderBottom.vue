<script setup lang="ts">
import type { NavigationMenuItem } from '@bitrix24/b24ui-nuxt'
import type { ContentNavigationItem } from '@nuxt/content'
import { mapContentNavigation } from '@bitrix24/b24ui-nuxt/utils/content'
import { withoutTrailingSlash } from 'ufo'

const route = useRoute()

const navigation = inject<Ref<ContentNavigationItem[]>>('navigation')

const items = computed<NavigationMenuItem[]>(() => mapContentNavigation(navigation?.value.map(item => ({ ...item, children: undefined })) ?? [])?.map(item => ({
  ...item,
  to: withoutTrailingSlash(item.to as string),
  active: route.path.startsWith(withoutTrailingSlash(item.to as string))
})) as NavigationMenuItem[])
</script>

<template>
  <B24Separator class="hidden lg:flex" />

  <!-- С открытой панелью чата строка уже ~700 px: меню разделов сжимается и прокручивается вбок,
       переключатель версии не сжимается (перенос строки сломал бы фиксированную высоту шапки, 112 px) -->
  <B24Container class="hidden lg:flex items-center justify-between gap-3 pt-2.5 px-0">
    <B24NavigationMenu
      :items="items"
      class="ps-2px min-w-0 overflow-x-auto scrollbar-thin"
    />

    <RestApiVersionTabs class="shrink-0" />
  </B24Container>
</template>
