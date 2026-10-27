<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, reactive, ref, watch, watchEffect } from 'vue'
import { getMarkdown } from '@milkdown/kit/utils'
import { parseAndExtract } from '@airalogy/aimd-renderer'
import { parseVarDefinition } from '@airalogy/aimd-core/parser'
import { collectAimdFieldIds, createAimdFieldId } from '@airalogy/aimd-editor/authoring'
import {
  AimdEditorToolbar,
  AimdFieldDialog,
  AimdInputFieldDialog,
  AimdStepFieldDialog,
  AimdWysiwygEditor,
  createAimdEditorMessages,
  createAimdFieldTypes,
  createMdToolbarItems,
  getQuickAimdSyntax,
  useEditorContent,
} from '@airalogy/aimd-editor/vue'
import type { AimdVarTypePresetOption, AimdEditorImageRequest } from '@airalogy/aimd-editor/vue'
import type { AimdQuizGradeResult, ExtractedAimdFields } from '@airalogy/aimd-core/types'
import type { AimdComponentRenderer } from '@airalogy/aimd-renderer'
import { createAimdRecorderMessages } from '../locales'
import type { AimdRecorderMessagesInput } from '../locales'
import type {
  AimdAssignerMap,
  AimdAssignerRunner,
  AimdChoiceOptionExplanationMode,
  AimdCollectorPermissionHandler,
  AimdCollectorProviderMap,
  AimdServerAssignerMap,
  AimdServerAssignerRunner,
  AimdEntityResolverMap,
  AimdResourceResolverMap,
  AimdFileInfoResolver,
  AimdFileUploadHandler,
  AimdFieldMeta,
  AimdFieldState,
  AimdProtocolRecordData,
  AimdRecordValidationSchema,
  AimdRecorderFieldAdapters,
  AimdRecorderValidationResult,
  AimdRecorderValidationTrigger,
  AimdScaleGradeDisplayMode,
  AimdStepDetailDisplay,
  AimdTypePlugin,
  FieldEventPayload,
  TableEventPayload,
} from '../types'
import {
  matchesAimdValidationFieldSelector,
  validateAimdRecord,
} from '../record/validation'
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
  fieldDisplay?: 'compact' | 'detailed'
  showModeSwitch?: boolean
  imageToolbarAction?: 'markdown' | 'custom'
  currentUserName?: string
  now?: Date | string | number
  messages?: AimdRecorderMessagesInput
  quizGrades?: Record<string, AimdQuizGradeResult | null | undefined>
  submitted?: boolean
  choiceOptionExplanationMode?: AimdChoiceOptionExplanationMode
  scaleGradeDisplayMode?: AimdScaleGradeDisplayMode
  stepDetailDisplay?: AimdStepDetailDisplay
  fieldMeta?: Record<string, AimdFieldMeta>
  serverAssigners?: AimdServerAssignerMap
  /** @deprecated Use `serverAssigners` instead. */
  assigners?: AimdAssignerMap
  fieldState?: Record<string, AimdFieldState>
  validationSchema?: AimdRecordValidationSchema
  validationTriggers?: AimdRecorderValidationTrigger[]
  wrapField?: (fieldKey: string, fieldType: string, defaultVNode: any) => any
  customRenderers?: Partial<Record<string, AimdComponentRenderer>>
  fieldAdapters?: AimdRecorderFieldAdapters
  entityResolvers?: AimdEntityResolverMap
  resourceResolvers?: AimdResourceResolverMap
  collectorProviders?: AimdCollectorProviderMap
  requestCollectorPermission?: AimdCollectorPermissionHandler
  collectorActorId?: string
  collectorRecordKey?: string | number
  resolveFile?: (src: string) => string | null
  resolveFileInfo?: AimdFileInfoResolver
  uploadFile?: AimdFileUploadHandler
  runServerAssigner?: AimdServerAssignerRunner
  /** @deprecated Use `runServerAssigner` instead. */
  assignerRunner?: AimdAssignerRunner
  typePlugins?: AimdTypePlugin[]
  enableBlockHandle?: boolean
}>(), {
  modelValue: undefined,
  minHeight: 560,
  locale: undefined,
  readonly: false,
  fieldDisplay: 'detailed',
  showModeSwitch: false,
  imageToolbarAction: 'markdown',
  currentUserName: undefined,
  now: undefined,
  messages: undefined,
  quizGrades: undefined,
  submitted: false,
  choiceOptionExplanationMode: 'hidden',
  scaleGradeDisplayMode: 'hidden',
  stepDetailDisplay: 'auto',
  fieldMeta: undefined,
  serverAssigners: undefined,
  assigners: undefined,
  fieldState: undefined,
  validationSchema: undefined,
  validationTriggers: () => ['change', 'blur'],
  wrapField: undefined,
  customRenderers: undefined,
  fieldAdapters: undefined,
  entityResolvers: undefined,
  resourceResolvers: undefined,
  collectorProviders: undefined,
  requestCollectorPermission: undefined,
  collectorActorId: undefined,
  collectorRecordKey: undefined,
  resolveFile: undefined,
  resolveFileInfo: undefined,
  uploadFile: undefined,
  runServerAssigner: undefined,
  assignerRunner: undefined,
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
  (e: 'validation', result: AimdRecorderValidationResult): void
  (e: 'edit-field', field: RecorderMilkdownFieldIdentity): void
  (e: 'delete-field', field: RecorderMilkdownFieldIdentity): void
  (e: 'switch-mode', mode: 'source' | 'wysiwyg'): void
  (e: 'request-image', request: AimdEditorImageRequest): void
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
const surfaceRoot = ref<HTMLElement | null>(null)
const internalValidationFieldState = ref<Record<string, AimdFieldState>>({})
const validationEpoch = ref(0)
const resolvedRecorderMessages = computed(() => createAimdRecorderMessages(props.locale, props.messages))
const effectiveFieldState = computed<Record<string, AimdFieldState> | undefined>(() => {
  const external = props.fieldState ?? {}
  const internal = internalValidationFieldState.value
  if (Object.keys(external).length === 0 && Object.keys(internal).length === 0) return undefined

  const merged: Record<string, AimdFieldState> = { ...external }
  for (const [fieldKey, state] of Object.entries(internal)) {
    merged[fieldKey] = { ...merged[fieldKey], ...state }
  }
  return merged
})

function applyValidationResult(result: AimdRecorderValidationResult) {
  const selectors = result.validatedFieldKeys
  if (!selectors?.length) {
    internalValidationFieldState.value = { ...result.fieldState }
    return
  }

  const next = { ...internalValidationFieldState.value }
  for (const fieldKey of Object.keys(next)) {
    if (selectors.some(selector => matchesAimdValidationFieldSelector(fieldKey, selector))) {
      delete next[fieldKey]
    }
  }
  Object.assign(next, result.fieldState)
  internalValidationFieldState.value = next
}

function handleValidation(result: AimdRecorderValidationResult) {
  applyValidationResult(result)
  emit('validation', result)
}

function clearValidation(fieldKey?: string) {
  if (!fieldKey) {
    internalValidationFieldState.value = {}
  }
  else {
    const next = { ...internalValidationFieldState.value }
    for (const existingKey of Object.keys(next)) {
      if (matchesAimdValidationFieldSelector(existingKey, fieldKey)) delete next[existingKey]
    }
    internalValidationFieldState.value = next
  }
  validationEpoch.value += 1
}

function focusInvalidField(fieldKey: string): boolean {
  const exactControl = Array.from(surfaceRoot.value?.querySelectorAll<HTMLElement>('[data-rec-focus-key]') ?? [])
    .find(candidate => candidate.dataset.recFocusKey === fieldKey)
  if (exactControl) {
    exactControl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    exactControl.focus({ preventScroll: true })
    return true
  }
  const field = Array.from(surfaceRoot.value?.querySelectorAll<HTMLElement>('[data-aimd-recorder-field]') ?? [])
    .find(candidate => candidate.dataset.aimdRecorderField === fieldKey)
  if (!field) return false
  field.scrollIntoView({ behavior: 'smooth', block: 'center' })
  field.querySelector<HTMLElement>('input, textarea, select, button, [tabindex]')?.focus({ preventScroll: true })
  return true
}

function focusFirstInvalidField(): boolean {
  const fieldKey = Object.keys(internalValidationFieldState.value)[0]
  return fieldKey ? focusInvalidField(fieldKey) : false
}

async function validate(options: { focus?: boolean } = {}): Promise<AimdRecorderValidationResult> {
  const result = validateAimdRecord(parseAndExtract(content.value), recordState, {
    fieldMeta: props.fieldMeta,
    schema: props.validationSchema,
    messages: resolvedRecorderMessages.value.validation,
  })
  validationEpoch.value += 1
  handleValidation(result)
  if (!result.valid && options.focus !== false) {
    await nextTick()
    focusFirstInvalidField()
  }
  return result
}

async function validateField(
  fieldKey: string,
  options: { focus?: boolean; trigger?: AimdRecorderValidationTrigger } = {},
): Promise<AimdRecorderValidationResult> {
  const result = validateAimdRecord(parseAndExtract(content.value), recordState, {
    fieldMeta: props.fieldMeta,
    schema: props.validationSchema,
    fieldKeys: [fieldKey],
    messages: resolvedRecorderMessages.value.validation,
  })
  validationEpoch.value += 1
  handleValidation(result)
  if (!result.valid && options.focus === true) {
    await nextTick()
    const invalidKey = Object.keys(result.fieldState)[0]
    if (invalidKey) focusInvalidField(invalidKey)
  }
  return result
}

function extractProtocolContext(source: string): string {
  const registryBlocks = source.match(/```(?:connectors|collectors)(?:[^\n]*)\n[\s\S]*?```/g) ?? []
  const stepFields = source.match(/\{\{step\|[\s\S]*?\}\}/g) ?? []
  return [...registryBlocks, ...stepFields].join('\n\n')
}

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
  fieldDisplay: props.fieldDisplay,
  currentUserName: props.currentUserName,
  now: props.now,
  locale: props.locale,
  messages: props.messages,
  quizGrades: props.quizGrades,
  submitted: props.submitted,
  choiceOptionExplanationMode: props.choiceOptionExplanationMode,
  scaleGradeDisplayMode: props.scaleGradeDisplayMode,
  stepDetailDisplay: props.stepDetailDisplay,
  fieldMeta: props.fieldMeta,
  serverAssigners: props.serverAssigners,
  assigners: props.assigners,
  fieldState: effectiveFieldState.value,
  validationSchema: props.validationSchema,
  validationTriggers: props.validationTriggers,
  validationEpoch: validationEpoch.value,
  wrapField: props.wrapField,
  customRenderers: props.customRenderers,
  fieldAdapters: props.fieldAdapters,
  entityResolvers: props.entityResolvers,
  resourceResolvers: props.resourceResolvers,
  collectorProviders: props.collectorProviders,
  requestCollectorPermission: props.requestCollectorPermission,
  collectorActorId: props.collectorActorId,
  collectorRecordKey: props.collectorRecordKey,
  protocolContext: extractProtocolContext(content.value),
  resolveFile: props.resolveFile,
  resolveFileInfo: props.resolveFileInfo,
  uploadFile: props.uploadFile,
  runServerAssigner: props.runServerAssigner,
  assignerRunner: props.assignerRunner,
  typePlugins: props.typePlugins,
  onUpdateRecord: handleRecordUpdate,
  onError: (message) => emit('error', message),
  onFieldChange: (payload) => emit('field-change', payload),
  onFieldBlur: (payload) => emit('field-blur', payload),
  onAssignerRequest: (payload) => emit('assigner-request', payload),
  onAssignerCancel: (payload) => emit('assigner-cancel', payload),
  onTableAddRow: (payload) => emit('table-add-row', payload),
  onTableRemoveRow: (payload) => emit('table-remove-row', payload),
  onValidation: handleValidation,
})

