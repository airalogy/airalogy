<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: unknown
  options: unknown[]
  label: string
  fieldId: string
  disabled: boolean
  nullable: boolean
  emptyLabel: string
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown[] | null): void
  (e: 'blur'): void
}>()
const selected = ref<unknown[]>([])
const isUnset = ref(false)
watch(() => props.modelValue, value => {
  selected.value = Array.isArray(value) ? [...value] : []
  isUnset.value = value === null || value === undefined
}, { immediate: true })

function update(value: unknown, checked: boolean) {
  // Preserve existing order and imported values until the user explicitly removes them.
  selected.value = checked
    ? [...selected.value.filter(item => !Object.is(item, value)), value]
    : selected.value.filter(item => !Object.is(item, value))
  isUnset.value = false
  emit('update:modelValue', [...selected.value])
}
function reset() {
  selected.value = []
  isUnset.value = true
  emit('update:modelValue', null)
}
</script>

<template>
  <span class="aimd-rec-multi-select" role="group" :aria-label="label">
    <label v-for="(option, index) in options" :key="index" class="aimd-rec-multi-select__option">
      <input type="checkbox" :data-rec-focus-key="index === 0 ? `var:${fieldId}` : `var:${fieldId}:${index}`" :checked="selected.some(value => Object.is(value, option))" :disabled="disabled" @change="update(option, ($event.target as HTMLInputElement).checked)" @blur="emit('blur')">
      <span>{{ option === null ? emptyLabel : String(option) }}</span>
    </label>
    <button v-if="nullable" type="button" class="aimd-rec-multi-select__unset" :disabled="disabled || isUnset" @click="reset" @blur="emit('blur')">{{ emptyLabel }}</button>
  </span>
</template>

<style scoped>
.aimd-rec-multi-select { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; min-width: 0; max-width: 100%; box-sizing: border-box; min-height: 32px; padding: 6px 10px; }
.aimd-rec-multi-select__option { display: inline-flex; align-items: center; gap: 6px; min-height: 24px; max-width: 100%; cursor: pointer; }
.aimd-rec-multi-select__option input { flex: 0 0 auto; width: 16px; height: 16px; margin: 0; accent-color: #1769d2; }
.aimd-rec-multi-select__option span { min-width: 0; overflow-wrap: anywhere; }
.aimd-rec-multi-select__unset { border: 0; padding: 2px 4px; background: transparent; color: #1769d2; font: inherit; cursor: pointer; }
.aimd-rec-multi-select__unset:disabled { color: #6b7280; cursor: default; }
</style>
