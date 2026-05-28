<script setup lang="ts">
import { defineComponent, ref, watch, type PropType, type VNode } from 'vue'
import { AimdEditor } from '@airalogy/aimd-editor/vue'
import type { AimdRecorderMessages } from '../locales'
import { getAimdRecorderScopeLabel } from '../locales'

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

function normalizeMarkdownModelValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (value == null) {
    return ''
  }

  return String(value)
}

const fieldRootRef = ref<HTMLElement | null>(null)
const draftValue = ref(normalizeMarkdownModelValue(props.modelValue))
const RenderVNode = defineComponent({
  name: 'RenderVNode',
  props: {
    vnode: { type: Object as PropType<VNode>, required: true },
  },
  setup(renderProps) {
    return () => renderProps.vnode
  },
})

function emitDraftValue(markdown: string) {
  if (markdown === draftValue.value) {
    return
  }

  draftValue.value = markdown
  emit('update:modelValue', markdown)
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

  draftValue.value = nextValue
})
</script>

<template>
  <div
    ref="fieldRootRef"
    class="aimd-rec-inline aimd-rec-inline--var-stacked aimd-rec-inline--var-markdown aimd-field-wrapper aimd-markdown-field"
    :class="{
      'aimd-markdown-field--disabled': disabled,
      'aimd-markdown-field--has-assigner-control': assignerControl || assignerStatus,
    }"
    @focusout="emitBlurIfLeavingField"
  >
    <span class="aimd-field aimd-field--no-style aimd-field__label">
      <span class="aimd-field__scope aimd-field__scope--var">
        {{ getAimdRecorderScopeLabel('var', messages) }}
      </span>
      <span class="aimd-field__id">{{ varId }}</span>
      <span v-if="assignerControl || assignerStatus" class="aimd-markdown-field__assigner-actions">
        <span v-if="assignerControl" class="aimd-markdown-field__assigner-action">
          <RenderVNode :vnode="assignerControl" />
        </span>
        <span v-if="assignerStatus" class="aimd-markdown-field__assigner-state">
          <RenderVNode :vnode="assignerStatus" />
        </span>
      </span>
    </span>

    <span v-if="assignerError" class="aimd-rec-inline__assigner-error aimd-markdown-field__assigner-error">
      {{ assignerError }}
    </span>

    <div class="aimd-markdown-field__editor-shell">
      <AimdEditor
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
        :min-height="360"
        :readonly="disabled"
        :monaco-options="{ minimap: { enabled: false } }"
        @update:model-value="emitDraftValue"
      />
    </div>
  </div>
</template>

<style scoped>
.aimd-markdown-field {
  width: min(100%, 1040px);
  min-width: 0;
  max-width: 100%;
}

.aimd-markdown-field .aimd-field__label {
  display: flex;
  align-items: center;
}

.aimd-markdown-field__assigner-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding-right: 6px;
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
}

.aimd-markdown-field__editor-shell :deep(.aimd-editor-source-mode),
.aimd-markdown-field__editor-shell :deep(.aimd-editor-wysiwyg-mode) {
  height: auto !important;
  min-height: 360px;
  overflow-y: visible !important;
  background: #fff;
  border-radius: 0 0 8px 8px;
}

.aimd-markdown-field__editor-shell :deep(.aimd-editor-source-mode) {
  padding: 0 0 2px;
}

.aimd-markdown-field__editor-shell :deep(.aimd-editor-container) {
  min-height: 360px;
}

.aimd-markdown-field__editor-shell :deep(.milkdown) {
  min-height: 360px;
}

.aimd-markdown-field__editor-shell :deep(.milkdown-editor-content) {
  min-height: 360px;
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
