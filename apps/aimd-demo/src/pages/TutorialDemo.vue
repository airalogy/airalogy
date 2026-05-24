<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ExtractedAimdFields } from '@airalogy/aimd-core'
import { parseAndExtract, renderToHtml } from '@airalogy/aimd-renderer'
import DemoAimdSourceEditor from '../components/DemoAimdSourceEditor.vue'
import { useDemoLocale, useDemoMessages } from '../composables/demoI18n'
import { getTutorialLessons, type TutorialEvaluationState } from '../composables/tutorialLessons'

const route = useRoute()
const router = useRouter()
const { locale } = useDemoLocale()
const messages = useDemoMessages()

const lessons = computed(() => getTutorialLessons(locale.value))
const drafts = reactive<Record<string, string>>({})
const completedByLesson = reactive<Record<string, boolean>>({})

const content = ref('')
const showSolution = ref(false)
const activeTab = ref<'guide' | 'preview' | 'fields'>('guide')

const htmlOutput = ref('')
const extractedFields = ref<ExtractedAimdFields | null>(null)
const parseError = ref('')
const renderError = ref('')

const lessonQueryId = computed(() => typeof route.query.lesson === 'string' ? route.query.lesson : '')
const lessonIds = computed(() => lessons.value.map(lesson => lesson.id))

const currentIndex = computed(() => {
  const index = lessons.value.findIndex(lesson => lesson.id === lessonQueryId.value)
  return index >= 0 ? index : 0
})

const currentLesson = computed(() => {
  const lesson = lessons.value[currentIndex.value] ?? lessons.value[0]
  if (!lesson) {
    throw new Error('Tutorial lessons are not defined')
  }
  return lesson
})

const canGoPrevious = computed(() => currentIndex.value > 0)
const canGoNext = computed(() => currentIndex.value < lessons.value.length - 1)

watch([lessonIds, lessonQueryId], ([ids, lessonId]) => {
  if (!ids.length) return
  if (!lessonId || !ids.includes(lessonId)) {
    void router.replace({
      path: route.path,
      query: {
        ...route.query,
        lesson: ids[0],
      },
    })
  }
}, { immediate: true })

watch(currentLesson, (lesson) => {
  if (!(lesson.id in drafts)) {
    drafts[lesson.id] = lesson.starter
  }
  content.value = drafts[lesson.id]
  showSolution.value = false
}, { immediate: true })

watch(content, (value) => {
  drafts[currentLesson.value.id] = value
})

let renderRequestId = 0

watch([content, locale], async ([markdown, currentLocale]) => {
  const requestId = ++renderRequestId

  try {
    parseError.value = ''
    extractedFields.value = parseAndExtract(markdown)
  } catch (error: any) {
    parseError.value = error.message
    extractedFields.value = null
  }

  try {
    renderError.value = ''
    const result = await renderToHtml(markdown, {
      locale: currentLocale,
      assignerVisibility: 'collapsed',
    })
    if (requestId !== renderRequestId) return
    htmlOutput.value = result.html
  } catch (error: any) {
    if (requestId !== renderRequestId) return
    renderError.value = error.message
    htmlOutput.value = ''
  }
}, { immediate: true })

const evaluation = computed<TutorialEvaluationState>(() => ({
  content: content.value,
  normalizedContent: content.value.replace(/\r\n?/g, '\n'),
  fields: extractedFields.value,
  html: htmlOutput.value,
  parseError: parseError.value,
  renderError: renderError.value,
}))

const evaluatedChecks = computed(() => currentLesson.value.checks.map(check => ({
  id: check.id,
  label: check.label,
  passed: check.evaluate(evaluation.value),
})))

const passedCheckCount = computed(() => evaluatedChecks.value.filter(check => check.passed).length)
const allPassed = computed(() => evaluatedChecks.value.length > 0 && evaluatedChecks.value.every(check => check.passed))

watch([() => currentLesson.value.id, allPassed], ([lessonId, passed]) => {
  completedByLesson[lessonId] = passed
}, { immediate: true })

const completedCount = computed(() => lessons.value.filter(lesson => completedByLesson[lesson.id]).length)
const allLessonsCompleted = computed(() => lessons.value.length > 0 && lessons.value.every(lesson => completedByLesson[lesson.id]))
const fieldsOutput = computed(() => JSON.stringify(extractedFields.value ?? {}, null, 2))

