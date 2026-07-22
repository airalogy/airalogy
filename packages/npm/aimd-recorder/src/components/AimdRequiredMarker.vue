<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<template>
  <span
    class="aimd-field__required-marker"
    role="img"
    :aria-label="label"
    :title="label"
  >*</span>
</template>
