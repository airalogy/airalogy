<script setup lang="ts">
import type { AiralogyRecordPayload } from '@airalogy/aira-core'
import type { DocumentView, RecordSection } from '../reader-model'
import { formatRecordValue } from '../reader-format'

defineProps<{
  selectedRecordPayload: AiralogyRecordPayload | null
  selectedRecordTitle: string
  selectedDocument: DocumentView | null
  recordSections: RecordSection[]
}>()
</script>

<template>
  <div class="data-layout">
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
</template>
