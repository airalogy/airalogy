<script setup lang="ts">
import { computed, type VNode } from 'vue'
import type { AimdRecorderMessages } from '../locales'

export interface PanelField {
  scope: 'var' | 'var_table' | 'step' | 'check' | 'quiz'
  id: string
  key: string
  title: string
  description?: string
  required?: boolean
  navigate: boolean
  control?: VNode | null
}

const props = defineProps<{ fields: PanelField[], messages: AimdRecorderMessages, detailed: boolean }>()
defineEmits<{ navigate: [key: string] }>()
const groups = computed(() => {
  const groups = new Map<PanelField['scope'], PanelField[]>()
  for (const field of props.fields) {
    if (!groups.has(field.scope)) groups.set(field.scope, [])
    groups.get(field.scope)!.push(field)
  }
  return groups
})
function hasMetadata(field: PanelField) {
  return Boolean(field.description || (!props.detailed && field.title !== field.id))
}
const FieldControl = ({ field }: { field: PanelField }) => field.control
</script>

<template>
  <div class="aimd-fields-list" :data-field-display="detailed ? 'detailed' : 'compact'">
    <details v-for="[scope, rows] in groups" :key="scope" open class="aimd-panel-group" :data-panel-group="scope">
      <summary>{{ messages.panel[scope] }}</summary>
      <div v-for="field in rows" :key="field.key" class="aimd-panel-field" role="group" :aria-label="field.title" :data-panel-key="field.key" :data-panel-field="scope === 'var' ? field.key : undefined">
        <div class="aimd-panel-heading">
          <component :is="hasMetadata(field) ? 'details' : 'div'" class="aimd-panel-meta">
            <component :is="hasMetadata(field) ? 'summary' : 'div'" class="aimd-panel-label">
              {{ field.title }}
              <small v-if="field.required !== undefined">{{ field.required ? messages.common.required : messages.common.optional }}</small>
              <code v-if="detailed && field.title !== field.id" class="aimd-panel-id">{{ field.id }}</code>
            </component>
            <code v-if="!detailed && field.title !== field.id" class="aimd-panel-id">{{ field.id }}</code>
            <p v-if="field.description">{{ field.description }}</p>
          </component>
          <button v-if="field.navigate" class="aimd-panel-jump" type="button" :aria-label="messages.panel.locate(field.title)" :title="messages.panel.locate(field.title)" :data-navigate-field="field.key" @click="$emit('navigate', field.key)">›</button>
        </div>
        <div v-if="field.control" class="aimd-panel-value"><FieldControl :field="field" /></div>
      </div>
    </details>
  </div>
</template>
