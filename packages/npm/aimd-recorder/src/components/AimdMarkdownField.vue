<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onBeforeUnmount, ref, shallowRef, watch, type PropType, type VNode } from 'vue'
import { AimdEditor } from '@airalogy/aimd-editor/vue'
import { createMermaidRenderer, renderToVue } from '@airalogy/aimd-renderer'
import type { AimdRecorderMessages } from '../locales'
import { getAimdRecorderScopeLabel } from '../locales'
import { createChainedElementRenderer, useCodeBlockRendering } from '../composables/useCodeBlockRendering'

const props = withDefaults(defineProps<{
  modelValue?: unknown
  varId: string
  disabled?: boolean
  locale?: string
  messages: Pick<AimdRecorderMessages, 'scope'>
  assignerControl?: VNode
  assignerStatus?: VNode
  assignerError?: string
}>(), {
  modelValue: undefined,
  disabled: false,
  locale: undefined,
  assignerControl: undefined,
  assignerStatus: undefined,
  assignerError: undefined,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'blur'): void
}>()

type MonacoLikeEditor = {
  getContentHeight?: () => number
  layout?: (dimension?: { width: number; height: number }) => void
  onDidContentSizeChange?: (listener: (event: { contentHeight: number }) => void) => { dispose: () => void }
}

const MARKDOWN_EDITOR_LINE_HEIGHT = 21
const MARKDOWN_EDITOR_VERTICAL_PADDING = 24
const MARKDOWN_EDITOR_MIN_HEIGHT = MARKDOWN_EDITOR_LINE_HEIGHT + MARKDOWN_EDITOR_VERTICAL_PADDING
const MARKDOWN_EDITOR_MAX_HEIGHT = 560
const MARKDOWN_EDITOR_ESTIMATED_CHARS_PER_LINE = 96

function normalizeMarkdownModelValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (value == null) {
    return ''
  }

  return String(value)
}

function isZhLocale(locale?: string): boolean {
  return locale?.toLowerCase().startsWith('zh') ?? false
}

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, text: string) => Promise<{ svg: string }> | { svg: string }
}

let mermaidRenderId = 0

const AimdMarkdownMermaidBlock = defineComponent({
  name: 'AimdMarkdownMermaidBlock',
  props: {
    code: { type: String, required: true },
  },
  setup(mermaidProps) {
    const svg = ref('')
    const failed = ref(false)
    let renderRequestId = 0

    async function renderMermaid() {
      const code = mermaidProps.code.trim()
      const requestId = ++renderRequestId
      if (!code) {
        svg.value = ''
        failed.value = false
        return
      }

      try {
        const mermaidModule = await import('mermaid') as { default: MermaidApi }
        const mermaid = mermaidModule.default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
        })
        const result = await mermaid.render(`aimd-markdown-mermaid-${++mermaidRenderId}`, code)
        if (requestId !== renderRequestId) {
          return
        }

        svg.value = result.svg
        failed.value = false
      } catch {
        if (requestId !== renderRequestId) {
          return
        }

        svg.value = ''
        failed.value = true
      }
    }

    watch(() => mermaidProps.code, () => {
      void renderMermaid()
    }, { immediate: true })

    return () => failed.value
      ? h('pre', { class: 'aimd-markdown-field__mermaid-fallback' }, mermaidProps.code)
      : h('div', {
        class: 'aimd-markdown-field__mermaid',
        innerHTML: svg.value,
      })
  },
})

const { preRenderer: codeBlockPreRenderer } = useCodeBlockRendering(() => {
  void renderPreview()
})

const fieldRootRef = ref<HTMLElement | null>(null)
const draftValue = ref(normalizeMarkdownModelValue(props.modelValue))
const viewMode = ref<'preview' | 'source'>(draftValue.value.trim() ? 'preview' : 'source')
const markdownEditorHeight = ref(estimateMarkdownEditorHeight(draftValue.value))
const markdownFieldStyle = computed(() => ({
  '--aimd-markdown-field-editor-height': `${markdownEditorHeight.value}px`,
}))
const previewNodes = shallowRef<VNode[]>([])
const previewRenderFailed = ref(false)
let previewRenderRequestId = 0
let markdownEditor: MonacoLikeEditor | null = null
let markdownContentSizeDisposable: { dispose: () => void } | null = null
const RenderVNode = defineComponent({
  name: 'RenderVNode',
  props: {
    vnode: { type: Object as PropType<VNode>, required: true },
  },
  setup(renderProps) {
    return () => renderProps.vnode
  },
})

