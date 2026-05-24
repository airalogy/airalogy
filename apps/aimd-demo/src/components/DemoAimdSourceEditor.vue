<script setup lang="ts">
import { AimdEditor } from '@airalogy/aimd-editor'
import { useDemoLocale } from '../composables/demoI18n'

withDefaults(defineProps<{
  minHeight?: number
}>(), {
  minHeight: 500,
})

const content = defineModel<string>({ required: true })
const { locale } = useDemoLocale()
</script>

<template>
  <div class="demo-aimd-source-editor">
    <AimdEditor
      v-model="content"
      mode="source"
      :locale="locale"
      :min-height="minHeight"
      :show-top-bar="false"
    />
  </div>
</template>

<style scoped>
.demo-aimd-source-editor :deep(.aimd-editor) {
  border: 0;
  border-radius: 0;
  background: transparent;
}
</style>
