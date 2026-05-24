<script setup lang="ts">
import { ref, watch } from 'vue'
import { AimdEditor } from '@airalogy/aimd-editor'
import DemoExamplePicker from '../components/DemoExamplePicker.vue'
import { useDemoLocale, useDemoMessages } from '../composables/demoI18n'
import { DEFAULT_DEMO_EXAMPLE_ID, useDemoExampleContent } from '../composables/sampleContent'

const { locale } = useDemoLocale()
const messages = useDemoMessages()
const {
  content,
  selectedExampleId,
  loadExample,
  resetToSelectedExample,
} = useDemoExampleContent(DEFAULT_DEMO_EXAMPLE_ID, locale)
const mode = ref<'source' | 'wysiwyg'>('source')

function handleExampleSelect(id: string) {
  loadExample(id, locale.value)
}

function handleExampleReset() {
  resetToSelectedExample(locale.value)
}

function onReady(editor: any) {
  console.log('Editor ready:', editor)
}

watch(locale, () => {
  resetToSelectedExample(locale.value)
})
</script>

<template>
  <div class="demo-page">
    <h2 class="page-title">@airalogy/aimd-editor</h2>
    <p class="page-desc">{{ messages.pages.editor.desc }}</p>

    <DemoExamplePicker
      :selected-id="selectedExampleId"
      @select="handleExampleSelect"
      @reset="handleExampleReset"
    />

    <AimdEditor
      v-model="content"
      v-model:mode="mode"
      :locale="locale"
      :min-height="500"
      :enable-block-handle="true"
      @ready="onReady"
    />
  </div>
</template>

<style scoped>
.demo-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a2e;
}

.page-desc {
  color: #666;
  font-size: 14px;
  margin-top: -8px;
}
</style>
