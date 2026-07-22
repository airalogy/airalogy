<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<template>
  <span
    class="aimd-field__required-marker"
    role="img"
    data-aimd-required-marker="true"
    :aria-label="label"
    :title="label"
  >*</span>
</template>
