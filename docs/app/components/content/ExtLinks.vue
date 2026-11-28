<script setup lang="ts">
const menuList = [
  {
    label: 'b24ui',
    to: 'https://b24-ui.bx-shef.by/',
    target: '_blank'
  },
  {
    label: 'b24icons',
    to: 'https://b24-icons.bx-shef.by/',
    target: '_blank'
  }
]
</script>

<template>
  <B24PageLinks :links="menuList" class="mb-[12px]" />
</template>
