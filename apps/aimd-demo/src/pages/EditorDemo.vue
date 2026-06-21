<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type VNode } from 'vue'
import { createProtocolAiraArchive } from '@airalogy/aira-core'
import { AimdEditor, type AimdEditorImageRequest } from '@airalogy/aimd-editor'
import { renderToVue } from '@airalogy/aimd-renderer'
import DemoExamplePicker from '../components/DemoExamplePicker.vue'
import { useDemoLocale, useDemoMessages, type DemoLocale } from '../composables/demoI18n'
import {
  DEFAULT_DEMO_EXAMPLE_ID,
  getDemoExample,
  resolveDemoExampleAsset,
  useDemoExampleContent,
} from '../composables/sampleContent'
import '@airalogy/aimd-renderer/styles'

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
}

interface FigureBlockInput {
  id: string
  src: string
  title?: string
  legend?: string
}

type FigureInsertSource = 'local' | 'remote'

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
}
const IMAGE_EXTENSION_PATTERN = /^(?:avif|gif|jpe?g|png|svg|webp)$/i
const FIGURE_POPOVER_WIDTH = 420
const FIGURE_POPOVER_GAP = 12
const EDITOR_DRAFT_DB_NAME = 'airalogy-aimd-demo-editor'
const EDITOR_DRAFT_DB_VERSION = 1
const EDITOR_DRAFT_STORE_NAME = 'drafts'
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
const mode = ref<'source' | 'wysiwyg'>('source')
const editorRef = ref<any>(null)
const figureInputRef = ref<HTMLInputElement | null>(null)
const figurePopoverRef = ref<HTMLElement | null>(null)
const remoteFigureUrlInputRef = ref<HTMLInputElement | null>(null)
const protocolFiles = ref<ProtocolFigureFile[]>([])
const activeTemplateExampleId = ref<string | null>(null)
const activeTemplateLocale = ref<DemoLocale>(locale.value)
const archiveStatus = ref('')
const isPackagingArchive = ref(false)
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
const figurePopoverPosition = ref({ top: 120, left: 24 })
let uploadedFigureSerial = 1
let previewRenderSerial = 0
let draftSaveTimer: ReturnType<typeof setTimeout> | null = null
let isDraftReady = false
let isRestoringDraft = false

const protocolFileCount = computed(() => protocolFiles.value.length)
const archiveStatusLabel = computed(() => archiveStatus.value || messages.value.pages.editor.ready)
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

function isEditorDraftStorageAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window
}

function openEditorDraftDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isEditorDraftStorageAvailable()) {
      reject(new Error('IndexedDB is not available'))
      return
    }

    const request = window.indexedDB.open(EDITOR_DRAFT_DB_NAME, EDITOR_DRAFT_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(EDITOR_DRAFT_STORE_NAME)) {
        db.createObjectStore(EDITOR_DRAFT_STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open editor draft database'))
  })
}

async function readEditorDraft(): Promise<EditorDraftRecord | null> {
  const db = await openEditorDraftDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(EDITOR_DRAFT_STORE_NAME, 'readonly')
    const store = transaction.objectStore(EDITOR_DRAFT_STORE_NAME)
    const request = store.get(EDITOR_DRAFT_ID)
    request.onsuccess = () => resolve((request.result as EditorDraftRecord | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('Failed to read editor draft'))
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => {
      db.close()
      reject(transaction.error ?? new Error('Failed to read editor draft'))
    }
  })
}

async function writeEditorDraft(draft: EditorDraftRecord): Promise<void> {
  const db = await openEditorDraftDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(EDITOR_DRAFT_STORE_NAME, 'readwrite')
    transaction.objectStore(EDITOR_DRAFT_STORE_NAME).put(draft)
    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onerror = () => {
      db.close()
      reject(transaction.error ?? new Error('Failed to save editor draft'))
    }
  })
}

async function deleteEditorDraft(): Promise<void> {
  const db = await openEditorDraftDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(EDITOR_DRAFT_STORE_NAME, 'readwrite')
    transaction.objectStore(EDITOR_DRAFT_STORE_NAME).delete(EDITOR_DRAFT_ID)
    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onerror = () => {
      db.close()
      reject(transaction.error ?? new Error('Failed to clear editor draft'))
    }
  })
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
}

function handleEditorDraftError(error: unknown) {
  console.warn('AIMD editor draft storage failed:', error)
  archiveStatus.value = messages.value.pages.editor.draftSaveFailed
}

async function saveEditorDraftNow(): Promise<void> {
  if (!isDraftReady || isRestoringDraft) return
  if (!isEditorDraftStorageAvailable()) return

  if (!hasEditorDraftContent()) {
    await deleteEditorDraft()
    return
  }

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
  })
}

