<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  gradeQuizRecordAnswers,
  type AimdQuizField,
  type AimdQuizGradeReport,
  type AimdQuizGradeResult,
} from '@airalogy/aimd-core'
import {
  AimdRecorderEditor,
  createEmptyProtocolRecordData,
  type AimdChoiceOptionExplanationMode,
  type AimdProtocolRecordData,
} from '@airalogy/aimd-recorder'
import { parseAndExtract, renderToHtml } from '@airalogy/aimd-renderer'
import type { ExtractedAimdFields } from '@airalogy/aimd-core/types'
import '@airalogy/aimd-recorder/styles'
import DemoExamplePicker from '../components/DemoExamplePicker.vue'
import { useDemoLocale, useDemoMessages } from '../composables/demoI18n'
import { DEFAULT_DEMO_EXAMPLE_ID, useDemoExampleContent } from '../composables/sampleContent'

const EMPTY_FIELDS: ExtractedAimdFields = {
  var: [],
  var_definitions: [],
  var_table: [],
  client_assigner: [],
  quiz: [],
  step: [],
  check: [],
  ref_step: [],
  ref_var: [],
  ref_fig: [],
  cite: [],
  fig: [],
}

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
const activePanel = ref<'workbench' | 'preview' | 'fields'>('workbench')
const fields = ref<ExtractedAimdFields>(EMPTY_FIELDS)
const htmlOutput = ref('')
const renderError = ref('')
const quizGrades = ref<Record<string, AimdQuizGradeResult>>({})
const gradeReport = ref<AimdQuizGradeReport | null>(null)
const choiceOptionExplanationMode = ref<AimdChoiceOptionExplanationMode>('selected')
const isSubmitted = ref(false)

const extractedFieldsJson = computed(() => JSON.stringify(fields.value, null, 2))
const hasQuizFields = computed(() => (fields.value.quiz?.length || 0) > 0)
const gradeSummary = computed(() => {
  if (!gradeReport.value) {
    return ''
  }

  return `${gradeReport.value.summary.total_earned_score} / ${gradeReport.value.summary.total_max_score}`
})

const fieldStats = computed(() => ({
  var: fields.value.var?.length || 0,
  table: fields.value.var_table?.length || 0,
  step: fields.value.step?.length || 0,
  check: fields.value.check?.length || 0,
  refs: (fields.value.ref_step?.length || 0) + (fields.value.ref_var?.length || 0) + (fields.value.ref_fig?.length || 0),
}))

function resetRecord() {
  recordData.value = createEmptyProtocolRecordData()
  isSubmitted.value = false
}

function handleExampleSelect(id: string) {
  resetRecord()
  loadExample(id, locale.value)
  recorderEditorKey.value += 1
  activePanel.value = 'workbench'
}

function handleExampleReset() {
  resetRecord()
  resetToSelectedExample(locale.value)
  recorderEditorKey.value += 1
}

async function processContent() {
  try {
    renderError.value = ''
    fields.value = parseAndExtract(content.value)
    const result = await renderToHtml(content.value, {
      locale: locale.value,
      assignerVisibility: 'collapsed',
    })
    htmlOutput.value = result.html
  } catch (error: any) {
    renderError.value = error?.message || String(error)
    htmlOutput.value = ''
    fields.value = EMPTY_FIELDS
  }
}

function handleFieldsChange(nextFields: ExtractedAimdFields) {
  fields.value = nextFields
}

async function updateQuizGrades() {
  const quizFields = Array.isArray(fields.value.quiz)
    ? fields.value.quiz as AimdQuizField[]
    : []

  if (quizFields.length === 0) {
    quizGrades.value = {}
    gradeReport.value = null
    return
  }

  const report = await gradeQuizRecordAnswers(quizFields, recordData.value.quiz)
  gradeReport.value = report
  quizGrades.value = report.quiz
}

watch(locale, () => {
  resetRecord()
  resetToSelectedExample(locale.value)
  recorderEditorKey.value += 1
  activePanel.value = 'workbench'
})

