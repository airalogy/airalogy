<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  AimdRecorderEditor,
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
} from '@airalogy/aimd-recorder'
import '@airalogy/aimd-recorder/styles'
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
const recordData = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
const recorderEditorKey = ref(0)

function resetRecord() {
  recordData.value = createEmptyProtocolRecordData()
}

function handleExampleSelect(id: string) {
  resetRecord()
  loadExample(id, locale.value)
  recorderEditorKey.value += 1
}

function handleExampleReset() {
  resetRecord()
  resetToSelectedExample(locale.value)
  recorderEditorKey.value += 1
}

watch(locale, () => {
  resetRecord()
  resetToSelectedExample(locale.value)
  recorderEditorKey.value += 1
})
</script>

<template>
  <div class="demo-page">
    <h2 class="page-title">{{ messages.pages.examples.title }}</h2>
    <p class="page-desc">{{ messages.pages.examples.desc }}</p>

    <DemoExamplePicker
      :selected-id="selectedExampleId"
      @select="handleExampleSelect"
      @reset="handleExampleReset"
    />

    <AimdRecorderEditor
      :key="recorderEditorKey"
      v-model="recordData"
      v-model:content="content"
      :locale="locale"
      :show-record-data="true"
      :editor-title="messages.common.aimdSource"
      :recorder-title="messages.pages.examples.workbenchTitle"
      :record-data-title="messages.common.collectedData"
    />
  </div>
</template>

<style scoped>
.demo-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-title {
  color: #1a1a2e;
  font-size: 24px;
  font-weight: 700;
}

.page-desc {
  margin-top: -8px;
  color: #666;
  font-size: 14px;
}
</style>