function goToLesson(lessonId: string) {
  if (!lessonId || lessonId === currentLesson.value.id) return
  void router.push({
    path: route.path,
    query: {
      ...route.query,
      lesson: lessonId,
    },
  })
}

function goPrevious() {
  if (!canGoPrevious.value) return
  goToLesson(lessons.value[currentIndex.value - 1]?.id || '')
}

function goNext() {
  if (!canGoNext.value || !allPassed.value) return
  goToLesson(lessons.value[currentIndex.value + 1]?.id || '')
}

function restoreStarter() {
  const starter = currentLesson.value.starter
  drafts[currentLesson.value.id] = starter
  content.value = starter
}

function loadSolution() {
  const solution = currentLesson.value.solution
  drafts[currentLesson.value.id] = solution
  content.value = solution
  showSolution.value = true
}
</script>

<template>
  <div class="tutorial-page">
    <section class="hero-card">
      <div>
        <h2 class="page-title">{{ messages.pages.tutorial.title }}</h2>
        <p class="page-desc">{{ messages.pages.tutorial.desc }}</p>
      </div>

      <div class="hero-stats">
        <div class="hero-stat">
          <span class="hero-stat__label">{{ messages.pages.tutorial.progressLabel }}</span>
          <strong>{{ completedCount }} / {{ lessons.length }}</strong>
        </div>
        <div class="hero-stat">
          <span class="hero-stat__label">{{ messages.pages.tutorial.lessonLabel }}</span>
          <strong>{{ currentIndex + 1 }} / {{ lessons.length }}</strong>
        </div>
        <div class="hero-stat">
          <span class="hero-stat__label">{{ messages.pages.tutorial.checklistLabel }}</span>
          <strong>{{ passedCheckCount }} / {{ evaluatedChecks.length }}</strong>
        </div>
      </div>
    </section>

    <section v-if="allLessonsCompleted" class="completion-banner">
      <strong>{{ messages.pages.tutorial.status.finishedTitle }}</strong>
      <p>{{ messages.pages.tutorial.status.finishedBody }}</p>
    </section>

    <section class="lesson-strip">
      <button
        v-for="(lesson, index) in lessons"
        :key="lesson.id"
        :class="['lesson-pill', {
          active: currentLesson.id === lesson.id,
          done: completedByLesson[lesson.id],
        }]"
        @click="goToLesson(lesson.id)"
      >
        <span class="lesson-pill__index">{{ index + 1 }}</span>
        <span class="lesson-pill__title">{{ lesson.title }}</span>
      </button>
    </section>

    <div class="tutorial-layout">
      <section class="panel editor-panel">
        <div class="panel-header panel-header--editor">
          <div>
            <div class="panel-eyebrow">{{ messages.pages.tutorial.lessonLabel }} {{ currentIndex + 1 }}</div>
            <h3 class="panel-title">{{ currentLesson.title }}</h3>
            <p class="panel-desc">{{ currentLesson.summary }}</p>
          </div>

          <div class="focus-box">
            <span class="focus-box__label">{{ messages.pages.tutorial.focusLabel }}</span>
            <div class="focus-tags">
              <span v-for="tag in currentLesson.focus" :key="tag" class="focus-tag">{{ tag }}</span>
            </div>
          </div>
        </div>

        <div class="editor-shell">
          <DemoAimdSourceEditor v-model="content" :min-height="620" />
        </div>
      </section>

      <section class="panel guide-panel">
        <div class="tab-bar">
          <button
            :class="['tab-btn', { active: activeTab === 'guide' }]"
            @click="activeTab = 'guide'"
          >
            {{ messages.pages.tutorial.tabs.guide }}
          </button>
          <button
            :class="['tab-btn', { active: activeTab === 'preview' }]"
            @click="activeTab = 'preview'"
          >
            {{ messages.pages.tutorial.tabs.preview }}
          </button>
          <button
            :class="['tab-btn', { active: activeTab === 'fields' }]"
            @click="activeTab = 'fields'"
          >
            {{ messages.pages.tutorial.tabs.fields }}
          </button>
        </div>

        <div v-if="activeTab === 'guide'" class="tab-content guide-content">
          <div :class="['status-card', { 'status-card--complete': allPassed }]">
            <strong>
              {{
                allPassed
                  ? messages.pages.tutorial.status.completedTitle
                  : messages.pages.tutorial.status.inProgressTitle
              }}
            </strong>
            <p>
              {{
                allPassed
                  ? messages.pages.tutorial.status.completedBody
                  : messages.pages.tutorial.status.inProgressBody
              }}
            </p>
          </div>

          <div class="guide-section">
            <p class="guide-intro">{{ currentLesson.intro }}</p>
          </div>

          <div class="guide-section">
            <h4 class="section-title">{{ messages.pages.tutorial.syntaxLabel }}</h4>
            <pre class="guide-code">{{ currentLesson.pattern }}</pre>
          </div>

          <div class="guide-section">
            <h4 class="section-title">{{ messages.pages.tutorial.checklistLabel }}</h4>
            <ul class="checklist">
              <li
                v-for="check in evaluatedChecks"
                :key="check.id"
                :class="['check-item', { passed: check.passed }]"
              >
                <span class="check-indicator" />
                <span>{{ check.label }}</span>
              </li>
            </ul>
          </div>

          <div class="guide-section">
            <h4 class="section-title">{{ messages.pages.tutorial.hintsLabel }}</h4>
            <details
              v-for="(hint, index) in currentLesson.hints"
              :key="`${currentLesson.id}-hint-${index}`"
              class="hint-card"
            >
              <summary>{{ messages.pages.tutorial.hintLabel }} {{ index + 1 }}</summary>
              <p>{{ hint }}</p>
            </details>
          </div>

          <div class="guide-section">
            <div class="section-header">
              <h4 class="section-title">{{ messages.pages.tutorial.solutionLabel }}</h4>
              <button class="text-btn" @click="showSolution = !showSolution">
                {{
                  showSolution
                    ? messages.pages.tutorial.actions.hideSolution
                    : messages.pages.tutorial.actions.showSolution
                }}
              </button>
            </div>
            <pre v-if="showSolution" class="guide-code guide-code--solution">{{ currentLesson.solution }}</pre>
          </div>

          <div v-if="parseError || renderError" class="guide-section">
            <h4 class="section-title">{{ messages.pages.tutorial.feedbackLabel }}</h4>
            <div v-if="parseError" class="feedback-card feedback-card--error">
              <strong>{{ messages.pages.tutorial.parseErrorLabel }}</strong>
              <p>{{ parseError }}</p>
            </div>
            <div v-if="renderError" class="feedback-card feedback-card--error">
              <strong>{{ messages.pages.tutorial.renderErrorLabel }}</strong>
              <p>{{ renderError }}</p>
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'preview'" class="tab-content">
          <div v-if="renderError" class="feedback-card feedback-card--error">
            <strong>{{ messages.pages.tutorial.renderErrorLabel }}</strong>
            <p>{{ renderError }}</p>
          </div>
          <div v-else class="render-preview" v-html="htmlOutput" />
        </div>

        <div v-else class="tab-content">
          <div v-if="parseError" class="feedback-card feedback-card--error">
            <strong>{{ messages.pages.tutorial.parseErrorLabel }}</strong>
            <p>{{ parseError }}</p>
          </div>
          <pre v-else class="code-output">{{ fieldsOutput }}</pre>
        </div>

        <div class="action-bar">
          <div class="action-group">
            <button class="secondary-btn" @click="restoreStarter">
              {{ messages.pages.tutorial.actions.restoreStarter }}
            </button>
            <button class="secondary-btn" @click="loadSolution">
              {{ messages.pages.tutorial.actions.loadSolution }}
            </button>
          </div>

          <div class="action-group">
            <button class="secondary-btn" :disabled="!canGoPrevious" @click="goPrevious">
              {{ messages.pages.tutorial.actions.previous }}
            </button>
            <button class="primary-btn" :disabled="!canGoNext || !allPassed" @click="goNext">
              {{ messages.pages.tutorial.actions.next }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.tutorial-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.hero-card,
.completion-banner,
.panel {
  background: #fff;
  border: 1px solid #e5e9f1;
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
}

.hero-card {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 24px;
  background:
    radial-gradient(circle at top right, rgba(26, 115, 232, 0.12), transparent 34%),
    linear-gradient(135deg, #ffffff, #f6faff);
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: #162033;
}

.page-desc {
  margin-top: 8px;
  max-width: 760px;
  color: #5a6477;
  font-size: 14px;
  line-height: 1.6;
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(110px, 1fr));
  gap: 12px;
  min-width: 360px;
}

.hero-stat {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid #dce6f5;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
}

.hero-stat__label {
  font-size: 12px;
  font-weight: 600;
  color: #63708a;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.hero-stat strong {
  font-size: 22px;
  color: #1a73e8;
}

.completion-banner {
  padding: 16px 18px;
  border-color: #b8e2c6;
  background: linear-gradient(135deg, #f4fcf6, #eefbf2);
}

.completion-banner strong {
  display: block;
  color: #146c3f;
  font-size: 15px;
}

.completion-banner p {
  margin-top: 6px;
  color: #2c6245;
  font-size: 13px;
}

.lesson-strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10px;
}

.lesson-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 10px 12px;
  border: 1px solid #d7dde8;
  border-radius: 14px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s, background 0.2s, transform 0.2s, box-shadow 0.2s;
}

