<script setup lang="ts">
import { computed, getCurrentInstance, reactive, ref, watch, watchEffect } from 'vue'
import { parseAndExtract } from '@airalogy/aimd-renderer'
import {
  AimdEditorToolbar,
  AimdFieldDialog,
  AimdWysiwygEditor,
  createAimdEditorMessages,
  createAimdFieldTypes,
  createMdToolbarItems,
  getQuickAimdSyntax,
  useEditorContent,
} from '@airalogy/aimd-editor/vue'
import type { AimdVarTypePresetOption } from '@airalogy/aimd-editor/vue'
import type { ExtractedAimdFields } from '@airalogy/aimd-core/types'
import type { AimdComponentRenderer } from '@airalogy/aimd-renderer'
import type { AimdRecorderMessagesInput } from '../locales'
import type {
  AimdFieldMeta,
  AimdFieldState,
  AimdProtocolRecordData,
  AimdRecorderFieldAdapters,
  AimdStepDetailDisplay,
  AimdTypePlugin,
  FieldEventPayload,
  TableEventPayload,
} from '../types'
import {
  cloneRecordData,
  getRecordDataSignature,
  normalizeIncomingRecord,
  applyIncomingRecord,
} from '../composables/useRecordState'
import { createEmptyProtocolRecordData } from '../types'
import {
  createRecorderMilkdownPlugins,
  type RecorderMilkdownFieldIdentity,
  type RecorderMilkdownSurfaceState,
} from './recorderMilkdownPlugin'

const RECORDER_EDITABLE_FIELD_TYPES = ['var', 'var_table', 'quiz', 'step', 'check'] as const
const RECORDER_EDITABLE_FIELD_SET = new Set<string>(RECORDER_EDITABLE_FIELD_TYPES)
const recorderEditableFieldTypesList = [...RECORDER_EDITABLE_FIELD_TYPES]

const props = withDefaults(defineProps<{
  content: string
  modelValue?: Partial<AimdProtocolRecordData>
  minHeight?: number
  locale?: string
  readonly?: boolean
  currentUserName?: string
  now?: Date | string | number
  messages?: AimdRecorderMessagesInput
  stepDetailDisplay?: AimdStepDetailDisplay
  fieldMeta?: Record<string, AimdFieldMeta>
  fieldState?: Record<string, AimdFieldState>
  wrapField?: (fieldKey: string, fieldType: string, defaultVNode: any) => any
  customRenderers?: Partial<Record<string, AimdComponentRenderer>>
  fieldAdapters?: AimdRecorderFieldAdapters
  resolveFile?: (src: string) => string | null
  typePlugins?: AimdTypePlugin[]
  enableBlockHandle?: boolean
}>(), {
  modelValue: undefined,
  minHeight: 560,
  locale: undefined,
  readonly: false,
  currentUserName: undefined,
  now: undefined,
  messages: undefined,
  stepDetailDisplay: 'auto',
  fieldMeta: undefined,
  fieldState: undefined,
  wrapField: undefined,
  customRenderers: undefined,
  fieldAdapters: undefined,
  resolveFile: undefined,
  typePlugins: undefined,
  enableBlockHandle: true,
})

const emit = defineEmits<{
  (e: 'update:content', value: string): void
  (e: 'update:modelValue', value: AimdProtocolRecordData): void
  (e: 'ready', editor: { milkdown?: any }): void
  (e: 'fields-change', fields: ExtractedAimdFields): void
  (e: 'error', message: string): void
  (e: 'field-change', payload: FieldEventPayload): void
  (e: 'field-blur', payload: FieldEventPayload): void
  (e: 'assigner-request', payload: FieldEventPayload): void
  (e: 'assigner-cancel', payload: FieldEventPayload): void
  (e: 'table-add-row', payload: TableEventPayload): void
  (e: 'table-remove-row', payload: TableEventPayload): void
  (e: 'edit-field', field: RecorderMilkdownFieldIdentity): void
  (e: 'delete-field', field: RecorderMilkdownFieldIdentity): void
}>()

const resolvedEditorMessages = computed(() => createAimdEditorMessages(props.locale))
const localizedFieldTypes = computed(() => (
  createAimdFieldTypes(resolvedEditorMessages.value)
    .filter(fieldType => RECORDER_EDITABLE_FIELD_SET.has(fieldType.type))
))
const localizedMdToolbarItems = computed(() => createMdToolbarItems(resolvedEditorMessages.value))
const dropCursorLabel = computed(() => ((props.locale || '').toLowerCase().startsWith('zh') ? '拖到这里' : 'Drop here'))
const surfaceCssVars = computed(() => ({
  '--aimd-recorder-drop-label': JSON.stringify(dropCursorLabel.value),
}))
const dialogVarTypePlugins = computed<AimdVarTypePresetOption[]>(() => (
  (props.typePlugins ?? []).map(plugin => ({
    key: plugin.type,
    value: plugin.type,
    label: plugin.type,
    desc: '',
  }))
))

