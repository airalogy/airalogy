<script setup lang="ts">
import type { AimdFieldType, MdToolbarItem } from './types'
import type { AimdEditorMessages } from './locales'

defineProps<{
  showTopBar: boolean
  showMdToolbar: boolean
  showAimdToolbar: boolean
  editorMode: 'source' | 'wysiwyg'
  resolvedMessages: AimdEditorMessages
  localizedFieldTypes: AimdFieldType[]
  localizedMdToolbarItems: MdToolbarItem[]
}>()

const emit = defineEmits<{
  (e: 'switch-mode', mode: 'source' | 'wysiwyg'): void
  (e: 'md-action', action: string): void
  (e: 'open-aimd-dialog', type: string): void
  (e: 'quick-insert-aimd', type: string): void
}>()
</script>

<template>
  <div class="aimd-editor-toolbar">
    <!-- Mode switch (inside toolbar) -->
    <div v-if="showTopBar" class="aimd-editor-mode-switch">
      <button
        type="button"
        :class="['aimd-editor-mode-btn', { active: editorMode === 'source' }]"
        @click="emit('switch-mode', 'source')"
        :title="resolvedMessages.mode.sourceTitle"
      >
        <span class="aimd-editor-mode-icon" v-html="'<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;14&quot; height=&quot;14&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot; stroke-linecap=&quot;round&quot; stroke-linejoin=&quot;round&quot;><polyline points=&quot;16 18 22 12 16 6&quot;/><polyline points=&quot;8 6 2 12 8 18&quot;/></svg>'" />
        <span>{{ resolvedMessages.mode.source }}</span>
      </button>
      <button
        type="button"
        :class="['aimd-editor-mode-btn', { active: editorMode === 'wysiwyg' }]"
        @click="emit('switch-mode', 'wysiwyg')"
        :title="resolvedMessages.mode.wysiwygTitle"
      >
        <span class="aimd-editor-mode-icon" v-html="'<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;14&quot; height=&quot;14&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot; stroke-linecap=&quot;round&quot; stroke-linejoin=&quot;round&quot;><path d=&quot;M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z&quot;/><circle cx=&quot;12&quot; cy=&quot;12&quot; r=&quot;3&quot;/></svg>'" />
        <span>{{ resolvedMessages.mode.wysiwyg }}</span>
      </button>
    </div>

    <div v-if="showTopBar && showMdToolbar" class="aimd-editor-toolbar-sep" />

    <!-- Markdown buttons -->
    <template v-if="showMdToolbar">
      <template v-for="item in localizedMdToolbarItems" :key="item.action">
        <div v-if="item.action.startsWith('sep')" class="aimd-editor-toolbar-sep" />
        <button
          v-else
          type="button"
          class="aimd-editor-fmt-btn"
          :title="item.title"
          @click="emit('md-action', item.action)"
          v-html="item.svgIcon"
        />
      </template>
    </template>

    <div v-if="showMdToolbar && showAimdToolbar" class="aimd-editor-toolbar-divider" />

    <!-- AIMD buttons -->
    <template v-if="showAimdToolbar">
      <button
        v-for="ft in localizedFieldTypes"
        :key="ft.type"
        type="button"
        class="aimd-editor-fmt-btn aimd-editor-aimd-btn"
        :title="ft.desc"
        :style="{ '--aimd-color': ft.color }"
        @click="emit('open-aimd-dialog', ft.type)"
        @click.middle.prevent="emit('quick-insert-aimd', ft.type)"
      >
        <span class="aimd-editor-aimd-btn-icon" v-html="ft.svgIcon" />
        <span class="aimd-editor-aimd-btn-label">{{ ft.label }}</span>
      </button>
    </template>
  </div>
</template>
