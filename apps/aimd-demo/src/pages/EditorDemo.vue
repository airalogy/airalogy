<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowReactive, watch, type VNode } from 'vue'
import {
  openAiraArchive,
  openZipArchive,
  type AiraArchive,
  type AiralogyRecordPayload,
  type AiraProtocolManifest,
  type AiraRecordManifest,
  type AiraFileManifest,
  type ZipArchive,
} from '@airalogy/aira-core'
import {
  AimdEditor,
  collectAimdFigureIds,
  createAimdFigureId,
  type AimdEditorImageRequest,
} from '@airalogy/aimd-editor'
import {
  collectAimdRecordFieldRefs,
  filterAimdRecords,
  type AimdRecordFieldRef,
  type AimdRecordFilterOperator,
} from '@airalogy/aimd-core/utils'
import {
  AimdRecorder,
  AimdRecorderWysiwygSurface,
  createEmptyProtocolRecordData,
  createAimdRecorderMessages,
  type AimdCollectorProviderMap,
  type AimdProtocolRecordData,
} from '@airalogy/aimd-recorder'
import {
  AimdRecordCompare,
  AimdRecordTable,
  parseAndExtract,
  renderToVue,
  type AimdRecordViewKey,
} from '@airalogy/aimd-renderer'
import DemoExamplePicker from '../components/DemoExamplePicker.vue'
import WorkspaceFieldDetailsToggle from '../components/WorkspaceFieldDetailsToggle.vue'
import WorkspaceImportButton from '../components/WorkspaceImportButton.vue'
import { useDemoLocale, useDemoMessages, type DemoLocale } from '../composables/demoI18n'
import {
  DEFAULT_DEMO_EXAMPLE_ID,
  getDemoExample,
  resolveDemoExampleAsset,
  resolveDemoExampleValue,
  useDemoExampleContent,
} from '../composables/sampleContent'
import { demoResourceResolvers } from '../composables/demoResourceResolvers'
import { createEditorProtocolDownload } from '../composables/editorProtocolDownload'
import { createEditorDraftStorage } from '../composables/editorDraftStorage'
import { useEditorDisplayPreferences } from '../composables/useEditorDisplayPreferences'
import { createEditorRecordDownload, prepareEditorProtocolSnapshot, protocolFingerprint, recordSignature, stableRecordJson,
  type EditorProtocolIdentity, type EditorRecordIdentity, type EditorRecordFile } from '../composables/editorRecordDownload'
import '@airalogy/aimd-renderer/styles'
import '@airalogy/aimd-recorder/styles'

let simulatedCollectorTemperature = 22.4
const collectorProviders: AimdCollectorProviderMap = {
  demo_sensor_gateway: {
    async read({ collector }) {
      simulatedCollectorTemperature += collector.mode === 'polling' ? 0.1 : 0.2
      return {
        value: Number(simulatedCollectorTemperature.toFixed(1)),
        device_id: collector.channel || 'demo-thermometer',
        quality: 'simulated',
        metadata: { demo: true },
      }
    },
  },
}

interface ProtocolFigureFile {
  id: string
  index: number
  title: string
  path: string
  file: File
  previewUrl: string
}

interface StoredProtocolFigureFile {
  id: string
  index: number
  title: string
  path: string
  name: string
  type: string
  lastModified: number
  blob: Blob
}

interface EditorDraftRecord {
  id: string
  content: string
  selectedExampleId: string
  activeTemplateExampleId: string | null
  activeTemplateLocale: DemoLocale
  insertedFigureIds: string[]
  uploadedFigureSerial: number
  files: StoredProtocolFigureFile[]
  updatedAt: string
  version?: 2
  recorderData?: AimdProtocolRecordData
  recordIdentity?: EditorRecordIdentity | null
  protocolIdentity?: EditorProtocolIdentity
  recordFiles?: EditorRecordFile[]
  importedRecords?: ImportedRecordOption[]
  selectedRecordId?: string
}

interface FigureBlockInput {
  id: string
  src: string
  title?: string
  legend?: string
}

interface ImportedProtocolFileSource {
  path: string
  bytes: Uint8Array
}

interface ImportedProtocolPackage {
  kind: 'protocol'
  aimd: string
  fileSources: ImportedProtocolFileSource[]
  protocolIdentity?: EditorProtocolIdentity
}

interface ImportedRecordOption {
  id: string
  label: string
  protocolKey: string
  aimd: string
  fileSources: ImportedProtocolFileSource[]
  recordData: AimdProtocolRecordData
  protocolIdentity?: EditorProtocolIdentity
  recordIdentity?: EditorRecordIdentity | null
  recordFiles?: EditorRecordFile[]
  draftFiles?: StoredProtocolFigureFile[]
}

interface ImportedRecordViewOption extends ImportedRecordOption {
  data: AimdProtocolRecordData
}

interface ImportedRecordsPackage {
  kind: 'records'
  records: ImportedRecordOption[]
  selectedRecordId: string
}

interface ImportedAiraProtocolEntry {
  protocol: AiraProtocolManifest
  root: string
  path: string
}

type ImportedPackage = ImportedProtocolPackage | ImportedRecordsPackage

type FigureInsertSource = 'local' | 'remote'
type PreviewMode = 'render' | 'recorder' | 'records-table' | 'records-compare'

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
}
const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
}
const IMAGE_EXTENSION_PATTERN = /^(?:avif|gif|jpe?g|png|svg|webp)$/i
const FIGURE_POPOVER_WIDTH = 420
const FIGURE_POPOVER_GAP = 12
const EDITOR_DRAFT_DB_NAME = 'airalogy-aimd-demo-editor'
const EDITOR_DRAFT_ID = 'current'
const EDITOR_DRAFT_SAVE_DELAY_MS = 500

const { locale } = useDemoLocale()
const messages = useDemoMessages()
const {
  content,
  selectedExampleId,
  loadExample,
  resetToSelectedExample,
} = useDemoExampleContent(DEFAULT_DEMO_EXAMPLE_ID, locale)
content.value = ''
const mode = ref<'source' | 'wysiwyg'>('wysiwyg')
const previewMode = ref<PreviewMode>('recorder')
const workspaceView = ref<'edit' | 'fill' | 'split'>('edit')
const { showFieldDetails } = useEditorDisplayPreferences()
const editorRef = ref<any>(null)
const figureInputRef = ref<HTMLInputElement | null>(null)
const packageInputRef = ref<HTMLInputElement | null>(null)
const figurePopoverRef = ref<HTMLElement | null>(null)
const remoteFigureUrlInputRef = ref<HTMLInputElement | null>(null)
const protocolFiles = ref<ProtocolFigureFile[]>([])
const protocolFilesExpanded = ref(false)
const activeTemplateExampleId = ref<string | null>(null)
const activeTemplateLocale = ref<DemoLocale>(locale.value)
const archiveStatus = ref('')
const generatedFigureIdCount = ref(0)
const importedRecordOptions = ref<ImportedRecordOption[]>([])
const selectedImportedRecordId = ref('')
const importedRecordFilterQuery = ref('')
const importedRecordFilterFieldKey = ref('')
const importedRecordFilterOperator = ref<AimdRecordFilterOperator>('contains')
const importedRecordFilterExpanded = ref(false)
const selectedImportedRecordKeys = ref<AimdRecordViewKey[]>([])
const importedRecordFieldKeys = ref<string[]>([])
const showOnlyImportedRecordDifferences = ref(false)
const isPackagingArchive = ref(false)
const isImportingPackage = ref(false)
const showImageInsertPanel = ref(false)
const figureInsertSource = ref<FigureInsertSource>('local')
const localFigureFile = ref<File | null>(null)
const localFigurePreviewUrl = ref('')
const remoteFigureUrl = ref('')
const figureTitle = ref('')
const figureLegend = ref('')
const figureInsertError = ref('')
const insertedFigureIds = ref<string[]>([])
const previewNodes = ref<VNode[]>([])
const previewError = ref('')
const recorderError = ref('')
const recorderData = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
const protocolIdentity = ref<EditorProtocolIdentity>({ id: crypto.randomUUID() })
const recordIdentity = ref<EditorRecordIdentity | null>(null)
const recordFiles = ref<EditorRecordFile[]>([])
const recordFileUrls = shallowReactive(new Map<string, string>())
const draftState = ref<'loading' | 'pending' | 'saved' | 'failed'>('loading')
const recordSaveStatus = ref('')
const draftStorage = typeof indexedDB !== 'undefined'
  ? createEditorDraftStorage<EditorDraftRecord>(indexedDB, EDITOR_DRAFT_DB_NAME) : null
const figurePopoverPosition = ref({ top: 120, left: 24 })
let uploadedFigureSerial = 1
let previewRenderSerial = 0
let draftSaveTimer: ReturnType<typeof setTimeout> | null = null
let generatedFigureIdNoticeTimer: ReturnType<typeof setTimeout> | null = null
const isDraftReady = ref(false)
const draftRecoveryFailed = ref(false)
let isRestoringDraft = false

