<script setup lang="ts">
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ExtractedAimdFields } from '@airalogy/aimd-core/types'
import { AimdEditor } from '@airalogy/aimd-editor/vue'
import type { AimdEditorProps } from '@airalogy/aimd-editor/vue'
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
import { createEmptyProtocolRecordData } from '../types'
import {
  getRecordDataSignature,
  normalizeCheckFields,
  normalizeIncomingRecord,
  normalizeQuizFields,
  normalizeStepFields,
  normalizeVarTableFields,
} from '../composables/useRecordState'
import type { AimdWorkbenchFieldDescriptor, AimdWorkbenchFieldType } from '../composables/workbenchFieldEditing'
import {
  appendWorkbenchField,
  deleteWorkbenchField,
  generateNextWorkbenchFieldId,
  insertWorkbenchField,
  moveWorkbenchField,
  scanWorkbenchFields,
  updateWorkbenchFieldRaw,
  updateWorkbenchFieldId,
  updateWorkbenchFieldKind,
  updateWorkbenchVarValueType,
} from '../composables/workbenchFieldEditing'
import AimdRecorder from './AimdRecorder.vue'
import AimdRecorderWysiwygSurface from './AimdRecorderWysiwygSurface.vue'
import type { RecorderMilkdownFieldIdentity } from './recorderMilkdownPlugin'

type WorkbenchEditorProps = Partial<Omit<AimdEditorProps, 'modelValue' | 'mode'>>
type WorkbenchSideTab = 'recorder' | 'structure' | 'record' | 'detached'

const props = withDefaults(defineProps<{
  content?: string
  modelValue?: Partial<AimdProtocolRecordData>
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
  editorMode?: 'source' | 'wysiwyg'
  editorProps?: WorkbenchEditorProps
  editorTitle?: string
  recorderTitle?: string
  recordDataTitle?: string
  detachedDataTitle?: string
  detachedDataDescription?: string
  fieldStructureTitle?: string
  fieldStructureDescription?: string
  showFieldStructure?: boolean
  showVisualEditToggle?: boolean
  initialVisualEditMode?: boolean
  allowRawFieldSourceEditing?: boolean
  showRecordData?: boolean
  showDetachedData?: boolean
  fitViewport?: boolean
  viewportOffset?: number
  editorMinHeight?: number
  recorderMinHeight?: number
}>(), {
  content: '',
  modelValue: undefined,
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
  editorMode: 'source',
  editorProps: undefined,
  editorTitle: undefined,
  recorderTitle: undefined,
  recordDataTitle: undefined,
  detachedDataTitle: undefined,
  detachedDataDescription: undefined,
  fieldStructureTitle: undefined,
  fieldStructureDescription: undefined,
  showFieldStructure: false,
  showVisualEditToggle: true,
  initialVisualEditMode: false,
  allowRawFieldSourceEditing: true,
  showRecordData: false,
  showDetachedData: true,
  fitViewport: true,
  viewportOffset: 24,
  editorMinHeight: 560,
  recorderMinHeight: 560,
})

const emit = defineEmits<{
  (e: 'update:content', value: string): void
  (e: 'update:modelValue', value: AimdProtocolRecordData): void
  (e: 'update:editorMode', mode: 'source' | 'wysiwyg'): void
  (e: 'editor-ready', editor: { monaco?: any, milkdown?: any }): void
  (e: 'fields-change', fields: ExtractedAimdFields): void
  (e: 'error', message: string): void
  (e: 'field-change', payload: FieldEventPayload): void
  (e: 'field-blur', payload: FieldEventPayload): void
  (e: 'assigner-request', payload: FieldEventPayload): void
  (e: 'assigner-cancel', payload: FieldEventPayload): void
  (e: 'table-add-row', payload: TableEventPayload): void
  (e: 'table-remove-row', payload: TableEventPayload): void
}>()

const EMPTY_FIELDS: ExtractedAimdFields = {
  var: [],
  var_definitions: [],
  var_table: [],
  client_assigner: [],
  quiz: [],
  step: [],
  check: [],
  ref_step: [],
  ref_var: [],
  ref_fig: [],
  cite: [],
  fig: [],
}

const editorRef = ref<InstanceType<typeof AimdEditor> | null>(null)
const recorderRef = ref<InstanceType<typeof AimdRecorder> | null>(null)
const workbenchRef = ref<HTMLElement | null>(null)
const editorPanelHeadRef = ref<HTMLElement | null>(null)
const sidePanelHeadRef = ref<HTMLElement | null>(null)
const editorPanelBodyRef = ref<HTMLElement | null>(null)
const sidePanelBodyRef = ref<HTMLElement | null>(null)
const recorderToolbarRef = ref<HTMLElement | null>(null)
const extractedFields = ref<ExtractedAimdFields>(EMPTY_FIELDS)
const contentDraft = ref(props.content || '')
const visualContentDraft = ref(props.content || '')
const recordSnapshot = ref<AimdProtocolRecordData>(normalizeIncomingRecord(props.modelValue))
const draggedFieldUid = ref<string | null>(null)
const visualEditMode = ref(props.initialVisualEditMode)
const activeContentSurface = ref<'source' | 'visual' | null>(null)
const activeSideTab = ref<WorkbenchSideTab>('recorder')
const viewportEditorMinHeight = ref(props.editorMinHeight)
const viewportSideBodyHeight = ref(props.recorderMinHeight)
const viewportVisualEditorMinHeight = ref(Math.max(320, props.recorderMinHeight))
const activeFieldEditor = ref<AimdWorkbenchFieldDescriptor | null>(null)
const fieldEditorRawDraft = ref('')
const fieldInsertMenuIndex = ref<number | null>(null)
let viewportLayoutFrame = 0
let visualContentSyncTimer: ReturnType<typeof setTimeout> | null = null
let pendingContentEchoes: string[] = []
let recentSourceDraftCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>()
let recentVisualProgrammaticCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>()
const recentSourceDraftValues = new Set<string>()
const recentVisualProgrammaticValues = new Set<string>()
const VISUAL_CONTENT_SYNC_DELAY_MS = 120
const RECENT_SOURCE_DRAFT_RETENTION_MS = 1600
const RECENT_VISUAL_PROGRAMMATIC_RETENTION_MS = 2000

function normalizeIncomingContent(value: string | undefined) {
  return value ?? ''
}

function trackPendingContentEcho(value: string) {
  if (pendingContentEchoes[pendingContentEchoes.length - 1] === value) {
    return
  }

  pendingContentEchoes.push(value)
  if (pendingContentEchoes.length > 16) {
    pendingContentEchoes = pendingContentEchoes.slice(-16)
  }
}

function clearVisualContentSyncTimer() {
  if (visualContentSyncTimer !== null) {
    clearTimeout(visualContentSyncTimer)
    visualContentSyncTimer = null
  }
}

function trackRecentValue(
  target: Set<string>,
  timers: Map<string, ReturnType<typeof setTimeout>>,
  value: string,
  retentionMs: number,
) {
  target.add(value)
  const existingTimer = timers.get(value)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  timers.set(value, setTimeout(() => {
    target.delete(value)
    timers.delete(value)
  }, retentionMs))
}

function clearTrackedRecentValues(
  target: Set<string>,
  timers: Map<string, ReturnType<typeof setTimeout>>,
) {
  for (const timer of timers.values()) {
    clearTimeout(timer)
  }

  target.clear()
  timers.clear()
}

function trackRecentSourceDraft(value: string) {
  trackRecentValue(
    recentSourceDraftValues,
    recentSourceDraftCleanupTimers,
    value,
    RECENT_SOURCE_DRAFT_RETENTION_MS,
  )
}

function trackRecentVisualProgrammaticValue(value: string) {
  trackRecentValue(
    recentVisualProgrammaticValues,
    recentVisualProgrammaticCleanupTimers,
    value,
    RECENT_VISUAL_PROGRAMMATIC_RETENTION_MS,
  )
}

function syncVisualContentNow(value: string) {
  clearVisualContentSyncTimer()
  trackRecentVisualProgrammaticValue(value)
  visualContentDraft.value = value
}

function scheduleVisualContentSync(value: string) {
  clearVisualContentSyncTimer()
  visualContentSyncTimer = setTimeout(() => {
    visualContentSyncTimer = null
    trackRecentVisualProgrammaticValue(value)
    visualContentDraft.value = value
  }, VISUAL_CONTENT_SYNC_DELAY_MS)
}

