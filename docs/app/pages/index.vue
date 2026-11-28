<script setup lang="ts">
// import { joinURL } from 'ufo'
import EncloseTextInCodeTagIcon from '@bitrix24/b24icons-vue/editor/EncloseTextInCodeTagIcon'
import InfoCircleIcon from '@bitrix24/b24icons-vue/outline/InfoCircleIcon'
import PlayLIcon from '@bitrix24/b24icons-vue/outline/PlayLIcon'
import DemonstrationOnIcon from '@bitrix24/b24icons-vue/outline/DemonstrationOnIcon'

const { data: page } = await useAsyncData('index', () => queryCollection('index').first())
if (!page.value) {
  throw createError({ status: 404, statusText: 'Страница не найдена', fatal: true })
}

const config = useRuntimeConfig()

if (import.meta.server) {
  prerenderRoutes([`${config.public.baseUrl}/raw/index.md`])

  useSchemaOrg([
    defineSoftwareApp({
      name: 'Bitrix24 JS SDK',
      operatingSystem: 'Web',
      applicationCategory: 'DeveloperApplication',
      offers: { price: 0, priceCurrency: 'USD' }
    })
  ])
}

useCanonical(`/raw/index.md`)

useSeoMeta({
  titleTemplate: '%s - Bitrix24 JS SDK',
  title: page.value.title,
  description: page.value.description,
  ogTitle: `${page.value.title} - Bitrix24 JS SDK`,
  ogDescription: page.value.description
})

// Numeric-prefix ordering: recipe files are named "<n>.slug.md" so their stem
// ("…/99.examples/10.error-handling") must be sorted by that leading number,
// not lexicographically ("10" would otherwise sort before "2").
const stemOrder = (stem?: string) => {
  const seg = (stem ?? '').split('/').pop() ?? ''
  const n = Number.parseInt(seg, 10)
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n
}