const protocolFileCount = computed(() => protocolFiles.value.length)
const importedRecordCount = computed(() => importedRecordOptions.value.length)
const selectedImportedRecord = computed(() => (
  importedRecordOptions.value.find(record => record.id === selectedImportedRecordId.value) ?? null
))
const importedRecordFieldRefs = computed<AimdRecordFieldRef[]>(() => {
  const byKey = new Map<string, AimdRecordFieldRef>()
  const parsedByAimd = new Map<string, AimdRecordFieldRef[]>()
  for (const record of importedRecordOptions.value) {
    let refs = parsedByAimd.get(record.aimd)
    if (!refs) {
      try {
        refs = collectAimdRecordFieldRefs(parseAndExtract(record.aimd))
      }
      catch {
        refs = []
      }
      parsedByAimd.set(record.aimd, refs)
    }
    for (const ref of refs) {
      if (!byKey.has(ref.key)) {
        byKey.set(ref.key, ref)
      }
    }
  }
  return [...byKey.values()]
})
const filteredImportedRecordOptions = computed(() => {
  const query = importedRecordFilterQuery.value.trim()
  if (!query) {
    return importedRecordOptions.value
  }
  return filterAimdRecords(importedRecordOptions.value, {
    fieldKey: importedRecordFilterFieldKey.value || undefined,
    operator: importedRecordFilterOperator.value,
    value: query,
  }, {
    fields: importedRecordFieldRefs.value,
    getRecordData: record => record.recordData,
  }).map(result => result.record)
})
const activeImportedRecordOptions = computed<ImportedRecordViewOption[]>(() => {
  const protocolKey = selectedImportedRecord.value?.protocolKey
  return importedRecordOptions.value
    .filter(record => !protocolKey || record.protocolKey === protocolKey)
    .map(record => ({
      ...record,
      data: record.recordData,
    }))
})
const visibleImportedRecordOptions = computed<ImportedRecordViewOption[]>(() => {
  const visibleKeys = new Set(filteredImportedRecordOptions.value.map(record => record.id))
  return activeImportedRecordOptions.value.filter(record => visibleKeys.has(record.id))
})
const selectedImportedRecords = computed<ImportedRecordViewOption[]>(() => {
  const byKey = new Map(activeImportedRecordOptions.value.map(record => [record.id, record]))
  return selectedImportedRecordKeys.value
    .map(key => byKey.get(String(key)))
    .filter((record): record is ImportedRecordViewOption => Boolean(record))
})
const canCompareImportedRecords = computed(() => selectedImportedRecords.value.length >= 2)
const hasImportedRecordCollection = computed(() => activeImportedRecordOptions.value.length > 1)
const importedRecordFilterResultLabel = computed(() => (
  importedRecordCount.value > 1 && importedRecordFilterQuery.value.trim()
    ? messages.value.pages.editor.importedRecordFilterCount(filteredImportedRecordOptions.value.length, importedRecordCount.value)
    : ''
))
const importedRecordFilterToggleLabel = computed(() => {
  const label = importedRecordFilterExpanded.value
    ? messages.value.pages.editor.hideImportedRecordFilter
    : messages.value.pages.editor.showImportedRecordFilter
  return importedRecordFilterResultLabel.value
    ? `${label} (${importedRecordFilterResultLabel.value})`
    : label
})
const isImportedRecordFilterActive = computed(() => importedRecordFilterQuery.value.trim().length > 0)
const showImportedRecordFilterPanel = computed(() => importedRecordCount.value > 1 && importedRecordFilterExpanded.value)
const protocolFileTotalSize = computed(() => protocolFiles.value.reduce((total, file) => total + file.file.size, 0))
const generatedFigureIdNotice = computed(() => (
  generatedFigureIdCount.value > 0
    ? messages.value.pages.editor.figureIdsGenerated(generatedFigureIdCount.value)
    : ''
))
const archiveStatusLabel = computed(() => generatedFigureIdNotice.value || archiveStatus.value || messages.value.pages.editor.ready)
const archiveStatusDisplayLabel = computed(() => (
  generatedFigureIdNotice.value
  || (importedRecordCount.value > 1
    ? messages.value.pages.editor.packageImportedRecordCount(importedRecordCount.value)
    : archiveStatusLabel.value)
))
const figurePopoverStyle = computed(() => ({
  top: `${figurePopoverPosition.value.top}px`,
  left: `${figurePopoverPosition.value.left}px`,
}))
const localFigurePathPreview = computed(() => (
  localFigureFile.value
    ? getUniqueFigureIdentity(localFigureFile.value, uploadedFigureSerial).path
    : ''
))
const insertFigureButtonLabel = computed(() => (
  figureInsertSource.value === 'local'
    ? messages.value.pages.editor.insertLocalFigure
    : messages.value.pages.editor.insertRemoteFigure
))
const downloadButtonLabel = computed(() => (
  protocolFileCount.value > 0
    ? messages.value.pages.editor.downloadAira
    : messages.value.pages.editor.downloadAimd
))
const isContentBlank = computed(() => content.value.trim().length === 0)
const canClearContent = computed(() => !isContentBlank.value || protocolFileCount.value > 0)
const previewPanelTitle = computed(() => (
  previewMode.value === 'recorder'
    ? messages.value.pages.editor.recorderTitle
    : previewMode.value === 'records-table'
      ? messages.value.pages.editor.recordTableTitle
      : previewMode.value === 'records-compare'
        ? messages.value.pages.editor.recordCompareTitle
        : messages.value.pages.editor.previewTitle
))

function isEditorDraftStorageAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window
}

async function readEditorDraft(): Promise<EditorDraftRecord | null> {
  return await draftStorage?.read(EDITOR_DRAFT_ID) ?? null
}

async function writeEditorDraft(draft: EditorDraftRecord): Promise<void> {
  await draftStorage?.write(draft)
}

async function deleteEditorDraft(): Promise<void> {
  await draftStorage?.clear(EDITOR_DRAFT_ID)
}

function toStoredProtocolFigureFile(file: ProtocolFigureFile): StoredProtocolFigureFile {
  return {
    id: file.id,
    index: file.index,
    title: file.title,
    path: file.path,
    name: file.file.name,
    type: file.file.type,
    lastModified: file.file.lastModified,
    blob: file.file,
  }
}

function fromStoredProtocolFigureFile(file: StoredProtocolFigureFile): ProtocolFigureFile {
  const restoredFile = new File([file.blob], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  })
  return {
    id: file.id,
    index: file.index,
    title: file.title,
    path: file.path,
    file: restoredFile,
    previewUrl: URL.createObjectURL(restoredFile),
  }
}

function hasEditorDraftContent(): boolean {
  return content.value.length > 0 || protocolFileCount.value > 0 || activeTemplateExampleId.value !== null
    || recordIdentity.value !== null || importedRecordOptions.value.length > 0 || recordFiles.value.length > 0
    || Object.values(recorderData.value).some(section => Object.keys(section).length > 0)
}

function handleEditorDraftError(error: unknown) {
  console.warn('AIMD editor draft storage failed:', error)
  archiveStatus.value = messages.value.pages.editor.draftSaveFailed
  draftState.value = 'failed'
}

function resetRecorderData() {
  recorderData.value = createEmptyProtocolRecordData()
  recorderError.value = ''
  recordIdentity.value = null
  protocolIdentity.value = { id: crypto.randomUUID() }
  setRecordFiles([])
  recordSaveStatus.value = ''
}

function setRecordFiles(files: EditorRecordFile[]) {
  for (const url of recordFileUrls.values()) URL.revokeObjectURL(url)
  recordFileUrls.clear()
  recordFiles.value = files
  for (const file of files) if (file.blob) recordFileUrls.set(file.id, URL.createObjectURL(file.blob))
}

function uploadRecordFile(file: File, context: { fieldKey: string }) {
  const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin'
  const id = `airalogy.id.file.${crypto.randomUUID()}.${extension}`
  recordFiles.value.push({ id, name: file.name, type: file.type, fieldPath: context.fieldKey.replace(':', '.'), blob: file })
  recordFileUrls.set(id, URL.createObjectURL(file))
  return id
}

function plainRecordFiles(files: EditorRecordFile[]): EditorRecordFile[] {
  return files.map(file => ({ ...file }))
}

function captureImportedRecord() {
  const current = selectedImportedRecord.value
  if (!current) return
  current.aimd = content.value
  current.recordData = cloneRecorderData(recorderData.value)
  current.recordIdentity = recordIdentity.value ? JSON.parse(JSON.stringify(recordIdentity.value)) : null
  if (recordIdentity.value) current.label = `${recordIdentity.value.id} v${recordIdentity.value.version}`
  current.protocolIdentity = { ...protocolIdentity.value }
  current.recordFiles = plainRecordFiles(recordFiles.value)
  current.draftFiles = protocolFiles.value.map(toStoredProtocolFigureFile)
}

function clearImportedRecords() {
  if (previewMode.value === 'records-table' || previewMode.value === 'records-compare') {
    previewMode.value = 'render'
  }
  importedRecordOptions.value = []
  selectedImportedRecordId.value = ''
  importedRecordFilterQuery.value = ''
  importedRecordFilterFieldKey.value = ''
  importedRecordFilterOperator.value = 'contains'
  importedRecordFilterExpanded.value = false
  selectedImportedRecordKeys.value = []
  importedRecordFieldKeys.value = []
  showOnlyImportedRecordDifferences.value = false
}

async function saveEditorDraftNow(): Promise<void> {
  if (!isDraftReady.value || isRestoringDraft) return
  if (!isEditorDraftStorageAvailable()) return

  if (!hasEditorDraftContent()) {
    await deleteEditorDraft()
    draftState.value = 'saved'
    return
  }

  captureImportedRecord()
  const generation = draftGeneration
  await writeEditorDraft({
    id: EDITOR_DRAFT_ID,
    content: content.value,
    selectedExampleId: selectedExampleId.value,
    activeTemplateExampleId: activeTemplateExampleId.value,
    activeTemplateLocale: activeTemplateLocale.value,
    insertedFigureIds: [...insertedFigureIds.value],
    uploadedFigureSerial,
    files: protocolFiles.value.map(toStoredProtocolFigureFile),
    updatedAt: new Date().toISOString(),
    version: 2,
    recorderData: cloneRecorderData(recorderData.value),
    protocolIdentity: { ...protocolIdentity.value },
    recordIdentity: recordIdentity.value ? JSON.parse(JSON.stringify(recordIdentity.value)) : null,
    recordFiles: plainRecordFiles(recordFiles.value),
    importedRecords: importedRecordOptions.value.map(record => ({ ...record,
      recordData: cloneRecorderData(record.recordData),
      recordIdentity: record.recordIdentity ? JSON.parse(JSON.stringify(record.recordIdentity)) : null,
      protocolIdentity: record.protocolIdentity ? { ...record.protocolIdentity } : undefined,
      recordFiles: plainRecordFiles(record.recordFiles ?? []),
      draftFiles: record.draftFiles?.map(file => ({ ...file })),
      fileSources: record.fileSources.map(file => ({ path: file.path, bytes: new Uint8Array(file.bytes) })),
    })),
    selectedRecordId: selectedImportedRecordId.value,
  })
  if (generation === draftGeneration) draftState.value = 'saved'
}

let draftGeneration = 0
function scheduleEditorDraftSave() {
  if (!isDraftReady.value || isRestoringDraft) return
  if (!isPackagingArchive.value) recordSaveStatus.value = ''
  draftGeneration += 1
  draftState.value = draftStorage ? 'pending' : 'failed'
  if (draftSaveTimer) {
    clearTimeout(draftSaveTimer)
  }
  draftSaveTimer = setTimeout(() => {
    draftSaveTimer = null
    void saveEditorDraftNow().catch(handleEditorDraftError)
  }, EDITOR_DRAFT_SAVE_DELAY_MS)
}

async function clearEditorDraft() {
  if (!isEditorDraftStorageAvailable()) return
  if (draftSaveTimer) {
    clearTimeout(draftSaveTimer)
    draftSaveTimer = null
  }
  await deleteEditorDraft()
}

