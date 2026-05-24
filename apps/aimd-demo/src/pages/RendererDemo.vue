<script setup lang="ts">
import { ref, watch, type VNode } from 'vue'
import { createStepCardRenderer, renderToHtml, renderToVue, parseAndExtract } from '@airalogy/aimd-renderer'
import DemoExamplePicker from '../components/DemoExamplePicker.vue'
import DemoAimdSourceEditor from '../components/DemoAimdSourceEditor.vue'
import { useDemoLocale, useDemoMessages } from '../composables/demoI18n'
import { DEFAULT_DEMO_EXAMPLE_ID, useDemoExampleContent } from '../composables/sampleContent'
import '@airalogy/aimd-recorder/styles'

const { locale } = useDemoLocale()
const messages = useDemoMessages()
const {
  content: input,
  selectedExampleId,
  loadExample,
  resetToSelectedExample,
} = useDemoExampleContent(DEFAULT_DEMO_EXAMPLE_ID, locale)
const htmlOutput = ref('')
const fieldsOutput = ref('')
const vueNodes = ref<VNode[]>([])
const renderError = ref('')
const activeTab = ref<'html' | 'vue' | 'fields'>('html')

function handleExampleSelect(id: string) {
  loadExample(id, locale.value)
}

function handleExampleReset() {
  resetToSelectedExample(locale.value)
}

async function render() {
  try {
    renderError.value = ''

    const htmlResult = await renderToHtml(input.value, {
      locale: locale.value,
      assignerVisibility: 'collapsed',
    })
    htmlOutput.value = htmlResult.html

    const vueResult = await renderToVue(input.value, {
      locale: locale.value,
      assignerVisibility: 'collapsed',
      groupStepBodies: true,
      aimdRenderers: {
        step: createStepCardRenderer(),
      },
    })
    vueNodes.value = vueResult.nodes

    const fields = parseAndExtract(input.value)
    fieldsOutput.value = JSON.stringify(fields, null, 2)
  } catch (e: any) {
    renderError.value = e.message
  }
}

watch([input, locale], render, { immediate: true })
watch(locale, () => {
  resetToSelectedExample(locale.value)
})
</script>

<template>
  <div class="demo-page">
    <h2 class="page-title">@airalogy/aimd-renderer</h2>
    <p class="page-desc">{{ messages.pages.renderer.desc }}</p>

    <DemoExamplePicker
      :selected-id="selectedExampleId"
      @select="handleExampleSelect"
      @reset="handleExampleReset"
    />

    <div class="demo-layout">
      <div class="panel">
        <h3 class="panel-title">{{ messages.common.aimdSource }}</h3>
        <DemoAimdSourceEditor v-model="input" :min-height="500" />
      </div>

      <div class="panel">
        <div class="tab-bar">
          <button
            :class="['tab-btn', { active: activeTab === 'html' }]"
            @click="activeTab = 'html'"
          >
            {{ messages.pages.renderer.tabs.html }}
          </button>
          <button
            :class="['tab-btn', { active: activeTab === 'vue' }]"
            @click="activeTab = 'vue'"
          >
            {{ messages.pages.renderer.tabs.vue }}
          </button>
          <button
            :class="['tab-btn', { active: activeTab === 'fields' }]"
            @click="activeTab = 'fields'"
          >
            {{ messages.pages.renderer.tabs.fields }}
          </button>
        </div>

        <div v-if="renderError" class="error">{{ renderError }}</div>

        <div v-else-if="activeTab === 'html'" class="render-preview" v-html="htmlOutput" />

        <div v-else-if="activeTab === 'vue'" class="render-preview">
          <component :is="() => vueNodes" />
        </div>

        <pre v-else class="code-output">{{ fieldsOutput }}</pre>
      </div>
    </div>

    <div class="panel full-width">
      <h3 class="panel-title">{{ messages.common.htmlSource }}</h3>
      <pre class="code-output html-source">{{ htmlOutput }}</pre>
    </div>
  </div>
</template>

<style scoped>
.demo-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
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

.demo-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.panel {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
}

.panel.full-width {
  width: 100%;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  padding: 12px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
  color: #444;
}

.tab-bar {
  display: flex;
  border-bottom: 1px solid #e8e8e8;
  background: #fafafa;
}

.tab-btn {
  padding: 10px 20px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: #666;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #333;
  background: #f0f2f5;
}

.tab-btn.active {
  color: #1a73e8;
  border-bottom-color: #1a73e8;
  font-weight: 600;
}

.render-preview {
  padding: 20px;
  max-height: 500px;
  overflow: auto;
  line-height: 1.8;
  font-size: 15px;
}

.render-preview :deep(h1) { font-size: 1.8em; margin: 0.5em 0; }
.render-preview :deep(h2) { font-size: 1.4em; margin: 0.5em 0; color: #333; }
.render-preview :deep(h3) { font-size: 1.2em; margin: 0.4em 0; }
.render-preview :deep(p) { margin: 0.5em 0; }
.render-preview :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 14px;
}
.render-preview :deep(th),
.render-preview :deep(td) {
  border: 1px solid #ddd;
  padding: 6px 12px;
  text-align: left;
}
.render-preview :deep(th) {
  background: #f5f5f5;
  font-weight: 600;
}
.render-preview :deep(blockquote) {
  border-left: 4px solid #dfe2e5;
  padding: 8px 16px;
  margin: 8px 0;
  color: #666;
}
.render-preview :deep(ul),
.render-preview :deep(ol) {
  padding-left: 24px;
  margin: 4px 0;
}
.render-preview :deep(code) {
  background: #f0f2f5;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.9em;
}

.code-output {
  padding: 16px;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  max-height: 500px;
  white-space: pre-wrap;
  word-break: break-all;
  color: #333;
  margin: 0;
}

.html-source {
  max-height: 250px;
}

.error {
  padding: 16px;
  color: #d03050;
  font-size: 13px;
}

@media (max-width: 960px) {
  .demo-layout {
    grid-template-columns: 1fr;
  }
}
</style>