function syncContentDraftFromProp(value: string | undefined) {
  const normalized = normalizeIncomingContent(value)
  const pendingIndex = pendingContentEchoes.indexOf(normalized)
  if (pendingIndex !== -1) {
    pendingContentEchoes = pendingContentEchoes.slice(pendingIndex + 1)
    return
  }

  if (normalized === contentDraft.value) {
    syncVisualContentNow(normalized)
    return
  }

  pendingContentEchoes = []
  contentDraft.value = normalized
  syncVisualContentNow(normalized)
}

function applyLocalContentUpdate(nextContent: string) {
  if (nextContent === contentDraft.value) {
    return false
  }

  contentDraft.value = nextContent
  trackPendingContentEcho(nextContent)
  return true
}

watch(() => props.initialVisualEditMode, (value) => {
  visualEditMode.value = value
})

watch(() => props.content, (value) => {
  syncContentDraftFromProp(value)
}, { immediate: true })

watch(visualEditMode, (enabled) => {
  if (enabled) {
    syncVisualContentNow(contentDraft.value)
  }
})

watch(() => props.modelValue, (value) => {
  const normalized = normalizeIncomingRecord(value)
  if (getRecordDataSignature(normalized) === getRecordDataSignature(recordSnapshot.value)) {
    return
  }

  recordSnapshot.value = normalized
}, { deep: true, immediate: true })

const isZhLocale = computed(() => {
  const locale = `${props.editorProps?.locale ?? props.locale ?? ''}`.trim().toLowerCase()
  return locale.startsWith('zh')
})

const editorTitleLabel = computed(() => (
  props.editorTitle
  ?? (isZhLocale.value ? 'Protocol 源码' : 'Protocol Source')
))

const recorderTitleLabel = computed(() => (
  props.recorderTitle
  ?? (isZhLocale.value ? 'Recorder 录入' : 'Recorder')
))

const recordDataTitleLabel = computed(() => (
  props.recordDataTitle
  ?? (isZhLocale.value ? 'Record 数据' : 'Record Data')
))

const detachedDataTitleLabel = computed(() => (
  props.detachedDataTitle
  ?? (isZhLocale.value ? '脱离当前 Protocol 的旧数据' : 'Detached Data')
))

const detachedDataDescriptionLabel = computed(() => (
  props.detachedDataDescription
  ?? (isZhLocale.value
    ? '这些值对应的字段 id 已不在当前 protocol 结构里。改结构、重命名或删字段之后，可以从这里把旧值搬到新 field。'
    : 'These values belong to field ids that are no longer present in the current protocol. After restructuring, renaming, or removing fields, copy them into newly created fields here.')
))

const fieldStructureTitleLabel = computed(() => (
  props.fieldStructureTitle
  ?? (isZhLocale.value ? 'Field 结构编辑' : 'Field Structure')
))

const fieldStructureDescriptionLabel = computed(() => (
  props.fieldStructureDescription
  ?? (isZhLocale.value
    ? '这里可以直接改 recorder field 的 kind、id 和顺序，也可以新增或删除 field。按住每个字段顶部的“拖动排序”即可重排。拖拽当前是按源码片段重排；如果 field 嵌在句子里，周围 prose 仍可在左侧源码里继续微调。'
    : 'Edit recorder field kind, id, and order here, and add or remove fields without leaving the editor. Grab the “Drag to reorder” handle at the top of each field to move it. Dragging currently reorders source fragments; if a field is embedded inside prose, you can fine-tune the surrounding text in the source editor.')
))

const visualEditSummaryLabel = computed(() => (
  isZhLocale.value
    ? '右侧切到 recorder-aware 所见即所得编辑器，字段会直接显示为可交互 recorder widget'
    : 'Switch the right side into a recorder-aware WYSIWYG editor with real recorder widgets and full caret-based Markdown editing'
))

const workbenchUi = computed(() => (
  isZhLocale.value
    ? {
        visualEditOn: '可视化编辑开',
        visualEditOff: '可视化编辑关',
        kind: '字段类型',
        id: '字段 ID',
        valueType: '值类型',
        empty: '当前 protocol 里还没有可录入 field。可以先从下面新增一个。',
        delete: '删除',
        edit: '编辑字段',
        close: '关闭',
        drag: '拖动排序',
        dropHere: '拖到这里',
        source: 'Field AIMD 片段',
        sourceHint: '高级：如果这个 field 还有更复杂的内容，可以直接改它的 AIMD 片段。',
        applySource: '应用片段',
        visualDialogTitle: '编辑字段',
        visualDialogSummary: '直接在 recorder 主界面里修改字段结构。',
        addVar: '新增 Var',
        addTable: '新增 Table',
        addStep: '新增 Step',
        addCheck: '新增 Check',
        addQuiz: '新增 Quiz',
        addEndHint: '可视化编辑开启后，右侧会切到 recorder-aware 所见即所得编辑器，可以在任意光标位置补充标题、Markdown，并直接编辑真实的 recorder field widget。',
        typeLabels: {
          var: 'Var',
          var_table: 'Var Table',
          step: 'Step',
          check: 'Check',
          quiz: 'Quiz',
        } as Record<AimdWorkbenchFieldType, string>,
      }
    : {
        visualEditOn: 'Visual Edit On',
        visualEditOff: 'Visual Edit Off',
        kind: 'Field Kind',
        id: 'Field ID',
        valueType: 'Value Type',
        empty: 'There are no recorder-editable fields in the current protocol yet. Add one below to start filling data immediately.',
        delete: 'Delete',
        edit: 'Edit Field',
        close: 'Close',
        drag: 'Drag to reorder',
        dropHere: 'Drop here',
        source: 'Field AIMD',
        sourceHint: 'Advanced: edit the raw AIMD snippet when this field needs more than the basic controls.',
        applySource: 'Apply Snippet',
        visualDialogTitle: 'Edit Field',
        visualDialogSummary: 'Adjust the field structure directly inside the recorder.',
        addVar: 'Add Var',
        addTable: 'Add Table',
        addStep: 'Add Step',
        addCheck: 'Add Check',
        addQuiz: 'Add Quiz',
        addEndHint: 'When visual editing is on, the right side becomes a recorder-aware WYSIWYG editor so users can add headings, Markdown, and real recorder field widgets anywhere the caret can land.',
        typeLabels: {
          var: 'Var',
          var_table: 'Var Table',
          step: 'Step',
          check: 'Check',
          quiz: 'Quiz',
        } as Record<AimdWorkbenchFieldType, string>,
      }
))

function getViewportHeight() {
  if (typeof window === 'undefined') {
    return 0
  }

  return window.visualViewport?.height ?? window.innerHeight
}

function getElementHeight(element: Element | null | undefined) {
  return element?.getBoundingClientRect().height ?? 0
}

function updateViewportPanelHeights() {
  if (!props.fitViewport || typeof window === 'undefined') {
    viewportEditorMinHeight.value = props.editorMinHeight
    viewportSideBodyHeight.value = props.recorderMinHeight
    return
  }

  const workbenchTop = Math.max(workbenchRef.value?.getBoundingClientRect().top ?? 0, 0)
  const availableViewportHeight = Math.max(0, Math.floor(getViewportHeight() - workbenchTop - props.viewportOffset))
  const editorToolbarHeight = getElementHeight(editorPanelBodyRef.value?.querySelector('.aimd-editor-toolbar'))
  const editorHeaderHeight = getElementHeight(editorPanelHeadRef.value)
  const sideHeaderHeight = getElementHeight(sidePanelHeadRef.value)
  const sideBodyHeight = Math.max(
    props.recorderMinHeight,
    Math.floor(availableViewportHeight - sideHeaderHeight),
  )
  const recorderToolbarHeight = getElementHeight(recorderToolbarRef.value)
  const visualEditorToolbarHeight = getElementHeight(sidePanelBodyRef.value?.querySelector('.aimd-editor-toolbar'))

  viewportEditorMinHeight.value = Math.max(
    props.editorMinHeight,
    Math.floor(availableViewportHeight - editorHeaderHeight - editorToolbarHeight),
  )
  viewportSideBodyHeight.value = sideBodyHeight
  viewportVisualEditorMinHeight.value = Math.max(
    320,
    Math.floor(sideBodyHeight - recorderToolbarHeight - visualEditorToolbarHeight),
  )
}

function scheduleViewportPanelHeights() {
  if (typeof window === 'undefined') {
    return
  }

  if (viewportLayoutFrame) {
    window.cancelAnimationFrame(viewportLayoutFrame)
  }

  viewportLayoutFrame = window.requestAnimationFrame(() => {
    viewportLayoutFrame = 0
    updateViewportPanelHeights()
  })
}

