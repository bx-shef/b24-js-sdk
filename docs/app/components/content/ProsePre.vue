<script setup lang="ts">
// Блок кода документации — штатный ProsePre из b24ui плюс пометка, где выполняется пример (#113).
// Среда видна только по точке входа в самом коде (B24Hook, B24OAuth, initializeB24Frame…); у примеров,
// где `$b24` уже создан, точки входа нет — они работают в любой среде, и пометки у них нет (иначе шум).
import B24ProsePre from '@bitrix24/b24ui-nuxt/runtime/components/prose/Pre.vue'
import { codeRuntime } from '~/utils/codeRuntime'

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const runtime = computed(() => codeRuntime(typeof attrs.code === 'string' ? attrs.code : '', typeof attrs.language === 'string' ? attrs.language : undefined))
const preUi = computed(() => ({ ...(attrs.b24ui as Record<string, unknown> | undefined), root: 'my-0' }))
</script>

<template>
  <div v-if="runtime" class="my-5" data-code-runtime="">
    <p class="mb-1.5 text-(length:--ui-font-size-xs) text-legend">
      Где выполняется: <span class="text-label">{{ runtime }}</span>
    </p>
    <B24ProsePre v-bind="attrs" :b24ui="preUi">
      <slot />
    </B24ProsePre>
  </div>
  <B24ProsePre v-else v-bind="attrs">
    <slot />
  </B24ProsePre>
</template>