async function restoreEditorDraft() {
  draftRecoveryFailed.value = false
  draftState.value = 'loading'
  if (!isEditorDraftStorageAvailable()) {
    isDraftReady.value = true
    draftState.value = 'failed'
    return
  }

  isRestoringDraft = true
  try {
    const draft = await readEditorDraft()
    if (!draft) return

    clearProtocolFiles()
    clearImportedRecords()
    resetRecorderData()
    content.value = draft.content
    selectedExampleId.value = draft.selectedExampleId || selectedExampleId.value
    activeTemplateExampleId.value = draft.activeTemplateExampleId
    activeTemplateLocale.value = draft.activeTemplateLocale
    insertedFigureIds.value = [...draft.insertedFigureIds]
    uploadedFigureSerial = Math.max(1, draft.uploadedFigureSerial || 1)
    protocolFiles.value = draft.files.map(fromStoredProtocolFigureFile)
    if (draft.recorderData) recorderData.value = cloneRecorderData(draft.recorderData)
    if (draft.protocolIdentity) protocolIdentity.value = draft.protocolIdentity
    recordIdentity.value = draft.recordIdentity ?? null
    setRecordFiles(draft.recordFiles ?? [])
    importedRecordOptions.value = draft.importedRecords ?? []
    selectedImportedRecordId.value = draft.selectedRecordId ?? ''
    archiveStatus.value = messages.value.pages.editor.draftRestored
  }
  catch (error) {
    handleEditorDraftError(error)
    draftRecoveryFailed.value = true
  }
  finally {
    await nextTick()
    isRestoringDraft = false
    isDraftReady.value = !draftRecoveryFailed.value
    if (!draftRecoveryFailed.value) draftState.value = 'saved'
  }
}

function handleExampleTemplateSelect(id: string) {
  if (!isDraftReady.value || isPackagingArchive.value || isImportingPackage.value) return
  clearProtocolFiles()
  clearImportedRecords()
  resetRecorderData()
  const example = loadExample(id, locale.value)
  activeTemplateExampleId.value = example.id
  activeTemplateLocale.value = locale.value
  archiveStatus.value = messages.value.pages.editor.templateLoaded
}

function loadSelectedExampleTemplate() {
  if (!isDraftReady.value || isPackagingArchive.value || isImportingPackage.value) return
  clearProtocolFiles()
  clearImportedRecords()
  resetRecorderData()
  const example = resetToSelectedExample(locale.value)
  activeTemplateExampleId.value = example.id
  activeTemplateLocale.value = locale.value
  archiveStatus.value = messages.value.pages.editor.templateLoaded
}

function onReady(editor: any) {
  console.log('Editor ready:', editor)
}

function resolvePreviewAssetUrl(src: string): string | undefined {
  const localFile = protocolFiles.value.find(file => file.path === src)
  if (localFile) {
    return localFile.previewUrl
  }

  if (!activeTemplateExampleId.value) {
    return undefined
  }

  return resolveDemoExampleAsset(
    getDemoExample(activeTemplateExampleId.value),
    activeTemplateLocale.value,
    src,
  ) ?? undefined
}

function resolveRecorderFile(src: string): string | null {
  return recordFileUrls.get(src) ?? resolvePreviewAssetUrl(src) ?? null
}

function resolveRecorderFileInfo(src: string) {
  const file = recordFiles.value.find(file => file.id === src)
  return file ? { id: file.id, name: file.name, type: file.type, size: file.blob?.size,
    url: recordFileUrls.get(src) ?? file.sourceUri } : null
}

async function renderPreview() {
  const renderSerial = ++previewRenderSerial
  try {
    previewError.value = ''
    const result = await renderToVue(content.value, {
      locale: locale.value,
      assignerVisibility: 'collapsed',
      allowDraftFigures: true,
      resolveAssetUrl: resolvePreviewAssetUrl,
    })
    if (renderSerial === previewRenderSerial) {
      previewNodes.value = result.nodes
    }
  }
  catch (error: any) {
    if (renderSerial === previewRenderSerial) {
      previewNodes.value = []
      previewError.value = error?.message || String(error)
    }
  }
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_EXTENSION_PATTERN.test(file.name.split('.').pop() || '')
}

