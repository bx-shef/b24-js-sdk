<script setup lang="ts">
/**
 * Блок, видимый только для выбранной версии REST API (`restApi:v2 | restApi:v3`):
 *
 *   ::::rest-api-version-only
 *   #rest-api-ver2
 *   …содержимое для v2…
 *
 *   #rest-api-ver3
 *   …содержимое для v3…
 *   ::::
 *
 * Слот может состоять из нескольких блоков (абзацы, код, таблицы), поэтому каждый слот
 * оборачивается в собственный `div` с классом `rest-api-verN-only`: класс, повешенный на
 * первый дочерний элемент (как делал `Slot` из reka-ui), прятал бы только его, а остальные
 * блоки оставались бы видны. Скрытие — CSS по `html[data-restapiver]` (`main.css`), поэтому
 * переключатель действует без перезагрузки. Не заданный слот ничего не рисует.
 */
</script>

<template>
  <div v-if="$slots['rest-api-ver2']" class="rest-api-ver2-only">
    <slot name="rest-api-ver2" />
  </div>
  <div v-if="$slots['rest-api-ver3']" class="rest-api-ver3-only">
    <slot name="rest-api-ver3" />
  </div>
</template>
