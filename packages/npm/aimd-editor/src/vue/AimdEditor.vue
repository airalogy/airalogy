<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import type { Editor } from '@milkdown/kit/core'
import { replaceAll, getMarkdown } from '@milkdown/kit/utils'
import { protectAimdInlineTemplates } from '@airalogy/aimd-core'
import { parseAndExtract } from '@airalogy/aimd-renderer'

import '@milkdown/theme-nord/style.css'
import '@milkdown/kit/prose/tables/style/tables.css'

// Internal
import AimdFieldDialog from './AimdFieldDialog.vue'
import AimdEditorToolbar from './AimdEditorToolbar.vue'
import AimdSourceEditor from './AimdSourceEditor.vue'
import AimdWysiwygEditor from './AimdWysiwygEditor.vue'
import { createAimdEditorMessages } from './locales'
import {
  createAimdFieldTypes,
  createMdToolbarItems,
  getQuickAimdSyntax,
  type AimdEditorProps,
} from './types'
import { useEditorContent } from './useEditorContent'

const props = withDefaults(defineProps<AimdEditorProps>(), {
  modelValue: '',
  messages: () => ({}),
  mode: 'source',
  theme: 'aimd-light',
  showTopBar: true,
  showToolbar: true,
  showAimdToolbar: true,
  showMdToolbar: true,
  enableBlockHandle: true,
  enableSlashMenu: true,
  keepInactiveEditorsMounted: true,
  minHeight: 500,
  readonly: false,
  monacoOptions: () => ({}),
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:mode', mode: 'source' | 'wysiwyg'): void
  (e: 'ready', editor: { monaco?: any; milkdown?: Editor }): void
}>()

// --- Resolved messages ---
const resolvedMessages = computed(() => createAimdEditorMessages(props.locale, props.messages))

// --- Composable for content/mode/insertion logic ---
const {
  editorMode,
  content,
  commitUserContent,
  monacoEditor,
  monacoInstance,
  milkdownEditorRef,
  extractedFields,
  toMilkdownMarkdown,
  switchMode,
  syncFromProp,
  insertTextIntoActiveEditor,
  handleMdAction,
  onMilkdownMarkdownUpdated,
  onMilkdownReady: composableOnMilkdownReady,
} = useEditorContent({
  initialContent: props.modelValue,
  initialMode: props.mode,
  resolvedMessages,
  emitModelValue: (val) => emit('update:modelValue', val),
  emitMode: (mode) => emit('update:mode', mode),
})

// Sync external modelValue changes
watch(() => props.modelValue, (val) => syncFromProp(val))

// Sync external mode changes
watch(() => props.mode, (m) => {
  if (m !== editorMode.value) switchMode(m)
})

// --- Theme ---
const currentTheme = ref(props.theme)
function toggleTheme() {
  currentTheme.value = currentTheme.value === 'aimd-light' ? 'aimd-dark' : 'aimd-light'
}

const shouldMountSourceEditor = computed(() => props.keepInactiveEditorsMounted || editorMode.value === 'source')
const shouldMountWysiwygEditor = computed(() => props.keepInactiveEditorsMounted || editorMode.value === 'wysiwyg')

// --- Computed toolbar items ---
const localizedFieldTypes = computed(() => createAimdFieldTypes(resolvedMessages.value))
const localizedMdToolbarItems = computed(() => createMdToolbarItems(resolvedMessages.value))

// --- AIMD Dialog ---
const showAimdDialog = ref(false)
const aimdDialogType = ref('var')

const refSuggestions = computed(() => {
  const fields = extractedFields.value
  if (!fields) return []
  const type = aimdDialogType.value
  if (type === 'ref_step') return fields.step || []
  if (type === 'ref_var') return fields.var || []
  if (type === 'ref_fig') return fields.ref_fig || []
  return []
})

const existingQuizIds = computed(() => {
  const fields = extractedFields.value
  if (!fields?.quiz) return []
  return fields.quiz.map(q => q.id)
})

function openAimdDialog(type: string) {
  aimdDialogType.value = type
  showAimdDialog.value = true
}

function quickInsertAimd(type: string) {
  insertTextIntoActiveEditor(getQuickAimdSyntax(type, resolvedMessages.value))
}

function onDialogInsert(syntax: string) {
  insertTextIntoActiveEditor(syntax)
}

// --- Source editor refs ---
const sourceEditorRef = ref<InstanceType<typeof AimdSourceEditor> | null>(null)
const wysiwygEditorRef = ref<InstanceType<typeof AimdWysiwygEditor> | null>(null)

function onSourceContentChange(val: string) {
  commitUserContent(val)
}

function onSourceReady(editor: any) {
  emit('ready', { monaco: editor })
}

function onSourceMonacoLoaded(monaco: any, editor: any) {
  monacoInstance.value = monaco
  monacoEditor.value = editor
}

function onWysiwygReady(editor: Editor) {
  composableOnMilkdownReady(editor)
  emit('ready', { milkdown: editor })
}

// Expose for external access (same public API)
defineExpose({
  getContent: () => content.value,
  setContent: (val: string) => {
    content.value = val
    if (editorMode.value === 'source' && monacoEditor.value) {
      monacoEditor.value.setValue(val)
    } else if (milkdownEditorRef.value) {
      try { milkdownEditorRef.value.action(replaceAll(toMilkdownMarkdown(val))) } catch {}
    }
  },
  getMode: () => editorMode.value,
  setMode: (mode: 'source' | 'wysiwyg') => switchMode(mode),
  getMonacoEditor: () => monacoEditor.value,
  getMilkdownEditor: () => milkdownEditorRef.value,
  insertText: insertTextIntoActiveEditor,
})
</script>

<template>
  <div class="aimd-editor">
    <!-- Unified toolbar: mode switch + markdown + aimd -->
    <AimdEditorToolbar
      v-if="showToolbar"
      :show-top-bar="showTopBar"
      :show-md-toolbar="showMdToolbar"
      :show-aimd-toolbar="showAimdToolbar"
      :editor-mode="editorMode"
      :resolved-messages="resolvedMessages"
      :localized-field-types="localizedFieldTypes"
      :localized-md-toolbar-items="localizedMdToolbarItems"
      @switch-mode="switchMode"
      @md-action="handleMdAction"
      @open-aimd-dialog="openAimdDialog"
      @quick-insert-aimd="quickInsertAimd"
    />

    <!-- Editor area -->
      <div class="aimd-editor-panel" :style="{ minHeight: minHeight + 'px' }">
        <!-- Source mode: Monaco -->
      <div v-if="shouldMountSourceEditor" v-show="editorMode === 'source'">
        <AimdSourceEditor
          ref="sourceEditorRef"
          :content="content"
          :theme="currentTheme"
          :min-height="minHeight"
          :readonly="readonly"
          :monaco-options="monacoOptions"
          :resolved-messages="resolvedMessages"
          @content-change="onSourceContentChange"
          @ready="onSourceReady"
          @monaco-loaded="onSourceMonacoLoaded"
        />
      </div>

      <!-- WYSIWYG mode: Milkdown -->
      <div v-if="shouldMountWysiwygEditor" v-show="editorMode === 'wysiwyg'">
        <AimdWysiwygEditor
          ref="wysiwygEditorRef"
          :content="content"
          :min-height="minHeight"
          :enable-block-handle="enableBlockHandle"
          :active="editorMode === 'wysiwyg'"
          :resolved-messages="resolvedMessages"
          :localized-field-types="localizedFieldTypes"
          @markdown-updated="onMilkdownMarkdownUpdated"
          @ready="onWysiwygReady"
          @open-aimd-dialog="openAimdDialog"
        />
      </div>
    </div>

    <!-- AIMD Field Dialog -->
    <AimdFieldDialog
      :visible="showAimdDialog"
      :initial-type="aimdDialogType"
      :messages="resolvedMessages"
      :ref-suggestions="refSuggestions"
      :var-type-plugins="varTypePlugins"
      :existing-quiz-ids="existingQuizIds"
      @update:visible="showAimdDialog = $event"
      @insert="onDialogInsert"
    />
  </div>
</template>

<style>
.aimd-editor {
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

/* --- Unified toolbar --- */
.aimd-editor-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  background: #fafbfc;
  border-bottom: 1px solid #e0e0e0;
  overflow-x: auto;
  flex-wrap: wrap;
}

.aimd-editor-mode-switch {
  display: flex;
  background: #eceef1;
  border-radius: 5px;
  padding: 2px;
  gap: 1px;
  flex-shrink: 0;
}

.aimd-editor-mode-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #777;
  transition: all 0.15s;
  white-space: nowrap;
}

