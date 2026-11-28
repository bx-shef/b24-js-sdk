<script setup lang="ts">
import RocketIcon from '@bitrix24/b24icons-vue/outline/RocketIcon'
import Bitrix24Icon from '@bitrix24/b24icons-vue/common-service/Bitrix24Icon'
import TelegramIcon from '@bitrix24/b24icons-vue/outline/TelegramIcon'

const route = useRoute()
const config = useRuntimeConfig()
const { b24DocsLink, tgLink } = useHeader()
// Номер сборки: короткий коммит образа ссылкой на него; без коммита (локальная сборка) — «dev» ссылкой на репозиторий
const raw = String(config.public.commitSha ?? '').trim()
const commitSha = /^[0-9a-f]{7,40}$/i.test(raw) ? raw : ''
const buildLabel = `сборка ${commitSha ? commitSha.slice(0, 7) : 'dev'}`
// Адрес пакета — переменной: статический to со «@» в значении сбивает разбор слота у vue-tsc
const npmUrl = 'https://www.npmjs.com/package/@bxshefby/b24jssdk'
const gitUrl = String(config.public.gitUrl ?? '')
const buildHref = commitSha ? `${gitUrl}/commit/${commitSha}` : gitUrl
// Ссылки на cookie — только когда на сайте есть Метрика (иначе баннера и cookie нет)
const hasMetrika = Boolean(config.public.yandexMetrikaId)
</script>

<template>
  <B24Separator :icon="route.path === '/' ? undefined : Bitrix24Icon" class="h-px" />

  <B24Footer :b24ui="{ right: 'flex-wrap lg:flex-nowrap justify-center gap-y-2' }">
    <template #left>
      <ProseP small accent="less">
        © 2026 ООО «БэИксШефБай»
      </ProseP>
    </template>

    <template #right>
      <B24Button
        aria-label="Документация REST API Битрикс24"
        :icon="Bitrix24Icon"
        :to="b24DocsLink"
        target="_blank"
        size="md"
      />

      <B24Button
        aria-label="Чат разработчиков в Telegram"
        :icon="TelegramIcon"
        :to="tgLink"
        target="_blank"
        size="md"
      />
      <B24Button
        label="Заявка на разработку"
        :icon="Bitrix24Icon"
        to="/request?source=footer"
        size="md"
      />
      <B24Button
        label="npm"
        aria-label="Пакет @bxshefby/b24jssdk в npm"
        :to="npmUrl"
        target="_blank"
        size="md"
      />
      <B24Button
        label="Релизы"
        :icon="RocketIcon"
        :to="`${gitUrl}/releases`"
        target="_blank"
        size="md"
      />
    </template>

    <div class="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 text-center">
      <NuxtLink :to="gitUrl" target="_blank" class="text-legend text-(length:--ui-font-size-sm) hover:underline">
        Основано на Bitrix24 JS SDK. Распространяется по лицензии MIT.
      </NuxtLink>
      <NuxtLink
        :to="buildHref"
        target="_blank"
        data-testid="build-sha"
        class="whitespace-nowrap text-legend text-(length:--ui-font-size-sm) hover:underline"
      >
        {{ buildLabel }}
      </NuxtLink>
      <!-- Отзыв согласия на cookie (cookie-consent.js): только когда на сайте есть Метрика -->
      <button
        v-if="hasMetrika"
        type="button"
        data-cookie-settings
        class="whitespace-nowrap text-legend text-(length:--ui-font-size-sm) hover:underline"
      >
        Настроить cookie
      </button>
      <!-- Та же политика, что в окне баннера cookie (utils/cookiePolicy.ts) -->
      <NuxtLink
        v-if="hasMetrika"
        :to="COOKIE_POLICY_URL"
        target="_blank"
        class="whitespace-nowrap text-legend text-(length:--ui-font-size-sm) hover:underline"
      >
        Политика cookie
      </NuxtLink>
    </div>
  </B24Footer>
</template>
