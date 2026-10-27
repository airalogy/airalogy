<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { parseCheckContent, parseStepContent } from '@airalogy/aimd-core/parser'
import { AIMD_FIELD_ID_PATTERN, collectAimdFieldIds, createAimdFieldId, updateAimdCheckField, updateAimdStepField } from '../authoring/fields'
import type { AimdEditorMessages } from './locales'

const props = defineProps<{
  visible: boolean
  content: string
  fieldContent?: string
  fieldType?: 'step' | 'check'
  reservedIds?: string[]
  messages: AimdEditorMessages
}>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', content: string): void
}>()
const dialog = ref<HTMLDialogElement>()
const nameInput = ref<HTMLInputElement>()
const id = ref('')
const title = ref('')
const level = ref(1)
const check = ref(true)
const duration = ref('')
const timer = ref('elapsed')
const error = ref('')
const advanced = ref(false)
const checkedMessage = ref('')
const isCheck = computed(() => props.fieldType === 'check')
const labels = computed(() => isCheck.value ? props.messages.checkField : props.messages.stepField)

watch(() => props.visible, async visible => {
  if (!visible) { dialog.value?.close(); return }
  const step = props.fieldContent && !isCheck.value ? parseStepContent(props.fieldContent) : undefined
  const checkpoint = props.fieldContent && isCheck.value ? parseCheckContent(props.fieldContent) : undefined
  id.value = (checkpoint ?? step)?.id ?? createAimdFieldId([...collectAimdFieldIds(props.content), ...(props.reservedIds ?? [])], isCheck.value ? 'check' : 'step')
  title.value = (checkpoint ?? step)?.title ?? ''
  checkedMessage.value = checkpoint?.checked_message ?? ''
  level.value = step?.level ?? 1
  check.value = step?.check ?? true
  duration.value = String(step?.props.duration ?? '')
  timer.value = step?.timer_mode ?? 'elapsed'
  error.value = ''
  advanced.value = false
  await nextTick()
  dialog.value?.showModal()
  nameInput.value?.focus()
}, { immediate: true })

function save() {
  const existing = new Set([...collectAimdFieldIds(props.content), ...(props.reservedIds ?? [])])
  const nextId = id.value.trim() || createAimdFieldId(existing, isCheck.value ? 'check' : 'step')
  if (!AIMD_FIELD_ID_PATTERN.test(nextId)) { error.value = props.messages.inputField.invalidId; advanced.value = true; return }
  if (!props.fieldContent && existing.has(nextId)) { error.value = props.messages.inputField.duplicateId; advanced.value = true; return }
  if (isCheck.value) {
    emit('save', updateAimdCheckField(props.fieldContent, { id: nextId, title: title.value, checkedMessage: checkedMessage.value }))
    emit('update:visible', false)
    return
  }
  const content = updateAimdStepField(props.fieldContent, { id: nextId, title: title.value, level: level.value, check: check.value, duration: duration.value, timer: timer.value })
  const step = parseStepContent(content)
  if ((duration.value.trim() && step.estimated_duration_ms === undefined) || (timer.value !== 'elapsed' && !step.estimated_duration_ms)) {
    error.value = props.messages.stepField.invalidDuration
    advanced.value = true
    return
  }
  emit('save', content)
  emit('update:visible', false)
}
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="aimd-step-dialog" :aria-label="fieldContent ? labels.edit : labels.insert" @close="emit('update:visible', false)" @cancel="emit('update:visible', false)">
      <form @submit.prevent="save">
        <h2>{{ fieldContent ? labels.edit : labels.insert }}</h2>
        <label>{{ labels.name }}<input ref="nameInput" v-model="title" name="title" autocomplete="off"></label>
        <label v-if="!isCheck" class="aimd-step-dialog__check"><input v-model="check" name="check" type="checkbox">{{ messages.stepField.check }}</label>
        <details :open="advanced" @toggle="advanced = ($event.target as HTMLDetailsElement).open">
          <summary>{{ messages.inputField.advanced }}</summary>
          <label>{{ labels.id }}<input v-model="id" name="id" :readonly="!!fieldContent" autocomplete="off" spellcheck="false"></label>
          <label v-if="isCheck">{{ messages.checkField.checkedMessage }}<input v-model="checkedMessage" name="checkedMessage"></label>
          <template v-else>
            <label>{{ messages.dialog.level }}<select v-model="level" name="level"><option v-for="n in 3" :key="n" :value="n">{{ n }}</option></select></label>
            <label>{{ messages.stepField.duration }}<input v-model="duration" name="duration" placeholder="2m"></label>
            <label>{{ messages.stepField.timer }}<select v-model="timer" name="timer"><option value="elapsed">{{ messages.stepField.elapsed }}</option><option value="countdown">{{ messages.stepField.countdown }}</option><option value="both">{{ messages.stepField.both }}</option></select></label>
          </template>
        </details>
        <p v-if="error" role="alert">{{ error }}</p>
        <footer><button type="button" @click="emit('update:visible', false)">{{ messages.common.cancel }}</button><button type="submit" class="aimd-step-dialog__save">{{ fieldContent ? messages.inputField.save : messages.common.insert }}</button></footer>
      </form>
    </dialog>
  </Teleport>
</template>

<style scoped>
.aimd-step-dialog { position: fixed; inset: 0; margin: auto; width: min(420px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); box-sizing: border-box; padding: 20px; border: 1px solid #d1d5db; border-radius: 8px; background: white; color: #24292f; font: 14px/1.5 system-ui, sans-serif; overflow: auto; }
.aimd-step-dialog::backdrop { background: rgb(0 0 0 / 25%); }
h2 { font-size: 18px; margin: 0 0 16px; }
label { display: flex; flex-direction: column; gap: 6px; margin: 12px 0; }
input, select { box-sizing: border-box; width: 100%; min-width: 0; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; background: white; color: inherit; font: inherit; }
input[readonly] { background: #f6f8fa; color: #57606a; }
.aimd-step-dialog__check { flex-direction: row; align-items: center; }
input[type="checkbox"] { width: 16px; height: 16px; }
summary { cursor: pointer; padding: 8px 0; color: #57606a; }
footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
button { padding: 7px 16px; border: 1px solid #cbd5e1; border-radius: 4px; background: white; cursor: pointer; font: inherit; }
.aimd-step-dialog__save { background: #1769d2; border-color: #1769d2; color: white; }
p[role="alert"] { color: #b42318; }
:is(input, select, button, summary):focus-visible { outline: 2px solid #1769d2; outline-offset: 2px; }
</style>