function scheduleEditorDraftSave() {
  if (!isDraftReady || isRestoringDraft) return
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
  if (!isEditorDraftStorageAvailable()) {
    isDraftReady = true
    return
  }

  isRestoringDraft = true
  try {
    const draft = await readEditorDraft()
    if (!draft) return

    clearProtocolFiles()
    content.value = draft.content
    selectedExampleId.value = draft.selectedExampleId || selectedExampleId.value
    activeTemplateExampleId.value = draft.activeTemplateExampleId
    activeTemplateLocale.value = draft.activeTemplateLocale
    insertedFigureIds.value = [...draft.insertedFigureIds]
    uploadedFigureSerial = Math.max(1, draft.uploadedFigureSerial || 1)
    protocolFiles.value = draft.files.map(fromStoredProtocolFigureFile)
    archiveStatus.value = messages.value.pages.editor.draftRestored
  }
  catch (error) {
    handleEditorDraftError(error)
  }
  finally {
    isRestoringDraft = false
    isDraftReady = true
  }
}

function handleExampleTemplateSelect(id: string) {
  clearProtocolFiles()
  const example = loadExample(id, locale.value)
  activeTemplateExampleId.value = example.id
  activeTemplateLocale.value = locale.value
  archiveStatus.value = messages.value.pages.editor.templateLoaded
}

