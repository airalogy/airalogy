<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onBeforeUnmount, ref, shallowRef, watch, type VNode } from 'vue'
import { AimdEditor } from '@airalogy/aimd-editor/vue'
import { renderToVue } from '@airalogy/aimd-renderer'

type AimdEditorExpose = {
  getMonacoEditor?: () => { focus?: () => void } | null
}

const props = withDefaults(defineProps<{
  modelValue?: unknown
  disabled?: boolean
  locale?: string
  minHeight?: number
}>(), {
  modelValue: undefined,
  disabled: false,
  locale: undefined,
  minHeight: 220,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'blur'): void
  (e: 'close'): void
}>()

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

const fieldRootRef = ref<HTMLElement | null>(null)
const editorRef = ref<AimdEditorExpose | null>(null)
const draftValue = ref(normalizeMarkdownModelValue(props.modelValue))
const editing = ref(false)
const previewNodes = shallowRef<VNode[]>([])
const previewRenderFailed = ref(false)
let previewRenderRequestId = 0
let focusOutCheckTimer: ReturnType<typeof setTimeout> | null = null

const hasValue = computed(() => Boolean(draftValue.value.trim()))
const showPreview = computed(() => hasValue.value && !editing.value)
const showEditor = computed(() => !props.disabled && (!hasValue.value || editing.value))
const showEmptyState = computed(() => !showPreview.value && !showEditor.value)
const editLabel = computed(() => (isZhLocale(props.locale) ? '编辑备注' : 'Edit note'))
const closeLabel = computed(() => (isZhLocale(props.locale) ? '关闭备注' : 'Close note'))
const emptyLabel = computed(() => (isZhLocale(props.locale) ? '暂无备注' : 'No notes'))