const PreviewOutlet = defineComponent({
  name: 'AimdMarkdownFieldPreviewOutlet',
  props: {
    nodes: {
      type: Array as () => VNode[],
      required: true,
    },
  },
  setup(previewProps) {
    return () => previewProps.nodes
  },
})

const hasValue = computed(() => Boolean(draftValue.value.trim()))
const showPreview = computed(() => viewMode.value === 'preview')
const previewLabel = computed(() => (isZhLocale(props.locale) ? '预览' : 'Preview'))
const sourceLabel = computed(() => (isZhLocale(props.locale) ? '源码' : 'Source'))
const emptyPreviewLabel = computed(() => (isZhLocale(props.locale) ? '暂无内容' : 'No content'))
const previewToolbarLabel = computed(() => (isZhLocale(props.locale) ? 'Markdown 显示模式' : 'Markdown view mode'))
const markdownMonacoOptions = computed(() => ({
  minimap: { enabled: false },
  lineHeight: MARKDOWN_EDITOR_LINE_HEIGHT,
  padding: { top: 12, bottom: 12 },
  scrollbar: { vertical: 'auto', horizontal: 'auto' },
}))

function clampMarkdownEditorHeight(height: number): number {
  return Math.max(MARKDOWN_EDITOR_MIN_HEIGHT, Math.min(MARKDOWN_EDITOR_MAX_HEIGHT, Math.ceil(height)))
}

function estimateVisualLineCount(value: string): number {
  const lines = value.replace(/\r\n?/g, '\n').split('\n')
  return lines.reduce((total, line) => {
    const length = Array.from(line).length
    return total + Math.max(1, Math.ceil(length / MARKDOWN_EDITOR_ESTIMATED_CHARS_PER_LINE))
  }, 0)
}

function estimateMarkdownEditorHeight(value: string): number {
  return clampMarkdownEditorHeight((estimateVisualLineCount(value) * MARKDOWN_EDITOR_LINE_HEIGHT) + MARKDOWN_EDITOR_VERTICAL_PADDING)
}

function layoutMarkdownEditor() {
  if (!markdownEditor?.layout) {
    return
  }

  const editorContainer = fieldRootRef.value?.querySelector('.aimd-editor-container') as HTMLElement | null
  const width = editorContainer?.clientWidth ?? 0
  if (width > 0) {
    markdownEditor.layout({ width, height: markdownEditorHeight.value })
    return
  }

  markdownEditor.layout()
}

function setMarkdownEditorHeight(height: number) {
  const nextHeight = clampMarkdownEditorHeight(height)
  if (nextHeight === markdownEditorHeight.value) {
    return
  }

  markdownEditorHeight.value = nextHeight
  void nextTick(layoutMarkdownEditor)
}

function syncEstimatedMarkdownEditorHeight(value = draftValue.value) {
  setMarkdownEditorHeight(estimateMarkdownEditorHeight(value))
}

function syncMeasuredMarkdownEditorHeight() {
  const contentHeight = markdownEditor?.getContentHeight?.()
  if (typeof contentHeight === 'number' && Number.isFinite(contentHeight)) {
    setMarkdownEditorHeight(contentHeight)
  }
}

async function renderPreview() {
  const currentContent = draftValue.value.trim()
  const requestId = ++previewRenderRequestId

  if (!currentContent) {
    previewNodes.value = []
    previewRenderFailed.value = false
    return
  }

  try {
    const rendered = await renderToVue(currentContent, {
      locale: props.locale,
      mode: 'preview',
      elementRenderers: {
        pre: createChainedElementRenderer(
          createMermaidRenderer(AimdMarkdownMermaidBlock),
          codeBlockPreRenderer,
        ),
      },
    })

    if (requestId !== previewRenderRequestId) {
      return
    }

    previewNodes.value = rendered.nodes
    previewRenderFailed.value = false
  } catch {
    if (requestId !== previewRenderRequestId) {
      return
    }

    previewNodes.value = []
    previewRenderFailed.value = true
  }
}

function switchToPreview() {
  viewMode.value = 'preview'
  void renderPreview()
}

function switchToSource() {
  viewMode.value = 'source'
}

function emitDraftValue(markdown: string) {
  syncEstimatedMarkdownEditorHeight(markdown)
  if (markdown === draftValue.value) {
    return
  }

  draftValue.value = markdown
  emit('update:modelValue', markdown)
}