function loadSelectedExampleTemplate() {
  clearProtocolFiles()
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

async function renderPreview() {
  const renderSerial = ++previewRenderSerial
  try {
    previewError.value = ''
    const result = await renderToVue(content.value, {
      locale: locale.value,
      assignerVisibility: 'collapsed',
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

function makeFigureId(baseName: string, index: number): string {
  const id = baseName
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  return id || `uploaded_figure_${index}`
}

function isFigureIdUsed(id: string): boolean {
  return protocolFiles.value.some(item => item.id === id) || insertedFigureIds.value.includes(id)
}

function makeUniqueFigureId(baseName: string, index: number): string {
  const idBaseName = makeFigureId(baseName, index)
  let id = idBaseName
  let suffix = 2
  while (isFigureIdUsed(id)) {
    id = `${idBaseName}_${suffix}`
    suffix += 1
  }
  return id
}

function getUniqueFigureIdentity(file: File, index: number): Pick<ProtocolFigureFile, 'id' | 'index' | 'path'> {
  const extension = getImageExtension(file)
  const baseName = makeResourceBaseName(getFileStem(file.name), `uploaded-figure-${index}`)
  const idBaseName = makeFigureId(baseName, index)
  let path = `files/${baseName}.${extension}`
  let id = idBaseName
  let suffix = 2
  while (protocolFiles.value.some(item => item.path === path) || isFigureIdUsed(id)) {
    path = `files/${baseName}-${suffix}.${extension}`
    id = `${idBaseName}_${suffix}`
    suffix += 1
  }
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
  uploadedFigureSerial = 1
  archiveStatus.value = ''
  insertedFigureIds.value = []
  closeImageInsertPanel()
  figureInsertError.value = ''
}

function clearEditorContent() {
  clearProtocolFiles()
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

function getRemoteFigureBaseName(url: URL, index: number): string {
  const lastPathSegment = url.pathname.split('/').filter(Boolean).pop() || url.hostname || ''
  let decodedSegment = lastPathSegment
  try {
    decodedSegment = decodeURIComponent(lastPathSegment)
  }
  catch {}
  return makeResourceBaseName(getFileStem(decodedSegment), `remote-figure-${index}`)
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

  const index = uploadedFigureSerial
  uploadedFigureSerial += 1
  const baseName = getRemoteFigureBaseName(parsedUrl, index)
  const id = makeUniqueFigureId(baseName, index)
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

async function downloadProtocolFile() {
  if (isPackagingArchive.value) return
  isPackagingArchive.value = true
  archiveStatus.value = messages.value.pages.editor.packagingDownload
  try {
    const protocolName = getProtocolName()
    const filenameStem = slugify(protocolName, 'aimd-protocol')
    if (protocolFileCount.value === 0) {
      downloadBlob([content.value], `${filenameStem}.aimd`, 'text/plain;charset=utf-8')
      archiveStatus.value = messages.value.pages.editor.downloadCompleteAimd
      return
    }

    const archiveBytes = await createProtocolAiraArchive({
      aimd: content.value,
      protocol: {
        protocol_id: slugify(protocolName, selectedExampleId.value || 'aimd-protocol'),
        protocol_name: protocolName,
      },
      files: protocolFiles.value.map(file => ({
        path: file.path,
        data: file.file,
      })),
    })
    downloadBlob([archiveBytes], `${filenameStem}.aira`, 'application/vnd.airalogy.archive+zip')
    archiveStatus.value = messages.value.pages.editor.downloadCompleteAira
  }
  catch (error: any) {
    archiveStatus.value = `${messages.value.pages.editor.downloadFailed}: ${error?.message || String(error)}`
  }
  finally {
    isPackagingArchive.value = false
  }
}

watch([content, locale, protocolFileCount], renderPreview, { immediate: true })
watch([content, protocolFileCount, activeTemplateExampleId, activeTemplateLocale], scheduleEditorDraftSave)

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
  revokeSelectedLocalFigurePreview()
  revokeProtocolFilePreviews()
})
</script>

<template>
  <div class="demo-page">
    <h2 class="page-title">{{ messages.pages.editor.title }}</h2>
    <p class="page-desc">{{ messages.pages.editor.desc }}</p>

    <DemoExamplePicker
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

    <ul v-if="protocolFileCount > 0" class="protocol-file-list">
      <li v-for="file in protocolFiles" :key="file.path" class="protocol-file">
        <img class="protocol-file__preview" :src="file.previewUrl" :alt="file.title">
        <code class="protocol-file__path">{{ file.path }}</code>
        <span class="protocol-file__size">{{ formatFileSize(file.file.size) }}</span>
        <button type="button" class="protocol-file__remove" @click="removeProtocolFile(file.path)">
          {{ messages.pages.editor.removeFile }}
        </button>
      </li>
    </ul>

    <div class="editor-workspace">
      <section class="workspace-panel workspace-panel--editor">
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
            <span class="workspace-panel__status">{{ archiveStatusLabel }}</span>
            <span v-if="protocolFileCount > 0" class="workspace-panel__status">{{ messages.pages.editor.fileCount }}: {{ protocolFileCount }}</span>
            <button
              type="button"
              class="archive-button workspace-panel__clear"
              :disabled="isPackagingArchive || !canClearContent"
              @click="clearEditorContent"
            >
              {{ messages.pages.editor.clearContent }}
            </button>
            <button
              type="button"
              class="archive-button archive-button--primary workspace-panel__download"
              :disabled="isPackagingArchive"
              @click="downloadProtocolFile"
            >
              {{ isPackagingArchive ? messages.pages.editor.packagingDownload : downloadButtonLabel }}
            </button>
          </div>
        </div>
        <div class="workspace-panel__body workspace-panel__body--editor">
          <AimdEditor
            ref="editorRef"
            v-model="content"
            v-model:mode="mode"
            :locale="locale"
            :min-height="520"
            :enable-block-handle="true"
            image-toolbar-action="custom"
            @ready="onReady"
            @request-image="openImageInsertPanel"
          />
        </div>
      </section>

      <section class="workspace-panel workspace-panel--preview">
        <div class="workspace-panel__header">
          <h3 class="workspace-panel__title">{{ messages.pages.editor.previewTitle }}</h3>
        </div>
        <div class="workspace-panel__body render-preview">
          <div v-if="previewError" class="preview-error">
            {{ messages.pages.editor.renderFailed }}: {{ previewError }}
          </div>
          <div v-else-if="isContentBlank" class="preview-empty">
            {{ messages.pages.editor.emptyPreview }}
          </div>
          <component v-else :is="() => previewNodes" />
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

.page-desc {
  color: #666;
  font-size: 14px;
  margin-top: -8px;
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
  align-items: center;
  min-height: 42px;
  padding: 0 14px;
  border-bottom: 1px solid #e5edf6;
  background: #f8fafc;
}

.workspace-panel__header--split {
  justify-content: space-between;
  gap: 12px;
}

.workspace-panel__title {
  color: #243447;
  font-size: 14px;
  font-weight: 700;
}

.workspace-panel__actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.workspace-panel__status {
  color: #667085;
  font-size: 12px;
  white-space: nowrap;
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

.workspace-panel__body--editor :deep(.aimd-editor-panel) {
  flex: 1 1 auto;
  min-height: 0 !important;
}

.render-preview {
  padding: 20px;
  line-height: 1.75;
  font-size: 15px;
  overflow-wrap: anywhere;
}

.render-preview :deep(h1) {
  margin: 0.5em 0;
  color: #172033;
  font-size: 1.8em;
}

.render-preview :deep(h2) {
  margin: 0.5em 0;
  color: #243447;
  font-size: 1.4em;
}

.render-preview :deep(h3) {
  margin: 0.45em 0;
  color: #2f3f53;
  font-size: 1.18em;
}

.render-preview :deep(p) {
  margin: 0.55em 0;
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

.render-preview :deep(ul),
.render-preview :deep(ol) {
  margin: 6px 0;
  padding-left: 24px;
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
  gap: 8px;
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

  .editor-workspace {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .workspace-panel {
    min-height: 420px;
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
