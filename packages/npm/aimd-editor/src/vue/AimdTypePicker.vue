<script setup lang="ts">
import { computed } from 'vue'
import { getAimdBuiltInTypeMetadata, getAimdBuiltInTypeNames, isAimdNullableType, unwrapAimdNullableType } from '@airalogy/aimd-core/utils'
import type { AimdEditorMessages } from './locales'
import type { AimdVarTypePresetOption } from './types'

const props = defineProps<{ modelValue: string; messages: AimdEditorMessages; varTypePlugins?: AimdVarTypePresetOption[] }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()
const builtIns = getAimdBuiltInTypeNames()
function typeLabel(name: string) {
  const title = getAimdBuiltInTypeMetadata(name)?.title
  return title && title !== name ? `${title} (${name})` : name
}
const plugins = computed(() => [...new Map((props.varTypePlugins ?? []).map(option => [option.value, option])).values()].filter(option => !builtIns.includes(option.value)))
const selected = computed(() => {
  const type = unwrapAimdNullableType(props.modelValue)
  return getAimdBuiltInTypeMetadata(type)?.type_name ?? (plugins.value.some(option => option.value === type) ? type : '')
})
function selectType(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value) emit('update:modelValue', value + (isAimdNullableType(props.modelValue) ? ' | None' : ''))
}
</script>

<template>
  <div class="aimd-type-picker">
    <label>{{ messages.inputField.knownTypes }}
      <select name="knownType" :value="selected" @change="selectType">
        <option value="">{{ messages.inputField.customExpression }}</option>
        <optgroup :label="messages.inputField.builtInTypes"><option v-for="name in builtIns" :key="name" :value="name">{{ typeLabel(name) }}</option></optgroup>
        <optgroup v-if="plugins.length" :label="messages.inputField.pluginTypes"><option v-for="option in plugins" :key="option.value" :value="option.value">{{ option.label }} ({{ option.value }})</option></optgroup>
      </select>
    </label>
    <label>{{ messages.dialog.customType }}<input name="type" :value="modelValue" :placeholder="messages.placeholders.type" spellcheck="false" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"></label>
  </div>
</template>

<style scoped>
label { display: flex; flex-direction: column; gap: 6px; margin: 12px 0; }
input, select { box-sizing: border-box; width: 100%; min-width: 0; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; background: white; color: inherit; font: inherit; }
:is(input, select):focus-visible { outline: 2px solid #1769d2; outline-offset: 2px; }
</style>
