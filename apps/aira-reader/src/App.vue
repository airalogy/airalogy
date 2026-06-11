<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { type AiraArchive, AIRA_MANIFEST_PATH, openAiraArchive, prettyPrintJson } from '@airalogy/aira-core'
import { type DesktopBridge, createDesktopBridge } from './desktop'

type ViewMode = 'overview' | 'manifest' | 'protocols' | 'records' | 'files' | 'members'

const archive = ref<AiraArchive | null>(null)
const fileName = ref('')
const mode = ref<ViewMode>('overview')
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
const desktopBridge = ref<DesktopBridge | null>(null)

const summary = computed(() => archive.value?.summary() ?? null)
const manifest = computed(() => archive.value?.manifest ?? null)
const records = computed(() => Array.isArray(manifest.value?.records) ? manifest.value.records : [])
const fileRefs = computed(() => Array.isArray(manifest.value?.files) ? manifest.value.files : [])
const blobs = computed(() => Array.isArray(manifest.value?.blobs) ? manifest.value.blobs : [])
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
const protocols = computed(() => {
  if (!manifest.value) {
    return []
  }
  if (manifest.value.kind === 'protocol') {
    return manifest.value.protocol ? [manifest.value.protocol] : []
  }
  return Array.isArray(manifest.value.protocols) ? manifest.value.protocols : []
})
const entries = computed(() => [...(archive.value?.entries ?? [])].sort((a, b) => a.name.localeCompare(b.name)))

function clearSelectedObjectUrl(): void {
  if (selectedObjectUrl.value) {
    URL.revokeObjectURL(selectedObjectUrl.value)
  }
  selectedObjectUrl.value = ''
}

function resetSelectedPreview(): void {
  clearSelectedObjectUrl()
  selectedContent.value = ''
  selectedError.value = ''
  selectedPreviewKind.value = 'text'
  selectedDownloadName.value = ''
  selectedMimeType.value = ''
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

function blobPathForId(blobId: string | null | undefined): string | null {
  return blobId ? blobPathById.value.get(blobId) ?? null : null
}

function loadBlobForId(blobId: string | null | undefined): void {
  const path = blobPathForId(blobId)
  if (path) {
    void loadSelected(path)
  }
}

function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
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

async function openFile(file: File): Promise<void> {
  isBusy.value = true
  loadError.value = ''
  resetSelectedPreview()
  try {
    const opened = await openAiraArchive(file)
    archive.value = opened
    fileName.value = file.name
    mode.value = 'overview'
    const validation = await opened.validate()
    validationOk.value = validation.ok
    validationIssues.value = validation.issues
    await loadSelected(AIRA_MANIFEST_PATH)
  }
  catch (error) {
    archive.value = null
    validationOk.value = null
    validationIssues.value = []
    loadError.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    isBusy.value = false
  }
}

async function openDesktopPath(path: string): Promise<void> {
  if (!desktopBridge.value) {
    return
  }
  isBusy.value = true
  loadError.value = ''
  try {
    const file = await desktopBridge.value.readFilePath(path)
    await openFile(file)
  }
  catch (error) {
    archive.value = null
    validationOk.value = null
    validationIssues.value = []
    loadError.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    isBusy.value = false
  }
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
    if (paths[0]) {
      void openDesktopPath(paths[0])
    }
  })
  const initialPaths = await desktopBridge.value.initialFilePaths()
  if (initialPaths[0]) {
    await openDesktopPath(initialPaths[0])
  }
})

onBeforeUnmount(() => {
  desktopBridge.value?.dispose()
  clearSelectedObjectUrl()
})
</script>

