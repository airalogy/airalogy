<script setup lang="ts">
import type { DocumentView } from '../reader-model'
import { desktopFileName } from '../reader-format'

type ViewMode = 'document' | 'data' | 'diagnostics'

defineProps<{
  mode: ViewMode
  validationOk: boolean | null
  validationIssues: string[]
  desktopOpenNotice: string
  documentViews: DocumentView[]
  selectedDocumentId: string
  isDesktopApp: boolean
  recentDesktopPaths: string[]
  activeDesktopPath: string
}>()

const emit = defineEmits<{
  'select-mode': [mode: ViewMode]
  'select-document': [id: string]
  'open-desktop-path': [path: string]
}>()
</script>

<template>
  <aside class="sidebar">
    <div class="status" :class="{ ok: validationOk, warn: validationOk === false }">
      <strong>{{ validationOk ? 'Valid archive' : 'Review required' }}</strong>
      <span>{{ validationIssues.length }} issue{{ validationIssues.length === 1 ? '' : 's' }}</span>
    </div>

    <p v-if="desktopOpenNotice" class="notice-text">{{ desktopOpenNotice }}</p>

    <nav class="nav-list" aria-label="Reader sections">
      <button :class="{ active: mode === 'document' }" @click="emit('select-mode', 'document')">Document</button>
      <button :class="{ active: mode === 'data' }" @click="emit('select-mode', 'data')">Data</button>
      <button :class="{ active: mode === 'diagnostics' }" @click="emit('select-mode', 'diagnostics')">Diagnostics</button>
    </nav>

    <div v-if="documentViews.length" class="document-list">
      <h2>Documents</h2>
      <button
        v-for="view in documentViews"
        :key="view.id"
        :class="{ active: selectedDocumentId === view.id }"
        @click="emit('select-document', view.id)"
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
        @click="emit('open-desktop-path', path)"
      >
        <span>{{ desktopFileName(path) }}</span>
        <small>{{ path }}</small>
      </button>
    </div>
  </aside>
</template>