function getImageExtension(file: File): string {
  const nameExtension = file.name.split('.').pop()?.toLowerCase()
  if (nameExtension && IMAGE_EXTENSION_PATTERN.test(nameExtension)) {
    return nameExtension === 'jpeg' ? 'jpg' : nameExtension
  }
  return IMAGE_EXTENSION_BY_MIME[file.type] ?? 'png'
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function makeFigureTitle(index: number): string {
  return locale.value === 'zh-CN' ? `上传图片 ${index}` : `Uploaded Figure ${index}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function positionFigurePopover(request?: AimdEditorImageRequest) {
  if (typeof window === 'undefined') return
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const width = Math.min(FIGURE_POPOVER_WIDTH, viewportWidth - FIGURE_POPOVER_GAP * 2)
  const rect = request?.buttonRect
  if (!rect) {
    figurePopoverPosition.value = {
      top: FIGURE_POPOVER_GAP * 2,
      left: FIGURE_POPOVER_GAP,
    }
    return
  }

  const maxTop = Math.max(FIGURE_POPOVER_GAP, viewportHeight - 280 - FIGURE_POPOVER_GAP)
  figurePopoverPosition.value = {
    top: clamp(rect.bottom + 8, FIGURE_POPOVER_GAP, maxTop),
    left: clamp(rect.left, FIGURE_POPOVER_GAP, viewportWidth - width - FIGURE_POPOVER_GAP),
  }
}

function getProtocolName(): string {
  for (const line of content.value.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('# ')) {
      return trimmed.slice(2).trim() || 'AIMD Protocol'
    }
  }
  return 'AIMD Protocol'
}

function slugify(value: string, fallback: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return slug || fallback
}

function makeResourceBaseName(value: string, fallback: string): string {
  const baseName = value
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^\.+|\.+$/g, '')
    .toLowerCase()
  return baseName || fallback
}

function getFileStem(name: string): string {
  const lastDot = name.lastIndexOf('.')
  return lastDot > 0 ? name.slice(0, lastDot) : name
}

function getPathFileName(path: string): string {
  return path.split('/').filter(Boolean).pop() || path
}

function getPathDir(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const lastSlash = normalized.lastIndexOf('/')
  return lastSlash >= 0 ? normalized.slice(0, lastSlash + 1) : ''
}

function isIgnoredZipEntry(path: string): boolean {
  const segments = path.split('/').filter(Boolean)
  return segments.includes('__MACOSX') || segments.includes('.git') || segments.some(segment => segment === '.DS_Store' || /^\.env(?:\.|$)/.test(segment) && segment !== '.env.example')
}

function isImagePath(path: string): boolean {
  return IMAGE_EXTENSION_PATTERN.test(path.split('.').pop() || '')
}

function inferImageMimeType(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() || ''
  return IMAGE_MIME_BY_EXTENSION[extension] ?? 'application/octet-stream'
}

function isAimdPath(path: string): boolean {
  return path.toLowerCase().endsWith('.aimd')
}

function chooseZipAimdEntrypoint(paths: string[]): string | null {
  const aimdPaths = paths.filter(path => isAimdPath(path) && !isIgnoredZipEntry(path)).sort((a, b) => a.localeCompare(b))
  return aimdPaths.find(path => getPathFileName(path).toLowerCase() === 'protocol.aimd')
    ?? aimdPaths.find(path => getPathFileName(path).toLowerCase() === 'index.aimd')
    ?? aimdPaths[0]
    ?? null
}

function toProtocolRelativePath(path: string, root: string): string | null {
  if (root && !path.startsWith(root)) {
    return null
  }
  const relativePath = root ? path.slice(root.length) : path
  if (!relativePath || relativePath.startsWith('/') || relativePath.split('/').some(part => part === '..')) {
    return null
  }
  if (relativePath === '_airalogy_archive' || relativePath.startsWith('_airalogy_archive/')) {
    return null
  }
  return relativePath
}

function isPlainRecordObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeArchiveRoot(root: string | null | undefined): string {
  return root?.replace(/^\/+|\/+$/g, '') ?? ''
}

function joinArchivePath(root: string, path: string): string {
  const normalizedPath = path.replace(/^\/+/g, '')
  return root ? `${root}/${normalizedPath}` : normalizedPath
}

function cloneRecordSection(value: unknown): Record<string, unknown> {
  return isPlainRecordObject(value) ? { ...value } : {}
}

function cloneRecorderData(data: AimdProtocolRecordData): AimdProtocolRecordData {
  const copy = (value: unknown): unknown => Array.isArray(value) ? value.map(copy)
    : isPlainRecordObject(value) ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)])) : value
  return copy(data) as AimdProtocolRecordData
}

function recordPayloadToRecorderData(payload: AiralogyRecordPayload | null | undefined): AimdProtocolRecordData {
  const data = isPlainRecordObject(payload?.data) ? payload.data : {}
  return {
    var: cloneRecordSection(data.var),
    step: cloneRecordSection(data.step) as AimdProtocolRecordData['step'],
    check: cloneRecordSection(data.check) as AimdProtocolRecordData['check'],
    quiz: cloneRecordSection(data.quiz),
  }
}

function collectAiraProtocolEntries(archive: AiraArchive): ImportedAiraProtocolEntry[] {
  if (archive.manifest.kind === 'protocol') {
    const protocol = archive.manifest.protocol
    if (!protocol) {
      return []
    }
    const entrypoint = protocol.entrypoint || 'protocol.aimd'
    return [{ protocol, root: '', path: entrypoint }]
  }

  const protocols = Array.isArray(archive.manifest.protocols) ? archive.manifest.protocols : []
  return protocols.map(protocol => {
    const root = normalizeArchiveRoot(protocol.archive_root)
    const entrypoint = protocol.entrypoint || 'protocol.aimd'
    return { protocol, root, path: joinArchivePath(root, entrypoint) }
  })
}

function findAiraProtocolForRecord(
  record: AiraRecordManifest,
  entries: ImportedAiraProtocolEntry[],
): ImportedAiraProtocolEntry | null {
  const embeddedRoot = normalizeArchiveRoot(record.embedded_protocol_root)
  if (embeddedRoot) {
    const match = entries.find(entry => entry.root === embeddedRoot)
    if (match) {
      return match
    }
  }

  if (record.protocol_id || record.protocol_version) {
    const exactMatch = entries.find(entry =>
      entry.protocol.protocol_id === record.protocol_id
      && entry.protocol.protocol_version === record.protocol_version,
    )
    if (exactMatch) {
      return exactMatch
    }
  }

  if (record.protocol_id) {
    const protocolIdMatches = entries.filter(entry => entry.protocol.protocol_id === record.protocol_id)
    if (protocolIdMatches.length === 1) {
      return protocolIdMatches[0]
    }
  }

  return entries.length === 1 ? entries[0] : null
}

function getImportedRecordLabel(record: AiraRecordManifest, payload: AiralogyRecordPayload | null, index: number): string {
  const id = payload?.record_id || payload?.airalogy_record_id || record.record_id || record.path || `Record ${index + 1}`
  const version = payload?.record_version ?? record.record_version
  return version === undefined || version === null ? id : `${id} v${version}`
}

function getUsedFigureIds(): string[] {
  return [
    ...collectAimdFigureIds(content.value),
    ...protocolFiles.value.map(item => item.id),
    ...insertedFigureIds.value,
  ]
}

function getUniqueFigureIdentity(file: File, index: number): Pick<ProtocolFigureFile, 'id' | 'index' | 'path'> {
  const extension = getImageExtension(file)
  const baseName = makeResourceBaseName(getFileStem(file.name), `uploaded-figure-${index}`)
  let path = `files/${baseName}.${extension}`
  let suffix = 2
  while (protocolFiles.value.some(item => item.path === path)) {
    path = `files/${baseName}-${suffix}.${extension}`
    suffix += 1
  }
  const id = createAimdFigureId(path, getUsedFigureIds())
  return { id, index, path }
}

function createUniqueFigureFile(file: File): ProtocolFigureFile {
  const index = uploadedFigureSerial
  uploadedFigureSerial += 1
  const identity = getUniqueFigureIdentity(file, index)
  return {
    ...identity,
    title: makeFigureTitle(index),
    file,
    previewUrl: URL.createObjectURL(file),
  }
}

function createImportedProtocolFile(path: string, bytes: Uint8Array, index: number): ProtocolFigureFile {
  const fileName = getPathFileName(path)
  const file = new File([bytes], fileName, {
    type: inferImageMimeType(path),
    lastModified: Date.now(),
  })
  return {
    id: createAimdFigureId(path, getUsedFigureIds()),
    index,
    title: fileName,
    path,
    file,
    previewUrl: URL.createObjectURL(file),
  }
}

function createImportedProtocolFiles(fileSources: ImportedProtocolFileSource[]): ProtocolFigureFile[] {
  return fileSources.map((source, index) => createImportedProtocolFile(source.path, source.bytes, index + 1))
}

function listAiraProtocolFiles(archive: AiraArchive, entry: ImportedAiraProtocolEntry): string[] {
  const entrypoint = entry.protocol.entrypoint || 'protocol.aimd'
  if (Array.isArray(entry.protocol.files)) {
    return entry.protocol.files
  }

  const rootPrefix = entry.root ? `${entry.root}/` : ''
  return archive.entries
    .map(item => item.name)
    .filter(path => path !== '_airalogy_archive/manifest.json')
    .filter(path => !rootPrefix || path.startsWith(rootPrefix))
    .map(path => rootPrefix ? path.slice(rootPrefix.length) : path)
    .filter(path => path && path !== entrypoint)
}

async function readAiraProtocolEntryPackage(
  archive: AiraArchive,
  entry: ImportedAiraProtocolEntry,
): Promise<Omit<ImportedProtocolPackage, 'kind'>> {
  const entrypoint = entry.protocol.entrypoint || 'protocol.aimd'
  const aimd = await archive.readText(entry.path)
  const imagePaths = listAiraProtocolFiles(archive, entry)
    .filter(path => {
      const archivePath = joinArchivePath(entry.root, path)
      return path !== entrypoint && archive.has(archivePath) && !isIgnoredZipEntry(path)
    })
    .sort((a, b) => a.localeCompare(b))

  const fileSources: ImportedProtocolFileSource[] = []
  for (const path of imagePaths) {
    fileSources.push({
      path,
      bytes: await archive.readBytes(joinArchivePath(entry.root, path)),
    })
  }

  return { aimd, fileSources, protocolIdentity: {
    id: entry.protocol.protocol_id || crypto.randomUUID(), version: entry.protocol.protocol_version,
    fingerprint: await protocolFingerprint(aimd, fileSources.map(file => ({ path: file.path, data: file.bytes }))),
  } }
}

async function readAiraProtocolPackage(archive: AiraArchive): Promise<ImportedProtocolPackage> {
  if (archive.manifest.kind !== 'protocol') {
    throw new Error(messages.value.pages.editor.packageImportUnsupportedAira)
  }

  const entry = collectAiraProtocolEntries(archive)[0]
  if (!entry) {
    throw new Error(messages.value.pages.editor.packageImportUnsupportedAira)
  }

  return {
    kind: 'protocol',
    ...await readAiraProtocolEntryPackage(archive, entry),
  }
}

async function readAiraRecordsPackage(archive: AiraArchive): Promise<ImportedRecordsPackage> {
  if (archive.manifest.kind !== 'records') {
    throw new Error(messages.value.pages.editor.packageImportUnsupportedAira)
  }

  const records = Array.isArray(archive.manifest.records) ? archive.manifest.records : []
  if (records.length === 0) {
    throw new Error(messages.value.pages.editor.packageImportNoRecords)
  }

  const protocolEntries = collectAiraProtocolEntries(archive)
  const protocolPackageCache = new Map<string, Omit<ImportedProtocolPackage, 'kind'>>()
  const importedRecords: ImportedRecordOption[] = []

  for (const [index, record] of records.entries()) {
    const protocolEntry = findAiraProtocolForRecord(record, protocolEntries)
    if (!protocolEntry) {
      throw new Error(`${messages.value.pages.editor.packageImportMissingProtocol}: ${record.path}`)
    }

    let protocolPackage = protocolPackageCache.get(protocolEntry.path)
    if (!protocolPackage) {
      protocolPackage = await readAiraProtocolEntryPackage(archive, protocolEntry)
      protocolPackageCache.set(protocolEntry.path, protocolPackage)
    }

    const payload = await archive.readJson<AiralogyRecordPayload>(record.path)
    const recordData = recordPayloadToRecorderData(payload)
    const attachedFiles: EditorRecordFile[] = []
    const fileReferences = [...archive.manifest.files ?? [], ...payload.files ?? []] as AiraFileManifest[]
    for (const file of fileReferences) {
      if (file.record_path && file.record_path !== record.path) continue
      const id = file.file_id || file.source_uri
      if (!id || attachedFiles.some(item => item.id === id)) continue
      const blob = archive.manifest.blobs?.find(item => item.blob_id === file.blob_id)
      attachedFiles.push({ id, name: file.filename || id, type: file.mime_type || 'application/octet-stream',
        ...(file.field_path ? { fieldPath: file.field_path } : {}),
        ...(file.source_uri ? { sourceUri: file.source_uri } : {}),
        ...(blob ? { blob: new Blob([await archive.readBytes(blob.archive_path)], { type: file.mime_type || '' }) } : {}),
      })
    }
    const identity: EditorRecordIdentity | null = payload?.record_id || payload?.airalogy_record_id || record.record_id
      ? { id: (payload?.record_id || payload?.airalogy_record_id || record.record_id)!,
        version: Number(payload?.record_version ?? record.record_version ?? 1),
        payload: payload ?? undefined,
        signature: recordSignature(recordData, protocolPackage.protocolIdentity!.fingerprint!),
      } : null
    importedRecords.push({
      id: record.path || `record-${index + 1}`,
      label: getImportedRecordLabel(record, payload, index),
      protocolKey: protocolEntry.path,
      aimd: protocolPackage.aimd,
      fileSources: protocolPackage.fileSources,
      recordData,
      protocolIdentity: protocolPackage.protocolIdentity,
      recordIdentity: identity,
      recordFiles: attachedFiles,
    })
  }

  return {
    kind: 'records',
    records: importedRecords,
    selectedRecordId: importedRecords[0]?.id ?? '',
  }
}

async function readAiraPackage(archive: AiraArchive): Promise<ImportedPackage> {
  if (archive.manifest.kind === 'protocol') {
    return readAiraProtocolPackage(archive)
  }
  if (archive.manifest.kind === 'records') {
    return readAiraRecordsPackage(archive)
  }
  throw new Error(messages.value.pages.editor.packageImportUnsupportedAira)
}

async function readZipFolderPackage(archive: ZipArchive): Promise<ImportedProtocolPackage> {
  const entryNames = archive.entries.map(entry => entry.name)
  const entrypoint = chooseZipAimdEntrypoint(entryNames)
  if (!entrypoint) {
    throw new Error(messages.value.pages.editor.packageImportNoAimd)
  }

  const root = getPathDir(entrypoint)
  const aimd = await archive.readText(entrypoint)
  const imageEntries = entryNames
    .filter(path => path !== entrypoint && !isIgnoredZipEntry(path))
    .map(path => ({ path, relativePath: toProtocolRelativePath(path, root) }))
    .filter((item): item is { path: string; relativePath: string } => (
      typeof item.relativePath === 'string'
    ))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))

  const fileSources: ImportedProtocolFileSource[] = []
  for (const item of imageEntries) {
    fileSources.push({
      path: item.relativePath,
      bytes: await archive.readBytes(item.path),
    })
  }

  return { kind: 'protocol', aimd, fileSources }
}

async function readProtocolPackage(file: File): Promise<ImportedPackage> {
  let airaArchive: AiraArchive | null = null
  try {
    airaArchive = await openAiraArchive(file)
  }
  catch (error) { if (file.name.toLowerCase().endsWith('.aira')) throw error }

  if (airaArchive) {
    const result = await airaArchive.validate()
    if (!result.ok) throw new Error(result.issues.join('\n'))
    return readAiraPackage(airaArchive)
  }

  return readZipFolderPackage(await openZipArchive(file))
}

function applyImportedProtocolPackage(protocolPackage: ImportedProtocolPackage) {
  clearImportedRecords()
  clearProtocolFiles()
  resetRecorderData()
  if (protocolPackage.protocolIdentity) protocolIdentity.value = protocolPackage.protocolIdentity
  activeTemplateExampleId.value = null
  content.value = protocolPackage.aimd
  const files = createImportedProtocolFiles(protocolPackage.fileSources)
  protocolFiles.value = files
  protocolFilesExpanded.value = false
  uploadedFigureSerial = Math.max(files.length + 1, 1)
  archiveStatus.value = `${messages.value.pages.editor.packageImported}: ${files.length}`
}

function applyImportedRecordOption(record: ImportedRecordOption) {
  clearProtocolFiles()
  activeTemplateExampleId.value = null
  content.value = record.aimd
  const files = record.draftFiles ? record.draftFiles.map(fromStoredProtocolFigureFile) : createImportedProtocolFiles(record.fileSources)
  protocolFiles.value = files
  protocolFilesExpanded.value = false
  uploadedFigureSerial = Math.max(files.length + 1, 1)
  recorderData.value = cloneRecorderData(record.recordData)
  protocolIdentity.value = record.protocolIdentity ?? { id: crypto.randomUUID() }
  recordIdentity.value = record.recordIdentity ?? null
  setRecordFiles(record.recordFiles ?? [])
  recorderError.value = ''
  previewMode.value = 'recorder'
  archiveStatus.value = `${messages.value.pages.editor.packageImportedRecords}: ${record.label}`
}

function applyImportedRecordsPackage(packageData: ImportedRecordsPackage) {
  clearImportedRecords()
  importedRecordOptions.value = packageData.records
  selectedImportedRecordId.value = packageData.selectedRecordId
  const selectedRecord = packageData.records.find(record => record.id === packageData.selectedRecordId) ?? packageData.records[0]
  if (selectedRecord) {
    applyImportedRecordOption(selectedRecord)
    workspaceView.value = 'split'
    const sameProtocolRecordCount = packageData.records.filter(record => record.protocolKey === selectedRecord.protocolKey).length
    previewMode.value = sameProtocolRecordCount > 1 ? 'records-table' : 'recorder'
  }
}

function applyImportedPackage(packageData: ImportedPackage) {
  if (packageData.kind === 'records') {
    applyImportedRecordsPackage(packageData)
    return
  }
  applyImportedProtocolPackage(packageData)
}

function toggleImportedRecordFilter() {
  importedRecordFilterExpanded.value = !importedRecordFilterExpanded.value
}

function handleImportedRecordSelected(event: Event) {
  const selectedId = (event.target as HTMLSelectElement).value
  const selectedRecord = importedRecordOptions.value.find(record => record.id === selectedId)
  if (!selectedRecord) {
    return
  }
  captureImportedRecord()
  selectedImportedRecordId.value = selectedId
  applyImportedRecordOption(selectedRecord)
}

function getImportedRecordViewKey(record: unknown): AimdRecordViewKey {
  return (record as ImportedRecordViewOption).id
}

function getImportedRecordViewLabel(record: unknown): string {
  return (record as ImportedRecordViewOption).label
}

function openImportedRecord(record: unknown) {
  const importedRecord = record as ImportedRecordViewOption
  const selectedRecord = importedRecordOptions.value.find(option => option.id === importedRecord.id)
  if (!selectedRecord) {
    return
  }
  captureImportedRecord()
  selectedImportedRecordId.value = selectedRecord.id
  applyImportedRecordOption(selectedRecord)
}

function toAimdScalar(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '""'
  if (/[:#\[\]\{\},&*!?|><=@`]/.test(trimmed) || /^\s|\s$/.test(value) || /["']/.test(trimmed)) {
    return JSON.stringify(trimmed)
  }
  return trimmed
}