.aimd-editor-mode-btn:hover {
  color: #444;
  background: rgba(255,255,255,0.5);
}

.aimd-editor-mode-btn.active {
  background: #fff;
  color: #1a73e8;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}

.aimd-editor-mode-icon {
  display: flex;
  align-items: center;
}

.aimd-editor-toolbar-sep {
  width: 1px;
  height: 20px;
  background: #ddd;
  margin: 0 4px;
  flex-shrink: 0;
}

.aimd-editor-toolbar-divider {
  width: 1px;
  height: 22px;
  background: #ccc;
  margin: 0 6px;
  flex-shrink: 0;
}

.aimd-editor-fmt-btn {
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: #555;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
  padding: 0;
  flex-shrink: 0;
}

.aimd-editor-fmt-btn:hover {
  background: #eceef1;
  color: #222;
}

.aimd-editor-fmt-btn:active {
  background: #dfe1e5;
}

.aimd-editor-fmt-btn svg {
  width: 16px;
  height: 16px;
  display: block;
}

/* AIMD buttons */
.aimd-editor-aimd-btn {
  width: auto;
  gap: 3px;
  padding: 0 7px;
  border: 1px solid color-mix(in srgb, var(--aimd-color, #2563eb) 18%, transparent);
  background: color-mix(in srgb, var(--aimd-color, #2563eb) 4%, transparent);
  border-radius: 4px;
}

.aimd-editor-aimd-btn:hover {
  background: color-mix(in srgb, var(--aimd-color, #2563eb) 12%, transparent);
  border-color: color-mix(in srgb, var(--aimd-color, #2563eb) 35%, transparent);
  color: var(--aimd-color, #2563eb);
}

.aimd-editor-aimd-btn-icon {
  display: flex;
  align-items: center;
}

.aimd-editor-aimd-btn-icon svg {
  width: 13px;
  height: 13px;
}

.aimd-editor-aimd-btn-label {
  font-size: 11px;
  font-weight: 500;
}

/* --- Editor panel --- */
.aimd-editor-panel {
  background: #fff;
  overflow: hidden;
}

.aimd-editor-source-mode {
  overflow: hidden;
}

.aimd-editor-container {
  height: 100%;
}

.aimd-editor-loading {
  padding: 40px;
  text-align: center;
  color: #888;
}

/* --- WYSIWYG mode (Milkdown) --- */
.aimd-editor-wysiwyg-mode .milkdown {
  height: 100%;
}

.aimd-editor-wysiwyg-mode .milkdown-editor-content {
  padding: 0 20px 6px;
  min-height: 100%;
  outline: none;
  font-size: 15px;
  line-height: 1.8;
}

.aimd-editor-wysiwyg-mode .milkdown-editor-content .ProseMirror {
  outline: none;
}

.aimd-editor-wysiwyg-mode h1 { font-size: 1.8em; margin: 0.6em 0 0.3em; font-weight: 700; }
.aimd-editor-wysiwyg-mode h2 { font-size: 1.4em; margin: 0.5em 0 0.3em; color: #333; font-weight: 600; border-bottom: 1px solid #eee; padding-bottom: 0.2em; }
.aimd-editor-wysiwyg-mode h3 { font-size: 1.2em; margin: 0.4em 0 0.2em; font-weight: 600; }
.aimd-editor-wysiwyg-mode p { margin: 0.5em 0; }
.aimd-editor-wysiwyg-mode blockquote { border-left: 4px solid #dfe2e5; padding: 8px 16px; margin: 8px 0; color: #666; background: #fafafa; border-radius: 0 4px 4px 0; }
.aimd-editor-wysiwyg-mode ul,
.aimd-editor-wysiwyg-mode ol { padding-left: 24px; margin: 4px 0; }
.aimd-editor-wysiwyg-mode code { background: #f0f2f5; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; font-family: 'SF Mono', 'Fira Code', monospace; }
.aimd-editor-wysiwyg-mode pre { background: #1e1e2e; color: #cdd6f4; padding: 16px; border-radius: 8px; overflow-x: auto; }
.aimd-editor-wysiwyg-mode pre code { background: none; padding: 0; color: inherit; }
.aimd-editor-wysiwyg-mode hr { border: none; border-top: 2px solid #e8e8e8; margin: 16px 0; }
.aimd-editor-wysiwyg-mode img { max-width: 100%; border-radius: 4px; }
.aimd-editor-wysiwyg-mode a { color: #1a73e8; text-decoration: none; }
.aimd-editor-wysiwyg-mode a:hover { text-decoration: underline; }
.aimd-editor-wysiwyg-mode li { margin: 2px 0; }
.aimd-editor-wysiwyg-mode .tableWrapper { overflow-x: auto; margin: 12px 0; }

/* Block handle (BlockProvider - follows cursor line) */
.aimd-block-handle {
  position: absolute;
  z-index: 10;
  transition: top 0.15s ease, left 0.15s ease;
}
.aimd-block-handle[data-show="false"] {
  opacity: 0;
  pointer-events: none;
}
.aimd-block-handle-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: #fff;
  border: 1px solid #e0e0e0;
  color: #aaa;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}
.aimd-block-handle-btn:hover {
  background: #f0f2f5;
  border-color: #c0c0c0;
  color: #555;
}

/* Block add menu popup */
.aimd-block-add-menu {
  position: fixed;
  z-index: 10000;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  padding: 4px;
  min-width: 200px;
  max-height: 400px;
  overflow-y: auto;
}
.aimd-block-add-menu-group-label {
  padding: 6px 12px 2px;
  font-size: 11px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.aimd-block-add-menu-divider {
  height: 1px;
  background: #eee;
  margin: 4px 8px;
}
.aimd-block-add-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  text-align: left;
  transition: background 0.1s;
}
.aimd-block-add-menu-item:hover {
  background: #f0f2f5;
}
.aimd-block-add-menu-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: #f0f2f5;
  color: #666;
  flex-shrink: 0;
}

.aimd-block-add-menu-icon svg {
  width: 14px;
  height: 14px;
}

/* ── Table block component (official milkdown style) ── */
.milkdown-table-block {
  display: block;
  margin: 4px 0;
}
.milkdown-table-block table {
  margin: 0 !important;
  border-radius: 0 !important;
}
.milkdown-table-block .handle {
  position: absolute;
  z-index: 50;
  cursor: grab;
  font-size: 14px;
}
.milkdown-table-block .cell-handle {
  left: -999px;
  top: -999px;
  z-index: 100;
  height: 24px;
  transition: opacity 0.2s ease 0.2s;
  background-color: #a8d4ff;
  padding: 0 8px;
  border-radius: 8px;
  position: absolute;
}
.milkdown-table-block .cell-handle[data-role="col-drag-handle"] {
  transform: translateY(50%);
}
.milkdown-table-block .cell-handle[data-role="row-drag-handle"] {
  transform: translateX(50%);
}
.milkdown-table-block .cell-handle[data-show="false"] {
  opacity: 0;
}
.milkdown-table-block .line-handle[data-show="false"] {
  opacity: 0;
}
.milkdown-table-block .handle:hover {
  opacity: 1;
}
.milkdown-table-block .cell-handle .button-group {
  position: absolute;
  height: 30px;
  top: -32px;
  display: flex;
  transform: translateX(-50%);
  left: 50%;
  background-color: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.milkdown-table-block .cell-handle .button-group[data-show="false"] {
  display: none;
}
.milkdown-table-block .cell-handle .button-group button {
  padding-left: 8px;
  padding-right: 8px;
  width: max-content;
  border: none;
  background: none;
  cursor: pointer;
}
.milkdown-table-block .cell-handle .button-group button:hover {
  background-color: #f0f0f0;
}
.milkdown-table-block .line-handle {
  background-color: #a8d4ff;
  transition: opacity 0.2s ease-in-out;
}
.milkdown-table-block .line-handle[data-role="x-line-drag-handle"] {
  height: 2px;
}
.milkdown-table-block .line-handle[data-role="y-line-drag-handle"] {
  width: 2px;
}
.milkdown-table-block .line-handle .add-button {
  color: #1a73e8;
  border: 1px solid #a8d4ff;
  padding: 0 4px;
  border-radius: 8px;
  width: max-content;
  background: #fff;
  cursor: pointer;
}
.milkdown-table-block .line-handle[data-role="x-line-drag-handle"] .add-button {
  position: absolute;
  transform: translateX(-100%);
  top: -12px;
  height: 24px;
}
.milkdown-table-block .line-handle[data-role="y-line-drag-handle"] .add-button {
  position: absolute;
  transform: translateX(-50%);
  top: -24px;
  height: 24px;
}
.milkdown-table-block .line-handle[data-display-type="indicator"] .add-button {
  display: none;
}
.milkdown-table-block .drag-preview {
  position: absolute;
  z-index: 100;
  border: 1px solid #ccc;
  opacity: 0.5;
  display: flex;
  flex-direction: column;
}
.milkdown-table-block .drag-preview table {
  margin: 0;
}
.milkdown-table-block .drag-preview[data-show="false"] {
  display: none;
}

/* Table cell styles */
.aimd-editor-wysiwyg-mode th,
.aimd-editor-wysiwyg-mode td {
  border: 1px solid #ddd;
  padding: 4px 16px;
  position: relative;
}
.aimd-editor-wysiwyg-mode th {
  background: #f5f7fa;
  font-weight: 600;
}
/* Remove browser default blue outline, add custom selection border */
.aimd-editor-wysiwyg-mode .ProseMirror-selectednode {
  outline: none !important;
}
.milkdown-table-block .ProseMirror-selectednode {
  outline: none !important;
  background-color: transparent !important;
}
/* Table cell click selection border */
.aimd-editor-wysiwyg-mode td:has(.ProseMirror-selectednode),
.aimd-editor-wysiwyg-mode th:has(.ProseMirror-selectednode) {
  outline: 1px solid #a8a8a8;
  outline-offset: -1px;
}
.aimd-editor-wysiwyg-mode .selectedCell {
  position: relative;
}
.aimd-editor-wysiwyg-mode .selectedCell::after {
  content: '';
  position: absolute;
  inset: 0;
  background-color: #d5d5d5;
  opacity: 0.4;
  pointer-events: none;
}
.aimd-editor-wysiwyg-mode .selectedCell::selection {
  background: transparent;
}

/* Table button icon sizing */
.milkdown-table-block .cell-handle .button-group button svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}
.milkdown-table-block .cell-handle svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}
.milkdown-table-block .line-handle .add-button svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

/* Placeholder for empty paragraphs */
.aimd-placeholder {
  position: relative;
}
.aimd-placeholder::before {
  content: attr(data-placeholder);
  position: absolute;
  color: #aaa;
  pointer-events: none;
  font-style: italic;
}

/* AIMD inline field chip styles (fallback) */
.aimd-editor-wysiwyg-mode aimd-field {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 8px 1px 6px;
  border-radius: 4px;
  font-size: 13px;
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  line-height: 1.6;
  vertical-align: baseline;
  border: 1px solid rgba(37, 99, 235, 0.2);
  background: rgba(37, 99, 235, 0.05);
  color: #2563eb;
}
</style>
