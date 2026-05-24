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
  content: input,
  selectedExampleId,
  loadExample,
  resetToSelectedExample,
} = useDemoExampleContent(DEFAULT_DEMO_EXAMPLE_ID, locale)
const recordData = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
const recorderEditorKey = ref(0)

function resetForm() {
  recordData.value = createEmptyProtocolRecordData()
}

function handleExampleSelect(id: string) {
  resetForm()
  loadExample(id, locale.value)
  recorderEditorKey.value += 1
}

function handleExampleReset() {
  resetForm()
  resetToSelectedExample(locale.value)
  recorderEditorKey.value += 1
}

watch(locale, () => {
  resetForm()
  resetToSelectedExample(locale.value)
  recorderEditorKey.value += 1
})
</script>

<template>
  <div class="demo-page">
    <h2 class="page-title">@airalogy/aimd-recorder</h2>
    <p class="page-desc">{{ messages.pages.recorder.desc }}</p>

    <DemoExamplePicker
      :selected-id="selectedExampleId"
      @select="handleExampleSelect"
      @reset="handleExampleReset"
    />

    <div class="page-toolbar">
      <button class="reset-btn" @click="resetForm">{{ messages.common.reset }}</button>
    </div>

    <AimdRecorderEditor
      :key="recorderEditorKey"
      v-model="recordData"
      v-model:content="input"
      :locale="locale"
      :show-record-data="true"
      :editor-title="messages.common.aimdSource"
      :recorder-title="messages.pages.recorder.inlineFormTitle"
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
  font-size: 24px;
  font-weight: 700;
  color: #1a1a2e;
}

.page-desc {
  color: #666;
  font-size: 14px;
  margin-top: -12px;
}

.page-toolbar {
  display: flex;
  justify-content: flex-end;
}

.reset-btn {
  padding: 4px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  color: #666;
  transition: all 0.2s;
}

.reset-btn:hover {
  border-color: #d03050;
  color: #d03050;
}
</style>
