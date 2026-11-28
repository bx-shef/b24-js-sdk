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

// Фильтр «Всех рецептов» по области — по полю `scopes` рецептов (#99)
const recipeFilters = [
  { label: 'Все', value: '' },
  { label: 'CRM', value: 'crm' },
  { label: 'Задачи', value: 'task' },
  { label: 'Диск', value: 'disk' },
  { label: 'Чаты', value: 'im' },
  { label: 'OAuth', value: 'oauth' }
]
const recipeFilter = ref('')
const filteredRecipes = computed(() => {
  if (!recipeFilter.value) {
    return catalogueRecipes.value
  }
  return catalogueRecipes.value.filter(recipe => String(recipe.scopes ?? '').toLowerCase().split(/[\s,]+/).includes(recipeFilter.value))
})

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

      <!-- Все рецепты — плиткой с фильтром по области (#99) -->
      <B24Container class="px-[22px] lg:px-8 pb-16">
        <h2 class="text-2xl font-bold mb-1 text-label">
          Все рецепты
        </h2>
        <p class="text-muted mb-4">
          Сквозные скрипты на TypeScript: укажите в <code>B24_HOOK</code> адрес входящего вебхука и запустите через <code>tsx</code>.
        </p>
        <div class="flex flex-wrap gap-2 mb-5" role="group" aria-label="Фильтр рецептов по области">
          <B24Button
            v-for="filter in recipeFilters"
            :key="filter.value"
            size="sm"
            :color="recipeFilter === filter.value ? 'air-primary' : 'air-tertiary'"
            :aria-pressed="recipeFilter === filter.value"
            :label="filter.label"
            @click="recipeFilter = filter.value"
          />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NuxtLink
            v-for="recipe in filteredRecipes"
            :key="recipe.path"
            :to="recipe.path"
            class="group block"
          >
            <B24Card
              :b24ui="{
                root: 'h-full transition-[transform,box-shadow] duration-200 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer',
                body: 'p-4 flex flex-col gap-2 h-full'
              }"
            >
              <p class="font-semibold text-label">
                {{ cardTitle(recipe.title) }}
              </p>
              <p class="text-sm text-muted grow">
                {{ recipe.description }}
              </p>
              <p class="text-xs text-legend">
                {{ recipe.stack }}<template v-if="recipe.scopes">
                  · права: <code>{{ recipe.scopes }}</code>
                </template>
              </p>
            </B24Card>
          </NuxtLink>
        </div>
        <div class="mt-6 flex flex-wrap items-center gap-3">
          <B24Button to="/docs/examples" color="air-secondary">
            Все примеры →
          </B24Button>
          <B24Button to="/request?source=home" color="air-tertiary">
            Нужна доработка? Оставить заявку
          </B24Button>
        </div>
      </B24Container>
    </div>
  </main>
</template>
