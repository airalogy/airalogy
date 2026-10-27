<script setup lang="ts">
defineProps<{
  modelValue: boolean
  label: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <label class="workspace-field-details-toggle">
    <input type="checkbox" role="switch" :checked="modelValue" @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)">
    <span>{{ label }}</span>
  </label>
</template>

<style scoped>
.workspace-field-details-toggle {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
  min-height: 32px;
  max-width: 100%;
  margin-left: auto;
  color: #475467;
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
}

.workspace-field-details-toggle span {
  overflow-wrap: anywhere;
}

.workspace-field-details-toggle input {
  appearance: none;
  position: relative;
  flex: 0 0 28px;
  width: 28px;
  height: 16px;
  margin: 0;
  border: 1px solid #667085;
  border-radius: 8px;
  background: #667085;
  cursor: pointer;
}

.workspace-field-details-toggle input::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
}

.workspace-field-details-toggle input:checked {
  border-color: #1a73e8;
  background: #1a73e8;
}

.workspace-field-details-toggle input:checked::before {
  transform: translateX(12px);
}

.workspace-field-details-toggle input:focus-visible {
  outline: 2px solid #1a73e8;
  outline-offset: 3px;
}

@media (forced-colors: active) {
  .workspace-field-details-toggle input {
    appearance: auto;
  }

  .workspace-field-details-toggle input::before {
    content: none;
  }
}
</style>