const editorBindings = computed(() => {
  const editorProps = props.editorProps ?? {}

  return {
    ...editorProps,
    modelValue: contentDraft.value,
    mode: props.editorMode,
    locale: editorProps.locale ?? props.locale,
    minHeight: editorProps.minHeight ?? viewportEditorMinHeight.value,
    readonly: props.readonly || editorProps.readonly === true,
  }
})

const editableFields = computed(() => scanWorkbenchFields(contentDraft.value))
const editableFieldMap = computed(() => {
  const map = new Map<string, AimdWorkbenchFieldDescriptor>()
  for (const field of editableFields.value) {
    map.set(`${field.fieldType}:${field.id}`, field)
  }
  return map
})
const editableFieldIndexByUid = computed(() => {
  const map = new Map<string, number>()
  editableFields.value.forEach((field, index) => {
    map.set(field.uid, index)
  })
  return map
})

function matchEditableField(
  fields: AimdWorkbenchFieldDescriptor[],
  field: AimdWorkbenchFieldDescriptor,
  expected?: { fieldType: AimdWorkbenchFieldType, id: string },
) {
  if (expected) {
    const byIdentity = fields.find(candidate => candidate.fieldType === expected.fieldType && candidate.id === expected.id)
    if (byIdentity) {
      return byIdentity
    }
  }

  return (
    fields.find(candidate => candidate.start === field.start)
    ?? fields.find(candidate => candidate.uid === field.uid)
    ?? fields.find(candidate => candidate.fieldType === field.fieldType && candidate.id === field.id)
    ?? null
  )
}

function collectDetachedRecordData(
  record: AimdProtocolRecordData,
  fields: ExtractedAimdFields,
): AimdProtocolRecordData {
  const detached = createEmptyProtocolRecordData()
  const activeVarIds = new Set<string>(fields.var)
  const activeStepIds = new Set(normalizeStepFields(fields.step).map(step => step.name))
  const activeCheckIds = new Set(normalizeCheckFields(fields.check).map(check => check.name))
  const activeQuizIds = new Set(normalizeQuizFields(fields.quiz).map(quiz => quiz.id))

  for (const table of normalizeVarTableFields(fields.var_table)) {
    activeVarIds.add(table.id)
  }

  for (const [key, value] of Object.entries(record.var)) {
    if (!activeVarIds.has(key)) {
      detached.var[key] = value
    }
  }

  for (const [key, value] of Object.entries(record.step)) {
    if (!activeStepIds.has(key)) {
      detached.step[key] = value
    }
  }

  for (const [key, value] of Object.entries(record.check)) {
    if (!activeCheckIds.has(key)) {
      detached.check[key] = value
    }
  }

  for (const [key, value] of Object.entries(record.quiz)) {
    if (!activeQuizIds.has(key)) {
      detached.quiz[key] = value
    }
  }

  return detached
}

function countRecordEntries(record: AimdProtocolRecordData): number {
  return (
    Object.keys(record.var).length
    + Object.keys(record.step).length
    + Object.keys(record.check).length
    + Object.keys(record.quiz).length
  )
}

const detachedRecord = computed(() => collectDetachedRecordData(recordSnapshot.value, extractedFields.value))
const detachedEntryCount = computed(() => countRecordEntries(detachedRecord.value))
const hasDetachedData = computed(() => detachedEntryCount.value > 0)

const recordJson = computed(() => JSON.stringify(recordSnapshot.value, null, 2))
const detachedRecordJson = computed(() => JSON.stringify(detachedRecord.value, null, 2))
const sidePanelBodyStyle = computed(() => ({
  height: `${viewportSideBodyHeight.value}px`,
}))
const sideTabs = computed(() => {
  const tabs: Array<{ key: WorkbenchSideTab, label: string, badge?: number }> = [
    { key: 'recorder', label: recorderTitleLabel.value },
  ]

  if (props.showFieldStructure) {
    tabs.push({ key: 'structure', label: fieldStructureTitleLabel.value })
  }

  if (props.showRecordData) {
    tabs.push({ key: 'record', label: recordDataTitleLabel.value })
  }

  if (props.showDetachedData && hasDetachedData.value) {
    tabs.push({
      key: 'detached',
      label: detachedDataTitleLabel.value,
      badge: detachedEntryCount.value,
    })
  }

  return tabs
})
const showSideTabs = computed(() => sideTabs.value.length > 1)
const activeSideTabConfig = computed(() => (
  sideTabs.value.find(tab => tab.key === activeSideTab.value) ?? sideTabs.value[0]
))
const activeSideTitleLabel = computed(() => activeSideTabConfig.value?.label ?? recorderTitleLabel.value)

watch(sideTabs, (tabs) => {
  if (!tabs.some(tab => tab.key === activeSideTab.value)) {
    activeSideTab.value = 'recorder'
  }
}, { immediate: true })

watch([visualEditMode, activeSideTab], ([isVisualEditEnabled, sideTab]) => {
  if (!isVisualEditEnabled || sideTab !== 'recorder') {
    closeFieldEditor()
    fieldInsertMenuIndex.value = null
  }
})

watch(editableFields, (fields) => {
  if (!activeFieldEditor.value) {
    return
  }

  const refreshed = matchEditableField(fields, activeFieldEditor.value)
  if (!refreshed) {
    closeFieldEditor()
    return
  }

  activeFieldEditor.value = refreshed
  fieldEditorRawDraft.value = refreshed.raw
})

watch(
  [
    activeSideTab,
    visualEditMode,
    hasDetachedData,
    () => props.fitViewport,
    () => props.viewportOffset,
    () => props.editorMinHeight,
    () => props.recorderMinHeight,
    () => props.editorMode,
  ],
  async () => {
    await nextTick()
    scheduleViewportPanelHeights()
  },
  { immediate: true },
)

onMounted(async () => {
  await nextTick()
  scheduleViewportPanelHeights()

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', scheduleViewportPanelHeights, { passive: true })
    window.addEventListener('scroll', scheduleViewportPanelHeights, { passive: true })
    window.visualViewport?.addEventListener('resize', scheduleViewportPanelHeights)
    window.visualViewport?.addEventListener('scroll', scheduleViewportPanelHeights)
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', scheduleViewportPanelHeights)
    window.removeEventListener('scroll', scheduleViewportPanelHeights)
    window.visualViewport?.removeEventListener('resize', scheduleViewportPanelHeights)
    window.visualViewport?.removeEventListener('scroll', scheduleViewportPanelHeights)

    if (viewportLayoutFrame) {
      window.cancelAnimationFrame(viewportLayoutFrame)
      viewportLayoutFrame = 0
    }
  }

  clearVisualContentSyncTimer()
  clearTrackedRecentValues(recentSourceDraftValues, recentSourceDraftCleanupTimers)
  clearTrackedRecentValues(recentVisualProgrammaticValues, recentVisualProgrammaticCleanupTimers)
})

function emitContentIfChanged(nextContent: string, visualSync: 'immediate' | 'debounced' = 'immediate') {
  if (!applyLocalContentUpdate(nextContent)) {
    return
  }

  if (visualSync === 'debounced') {
    scheduleVisualContentSync(nextContent)
  } else {
    syncVisualContentNow(nextContent)
  }

  emit('update:content', nextContent)
}

function emitWorkbenchContentChange(
  nextContent: string,
  currentField?: AimdWorkbenchFieldDescriptor,
  expectedField?: { fieldType: AimdWorkbenchFieldType, id: string },
) {
  if (!applyLocalContentUpdate(nextContent)) {
    return
  }

  syncVisualContentNow(nextContent)

  if (currentField || expectedField) {
    const nextFields = scanWorkbenchFields(nextContent)
    const nextField = currentField
      ? matchEditableField(nextFields, currentField, expectedField)
      : nextFields.find(field => field.fieldType === expectedField?.fieldType && field.id === expectedField?.id) ?? null
    if (nextField) {
      activeFieldEditor.value = nextField
      fieldEditorRawDraft.value = nextField.raw
    } else if (currentField && activeFieldEditor.value?.uid === currentField.uid) {
      closeFieldEditor()
    }
  }

  emit('update:content', nextContent)
}

function handleEditorContentUpdate(value: string) {
  activeContentSurface.value = 'source'
  trackRecentSourceDraft(value)
  emitContentIfChanged(value, 'debounced')
}

