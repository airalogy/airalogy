<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { conf as aimdConf, language as aimdLanguage } from '@airalogy/aimd-editor/monaco'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import type * as Monaco from 'monaco-editor'

interface ProtocolSourceBrowserFile {
  path: string
  relativePath?: string
  content: string
  language?: string
}

interface ProtocolSourceBrowserLabels {
  files: string
  empty: string
  loading: string
}

interface SourceTreeRow {
  key: string
  type: 'folder' | 'file'
  label: string
  depth: number
  file?: NormalizedSourceFile
}

interface NormalizedSourceFile {
  path: string
  relativePath: string
  content: string
  language: string
}

const props = withDefaults(defineProps<{
  files: ProtocolSourceBrowserFile[]
  modelValue: string
  rootLabel?: string
  labels: ProtocolSourceBrowserLabels
}>(), {
  rootLabel: 'protocol/',
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const editorContainer = ref<HTMLElement | null>(null)
const loading = ref(true)
const loadFailed = ref(false)

let monacoModule: typeof Monaco | null = null
let monacoEditor: Monaco.editor.IStandaloneCodeEditor | null = null
let monacoModel: Monaco.editor.ITextModel | null = null
let isSyncingModel = false

const normalizedFiles = computed<NormalizedSourceFile[]>(() => props.files.map((file) => ({
  path: file.path,
  relativePath: file.relativePath ?? file.path,
  content: file.content,
  language: file.language ?? languageFromPath(file.path),
})))

const sourceTreeRows = computed<SourceTreeRow[]>(() => {
  const rows: SourceTreeRow[] = []
  const seenFolders = new Set<string>()

  for (const file of normalizedFiles.value) {
    const segments = file.relativePath.split('/').filter(Boolean)
    let prefix = ''

    for (let index = 0; index < segments.length - 1; index += 1) {
      prefix = prefix ? `${prefix}/${segments[index]}` : segments[index]
      if (!seenFolders.has(prefix)) {
        seenFolders.add(prefix)
        rows.push({
          key: `folder:${prefix}`,
          type: 'folder',
          label: segments[index],
          depth: index + 1,
        })
      }
    }

    rows.push({
      key: `file:${file.path}`,
      type: 'file',
      label: segments[segments.length - 1] ?? file.relativePath,
      depth: Math.max(1, segments.length),
      file,
    })
  }

  return rows
})

const selectedFile = computed(() => (
  normalizedFiles.value.find((file) => file.path === props.modelValue)
  ?? normalizedFiles.value[0]
  ?? null
))

const selectedRelativePath = computed(() => selectedFile.value?.relativePath ?? '')
const selectedDisplayPath = computed(() => selectedFile.value?.path ?? '')
const selectedContent = computed(() => selectedFile.value?.content ?? '')
const selectedLanguage = computed(() => selectedFile.value?.language ?? 'plaintext')

const contributionLoaders: Record<string, () => Promise<unknown>> = {
  css: () => import('monaco-editor/esm/vs/language/css/monaco.contribution.js'),
  html: () => import('monaco-editor/esm/vs/language/html/monaco.contribution.js'),
  ini: () => import('monaco-editor/esm/vs/basic-languages/ini/ini.contribution.js'),
  javascript: () => import('monaco-editor/esm/vs/language/typescript/monaco.contribution.js'),
  json: () => import('monaco-editor/esm/vs/language/json/monaco.contribution.js'),
  markdown: () => import('monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js'),
  python: () => import('monaco-editor/esm/vs/basic-languages/python/python.contribution.js'),
  typescript: () => import('monaco-editor/esm/vs/language/typescript/monaco.contribution.js'),
  yaml: () => import('monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js'),
}
const loadedContributions = new Map<string, Promise<void>>()

function selectFile(path: string) {
  if (path !== props.modelValue) {
    emit('update:modelValue', path)
  }
}

function languageFromPath(path: string) {
  const lowerPath = path.toLowerCase()
  if (lowerPath.endsWith('.aimd')) return 'aimd'
  if (lowerPath.endsWith('.toml')) return 'toml'
  if (lowerPath.endsWith('.py')) return 'python'
  if (lowerPath.endsWith('.csv')) return 'csv'
  if (lowerPath.endsWith('.json')) return 'json'
  if (lowerPath.endsWith('.md')) return 'markdown'
  if (lowerPath.endsWith('.yaml') || lowerPath.endsWith('.yml')) return 'yaml'
  return 'plaintext'
}

function ensureMonacoEnvironment() {
  const existing = (globalThis as {
    MonacoEnvironment?: { getWorker?: (moduleId: string, label: string) => Worker }
  }).MonacoEnvironment

  if (typeof existing?.getWorker === 'function') {
    return
  }

  ;(globalThis as {
    MonacoEnvironment?: { getWorker: (moduleId: string, label: string) => Worker }
  }).MonacoEnvironment = {
    getWorker(_: string, label: string) {
      if (label === 'json') return new jsonWorker()
      if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
      if (label === 'typescript' || label === 'javascript') return new tsWorker()
      return new editorWorker()
    },
  }
}

async function ensureLanguageContribution(language: string) {
  const loader = contributionLoaders[language]
  if (!loader) return

  const existingPromise = loadedContributions.get(language)
  if (existingPromise) {
    return existingPromise
  }

  const loadingPromise = Promise.resolve(loader()).then(() => undefined)
  loadedContributions.set(language, loadingPromise)
  return loadingPromise
}

async function ensureEditorLanguage(language: string) {
  if (!monacoModule) return

  if (language === 'aimd') {
    await Promise.all([
      ensureLanguageContribution('markdown'),
      ensureLanguageContribution('python'),
      ensureLanguageContribution('javascript'),
      ensureLanguageContribution('yaml'),
    ])
    registerAimdLanguage(monacoModule)
    return
  }

  if (language === 'toml') {
    registerTomlLanguage(monacoModule)
    return
  }

  if (language === 'csv') {
    registerCsvLanguage(monacoModule)
    return
  }

  await ensureLanguageContribution(language)
}

function registerAimdLanguage(monaco: typeof Monaco) {
  if (!monaco.languages.getLanguages().some((language) => language.id === 'aimd')) {
    monaco.languages.register({
      id: 'aimd',
      extensions: ['.aimd'],
      aliases: ['AIMD', 'Airalogy Markdown'],
      mimetypes: ['text/x-aimd'],
    })
    monaco.languages.setLanguageConfiguration('aimd', aimdConf as Monaco.languages.LanguageConfiguration)
    monaco.languages.setMonarchTokensProvider('aimd', aimdLanguage as Monaco.languages.IMonarchLanguage)
  }

  defineProtocolTheme(monaco)
}

function registerTomlLanguage(monaco: typeof Monaco) {
  if (monaco.languages.getLanguages().some((language) => language.id === 'toml')) {
    return
  }

  monaco.languages.register({
    id: 'toml',
    extensions: ['.toml'],
    aliases: ['TOML', 'toml'],
    mimetypes: ['application/toml', 'text/x-toml'],
  })
  monaco.languages.setLanguageConfiguration('toml', {
    comments: { lineComment: '#' },
    brackets: [
      ['[', ']'],
      ['{', '}'],
    ],
    autoClosingPairs: [
      { open: '[', close: ']' },
      { open: '{', close: '}' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  })
  monaco.languages.setMonarchTokensProvider('toml', {
    defaultToken: '',
    tokenizer: {
      root: [
        [/^\s*#.*$/, 'comment'],
        [/^\s*\[\[?[^\]]+\]?\]/, 'type.identifier'],
        [/^[\w.-]+(?=\s*=)/, 'attribute.name'],
        [/=/, 'delimiter'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/'[^']*'/, 'string'],
        [/\b(true|false)\b/, 'constant.language'],
        [/\b\d{4}-\d{2}-\d{2}(?:[Tt ][\d:.+-]+)?\b/, 'number'],
        [/[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],
      ],
    },
  })
}

function registerCsvLanguage(monaco: typeof Monaco) {
  if (monaco.languages.getLanguages().some((language) => language.id === 'csv')) {
    return
  }

  monaco.languages.register({
    id: 'csv',
    extensions: ['.csv'],
    aliases: ['CSV', 'csv'],
    mimetypes: ['text/csv'],
  })
  monaco.languages.setMonarchTokensProvider('csv', {
    tokenizer: {
      root: [
        [/"(?:[^"]|"")*"/, 'string'],
        [/,/, 'delimiter'],
        [/[^,\r\n]+/, ''],
      ],
    },
  })
}

function defineProtocolTheme(monaco: typeof Monaco) {
  monaco.editor.defineTheme('protocol-source-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'punctuation.definition.begin.aimd', foreground: '2563eb', fontStyle: 'bold' },
      { token: 'punctuation.definition.end.aimd', foreground: '2563eb', fontStyle: 'bold' },
      { token: 'keyword.variable.aimd', foreground: '166534', fontStyle: 'bold' },
      { token: 'keyword.variable-table.aimd', foreground: '166534', fontStyle: 'bold' },
      { token: 'keyword.step.aimd', foreground: '1d4ed8', fontStyle: 'bold' },
      { token: 'keyword.checkpoint.aimd', foreground: '9a3412', fontStyle: 'bold' },
      { token: 'keyword.reference.step.aimd', foreground: '6d28d9' },
      { token: 'keyword.reference.variable.aimd', foreground: '6d28d9' },
      { token: 'delimiter.pipe.aimd', foreground: '64748b' },
      { token: 'delimiter.parameter.aimd', foreground: '64748b' },
      { token: 'delimiter.colon.aimd', foreground: '64748b' },
      { token: 'support.type.aimd', foreground: '7c3aed' },
      { token: 'constant.numeric.aimd', foreground: 'b45309' },
      { token: 'string.quoted.aimd', foreground: 'be123c' },
      { token: 'variable.other.aimd', foreground: '0f766e' },
      { token: 'keyword.other.subvars.aimd', foreground: '4338ca', fontStyle: 'bold' },
      { token: 'attribute.name', foreground: '0f766e' },
      { token: 'type.identifier', foreground: '1d4ed8', fontStyle: 'bold' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#243b53',
      'editorGutter.background': '#f8fafc',
      'editorLineNumber.foreground': '#9fb3c8',
      'editorLineNumber.activeForeground': '#486581',
      'editorCursor.foreground': '#2563eb',
      'editor.selectionBackground': '#dbeafe',
      'editor.inactiveSelectionBackground': '#e0f2fe',
      'editor.lineHighlightBackground': '#f8fafc',
    },
  })
}

async function createEditor() {
  if (!editorContainer.value || !monacoModule || monacoEditor) {
    return
  }

  await ensureEditorLanguage(selectedLanguage.value)
  monacoModel = monacoModule.editor.createModel(selectedContent.value, selectedLanguage.value)
  monacoEditor = monacoModule.editor.create(editorContainer.value, {
    model: monacoModel,
    theme: 'protocol-source-light',
    readOnly: true,
    domReadOnly: true,
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 12,
    lineNumbers: 'on',
    padding: { top: 12, bottom: 12 },
    renderLineHighlight: 'line',
    renderWhitespace: 'selection',
    scrollBeyondLastLine: false,
    tabSize: 2,
    wordWrap: 'on',
  })
}

async function updateEditorLanguage(language: string) {
  if (!monacoModule || !monacoModel) return

  await ensureEditorLanguage(language)
  monacoModule.editor.setModelLanguage(monacoModel, language)
}

function updateEditorContent(content: string) {
  if (!monacoModel || content === monacoModel.getValue()) {
    return
  }

  isSyncingModel = true
  monacoModel.setValue(content)
  isSyncingModel = false
}

onMounted(async () => {
  try {
    loading.value = true
    ensureMonacoEnvironment()
    monacoModule = await import('monaco-editor')
    defineProtocolTheme(monacoModule)
    await createEditor()
  } catch {
    loadFailed.value = true
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  monacoEditor?.dispose()
  monacoModel?.dispose()
  monacoEditor = null
  monacoModel = null
})

watch(normalizedFiles, (files) => {
  if (files.length === 0) {
    emit('update:modelValue', '')
    return
  }

  if (!files.some((file) => file.path === props.modelValue)) {
    emit('update:modelValue', files[0].path)
  }
}, { immediate: true })

watch(selectedContent, (content) => {
  if (!isSyncingModel) {
    updateEditorContent(content)
  }
})

watch(selectedLanguage, (language) => {
  void updateEditorLanguage(language)
})
</script>

<template>
  <div class="protocol-source-browser">
    <aside class="protocol-source-browser__tree" :aria-label="labels.files">
      <div class="protocol-source-browser__root">
        <span class="protocol-source-browser__glyph protocol-source-browser__glyph--folder" aria-hidden="true"></span>
        <span>{{ rootLabel }}</span>
      </div>
      <template v-if="sourceTreeRows.length > 0">
        <template v-for="row in sourceTreeRows" :key="row.key">
          <button
            v-if="row.type === 'file' && row.file"
            :class="{ active: modelValue === row.file.path }"
            :style="{ paddingLeft: `${10 + row.depth * 16}px` }"
            class="protocol-source-browser__node protocol-source-browser__node--file"
            type="button"
            @click="selectFile(row.file.path)"
          >
            <span class="protocol-source-browser__glyph protocol-source-browser__glyph--file" aria-hidden="true"></span>
            <span>{{ row.label }}</span>
          </button>
          <div
            v-else
            :style="{ paddingLeft: `${10 + row.depth * 16}px` }"
            class="protocol-source-browser__node protocol-source-browser__node--folder"
          >
            <span class="protocol-source-browser__glyph protocol-source-browser__glyph--folder" aria-hidden="true"></span>
            <span>{{ row.label }}</span>
          </div>
        </template>
      </template>
      <div v-else class="protocol-source-browser__empty">{{ labels.empty }}</div>
    </aside>

    <div class="protocol-source-browser__viewer">
      <div class="protocol-source-browser__path">
        <span>{{ selectedRelativePath }}</span>
        <span>{{ selectedDisplayPath }}</span>
      </div>
      <div class="protocol-source-browser__editor-shell">
        <div v-if="loading" class="protocol-source-browser__loading">{{ labels.loading }}</div>
        <pre v-if="loadFailed" class="protocol-source-browser__fallback"><code>{{ selectedContent }}</code></pre>
        <div v-else ref="editorContainer" class="protocol-source-browser__editor"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.protocol-source-browser {
  display: grid;
  grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
}

.protocol-source-browser__tree {
  overflow: auto;
  min-width: 0;
  max-height: 65vh;
  padding: 8px;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #ffffff;
}

.protocol-source-browser__root,
.protocol-source-browser__node {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 32px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #334e68;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  text-align: left;
}

.protocol-source-browser__root {
  padding: 0 10px;
  color: #243b53;
  font-weight: 700;
}

.protocol-source-browser__node--file {
  cursor: pointer;
}

.protocol-source-browser__node--file:hover {
  background: #f0f4f8;
}

.protocol-source-browser__node--file.active {
  background: #e6f4ea;
  color: #276749;
  font-weight: 700;
}

.protocol-source-browser__root span:last-child,
.protocol-source-browser__node span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.protocol-source-browser__glyph {
  position: relative;
  flex: 0 0 auto;
  width: 14px;
  height: 12px;
  border: 1.5px solid currentColor;
  border-radius: 2px;
  opacity: 0.72;
}

.protocol-source-browser__glyph--folder::before {
  position: absolute;
  top: -5px;
  left: -1.5px;
  width: 7px;
  height: 4px;
  border: 1.5px solid currentColor;
  border-bottom: 0;
  border-radius: 2px 2px 0 0;
  background: #ffffff;
  content: "";
}

.protocol-source-browser__glyph--file {
  height: 15px;
  border-radius: 2px;
}

.protocol-source-browser__glyph--file::before {
  position: absolute;
  top: -1.5px;
  right: -1.5px;
  width: 5px;
  height: 5px;
  border-left: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  background: #ffffff;
  content: "";
}

.protocol-source-browser__empty {
  padding: 8px 10px;
  color: #829ab1;
  font-size: 12px;
}

.protocol-source-browser__viewer {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.protocol-source-browser__path {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  color: #627d98;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 12px;
}

.protocol-source-browser__path span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.protocol-source-browser__path span:first-child {
  color: #243b53;
  font-weight: 700;
}

.protocol-source-browser__path span:last-child {
  text-align: right;
}

.protocol-source-browser__editor-shell {
  position: relative;
  overflow: hidden;
  min-height: 460px;
  max-height: 65vh;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #ffffff;
}

.protocol-source-browser__editor {
  min-height: 460px;
  height: 65vh;
}

.protocol-source-browser__loading {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.82);
  color: #486581;
  font-size: 13px;
  font-weight: 650;
}

.protocol-source-browser__fallback {
  overflow: auto;
  min-height: 460px;
  max-height: 65vh;
  margin: 0;
  padding: 14px;
  background: #111827;
  color: #dbeafe;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
}

@media (max-width: 1100px) {
  .protocol-source-browser {
    grid-template-columns: 1fr;
  }

  .protocol-source-browser__tree {
    max-height: 260px;
  }
}
</style>