function handleMarkdownEditorReady(editor: { monaco?: MonacoLikeEditor }) {
  if (!editor.monaco) {
    return
  }

  markdownContentSizeDisposable?.dispose()
  markdownEditor = editor.monaco
  markdownContentSizeDisposable = markdownEditor.onDidContentSizeChange?.((event) => {
    setMarkdownEditorHeight(event.contentHeight)
  }) ?? null
  syncMeasuredMarkdownEditorHeight()
}

function emitBlurIfLeavingField(event: FocusEvent) {
  const currentTarget = fieldRootRef.value
  const nextTarget = event.relatedTarget as Node | null
  if (!currentTarget || (nextTarget && currentTarget.contains(nextTarget))) {
    return
  }

  emit('blur')
}

watch(() => props.modelValue, (value) => {
  const nextValue = normalizeMarkdownModelValue(value)
  if (nextValue === draftValue.value) {
    return
  }

  const hadValue = hasValue.value
  draftValue.value = nextValue
  syncEstimatedMarkdownEditorHeight(nextValue)
  if (!hadValue && nextValue.trim()) {
    viewMode.value = 'preview'
  }
})

onBeforeUnmount(() => {
  markdownContentSizeDisposable?.dispose()
})

watch(
  () => [draftValue.value, props.locale] as const,
  () => {
    void renderPreview()
  },
  { immediate: true },
)
</script>

<template>
  <div
    ref="fieldRootRef"
    class="aimd-rec-inline aimd-rec-inline--var-stacked aimd-rec-inline--var-markdown aimd-field-wrapper aimd-markdown-field"
    :class="{
      'aimd-markdown-field--disabled': disabled,
      'aimd-markdown-field--has-assigner-control': assignerControl || assignerStatus,
    }"
    :style="markdownFieldStyle"
    @focusout="emitBlurIfLeavingField"
  >
    <span class="aimd-field aimd-field--no-style aimd-field__label">
      <span class="aimd-field__scope aimd-field__scope--var">
        {{ getAimdRecorderScopeLabel('var', messages) }}
      </span>
      <span class="aimd-field__id">{{ varId }}</span>
      <span class="aimd-markdown-field__header-actions">
        <span class="aimd-markdown-field__view-switch" :aria-label="previewToolbarLabel">
          <button
            type="button"
            class="aimd-markdown-field__view-btn"
            :class="{ 'aimd-markdown-field__view-btn--active': showPreview }"
            :aria-pressed="showPreview"
            @click="switchToPreview"
          >
            {{ previewLabel }}
          </button>
          <button
            type="button"
            class="aimd-markdown-field__view-btn"
            :class="{ 'aimd-markdown-field__view-btn--active': !showPreview }"
            :aria-pressed="!showPreview"
            @click="switchToSource"
          >
            {{ sourceLabel }}
          </button>
        </span>
        <span v-if="assignerControl || assignerStatus" class="aimd-markdown-field__assigner-actions">
          <span v-if="assignerControl" class="aimd-markdown-field__assigner-action">
            <RenderVNode :vnode="assignerControl" />
          </span>
          <span v-if="assignerStatus" class="aimd-markdown-field__assigner-state">
            <RenderVNode :vnode="assignerStatus" />
          </span>
        </span>
      </span>
    </span>

    <span v-if="assignerError" class="aimd-rec-inline__assigner-error aimd-markdown-field__assigner-error">
      {{ assignerError }}
    </span>

    <div class="aimd-markdown-field__editor-shell">
      <div v-if="showPreview" class="aimd-markdown-field__preview-shell">
        <div v-if="!hasValue" class="aimd-markdown-field__preview-empty">
          {{ emptyPreviewLabel }}
        </div>
        <pre
          v-else-if="previewRenderFailed"
          class="aimd-markdown-field__preview-fallback"
        >{{ draftValue }}</pre>
        <div v-else class="aimd-markdown-field__preview">
          <PreviewOutlet :nodes="previewNodes" />
        </div>
      </div>

      <AimdEditor
        v-else
        class="aimd-markdown-field__editor"
        :model-value="draftValue"
        :locale="locale"
        mode="source"
        theme="aimd-light"
        :show-top-bar="true"
        :show-toolbar="!disabled"
        :show-md-toolbar="true"
        :show-aimd-toolbar="true"
        :enable-block-handle="!disabled"
        :keep-inactive-editors-mounted="false"
        :min-height="markdownEditorHeight"
        :readonly="disabled"
        :monaco-options="markdownMonacoOptions"
        @update:model-value="emitDraftValue"
        @ready="handleMarkdownEditorReady"
      />
    </div>
  </div>