function handleVisualContentUpdate(value: string) {
  if (recentVisualProgrammaticValues.has(value)) {
    return
  }

  if (activeContentSurface.value === 'source' && recentSourceDraftValues.has(value)) {
    return
  }

  activeContentSurface.value = 'visual'
  emitContentIfChanged(value, 'immediate')
}

function handleSourceSurfaceFocusIn() {
  activeContentSurface.value = 'source'
}

function handleVisualSurfaceFocusIn() {
  activeContentSurface.value = 'visual'
}

function handleContentSurfaceFocusOut(
  surface: 'source' | 'visual',
  event: FocusEvent,
) {
  const currentTarget = event.currentTarget
  const relatedTarget = event.relatedTarget
  if (currentTarget instanceof Node && relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) {
    return
  }

  if (activeContentSurface.value === surface) {
    activeContentSurface.value = null
  }
}

function handleRecordUpdate(value: AimdProtocolRecordData) {
  recordSnapshot.value = normalizeIncomingRecord(value)
  emit('update:modelValue', value)
}

function handleFieldsChange(fields: ExtractedAimdFields) {
  extractedFields.value = fields
  emit('fields-change', fields)
}

function handleAddField(fieldType: AimdWorkbenchFieldType) {
  const nextId = generateNextWorkbenchFieldId(editableFields.value, fieldType, fieldType === 'quiz' ? 'choice' : undefined)
  emitWorkbenchContentChange(appendWorkbenchField(contentDraft.value, fieldType, {
    id: nextId,
    valueType: fieldType === 'var' ? 'str' : undefined,
  }), undefined, {
    fieldType,
    id: nextId,
  })
}

function handleDeleteField(field: AimdWorkbenchFieldDescriptor) {
  if (activeFieldEditor.value?.uid === field.uid) {
    closeFieldEditor()
  }

  emitContentIfChanged(deleteWorkbenchField(contentDraft.value, field))
}

function commitFieldId(field: AimdWorkbenchFieldDescriptor, nextId: string) {
  const normalizedId = nextId.trim()
  if (!normalizedId) {
    return
  }

  emitWorkbenchContentChange(updateWorkbenchFieldId(contentDraft.value, field, normalizedId), field, {
    fieldType: field.fieldType,
    id: normalizedId,
  })
}

function handleFieldIdCommit(field: AimdWorkbenchFieldDescriptor, event: Event) {
  commitFieldId(field, (event.target as HTMLInputElement).value)
}

function commitFieldKind(field: AimdWorkbenchFieldDescriptor, nextFieldType: AimdWorkbenchFieldType) {
  emitWorkbenchContentChange(updateWorkbenchFieldKind(contentDraft.value, field, nextFieldType), field, {
    fieldType: nextFieldType,
    id: field.id,
  })
}

function handleFieldKindCommit(field: AimdWorkbenchFieldDescriptor, event: Event) {
  commitFieldKind(field, (event.target as HTMLSelectElement).value as AimdWorkbenchFieldType)
}

function commitVarValueType(field: AimdWorkbenchFieldDescriptor, nextValueType: string) {
  emitWorkbenchContentChange(updateWorkbenchVarValueType(contentDraft.value, field, nextValueType), field)
}

function handleVarValueTypeCommit(field: AimdWorkbenchFieldDescriptor, event: Event) {
  commitVarValueType(field, (event.target as HTMLInputElement).value)
}

function openFieldEditor(field: AimdWorkbenchFieldDescriptor) {
  activeFieldEditor.value = field
  fieldEditorRawDraft.value = field.raw
  fieldInsertMenuIndex.value = null
}

function closeFieldEditor() {
  activeFieldEditor.value = null
  fieldEditorRawDraft.value = ''
}

function toggleFieldInsertMenu(insertionIndex: number) {
  if (props.readonly) {
    return
  }

  fieldInsertMenuIndex.value = fieldInsertMenuIndex.value === insertionIndex ? null : insertionIndex
}

function handleInsertField(fieldType: AimdWorkbenchFieldType, insertionIndex: number) {
  const nextId = generateNextWorkbenchFieldId(editableFields.value, fieldType, fieldType === 'quiz' ? 'choice' : undefined)
  fieldInsertMenuIndex.value = null
  emitWorkbenchContentChange(insertWorkbenchField(
    contentDraft.value,
    editableFields.value,
    insertionIndex,
    fieldType,
    {
      id: nextId,
      valueType: fieldType === 'var' ? 'str' : undefined,
    },
  ), undefined, {
    fieldType,
    id: nextId,
  })
}

function handleFieldRawApply() {
  if (!props.allowRawFieldSourceEditing || !activeFieldEditor.value) {
    return
  }

  emitWorkbenchContentChange(updateWorkbenchFieldRaw(
    contentDraft.value,
    activeFieldEditor.value,
    fieldEditorRawDraft.value,
  ), activeFieldEditor.value)
}

function resolveVisualField(field: RecorderMilkdownFieldIdentity) {
  return editableFields.value.find(candidate => (
    candidate.fieldType === field.fieldType
    && candidate.id === field.id
  )) ?? editableFields.value.find(candidate => candidate.raw === field.raw) ?? null
}

function handleVisualFieldEdit(field: RecorderMilkdownFieldIdentity) {
  const matchedField = resolveVisualField(field)
  if (!matchedField) {
    return
  }

  openFieldEditor(matchedField)
}

function handleVisualFieldDelete(field: RecorderMilkdownFieldIdentity) {
  const matchedField = resolveVisualField(field)
  if (!matchedField) {
    return
  }

  handleDeleteField(matchedField)
}

