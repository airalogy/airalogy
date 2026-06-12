<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  type VNodeChild,
} from 'vue'
import {
  type AiraArchive,
  AIRA_MANIFEST_PATH,
  openAiraArchive,
  prettyPrintJson,
} from '@airalogy/aira-core'
import '@airalogy/aimd-renderer/styles'
import type { ReadonlyRecordAsset } from '@airalogy/aimd-renderer'
import DataViewPanel from './components/DataViewPanel.vue'
import DiagnosticsViewPanel from './components/DiagnosticsViewPanel.vue'
import DocumentViewPanel from './components/DocumentViewPanel.vue'
import ReaderSidebar from './components/ReaderSidebar.vue'
import { type DesktopBridge, createDesktopBridge } from './desktop'
import {
  createRecordAssetResolver,
  normalizePayloadFileRef,
  registerRecordAsset,
  type RecordFileReference,
} from './reader-assets'
import {
  buildDocumentViews,
  buildRecordSections,
  collectProtocolEntries,
  normalizeRecordString,
  recordLabel,
  type DocumentView,
} from './reader-model'
import {
  arrayBufferFromBytes,
  desktopFileName,
  formatBytes,
  isTextLikePayload,
} from './reader-format'
import airalogyLogoUrl from '../src-tauri/icons/icon.svg'

type ViewMode = 'document' | 'data' | 'diagnostics'

const MAX_RECENT_DESKTOP_PATHS = 8

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
const entries = computed(() => [...(archive.value?.entries ?? [])].sort((a, b) => a.name.localeCompare(b.name)))
const selectedDocument = computed(() => documentViews.value.find(view => view.id === selectedDocumentId.value) ?? null)
const selectedRecordPayload = computed(() => selectedDocument.value?.recordPayload ?? null)
const recordSections = computed(() => buildRecordSections(selectedRecordPayload.value?.data))
const recordFieldCount = computed(() => recordSections.value.reduce((total, section) => total + section.entries.length, 0))
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

async function loadDocumentViews(opened: AiraArchive): Promise<void> {
  const views = await buildDocumentViews(opened)
  documentViews.value = views
  selectedDocumentId.value = views[0]?.id ?? ''
  await renderSelectedDocument()
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
      <ReaderSidebar
        :mode="mode"
        :validation-ok="validationOk"
        :validation-issues="validationIssues"
        :desktop-open-notice="desktopOpenNotice"
        :document-views="documentViews"
        :selected-document-id="selectedDocumentId"
        :is-desktop-app="isDesktopApp"
        :recent-desktop-paths="recentDesktopPaths"
        :active-desktop-path="activeDesktopPath"
        @select-mode="selectMode"
        @select-document="selectDocumentView"
        @open-desktop-path="openDesktopPath"
      />

      <section class="content">
        <DocumentViewPanel
          v-if="mode === 'document'"
          v-model:show-field-ids="showFieldIds"
          :selected-document="selectedDocument"
          :selected-record-payload="selectedRecordPayload"
          :record-sections="recordSections"
          :record-field-count="recordFieldCount"
          :selected-record-title="selectedRecordTitle"
          :is-rendering="isRendering"
          :render-error="renderError"
          :rendered-nodes="renderedNodes"
          @select-mode="selectMode"
        />

        <DataViewPanel
          v-else-if="mode === 'data'"
          :selected-record-payload="selectedRecordPayload"
          :selected-record-title="selectedRecordTitle"
          :selected-document="selectedDocument"
          :record-sections="recordSections"
        />

        <DiagnosticsViewPanel
          v-else
          :summary="summary"
          :validation-issues="validationIssues"
          :protocol-entries="protocolEntries"
          :records="records"
          :file-refs="fileRefs"
          :entries="entries"
          :selected-path="selectedPath"
          :selected-error="selectedError"
          :selected-preview-kind="selectedPreviewKind"
          :selected-object-url="selectedObjectUrl"
          :selected-download-name="selectedDownloadName"
          :selected-mime-type="selectedMimeType"
          :selected-content="selectedContent"
          :blob-path-for-id="blobPathForId"
          @load-selected="loadSelected"
          @load-blob="loadBlobForId"
        />
      </section>
    </section>
  </main>
</template>