.lesson-pill:hover {
  border-color: #9ec1f7;
  background: #f8fbff;
  transform: translateY(-1px);
}

.lesson-pill.active {
  border-color: #1a73e8;
  background: #edf4ff;
  box-shadow: 0 8px 18px rgba(26, 115, 232, 0.12);
}

.lesson-pill.done:not(.active) {
  border-color: #b6dfc4;
  background: #f3fbf5;
}

.lesson-pill__index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #e8eef8;
  color: #355277;
  font-size: 13px;
  font-weight: 700;
}

.lesson-pill.active .lesson-pill__index {
  background: #1a73e8;
  color: #fff;
}

.lesson-pill.done:not(.active) .lesson-pill__index {
  background: #1f9d55;
  color: #fff;
}

.lesson-pill__title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  color: #253247;
}

.tutorial-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(360px, 0.8fr);
  gap: 18px;
  min-height: 720px;
}

.panel {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid #e5e9f1;
}

.panel-header--editor {
  background: linear-gradient(180deg, #fbfcff, #f6f8fc);
}

.panel-eyebrow {
  font-size: 12px;
  font-weight: 700;
  color: #6b7a92;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.panel-title {
  margin-top: 8px;
  font-size: 20px;
  color: #152238;
}

.panel-desc {
  margin-top: 8px;
  color: #5c677b;
  font-size: 14px;
  line-height: 1.55;
}

.focus-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 180px;
}