function handleFieldDragStart(field: AimdWorkbenchFieldDescriptor, event: DragEvent) {
  if (props.readonly) {
    event.preventDefault()
    return
  }

  draggedFieldUid.value = field.uid
  fieldInsertMenuIndex.value = null
  event.dataTransfer?.setData('text/plain', field.uid)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function handleFieldDragEnd() {
  draggedFieldUid.value = null
}

function handleStructureDragOver(event: DragEvent) {
  if (props.readonly) {
    return
  }

  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function handleFieldDrop(insertionIndex: number) {
  if (props.readonly || !draggedFieldUid.value) {
    return
  }

  const movedField = editableFields.value.find(field => field.uid === draggedFieldUid.value)
  const nextContent = moveWorkbenchField(
    contentDraft.value,
    editableFields.value,
    draggedFieldUid.value,
    insertionIndex,
  )

  draggedFieldUid.value = null
  emitWorkbenchContentChange(nextContent, movedField)
}

function renderVisualInsertEntry(insertionIndex: number) {
  if (draggedFieldUid.value) {
    return [
      h('span', { class: 'aimd-recorder-workbench__drop-zone-label' }, workbenchUi.value.dropHere),
    ]
  }

  if (props.readonly) {
    return undefined
  }

  const isOpen = fieldInsertMenuIndex.value === insertionIndex

  return [
    h('span', { class: 'aimd-recorder-workbench__visual-insert-wrap' }, [
      h('button', {
        type: 'button',
        class: [
          'aimd-recorder-workbench__visual-insert-trigger',
          isOpen ? 'aimd-recorder-workbench__visual-insert-trigger--active' : '',
        ],
        onClick: (event: MouseEvent) => {
          event.preventDefault()
          event.stopPropagation()
          toggleFieldInsertMenu(insertionIndex)
        },
      }, '+'),
      isOpen
        ? h('span', { class: 'aimd-recorder-workbench__visual-insert-menu' }, [
          h('button', {
            type: 'button',
            class: 'aimd-recorder-workbench__visual-insert-option',
            onClick: () => handleInsertField('var', insertionIndex),
          }, workbenchUi.value.addVar),
          h('button', {
            type: 'button',
            class: 'aimd-recorder-workbench__visual-insert-option',
            onClick: () => handleInsertField('var_table', insertionIndex),
          }, workbenchUi.value.addTable),
          h('button', {
            type: 'button',
            class: 'aimd-recorder-workbench__visual-insert-option',
            onClick: () => handleInsertField('step', insertionIndex),
          }, workbenchUi.value.addStep),
          h('button', {
            type: 'button',
            class: 'aimd-recorder-workbench__visual-insert-option',
            onClick: () => handleInsertField('check', insertionIndex),
          }, workbenchUi.value.addCheck),
          h('button', {
            type: 'button',
            class: 'aimd-recorder-workbench__visual-insert-option',
            onClick: () => handleInsertField('quiz', insertionIndex),
          }, workbenchUi.value.addQuiz),
        ])
        : null,
    ]),
  ]
}

function renderVisualDropZone(insertionIndex: number) {
  return h('span', {
    class: [
      'aimd-recorder-workbench__visual-drop-zone',
      draggedFieldUid.value ? 'aimd-recorder-workbench__visual-drop-zone--active' : '',
    ],
    onDragover: handleStructureDragOver,
    onDrop: (event: DragEvent) => {
      event.preventDefault()
      handleFieldDrop(insertionIndex)
    },
  }, renderVisualInsertEntry(insertionIndex))
}

function renderVisualEditWrapper(fieldKey: string, fieldType: string, defaultVNode: any) {
  if (!visualEditMode.value) {
    return props.wrapField ? props.wrapField(fieldKey, fieldType, defaultVNode) : defaultVNode
  }

  const descriptor = editableFieldMap.value.get(fieldKey)
  if (!descriptor) {
    return props.wrapField ? props.wrapField(fieldKey, fieldType, defaultVNode) : defaultVNode
  }

  const index = editableFieldIndexByUid.value.get(descriptor.uid) ?? 0
  const visualWrapped = h('span', {
    class: [
      'aimd-recorder-workbench__visual-field',
      descriptor.sourceKind === 'block'
        ? 'aimd-recorder-workbench__visual-field--block'
        : 'aimd-recorder-workbench__visual-field--inline',
      draggedFieldUid.value === descriptor.uid
        ? 'aimd-recorder-workbench__visual-field--dragging'
        : '',
    ],
  }, [
    renderVisualDropZone(index),
    h('span', { class: 'aimd-recorder-workbench__visual-header' }, [
      h('span', { class: 'aimd-recorder-workbench__visual-summary' }, [
        h('span', { class: 'aimd-recorder-workbench__visual-badge' }, workbenchUi.value.typeLabels[descriptor.fieldType]),
        h('span', { class: 'aimd-recorder-workbench__visual-field-id' }, descriptor.id),
      ]),
      h('span', { class: 'aimd-recorder-workbench__visual-actions' }, [
        h('button', {
          type: 'button',
          class: 'aimd-recorder-workbench__visual-open-dialog',
          disabled: props.readonly,
          onClick: () => openFieldEditor(descriptor),
        }, workbenchUi.value.edit),
        h('span', {
          class: 'aimd-recorder-workbench__visual-drag-handle',
          draggable: !props.readonly,
          title: workbenchUi.value.drag,
          onDragstart: (event: DragEvent) => handleFieldDragStart(descriptor, event),
          onDragend: handleFieldDragEnd,
        }, `:: ${workbenchUi.value.drag}`),
      ]),
    ]),
    h('span', { class: 'aimd-recorder-workbench__visual-body' }, [defaultVNode]),
    renderVisualDropZone(index + 1),
  ])

  return props.wrapField ? props.wrapField(fieldKey, fieldType, visualWrapped) : visualWrapped
}

defineExpose({
  getEditor: () => editorRef.value,
  getRecorder: () => recorderRef.value,
  runClientAssigner: (id: string) => recorderRef.value?.runClientAssigner(id),
  runManualClientAssigners: () => recorderRef.value?.runManualClientAssigners(),
})
</script>

<template>
  <div ref="workbenchRef" class="aimd-recorder-workbench">
    <div class="aimd-recorder-workbench__main">
      <section class="aimd-recorder-workbench__panel">
        <header ref="editorPanelHeadRef" class="aimd-recorder-workbench__panel-head">
          <h3 class="aimd-recorder-workbench__panel-title">{{ editorTitleLabel }}</h3>
        </header>

        <div
          ref="editorPanelBodyRef"
          class="aimd-recorder-workbench__panel-body aimd-recorder-workbench__panel-body--editor"
          @focusin.capture="handleSourceSurfaceFocusIn"
          @focusout.capture="handleContentSurfaceFocusOut('source', $event)"
        >
          <AimdEditor
            ref="editorRef"
            v-bind="editorBindings"
            class="aimd-recorder-workbench__editor"
            @update:model-value="handleEditorContentUpdate"
            @update:mode="emit('update:editorMode', $event)"
            @ready="emit('editor-ready', $event)"
          />
        </div>
      </section>

      <section
        class="aimd-recorder-workbench__panel"
        :class="{
          'aimd-recorder-workbench__panel--structure': activeSideTab === 'structure',
          'aimd-recorder-workbench__panel--detached': activeSideTab === 'detached',
        }"
      >
        <header ref="sidePanelHeadRef" class="aimd-recorder-workbench__panel-head">
          <div class="aimd-recorder-workbench__panel-head-row">
            <div class="aimd-recorder-workbench__panel-head-copy">
              <h3 class="aimd-recorder-workbench__panel-title">
                {{ activeSideTitleLabel }}
                <span
                  v-if="activeSideTab === 'detached'"
                  class="aimd-recorder-workbench__panel-title-count"
                >
                  ({{ detachedEntryCount }})
                </span>
              </h3>
              <p
                v-if="showVisualEditToggle && activeSideTab === 'recorder'"
                class="aimd-recorder-workbench__panel-head-note"
              >
                {{ visualEditSummaryLabel }}
              </p>
            </div>

            <div
              v-if="showVisualEditToggle && activeSideTab === 'recorder'"
              class="aimd-recorder-workbench__visual-toggle-wrap"
            >
              <button
                class="aimd-recorder-workbench__visual-toggle"
                :class="{ 'aimd-recorder-workbench__visual-toggle--active': visualEditMode }"
                type="button"
                @click="visualEditMode = !visualEditMode"
              >
                {{ visualEditMode ? workbenchUi.visualEditOn : workbenchUi.visualEditOff }}
              </button>
            </div>
          </div>

          <nav
            v-if="showSideTabs"
            class="aimd-recorder-workbench__side-tabs"
            :aria-label="isZhLocale ? '编辑器面板切换' : 'Editor panels'"
          >
            <button
              v-for="tab in sideTabs"
              :key="tab.key"
              class="aimd-recorder-workbench__side-tab"
              :class="{ 'aimd-recorder-workbench__side-tab--active': activeSideTab === tab.key }"
              type="button"
              @click="activeSideTab = tab.key"
            >
              <span>{{ tab.label }}</span>
              <span
                v-if="typeof tab.badge === 'number'"
                class="aimd-recorder-workbench__side-tab-badge"
              >
                {{ tab.badge }}
              </span>
            </button>
          </nav>
        </header>

        <div
          v-if="activeSideTab === 'recorder'"
          ref="sidePanelBodyRef"
          class="aimd-recorder-workbench__panel-body"
          :class="visualEditMode ? 'aimd-recorder-workbench__panel-body--visual-editor' : 'aimd-recorder-workbench__panel-body--recorder'"
          :style="sidePanelBodyStyle"
          @focusin.capture="visualEditMode && handleVisualSurfaceFocusIn()"
          @focusout.capture="visualEditMode && handleContentSurfaceFocusOut('visual', $event)"
        >
          <div
            v-if="visualEditMode"
            ref="recorderToolbarRef"
            class="aimd-recorder-workbench__recorder-toolbar"
          >
            <p class="aimd-recorder-workbench__recorder-toolbar-note">
              {{ workbenchUi.addEndHint }}
            </p>
          </div>

          <AimdRecorderWysiwygSurface
            v-if="visualEditMode"
            :content="visualContentDraft"
            :model-value="recordSnapshot"
            :min-height="viewportVisualEditorMinHeight"
            :locale="locale"
            :readonly="readonly"
            :current-user-name="currentUserName"
            :now="now"
            :messages="messages"
            :step-detail-display="stepDetailDisplay"
            :field-meta="fieldMeta"
            :field-state="fieldState"
            :wrap-field="wrapField"
            :custom-renderers="customRenderers"
            :field-adapters="fieldAdapters"
            :resolve-file="resolveFile"
            :type-plugins="typePlugins"
            :enable-block-handle="editorProps?.enableBlockHandle ?? true"
            class="aimd-recorder-workbench__visual-editor"
            @update:content="handleVisualContentUpdate"
            @update:model-value="handleRecordUpdate"
            @fields-change="handleFieldsChange"
            @error="emit('error', $event)"
            @field-change="emit('field-change', $event)"
            @field-blur="emit('field-blur', $event)"
            @assigner-request="emit('assigner-request', $event)"
            @assigner-cancel="emit('assigner-cancel', $event)"
            @table-add-row="emit('table-add-row', $event)"
            @table-remove-row="emit('table-remove-row', $event)"
            @edit-field="handleVisualFieldEdit"
            @delete-field="handleVisualFieldDelete"
          />

          <AimdRecorder
            v-else
            ref="recorderRef"
            :content="contentDraft"
            :model-value="recordSnapshot"
            :readonly="readonly"
            :current-user-name="currentUserName"
            :now="now"
            :locale="locale"
            :messages="messages"
            :step-detail-display="stepDetailDisplay"
            :field-meta="fieldMeta"
            :field-state="fieldState"
            :wrap-field="renderVisualEditWrapper"
            :custom-renderers="customRenderers"
            :field-adapters="fieldAdapters"
            :resolve-file="resolveFile"
            :type-plugins="typePlugins"
            @update:model-value="handleRecordUpdate"
            @fields-change="handleFieldsChange"
            @error="emit('error', $event)"
            @field-change="emit('field-change', $event)"
            @field-blur="emit('field-blur', $event)"
            @assigner-request="emit('assigner-request', $event)"
            @assigner-cancel="emit('assigner-cancel', $event)"
            @table-add-row="emit('table-add-row', $event)"
            @table-remove-row="emit('table-remove-row', $event)"
          />
        </div>
        <div
          v-else-if="activeSideTab === 'structure'"
          class="aimd-recorder-workbench__panel-body aimd-recorder-workbench__panel-body--side"
          :style="sidePanelBodyStyle"
        >
          <div class="aimd-recorder-workbench__structure">
            <p class="aimd-recorder-workbench__structure-description">
              {{ fieldStructureDescriptionLabel }}
            </p>

            <div class="aimd-recorder-workbench__structure-toolbar">
              <button class="aimd-recorder-workbench__add-btn" :disabled="readonly" @click="handleAddField('var')">
                {{ workbenchUi.addVar }}
              </button>
              <button class="aimd-recorder-workbench__add-btn" :disabled="readonly" @click="handleAddField('var_table')">
                {{ workbenchUi.addTable }}
              </button>
              <button class="aimd-recorder-workbench__add-btn" :disabled="readonly" @click="handleAddField('step')">
                {{ workbenchUi.addStep }}
              </button>
              <button class="aimd-recorder-workbench__add-btn" :disabled="readonly" @click="handleAddField('check')">
                {{ workbenchUi.addCheck }}
              </button>
              <button class="aimd-recorder-workbench__add-btn" :disabled="readonly" @click="handleAddField('quiz')">
                {{ workbenchUi.addQuiz }}
              </button>
            </div>

            <div v-if="editableFields.length" class="aimd-recorder-workbench__field-list">
              <div
                class="aimd-recorder-workbench__drop-zone"
                :class="{ 'aimd-recorder-workbench__drop-zone--active': !!draggedFieldUid }"
                @dragover="handleStructureDragOver"
                @drop.prevent="handleFieldDrop(0)"
              >
                <span v-if="draggedFieldUid" class="aimd-recorder-workbench__drop-zone-label">
                  {{ workbenchUi.dropHere }}
                </span>
              </div>

              <template v-for="(field, index) in editableFields" :key="field.uid">
                <article
                  class="aimd-recorder-workbench__field-item"
                  :class="{ 'aimd-recorder-workbench__field-item--dragging': draggedFieldUid === field.uid }"
                  :draggable="!readonly"
                  @dragstart="handleFieldDragStart(field, $event)"
                  @dragend="handleFieldDragEnd"
                >
                  <div class="aimd-recorder-workbench__field-item-top">
                    <span class="aimd-recorder-workbench__drag-handle" :title="workbenchUi.drag">
                      :: {{ workbenchUi.drag }}
                    </span>
                    <span class="aimd-recorder-workbench__field-badge">
                      {{ workbenchUi.typeLabels[field.fieldType] }}
                    </span>
                    <button
                      class="aimd-recorder-workbench__delete-btn"
                      :disabled="readonly"
                      @click="handleDeleteField(field)"
                    >
                      {{ workbenchUi.delete }}
                    </button>
                  </div>

                  <div class="aimd-recorder-workbench__field-grid">
                    <label class="aimd-recorder-workbench__field-label">
                      <span>{{ workbenchUi.kind }}</span>
                      <select :value="field.fieldType" :disabled="readonly" @change="handleFieldKindCommit(field, $event)">
                        <option value="var">{{ workbenchUi.typeLabels.var }}</option>
                        <option value="var_table">{{ workbenchUi.typeLabels.var_table }}</option>
                        <option value="step">{{ workbenchUi.typeLabels.step }}</option>
                        <option value="check">{{ workbenchUi.typeLabels.check }}</option>
                        <option value="quiz">{{ workbenchUi.typeLabels.quiz }}</option>
                      </select>
                    </label>

                    <label class="aimd-recorder-workbench__field-label">
                      <span>{{ workbenchUi.id }}</span>
                      <input :value="field.id" :disabled="readonly" @change="handleFieldIdCommit(field, $event)">
                    </label>

                    <label
                      v-if="field.fieldType === 'var'"
                      class="aimd-recorder-workbench__field-label"
                    >
                      <span>{{ workbenchUi.valueType }}</span>
                      <input
                        :value="field.valueType || 'str'"
                        :disabled="readonly"
                        @change="handleVarValueTypeCommit(field, $event)"
                      >
                    </label>
                  </div>
                </article>

                <div
                  class="aimd-recorder-workbench__drop-zone"
                  :class="{ 'aimd-recorder-workbench__drop-zone--active': !!draggedFieldUid }"
                  @dragover="handleStructureDragOver"
                  @drop.prevent="handleFieldDrop(index + 1)"
                >
                  <span v-if="draggedFieldUid" class="aimd-recorder-workbench__drop-zone-label">
                    {{ workbenchUi.dropHere }}
                  </span>
                </div>
              </template>
            </div>

            <p v-else class="aimd-recorder-workbench__structure-empty">
              {{ workbenchUi.empty }}
            </p>
          </div>
        </div>

        <div
          v-else-if="activeSideTab === 'record'"
          class="aimd-recorder-workbench__panel-body aimd-recorder-workbench__panel-body--code"
          :style="sidePanelBodyStyle"
        >
          <pre class="aimd-recorder-workbench__code">{{ recordJson }}</pre>
        </div>

        <div
          v-else-if="activeSideTab === 'detached'"
          class="aimd-recorder-workbench__panel-body aimd-recorder-workbench__panel-body--code"
          :style="sidePanelBodyStyle"
        >
          <p class="aimd-recorder-workbench__detached-description">
            {{ detachedDataDescriptionLabel }}
          </p>
          <pre class="aimd-recorder-workbench__code aimd-recorder-workbench__code--detached">
            {{ detachedRecordJson }}
          </pre>
        </div>
      </section>
    </div>

    <div
      v-if="activeFieldEditor"
      class="aimd-recorder-workbench__dialog-backdrop"
      @click.self="closeFieldEditor"
    >
      <section class="aimd-recorder-workbench__dialog" :aria-label="workbenchUi.visualDialogTitle" role="dialog" aria-modal="true">
        <header class="aimd-recorder-workbench__dialog-head">
          <div>
            <h4 class="aimd-recorder-workbench__dialog-title">{{ workbenchUi.visualDialogTitle }}</h4>
            <p class="aimd-recorder-workbench__dialog-summary">{{ workbenchUi.visualDialogSummary }}</p>
          </div>
          <button class="aimd-recorder-workbench__dialog-close" type="button" @click="closeFieldEditor">
            {{ workbenchUi.close }}
          </button>
        </header>

        <div class="aimd-recorder-workbench__dialog-body">
          <label class="aimd-recorder-workbench__dialog-label">
            <span>{{ workbenchUi.kind }}</span>
            <select
              :value="activeFieldEditor.fieldType"
              :disabled="readonly"
              @change="handleFieldKindCommit(activeFieldEditor, $event)"
            >
              <option value="var">{{ workbenchUi.typeLabels.var }}</option>
              <option value="var_table">{{ workbenchUi.typeLabels.var_table }}</option>
              <option value="step">{{ workbenchUi.typeLabels.step }}</option>
              <option value="check">{{ workbenchUi.typeLabels.check }}</option>
              <option value="quiz">{{ workbenchUi.typeLabels.quiz }}</option>
            </select>
          </label>

          <label class="aimd-recorder-workbench__dialog-label">
            <span>{{ workbenchUi.id }}</span>
            <input
              :value="activeFieldEditor.id"
              :disabled="readonly"
              @change="handleFieldIdCommit(activeFieldEditor, $event)"
            >
          </label>

          <label
            v-if="activeFieldEditor.fieldType === 'var'"
            class="aimd-recorder-workbench__dialog-label"
          >
            <span>{{ workbenchUi.valueType }}</span>
            <input
              :value="activeFieldEditor.valueType || 'str'"
              :disabled="readonly"
              @change="handleVarValueTypeCommit(activeFieldEditor, $event)"
            >
          </label>

          <label
            v-if="allowRawFieldSourceEditing"
            class="aimd-recorder-workbench__dialog-label aimd-recorder-workbench__dialog-label--wide"
          >
            <span>{{ workbenchUi.source }}</span>
            <textarea
              v-model="fieldEditorRawDraft"
              class="aimd-recorder-workbench__dialog-textarea"
              :disabled="readonly"
            />
          </label>
        </div>

        <footer class="aimd-recorder-workbench__dialog-foot">
          <p v-if="allowRawFieldSourceEditing" class="aimd-recorder-workbench__dialog-hint">{{ workbenchUi.sourceHint }}</p>
          <div class="aimd-recorder-workbench__dialog-actions">
            <button class="aimd-recorder-workbench__dialog-delete" type="button" :disabled="readonly" @click="handleDeleteField(activeFieldEditor)">
              {{ workbenchUi.delete }}
            </button>
            <button
              v-if="allowRawFieldSourceEditing"
              class="aimd-recorder-workbench__dialog-apply"
              type="button"
              :disabled="readonly"
              @click="handleFieldRawApply"
            >
              {{ workbenchUi.applySource }}
            </button>
          </div>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.aimd-recorder-workbench {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.aimd-recorder-workbench__main {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

.aimd-recorder-workbench__panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #dbe4ef;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
}

.aimd-recorder-workbench__panel--detached {
  border-color: #f0d5a8;
  background: #fffdfa;
}

.aimd-recorder-workbench__panel--structure {
  border-color: #d6e1f5;
}

.aimd-recorder-workbench__panel-head {
  padding: 12px 16px;
  border-bottom: 1px solid #e7edf5;
  background: linear-gradient(180deg, #fbfdff 0%, #f5f9ff 100%);
}

.aimd-recorder-workbench__panel-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.aimd-recorder-workbench__panel-head-copy {
  min-width: 0;
}

.aimd-recorder-workbench__panel--detached .aimd-recorder-workbench__panel-head {
  border-bottom-color: #f0dfbf;
  background: linear-gradient(180deg, #fffdf8 0%, #fff7ea 100%);
}

.aimd-recorder-workbench__panel-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #233042;
}

.aimd-recorder-workbench__panel-title-count {
  color: #7a6140;
}

.aimd-recorder-workbench__panel-head-note {
  margin: 4px 0 0;
  color: #5e6f85;
  font-size: 12px;
  line-height: 1.5;
}

.aimd-recorder-workbench__panel-body {
  min-width: 0;
}

.aimd-recorder-workbench__panel-body--editor :deep(.aimd-editor) {
  border: 0 none;
  border-radius: 0;
}

.aimd-recorder-workbench__panel-body--recorder {
  padding: 18px;
  box-sizing: border-box;
  background: #f8fbff;
  overflow: auto;
}

.aimd-recorder-workbench__panel-body--visual-editor {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: #f8fbff;
  overflow: hidden;
}

.aimd-recorder-workbench__panel-body--side,
.aimd-recorder-workbench__panel-body--code {
  box-sizing: border-box;
  background: #f8fbff;
  overflow: auto;
}

.aimd-recorder-workbench__panel-body--code {
  display: flex;
  flex-direction: column;
}

.aimd-recorder-workbench__panel-body--recorder :deep(.aimd-protocol-recorder) {
  min-width: 0;
}

.aimd-recorder-workbench__panel-body--visual-editor :deep(.aimd-editor) {
  border: 0 none;
  border-radius: 0;
}

.aimd-recorder-workbench__side-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.aimd-recorder-workbench__side-tab {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #d6deea;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #415165;
  cursor: pointer;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  transition: all 0.2s ease;
}

.aimd-recorder-workbench__side-tab:hover {
  border-color: #8ba8d8;
  box-shadow: 0 6px 16px rgba(47, 111, 237, 0.08);
  transform: translateY(-1px);
}

.aimd-recorder-workbench__side-tab--active {
  border-color: #5f8dea;
  background: #edf4ff;
  color: #2454b5;
  box-shadow: 0 6px 18px rgba(47, 111, 237, 0.14);
}

.aimd-recorder-workbench__side-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgba(36, 84, 181, 0.12);
  color: inherit;
  font-size: 11px;
}

.aimd-recorder-workbench__visual-toggle {
  appearance: none;
  border: 1px solid #d4deed;
  border-radius: 999px;
  background: #fff;
  color: #28415f;
  cursor: pointer;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  transition: all 0.2s ease;
}

.aimd-recorder-workbench__visual-toggle--active {
  border-color: #5f8dea;
  background: #edf4ff;
  color: #2454b5;
  box-shadow: 0 6px 18px rgba(47, 111, 237, 0.14);
}

.aimd-recorder-workbench__recorder-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 0 0 auto;
  padding: 12px;
  border: 1px solid #d8e3f5;
  border-radius: 14px;
  background: linear-gradient(180deg, #ffffff 0%, #f6faff 100%);
}

.aimd-recorder-workbench__recorder-toolbar-note {
  margin: 0;
  color: #5a6d86;
  font-size: 12px;
  line-height: 1.6;
}

.aimd-recorder-workbench__structure {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  min-height: 100%;
  box-sizing: border-box;
  background: linear-gradient(180deg, #fbfdff 0%, #f7faff 100%);
}

.aimd-recorder-workbench__structure-description,
.aimd-recorder-workbench__detached-description {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
}

.aimd-recorder-workbench__structure-description {
  color: #56657a;
}

.aimd-recorder-workbench__detached-description {
  padding: 14px 16px 0;
  color: #62533a;
}

.aimd-recorder-workbench__structure-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.aimd-recorder-workbench__add-btn,
.aimd-recorder-workbench__delete-btn {
  appearance: none;
  border: 1px solid #d6deea;
  border-radius: 999px;
  background: #fff;
  color: #223041;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.aimd-recorder-workbench__add-btn {
  padding: 8px 12px;
}

.aimd-recorder-workbench__delete-btn {
  padding: 7px 11px;
}

.aimd-recorder-workbench__add-btn:hover:not(:disabled),
.aimd-recorder-workbench__delete-btn:hover:not(:disabled) {
  border-color: #8ba8d8;
  box-shadow: 0 6px 18px rgba(47, 111, 237, 0.1);
  transform: translateY(-1px);
}

.aimd-recorder-workbench__add-btn:disabled,
.aimd-recorder-workbench__delete-btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.aimd-recorder-workbench__field-list {
  display: flex;
  flex-direction: column;
}

.aimd-recorder-workbench__drop-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 14px;
  border-radius: 999px;
  border: 1px dashed transparent;
  background: rgba(47, 111, 237, 0.03);
  transition: background 0.2s ease, border-color 0.2s ease, min-height 0.2s ease;
}

.aimd-recorder-workbench__drop-zone--active {
  min-height: 28px;
  border-color: rgba(95, 141, 234, 0.45);
  background: rgba(47, 111, 237, 0.08);
}

.aimd-recorder-workbench__drop-zone--active:hover {
  border-color: #5f8dea;
  background: rgba(47, 111, 237, 0.18);
}

.aimd-recorder-workbench__field-item {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  border: 1px solid #dbe5f2;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05);
}

.aimd-recorder-workbench__field-item--dragging {
  opacity: 0.65;
}

.aimd-recorder-workbench__field-item-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.aimd-recorder-workbench__drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef4ff;
  color: #2f5db7;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  cursor: grab;
}

.aimd-recorder-workbench__field-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: #f2f5fa;
  color: #445366;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.aimd-recorder-workbench__delete-btn {
  margin-left: auto;
}