watchEffect(() => {
  surfaceState.readonly = props.readonly
  surfaceState.fieldDisplay = props.fieldDisplay
  surfaceState.currentUserName = props.currentUserName
  surfaceState.now = props.now
  surfaceState.locale = props.locale
  surfaceState.messages = props.messages
  surfaceState.quizGrades = props.quizGrades
  surfaceState.submitted = props.submitted
  surfaceState.choiceOptionExplanationMode = props.choiceOptionExplanationMode
  surfaceState.scaleGradeDisplayMode = props.scaleGradeDisplayMode
  surfaceState.stepDetailDisplay = props.stepDetailDisplay
  surfaceState.fieldMeta = props.fieldMeta
  surfaceState.serverAssigners = props.serverAssigners
  surfaceState.assigners = props.assigners
  surfaceState.fieldState = effectiveFieldState.value
  surfaceState.validationSchema = props.validationSchema
  surfaceState.validationTriggers = props.validationTriggers
  surfaceState.validationEpoch = validationEpoch.value
  surfaceState.wrapField = props.wrapField
  surfaceState.customRenderers = props.customRenderers
  surfaceState.fieldAdapters = props.fieldAdapters
  surfaceState.entityResolvers = props.entityResolvers
  surfaceState.resourceResolvers = props.resourceResolvers
  surfaceState.collectorProviders = props.collectorProviders
  surfaceState.requestCollectorPermission = props.requestCollectorPermission
  surfaceState.collectorActorId = props.collectorActorId
  surfaceState.collectorRecordKey = props.collectorRecordKey
  surfaceState.protocolContext = extractProtocolContext(content.value)
  surfaceState.resolveFile = props.resolveFile
  surfaceState.resolveFileInfo = props.resolveFileInfo
  surfaceState.uploadFile = props.uploadFile
  surfaceState.runServerAssigner = props.runServerAssigner
  surfaceState.assignerRunner = props.assignerRunner
  surfaceState.typePlugins = props.typePlugins
})

