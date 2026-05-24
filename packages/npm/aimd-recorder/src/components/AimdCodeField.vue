<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ensureMonacoEnvironment, ensureMonacoLanguageContribution } from '../monaco-code'

const props = withDefaults(defineProps<{
  modelValue?: string | number
  language: string
  disabled?: boolean
}>(), {
  modelValue: '',
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'blur'): void
}>()

const editorContainer = ref<HTMLElement | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const draftValue = ref(normalizeCodeFieldValue(props.modelValue))

let monacoModule: typeof import('monaco-editor') | null = null
let monacoEditor: import('monaco-editor').editor.IStandaloneCodeEditor | null = null
let monacoModel: import('monaco-editor').editor.ITextModel | null = null
let isSyncing = false

function normalizeCodeFieldValue(value: string | number | undefined): string {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  return ''
}

function emitDraftValue(nextValue: string) {
  if (nextValue === draftValue.value) {
    return
  }

  draftValue.value = nextValue
  emit('update:modelValue', nextValue)
}

async function applyLanguage(language: string) {
  if (!monacoModule || !monacoModel) {
    return
  }

  await ensureMonacoLanguageContribution(language)
  monacoModule.editor.setModelLanguage(monacoModel, language)
}

async function createEditor() {
  if (!editorContainer.value || monacoEditor) {
    return
  }

  loading.value = true
  loadError.value = null

  try {
    ensureMonacoEnvironment()
    monacoModule = await import('monaco-editor')
    await ensureMonacoLanguageContribution(props.language)

    monacoEditor = monacoModule.editor.create(editorContainer.value, {
      value: draftValue.value,
      language: props.language,
      theme: 'vs',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      lineNumbers: 'on',
      wordWrap: 'on',
      tabSize: 2,
      padding: { top: 12, bottom: 12 },
      readOnly: props.disabled,
    })

    monacoModel = monacoEditor.getModel()

    monacoEditor.onDidChangeModelContent(() => {
      if (isSyncing || !monacoEditor) {
        return
      }

      emitDraftValue(monacoEditor.getValue())
    })

    monacoEditor.onDidBlurEditorWidget(() => {
      emit('blur')
    })
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Failed to load Monaco editor.'
  } finally {
    loading.value = false
  }
}

function syncEditorValue(nextValue: string) {
  draftValue.value = nextValue

  if (!monacoEditor || nextValue === monacoEditor.getValue()) {
    return
  }

  isSyncing = true
  monacoEditor.setValue(nextValue)
  isSyncing = false
}

function onFallbackInput(event: Event) {
  emitDraftValue((event.target as HTMLTextAreaElement).value)
}

onMounted(() => {
  void createEditor()
})

onBeforeUnmount(() => {
  monacoEditor?.dispose()
  monacoModel?.dispose()
})

watch(() => props.modelValue, (value) => {
  syncEditorValue(normalizeCodeFieldValue(value))
})

watch(() => props.disabled, (disabled) => {
  monacoEditor?.updateOptions({ readOnly: disabled })
})

watch(() => props.language, async (language) => {
  if (!monacoEditor) {
    return
  }

  await applyLanguage(language)
})
</script>

<template>
  <div class="aimd-code-field" :class="{ 'aimd-code-field--disabled': disabled }">
    <div v-if="loadError" class="aimd-code-field__fallback-shell">
      <textarea
        class="aimd-code-field__fallback"
        :value="draftValue"
        :disabled="disabled"
        spellcheck="false"
        @input="onFallbackInput"
        @blur="emit('blur')"
      />
    </div>

    <template v-else>
      <div v-if="loading" class="aimd-code-field__loading">Loading code editor…</div>
      <div ref="editorContainer" class="aimd-code-field__editor" />
    </template>
  </div>
</template>

<style scoped>
.aimd-code-field {
  position: relative;
  width: 100%;
  min-width: 0;
  border-top: 1px solid var(--aimd-border-color, #90caf9);
  background: #fff;
}

.aimd-code-field__loading,
.aimd-code-field__fallback-shell {
  display: flex;
  width: 100%;
  min-height: 240px;
  align-items: stretch;
}

.aimd-code-field__loading {
  position: absolute;
  inset: 0;
  z-index: 1;
  align-items: center;
  justify-content: center;
  color: #667085;
  font-size: 13px;
  background: linear-gradient(180deg, #fcfdff 0%, #f7fbff 100%);
}

.aimd-code-field__editor {
  width: 100%;
  min-height: 240px;
}

.aimd-code-field__editor :deep(.monaco-editor),
.aimd-code-field__editor :deep(.monaco-editor-background) {
  background: #fff;
}

.aimd-code-field__fallback {
  width: 100%;
  min-height: 240px;
  padding: 12px 14px;
  border: 0 none;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
  background: #fff;
  color: #101828;
  font-size: 13px;
  line-height: 1.6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.aimd-code-field--disabled {
  opacity: 0.98;
}

.aimd-code-field--disabled .aimd-code-field__fallback {
  background: #f8fbff;
}
</style>
