<script setup lang="ts">
import { withTrailingSlash } from 'ufo'

/**
 * Карточки страниц раздела документации для его обзорной страницы (`0.index.md`).
 * Аналог `ComponentsList` из b24-ui: раздел — `section` (`actions`, `entry-points`, `tools`),
 * группа внутри раздела — `category` из frontmatter страницы.
 *
 * Карточки страниц одной версии REST API получают класс `rest-api-verN-only`,
 * поэтому переключатель `restApi:v2 | restApi:v3` прячет лишние без перезагрузки.
 */
const props = defineProps<{
  section: string
  category: string
}>()

const { data: pages } = await useAsyncData(`pages-list-${props.section}-${props.category}`, async () => {
  const rows = await queryCollection('docs')
    .where('path', 'LIKE', `/docs/${props.section}/%`)
    .where('extension', '=', 'md')
    .where('category', '=', props.category)
    .select('path', 'stem', 'title', 'description', 'navigation', 'restApiVersion')
    .all()

  // Порядок как в навигации: по числовому префиксу имени файла, затем по имени.
  const order = (stem: string) => {
    const name = stem.split('/').pop() ?? ''
    const num = /^(\d+)\./.exec(name)
    return [num ? Number(num[1]) : Number.MAX_SAFE_INTEGER, name] as const
  }

  return rows.sort((a, b) => {
    const [na, sa] = order(a.stem)
    const [nb, sb] = order(b.stem)
    return na - nb || sa.localeCompare(sb)
  })
})

const cardTitle = (page: { title: string, navigation?: unknown }) => {
  const nav = page.navigation as { title?: string } | boolean | undefined
  return (typeof nav === 'object' && nav?.title) ? nav.title : page.title
}
</script>

<template>
  <B24PageGrid class="gap-5 mb-4 mt-3">
    <B24PageCard
      v-for="page in pages"
      :key="page.path"
      :title="cardTitle(page)"
      :description="page.description"
      :to="withTrailingSlash(page.path)"
      :class="page.restApiVersion ? `${page.restApiVersion}-only` : undefined"
      :b24ui="{
        root: 'overflow-hidden group ring-muted',
        header: 'mb-0',
        container: 'p-0 lg:p-0',
        body: 'p-4',
        title: 'text-[15px] font-medium',
        description: 'line-clamp-2 mt-1'
      }"
    />
  </B24PageGrid>
</template>