const PreviewOutlet = defineComponent({
  name: 'AimdMarkdownNotePreviewOutlet',
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

function syncEditingState() {
  if (props.disabled) {
    editing.value = false
    return
  }

  if (!hasValue.value) {
    editing.value = true
  }
}

function emitDraftValue(markdown: string) {
  if (markdown === draftValue.value) {
    return
  }

  draftValue.value = markdown
  emit('update:modelValue', markdown)
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

async function beginEditing() {
  if (props.disabled) {
    return
  }

  editing.value = true
  await nextTick()
  editorRef.value?.getMonacoEditor?.()?.focus?.()
}

function closeEditor() {
  clearPendingFocusOutCheck()
  editing.value = false
  emit('close')
  emit('blur')
}

function handlePreviewClick(event: MouseEvent) {
  if (props.disabled) {
    return
  }

  if (event.target instanceof Element && event.target.closest('a, button, input, textarea, select, summary, details')) {
    return
  }

  void beginEditing()
}

function handlePreviewKeydown(event: KeyboardEvent) {
  if (props.disabled) {
    return
  }

  if (event.key !== 'Enter' && event.key !== ' ') {
    return
  }

  event.preventDefault()
  void beginEditing()
}

function clearPendingFocusOutCheck() {
  if (focusOutCheckTimer) {
    clearTimeout(focusOutCheckTimer)
    focusOutCheckTimer = null
  }
}

function handleFocusIn() {
  clearPendingFocusOutCheck()
}

function emitBlurIfLeavingField(event: FocusEvent) {
  const currentTarget = fieldRootRef.value
  const nextTarget = event.relatedTarget as Node | null
  if (!currentTarget || (nextTarget && currentTarget.contains(nextTarget))) {
    return
  }

  clearPendingFocusOutCheck()
  focusOutCheckTimer = setTimeout(() => {
    focusOutCheckTimer = null
    const activeElement = typeof document !== 'undefined' ? document.activeElement : null
    if (activeElement instanceof Node && currentTarget.contains(activeElement)) {
      return
    }

    if (hasValue.value) {
      editing.value = false
    }

    emit('blur')
  }, 0)
}

watch(() => props.modelValue, (value) => {
  const nextValue = normalizeMarkdownModelValue(value)
  if (nextValue === draftValue.value) {
    return
  }

  draftValue.value = nextValue
})

watch(
  () => [draftValue.value, props.locale] as const,
  () => {
    syncEditingState()
    void renderPreview()
  },
  { immediate: true },
)

watch(() => props.disabled, () => {
  syncEditingState()
})

onBeforeUnmount(() => {
  clearPendingFocusOutCheck()
})
</script>

<template>
  <div
    ref="fieldRootRef"
    class="aimd-markdown-note-field"
    :class="{
      'aimd-markdown-note-field--disabled': disabled,
      'aimd-markdown-note-field--preview': showPreview,
      'aimd-markdown-note-field--editor': showEditor,
      'aimd-markdown-note-field--empty': showEmptyState,
    }"
    @focusin="handleFocusIn"
    @focusout="emitBlurIfLeavingField"
  >
    <div v-if="showPreview" class="aimd-markdown-note-field__preview-shell">
      <div v-if="!disabled" class="aimd-markdown-note-field__preview-actions">
        <button
          type="button"
          class="aimd-markdown-note-field__preview-edit"
          @click="beginEditing"
        >
          {{ editLabel }}
        </button>
      </div>
      <div
        class="aimd-markdown-note-field__preview"
        :class="{ 'aimd-markdown-note-field__preview--interactive': !disabled }"
        :tabindex="disabled ? undefined : 0"
        :role="disabled ? undefined : 'button'"
        @click="handlePreviewClick"
        @keydown="handlePreviewKeydown"
      >
        <pre
          v-if="previewRenderFailed"
          class="aimd-markdown-note-field__preview-fallback"
        >{{ draftValue }}</pre>
        <PreviewOutlet v-else :nodes="previewNodes" />
      </div>
    </div>

    <div v-else-if="showEditor" class="aimd-markdown-note-field__editor-shell">
      <div class="aimd-markdown-note-field__editor-actions">
        <button
          type="button"
          class="aimd-markdown-note-field__editor-close"
          @click="closeEditor"
        >
          {{ closeLabel }}
        </button>
      </div>
      <AimdEditor
        ref="editorRef"
        class="aimd-markdown-note-field__editor"
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
        :min-height="minHeight"
        :readonly="disabled"
        :monaco-options="{ minimap: { enabled: false } }"
        @update:model-value="emitDraftValue"
      />
    </div>

    <div v-else class="aimd-markdown-note-field__empty">
      {{ emptyLabel }}
    </div>
  </div>
</template>

<style scoped>
.aimd-markdown-note-field {
  width: min(100%, 920px);
  min-width: 0;
  max-width: 100%;
  background: #fff;
  border: 1px solid #d8e1ee;
  border-radius: 10px;
  overflow: hidden;
}

.aimd-markdown-note-field--preview,
.aimd-markdown-note-field--empty {
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}

.aimd-markdown-note-field__preview-shell {
  min-width: 0;
}

.aimd-markdown-note-field__preview-actions {
  display: flex;
  justify-content: flex-end;
  padding: 8px 8px 0;
}

.aimd-markdown-note-field__preview-edit {
  border: 1px solid #d1d9e6;
  border-radius: 999px;
  min-height: 26px;
  padding: 0 10px;
  background: #fff;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s, color 0.2s;
}

.aimd-markdown-note-field__preview-edit:hover {
  border-color: #9db1cc;
  background: #f7faff;
  color: #1f4f8f;
}

.aimd-markdown-note-field__editor-shell {
  min-width: 0;
}

.aimd-markdown-note-field__editor-actions {
  display: flex;
  justify-content: flex-end;
  padding: 8px 8px 0;
  background: #fff;
}

.aimd-markdown-note-field__editor-close {
  border: 1px solid #d1d9e6;
  border-radius: 999px;
  min-height: 26px;
  padding: 0 10px;
  background: #fff;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s, color 0.2s;
}

.aimd-markdown-note-field__editor-close:hover {
  border-color: #9db1cc;
  background: #f8fbff;
  color: #334155;
}

.aimd-markdown-note-field__preview {
  min-width: 0;
  padding: 6px 14px 14px;
  color: #334155;
  line-height: 1.65;
}

.aimd-markdown-note-field__preview--interactive {
  cursor: text;
}

.aimd-markdown-note-field__preview--interactive:hover {
  background: rgba(247, 250, 255, 0.7);
}

.aimd-markdown-note-field__preview--interactive:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px rgba(47, 111, 237, 0.12);
}

.aimd-markdown-note-field__preview-fallback {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font: inherit;
  color: inherit;
}

.aimd-markdown-note-field__empty {
  padding: 12px 14px;
  color: #94a3b8;
  font-size: 13px;
}

.aimd-markdown-note-field :deep(.aimd-editor) {
  border: 0 none;
  border-radius: 0;
  overflow: visible;
  background: transparent;
}

.aimd-markdown-note-field :deep(.aimd-editor-toolbar) {
  border-bottom-color: #d9e6fb;
  background: #fff;
}

.aimd-markdown-note-field :deep(.aimd-editor-panel) {
  min-width: 0;
}

.aimd-markdown-note-field :deep(.aimd-editor-source-mode) {
  background: #fff;
}

.aimd-markdown-note-field :deep(.aimd-editor-wysiwyg-mode) {
  height: auto !important;
  overflow-y: visible !important;
  background: #fff;
}

.aimd-markdown-note-field :deep(p:first-child),
.aimd-markdown-note-field :deep(ul:first-child),
.aimd-markdown-note-field :deep(ol:first-child),
.aimd-markdown-note-field :deep(blockquote:first-child),
.aimd-markdown-note-field :deep(pre:first-child) {
  margin-top: 0;
}

.aimd-markdown-note-field :deep(p:last-child),
.aimd-markdown-note-field :deep(ul:last-child),
.aimd-markdown-note-field :deep(ol:last-child),
.aimd-markdown-note-field :deep(blockquote:last-child),
.aimd-markdown-note-field :deep(pre:last-child) {
  margin-bottom: 0;
}

.aimd-markdown-note-field--disabled {
  opacity: 0.92;
}
</style>