.aimd-recorder-workbench__field-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.aimd-recorder-workbench__field-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.aimd-recorder-workbench__field-label > span {
  font-size: 12px;
  font-weight: 600;
  color: #5b6778;
}

.aimd-recorder-workbench__field-label > input,
.aimd-recorder-workbench__field-label > select {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 9px 10px;
  border: 1px solid #d4dcea;
  border-radius: 10px;
  background: #fff;
  color: #223041;
  font-size: 13px;
}

.aimd-recorder-workbench__field-label > input:focus,
.aimd-recorder-workbench__field-label > select:focus {
  outline: none;
  border-color: #6d95e8;
  box-shadow: 0 0 0 3px rgba(47, 111, 237, 0.12);
}

.aimd-recorder-workbench__structure-empty {
  margin: 0;
  padding: 14px 16px;
  border: 1px dashed #cad7ec;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.7);
  color: #5c6d84;
  font-size: 13px;
  line-height: 1.6;
}

.aimd-recorder-workbench__visual-field {
  margin: 14px 0;
  padding: 10px 12px 12px;
  border: 1px solid #d7e1ef;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(249, 251, 255, 0.96) 100%);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
}

.aimd-recorder-workbench__visual-field--block {
  display: block;
}

.aimd-recorder-workbench__visual-field--inline {
  display: inline-flex;
  flex-direction: column;
  vertical-align: top;
  max-width: min(100%, 720px);
}

