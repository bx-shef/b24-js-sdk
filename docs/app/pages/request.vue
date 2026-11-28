<script setup lang="ts">
// Заявка на разработку: CRM-форма Битрикс24 в iframe страницы-обёртки
// (docs/public/b24-form.html, копия bx-shef/toolsai site/landing/b24-form.html).
// Продукт и тип заявки — b24-js-sdk / request: так сделка в CRM отличается от заявок shef.toolsai.
const config = useRuntimeConfig()
const route = useRoute()
const { track } = useAnalytics()

const title = 'Заявка на разработку'
const description = 'Нужна интеграция с Битрикс24, доработка, приложение или помощь со SDK — опишите задачу, мы свяжемся с вами.'

useSeoMeta({
  titleTemplate: '%s - Bitrix24 JS SDK',
  title,
  description,
  ogTitle: `${title} - Bitrix24 JS SDK`,
  ogDescription: description
})

// CRM-форма портала — та же, что на offer.bx-shef.by (bx-shef/lp, BriefForm.vue); поменять форму — три значения
// здесь и LOADER в docs/public/b24-form.html.
const FORM = {
  script: 'https://cdn-ru.bitrix24.by/b37817748/crm/form/loader_1.js',
  id: '1',
  secret: '3c735r'
}

// Откуда пришли: ссылки шапки, подвала, главной и чата несут ?source=…, остальное — direct.
const SOURCES = ['header', 'footer', 'home', 'chat']
const source = computed(() => {
  const value = Array.isArray(route.query.source) ? route.query.source[0] : route.query.source
  return value && SOURCES.includes(value) ? value : 'direct'
})

const frameSrc = computed(() => {
  const e = encodeURIComponent
  return `${config.app.baseURL}b24-form.html`
    + `?script=${e(FORM.script)}`
    + `&form=${e(`inline/${FORM.id}/${FORM.secret}`)}`
    + `&product=${e('b24-js-sdk')}`
    + `&type=${e('request')}`
})

const frame = useTemplateRef<HTMLIFrameElement>('frame')

// Обёртка сообщает об отправке формы (события не пересекают границу iframe).
function onMessage(event: MessageEvent) {
  if (event.source !== frame.value?.contentWindow || event.origin !== window.location.origin) {
    return
  }
  if (event.data === 'b24:form:submit') {
    track('Development Request Sent', { source: source.value })
  }
}

onMounted(() => {
  track('Development Request Opened', { source: source.value })
  window.addEventListener('message', onMessage)
})
onBeforeUnmount(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <B24Container class="py-10 sm:py-16 max-w-3xl">
    <h1 class="text-4xl sm:text-5xl font-bold mb-4 text-label">
      {{ title }}
    </h1>
    <p class="text-(length:--ui-font-size-xl) leading-(--ui-font-line-height-lg) text-description mb-2">
      Нужна интеграция с Битрикс24, доработка, приложение или помощь со SDK — опишите задачу, мы свяжемся с вами.
    </p>
    <p class="text-muted mb-8">
      Чем точнее описание, тем быстрее ответим: что должно получиться, какой у вас портал и в какие сроки это нужно.
    </p>

    <B24Card :b24ui="{ body: 'p-2 sm:p-4' }">
      <!-- Высоту задаёт min-height: обёртка высоту не сообщает. Форма №1 — около 780 px на телефоне и 660–710 px шире 640 px, плюс запас на подсказки ошибок -->
      <iframe
        ref="frame"
        :src="frameSrc"
        title="Форма заявки на разработку"
        loading="lazy"
        class="block w-full min-h-[840px] sm:min-h-[740px] border-0 rounded-(--ui-border-radius-md)"
      />
    </B24Card>

    <p class="text-sm text-muted mt-4">
      Форма не загрузилась? Напишите на
      <a class="underline" href="mailto:offer@bx-shef.by?subject=Заявка%20на%20разработку%20(b24-js-sdk)">offer@bx-shef.by</a>.
    </p>
  </B24Container>
</template>