<template>
  <main class="reader-shell">
    <header class="topbar">
      <div>
        <h1>Airalogy Reader</h1>
        <p>{{ fileName || 'Open a .aira archive locally in your browser.' }}</p>
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
        <strong>{{ isBusy ? 'Opening archive...' : 'Drop a .aira file here' }}</strong>
        <span>Protocol, records, manifest, lineage, and assets stay on this computer.</span>
        <p v-if="loadError" class="error-text">{{ loadError }}</p>
      </div>
    </section>

    <section v-else class="workspace">
      <aside class="sidebar">
        <div class="status" :class="{ ok: validationOk, warn: validationOk === false }">
          <strong>{{ validationOk ? 'Valid archive' : 'Review required' }}</strong>
          <span>{{ validationIssues.length }} issue{{ validationIssues.length === 1 ? '' : 's' }}</span>
        </div>

        <nav class="nav-list" aria-label="Reader sections">
          <button :class="{ active: mode === 'overview' }" @click="selectMode('overview')">Overview</button>
          <button :class="{ active: mode === 'manifest' }" @click="selectMode('manifest')">Manifest</button>
          <button :class="{ active: mode === 'protocols' }" @click="selectMode('protocols')">Protocols</button>
          <button :class="{ active: mode === 'records' }" @click="selectMode('records')">Records</button>
          <button :class="{ active: mode === 'files' }" @click="selectMode('files')">Files</button>
          <button :class="{ active: mode === 'members' }" @click="selectMode('members')">Members</button>
        </nav>

        <div class="member-list">
          <h2>Archive Files</h2>
          <button
            v-for="entry in entries"
            :key="entry.name"
            :class="{ active: selectedPath === entry.name }"
            @click="loadSelected(entry.name)"
          >
            <span>{{ entry.name }}</span>
            <small>{{ formatBytes(entry.uncompressedSize) }}</small>
          </button>
        </div>
      </aside>

      <section class="content">
        <div v-if="mode === 'overview'" class="panel-grid">
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

        <div v-else-if="mode === 'manifest'" class="details-layout">
          <article class="wide-panel">
            <h2>Manifest</h2>
            <pre>{{ prettyPrintJson(manifest) }}</pre>
          </article>
        </div>

        <div v-else-if="mode === 'protocols'" class="details-layout">
          <article v-for="protocol in protocols" :key="`${protocol.protocol_id}-${protocol.protocol_version}-${protocol.archive_root}`" class="wide-panel">
            <h2>{{ protocol.protocol_name || protocol.protocol_id || 'Protocol' }}</h2>
            <dl>
              <dt>ID</dt>
              <dd>{{ protocol.protocol_id || 'unknown' }}</dd>
              <dt>Version</dt>
              <dd>{{ protocol.protocol_version || 'unversioned' }}</dd>
              <dt>Entrypoint</dt>
              <dd>{{ protocol.entrypoint || 'protocol.aimd' }}</dd>
              <dt>Files</dt>
              <dd>{{ protocol.files?.length || 0 }}</dd>
            </dl>
          </article>
        </div>

        <div v-else-if="mode === 'records'" class="details-layout">
          <article v-for="record in records" :key="record.path" class="record-row">
            <button @click="loadSelected(record.path)">
              <strong>{{ record.record_id || record.path }}</strong>
              <span>{{ record.protocol_id || 'no protocol' }} · {{ record.path }}</span>
            </button>
          </article>
          <article v-if="records.length === 0" class="wide-panel">
            <p>This archive does not contain record entries.</p>
          </article>
        </div>

        <div v-else-if="mode === 'files'" class="details-layout">
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
            <h2>Offline Blobs</h2>
            <table v-if="blobs.length">
              <thead>
                <tr>
                  <th>Blob</th>
                  <th>Size</th>
                  <th>Path</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="blob in blobs" :key="blob.blob_id">
                  <td>{{ blob.blob_id }}</td>
                  <td>{{ formatBytes(blob.size || 0) }}</td>
                  <td>
                    <button class="inline-link" @click="loadSelected(blob.archive_path)">
                      {{ blob.archive_path }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-else>This archive does not contain offline blob payloads.</p>
          </article>
        </div>

        <div v-else class="details-layout">
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
                  <td>{{ entry.name }}</td>
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
      </section>
    </section>
  </main>
</template>