const {
  content,
  syncFromProp,
  insertTextIntoActiveEditor,
  handleMdAction,
  onMilkdownMarkdownUpdated,
  onMilkdownReady,
} = useEditorContent({
  initialContent: props.content,
  initialMode: 'wysiwyg',
  resolvedMessages: resolvedEditorMessages,
  emitModelValue: value => emit('update:content', value),
  emitMode: () => {},
})

watch(() => props.content, (value) => {
  syncFromProp(value)
})

watch(content, (value) => {
  try {
    emit('fields-change', parseAndExtract(value))
  } catch (error) {
    emit('error', error instanceof Error ? error.message : String(error))
  }
}, { immediate: true })

const recordState = reactive(createEmptyProtocolRecordData())

watch(() => props.modelValue, (value) => {
  const normalized = normalizeIncomingRecord(value)
  if (getRecordDataSignature(normalized) === getRecordDataSignature(recordState)) {
    return
  }

  applyIncomingRecord(recordState, normalized)
}, { deep: true, immediate: true })

function handleRecordUpdate(value: AimdProtocolRecordData) {
  applyIncomingRecord(recordState, value)
  emit('update:modelValue', cloneRecordData(recordState))
}

const surfaceState = reactive<RecorderMilkdownSurfaceState>({
  record: recordState,
  readonly: props.readonly,
  currentUserName: props.currentUserName,
  now: props.now,
  locale: props.locale,
  messages: props.messages,
  stepDetailDisplay: props.stepDetailDisplay,
  fieldMeta: props.fieldMeta,
  fieldState: props.fieldState,
  wrapField: props.wrapField,
  customRenderers: props.customRenderers,
  fieldAdapters: props.fieldAdapters,
  resolveFile: props.resolveFile,
  typePlugins: props.typePlugins,
  onUpdateRecord: handleRecordUpdate,
  onError: (message) => emit('error', message),
  onFieldChange: (payload) => emit('field-change', payload),
  onFieldBlur: (payload) => emit('field-blur', payload),
  onAssignerRequest: (payload) => emit('assigner-request', payload),
  onAssignerCancel: (payload) => emit('assigner-cancel', payload),
  onTableAddRow: (payload) => emit('table-add-row', payload),
  onTableRemoveRow: (payload) => emit('table-remove-row', payload),
})

watchEffect(() => {
  surfaceState.readonly = props.readonly
  surfaceState.currentUserName = props.currentUserName
  surfaceState.now = props.now
  surfaceState.locale = props.locale
  surfaceState.messages = props.messages
  surfaceState.stepDetailDisplay = props.stepDetailDisplay
  surfaceState.fieldMeta = props.fieldMeta
  surfaceState.fieldState = props.fieldState
  surfaceState.wrapField = props.wrapField
  surfaceState.customRenderers = props.customRenderers
  surfaceState.fieldAdapters = props.fieldAdapters
  surfaceState.resolveFile = props.resolveFile
  surfaceState.typePlugins = props.typePlugins
})

const instance = getCurrentInstance()
const recorderMilkdownPlugins = [
  ...createRecorderMilkdownPlugins({
    appContext: instance?.appContext ?? null,
    surfaceState,
    onEditField: field => emit('edit-field', field),
    onDeleteField: field => emit('delete-field', field),
  }),
]

const refSuggestions = computed(() => {
  try {
    const fields = parseAndExtract(content.value)
    return [...(fields.step || []), ...(fields.var || [])]
  } catch {
    return []
  }
})

const showAimdDialog = ref(false)
const aimdDialogType = ref<string>('var')

function openAimdDialog(type: string) {
  aimdDialogType.value = RECORDER_EDITABLE_FIELD_SET.has(type) ? type : 'var'
  showAimdDialog.value = true
}

function quickInsertAimd(type: string) {
  if (!RECORDER_EDITABLE_FIELD_SET.has(type)) {
    return
  }

  insertTextIntoActiveEditor(getQuickAimdSyntax(type, resolvedEditorMessages.value))
}

function onDialogInsert(syntax: string) {
  insertTextIntoActiveEditor(syntax)
}

function handleWysiwygReady(editor: any) {
  onMilkdownReady(editor)
  emit('ready', { milkdown: editor })
}

const wysiwygEditorRef = ref<InstanceType<typeof AimdWysiwygEditor> | null>(null)

defineExpose({
  getEditor: () => wysiwygEditorRef.value?.getEditor?.(),
})
</script>

