<script setup lang="ts">
import type { AimdEditorMessages } from './locales'

defineProps<{
  editorMode: 'source' | 'wysiwyg'
  resolvedMessages: AimdEditorMessages
}>()

const emit = defineEmits<{
  (e: 'switch-mode', mode: 'source' | 'wysiwyg'): void
}>()

// Mode switch SVG icons
const modeSvgIcons = {
  source: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  wysiwyg: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
}
</script>

<template>
  <div class="aimd-editor-mode-switch">
    <button
      :class="['aimd-editor-mode-btn', { active: editorMode === 'source' }]"
      @click="emit('switch-mode', 'source')"
      :title="resolvedMessages.mode.sourceTitle"
    >
      <span class="aimd-editor-mode-icon" v-html="modeSvgIcons.source" />
      <span>{{ resolvedMessages.mode.source }}</span>
    </button>
    <button
      :class="['aimd-editor-mode-btn', { active: editorMode === 'wysiwyg' }]"
      @click="emit('switch-mode', 'wysiwyg')"
      :title="resolvedMessages.mode.wysiwygTitle"
    >
      <span class="aimd-editor-mode-icon" v-html="modeSvgIcons.wysiwyg" />
      <span>{{ resolvedMessages.mode.wysiwyg }}</span>
    </button>
  </div>
</template>
