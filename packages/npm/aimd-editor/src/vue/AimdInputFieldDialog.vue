<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { parseVarDefinition, parseVarListEnumValues, validateVarDefinition } from '@airalogy/aimd-core/parser'
import { unwrapAimdNullableType, isAimdNullableType, getAimdBuiltInTypeNames, getAimdBuiltInTypeMetadata } from '@airalogy/aimd-core/utils'
import { AIMD_FIELD_ID_PATTERN, collectAimdFieldIds, createAimdFieldId, updateAimdInputField } from '../authoring/fields'
import type { AimdEditorMessages } from './locales'
import type { AimdVarTypePresetOption } from './types'
import AimdTypePicker from './AimdTypePicker.vue'

const props = defineProps<{
  visible: boolean
  content: string
  fieldContent?: string
  messages: AimdEditorMessages
  varTypePlugins?: AimdVarTypePresetOption[]
  reservedIds?: string[]
  initialPreset?: string
}>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', fieldContent: string): void
}>()
const dialog = ref<HTMLDialogElement>()
const nameInput = ref<HTMLInputElement>()
const id = ref('')
const title = ref('')
const type = ref('str')
const defaultRaw = ref('')
const optionsText = ref('')
const preset = ref('str')
const error = ref('')
const advanced = ref(false)
const fileTypes = getAimdBuiltInTypeNames().filter(name => getAimdBuiltInTypeMetadata(name)?.storage_kind === 'file-id')
const presets = computed(() => [
  ['str', props.messages.inputField.text],
  ['int', props.messages.inputField.integer],
  ['float', props.messages.inputField.number],
  ['choice', props.messages.inputField.choice],
  ['multiple-choice', props.messages.inputField.multipleChoice],
  ['bool | None', props.messages.inputField.boolean],
  ['bool', props.messages.inputField.checkbox],
  ['date', props.messages.inputField.date],
  ['time', props.messages.inputField.time],
  ['datetime', props.messages.inputField.datetime],
  ['file', props.messages.inputField.file],
  ['list[str]', props.messages.inputField.list],
  ...(props.varTypePlugins ?? []).map(preset => [preset.value, preset.label]),
  ['custom', props.messages.inputField.custom],
])