<template>
  <div class="aimd-recorder-wysiwyg-surface" :style="surfaceCssVars">
    <AimdEditorToolbar
      :show-top-bar="false"
      :show-md-toolbar="true"
      :show-aimd-toolbar="true"
      editor-mode="wysiwyg"
      :resolved-messages="resolvedEditorMessages"
      :localized-field-types="localizedFieldTypes"
      :localized-md-toolbar-items="localizedMdToolbarItems"
      @md-action="handleMdAction"
      @open-aimd-dialog="openAimdDialog"
      @quick-insert-aimd="quickInsertAimd"
    />

    <AimdWysiwygEditor
      ref="wysiwygEditorRef"
      :content="content"
      :min-height="minHeight"
      :enable-block-handle="enableBlockHandle"
      :active="true"
      :readonly="readonly"
      :resolved-messages="resolvedEditorMessages"
      :localized-field-types="localizedFieldTypes"
      :milkdown-plugins="recorderMilkdownPlugins"
      @markdown-updated="onMilkdownMarkdownUpdated"
      @ready="handleWysiwygReady"
      @open-aimd-dialog="openAimdDialog"
    />

    <AimdFieldDialog
      :visible="showAimdDialog"
      :initial-type="aimdDialogType"
      :messages="resolvedEditorMessages"
      :ref-suggestions="refSuggestions"
      :var-type-plugins="dialogVarTypePlugins"
      :allowed-types="recorderEditableFieldTypesList"
      @update:visible="showAimdDialog = $event"
      @insert="onDialogInsert"
    />
  </div>
</template>

<style scoped>
.aimd-recorder-wysiwyg-surface {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-editor-wysiwyg-mode) {
  position: relative;
  border: 1px solid #e0e7f1;
  border-top: 0;
  border-radius: 0 0 8px 8px;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node) {
  position: relative;
  display: inline-flex;
  max-width: 100%;
  flex-direction: column;
  gap: 0;
  margin: 6px 2px;
  vertical-align: middle;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node--block) {
  display: flex;
  width: 100%;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node__chrome) {
  position: absolute;
  top: -12px;
  right: -2px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 4px 6px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
  color: #58708d;
  font-size: 11px;
  line-height: 1.2;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-4px);
  transition:
    opacity 0.16s ease,
    transform 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    background 0.16s ease;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node__chrome--inline) {
  padding: 3px 5px;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node__chrome--block) {
  top: 10px;
  right: 10px;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node__summary) {
  max-width: 180px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node__chrome--inline .aimd-recorder-wysiwyg-node__summary) {
  display: none;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node__actions) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node__action) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 8px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 999px;
  background: rgba(248, 250, 252, 0.96);
  color: #36506a;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node__action:hover:not([disabled])) {
  border-color: rgba(59, 130, 246, 0.35);
  background: #fff;
  color: #17375a;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node__action[disabled]) {
  cursor: not-allowed;
  opacity: 0.45;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node__action--danger) {
  color: #b93855;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node__drag) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  min-height: 24px;
  padding: 0 7px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 999px;
  background: rgba(248, 250, 252, 0.96);
  color: #7b8ea3;
  cursor: grab;
  user-select: none;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node__drag:hover) {
  border-color: rgba(59, 130, 246, 0.35);
  background: #fff;
  color: #36506a;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node__body) {
  min-width: 0;
  max-width: 100%;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node:hover .aimd-recorder-wysiwyg-node__chrome),
.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node--selected .aimd-recorder-wysiwyg-node__chrome),
.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node:focus-within .aimd-recorder-wysiwyg-node__chrome) {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node--selected .aimd-recorder-wysiwyg-node__chrome) {
  border-color: rgba(122, 167, 255, 0.75);
  background: rgba(238, 245, 255, 0.98);
  box-shadow: 0 14px 28px rgba(47, 111, 237, 0.14);
}

:global(.aimd-recorder-dropcursor) {
  position: absolute;
  z-index: 70;
  pointer-events: none;
  border-radius: 999px;
  background: linear-gradient(180deg, #60a5fa 0%, #2563eb 100%);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.95),
    0 0 0 5px rgba(37, 99, 235, 0.14),
    0 10px 22px rgba(37, 99, 235, 0.2);
}

:global(.aimd-recorder-dropcursor.prosemirror-dropcursor-block) {
  min-height: 4px;
}

:global(.aimd-recorder-dropcursor.prosemirror-dropcursor-block::after) {
  content: var(--aimd-recorder-drop-label, "Drop here");
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  padding: 2px 8px;
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 999px;
  background: rgba(239, 246, 255, 0.96);
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

:global(.aimd-recorder-dropcursor.prosemirror-dropcursor-inline) {
  min-width: 4px;
  border-radius: 999px;
}
</style>