.focus-box__label {
  font-size: 12px;
  font-weight: 700;
  color: #6b7a92;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.focus-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.focus-tag {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: #eaf3ff;
  color: #265ea8;
  font-size: 12px;
  font-weight: 600;
}

.editor-shell {
  flex: 1;
  min-height: 0;
}

.editor-shell :deep(.demo-aimd-source-editor) {
  height: 100%;
}

.editor-shell :deep(.aimd-editor) {
  height: 100%;
}

.tab-bar {
  display: flex;
  gap: 2px;
  padding: 8px 10px 0;
  border-bottom: 1px solid #e5e9f1;
  background: #f8fafd;
}

.tab-btn {
  padding: 10px 14px;
  border: none;
  border-radius: 10px 10px 0 0;
  background: transparent;
  color: #657388;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.tab-btn:hover {
  background: #eef3fa;
  color: #243247;
}

.tab-btn.active {
  background: #fff;
  color: #1a73e8;
}

.tab-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.guide-content {
  padding: 18px;
}

.status-card {
  padding: 14px 16px;
  border: 1px solid #dbe8f8;
  border-radius: 14px;
  background: linear-gradient(135deg, #f5f9ff, #edf5ff);
}

.status-card strong {
  display: block;
  color: #1f4c88;
  font-size: 15px;
}

.status-card p {
  margin-top: 6px;
  color: #53709c;
  font-size: 13px;
  line-height: 1.5;
}

.status-card--complete {
  border-color: #bde3ca;
  background: linear-gradient(135deg, #f3fbf6, #ebf8ef);
}

.status-card--complete strong {
  color: #16643d;
}

.status-card--complete p {
  color: #2f6b4a;
}

.guide-section + .guide-section {
  margin-top: 18px;
}

.guide-intro {
  color: #445065;
  font-size: 14px;
  line-height: 1.7;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #1e2b40;
}

.guide-code,
.code-output {
  margin: 10px 0 0;
  padding: 14px;
  border-radius: 12px;
  background: #0f172a;
  color: #d9e4ff;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12px;
  line-height: 1.65;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.guide-code--solution {
  margin-top: 12px;
}

.checklist {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
  list-style: none;
}

.check-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fbfcfe;
  color: #445065;
  font-size: 13px;
}

.check-item.passed {
  border-color: #bde3ca;
  background: #f2fbf5;
  color: #1d5f3b;
}

.check-indicator {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #c5d0df;
  flex-shrink: 0;
}

.check-item.passed .check-indicator {
  background: #1f9d55;
}

.hint-card {
  margin-top: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fbfcfe;
  overflow: hidden;
}

.hint-card summary {
  padding: 11px 14px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #344257;
}

.hint-card p {
  padding: 0 14px 14px;
  color: #556176;
  font-size: 13px;
  line-height: 1.6;
}

.text-btn,
.secondary-btn,
.primary-btn {
  border: none;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, border-color 0.2s, opacity 0.2s;
}

.text-btn {
  padding: 0;
  background: transparent;
  color: #1a73e8;
  font-size: 13px;
  font-weight: 600;
}

.text-btn:hover {
  color: #155ab6;
}

.feedback-card {
  margin-top: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 13px;
}

.feedback-card strong {
  display: block;
  margin-bottom: 6px;
}

.feedback-card p {
  line-height: 1.55;
  color: inherit;
}

.feedback-card--error {
  border: 1px solid #f2c0ca;
  background: #fff5f7;
  color: #a2354a;
}

.render-preview {
  padding: 18px;
  line-height: 1.8;
  font-size: 15px;
}

.render-preview :deep(h1) { font-size: 1.8em; margin: 0.5em 0; }
.render-preview :deep(h2) { font-size: 1.4em; margin: 0.5em 0; color: #243247; }
.render-preview :deep(h3) { font-size: 1.18em; margin: 0.4em 0; }
.render-preview :deep(p) { margin: 0.5em 0; }
.render-preview :deep(table) {
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 14px;
}
.render-preview :deep(th),
.render-preview :deep(td) {
  border: 1px solid #d8dee8;
  padding: 7px 12px;
  text-align: left;
}
.render-preview :deep(th) {
  background: #f6f8fb;
  font-weight: 600;
}
.render-preview :deep(blockquote) {
  border-left: 4px solid #d8dee8;
  padding: 8px 14px;
  margin: 8px 0;
  color: #5d6677;
}
.render-preview :deep(ul),
.render-preview :deep(ol) {
  padding-left: 24px;
  margin: 6px 0;
}
.render-preview :deep(code) {
  background: #eef3f8;
  padding: 2px 4px;
  border-radius: 4px;
}

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px 18px;
  border-top: 1px solid #e5e9f1;
  background: #fbfcfe;
}

.action-group {
  display: flex;
  gap: 10px;
}

.secondary-btn,
.primary-btn {
  min-height: 38px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
}

.secondary-btn {
  border: 1px solid #d7dde8;
  background: #fff;
  color: #425067;
}

.secondary-btn:hover:not(:disabled) {
  border-color: #aebcd1;
  background: #f8fafc;
}

.primary-btn {
  background: #1a73e8;
  color: #fff;
}

.primary-btn:hover:not(:disabled) {
  background: #155ab6;
}

.secondary-btn:disabled,
.primary-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 1200px) {
  .lesson-strip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .tutorial-layout {
    grid-template-columns: 1fr;
  }

  .hero-card {
    flex-direction: column;
  }

  .hero-stats {
    min-width: 0;
  }
}

@media (max-width: 760px) {
  .hero-stats {
    grid-template-columns: 1fr;
  }

  .lesson-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .panel-header,
  .action-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .action-group {
    width: 100%;
  }

  .action-group .secondary-btn,
  .action-group .primary-btn {
    flex: 1;
  }
}
</style>