.aimd-recorder-workbench__visual-field--dragging {
  opacity: 0.68;
}

.aimd-recorder-workbench__visual-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.aimd-recorder-workbench__visual-summary,
.aimd-recorder-workbench__visual-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.aimd-recorder-workbench__visual-badge,
.aimd-recorder-workbench__visual-field-id {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.aimd-recorder-workbench__visual-badge {
  padding: 6px 10px;
  background: #edf4ff;
  color: #2f5db7;
  text-transform: uppercase;
}

.aimd-recorder-workbench__visual-field-id {
  padding: 6px 10px;
  background: #f3f6fa;
  color: #445366;
}

.aimd-recorder-workbench__visual-open-dialog,
.aimd-recorder-workbench__visual-drag-handle,
.aimd-recorder-workbench__visual-insert-trigger,
.aimd-recorder-workbench__visual-insert-option,
.aimd-recorder-workbench__dialog-close,
.aimd-recorder-workbench__dialog-apply,
.aimd-recorder-workbench__dialog-delete {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #d6deea;
  border-radius: 999px;
  background: #fff;
  color: #28415f;
  cursor: pointer;
  padding: 7px 11px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.aimd-recorder-workbench__visual-open-dialog:hover:not(:disabled),
.aimd-recorder-workbench__visual-drag-handle:hover,
.aimd-recorder-workbench__visual-insert-trigger:hover:not(:disabled),
.aimd-recorder-workbench__visual-insert-option:hover:not(:disabled),
.aimd-recorder-workbench__dialog-close:hover:not(:disabled),
.aimd-recorder-workbench__dialog-apply:hover:not(:disabled),
.aimd-recorder-workbench__dialog-delete:hover:not(:disabled) {
  border-color: #8ba8d8;
  box-shadow: 0 6px 18px rgba(47, 111, 237, 0.1);
  transform: translateY(-1px);
}

.aimd-recorder-workbench__visual-open-dialog:disabled,
.aimd-recorder-workbench__dialog-close:disabled,
.aimd-recorder-workbench__dialog-apply:disabled,
.aimd-recorder-workbench__dialog-delete:disabled {
  opacity: 0.55;
  cursor: default;
}

.aimd-recorder-workbench__visual-drag-handle {
  background: #eef4ff;
  color: #2f5db7;
  cursor: grab;
}

.aimd-recorder-workbench__visual-body {
  display: block;
  min-width: 0;
}

.aimd-recorder-workbench__visual-drop-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  min-height: 18px;
  border-radius: 999px;
  border: 1px dashed transparent;
  background: rgba(47, 111, 237, 0.03);
  transition: background 0.2s ease, border-color 0.2s ease, min-height 0.2s ease;
}

.aimd-recorder-workbench__visual-drop-zone--active {
  min-height: 24px;
  border-color: rgba(95, 141, 234, 0.45);
  background: rgba(47, 111, 237, 0.08);
}

.aimd-recorder-workbench__visual-drop-zone--active:hover {
  border-color: #5f8dea;
  background: rgba(47, 111, 237, 0.18);
}

.aimd-recorder-workbench__drop-zone-label {
  pointer-events: none;
  color: #315daf;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.aimd-recorder-workbench__visual-insert-wrap {
  position: relative;
  display: inline-flex;
  justify-content: center;
}

.aimd-recorder-workbench__visual-insert-trigger {
  min-width: 28px;
  min-height: 28px;
  padding: 0;
  background: #edf4ff;
  color: #2454b5;
  font-size: 18px;
}

.aimd-recorder-workbench__visual-insert-trigger--active {
  border-color: #5f8dea;
  background: #dfeaff;
}

.aimd-recorder-workbench__visual-insert-menu {
  position: absolute;
  top: calc(100% + 8px);
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  min-width: min(100vw - 48px, 420px);
  padding: 10px;
  border: 1px solid #d8e3f5;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.12);
}

.aimd-recorder-workbench__visual-insert-option {
  font-size: 11px;
}

.aimd-recorder-workbench__visual-editor {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.aimd-recorder-workbench__dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.24);
}