watch(() => props.visible, async visible => {
  if (!visible) { dialog.value?.close(); return }
  const definition = props.fieldContent ? parseVarDefinition(props.fieldContent) : undefined
  id.value = definition?.id ?? createAimdFieldId([...collectAimdFieldIds(props.content), ...(props.reservedIds ?? [])])
  title.value = typeof definition?.kwargs?.title === 'string' ? definition.kwargs.title : ''
  type.value = definition?.type ?? (props.initialPreset === 'file' ? 'FileIdPDF' : ['choice', 'multiple-choice', 'custom'].includes(props.initialPreset ?? '') ? 'str' : props.initialPreset ?? 'str')
  defaultRaw.value = definition?.defaultRaw ?? ''
  preset.value = presets.value.some(([value]) => value === type.value) ? type.value : 'custom'
  const listChoices = parseVarListEnumValues(type.value)
  const choices = listChoices.length ? listChoices : definition?.enum
  const editableChoices = Array.isArray(definition?.kwargs?.enum) || /^(?:(?:typing|typing_extensions)\.)?(?:(?:list|List)\s*\[\s*(?:(?:typing|typing_extensions)\.)?)?Literal\s*\[/.test(unwrapAimdNullableType(type.value))
  const canEditChoices = editableChoices && Array.isArray(choices) && choices.every(value => typeof value === 'string' && !value.includes('\n'))
  if (canEditChoices) preset.value = listChoices.length ? 'multiple-choice' : 'choice'
  if (fileTypes.includes(unwrapAimdNullableType(type.value))) preset.value = 'file'
  if (!definition && props.initialPreset) preset.value = props.initialPreset
  optionsText.value = canEditChoices ? choices!.join('\n') : ''
  advanced.value = preset.value === 'custom'
  error.value = ''
  await nextTick()
  dialog.value?.showModal()
  nameInput.value?.focus()
}, { immediate: true })

function selectPreset() {
  if (!['custom', 'choice', 'multiple-choice', 'file'].includes(preset.value)) type.value = preset.value
  if (preset.value === 'file' && !fileTypes.includes(unwrapAimdNullableType(type.value))) type.value = 'FileIdPDF'
  if (preset.value === 'custom') advanced.value = true
}

function selectFileType(event: Event) {
  type.value = (event.target as HTMLSelectElement).value + (isAimdNullableType(type.value) ? ' | None' : '')
}

function save() {
  const existing = new Set([...collectAimdFieldIds(props.content), ...(props.reservedIds ?? [])])
  const original = props.fieldContent ? parseVarDefinition(props.fieldContent) : undefined
  const originalId = original?.id
  const nextId = id.value.trim() || createAimdFieldId(existing)
  if (!AIMD_FIELD_ID_PATTERN.test(nextId)) { error.value = props.messages.inputField.invalidId; advanced.value = true; return }
  if (nextId !== originalId && existing.has(nextId)) { error.value = props.messages.inputField.duplicateId; advanced.value = true; return }
  let nextType = type.value
  if (preset.value === 'choice' || preset.value === 'multiple-choice') {
    const choices = optionsText.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
    if (!choices.length || new Set(choices).size !== choices.length) { error.value = props.messages.inputField.invalidOptions; return }
    nextType = `Literal[${choices.map(value => JSON.stringify(value)).join(', ')}]`
    if (preset.value === 'multiple-choice') nextType = `list[${nextType}]`
    if (isAimdNullableType(type.value)) nextType += ' | None'
  }
  const result = updateAimdInputField(props.fieldContent, {
    id: nextId, type: nextType, title: title.value, defaultRaw: defaultRaw.value,
    clearEnum: preset.value === 'choice' || preset.value === 'multiple-choice' || nextType !== original?.type,
  })
  const problems = validateVarDefinition(parseVarDefinition(result))
  if (problems.length) { error.value = problems.join(' '); advanced.value = true; return }
  emit('save', result)
  emit('update:visible', false)
}
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="aimd-input-dialog" :aria-label="fieldContent ? messages.inputField.edit : messages.inputField.insert" @close="emit('update:visible', false)" @cancel="emit('update:visible', false)">
      <form @submit.prevent="save">
        <h2>{{ fieldContent ? messages.inputField.edit : messages.inputField.insert }}</h2>
        <label>{{ messages.inputField.name }}<input ref="nameInput" v-model="title" name="title" autocomplete="off"></label>
        <label>{{ messages.dialog.type }}
          <select v-model="preset" name="preset" @change="selectPreset">
            <option v-for="[value, label] in presets" :key="value" :value="value">{{ label }}</option>
          </select>
        </label>
        <label v-if="preset === 'choice' || preset === 'multiple-choice'">{{ messages.inputField.options }}<textarea v-model="optionsText" name="options" rows="4" /></label>
        <label v-if="preset === 'file'">{{ messages.inputField.fileFormat }}<select name="fileType" :value="unwrapAimdNullableType(type)" @change="selectFileType"><option v-for="fileType in fileTypes" :key="fileType" :value="fileType">{{ fileType.replace(/^FileId/, '') }}</option></select></label>
        <details :open="advanced" @toggle="advanced = ($event.target as HTMLDetailsElement).open">
          <summary>{{ messages.inputField.advanced }}</summary>
          <label>{{ messages.inputField.id }}<input v-model="id" name="id" autocomplete="off" spellcheck="false"></label>
          <AimdTypePicker v-model="type" :messages="messages" :var-type-plugins="varTypePlugins" @update:model-value="preset = 'custom'" />
          <label>{{ messages.dialog.defaultValue }}<input v-model="defaultRaw" name="default"></label>
        </details>
        <p v-if="error" class="aimd-input-dialog__error" role="alert">{{ error }}</p>
        <footer>
          <button type="button" @click="emit('update:visible', false)">{{ messages.common.cancel }}</button>
          <button type="submit" class="aimd-input-dialog__save">{{ fieldContent ? messages.inputField.save : messages.common.insert }}</button>
        </footer>
      </form>
    </dialog>
  </Teleport>
</template>

<style scoped>
.aimd-input-dialog {
  /* Keep native dialog centering intact when the host resets element margins. */
  position: fixed;
  inset: 0;
  margin: auto;
  width: min(420px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  box-sizing: border-box;
  padding: 20px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  color: #24292f;
  font: 14px/1.5 system-ui, sans-serif;
  overflow: auto;
}
.aimd-input-dialog::backdrop { background: rgb(0 0 0 / 25%); }
h2 { font-size: 18px; margin: 0 0 16px; }
label { display: flex; flex-direction: column; gap: 6px; margin: 12px 0; }
input, select, textarea { box-sizing: border-box; width: 100%; min-width: 0; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; background: white; color: inherit; font: inherit; }
summary { cursor: pointer; padding: 8px 0; color: #57606a; }
footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
button { padding: 7px 16px; border: 1px solid #cbd5e1; border-radius: 4px; background: white; cursor: pointer; font: inherit; }
.aimd-input-dialog__save { background: #1769d2; border-color: #1769d2; color: white; }
.aimd-input-dialog__error { color: #b42318; }
:is(input, select, textarea, button, summary):focus-visible { outline: 2px solid #1769d2; outline-offset: 2px; }
</style>