</template>

<style scoped>
.aimd-markdown-field {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  border-color: #d8e1ee;
  background: #fff;
}

.aimd-markdown-field.aimd-rec-inline--var-stacked:focus-within {
  border-color: #b8c7dc;
  box-shadow: 0 0 0 1px rgba(100, 116, 139, 0.12);
}

.aimd-markdown-field .aimd-field__label {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  border-radius: 8px 8px 0 0;
  background: #f8fbff;
  border-bottom: 1px solid #e2e8f0;
}

.aimd-markdown-field__header-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding-right: 8px;
}

.aimd-markdown-field__view-switch {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
}

.aimd-markdown-field__assigner-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.aimd-markdown-field__assigner-action,
.aimd-markdown-field__assigner-state {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.aimd-markdown-field__assigner-action :deep(.aimd-rec-assigner-field__button) {
  width: 30px;
  min-width: 30px;
  height: 26px;
  min-height: 26px;
  border: 0 none;
  border-radius: 6px;
  margin: 0;
  background: #eaf4ff;
  color: #1976d2;
  box-shadow: none;
  font-size: 16px;
}

.aimd-markdown-field__assigner-action :deep(.aimd-rec-assigner-field__button:hover:not(:disabled)) {
  background: #dbeafe;
  color: #1565c0;
}

.aimd-markdown-field__assigner-action :deep(.aimd-rec-assigner-field__spinner) {
  border-color: rgba(25, 118, 210, 0.25);
  border-top-color: #1976d2;
}

.aimd-markdown-field__assigner-state :deep(.aimd-rec-assigner-field__status) {
  color: #94a3b8;
  font-size: 16px;
}

.aimd-markdown-field__assigner-error {
  margin: 0;
  border-top: 1px solid #fecaca;
}

.aimd-markdown-field__editor-shell {
  width: 100%;
  min-width: 0;
  background: #fff;
}

.aimd-markdown-field__view-btn {
  min-width: 46px;
  min-height: 24px;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.18s, border-color 0.18s, color 0.18s;
}

.aimd-markdown-field__view-btn:first-child {
  border-radius: 5px 0 0 5px;
}

.aimd-markdown-field__view-btn:last-child {
  margin-left: -1px;
  border-radius: 0 5px 5px 0;
}

.aimd-markdown-field__view-btn:hover {
  border-color: #9db1cc;
  color: #1f4f8f;
}

.aimd-markdown-field__view-btn--active {
  position: relative;
  border-color: #2563eb;
  background: #eff6ff;
  color: #1d4ed8;
}

.aimd-markdown-field__preview-shell {
  min-width: 0;
  min-height: var(--aimd-markdown-field-editor-height);
  padding: 14px 18px;
  background: #fff;
  color: #334155;
  font-size: 15px;
  line-height: 1.65;
}

.aimd-markdown-field__preview {
  min-width: 0;
}

.aimd-markdown-field__preview-empty {
  color: #94a3b8;
  font-size: 13px;
}

.aimd-markdown-field__preview-fallback,
.aimd-markdown-field__mermaid-fallback {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font: inherit;
  color: inherit;
}

.aimd-markdown-field__mermaid {
  overflow-x: auto;
}

.aimd-markdown-field__mermaid :deep(svg) {
  max-width: 100%;
  height: auto;
}

.aimd-markdown-field__preview :deep(ul),
.aimd-markdown-field__preview :deep(ol) {
  margin: 0.45em 0 0.75em;
  padding-left: 1.6em;
}

.aimd-markdown-field__preview :deep(ul) {
  list-style: disc outside;
}

.aimd-markdown-field__preview :deep(ol) {
  list-style: decimal outside;
}

.aimd-markdown-field__preview :deep(li + li) {
  margin-top: 0.25em;
}

.aimd-markdown-field__preview :deep(blockquote) {
  margin: 0.8em 0;
  padding: 0.25em 0 0.25em 0.9em;
  border-left: 3px solid #cbd5e1;
  color: #475569;
}

.aimd-markdown-field__preview :deep(:not(pre) > code) {
  padding: 0.1em 0.32em;
  border-radius: 4px;
  background: #f1f5f9;
  color: #0f172a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 0.92em;
}

.aimd-markdown-field__preview :deep(pre) {
  overflow-x: auto;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #f8fafc;
}

.aimd-markdown-field__preview :deep(pre code) {
  padding: 0;
  background: transparent;
}

.aimd-markdown-field__preview :deep(.aimd-code-block) {
  max-width: 100%;
  overflow: hidden;
  margin: 0.9em 0;
  padding: 0;
  border: 1px solid #d8e1ee;
  border-radius: 8px;
  background: #f8fafc;
  color: #0f172a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 13px;
  line-height: 1.58;
  white-space: normal;
}

.aimd-markdown-field__preview :deep(.aimd-code-block__code) {
  display: block;
  padding: 10px 0;
  border-radius: 0;
  background: transparent;
}

.aimd-markdown-field__preview :deep(.aimd-code-block__line) {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  column-gap: 12px;
  padding-right: 12px;
}

.aimd-markdown-field__preview :deep(.aimd-code-block__line-number) {
  min-width: 3ch;
  padding-left: 12px;
  color: #94a3b8;
  text-align: right;
  user-select: none;
}

.aimd-markdown-field__preview :deep(.aimd-code-block__line-code) {
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.aimd-markdown-field__preview :deep(.aimd-code-block--wrap .aimd-code-block__line-code) {
  padding-left: var(--aimd-code-wrap-indent, 0ch);
  text-indent: calc(-1 * var(--aimd-code-wrap-indent, 0ch));
}

.aimd-markdown-field__preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.8em 0;
  font-size: 0.95em;
}

.aimd-markdown-field__preview :deep(th),
.aimd-markdown-field__preview :deep(td) {
  padding: 7px 9px;
  border: 1px solid #d8e1ee;
  text-align: left;
  vertical-align: top;
}

.aimd-markdown-field__preview :deep(th) {
  background: #f8fbff;
  font-weight: 650;
}

.aimd-markdown-field__preview :deep(p:first-child),
.aimd-markdown-field__preview :deep(ul:first-child),
.aimd-markdown-field__preview :deep(ol:first-child),
.aimd-markdown-field__preview :deep(blockquote:first-child),
.aimd-markdown-field__preview :deep(pre:first-child) {
  margin-top: 0;
}

.aimd-markdown-field__preview :deep(p:last-child),
.aimd-markdown-field__preview :deep(ul:last-child),
.aimd-markdown-field__preview :deep(ol:last-child),
.aimd-markdown-field__preview :deep(blockquote:last-child),
.aimd-markdown-field__preview :deep(pre:last-child) {
  margin-bottom: 0;
}

.aimd-markdown-field__editor-shell :deep(.aimd-editor) {
  border: 0 none;
  border-radius: 0;
  overflow: visible;
  background: transparent;
}

.aimd-markdown-field__editor-shell :deep(.aimd-editor-toolbar) {
  border-bottom-color: #d9e6fb;
  background: #fff;
}

.aimd-markdown-field__editor-shell :deep(.aimd-editor-panel) {
  min-width: 0;
  min-height: var(--aimd-markdown-field-editor-height) !important;
}

.aimd-markdown-field__editor-shell :deep(.aimd-editor-source-mode),
.aimd-markdown-field__editor-shell :deep(.aimd-editor-wysiwyg-mode) {
  height: var(--aimd-markdown-field-editor-height) !important;
  min-height: var(--aimd-markdown-field-editor-height);
  background: #fff;
  border-radius: 0 0 8px 8px;
}

.aimd-markdown-field__editor-shell :deep(.aimd-editor-source-mode) {
  padding: 0 0 2px;
}

.aimd-markdown-field__editor-shell :deep(.aimd-editor-container) {
  height: var(--aimd-markdown-field-editor-height);
  min-height: var(--aimd-markdown-field-editor-height);
}

.aimd-markdown-field__editor-shell :deep(.milkdown) {
  min-height: var(--aimd-markdown-field-editor-height);
}

.aimd-markdown-field__editor-shell :deep(.milkdown-editor-content) {
  min-height: var(--aimd-markdown-field-editor-height);
  padding: 14px 16px 18px;
  box-sizing: border-box;
}

.aimd-markdown-field__editor-shell :deep(.milkdown-editor-content--readonly) {
  cursor: default;
  background: #f8fbff;
}

.aimd-markdown-field--disabled {
  opacity: 0.92;
}
</style>