// Заголовки карточек — без приставки «Рецепт:» у страниц рецептов, с заглавной буквы
const cardTitle = (title?: string) => {
  const text = (title ?? '').replace(/^(Recipe|Рецепт):\s*/, '')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// Cookbook — recipes flagged `featured: true`, ordered by the frontmatter-driven
// `cookbookOrder` (lower first; unset sorts to the end). No index.vue edit needed
// when a featured recipe is added.
const { data: cookbookRecipes } = await useAsyncData('index-cookbook', () =>
  queryCollection('docs')
    .where('category', '=', 'examples')
    .where('featured', '=', true)
    .select('title', 'description', 'path', 'stem', 'cookbookOrder')
    .all()
)
const cookbookCards = computed(() =>
  [...(cookbookRecipes.value ?? [])].sort(
    (a, b) => (a.cookbookOrder ?? Number.MAX_SAFE_INTEGER) - (b.cookbookOrder ?? Number.MAX_SAFE_INTEGER)
  )
)

// Extended catalogue — every non-featured `category: examples` recipe that
// declares `stack`/`scopes`, in file (numeric-prefix) order.
const { data: catalogueData } = await useAsyncData('index-catalogue', () =>
  queryCollection('docs')
    .where('category', '=', 'examples')
    .select('title', 'description', 'path', 'stem', 'stack', 'scopes', 'featured')
    .all()
)
const catalogueRecipes = computed(() =>
  [...(catalogueData.value ?? [])]
    .filter(recipe => !recipe.featured && (recipe.stack || recipe.scopes))
    .sort((a, b) => stemOrder(a.stem) - stemOrder(b.stem))
)

const iconFromIconName = (iconName?: string) => {
  if (!iconName) {
    return undefined
  }

  switch (iconName) {
    case 'EncloseTextInCodeTagIcon': return EncloseTextInCodeTagIcon
    case 'InfoCircleIcon': return InfoCircleIcon
    case 'PlayLIcon': return PlayLIcon
    case 'DemonstrationOnIcon': return DemonstrationOnIcon
  }

  return undefined
}
</script>

<template>
  <main v-if="page" class="min-h-[calc(100vh-125px)]">
    <B24Container class="px-[22px] lg:px-8 py-10 sm:py-16 lg:py-20">
      <HomeHero :title="page.hero.title" :description="page.hero.description">
        <div class="flex flex-wrap items-center gap-3">
          <B24Button
            v-for="link of page.hero.links"
            :key="link.label"
            v-bind="link"
            size="md"
            :icon="iconFromIconName(link?.iconName)"
          />
        </div>
      </HomeHero>
    </B24Container>

    <B24Container class="px-[22px] lg:px-8 pb-10 flex flex-col gap-10">
      <section>
        <h2 class="text-2xl font-bold mb-4 text-label">
          Что умеет
        </h2>
        <HomeFeatures />
      </section>

      <HomeAi />
    </B24Container>

    <div class="pt-6">
      <!-- Cookbook -->
      <B24Container class="px-[22px] lg:px-8 pb-10">
        <h2 class="text-2xl font-bold mb-2 text-label">
          Рецепты
        </h2>
        <p class="text-muted mb-6">
          Готовые решения: каждый рецепт — один файл, который можно скопировать целиком, с переменными окружения, примером вывода и разделом «Ограничения».
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NuxtLink
            v-for="card in cookbookCards"
            :key="card.path"
            :to="card.path"
            class="group block"
          >
            <B24Card
              :b24ui="{
                root: 'h-full transition-[transform,box-shadow,outline-color] duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:ring-1 hover:ring-(--ui-border-color-accented) cursor-pointer',
                body: 'p-4'
              }"
            >
              <p class="font-semibold text-label mb-1">
                {{ cardTitle(card.title) }}
              </p>
              <p class="text-sm text-muted">
                {{ card.description }}
              </p>
            </B24Card>
          </NuxtLink>
        </div>
      </B24Container>

      <!-- Extended catalogue -->
      <B24Container class="px-[22px] lg:px-8 pb-16">
        <B24Card
          class="base-mode"
          :b24ui="{
            root: 'rounded-(--ui-border-radius-md)',
            body: 'p-0 sm:px-0 sm:py-0 overflow-hidden'
          }"
        >
          <template #header>
            <h2 class="text-2xl font-bold mb-1 text-legend">
              Все рецепты
            </h2>
            <p class="text-description">
              Сквозные скрипты на TypeScript: укажите в <code>B24_HOOK</code> адрес входящего вебхука и запустите через <code>tsx</code>.
            </p>
          </template>
          <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="border-b border-(--ui-color-design-outline-content-divider)">
                  <th class="text-left py-2.5 px-4 font-semibold text-muted w-10">
                    #
                  </th>
                  <th class="text-left py-2.5 px-4 font-semibold text-muted">
                    Рецепт
                  </th>
                  <th class="text-left py-2.5 px-4 font-semibold text-muted hidden sm:table-cell">
                    Стек
                  </th>
                  <th class="text-left py-2.5 px-4 font-semibold text-muted hidden md:table-cell">
                    Права
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(recipe, i) in catalogueRecipes"
                  :key="recipe.path"
                  class="border-b border-(--ui-color-design-outline-content-divider) last:border-0 hover:bg-(--ui-color-accent-soft-element-violet)/30 transition-colors"
                >
                  <td class="py-2.5 px-4">
                    {{ i + 1 }}
                  </td>
                  <td class="py-2.5 px-4">
                    <NuxtLink :to="recipe.path" class="text-primary hover:underline font-medium">
                      {{ cardTitle(recipe.title) }}
                    </NuxtLink>
                  </td>
                  <td class="py-2.5 px-4 hidden sm:table-cell">
                    {{ recipe.stack }}
                  </td>
                  <td class="py-2.5 px-4 hidden md:table-cell">
                    <code class="text-xs">{{ recipe.scopes }}</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </B24Card>
        <div class="mt-4">
          <B24Button to="/docs/examples">
            Все примеры →
          </B24Button>
        </div>
      </B24Container>
    </div>
  </main>
</template>
