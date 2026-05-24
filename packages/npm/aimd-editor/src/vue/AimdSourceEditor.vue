<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import type { AimdEditorMessages } from './locales'
import { collectAimdDiagnostics } from './aimdDiagnostics'

const props = defineProps<{
  content: string
  theme: string
  minHeight: number
  readonly: boolean
  monacoOptions: Record<string, any>
  resolvedMessages: AimdEditorMessages
}>()

const emit = defineEmits<{
  (e: 'content-change', value: string): void
  (e: 'ready', editor: any): void
  (e: 'monaco-loaded', monaco: any, editor: any): void
}>()

const CLIENT_ASSIGNER_FENCE = /^\s*(```|~~~)\s*assigner(?:\s+.*\bruntime\s*=\s*(?:"client"|'client'|client)\b.*)\s*$/
const SERVER_ASSIGNER_FENCE = /^\s*(```|~~~)\s*assigner(?:\s+.*)?\s*$/
const QUIZ_FENCE = /^\s*(```|~~~)\s*quiz(?:\s+.*)?\s*$/
const GENERIC_CODE_FENCE = /^\s*(```|~~~)\s*((?:\w|[/#-])+)(?:\s+.*)?\s*$/
const EMPTY_CODE_FENCE = /^\s*(```|~~~)\s*$/
const AIMD_DIAGNOSTIC_OWNER = 'airalogy-aimd'

const editorContainer = ref<HTMLElement | null>(null)

let monacoEditorInstance: any = null
let monacoModule: any = null
let isSyncing = false
const loading = ref(true)

function registerAimdLanguage(monaco: any) {
  const messages = props.resolvedMessages
  const langs = monaco.languages.getLanguages()
  if (langs.some((l: any) => l.id === 'aimd')) return

  monaco.languages.register({
    id: 'aimd',
    extensions: ['.aimd'],
    aliases: ['AIMD', 'aimd'],
    mimetypes: ['text/x-aimd'],
  })

  monaco.languages.setLanguageConfiguration('aimd', {
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '`', close: '`' },
      { open: '{{', close: '}}' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '`', close: '`' },
    ],
  })

  monaco.languages.setMonarchTokensProvider('aimd', {
    defaultToken: '',
    tokenPostfix: '.aimd',
    tokenizer: {
      root: [
        [/\{\{/, { token: 'delimiter.bracket.aimd', next: '@aimdField' }],
        [/^#{1,6}\s.*$/, 'keyword.md'],
        [QUIZ_FENCE, { token: 'string.code', next: '@embeddedCodeblock', nextEmbedded: 'yaml' }],
        [CLIENT_ASSIGNER_FENCE, { token: 'string.code', next: '@embeddedCodeblock', nextEmbedded: 'javascript' }],
        [SERVER_ASSIGNER_FENCE, { token: 'string.code', next: '@embeddedCodeblock', nextEmbedded: 'python' }],
        [GENERIC_CODE_FENCE, { token: 'string.code', next: '@embeddedCodeblock', nextEmbedded: '$2' }],
        [EMPTY_CODE_FENCE, { token: 'string.code', next: '@codeblock' }],
        [/`[^`]+`/, 'string.code'],
        [/\*\*[^*]+\*\*/, 'strong'],
        [/__[^_]+__/, 'strong'],
        [/\*[^*]+\*/, 'emphasis'],
        [/_[^_]+_/, 'emphasis'],
        [/\[[^\]]+\]\([^)]+\)/, 'string.link'],
        [/!\[[^\]]*\]\([^)]+\)/, 'string.link'],
        [/^>.*$/, 'comment.quote'],
        [/^\s*[-*+]\s/, 'keyword.list'],
        [/^\s*\d+\.\s/, 'keyword.list'],
        [/^[-*_]{3,}\s*$/, 'keyword.hr'],
        [/<\/?[\w-][^>]*>/, 'tag'],
      ],
      aimdField: [
        [/\}\}/, { token: 'delimiter.bracket.aimd', next: '@pop' }],
        [/\b(var_table|var|step|check|ref_step|ref_var|ref_fig|cite)\b/, 'keyword.aimd'],
        [/\|/, 'delimiter.aimd'],
        [/:/, 'delimiter'],
        [/\b(str|int|float|bool|list|dict|any)\b/, 'type.aimd'],
        [/\b[A-Z][A-Za-z0-9_]*(?:\[[A-Za-z0-9_,\s]+\])?\b/, 'type.aimd'],
        [/[[\]()]/, 'delimiter.bracket'],
        [/=/, 'delimiter'],
        [/"[^"]*"/, 'string'],
        [/'[^']*'/, 'string'],
        [/-?\d+\.?\d*/, 'number'],
        [/\b(true|false|True|False|null|None)\b/, 'constant'],
        [/\bsubvars\b/, 'keyword'],
        [/,/, 'delimiter'],
        [/[A-Za-z_]\w*/, 'variable.aimd'],
        [/\s+/, ''],
      ],
      codeblock: [
        [/^```\s*$/, { token: 'string.code', next: '@pop' }],
        [/^~~~\s*$/, { token: 'string.code', next: '@pop' }],
        [/.*$/, 'string.code'],
      ],
      embeddedCodeblock: [
        [/^```\s*$/, { token: 'string.code', next: '@pop', nextEmbedded: '@pop' }],
        [/^~~~\s*$/, { token: 'string.code', next: '@pop', nextEmbedded: '@pop' }],
        [/.*$/, ''],
      ],
    },
  } as any)

  monaco.languages.registerCompletionItemProvider('aimd', {
    provideCompletionItems: () => {
      const inlineKeywords = ['var', 'var_table', 'step', 'check', 'ref_step', 'ref_var', 'ref_fig', 'cite']
      const placeholderByKeyword: Record<string, string> = {
        var: 'var_id',
        var_table: 'table_id',
        step: 'step_id',
        check: 'check_id',
        ref_step: 'step_id',
        ref_var: 'var_id',
        ref_fig: 'fig_id',
        cite: 'ref_id',
      }
      const suggestions = inlineKeywords.map(keyword => ({
        label: `{{${keyword}|}}`,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: `{{${keyword}|\${1:${placeholderByKeyword[keyword] ?? 'id'}}}}`,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: messages.completions.insertAimdField(keyword),
      }))
      suggestions.push({
        label: messages.completions.quizBlockLabel,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: [
          '```quiz',
          'id: ${1:quiz_choice_1}',
          'type: choice',
          'mode: single',
          'stem: |',
          `  \${2:${messages.defaults.questionStem}}`,
          'options:',
          '  - key: A',
          `    text: ${messages.defaults.optionText('A')}`,
          '  - key: B',
          `    text: ${messages.defaults.optionText('B')}`,
          'answer: A',
          '```',
        ].join('\n'),
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: messages.completions.quizBlock,
      } as any)
      return { suggestions } as any
    },
  })

  monaco.editor.defineTheme('aimd-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'delimiter.bracket.aimd', foreground: '2563eb' },
      { token: 'keyword.aimd', foreground: '2563eb', fontStyle: 'bold' },
      { token: 'delimiter.aimd', foreground: '6b7280' },
      { token: 'type.aimd', foreground: '7c3aed' },
      { token: 'variable.aimd', foreground: '059669' },
      { token: 'keyword.md', foreground: '1e40af' },
      { token: 'string.code', foreground: 'be185d' },
      { token: 'strong', fontStyle: 'bold' },
      { token: 'emphasis', fontStyle: 'italic' },
      { token: 'string.link', foreground: '2563eb' },
      { token: 'comment.quote', foreground: '6b7280', fontStyle: 'italic' },
    ],
    colors: {},
  })

  monaco.editor.defineTheme('aimd-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'delimiter.bracket.aimd', foreground: '60a5fa' },
      { token: 'keyword.aimd', foreground: '60a5fa', fontStyle: 'bold' },
      { token: 'delimiter.aimd', foreground: '9ca3af' },
      { token: 'type.aimd', foreground: 'a78bfa' },
      { token: 'variable.aimd', foreground: '34d399' },
      { token: 'keyword.md', foreground: '93c5fd' },
      { token: 'string.code', foreground: 'f472b6' },
      { token: 'strong', fontStyle: 'bold' },
      { token: 'emphasis', fontStyle: 'italic' },
      { token: 'string.link', foreground: '60a5fa' },
      { token: 'comment.quote', foreground: '9ca3af', fontStyle: 'italic' },
    ],
    colors: {},
  })
}

