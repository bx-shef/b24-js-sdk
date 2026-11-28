<script setup lang="ts">
// Блок «Для AI-агентов» (#97): MCP-сервер, навыки, llms.txt
import CopyIcon from '@bitrix24/b24icons-vue/outline/CopyIcon'
import CheckLIcon from '@bitrix24/b24icons-vue/outline/CheckLIcon'

const config = useRuntimeConfig()
const site = computed(() => `${config.public.canonicalUrl || config.public.siteUrl}${config.public.baseUrl}`)
const mcpUrl = computed(() => `${site.value}/mcp/`)

const copied = ref(false)
async function copyMcp() {
  try {
    await navigator.clipboard.writeText(mcpUrl.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <B24Card :b24ui="{ body: 'p-6 flex flex-col gap-4' }">
    <div>
      <h2 class="text-2xl font-bold mb-1 text-label">
        Для AI-агентов
      </h2>
      <p class="text-muted">
        Подключите Claude Code, Cursor или VS Code к документации — агент сам найдёт нужную страницу и пример.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <code class="px-2 py-1 rounded-(--ui-border-radius-sm) bg-(--ui-color-design-tinted-na-bg) text-sm break-all">{{ mcpUrl }}</code>
      <B24Button
        size="sm"
        color="air-secondary"
        :icon="copied ? CheckLIcon : CopyIcon"
        :label="copied ? 'Скопировано' : 'Скопировать адрес'"
        @click="copyMcp"
      />
    </div>
    <div class="flex flex-wrap gap-3">
      <B24Button size="sm" color="air-secondary-accent-2" to="/docs/getting-started/ai/mcp" label="Как подключить MCP-сервер" />
      <B24Button size="sm" color="air-tertiary" to="/docs/getting-started/ai/skills" label="Навыки для AI" />
      <B24Button size="sm" color="air-tertiary" to="/docs/getting-started/ai/llms-txt" label="LLMs.txt" />
    </div>
  </B24Card>
</template>
