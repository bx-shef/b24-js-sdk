<script setup lang="ts">
// Первый экран главной (#97): о пользе, команда установки и живой пример на трёх точках входа.
// Код — обычный Markdown через MDC: подсветка, вкладки code-group и кнопка «Скопировать» — те же, что в документации.
const props = defineProps<{ title: string, description: string }>()
const config = useRuntimeConfig()

const install = '```bash\nnpm i @bxshefby/b24jssdk\n```'

const example = [
  '::code-group',
  '',
  '```ts [Вебхук]',
  'import { B24Hook } from \'@bxshefby/b24jssdk\'',
  '',
  '// Сервер: адрес входящего вебхука из Битрикс24',
  'const $b24 = B24Hook.fromWebhookUrl(process.env.B24_HOOK!)',
  '',
  'const response = await $b24.actions.v2.call.make({ method: \'user.current\', requestId: \'me\' })',
  'console.log(response.getData()?.result)',
  '```',
  '',
  '```ts [Фрейм]',
  'import { initializeB24Frame } from \'@bxshefby/b24jssdk\'',
  '',
  '// Приложение внутри Битрикс24: токен текущего пользователя',
  'const $b24 = await initializeB24Frame()',
  '',
  'const response = await $b24.actions.v2.call.make({ method: \'user.current\', requestId: \'me\' })',
  'console.log(response.getData()?.result)',
  '```',
  '',
  '```ts [OAuth]',
  'import { B24OAuth } from \'@bxshefby/b24jssdk\'',
  '',
  '// Приложение Маркета: токены портала, обновляются сами',
  'const $b24 = new B24OAuth(tokenData, appCredentials)',
  '',
  'const response = await $b24.actions.v2.call.make({ method: \'user.current\', requestId: \'me\' })',
  'console.log(response.getData()?.result)',
  '```',
  '',
  '::'
].join('\n')
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center w-full">
    <div class="flex flex-col gap-5 min-w-0">
      <h1 class="text-label text-4xl sm:text-6xl font-bold leading-tight mb-0">
        {{ props.title }}
      </h1>
      <p class="text-(length:--ui-font-size-xl) leading-(--ui-font-line-height-lg) text-label text-pretty">
        {{ props.description }}
      </p>
      <div class="min-w-0 [&_pre]:my-0">
        <MDC :value="install" cache-key="home-install" />
      </div>
      <p class="text-sm text-legend">
        v{{ config.public.version }} · MIT · Node.js 22+ · ESM, CommonJS и UMD
      </p>
      <p class="text-sm text-legend">
        Уже на <code>@bitrix24/b24jssdk</code>? <NuxtLink to="/docs/getting-started/migration/from-bitrix24" class="text-primary hover:underline">Переход — смена имени пакета</NuxtLink>
      </p>
      <slot />
    </div>

    <div class="min-w-0 [&_pre]:my-0">
      <MDC :value="example" cache-key="home-example" />
    </div>
  </div>
</template>