function updateAimdDiagnostics() {
  if (!monacoModule || !monacoEditorInstance) return

  const model = monacoEditorInstance.getModel()
  if (!model) return

  const markers = collectAimdDiagnostics(model.getValue()).map((diagnostic) => {
    const start = model.getPositionAt(diagnostic.startOffset)
    const end = model.getPositionAt(diagnostic.endOffset)
    return {
      severity: diagnostic.severity === 'error'
        ? monacoModule.MarkerSeverity.Error
        : monacoModule.MarkerSeverity.Warning,
      message: diagnostic.message,
      source: 'AIMD',
      startLineNumber: start.lineNumber,
      startColumn: start.column,
      endLineNumber: end.lineNumber,
      endColumn: end.column,
    }
  })

  monacoModule.editor.setModelMarkers(model, AIMD_DIAGNOSTIC_OWNER, markers)
}

function clearAimdDiagnostics() {
  if (!monacoModule || !monacoEditorInstance) return

  const model = monacoEditorInstance.getModel()
  if (model) {
    monacoModule.editor.setModelMarkers(model, AIMD_DIAGNOSTIC_OWNER, [])
  }
}

function createEditor(monaco: any) {
  if (!editorContainer.value || monacoEditorInstance) return
  const MONACO_OPTIONS_BLACKLIST = new Set(['value', 'language', 'model'])
  const safeMonacoOptions = Object.fromEntries(
    Object.entries(props.monacoOptions).filter(([key]) => !MONACO_OPTIONS_BLACKLIST.has(key)),
  )

  monacoEditorInstance = monaco.editor.create(editorContainer.value, {
    value: props.content,
    language: 'aimd',
    theme: props.theme,
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    padding: { top: 12 },
    readOnly: props.readonly,
    ...safeMonacoOptions,
  })
  monacoEditorInstance.onDidChangeModelContent(() => {
    updateAimdDiagnostics()
    if (!isSyncing) {
      emit('content-change', monacoEditorInstance.getValue())
    }
  })
  updateAimdDiagnostics()
  emit('ready', monacoEditorInstance)
  emit('monaco-loaded', monaco, monacoEditorInstance)
}

