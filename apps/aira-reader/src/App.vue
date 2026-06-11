<script setup lang="ts">
import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  type PropType,
  ref,
  shallowRef,
  type VNodeChild,
} from 'vue'
import {
  type AiraArchive,
  type AiraFileManifest,
  type AiralogyRecordPayload,
  AIRA_MANIFEST_PATH,
  type AiraManifest,
  type AiraProtocolManifest,
  type AiraRecordManifest,
  openAiraArchive,
  prettyPrintJson,
} from '@airalogy/aira-core'
import '@airalogy/aimd-renderer/styles'
import type { ReadonlyRecordAsset, ReadonlyRecordAssetResolveContext } from '@airalogy/aimd-renderer'
import { type DesktopBridge, createDesktopBridge } from './desktop'
import airalogyLogoUrl from '../src-tauri/icons/icon.svg'

type ViewMode = 'document' | 'data' | 'diagnostics'

type ProtocolEntry = {
  protocol: AiraProtocolManifest
  root: string
  path: string
  label: string
}

type DocumentView = {
  id: string
  kind: 'protocol' | 'record'
  label: string
  subtitle: string
  protocol?: AiraProtocolManifest
  protocolPath: string
  protocolContent: string
  record?: AiraRecordManifest
  recordPayload?: AiralogyRecordPayload | null
  loadError?: string
}

type RecordSection = {
  key: string
  label: string
  entries: Array<{ key: string, value: unknown }>
}

type RecordFileReference = AiraFileManifest & {
  record_id?: string | null
  path?: string | null
}

type RecordAssetResolver = (context: ReadonlyRecordAssetResolveContext) => ReadonlyRecordAsset | null

const MAX_RECENT_DESKTOP_PATHS = 8
const RECORD_SECTION_LABELS: Record<string, string> = {
  var: 'Variables',
  var_table: 'Tables',
  step: 'Steps',
  check: 'Checks',
  quiz: 'Quiz',
}

const RenderedAimdDocument = defineComponent({
  name: 'RenderedAimdDocument',
  props: {
    nodes: {
      type: Array as PropType<VNodeChild[]>,
      required: true,
    },
    showFieldIds: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    return () => h('div', {
      class: [
        'rendered-aimd-document',
        { 'rendered-aimd-document--show-field-ids': props.showFieldIds },
      ],
    }, props.nodes)
  },
})

const archive = ref<AiraArchive | null>(null)
const fileName = ref('')
const mode = ref<ViewMode>('document')
const selectedPath = ref(AIRA_MANIFEST_PATH)
const selectedContent = ref('')
const selectedError = ref('')
const selectedPreviewKind = ref<'text' | 'image' | 'download'>('text')
const selectedObjectUrl = ref('')
const selectedDownloadName = ref('')
const selectedMimeType = ref('')
const loadError = ref('')
const isDragging = ref(false)
const validationIssues = ref<string[]>([])
const validationOk = ref<boolean | null>(null)
const isBusy = ref(false)
const isRendering = ref(false)
const desktopBridge = ref<DesktopBridge | null>(null)
const recentDesktopPaths = ref<string[]>([])
const activeDesktopPath = ref('')
const desktopOpenNotice = ref('')
const documentViews = ref<DocumentView[]>([])
const selectedDocumentId = ref('')
const renderedNodes = shallowRef<VNodeChild[]>([])
const renderError = ref('')
const showFieldIds = ref(false)
let renderRequestId = 0
const recordAssetObjectUrls = new Set<string>()