watch([content, locale], processContent, { immediate: true })
watch([fields, recordData], updateQuizGrades, { deep: true, immediate: true })
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

    <div class="examples-stats">
      <span class="examples-stat">
        {{ messages.pages.examples.stats.var }}: <strong>{{ fieldStats.var }}</strong>
      </span>
      <span class="examples-stat">
        {{ messages.pages.examples.stats.table }}: <strong>{{ fieldStats.table }}</strong>
      </span>
      <span class="examples-stat">
        {{ messages.pages.examples.stats.step }}: <strong>{{ fieldStats.step }}</strong>
      </span>
      <span class="examples-stat">
        {{ messages.pages.examples.stats.check }}: <strong>{{ fieldStats.check }}</strong>
      </span>
      <span class="examples-stat">
        {{ messages.pages.examples.stats.refs }}: <strong>{{ fieldStats.refs }}</strong>
      </span>
    </div>

    <div class="examples-tabs" :aria-label="messages.pages.examples.panelLabel">
      <button
        class="examples-tab"
        :class="{ 'examples-tab--active': activePanel === 'workbench' }"
        type="button"
        @click="activePanel = 'workbench'"
      >
        {{ messages.pages.examples.tabs.workbench }}
      </button>
      <button
        class="examples-tab"
        :class="{ 'examples-tab--active': activePanel === 'preview' }"
        type="button"
        @click="activePanel = 'preview'"
      >
        {{ messages.pages.examples.tabs.preview }}
      </button>
      <button
        class="examples-tab"
        :class="{ 'examples-tab--active': activePanel === 'fields' }"
        type="button"
        @click="activePanel = 'fields'"
      >
        {{ messages.pages.examples.tabs.fields }}
      </button>
    </div>

    <div v-if="hasQuizFields" class="examples-quiz-toolbar">
      <span v-if="gradeReport" class="examples-grade">
        {{ messages.pages.examples.quiz.score }} {{ gradeSummary }}
        <template v-if="gradeReport.summary.review_required_count">
          · {{ messages.pages.examples.quiz.review }} {{ gradeReport.summary.review_required_count }}
        </template>
      </span>
      <label class="examples-quiz-control">
        <span>{{ messages.pages.examples.quiz.explanations }}</span>
        <select v-model="choiceOptionExplanationMode" class="examples-quiz-select">
          <option value="hidden">{{ messages.pages.examples.quiz.explanationModes.hidden }}</option>
          <option value="selected">{{ messages.pages.examples.quiz.explanationModes.selected }}</option>
          <option value="submitted">{{ messages.pages.examples.quiz.explanationModes.submitted }}</option>
          <option value="graded">{{ messages.pages.examples.quiz.explanationModes.graded }}</option>
        </select>
      </label>
      <label class="examples-quiz-control examples-quiz-control--checkbox">
        <input v-model="isSubmitted" type="checkbox">
        <span>{{ messages.pages.examples.quiz.submitted }}</span>
      </label>
    </div>

    <div v-if="activePanel === 'workbench'" class="examples-workbench">
      <AimdRecorderEditor
        :key="recorderEditorKey"
        v-model="recordData"
        v-model:content="content"
        :locale="locale"
        :show-record-data="true"
        :quiz-grades="quizGrades"
        :submitted="isSubmitted"
        :choice-option-explanation-mode="choiceOptionExplanationMode"
        :editor-title="messages.common.aimdSource"
        :recorder-title="messages.pages.examples.workbenchTitle"
        :record-data-title="messages.common.collectedData"
        @fields-change="handleFieldsChange"
      />
    </div>

    <section v-else-if="activePanel === 'preview'" class="examples-panel">
      <div v-if="renderError" class="examples-error">{{ renderError }}</div>
      <div v-else class="examples-render-preview" v-html="htmlOutput" />
    </section>

    <section v-else class="examples-panel examples-panel--code">
      <pre class="examples-code">{{ extractedFieldsJson }}</pre>
    </section>
  </div>
</template>

<style scoped>
.demo-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
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

.examples-stats,
.examples-tabs,
.examples-quiz-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.examples-stats {
  padding: 10px 14px;
  border: 1px solid #e0e7f2;
  border-radius: 8px;
  background: #fff;
  color: #5f6c7d;
  font-size: 13px;
}

.examples-stat strong {
  color: #1a73e8;
}

.examples-tabs {
  gap: 8px;
}

.examples-tab {
  appearance: none;
  padding: 8px 12px;
  border: 1px solid #d6deea;
  border-radius: 8px;
  background: #fff;
  color: #415165;
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
  line-height: 1;
}

.examples-tab:hover {
  border-color: #8ba8d8;
  background: #f7faff;
}

.examples-tab--active {
  border-color: #5f8dea;
  background: #edf4ff;
  color: #2454b5;
}