onMounted(async () => {
  try {
    loading.value = true
    const monaco = await import('monaco-editor')
    monacoModule = monaco
    registerAimdLanguage(monaco)
    createEditor(monaco)
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  clearAimdDiagnostics()
  monacoEditorInstance?.dispose()
})

watch(() => props.content, (content) => {
  if (!monacoEditorInstance || content === monacoEditorInstance.getValue()) {
    return
  }

  isSyncing = true
  monacoEditorInstance.setValue(content)
  isSyncing = false
})

watch(() => props.theme, (theme) => {
  if (monacoModule) monacoModule.editor.setTheme(theme)
})

watch(() => props.readonly, (readonly) => {
  monacoEditorInstance?.updateOptions({ readOnly: readonly })
})

// Expose internal references for parent to set values, etc.
function getEditor() { return monacoEditorInstance }
function getMonaco() { return monacoModule }

function setValue(val: string) {
  if (monacoEditorInstance) {
    isSyncing = true
    monacoEditorInstance.setValue(val)
    isSyncing = false
  }
}

function getSelection() {
  return monacoEditorInstance?.getSelection()
}

function executeEdits(source: string, edits: any[]) {
  monacoEditorInstance?.executeEdits(source, edits)
}

function focus() {
  monacoEditorInstance?.focus()
}

function getModel() {
  return monacoEditorInstance?.getModel()
}

function getPosition() {
  return monacoEditorInstance?.getPosition()
}

function getValue() {
  return monacoEditorInstance?.getValue()
}

defineExpose({
  getEditor,
  getMonaco,
  setValue,
  getSelection,
  executeEdits,
  focus,
  getModel,
  getPosition,
  getValue,
  loading,
})
</script>

<template>
  <div class="aimd-editor-source-mode" :style="{ height: minHeight + 'px' }">
    <div v-if="loading" class="aimd-editor-loading">{{ resolvedMessages.common.loadingEditor }}</div>
    <div ref="editorContainer" class="aimd-editor-container" />
  </div>
</template>
