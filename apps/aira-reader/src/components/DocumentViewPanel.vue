<script setup lang="ts">
import type { VNodeChild } from 'vue'
import type { AiralogyRecordPayload } from '@airalogy/aira-core'
import type { DocumentView, RecordSection } from '../reader-model'
import { formatRecordValue } from '../reader-format'
import RenderedAimdDocument from './RenderedAimdDocument'

defineProps<{
  selectedDocument: DocumentView | null
  selectedRecordPayload: AiralogyRecordPayload | null
  recordSections: RecordSection[]
  recordFieldCount: number
  selectedRecordTitle: string
  isRendering: boolean
  renderError: string
  renderedNodes: VNodeChild[]
  showFieldIds: boolean
}>()

const emit = defineEmits<{
  'select-mode': ['data']
  'update:showFieldIds': [value: boolean]
}>()

function updateShowFieldIds(event: Event): void {
  emit('update:showFieldIds', (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <div class="document-layout">
    <article class="document-panel">
      <header class="document-header">
        <div>
          <h2>{{ selectedDocument?.label || 'Document' }}</h2>
          <p>{{ selectedDocument?.subtitle || 'Rendered .aira content' }}</p>
        </div>
        <div class="document-actions">
          <label v-if="selectedRecordPayload" class="field-id-toggle" title="Show protocol field identifiers">
            <input :checked="showFieldIds" type="checkbox" @change="updateShowFieldIds">
            <span>Show field IDs</span>
          </label>
          <button
            v-if="selectedRecordPayload"
            type="button"
            class="secondary-action"
            @click="emit('select-mode', 'data')"
          >
            Data
          </button>
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

    <details v-if="selectedRecordPayload" class="record-summary-panel">
      <summary>
        <span>
          <strong>Data summary</strong>
          <small>
            {{ recordFieldCount }} field{{ recordFieldCount === 1 ? '' : 's' }}
            · {{ recordSections.length }} section{{ recordSections.length === 1 ? '' : 's' }}
            · {{ selectedRecordTitle }}
          </small>
        </span>
      </summary>
      <div v-if="recordSections.length" class="record-section-list record-section-list--summary">
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
    </details>
  </div>
</template>
