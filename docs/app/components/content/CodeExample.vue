<script setup lang="ts">
/**
 * Код примера из `app/examples/<name>.ts` на странице документации — только показ.
 * Запуска примера на портале (вебхук, фрейм) на сайте нет.
 */
import { prepareCode } from '../../utils/codeTransform'

const props = withDefaults(defineProps<{
  name: string
  class?: any
  /**
   * Whether to format the code with Prettier
   * @defaultValue false
   */
  prettier?: boolean
  /**
   * Whether to collapse the code block
   * @defaultValue false
   */
  collapse?: boolean
  /**
   * Whether to show the source code
   * @defaultValue true
   */
  source?: boolean
  /**
   * A list of line numbers to highlight in the code block
   */
  highlights?: number[]
  lang?: string
  /**
   * Override the filename used for the code block
   */
  filename?: string
}>(), {
  source: true,
  lang: 'ts'
})

const slots = defineSlots<{
  options(props?: {}): any
  code(props?: {}): any
}>()

const { $prettier } = useNuxtApp()

// `fetchCodeExample` rejects on failure (#139). An empty example is better than a
// broken page, since nothing here sits behind an error boundary — but log it.
const data = await fetchCodeExample(props.name).catch((error: unknown) => {
  console.error(`Failed to fetch code example ${props.name}:`, error)
  return { name: props.name, filePath: '', content: '', type: 'other' as const }
})

const code = computed(() => {
  let code = ''

  if (props.collapse) {
    code += `::code-collapse
`
  }

  const preparedCode = prepareCode(data?.content ?? '')
  code += `\`\`\`${props.lang} [${props.filename ?? data.name}.${props.lang}]${props.highlights?.length ? `{${props.highlights.join('-')}}` : ''}
${preparedCode}
\`\`\``

  if (props.collapse) {
    code += `
::`
  }

  return code
})

const { data: ast } = await useAsyncData(`code-example-${props.name}-${String(props.collapse)}`, async () => {
  if (!props.prettier) {
    return parseMarkdown(code.value)
  }

  let formatted = ''
  try {
    formatted = await $prettier.format(code.value, {
      trailingComma: 'none',
      semi: false,
      singleQuote: true,
      printWidth: 100
    })
  } catch {
    formatted = code.value
  }

  return parseMarkdown(formatted)
}, { watch: [code] })
</script>

<template>
  <div class="my-5">
    <template v-if="props.source">
      <div v-if="!!slots.code" class="scrollbar-transparent">
        <slot name="code" />
      </div>
      <MDCRenderer
        v-else-if="ast"
        :body="ast.body"
        :data="ast.data"
        class="[&_div.my-5]:!mt-0 scrollbar-transparent"
      />
    </template>
  </div>
</template>
