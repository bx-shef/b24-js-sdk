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
const buildHref = commitSha ? `${config.public.gitUrl}/commit/${commitSha}` : config.public.gitUrl
</script>

<template>
  <B24Separator :icon="route.path === '/' ? undefined : Bitrix24Icon" class="h-px" />

  <B24Footer>
    <template #left>
      <ProseP small accent="less">
        Copyright © 2024-present Bitrix24
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
        label="Релизы"
        :icon="RocketIcon"
        :to="`${config.public.gitUrl}/releases`"
        target="_blank"
        size="md"
      />
    </template>

    <NuxtLink :to="config.public.gitUrl" target="_blank" class="text-legend text-(length:--ui-font-size-sm) hover:underline">
      Published under MIT License.
    </NuxtLink>
    <NuxtLink
      :to="buildHref"
      target="_blank"
      data-testid="build-sha"
      class="ms-3 text-legend text-(length:--ui-font-size-sm) hover:underline"
    >
      {{ buildLabel }}
    </NuxtLink>
    <!-- Отзыв согласия на cookie (cookie-consent.js): только когда на сайте есть Метрика -->
    <button
      v-if="config.public.yandexMetrikaId"
      type="button"
      data-cookie-settings
      class="ms-3 text-legend text-(length:--ui-font-size-sm) hover:underline"
    >
      Настроить cookie
    </button>
  </B24Footer>
</template>
