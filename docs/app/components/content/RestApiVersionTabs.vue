<script setup lang="ts">
import QuestionIcon from '@bitrix24/b24icons-vue/outline/QuestionIcon'

const { restApiVersion, restApiVersions } = useRestApiVersions()
const { track } = useAnalytics()

const value = ref<string | undefined>(undefined)

onMounted(() => {
  value.value = restApiVersion.value
})
watch(restApiVersion, () => {
  value.value = restApiVersion.value
})

function onRestApiVersionChange(newRestApiVersion: string) {
  restApiVersion.value = newRestApiVersion
  track('RestApiVersion Tab Switched', { restapiVersion: newRestApiVersion })
}
</script>

<template>
  <div class="flex flex-row flex-nowrap items-center justify-start gap-[6px]">
    <span class="text-(length:--ui-font-size-sm) text-legend whitespace-nowrap">REST API</span>
    <B24RadioGroup
      v-model="restApiVersion"
      :items="restApiVersions"
      orientation="horizontal"
      color="air-primary-copilot"
      variant="table"
      indicator="hidden"
      size="xs"
      @update:model-value="onRestApiVersionChange($event as string)"
    />
    <!-- Пояснение к переключателю (#89): что такое v3 и что меняют вкладки -->
    <B24Popover :content="{ side: 'bottom', align: 'end' }">
      <B24Button
        :icon="QuestionIcon"
        color="air-tertiary-no-accent"
        size="xs"
        aria-label="Что такое версии REST API"
      />
      <template #content>
        <div class="max-w-80 p-3 text-(length:--ui-font-size-sm) text-(--b24ui-typography-label-color) flex flex-col gap-2">
          <p><b>v3</b> — новая версия REST API Битрикс24: другие имена полей (camelCase), фильтры массивом троек, свои методы. Битрикс24 переводит методы на неё постепенно.</p>
          <p><b>v2</b> — классические методы, их по-прежнему большинство.</p>
          <p>Переключатель меняет примеры на страницах и левое меню: у v3 есть свои действия (CallTail, FetchTail, DeferredBatch). Выбор запоминается.</p>
        </div>
      </template>
    </B24Popover>
  </div>
</template>