const summary = computed(() => archive.value?.summary() ?? null)
const manifest = computed(() => archive.value?.manifest ?? null)
const records = computed(() => Array.isArray(manifest.value?.records) ? manifest.value.records : [])
const fileRefs = computed(() => Array.isArray(manifest.value?.files) ? manifest.value.files : [])
const blobs = computed(() => Array.isArray(manifest.value?.blobs) ? manifest.value.blobs : [])
const protocolEntries = computed(() => manifest.value ? collectProtocolEntries(manifest.value) : [])
const protocols = computed(() => protocolEntries.value.map(entry => entry.protocol))
const entries = computed(() => [...(archive.value?.entries ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
const selectedDocument = computed(() => documentViews.value.find(view => view.id === selectedDocumentId.value) ?? null)
const selectedRecordPayload = computed(() => selectedDocument.value?.recordPayload ?? null)
const recordSections = computed(() => buildRecordSections(selectedRecordPayload.value?.data))
const selectedRecordTitle = computed(() => {
  const view = selectedDocument.value
  if (!view?.record) {
    return ''
  }
  return recordLabel(view.record, view.recordPayload)
})
const blobPathById = computed(() => {
  const items = new Map<string, string>()
  for (const blob of blobs.value) {
    items.set(blob.blob_id, blob.archive_path)
  }
  return items
})
const fileRefByBlobId = computed(() => {
  const items = new Map<string, (typeof fileRefs.value)[number]>()
  for (const fileRef of fileRefs.value) {
    if (fileRef.blob_id && !items.has(fileRef.blob_id)) {
      items.set(fileRef.blob_id, fileRef)
    }
  }
  return items
})
const isDesktopApp = computed(() => Boolean(desktopBridge.value))
const headerSubtitle = computed(() => {
  if (fileName.value) {
    return fileName.value
  }
  return isDesktopApp.value
    ? 'Open a .aira archive from Finder, Open With, or this window.'
    : 'Open a .aira archive locally in your browser.'
})
const dropHelpText = computed(() => isDesktopApp.value
  ? 'Rendered protocol and record data stay on this computer.'
  : 'Rendered protocol, records, and archive assets stay on this computer.')

function clearSelectedObjectUrl(): void {
  if (selectedObjectUrl.value) {
    URL.revokeObjectURL(selectedObjectUrl.value)
  }
  selectedObjectUrl.value = ''
}

function revokeObjectUrls(urls: Iterable<string>): void {
  for (const url of urls) {
    URL.revokeObjectURL(url)
  }
}

function clearRecordAssetObjectUrls(): void {
  revokeObjectUrls(recordAssetObjectUrls)
  recordAssetObjectUrls.clear()
}

function resetSelectedPreview(): void {
  clearSelectedObjectUrl()
  selectedContent.value = ''
  selectedError.value = ''
  selectedPreviewKind.value = 'text'
  selectedDownloadName.value = ''
  selectedMimeType.value = ''
}

function resetDocumentState(): void {
  clearRecordAssetObjectUrls()
  documentViews.value = []
  selectedDocumentId.value = ''
  renderedNodes.value = []
  renderError.value = ''
}

function normalizeRecordString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function formatRecordValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (isPlainObject(value) && 'value' in value) {
    return formatRecordValue(value.value)
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return prettyPrintJson(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function buildRecordSections(data: AiralogyRecordPayload['data'] | undefined): RecordSection[] {
  if (!isPlainObject(data)) {
    return []
  }
  return Object.entries(RECORD_SECTION_LABELS)
    .map(([key, label]) => {
      const section = data[key]
      const entries = isPlainObject(section)
        ? Object.entries(section).map(([entryKey, value]) => ({ key: entryKey, value }))
        : []
      return { key, label, entries }
    })
    .filter(section => section.entries.length > 0)
}

function blobPathForId(blobId: string | null | undefined): string | null {
  return blobId ? blobPathById.value.get(blobId) ?? null : null
}

function loadBlobForId(blobId: string | null | undefined): void {
  const path = blobPathForId(blobId)
  if (path) {
    void loadSelected(path)
    mode.value = 'diagnostics'
  }
}

function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

function getFileRefString(fileRef: Record<string, unknown>, key: string): string | undefined {
  return normalizeRecordString(fileRef[key])
}

function getFileRefNumber(fileRef: Record<string, unknown>, key: string): number | undefined {
  const value = fileRef[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function normalizePayloadFileRef(value: unknown): RecordFileReference | null {
  if (!isPlainObject(value)) {
    return null
  }
  return {
    file_id: getFileRefString(value, 'file_id') ?? getFileRefString(value, 'fileId') ?? null,
    source_uri: getFileRefString(value, 'source_uri') ?? getFileRefString(value, 'sourceUri') ?? null,
    blob_id: getFileRefString(value, 'blob_id') ?? getFileRefString(value, 'blobId') ?? null,
    filename: getFileRefString(value, 'filename') ?? getFileRefString(value, 'file_name') ?? getFileRefString(value, 'fileName') ?? null,
    mime_type: getFileRefString(value, 'mime_type') ?? getFileRefString(value, 'mimeType') ?? null,
    size: getFileRefNumber(value, 'size') ?? null,
    record_path: getFileRefString(value, 'record_path') ?? getFileRefString(value, 'recordPath') ?? null,
    field_path: getFileRefString(value, 'field_path') ?? getFileRefString(value, 'fieldPath') ?? null,
    record_id: getFileRefString(value, 'record_id') ?? getFileRefString(value, 'recordId') ?? null,
    path: getFileRefString(value, 'path') ?? null,
  }
}

function selectedRecordIds(view: DocumentView): string[] {
  return [
    view.record?.record_id,
    view.recordPayload?.record_id,
    view.recordPayload?.airalogy_record_id,
  ]
    .map(value => normalizeRecordString(value))
    .filter((value): value is string => Boolean(value))
}

function fileRefMatchesDocumentView(fileRef: RecordFileReference, view: DocumentView): boolean {
  if (fileRef.record_path && view.record?.path && fileRef.record_path !== view.record.path) {
    return false
  }
  if (fileRef.record_id) {
    const recordIds = selectedRecordIds(view)
    return recordIds.length === 0 || recordIds.includes(fileRef.record_id)
  }
  return true
}

function collectDocumentFileRefs(view: DocumentView): RecordFileReference[] {
  const manifestFileRefs = fileRefs.value
    .filter(fileRef => fileRefMatchesDocumentView(fileRef, view))
  const payloadFileRefs = Array.isArray(view.recordPayload?.files)
    ? view.recordPayload.files
        .map(normalizePayloadFileRef)
        .filter((fileRef): fileRef is RecordFileReference => Boolean(fileRef && fileRefMatchesDocumentView(fileRef, view)))
    : []
  return [...manifestFileRefs, ...payloadFileRefs]
}

function fieldIdFromPath(fieldPath: string | null | undefined): string | undefined {
  const normalized = normalizeRecordString(fieldPath)
  if (!normalized) {
    return undefined
  }
  const parts = normalized.split('.').filter(Boolean)
  return parts.length >= 3 && parts[0] === 'data' ? parts.at(-1) : undefined
}

function assetKeysForFileRef(fileRef: RecordFileReference): string[] {
  return [
    fileRef.file_id,
    fileRef.blob_id,
    fileRef.source_uri,
    fileRef.field_path,
    fieldIdFromPath(fileRef.field_path),
  ]
    .map(value => normalizeRecordString(value))
    .filter((value): value is string => Boolean(value))
}

function registerRecordAsset(
  assets: Map<string, ReadonlyRecordAsset>,
  fileRef: RecordFileReference,
  asset: ReadonlyRecordAsset,
): void {
  for (const key of assetKeysForFileRef(fileRef)) {
    if (!assets.has(key)) {
      assets.set(key, asset)
    }
  }
}

async function createRecordAssetForFileRef(
  fileRef: RecordFileReference,
  requestObjectUrls: string[],
): Promise<ReadonlyRecordAsset | null> {
  const name = normalizeRecordString(fileRef.filename)
    ?? normalizeRecordString(fileRef.file_id)
    ?? normalizeRecordString(fileRef.source_uri)
    ?? normalizeRecordString(fileRef.blob_id)
    ?? 'file'
  const mimeType = normalizeRecordString(fileRef.mime_type) ?? 'application/octet-stream'
  const blobPath = blobPathForId(fileRef.blob_id)
  if (archive.value && blobPath) {
    try {
      const bytes = await archive.value.readBytes(blobPath)
      const payload = new Blob([arrayBufferFromBytes(bytes)], { type: mimeType })
      const url = URL.createObjectURL(payload)
      requestObjectUrls.push(url)
      return {
        url,
        href: url,
        name,
        filename: normalizeRecordString(fileRef.filename) ?? name,
        mimeType,
        size: fileRef.size ?? bytes.byteLength,
        downloadName: normalizeRecordString(fileRef.filename) ?? name,
      }
    }
    catch {
      // Keep rendering the document even if one referenced blob is unavailable.
    }
  }

  const sourceUri = normalizeRecordString(fileRef.source_uri)
  if (sourceUri) {
    return {
      href: sourceUri,
      name,
      filename: normalizeRecordString(fileRef.filename) ?? name,
      mimeType,
      size: fileRef.size ?? undefined,
      downloadName: normalizeRecordString(fileRef.filename) ?? name,
    }
  }

  return null
}

async function prepareRecordAssetMap(
  view: DocumentView,
  requestObjectUrls: string[],
): Promise<Map<string, ReadonlyRecordAsset>> {
  const assets = new Map<string, ReadonlyRecordAsset>()
  for (const fileRef of collectDocumentFileRefs(view)) {
    const asset = await createRecordAssetForFileRef(fileRef, requestObjectUrls)
    if (asset) {
      registerRecordAsset(assets, fileRef, asset)
    }
  }
  return assets
}

function readRecordAssetValueKey(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return normalizeRecordString(value)
  }
  if (!isPlainObject(value)) {
    return undefined
  }
  return [
    value.file_id,
    value.fileId,
    value.blob_id,
    value.blobId,
    value.source_uri,
    value.sourceUri,
    value.id,
    value.src,
    value.url,
    value.href,
  ]
    .map(item => normalizeRecordString(item))
    .find(Boolean)
}

function createRecordAssetResolver(
  assets: Map<string, ReadonlyRecordAsset>,
): RecordAssetResolver {
  return (context) => {
    const candidates = [
      context.fileId,
      readRecordAssetValueKey(context.normalizedValue),
      readRecordAssetValueKey(context.value),
      context.fieldPath,
      `data.${context.scope}.${context.fieldId}`,
      context.fieldId,
    ]
      .map(value => normalizeRecordString(value))
      .filter((value): value is string => Boolean(value))

    for (const key of candidates) {
      const asset = assets.get(key)
      if (asset) {
        return asset
      }
    }
    return null
  }
}

function desktopFileName(path: string): string {
  const normalized = path.replaceAll('\\', '/')
  return normalized.split('/').filter(Boolean).at(-1) || path
}

function dedupePathList(paths: string[]): string[] {
  const deduped: string[] = []
  for (const path of paths) {
    if (path && !deduped.includes(path)) {
      deduped.push(path)
    }
  }
  return deduped
}

function rememberDesktopPaths(paths: string[]): void {
  recentDesktopPaths.value = dedupePathList([...paths, ...recentDesktopPaths.value])
    .slice(0, MAX_RECENT_DESKTOP_PATHS)
}

function normalizeArchiveRoot(root: string | null | undefined): string {
  return root?.replace(/^\/+|\/+$/g, '') ?? ''
}

function joinArchivePath(root: string, path: string): string {
  const normalizedPath = path.replace(/^\/+/g, '')
  return root ? `${root}/${normalizedPath}` : normalizedPath
}

function protocolLabel(protocol: AiraProtocolManifest | undefined, fallback = 'Protocol'): string {
  return protocol?.protocol_name || protocol?.protocol_id || fallback
}

function recordLabel(record: AiraRecordManifest, payload: AiralogyRecordPayload | null | undefined): string {
  return payload?.record_id || record.record_id || record.path
}

function collectProtocolEntries(source: AiraManifest): ProtocolEntry[] {
  if (source.kind === 'protocol') {
    if (!source.protocol) {
      return []
    }
    const entrypoint = source.protocol.entrypoint || 'protocol.aimd'
    return [{
      protocol: source.protocol,
      root: '',
      path: entrypoint,
      label: protocolLabel(source.protocol),
    }]
  }
  const protocols = Array.isArray(source.protocols) ? source.protocols : []
  return protocols.map((protocol, index) => {
    const root = normalizeArchiveRoot(protocol.archive_root)
    const entrypoint = protocol.entrypoint || 'protocol.aimd'
    return {
      protocol,
      root,
      path: joinArchivePath(root, entrypoint),
      label: protocolLabel(protocol, `Protocol ${index + 1}`),
    }
  })
}

function findProtocolForRecord(record: AiraRecordManifest, entries: ProtocolEntry[]): ProtocolEntry | null {
  const embeddedRoot = normalizeArchiveRoot(record.embedded_protocol_root)
  if (embeddedRoot) {
    const match = entries.find(entry => entry.root === embeddedRoot)
    if (match) {
      return match
    }
  }
  return entries.find(entry =>
    entry.protocol.protocol_id === record.protocol_id
    && entry.protocol.protocol_version === record.protocol_version,
  ) ?? entries.find(entry => entry.protocol.protocol_id === record.protocol_id) ?? null
}

function isTextLikePayload(path: string, fileName: string, mimeType: string): boolean {
  const mime = mimeType.toLowerCase()
  if (
    mime.startsWith('text/')
    || mime.includes('json')
    || mime.includes('xml')
    || mime.includes('csv')
    || mime.includes('yaml')
    || mime.includes('toml')
  ) {
    return true
  }
  const name = `${path} ${fileName}`.toLowerCase()
  return ['.txt', '.md', '.csv', '.tsv', '.json', '.jsonl', '.xml', '.yaml', '.yml', '.toml', '.aimd']
    .some(suffix => name.endsWith(suffix))
}

async function loadProtocolContent(opened: AiraArchive, entry: ProtocolEntry | null): Promise<{ content: string, error?: string }> {
  if (!entry) {
    return { content: '', error: 'This record does not reference a protocol included in the archive.' }
  }
  try {
    return { content: await opened.readText(entry.path) }
  }
  catch (error) {
    return {
      content: '',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function loadDocumentViews(opened: AiraArchive): Promise<void> {
  const protocolEntries = collectProtocolEntries(opened.manifest)
  const views: DocumentView[] = []

  if (opened.manifest.kind === 'records') {
    const records = Array.isArray(opened.manifest.records) ? opened.manifest.records : []
    for (const record of records) {
      const protocolEntry = findProtocolForRecord(record, protocolEntries)
      const payloadResult = await loadRecordPayload(opened, record)
      const protocolResult = await loadProtocolContent(opened, protocolEntry)
      const label = recordLabel(record, payloadResult.payload)
      views.push({
        id: `record:${record.path}`,
        kind: 'record',
        label,
        subtitle: `${protocolEntry?.label || record.protocol_id || 'Protocol'} · Record`,
        protocol: protocolEntry?.protocol,
        protocolPath: protocolEntry?.path ?? '',
        protocolContent: protocolResult.content,
        record,
        recordPayload: payloadResult.payload,
        loadError: payloadResult.error || protocolResult.error,
      })
    }
  }
  else {
    for (const [index, protocolEntry] of protocolEntries.entries()) {
      const protocolResult = await loadProtocolContent(opened, protocolEntry)
      views.push({
        id: `protocol:${protocolEntry.path || index}`,
        kind: 'protocol',
        label: protocolEntry.label,
        subtitle: 'Protocol',
        protocol: protocolEntry.protocol,
        protocolPath: protocolEntry.path,
        protocolContent: protocolResult.content,
        loadError: protocolResult.error,
      })
    }
  }

  documentViews.value = views
  selectedDocumentId.value = views[0]?.id ?? ''
  await renderSelectedDocument()
}

async function loadRecordPayload(
  opened: AiraArchive,
  record: AiraRecordManifest,
): Promise<{ payload: AiralogyRecordPayload | null, error?: string }> {
  try {
    return { payload: await opened.readJson<AiralogyRecordPayload>(record.path) }
  }
  catch (error) {
    return {
      payload: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function renderSelectedDocument(): Promise<void> {
  const view = selectedDocument.value
  renderedNodes.value = []
  renderError.value = ''
  clearRecordAssetObjectUrls()
  if (!view) {
    return
  }
  if (!view.protocolContent) {
    renderError.value = view.loadError || 'No renderable AIMD protocol was found in this archive.'
    return
  }

  const requestId = ++renderRequestId
  const requestObjectUrls: string[] = []
  isRendering.value = true
  try {
    const { renderReadonlyRecordToVue, renderToVue } = await import('@airalogy/aimd-renderer')
    const renderOptions = {
      gfm: true,
      math: true,
      breaks: true,
      groupStepBodies: true,
      groupCheckBodies: true,
    }
    const recordAssets = view.recordPayload
      ? await prepareRecordAssetMap(view, requestObjectUrls)
      : null
    if (requestId !== renderRequestId) {
      revokeObjectUrls(requestObjectUrls)
      return
    }
    const result = view.recordPayload
      ? await renderReadonlyRecordToVue(view.protocolContent, view.recordPayload, {
          ...renderOptions,
          resolveAsset: createRecordAssetResolver(recordAssets ?? new Map()),
        })
      : await renderToVue(view.protocolContent, renderOptions)
    if (requestId === renderRequestId) {
      for (const url of requestObjectUrls) {
        recordAssetObjectUrls.add(url)
      }
      renderedNodes.value = result.nodes
      renderError.value = view.loadError || ''
    }
    else {
      revokeObjectUrls(requestObjectUrls)
    }
  }
  catch (error) {
    revokeObjectUrls(requestObjectUrls)
    if (requestId === renderRequestId) {
      renderError.value = error instanceof Error ? error.message : String(error)
    }
  }
  finally {
    if (requestId === renderRequestId) {
      isRendering.value = false
    }
  }
}

async function selectDocumentView(id: string): Promise<void> {
  selectedDocumentId.value = id
  mode.value = 'document'
  await renderSelectedDocument()
}

async function loadSelectedBlob(path: string): Promise<boolean> {
  if (!archive.value) {
    return false
  }
  const blob = blobs.value.find(item => item.archive_path === path)
  if (!blob) {
    return false
  }

  const fileRef = fileRefByBlobId.value.get(blob.blob_id)
  const bytes = await archive.value.readBytes(path)
  const mimeType = fileRef?.mime_type?.trim() || 'application/octet-stream'
  const fileName = fileRef?.filename?.trim() || blob.blob_id.replace(':', '-')
  const payload = new Blob([arrayBufferFromBytes(bytes)], { type: mimeType })

  selectedObjectUrl.value = URL.createObjectURL(payload)
  selectedDownloadName.value = fileName
  selectedMimeType.value = mimeType

  if (mimeType.toLowerCase().startsWith('image/')) {
    selectedPreviewKind.value = 'image'
    return true
  }

  if (isTextLikePayload(path, fileName, mimeType)) {
    const text = new TextDecoder('utf-8').decode(bytes)
    selectedPreviewKind.value = 'text'
    if (mimeType.toLowerCase().includes('json') || fileName.toLowerCase().endsWith('.json')) {
      selectedContent.value = prettyPrintJson(JSON.parse(text))
    }
    else {
      selectedContent.value = text
    }
    return true
  }

  selectedPreviewKind.value = 'download'
  selectedContent.value = `${fileName} · ${mimeType} · ${formatBytes(bytes.byteLength)}`
  return true
}

async function loadSelected(path: string): Promise<void> {
  selectedPath.value = path
  resetSelectedPreview()
  if (!archive.value) {
    return
  }
  try {
    if (await loadSelectedBlob(path)) {
      return
    }
    const text = await archive.value.readText(path)
    if (path.endsWith('.json')) {
      selectedContent.value = prettyPrintJson(JSON.parse(text))
    }
    else {
      selectedContent.value = text
    }
  }
  catch (error) {
    selectedError.value = error instanceof Error ? error.message : String(error)
  }
}

async function openFile(file: File, sourcePath = ''): Promise<boolean> {
  isBusy.value = true
  loadError.value = ''
  resetSelectedPreview()
  resetDocumentState()
  try {
    const opened = await openAiraArchive(file)
    archive.value = opened
    fileName.value = file.name
    mode.value = 'document'
    const validation = await opened.validate()
    validationOk.value = validation.ok
    validationIssues.value = validation.issues
    await loadSelected(AIRA_MANIFEST_PATH)
    await loadDocumentViews(opened)
    activeDesktopPath.value = sourcePath
    if (!sourcePath) {
      desktopOpenNotice.value = ''
    }
    return true
  }
  catch (error) {
    archive.value = null
    fileName.value = ''
    activeDesktopPath.value = ''
    validationOk.value = null
    validationIssues.value = []
    resetDocumentState()
    loadError.value = error instanceof Error ? error.message : String(error)
    return false
  }
  finally {
    isBusy.value = false
  }
}

async function openDesktopPath(path: string, options: { keepNotice?: boolean } = {}): Promise<boolean> {
  if (!desktopBridge.value) {
    return false
  }
  isBusy.value = true
  loadError.value = ''
  if (!options.keepNotice) {
    desktopOpenNotice.value = ''
  }
  try {
    const file = await desktopBridge.value.readFilePath(path)
    return await openFile(file, path)
  }
  catch (error) {
    archive.value = null
    fileName.value = ''
    activeDesktopPath.value = ''
    validationOk.value = null
    validationIssues.value = []
    resetDocumentState()
    loadError.value = error instanceof Error ? error.message : String(error)
    return false
  }
  finally {
    isBusy.value = false
  }
}

async function openDesktopPaths(paths: string[]): Promise<void> {
  const uniquePaths = dedupePathList(paths)
  if (!uniquePaths.length) {
    return
  }

  rememberDesktopPaths(uniquePaths)
  const firstPath = uniquePaths[0]
  desktopOpenNotice.value = uniquePaths.length > 1
    ? `${uniquePaths.length} .aira archives were received. Opened ${desktopFileName(firstPath)}; choose another from Recent .aira.`
    : ''
  await openDesktopPath(firstPath, { keepNotice: true })
}

function onFileInput(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    void openFile(file)
  }
  input.value = ''
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    void openFile(file)
  }
}

function selectMode(nextMode: ViewMode): void {
  mode.value = nextMode
}

onMounted(async () => {
  desktopBridge.value = await createDesktopBridge()
  if (!desktopBridge.value) {
    return
  }
  await desktopBridge.value.listenOpenFilePaths(paths => {
    void openDesktopPaths(paths)
  })
  const initialPaths = await desktopBridge.value.initialFilePaths()
  await openDesktopPaths(initialPaths)
})

onBeforeUnmount(() => {
  desktopBridge.value?.dispose()
  clearSelectedObjectUrl()
  clearRecordAssetObjectUrls()
})
</script>

<template>
  <main class="reader-shell">
    <header class="topbar">
      <div class="brand-lockup">
        <img class="brand-logo" :src="airalogyLogoUrl" alt="Airalogy logo">
        <div>
          <h1>Airalogy Reader</h1>
          <p>{{ headerSubtitle }}</p>
        </div>
      </div>
      <label class="upload-button">
        <input type="file" accept=".aira,application/zip" @change="onFileInput">
        Open .aira
      </label>
    </header>

    <section
      v-if="!archive"
      class="drop-zone"
      :class="{ dragging: isDragging }"
      @dragenter.prevent="isDragging = true"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop="onDrop"
    >
      <div class="drop-content">
        <img class="drop-logo" :src="airalogyLogoUrl" alt="" aria-hidden="true">
        <strong>{{ isBusy ? 'Opening archive...' : 'Drop a .aira file here' }}</strong>
        <span>{{ dropHelpText }}</span>
        <p v-if="loadError" class="error-text">{{ loadError }}</p>
        <p v-if="desktopOpenNotice" class="notice-text">{{ desktopOpenNotice }}</p>
      </div>
    </section>

    <section v-else class="workspace">
      <aside class="sidebar">
        <div class="status" :class="{ ok: validationOk, warn: validationOk === false }">
          <strong>{{ validationOk ? 'Valid archive' : 'Review required' }}</strong>
          <span>{{ validationIssues.length }} issue{{ validationIssues.length === 1 ? '' : 's' }}</span>
        </div>

        <p v-if="desktopOpenNotice" class="notice-text">{{ desktopOpenNotice }}</p>

        <nav class="nav-list" aria-label="Reader sections">
          <button :class="{ active: mode === 'document' }" @click="selectMode('document')">Document</button>
          <button :class="{ active: mode === 'data' }" @click="selectMode('data')">Data</button>
          <button :class="{ active: mode === 'diagnostics' }" @click="selectMode('diagnostics')">Diagnostics</button>
        </nav>

        <div v-if="documentViews.length" class="document-list">
          <h2>Documents</h2>
          <button
            v-for="view in documentViews"
            :key="view.id"
            :class="{ active: selectedDocumentId === view.id }"
            @click="selectDocumentView(view.id)"
          >
            <span>{{ view.label }}</span>
            <small>{{ view.subtitle }}</small>
          </button>
        </div>

        <div v-if="isDesktopApp && recentDesktopPaths.length" class="recent-list">
          <h2>Recent .aira</h2>
          <button
            v-for="path in recentDesktopPaths"
            :key="path"
            :class="{ active: activeDesktopPath === path }"
            @click="openDesktopPath(path)"
          >
            <span>{{ desktopFileName(path) }}</span>
            <small>{{ path }}</small>
          </button>
        </div>
      </aside>

      <section class="content">
        <div
          v-if="mode === 'document'"
          class="document-layout"
          :class="{ 'document-layout--single': !selectedRecordPayload }"
        >
          <article class="document-panel">
            <header class="document-header">
              <div>
                <h2>{{ selectedDocument?.label || 'Document' }}</h2>
                <p>{{ selectedDocument?.subtitle || 'Rendered .aira content' }}</p>
              </div>
              <div class="document-actions">
                <label v-if="selectedRecordPayload" class="field-id-toggle" title="Show protocol field identifiers">
                  <input v-model="showFieldIds" type="checkbox">
                  <span>Show field IDs</span>
                </label>
                <span v-if="selectedDocument?.protocolPath" class="document-source">{{ selectedDocument.protocolPath }}</span>
              </div>
            </header>
            <p v-if="isRendering" class="notice-text">Rendering protocol...</p>
            <p v-else-if="renderError" class="error-text">{{ renderError }}</p>
            <RenderedAimdDocument
              v-else-if="renderedNodes.length"
              :nodes="renderedNodes"
              :show-field-ids="showFieldIds && !!selectedRecordPayload"
            />
            <p v-else class="empty-text">This archive does not contain a renderable AIMD protocol.</p>
          </article>

          <aside v-if="selectedRecordPayload" class="record-data-panel">
            <header>
              <h2>Record Data</h2>
              <p>{{ selectedRecordTitle }}</p>
            </header>
            <div v-if="recordSections.length" class="record-section-list">
              <section v-for="section in recordSections" :key="section.key">
                <h3>{{ section.label }}</h3>
                <dl>
                  <template v-for="entry in section.entries.slice(0, 8)" :key="`${section.key}-${entry.key}`">
                    <dt>{{ entry.key }}</dt>
                    <dd><pre>{{ formatRecordValue(entry.value) }}</pre></dd>
                  </template>
                </dl>
              </section>
            </div>
            <p v-else class="empty-text">This record does not contain filled field data.</p>
          </aside>
        </div>

        <div v-else-if="mode === 'data'" class="data-layout">
          <article class="wide-panel">
            <h2>{{ selectedRecordPayload ? 'Record Data' : 'Data' }}</h2>
            <p v-if="!selectedRecordPayload" class="empty-text">Select a record-backed document to view captured data.</p>
            <dl v-else>
              <dt>Record</dt>
              <dd>{{ selectedRecordTitle }}</dd>
              <dt>Protocol</dt>
              <dd>{{ selectedDocument?.protocol?.protocol_name || selectedDocument?.record?.protocol_id || 'unknown' }}</dd>
              <dt>Version</dt>
              <dd>{{ selectedDocument?.record?.protocol_version || selectedDocument?.protocol?.protocol_version || 'unversioned' }}</dd>
            </dl>
          </article>

          <article
            v-for="section in recordSections"
            :key="section.key"
            class="wide-panel"
          >
            <h2>{{ section.label }}</h2>
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in section.entries" :key="entry.key">
                  <td>{{ entry.key }}</td>
                  <td><pre>{{ formatRecordValue(entry.value) }}</pre></td>
                </tr>
              </tbody>
            </table>
          </article>

          <article v-if="selectedRecordPayload && recordSections.length === 0" class="wide-panel">
            <p>This record does not contain filled field data.</p>
          </article>
        </div>

        <div v-else class="diagnostics-layout">
          <div class="panel-grid">
            <article class="metric">
              <span>Kind</span>
              <strong>{{ summary?.kind }}</strong>
            </article>
            <article class="metric">
              <span>Records</span>
              <strong>{{ summary?.recordCount }}</strong>
            </article>
            <article class="metric">
              <span>Protocols</span>
              <strong>{{ summary?.protocolCount }}</strong>
            </article>
            <article class="metric">
              <span>Files</span>
              <strong>{{ summary?.fileCount }}</strong>
            </article>
            <article class="metric">
              <span>Blobs</span>
              <strong>{{ summary?.blobCount }}</strong>
            </article>
            <article class="metric">
              <span>Members</span>
              <strong>{{ summary?.memberCount }}</strong>
            </article>
            <article class="wide-panel">
              <h2>Validation</h2>
              <ul v-if="validationIssues.length" class="issue-list">
                <li v-for="issue in validationIssues" :key="issue">{{ issue }}</li>
              </ul>
              <p v-else>No manifest, member, JSON, or hash issues found.</p>
            </article>
          </div>

          <div class="details-layout">
            <article class="wide-panel">
              <h2>Protocols</h2>
              <table v-if="protocols.length">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>ID</th>
                    <th>Entrypoint</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="entry in protocolEntries" :key="entry.path">
                    <td>{{ entry.label }}</td>
                    <td>{{ entry.protocol.protocol_id || 'unknown' }}</td>
                    <td>{{ entry.path }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-else>This archive does not contain protocol entries.</p>
            </article>

            <article class="wide-panel">
              <h2>Records</h2>
              <table v-if="records.length">
                <thead>
                  <tr>
                    <th>Record</th>
                    <th>Protocol</th>
                    <th>Path</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="record in records" :key="record.path">
                    <td>{{ record.record_id || record.path }}</td>
                    <td>{{ record.protocol_id || 'no protocol' }}</td>
                    <td>
                      <button class="inline-link" @click="loadSelected(record.path)">
                        {{ record.path }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-else>This archive does not contain record entries.</p>
            </article>

            <article class="wide-panel">
              <h2>File References</h2>
              <table v-if="fileRefs.length">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Record</th>
                    <th>Blob</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(fileRef, index) in fileRefs" :key="`${fileRef.file_id || fileRef.source_uri || index}`">
                    <td>
                      <strong>{{ fileRef.filename || fileRef.file_id || fileRef.source_uri || 'file' }}</strong>
                      <span>{{ fileRef.mime_type || 'unknown type' }}</span>
                    </td>
                    <td>{{ fileRef.record_path || 'unlinked' }}<br>{{ fileRef.field_path || '' }}</td>
                    <td>
                      <button
                        v-if="blobPathForId(fileRef.blob_id)"
                        class="inline-link"
                        @click="loadBlobForId(fileRef.blob_id)"
                      >
                        {{ fileRef.blob_id }}
                      </button>
                      <span v-else>{{ fileRef.blob_id || 'reference only' }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-else>This archive does not contain file reference entries.</p>
            </article>

            <article class="wide-panel">
              <h2>Members</h2>
              <table>
                <thead>
                  <tr>
                    <th>Path</th>
                    <th>Size</th>
                    <th>Compression</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="entry in entries" :key="entry.name">
                    <td>
                      <button class="inline-link" @click="loadSelected(entry.name)">
                        {{ entry.name }}
                      </button>
                    </td>
                    <td>{{ formatBytes(entry.uncompressedSize) }}</td>
                    <td>{{ entry.compressionMethod }}</td>
                  </tr>
                </tbody>
              </table>
            </article>
          </div>

          <article class="preview-panel">
            <header>
              <h2>{{ selectedPath }}</h2>
              <a
                v-if="selectedObjectUrl"
                class="download-link"
                :href="selectedObjectUrl"
                :download="selectedDownloadName"
              >
                Download
              </a>
            </header>
            <p v-if="selectedError" class="error-text">{{ selectedError }}</p>
            <div v-else-if="selectedPreviewKind === 'image'" class="blob-preview">
              <img :src="selectedObjectUrl" :alt="selectedDownloadName">
              <dl>
                <dt>Name</dt>
                <dd>{{ selectedDownloadName }}</dd>
                <dt>Type</dt>
                <dd>{{ selectedMimeType }}</dd>
              </dl>
            </div>
            <div v-else-if="selectedPreviewKind === 'download'" class="download-panel">
              <strong>{{ selectedDownloadName }}</strong>
              <span>{{ selectedMimeType || 'application/octet-stream' }}</span>
              <a :href="selectedObjectUrl" :download="selectedDownloadName">Download file</a>
            </div>
            <pre v-else>{{ selectedContent }}</pre>
          </article>
        </div>
      </section>
    </section>
  </main>
</template>