.examples-quiz-toolbar {
  justify-content: space-between;
  padding: 10px 14px;
  border: 1px solid #e5d5aa;
  border-radius: 8px;
  background: #fffaf0;
  color: #6f5630;
  font-size: 13px;
}

.examples-grade {
  font-weight: 700;
}

.examples-quiz-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 650;
}

.examples-quiz-control--checkbox {
  cursor: pointer;
}

.examples-quiz-select {
  min-width: 116px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid #dec995;
  border-radius: 7px;
  background: #fff;
  color: #5d4725;
  font-size: 13px;
}

.examples-workbench {
  flex: 1 1 auto;
  min-height: 0;
}

.examples-panel {
  flex: 1 1 auto;
  min-height: 560px;
  max-height: calc(100vh - 260px);
  overflow: auto;
  border: 1px solid #dbe4ef;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
}

.examples-render-preview {
  padding: 24px;
  color: #243247;
  font-size: 15px;
  line-height: 1.8;
}

.examples-render-preview :deep(h1) {
  margin: 0.45em 0 0.35em;
  color: #162033;
  font-size: 2em;
  font-weight: 760;
  line-height: 1.2;
}

.examples-render-preview :deep(h2) {
  margin: 1em 0 0.45em;
  padding-bottom: 0.24em;
  border-bottom: 1px solid #e3e9f2;
  color: #243247;
  font-size: 1.52em;
  font-weight: 720;
  line-height: 1.25;
}

.examples-render-preview :deep(h3) {
  margin: 0.85em 0 0.35em;
  color: #2d3d55;
  font-size: 1.22em;
  font-weight: 700;
  line-height: 1.3;
}

.examples-render-preview :deep(h4),
.examples-render-preview :deep(h5),
.examples-render-preview :deep(h6) {
  margin: 0.75em 0 0.3em;
  color: #34445c;
  font-weight: 700;
  line-height: 1.35;
}

.examples-render-preview :deep(p) {
  margin: 0.55em 0;
}

.examples-render-preview :deep(ul),
.examples-render-preview :deep(ol) {
  margin: 0.55em 0;
  padding-left: 24px;
}

.examples-render-preview :deep(li) {
  margin: 0.18em 0;
}

.examples-render-preview :deep(blockquote) {
  margin: 0.8em 0;
  padding: 8px 14px;
  border-left: 4px solid #d3ddea;
  background: #f8fbff;
  color: #56667d;
}

.examples-render-preview :deep(table) {
  width: 100%;
  margin: 0.85em 0;
  border-collapse: collapse;
  font-size: 14px;
}

.examples-render-preview :deep(th),
.examples-render-preview :deep(td) {
  padding: 7px 12px;
  border: 1px solid #d8e1ee;
  text-align: left;
}

.examples-render-preview :deep(th) {
  background: #f4f7fb;
  color: #25344a;
  font-weight: 700;
}

.examples-render-preview :deep(code) {
  padding: 2px 5px;
  border-radius: 4px;
  background: #eef3f8;
  color: #223247;
  font-family: 'SFMono-Regular', 'SF Mono', 'Fira Code', 'Menlo', monospace;
  font-size: 0.9em;
}

.examples-render-preview :deep(pre) {
  margin: 0.9em 0;
  padding: 14px 16px;
  overflow: auto;
  border-radius: 10px;
  background: #101827;
  color: #dbeafe;
}

.examples-render-preview :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
}

.examples-render-preview :deep(hr) {
  margin: 18px 0;
  border: 0;
  border-top: 1px solid #e1e8f2;
}

.examples-render-preview :deep(a) {
  color: #1a73e8;
  text-decoration: none;
}

.examples-render-preview :deep(a:hover) {
  text-decoration: underline;
}

.examples-render-preview :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}

.examples-error {
  margin: 16px;
  padding: 12px 14px;
  border: 1px solid #ffd6d6;
  border-radius: 8px;
  background: #fff6f6;
  color: #c62828;
  font-size: 13px;
}

.examples-panel--code {
  background: #0f172a;
}

.examples-code {
  margin: 0;
  padding: 18px;
  color: #dbeafe;
  font-family: 'SFMono-Regular', 'SF Mono', 'Fira Code', 'Menlo', monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
}

@media (max-width: 720px) {
  .examples-panel {
    max-height: none;
  }
}
</style>