function buildFigureBlock(figure: FigureBlockInput): string {
  const lines = [
    '```fig',
    `id: ${toAimdScalar(figure.id)}`,
    `src: ${toAimdScalar(figure.src)}`,
  ]
  if (figure.title) {
    lines.push(`title: ${toAimdScalar(figure.title)}`)
  }
  if (figure.legend) {
    lines.push(`legend: ${toAimdScalar(figure.legend)}`)
  }
  lines.push('```')
  return lines.join('\n')
}

function insertFigureBlock(figure: FigureBlockInput) {
  const block = `\n\n${buildFigureBlock(figure)}\n`
  if (editorRef.value?.insertText) {
    editorRef.value.insertText(block)
    return
  }
  content.value = `${content.value.trimEnd()}${block}`
}

function getFigureMetadata(): Pick<FigureBlockInput, 'title' | 'legend'> {
  return {
    title: figureTitle.value.trim() || undefined,
    legend: figureLegend.value.trim() || undefined,
  }
}

function insertProtocolFigureBlock(figureFile: ProtocolFigureFile, metadata: Pick<FigureBlockInput, 'title' | 'legend'> = {}) {
  insertFigureBlock({
    id: figureFile.id,
    src: figureFile.path,
    title: metadata.title,
    legend: metadata.legend,
  })
}

function revokeSelectedLocalFigurePreview() {
  if (localFigurePreviewUrl.value) {
    URL.revokeObjectURL(localFigurePreviewUrl.value)
  }
  localFigurePreviewUrl.value = ''
}

function resetFigureInsertForm() {
  revokeSelectedLocalFigurePreview()
  figureInsertSource.value = 'local'
  localFigureFile.value = null
  remoteFigureUrl.value = ''
  figureTitle.value = ''
  figureLegend.value = ''
  figureInsertError.value = ''
}

function revokeProtocolFilePreviews() {
  for (const item of protocolFiles.value) {
    URL.revokeObjectURL(item.previewUrl)
  }
}

function clearProtocolFiles() {
  revokeProtocolFilePreviews()
  protocolFiles.value = []
  protocolFilesExpanded.value = false
  uploadedFigureSerial = 1
  archiveStatus.value = ''
  insertedFigureIds.value = []
  closeImageInsertPanel()
  figureInsertError.value = ''
}

function clearEditorContent() {
  clearProtocolFiles()
  clearImportedRecords()
  resetRecorderData()
  activeTemplateExampleId.value = null
  content.value = ''
  archiveStatus.value = messages.value.pages.editor.contentCleared
  void clearEditorDraft().catch(handleEditorDraftError)
}

function removeProtocolFile(path: string) {
  const item = protocolFiles.value.find(file => file.path === path)
  if (item) {
    URL.revokeObjectURL(item.previewUrl)
  }
  protocolFiles.value = protocolFiles.value.filter(file => file.path !== path)
  if (protocolFiles.value.length === 0) {
    protocolFilesExpanded.value = false
  }
}

function openPackageFilePicker() {
  packageInputRef.value?.click()
}

async function handlePackageFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || isImportingPackage.value) {
    return
  }

  isImportingPackage.value = true
  archiveStatus.value = messages.value.pages.editor.importingPackage
  try {
    const protocolPackage = await readProtocolPackage(file)
    applyImportedPackage(protocolPackage)
  }
  catch (error: any) {
    archiveStatus.value = `${messages.value.pages.editor.packageImportFailed}: ${error?.message || String(error)}`
  }
  finally {
    isImportingPackage.value = false
  }
}

function openFigureFilePicker() {
  figureInputRef.value?.click()
}

function closeImageInsertPanel() {
  showImageInsertPanel.value = false
  resetFigureInsertForm()
}

function setFigureInsertSource(source: FigureInsertSource) {
  figureInsertSource.value = source
  figureInsertError.value = ''
  void nextTick(() => {
    if (source === 'remote') {
      remoteFigureUrlInputRef.value?.focus()
    }
  })
}

function openImageInsertPanel(request?: AimdEditorImageRequest) {
  positionFigurePopover(request)
  resetFigureInsertForm()
  showImageInsertPanel.value = true
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!showImageInsertPanel.value) return
  const target = event.target
  if (target instanceof Node && figurePopoverRef.value?.contains(target)) return
  closeImageInsertPanel()
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeImageInsertPanel()
  }
}

function handleFigureFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const imageFiles = Array.from(input.files ?? []).filter(isImageFile)
  input.value = ''
  if (imageFiles.length === 0) {
    figureInsertError.value = messages.value.pages.editor.uploadSkipped
    return
  }
  revokeSelectedLocalFigurePreview()
  localFigureFile.value = imageFiles[0]
  localFigurePreviewUrl.value = URL.createObjectURL(imageFiles[0])
  figureInsertError.value = ''
}

function insertLocalFigure() {
  figureInsertError.value = ''
  if (!localFigureFile.value) {
    figureInsertError.value = messages.value.pages.editor.selectLocalFigureFirst
    return
  }

  const metadata = getFigureMetadata()
  const figureFile = createUniqueFigureFile(localFigureFile.value)
  figureFile.title = metadata.title || localFigureFile.value.name
  protocolFiles.value.push(figureFile)
  insertProtocolFigureBlock(figureFile, metadata)
  closeImageInsertPanel()
  archiveStatus.value = messages.value.pages.editor.figureInserted
}

function insertRemoteFigure() {
  figureInsertError.value = ''
  const src = remoteFigureUrl.value.trim()
  let parsedUrl: URL
  try {
    parsedUrl = new URL(src)
  }
  catch {
    figureInsertError.value = messages.value.pages.editor.invalidRemoteFigureUrl
    return
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    figureInsertError.value = messages.value.pages.editor.invalidRemoteFigureUrl
    return
  }

  uploadedFigureSerial += 1
  const id = createAimdFigureId(src, getUsedFigureIds())
  insertedFigureIds.value.push(id)
  const metadata = getFigureMetadata()
  insertFigureBlock({
    id,
    src,
    title: metadata.title,
    legend: metadata.legend,
  })
  remoteFigureUrl.value = ''
  closeImageInsertPanel()
  archiveStatus.value = messages.value.pages.editor.figureInserted
}

function insertSelectedFigure() {
  if (figureInsertSource.value === 'local') {
    insertLocalFigure()
    return
  }

  insertRemoteFigure()
}

function downloadBlob(parts: BlobPart[], filename: string, type: string) {
  const blob = new Blob(parts, { type })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(href)
}

function clearGeneratedFigureIdNotice() {
  generatedFigureIdCount.value = 0
  if (generatedFigureIdNoticeTimer) {
    clearTimeout(generatedFigureIdNoticeTimer)
    generatedFigureIdNoticeTimer = null
  }
}

function showGeneratedFigureIdNotice(count: number) {
  clearGeneratedFigureIdNotice()
  if (count <= 0) return

  generatedFigureIdCount.value = count
  generatedFigureIdNoticeTimer = setTimeout(() => {
    generatedFigureIdCount.value = 0
    generatedFigureIdNoticeTimer = null
  }, 10000)
}

