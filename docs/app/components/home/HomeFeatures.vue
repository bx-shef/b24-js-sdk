<script setup lang="ts">
// «Что умеет» (#97): три карточки, каждая ведёт на свою страницу
const features = [
  {
    title: 'Пакетные запросы и лимиты',
    text: 'До 50 команд за один вызов, пакеты любого размера, встроенное ограничение частоты запросов.',
    to: '/docs/actions/batch'
  },
  {
    title: 'Обход больших списков',
    text: 'Все записи списочного метода сразу или потоком, без ручной постраничной выборки.',
    to: '/docs/actions/fetch-list'
  },
  {
    title: 'События в реальном времени',
    text: 'Подписка на события Pull в приложении внутри Битрикс24.',
    to: '/docs/entry-points/pull'
  }
]
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <NuxtLink
      v-for="feature in features"
      :key="feature.to"
      :to="feature.to"
      class="group block"
    >
      <B24Card
        :b24ui="{
          root: 'h-full transition-[transform,box-shadow] duration-200 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer',
          body: 'p-5'
        }"
      >
        <p class="font-semibold text-label mb-1.5">
          {{ feature.title }}
        </p>
        <p class="text-sm text-muted">
          {{ feature.text }}
        </p>
      </B24Card>
    </NuxtLink>
  </div>
</template>
