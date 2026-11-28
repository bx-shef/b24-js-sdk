<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'
import { watchDebounced } from '@vueuse/core'

interface ContentSearchFile {
  id: string
  title: string
  titles: string[]
  level: number
  content: string
}

defineProps<{
  files?: ContentSearchFile[]
  navigation?: ContentNavigationItem[]
}>()

const { links, groups, searchTerm } = useSearch()

// Подсказка с клавишей своей платформы: на Mac поиск открывает ⌘ K, а не Ctrl K
const placeholder = ref('Поиск по документации — Ctrl K')
onMounted(() => {
  if (/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) {
    placeholder.value = 'Поиск по документации — ⌘ K'
  }
})
const { track } = useAnalytics()

watchDebounced(searchTerm, (term) => {
  if (term) {
    // Сам запрос — свободный ввод, в Метрику не уходит: только длина.
    track('Search Performed', { length: term.length })
  }
}, { debounce: 500 })
</script>

<template>
  <!-- Окно поиска смонтировано заранее (#95): иначе оно подгружалось при первом Ctrl K, и набранные сразу буквы
       терялись. Предзагрузка одного кода не помогает — окно всё равно открывается через несколько асинхронных шагов.
       Цена — около 900 скрытых элементов на странице (замер 28.11). -->
  <B24ContentSearch
    v-model:search-term="searchTerm"
    :links="links"
    :files="files"
    :groups="groups"
    :navigation="navigation"
    :color-mode="false"
    :fuse="{ resultLimit: 30 }"
    :unmount-on-hide="false"
    :placeholder="placeholder"
  />
</template>