.aimd-recorder-workbench__dialog {
  width: min(720px, 100%);
  max-height: min(80vh, 900px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #dbe4ef;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 28px 56px rgba(15, 23, 42, 0.22);
}

.aimd-recorder-workbench__dialog-head,
.aimd-recorder-workbench__dialog-foot {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
}

.aimd-recorder-workbench__dialog-head {
  border-bottom: 1px solid #e7edf5;
  background: linear-gradient(180deg, #fbfdff 0%, #f5f9ff 100%);
}

.aimd-recorder-workbench__dialog-foot {
  border-top: 1px solid #e7edf5;
  background: #fbfdff;
}

.aimd-recorder-workbench__dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #223041;
}

.aimd-recorder-workbench__dialog-summary,
.aimd-recorder-workbench__dialog-hint {
  margin: 6px 0 0;
  color: #5c6d84;
  font-size: 13px;
  line-height: 1.55;
}

.aimd-recorder-workbench__dialog-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 20px;
  overflow: auto;
}

.aimd-recorder-workbench__dialog-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.aimd-recorder-workbench__dialog-label--wide {
  grid-column: 1 / -1;
}

.aimd-recorder-workbench__dialog-label > span {
  font-size: 12px;
  font-weight: 700;
  color: #5b6778;
}

.aimd-recorder-workbench__dialog-label > input,
.aimd-recorder-workbench__dialog-label > select,
.aimd-recorder-workbench__dialog-textarea {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #d4dcea;
  border-radius: 12px;
  background: #fff;
  color: #223041;
  font-size: 13px;
}

.aimd-recorder-workbench__dialog-textarea {
  min-height: 180px;
  resize: vertical;
  font-family: 'SFMono-Regular', 'SF Mono', 'Fira Code', 'Menlo', monospace;
  line-height: 1.55;
}

.aimd-recorder-workbench__dialog-label > input:focus,
.aimd-recorder-workbench__dialog-label > select:focus,
.aimd-recorder-workbench__dialog-textarea:focus {
  outline: none;
  border-color: #6d95e8;
  box-shadow: 0 0 0 3px rgba(47, 111, 237, 0.12);
}

.aimd-recorder-workbench__dialog-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.aimd-recorder-workbench__dialog-apply {
  background: #edf4ff;
  color: #2454b5;
}

.aimd-recorder-workbench__dialog-delete {
  border-color: #e7c8d2;
  background: #fff7f8;
  color: #b23b58;
}

.aimd-recorder-workbench__code {
  margin: 0;
  padding: 16px;
  flex: 1 1 auto;
  box-sizing: border-box;
  overflow: auto;
  background: #fbfcfe;
  color: #223041;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'SFMono-Regular', 'SF Mono', 'Fira Code', 'Menlo', monospace;
}

.aimd-recorder-workbench__code--detached {
  border-top: 1px solid #edf2f7;
}

@media (max-width: 1080px) {
  .aimd-recorder-workbench__main {
    grid-template-columns: minmax(0, 1fr);
  }

  .aimd-recorder-workbench__panel-head-row {
    flex-direction: column;
    align-items: stretch;
  }

  .aimd-recorder-workbench__visual-toggle-wrap {
    align-self: flex-start;
  }

  .aimd-recorder-workbench__dialog-backdrop {
    padding: 16px;
  }

  .aimd-recorder-workbench__dialog-head,
  .aimd-recorder-workbench__dialog-foot,
  .aimd-recorder-workbench__visual-header {
    flex-direction: column;
    align-items: stretch;
  }

  .aimd-recorder-workbench__dialog-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .aimd-recorder-workbench__field-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