async function includeExampleAssets() {
  if (!activeTemplateExampleId.value) return
  const example = getDemoExample(activeTemplateExampleId.value)
  const base = resolveDemoExampleValue(example.assetBase, activeTemplateLocale.value)
  for (const [modulePath, url] of Object.entries(example.assetModules)) {
    if (!modulePath.startsWith(base)) continue
    const path = modulePath.slice(base.length)
    if (protocolFiles.value.some(file => file.path === path)) continue
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Unable to include template asset: ${path}`)
    const blob = await response.blob()
    const file = new File([blob], path.split('/').pop()!, { type: blob.type })
    protocolFiles.value.push({ id: path, index: 0, title: file.name, path, file, previewUrl: URL.createObjectURL(file) })
  }
}

async function downloadProtocolFile() {
  if (isPackagingArchive.value) return
  clearGeneratedFigureIdNotice()
  isPackagingArchive.value = true
  archiveStatus.value = messages.value.pages.editor.packagingDownload
  try {
    await includeExampleAssets()
    const files = protocolFiles.value.map(file => ({ path: file.path, data: file.file }))
    const snapshot = await prepareEditorProtocolSnapshot(content.value, files, protocolIdentity.value)
    const protocolName = getProtocolName()
    const filenameStem = slugify(protocolName, 'aimd-protocol')
    const download = await createEditorProtocolDownload({
      aimd: content.value,
      filenameStem,
      protocol: {
        protocol_id: protocolIdentity.value.id,
        protocol_version: snapshot.protocol.version,
        protocol_name: protocolName,
      },
      files,
    })
    if (download.changed) {
      content.value = download.aimd
      await nextTick()
    }
    protocolIdentity.value = snapshot.protocol
    downloadBlob([download.data], download.filename, download.mimeType)
    archiveStatus.value = download.kind === 'aimd'
      ? messages.value.pages.editor.downloadCompleteAimd
      : messages.value.pages.editor.downloadCompleteAira
    showGeneratedFigureIdNotice(download.generatedFigureIds.length)
    recordSaveStatus.value = messages.value.pages.editor.templateSaved
    await saveEditorDraftNow().catch(handleEditorDraftError)
  }
  catch (error: any) {
    archiveStatus.value = `${messages.value.pages.editor.downloadFailed}: ${error?.message || String(error)}`
    recordSaveStatus.value = archiveStatus.value
  }
  finally {
    isPackagingArchive.value = false
  }
}

async function downloadRecordFile() {
  if (isPackagingArchive.value || !content.value.trim()) return
  isPackagingArchive.value = true
  recordSaveStatus.value = messages.value.pages.editor.packagingDownload
  try {
    await includeExampleAssets()
    const download = await createEditorRecordDownload({
      aimd: content.value, data: cloneRecorderData(recorderData.value),
      protocol: { ...protocolIdentity.value }, protocolName: getProtocolName(),
      files: protocolFiles.value.map(file => ({ path: file.path, data: file.file })),
      recordFiles: plainRecordFiles(recordFiles.value), identity: recordIdentity.value,
      messages: createAimdRecorderMessages(locale.value).validation,
    })
    content.value = download.aimd
    recorderData.value = download.data
    protocolIdentity.value = download.protocol
    recordIdentity.value = download.identity
    captureImportedRecord()
    await nextTick()
    // Persist the identity before downloading so reloads and retries never create a new record.
    await saveEditorDraftNow().catch(handleEditorDraftError)
    downloadBlob([download.bytes], download.filename, 'application/vnd.airalogy.archive+zip')
    recordSaveStatus.value = messages.value.pages.editor.recordSaved(download.identity.version)
    if (download.externalFileCount) recordSaveStatus.value += ` ${messages.value.pages.editor.externalRecordFiles(download.externalFileCount)}`
    showGeneratedFigureIdNotice(download.generatedFigureIds.length)
  }
  catch (error) {
    recordSaveStatus.value = `${messages.value.pages.editor.recordSaveFailed}: ${error instanceof Error ? error.message : String(error)}`
  }
  finally { isPackagingArchive.value = false }
}

watch([content, locale, protocolFileCount], renderPreview, { immediate: true })
watch([content, locale], () => {
  recorderError.value = ''
})
watch([importedRecordFilterQuery, importedRecordFilterFieldKey, importedRecordFilterOperator], () => {
  if (isRestoringDraft) return
  const records = filteredImportedRecordOptions.value
  if (importedRecordCount.value <= 1 || records.length === 0) {
    return
  }
  if (records.some(record => record.id === selectedImportedRecordId.value)) {
    return
  }
  captureImportedRecord()
  selectedImportedRecordId.value = records[0].id
  applyImportedRecordOption(records[0])
})
watch([content, protocolFileCount, activeTemplateExampleId, activeTemplateLocale], scheduleEditorDraftSave)
watch([recorderData, recordFiles, recordIdentity, protocolIdentity, selectedImportedRecordId], scheduleEditorDraftSave, { deep: true })

function handleEditorPageHide() {
  if (draftSaveTimer) {
    clearTimeout(draftSaveTimer)
    draftSaveTimer = null
  }
  void saveEditorDraftNow().catch(error => console.warn('AIMD editor draft pagehide save failed:', error))
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
  window.addEventListener('pagehide', handleEditorPageHide)
  void restoreEditorDraft()
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
  window.removeEventListener('pagehide', handleEditorPageHide)
  handleEditorPageHide()
  clearGeneratedFigureIdNotice()
  revokeSelectedLocalFigurePreview()
  revokeProtocolFilePreviews()
  for (const url of recordFileUrls.values()) URL.revokeObjectURL(url)
})
</script>

<template>
  <div class="demo-page">
    <h2 class="page-title">{{ messages.pages.editor.title }}</h2>

    <DemoExamplePicker
      :inert="!isDraftReady || isPackagingArchive || isImportingPackage"
      :selected-id="selectedExampleId"
      :title-label="messages.pages.editor.templatePickerTitle"
      :change-label="messages.pages.editor.changeTemplate"
      :reset-label="messages.pages.editor.loadTemplate"
      @select="handleExampleTemplateSelect"
      @reset="loadSelectedExampleTemplate"
    />
    <p class="editor-template-hint">{{ messages.pages.editor.blankTemplateHint }}</p>

    <Teleport to="body">
      <section
        v-if="showImageInsertPanel"
        ref="figurePopoverRef"
        class="figure-insert-popover"
        :style="figurePopoverStyle"
        role="dialog"
        :aria-label="messages.pages.editor.insertFigureTitle"
      >
        <div class="figure-insert-popover__header">
          <strong class="figure-insert-popover__title">{{ messages.pages.editor.insertFigureTitle }}</strong>
          <button type="button" class="figure-insert-popover__close" @click="closeImageInsertPanel">
            {{ messages.pages.editor.closePanel }}
          </button>
        </div>

        <div class="figure-source-tabs" role="tablist" :aria-label="messages.pages.editor.insertFigureTitle">
          <button
            type="button"
            :class="['figure-source-tab', { active: figureInsertSource === 'local' }]"
            role="tab"
            :aria-selected="figureInsertSource === 'local'"
            @click="setFigureInsertSource('local')"
          >
            {{ messages.pages.editor.localFigureMode }}
          </button>
          <button
            type="button"
            :class="['figure-source-tab', { active: figureInsertSource === 'remote' }]"
            role="tab"
            :aria-selected="figureInsertSource === 'remote'"
            @click="setFigureInsertSource('remote')"
          >
            {{ messages.pages.editor.remoteFigureMode }}
          </button>
        </div>

        <form class="figure-insert-form" @submit.prevent="insertSelectedFigure">
          <div v-if="figureInsertSource === 'local'" class="local-figure-panel">
            <button type="button" class="archive-button archive-button--wide" @click="openFigureFilePicker">
              {{ localFigureFile ? messages.pages.editor.changeLocalFigure : messages.pages.editor.chooseLocalFigure }}
            </button>
            <div v-if="localFigureFile" class="local-figure-card">
              <img class="local-figure-card__preview" :src="localFigurePreviewUrl" :alt="localFigureFile.name">
              <div class="local-figure-card__body">
                <strong class="local-figure-card__name">{{ localFigureFile.name }}</strong>
                <span class="local-figure-card__meta">{{ formatFileSize(localFigureFile.size) }}</span>
                <code class="local-figure-card__path">{{ localFigurePathPreview }}</code>
              </div>
            </div>
            <p v-else class="figure-insert-hint">{{ messages.pages.editor.localFigureHint }}</p>
          </div>

          <div v-else class="remote-figure-panel">
            <input
              ref="remoteFigureUrlInputRef"
              v-model="remoteFigureUrl"
              class="figure-insert-form__input"
              type="url"
              :placeholder="messages.pages.editor.remoteFigureUrl"
              required
            >
          </div>

          <div class="figure-metadata-fields">
            <input
              v-model="figureTitle"
              class="figure-insert-form__input"
              type="text"
              :placeholder="messages.pages.editor.figureTitle"
            >
            <textarea
              v-model="figureLegend"
              class="figure-insert-form__textarea"
              rows="3"
              :placeholder="messages.pages.editor.figureLegend"
            />
          </div>

          <button type="submit" class="archive-button archive-button--wide">
            {{ insertFigureButtonLabel }}
          </button>
        </form>
        <p v-if="figureInsertError" class="figure-insert-popover__error">{{ figureInsertError }}</p>
      </section>
    </Teleport>

    <div class="workspace-view-controls">
      <div class="preview-mode-tabs" role="group" :aria-label="messages.pages.editor.sourceTitle">
        <button v-for="view in (['edit', 'fill', 'split'] as const)" :key="view" type="button" class="preview-mode-tab" :class="{ 'preview-mode-tab--active': workspaceView === view }" :aria-pressed="workspaceView === view" @click="workspaceView = view">
          {{ view === 'edit' ? messages.pages.editor.editForm : view === 'fill' ? messages.pages.editor.fillForm : messages.pages.editor.splitView }}
        </button>
      </div>
      <span class="workspace-draft-status" role="status" :class="{ 'workspace-draft-status--error': draftState === 'failed' }">{{ draftState === 'saved' ? messages.pages.editor.draftSaved : draftState === 'failed' ? messages.pages.editor.draftSaveFailed : draftState === 'loading' ? messages.pages.editor.draftLoading : messages.pages.editor.draftSaving }}</span>
      <button v-if="draftRecoveryFailed" type="button" class="archive-button" @click="restoreEditorDraft">{{ messages.pages.editor.retryDraftRestore }}</button>
      <div class="workspace-save-actions">
        <button type="button" class="archive-button workspace-panel__download" :title="downloadButtonLabel" :disabled="!isDraftReady || isPackagingArchive || isImportingPackage || !content.trim()" @click="downloadProtocolFile">{{ messages.pages.editor.saveTemplate }}</button>
        <button type="button" class="archive-button archive-button--primary" :disabled="!isDraftReady || isPackagingArchive || isImportingPackage || !content.trim()" @click="downloadRecordFile">{{ messages.pages.editor.saveRecord }}</button>
      </div>
    </div>
    <p v-if="recordSaveStatus" class="workspace-save-status" role="status" aria-live="polite">{{ recordSaveStatus }}</p>
    <div class="editor-workspace" :inert="!isDraftReady || isPackagingArchive || isImportingPackage" :class="{ 'editor-workspace--single': workspaceView !== 'split' }">
      <section v-show="workspaceView !== 'fill'" class="workspace-panel workspace-panel--editor">
        <div class="workspace-panel__header workspace-panel__header--split">
          <h3 class="workspace-panel__title">{{ messages.pages.editor.sourceTitle }}</h3>
          <div class="workspace-panel__actions" aria-label="AIMD archive tools">
            <input
              ref="figureInputRef"
              class="archive-file-input"
              type="file"
              accept="image/*,.svg"
              @change="handleFigureFilesSelected"
            >
            <input
              ref="packageInputRef"
              class="archive-file-input"
              type="file"
              accept=".zip,.aira,application/zip,application/vnd.airalogy.archive+zip"
              @change="handlePackageFileSelected"
            >
            <span class="workspace-panel__status" role="status" aria-live="polite" :title="archiveStatusLabel">{{ archiveStatusDisplayLabel }}</span>
            <select
              v-if="importedRecordCount > 1"
              :value="selectedImportedRecordId"
              class="workspace-panel__record-select"
              :disabled="filteredImportedRecordOptions.length === 0"
              :aria-label="messages.pages.editor.importedRecordSelect"
              @change="handleImportedRecordSelected"
            >
              <option v-if="filteredImportedRecordOptions.length === 0" value="">
                {{ messages.pages.editor.importedRecordNoMatches }}
              </option>
              <option v-if="selectedImportedRecord && !filteredImportedRecordOptions.some(record => record.id === selectedImportedRecordId)" :value="selectedImportedRecordId" disabled>
                {{ selectedImportedRecord.label }}
              </option>
              <option v-for="record in filteredImportedRecordOptions" :key="record.id" :value="record.id">
                {{ record.label }}
              </option>
            </select>
            <button
              v-if="importedRecordCount > 1"
              type="button"
              :class="['archive-button', 'workspace-panel__record-filter-toggle', { 'workspace-panel__record-filter-toggle--active': isImportedRecordFilterActive }]"
              :aria-expanded="showImportedRecordFilterPanel"
              aria-controls="editor-record-filter"
              @click="toggleImportedRecordFilter"
            >
              {{ importedRecordFilterToggleLabel }}
            </button>
            <span v-if="protocolFileCount > 0" class="workspace-panel__status workspace-panel__file-summary">
              {{ messages.pages.editor.fileCount }}: {{ protocolFileCount }} · {{ messages.pages.editor.fileTotalSize }} {{ formatFileSize(protocolFileTotalSize) }}
            </span>
            <button
              v-if="protocolFileCount > 0"
              type="button"
              class="archive-button workspace-panel__file-toggle"
              :aria-expanded="protocolFilesExpanded"
              aria-controls="editor-protocol-file-list"
              @click="protocolFilesExpanded = !protocolFilesExpanded"
            >
              {{ protocolFilesExpanded ? messages.pages.editor.hideFiles : messages.pages.editor.showFiles }}
            </button>
            <WorkspaceImportButton
              :label="isImportingPackage ? messages.pages.editor.importingPackage : messages.pages.editor.importPackage"
              :hint="messages.pages.editor.importPackageHint"
              :disabled="isPackagingArchive || isImportingPackage"
              @click="openPackageFilePicker"
            />
            <button
              type="button"
              class="archive-button workspace-panel__clear"
              :disabled="isPackagingArchive || isImportingPackage || !canClearContent"
              @click="clearEditorContent"
            >
              {{ messages.pages.editor.clearContent }}
            </button>
            <WorkspaceFieldDetailsToggle
              v-if="workspaceView !== 'fill'"
              v-model="showFieldDetails"
              :label="messages.pages.editor.fieldDetails"
            />
          </div>
        </div>
        <div v-if="showImportedRecordFilterPanel" id="editor-record-filter" class="workspace-panel__record-filter">
          <select
            v-model="importedRecordFilterFieldKey"
            class="workspace-panel__record-filter-field"
            :aria-label="messages.pages.editor.importedRecordFilterField"
          >
            <option value="">{{ messages.pages.editor.importedRecordFilterAllFields }}</option>
            <option v-for="field in importedRecordFieldRefs" :key="field.key" :value="field.key">
              {{ field.label }}
            </option>
          </select>
          <select
            v-model="importedRecordFilterOperator"
            class="workspace-panel__record-filter-operator"
            :aria-label="messages.pages.editor.importedRecordFilterOperator"
          >
            <option value="contains">{{ messages.pages.editor.importedRecordFilterContains }}</option>
            <option value="equals">{{ messages.pages.editor.importedRecordFilterEquals }}</option>
            <option value="regex">{{ messages.pages.editor.importedRecordFilterRegex }}</option>
          </select>
          <input
            v-model="importedRecordFilterQuery"
            class="workspace-panel__record-filter-input"
            type="search"
            :placeholder="messages.pages.editor.importedRecordFilterPlaceholder"
            :aria-label="messages.pages.editor.importedRecordFilterPlaceholder"
          >
          <span v-if="importedRecordFilterResultLabel" class="workspace-panel__record-filter-count">
            {{ importedRecordFilterResultLabel }}
          </span>
        </div>
        <ul v-if="protocolFileCount > 0 && protocolFilesExpanded" id="editor-protocol-file-list" class="protocol-file-list">
          <li v-for="file in protocolFiles" :key="file.path" class="protocol-file">
            <img v-if="file.file.type.startsWith('image/')" class="protocol-file__preview" :src="file.previewUrl" :alt="file.title">
            <code class="protocol-file__path">{{ file.path }}</code>
            <span class="protocol-file__size">{{ formatFileSize(file.file.size) }}</span>
            <button type="button" class="protocol-file__remove" @click="removeProtocolFile(file.path)">
              {{ messages.pages.editor.removeFile }}
            </button>
          </li>
        </ul>
        <div class="workspace-panel__body workspace-panel__body--editor">
          <AimdEditor
            v-if="mode === 'source'"
            ref="editorRef"
            v-model="content"
            v-model:mode="mode"
            :field-display="showFieldDetails ? 'detailed' : 'compact'"
            :keep-inactive-editors-mounted="false"
            :locale="locale"
            :min-height="520"
            :enable-block-handle="true"
            image-toolbar-action="custom"
            @ready="onReady"
            @request-image="openImageInsertPanel"
          />
          <AimdRecorderWysiwygSurface
            v-else
            ref="editorRef"
            v-model:content="content"
            v-model="recorderData"
            :locale="locale"
            :field-display="showFieldDetails ? 'detailed' : 'compact'"
            :min-height="0"
            :show-mode-switch="true"
            :resolve-file="resolveRecorderFile"
            :upload-file="uploadRecordFile"
            :resolve-file-info="resolveRecorderFileInfo"
            :collector-providers="collectorProviders"
            :resource-resolvers="demoResourceResolvers"
            collector-actor-id="demo-user"
            image-toolbar-action="custom"
            @switch-mode="mode = $event"
            @edit-field="mode = 'source'"
            @ready="onReady"
            @request-image="openImageInsertPanel"
            @error="recorderError = $event"
          />
        </div>
      </section>

      <section v-show="workspaceView !== 'edit'" class="workspace-panel workspace-panel--preview">
        <div class="workspace-panel__header workspace-panel__header--split">
          <h3 class="workspace-panel__title">{{ previewPanelTitle }}</h3>
          <div class="workspace-panel__view-actions">
            <div class="preview-mode-tabs" :aria-label="messages.pages.editor.previewModeLabel">
              <button
                type="button"
                :class="['preview-mode-tab', { 'preview-mode-tab--active': previewMode === 'render' }]"
                @click="previewMode = 'render'"
              >
                {{ messages.pages.editor.renderMode }}
              </button>
              <button
                type="button"
                :class="['preview-mode-tab', { 'preview-mode-tab--active': previewMode === 'recorder' }]"
                @click="previewMode = 'recorder'"
              >
                {{ importedRecordCount > 0 ? messages.pages.editor.singleRecordMode : messages.pages.editor.recorderMode }}
              </button>
              <button
                v-if="hasImportedRecordCollection"
                type="button"
                :class="['preview-mode-tab', { 'preview-mode-tab--active': previewMode === 'records-table' }]"
                @click="previewMode = 'records-table'"
              >
                {{ messages.pages.editor.recordTableMode }}
              </button>
              <button
                v-if="hasImportedRecordCollection"
                type="button"
                :class="['preview-mode-tab', { 'preview-mode-tab--active': previewMode === 'records-compare' }]"
                :disabled="!canCompareImportedRecords"
                @click="previewMode = 'records-compare'"
              >
                {{ messages.pages.editor.recordCompareMode(selectedImportedRecords.length) }}
              </button>
            </div>
            <WorkspaceFieldDetailsToggle
              v-if="workspaceView !== 'edit'"
              v-model="showFieldDetails"
              :label="messages.pages.editor.fieldDetails"
            />
          </div>
        </div>
        <div v-if="previewMode === 'render'" class="workspace-panel__body render-preview aimd-renderer">
          <div v-if="previewError" class="preview-error">
            {{ messages.pages.editor.renderFailed }}: {{ previewError }}
          </div>
          <div v-else-if="isContentBlank" class="preview-empty">
            {{ messages.pages.editor.emptyPreview }}
          </div>
          <component v-else :is="() => previewNodes" />
        </div>
        <div v-else-if="previewMode === 'recorder'" class="workspace-panel__body recorder-preview">
          <div v-if="recorderError" class="preview-error">
            {{ messages.pages.editor.recorderFailed }}: {{ recorderError }}
          </div>
          <div v-if="isContentBlank" class="preview-empty">
            {{ messages.pages.editor.emptyRecorder }}
          </div>
          <AimdRecorder
            v-else
            v-model="recorderData"
            :content="content"
            :locale="locale"
            :field-display="showFieldDetails ? 'detailed' : 'compact'"
            :resolve-file="resolveRecorderFile"
            :upload-file="uploadRecordFile"
            :resolve-file-info="resolveRecorderFileInfo"
            :collector-providers="collectorProviders"
            :resource-resolvers="demoResourceResolvers"
            collector-actor-id="demo-user"
            @error="recorderError = $event"
          />
        </div>
        <div v-else-if="previewMode === 'records-table'" class="workspace-panel__body record-collection-preview">
          <AimdRecordTable
            v-model:selected-record-keys="selectedImportedRecordKeys"
            v-model:field-keys="importedRecordFieldKeys"
            :aimd="content"
            :records="visibleImportedRecordOptions"
            :record-key="getImportedRecordViewKey"
            :record-label="getImportedRecordViewLabel"
            :locale="locale"
            :selection-limit="4"
            @open-record="openImportedRecord"
          />
        </div>
        <div v-else class="workspace-panel__body record-collection-preview">
          <AimdRecordCompare
            v-model:show-only-differences="showOnlyImportedRecordDifferences"
            :aimd="content"
            :records="selectedImportedRecords"
            :record-key="getImportedRecordViewKey"
            :record-label="getImportedRecordViewLabel"
            :locale="locale"
            @open-record="openImportedRecord"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.demo-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a2e;
}

.editor-template-hint {
  margin-top: -4px;
  color: #667085;
  font-size: 13px;
}

.archive-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.archive-button {
  height: 34px;
  padding: 0 14px;
  border: 1px solid #c8d2df;
  border-radius: 7px;
  background: #fff;
  color: #243447;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

.archive-button:hover {
  border-color: #8ea6c2;
  background: #f8fafc;
}

.archive-button--primary {
  border-color: #1a73e8;
  background: #1a73e8;
  color: #fff;
}

.archive-button--primary:hover {
  border-color: #1765cb;
  background: #1765cb;
}

.archive-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.archive-button--wide {
  width: 100%;
}

.figure-insert-popover {
  position: fixed;
  z-index: 1000;
  display: grid;
  width: min(420px, calc(100vw - 24px));
  max-height: calc(100vh - 24px);
  gap: 12px;
  padding: 14px;
  overflow: auto;
  border: 1px solid #cbd7e6;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 18px 48px rgb(15 23 42 / 18%), 0 2px 8px rgb(15 23 42 / 8%);
}

.figure-insert-popover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.figure-insert-popover__title {
  color: #243447;
  font-size: 14px;
  font-weight: 700;
}

.figure-insert-popover__close {
  height: 30px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #5f6f84;
  font-size: 12px;
  cursor: pointer;
}

.figure-insert-popover__close:hover {
  background: #eef2f7;
  color: #243447;
}

.figure-source-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 3px;
  border: 1px solid #d7dee8;
  border-radius: 8px;
  background: #f1f5f9;
}

.figure-source-tab {
  height: 32px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #526173;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

.figure-source-tab:hover {
  color: #243447;
}

.figure-source-tab.active {
  border-color: #c8d2df;
  background: #fff;
  color: #1a73e8;
  box-shadow: 0 1px 2px rgb(15 23 42 / 6%);
}

.figure-insert-form,
.local-figure-panel,
.remote-figure-panel,
.figure-metadata-fields {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.figure-insert-form__input,
.figure-insert-form__textarea {
  min-width: 0;
  border: 1px solid #c8d2df;
  border-radius: 7px;
  background: #fff;
  color: #243447;
  font-size: 13px;
}

.figure-insert-form__input {
  height: 34px;
  padding: 0 10px;
}

.figure-insert-form__textarea {
  min-height: 72px;
  padding: 8px 10px;
  resize: vertical;
}

.figure-insert-form__input:focus,
.figure-insert-form__textarea:focus {
  border-color: #1a73e8;
  outline: none;
  box-shadow: 0 0 0 2px rgb(26 115 232 / 14%);
}

.figure-insert-hint {
  margin: 0;
  color: #68778b;
  font-size: 12px;
  line-height: 1.5;
}

.local-figure-card {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  padding: 8px;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #f8fafc;
}

.local-figure-card__preview {
  width: 56px;
  height: 56px;
  border-radius: 6px;
  object-fit: cover;
  background: #e8eef6;
}

.local-figure-card__body {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.local-figure-card__name {
  overflow: hidden;
  color: #243447;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.local-figure-card__meta {
  color: #68778b;
  font-size: 12px;
}

.local-figure-card__path {
  overflow: hidden;
  color: #405066;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.figure-insert-popover__error {
  color: #b42318;
  font-size: 13px;
}

.editor-workspace {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: minmax(360px, 1.05fr) minmax(320px, 0.95fr);
  gap: 12px;
  min-height: 0;
}

.editor-workspace--single { grid-template-columns: minmax(0, 1fr); }
.workspace-view-controls { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.workspace-save-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-left: auto; }
.workspace-draft-status { font-size: 12px; color: #57606a; }
.workspace-draft-status--error { color: #b42318; }
.workspace-save-status { margin: 0 0 8px; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; }

.workspace-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #fff;
  flex-direction: column;
}

.workspace-panel__header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  min-height: 42px;
  padding: 0 14px;
  border-bottom: 1px solid #e5edf6;
  background: #f8fafc;
}

.workspace-panel__header--split {
  align-content: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  padding-top: 5px;
  padding-bottom: 5px;
}

.workspace-panel__title {
  flex: 0 0 auto;
  color: #243447;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.workspace-panel__view-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  margin-left: auto;
}

.preview-mode-tabs {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 2px;
  padding: 2px;
  border: 1px solid #d5e2f2;
  border-radius: 7px;
  background: #eef4fb;
}

.preview-mode-tab {
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #56657a;
  cursor: pointer;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}

.preview-mode-tab:hover {
  color: #1a73e8;
}

.preview-mode-tab:disabled {
  color: #98a2b3;
  cursor: not-allowed;
}

.preview-mode-tab--active {
  background: #fff;
  color: #1a73e8;
  box-shadow: 0 1px 2px rgb(15 23 42 / 10%);
}

.workspace-panel__actions {
  display: inline-flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  min-width: 0;
}

.workspace-panel__status {
  flex: 0 1 auto;
  min-width: 0;
  max-width: min(240px, 100%);
  overflow: hidden;
  color: #667085;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-panel__record-select {
  flex: 0 1 220px;
  max-width: 220px;
  height: 32px;
  min-width: 132px;
  padding: 0 30px 0 10px;
  overflow: hidden;
  border: 1px solid #c8d2df;
  border-radius: 7px;
  background: #fff;
  color: #243447;
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
}

.workspace-panel__record-select:focus {
  border-color: #1a73e8;
  outline: none;
  box-shadow: 0 0 0 2px rgb(26 115 232 / 14%);
}

.workspace-panel__record-filter-toggle {
  height: 32px;
  border-color: #bdd3ff;
  background: #eff6ff;
  color: #1d4ed8;
}

.workspace-panel__record-filter-toggle:hover {
  border-color: #8fb6ff;
  background: #dbeafe;
}

.workspace-panel__record-filter-toggle--active {
  border-color: #1a73e8;
  background: #dbeafe;
  color: #1557b0;
}

.workspace-panel__record-filter {
  display: grid;
  grid-template-columns: minmax(150px, 0.8fr) minmax(92px, max-content) minmax(180px, 1fr) auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 7px 14px;
  border-bottom: 1px solid #e5edf6;
  background: #fff;
}

.workspace-panel__record-filter-field,
.workspace-panel__record-filter-operator,
.workspace-panel__record-filter-input {
  height: 32px;
  min-width: 0;
  border: 1px solid #c8d2df;
  border-radius: 7px;
  background: #fff;
  color: #243447;
  font-size: 13px;
}

.workspace-panel__record-filter-field {
  padding: 0 30px 0 10px;
}

.workspace-panel__record-filter-operator {
  padding: 0 28px 0 10px;
}

.workspace-panel__record-filter-input {
  padding: 0 10px;
}

.workspace-panel__record-filter-count {
  min-width: 54px;
  color: #667085;
  font-size: 12px;
  font-weight: 650;
  text-align: right;
  white-space: nowrap;
}

.workspace-panel__record-filter-field:focus,
.workspace-panel__record-filter-operator:focus,
.workspace-panel__record-filter-input:focus {
  border-color: #1a73e8;
  outline: none;
  box-shadow: 0 0 0 2px rgb(26 115 232 / 14%);
}

.workspace-panel__file-toggle {
  height: 32px;
  border-color: #bdd3ff;
  background: #eff6ff;
  color: #1d4ed8;
}

.workspace-panel__file-toggle:hover {
  border-color: #8fb6ff;
  background: #dbeafe;
}

.workspace-panel__clear {
  height: 32px;
}

.workspace-panel__download {
  height: 32px;
}

.workspace-panel__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.workspace-panel__body--editor {
  overflow: hidden;
}

.workspace-panel__body--editor :deep(.aimd-editor) {
  height: 100%;
  border: none;
  border-radius: 0;
}

.workspace-panel__body--editor :deep(.aimd-recorder-wysiwyg-surface) {
  height: 100%;
}

.workspace-panel__body--editor :deep(.aimd-recorder-wysiwyg-surface > .aimd-editor-toolbar) {
  flex-shrink: 0;
}

.workspace-panel__body--editor :deep(.aimd-recorder-wysiwyg-surface > .aimd-editor-wysiwyg-mode) {
  flex: 1 1 0;
}

.workspace-panel__body--editor :deep(.aimd-editor-panel) {
  flex: 1 1 auto;
  min-height: 0 !important;
}

.render-preview {
  padding: 0 20px 20px;
  font-size: 15px;
  overflow-wrap: anywhere;
}

.render-preview::before {
  display: block;
  height: 20px;
  content: "";
}

.recorder-preview {
  padding: 0;
  background: #f8fafc;
}

.recorder-preview :deep(.aimd-protocol-recorder) {
  --aimd-recorder-gutter-x: 14px;
  --aimd-recorder-gutter-bottom: 14px;
  min-height: 100%;
}

.record-collection-preview {
  padding: 14px;
  background: #f8fafc;
}

.record-collection-preview :deep(.aimd-record-table-view),
.record-collection-preview :deep(.aimd-record-compare) {
  background: #fff;
}

.render-preview :deep(table:not(.aimd-field__table-preview)) {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 10px 0;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: 14px;
}

.render-preview :deep(.aimd-field__table-preview) {
  display: table;
  width: 100%;
  max-width: 100%;
  overflow: visible;
  table-layout: fixed;
}

.render-preview :deep(th),
.render-preview :deep(td) {
  padding: 7px 10px;
  border: 1px solid #d7dee8;
  text-align: left;
}

.render-preview :deep(th) {
  background: #f1f5f9;
  font-weight: 700;
}

.render-preview :deep(blockquote) {
  margin: 10px 0;
  padding: 8px 14px;
  border-left: 4px solid #d9e2ec;
  color: #5f6f84;
  background: #f8fafc;
}

.render-preview :deep(code) {
  padding: 2px 4px;
  border-radius: 4px;
  background: #eef2f7;
  font-size: 0.9em;
}

.render-preview :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
}

.render-preview :deep(pre code) {
  display: block;
  width: max-content;
  min-width: 100%;
}

.preview-error {
  padding: 12px;
  border: 1px solid #fecaca;
  border-radius: 7px;
  background: #fff1f2;
  color: #b42318;
  font-size: 13px;
}

.preview-empty {
  display: grid;
  min-height: 180px;
  align-items: center;
  justify-items: center;
  border: 1px dashed #cfd9e8;
  border-radius: 8px;
  color: #667085;
  font-size: 13px;
  text-align: center;
}

.protocol-file-list {
  display: grid;
  max-height: min(360px, 46vh);
  gap: 8px;
  margin: 0;
  padding: 8px;
  overflow-y: auto;
  border-top: 1px solid #e5edf6;
  border-bottom: 1px solid #e5edf6;
  list-style: none;
}

.protocol-file {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #fff;
}

.protocol-file__preview {
  width: 42px;
  height: 42px;
  border-radius: 6px;
  object-fit: cover;
  background: #eef2f7;
}

.protocol-file__path {
  overflow: hidden;
  color: #2b3b4f;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.protocol-file__size {
  color: #6b7788;
  font-size: 12px;
  white-space: nowrap;
}

.protocol-file__remove {
  height: 30px;
  padding: 0 10px;
  border: 1px solid #d7dee8;
  border-radius: 6px;
  background: #fff;
  color: #4b5563;
  font-size: 12px;
  cursor: pointer;
}

.protocol-file__remove:hover {
  border-color: #b9c6d6;
  background: #f8fafc;
}

@media (max-width: 720px) {
  .figure-insert-form {
    align-items: stretch;
    grid-template-columns: 1fr;
  }

  .workspace-panel__header--split {
    align-items: stretch;
    padding-top: 8px;
    padding-bottom: 8px;
    flex-direction: column;
  }

  .workspace-panel__actions {
    flex-wrap: wrap;
    justify-content: space-between;
  }

  .workspace-panel__record-filter {
    grid-template-columns: 1fr;
  }

  .editor-workspace {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .workspace-panel {
    min-height: 420px;
  }

  .protocol-file-list {
    max-height: min(320px, 52vh);
  }

  .protocol-file {
    grid-template-columns: 42px minmax(0, 1fr);
  }

  .protocol-file__size,
  .protocol-file__remove {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
