<script setup lang="ts">
import type {
  AiraEntry,
  AiraFileManifest,
  AiraRecordManifest,
  AiraSummary,
} from '@airalogy/aira-core'
import type { ProtocolEntry } from '../reader-model'
import { formatBytes } from '../reader-format'

defineProps<{
  summary: AiraSummary | null
  validationIssues: string[]
  protocolEntries: ProtocolEntry[]
  records: AiraRecordManifest[]
  fileRefs: AiraFileManifest[]
  entries: AiraEntry[]
  selectedPath: string
  selectedError: string
  selectedPreviewKind: 'text' | 'image' | 'download'
  selectedObjectUrl: string
  selectedDownloadName: string
  selectedMimeType: string
  selectedContent: string
  blobPathForId: (blobId: string | null | undefined) => string | null
}>()

const emit = defineEmits<{
  'load-selected': [path: string]
  'load-blob': [blobId: string | null | undefined]
}>()
</script>

<template>
  <div class="diagnostics-layout">
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
        <table v-if="protocolEntries.length">
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
                <button class="inline-link" @click="emit('load-selected', record.path)">
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
                  @click="emit('load-blob', fileRef.blob_id)"
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
                <button class="inline-link" @click="emit('load-selected', entry.name)">
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
</template>
