<script setup lang="ts">
import GitHubIcon from '@bitrix24/b24icons-vue/social/GitHubIcon'
import AiStarsIcon from '@bitrix24/b24icons-vue/outline/AiStarsIcon'
import SunIcon from '@bitrix24/b24icons-vue/outline/SunIcon'
import MoonIcon from '@bitrix24/b24icons-vue/outline/MoonIcon'
import { useMounted } from '@vueuse/core'

const route = useRoute()
const { desktopLinks } = useHeader()
// Вторая строка шапки (разделы и версия REST API) — только в документации
const hasBottomRow = computed(() => route.path.startsWith('/docs/'))
const config = useRuntimeConfig()

// @memo @memo this for NUXT.UI.docs
const { open } = useChat()
const { isEnabled: isAssistantEnabled } = useAssistant()
const { track } = useAnalytics()

function toggleChat() {
  if (!open.value) {
    track('AI Chat Opened', { source: 'header' })
  }
  open.value = !open.value
}

// region ColorMode ////
const colorMode = useColorMode()

// Тёмная тема сайта — `dark`, светлая — `light` (класс `edge-light`, app.config.ts). Своя кнопка вместо
// B24ColorModeButton: та ставит светлую тему режимом `light`, а тёмной считает только `dark` — со старым
// `edge-dark` она подписывалась «на тёмную» (#70). До монтирования режим неизвестен (хранится в браузере) —
// кнопка считает тему тёмной, как и тема по умолчанию.
const mounted = useMounted()
const isDarkMode = computed(() => !mounted.value || colorMode.value === 'dark' || colorMode.value === 'edge-dark')

function toggleMode() {
  colorMode.preference = isDarkMode.value ? 'light' : 'dark'
}
// endregion ////

// region Shortcuts ////
defineShortcuts({
  shift_D: () => {
    toggleMode()
  }
})
// endregion ////
</script>

<!-- eslint-disable vue/no-template-shadow -->
<template>
  <B24Header
    mode="modal"
    class="bg-(--ui-color-accent-soft-element-violet)/40 dark:bg-(--ui-color-copilot-bg-content-3)/40 backdrop-blur-md"
    :b24ui="{ container: 'lg:ps-10.5 h-auto', center: open ? 'hidden lg:hidden 2xl:flex' : 'hidden lg:hidden xl:flex', right: 'shrink-0 gap-1 sm:gap-3', toggle: open ? 'lg:inline-flex 2xl:hidden' : 'lg:inline-flex xl:hidden', content: open ? 'lg:flex 2xl:hidden' : 'lg:flex xl:hidden', overlay: open ? 'lg:block 2xl:hidden' : 'lg:block xl:hidden' }"
  >
    <template #left>
      <LogoWithVersion no-padding />
    </template>

    <!-- Открытая панель чата отнимает ~400 px, а пункты меню не сжимаются: меню выталкивало кнопки справа
         (AI, поиск, тема, GitHub) поверх заголовка панели. С открытой панелью меню показывается только от 2xl
         (1536 px), где помещается; путь к странице остаётся во второй строке (HeaderBottom). min-[…] не подходит:
         Tailwind ставит его раньше lg, и он проигрывает. Прокрутку сюда не ставить: overflow обрезает «Ресурсы».
         Без панели меню помещается с ~1180 px (замер), поэтому оно с xl, а ниже — кнопка меню (toggle/content); с панелью
         кнопка меню видна до 2xl, иначе вне /docs навигации не остаётся. Базовые классы b24ui (center `lg:flex`,
         toggle/content/overlay `lg:hidden`) tailwind-merge не убирает, если указать только xl/2xl, — их надо перекрыть на lg. -->
    <B24NavigationMenu
      :items="desktopLinks"
      orientation="horizontal"
    />

    <template #right>
      <!-- @memo @memo this for NUXT.UI.docs -->
      <B24Tooltip text="Спросить AI">
        <B24Button
          v-if="isAssistantEnabled"
          color="air-selection"
          :icon="AiStarsIcon"
          aria-label="Спросить AI"
          @click="toggleChat"
        />
      </B24Tooltip>
      <!-- @memo this for docus -->
      <!-- AssistantChat v-if="isAssistantEnabled" / -->
      <B24ContentSearchButton />

      <B24Button
        color="air-tertiary-no-accent"
        :icon="isDarkMode ? SunIcon : MoonIcon"
        :aria-label="isDarkMode ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'"
        @click="toggleMode"
      />

      <div class="hidden sm:flex flex-nowrap flex-row items-center justify-end gap-3">
        <B24Button
          aria-label="Исходный код на GitHub"
          :icon="GitHubIcon"
          :to="config.public.gitUrl"
          target="_blank"
          size="sm"
          :b24ui="{ baseLine: '[--ui-btn-icon-size:16px]' }"
        />
      </div>
    </template>
    <template #body>
      <HeaderBody />
    </template>

    <template v-if="hasBottomRow" #bottom>
      <HeaderBottom />
    </template>
  </B24Header>
</template>