const instance = getCurrentInstance()
const recorderMilkdownPlugins = [
  ...createRecorderMilkdownPlugins({
    appContext: instance?.appContext ?? null,
    surfaceState,
    onEditField: (field, apply) => {
      if (props.readonly) return
      if (field.fieldType === 'step' || field.fieldType === 'check') {
        stepDialogType.value = field.fieldType
        stepEdit.value = { content: field.raw.slice(field.raw.indexOf('|') + 1, -2), apply }
        showStepDialog.value = true
        return
      }
      if (field.fieldType !== 'var') { emit('edit-field', field); return }
      const fieldContent = field.raw.slice(field.raw.indexOf('|') + 1, -2)
      if (parseVarDefinition(fieldContent).subvars) { emit('edit-field', field); return }
      inputEdit.value = { content: fieldContent, apply }
      showInputDialog.value = true
    },
    onDeleteField: (field, remove) => {
      if (instance?.vnode.props?.onDeleteField) emit('delete-field', field)
      else remove()
    },
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
const showInputDialog = ref(false)
const inputPreset = ref('str')
const inputEdit = ref<{ content: string; apply: (content: string) => boolean }>()
const showStepDialog = ref(false)
const stepDialogType = ref<'step' | 'check'>('step')
const stepEdit = ref<{ content: string; apply: (content: string) => boolean }>()

function saveStep(value: string) {
  if (props.readonly) return
  if (stepEdit.value) stepEdit.value.apply(value)
  else insertTextIntoActiveEditor(`{{${stepDialogType.value}|${value}}}${stepDialogType.value === 'step' ? '\n\n' : ' '}`)
}

function saveInputField(value: string) {
  if (props.readonly) return
  if (inputEdit.value) {
    const oldId = parseVarDefinition(inputEdit.value.content).id
    const newId = parseVarDefinition(value).id
    if (!inputEdit.value.apply(value)) return
    if (newId !== oldId && Object.prototype.hasOwnProperty.call(recordState.var, oldId)) {
      // Retain the old key as detached data so undoing the rename cannot lose a filled value.
      recordState.var[newId] = cloneRecordData(recordState).var[oldId]
      emit('update:modelValue', cloneRecordData(recordState))
    }
  } else {
    insertTextIntoActiveEditor(`{{var|${value}}}`)
  }
}

function openAimdDialog(type: string) {
  if (props.readonly) return
  if (type === 'step' || type === 'check') {
    stepDialogType.value = type
    stepEdit.value = undefined
    showStepDialog.value = true
    return
  }
  if (type === 'var') {
    insertInput('str')
    return
  }
  aimdDialogType.value = RECORDER_EDITABLE_FIELD_SET.has(type) ? type : 'var'
  showAimdDialog.value = true
}

function insertInput(preset: string) {
  if (props.readonly) return
  inputEdit.value = undefined
  inputPreset.value = preset
  showInputDialog.value = true
}

function quickInsertAimd(type: string) {
  if (props.readonly || !RECORDER_EDITABLE_FIELD_SET.has(type)) {
    return
  }

  insertTextIntoActiveEditor(type === 'var'
    ? `{{var|${createAimdFieldId([...collectAimdFieldIds(content.value), ...Object.keys(recordState.var)])}: str}}`
    : type === 'step'
      ? `{{step|${createAimdFieldId([...collectAimdFieldIds(content.value), ...Object.keys(recordState.step)], 'step')}, check=True}}\n\n`
    : getQuickAimdSyntax(type, resolvedEditorMessages.value))
}

function onDialogInsert(syntax: string) {
  if (props.readonly) return
  insertTextIntoActiveEditor(syntax)
}

function onMdAction(action: string, event: MouseEvent) {
  if (props.readonly) return
  if (action === 'image' && props.imageToolbarAction === 'custom') {
    const rect = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect()
    emit('request-image', { buttonRect: rect ? { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height } : undefined })
    return
  }
  handleMdAction(action)
}

function handleWysiwygReady(editor: any) {
  onMilkdownReady(editor)
  emit('ready', { milkdown: editor })
}

const wysiwygEditorRef = ref<InstanceType<typeof AimdWysiwygEditor> | null>(null)

function switchEditorMode(mode: 'source' | 'wysiwyg') {
  if (mode === 'wysiwyg') return
  const editor = wysiwygEditorRef.value?.getEditor?.()
  if (editor) {
    // Flush the current document before the host unmounts this surface.
    const markdown = editor.action(getMarkdown())
    onMilkdownMarkdownUpdated(null, markdown, content.value)
  }
  emit('switch-mode', mode)
}

defineExpose({
  getEditor: () => wysiwygEditorRef.value?.getEditor?.(),
  insertText: onDialogInsert,
  validate,
  validateField,
  clearValidation,
  focusFirstInvalidField,
})
</script>

<template>
  <div ref="surfaceRoot" class="aimd-recorder-wysiwyg-surface" :class="{ 'aimd-recorder-wysiwyg-surface--compact': fieldDisplay === 'compact' }" :style="surfaceCssVars">
    <AimdEditorToolbar
      :show-top-bar="showModeSwitch"
      :show-md-toolbar="true"
      :show-aimd-toolbar="true"
      editor-mode="wysiwyg"
      :resolved-messages="resolvedEditorMessages"
      :localized-field-types="localizedFieldTypes"
      :localized-md-toolbar-items="localizedMdToolbarItems"
      @md-action="onMdAction"
      @switch-mode="switchEditorMode"
      @open-aimd-dialog="openAimdDialog"
      @quick-insert-aimd="quickInsertAimd"
      @insert-input="insertInput"
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

    <AimdStepFieldDialog v-model:visible="showStepDialog" :field-type="stepDialogType" :content="content" :field-content="stepEdit?.content" :reserved-ids="Object.keys(recordState[stepDialogType])" :messages="resolvedEditorMessages" @save="saveStep" />

    <AimdInputFieldDialog
      v-model:visible="showInputDialog"
      :content="content"
      :field-content="inputEdit?.content"
      :initial-preset="inputPreset"
      :reserved-ids="Object.keys(recordState.var)"
      :messages="resolvedEditorMessages"
      :var-type-plugins="dialogVarTypePlugins"
      @save="saveInputField"
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

.aimd-recorder-wysiwyg-surface--compact :deep(.aimd-recorder-wysiwyg-node__summary) { display: none; }
.aimd-recorder-wysiwyg-surface.aimd-recorder-wysiwyg-surface--compact :deep(.aimd-recorder-wysiwyg-node__chrome),
.aimd-recorder-wysiwyg-surface.aimd-recorder-wysiwyg-surface--compact :deep(.aimd-recorder-wysiwyg-node__action),
.aimd-recorder-wysiwyg-surface.aimd-recorder-wysiwyg-surface--compact :deep(.aimd-recorder-wysiwyg-node__drag) { border-radius: 4px; }
.aimd-recorder-wysiwyg-surface.aimd-recorder-wysiwyg-surface--compact :deep(.aimd-recorder-wysiwyg-node) { margin: 2px; }

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node:has(.aimd-rec-inline--var-stacked--scalar-list, .aimd-code-field, .aimd-markdown-field, .aimd-rec-inline--var-dna, .aimd-rec-inline-table, .aimd-rec-collector)),
.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-field-host:has(.aimd-rec-inline--var-stacked--scalar-list, .aimd-code-field, .aimd-markdown-field, .aimd-rec-inline--var-dna, .aimd-rec-inline-table, .aimd-rec-collector)) {
  display: flex;
  width: 100%;
  max-width: 100%;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node__body:has(.aimd-rec-inline--var-stacked--scalar-list, .aimd-code-field, .aimd-markdown-field, .aimd-rec-inline--var-dna, .aimd-rec-inline-table, .aimd-rec-collector)) {
  width: 100%;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-field-host:has(.aimd-rec-inline--var-stacked--scalar-list, .aimd-code-field, .aimd-markdown-field, .aimd-rec-inline--var-dna, .aimd-rec-inline-table, .aimd-rec-collector) > .aimd-protocol-recorder) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
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

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node.aimd-recorder-wysiwyg-node--step) {
  display: flex;
  width: 100%;
  min-width: 0;
  margin: 8px 0 6px;
  container: aimd-step-authoring / inline-size;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node--step > .aimd-recorder-wysiwyg-node__body) {
  width: 100%;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node--step .aimd-rec-inline--step) {
  margin: 0;
  padding: 8px 12px;
  gap: 8px;
  border: 0;
  border-left: 3px solid #d5a55e;
  border-radius: 0;
  background: #f8fafc;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node--step .aimd-step-field__main) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px 12px;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node--step .aimd-step-field__main-meta) {
  max-width: 100%;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node--step .aimd-rec-inline__check-wrap) {
  flex-wrap: nowrap;
  max-width: 100%;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node--step .aimd-rec-inline__check-wrap > :not(.aimd-step-field__identity)) {
  flex-shrink: 0;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node--step .aimd-step-field__title) {
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: #24292f;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node--step .aimd-step-field__main-actions) {
  margin-left: auto;
  align-items: center;
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node--step .aimd-step-field__toggle) {
  min-height: 28px;
  border-radius: 4px;
  font-size: 12px;
}

@container aimd-step-authoring (max-width: 480px) {
  .aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node--step .aimd-step-field__main) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.aimd-recorder-wysiwyg-surface :deep(.aimd-recorder-wysiwyg-node__chrome) {
  width: max-content;
  white-space: nowrap;
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
  top: auto;
  bottom: calc(100% + 2px);
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
