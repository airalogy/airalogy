<script setup lang="ts">
import { computed, ref } from 'vue'
import { type AiraArchive, AIRA_MANIFEST_PATH, openAiraArchive, prettyPrintJson } from '@airalogy/aira-core'

type ViewMode = 'overview' | 'manifest' | 'protocols' | 'records' | 'members'

const archive = ref<AiraArchive | null>(null)
const fileName = ref('')
const mode = ref<ViewMode>('overview')
const selectedPath = ref(AIRA_MANIFEST_PATH)
const selectedContent = ref('')
const selectedError = ref('')
const loadError = ref('')
const isDragging = ref(false)
const validationIssues = ref<string[]>([])
const validationOk = ref<boolean | null>(null)
const isBusy = ref(false)

const summary = computed(() => archive.value?.summary() ?? null)
const manifest = computed(() => archive.value?.manifest ?? null)
const records = computed(() => Array.isArray(manifest.value?.records) ? manifest.value.records : [])
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

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

async function loadSelected(path: string): Promise<void> {
  selectedPath.value = path
  selectedContent.value = ''
  selectedError.value = ''
  if (!archive.value) {
    return
  }
  try {
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
  selectedContent.value = ''
  selectedError.value = ''
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
          </header>
          <p v-if="selectedError" class="error-text">{{ selectedError }}</p>
          <pre v-else>{{ selectedContent }}</pre>
        </article>
      </section>
    </section>
  </main>
</template>
