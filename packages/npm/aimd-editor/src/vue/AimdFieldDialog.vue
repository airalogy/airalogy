<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { AimdEditorMessages } from './locales'
import {
  createAimdFieldTypes,
  createAimdVarTypePresets,
  getDefaultAimdFields,
  buildAimdSyntax,
  type AimdFieldType,
  type AimdVarTypePresetOption,
} from './types'

const props = defineProps<{
  visible: boolean
  initialType?: string
  messages: AimdEditorMessages
  refSuggestions?: string[]
  varTypePlugins?: AimdVarTypePresetOption[]
  allowedTypes?: string[]
  existingQuizIds?: string[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'insert', syntax: string): void
}>()

const localizedFieldTypes = computed(() => {
  const allTypes = createAimdFieldTypes(props.messages)
  if (!props.allowedTypes || props.allowedTypes.length === 0) {
    return allTypes
  }

  const allowed = new Set(props.allowedTypes)
  return allTypes.filter(fieldType => allowed.has(fieldType.type))
})

function resolveDialogType(type?: string): string {
  if (type && localizedFieldTypes.value.some(fieldType => fieldType.type === type)) {
    return type
  }

  return localizedFieldTypes.value[0]?.type ?? type ?? 'var'
}

const existingQuizIdsSet = computed(() => {
  return new Set(props.existingQuizIds || [])
})

const dialogType = ref(resolveDialogType(props.initialType))
const fields = ref<Record<string, string>>(getDefaultAimdFields(dialogType.value, props.messages, existingQuizIdsSet.value))

interface ChoiceOptionItem {
  key: string
  text: string
}

interface BlankItem {
  key: string
  answer: string
}

const quizChoiceOptions = ref<ChoiceOptionItem[]>([])
const quizBlankItems = ref<BlankItem[]>([])
const quizMultipleAnswers = ref<string[]>([])
const draggingChoiceIndex = ref<number | null>(null)
const dragOverChoiceIndex = ref<number | null>(null)
const formError = ref('')
const varTypePresets = computed<AimdVarTypePresetOption[]>(() =>
  createAimdVarTypePresets(props.messages, props.varTypePlugins ?? []),
)

function normalizeVarTypeToken(value: string | undefined): string {
  return (value || '').trim().toLowerCase().replace(/[\s_-]/g, '')
}

function isVarTypePresetActive(value: string): boolean {
  return normalizeVarTypeToken(fields.value.type) === normalizeVarTypeToken(value)
}

function selectVarTypePreset(value: string) {
  fields.value.type = value
}

function generateUniqueQuizId(quizType: string, existingIds: Set<string>): string {
  const base = `quiz_${quizType}`
  let suffix = 1
  while (existingIds.has(`${base}_${suffix}`)) {
    suffix += 1
  }
  return `${base}_${suffix}`
}

function parseChoiceOptions(input: string): ChoiceOptionItem[] {
  const parts = input.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) {
    return [
      { key: 'A', text: '' },
      { key: 'B', text: '' },
    ]
  }

  return parts.map((part, index) => {
    const sepIndex = part.indexOf(':')
    if (sepIndex > 0) {
      const key = part.slice(0, sepIndex).trim() || String.fromCharCode(65 + index)
      const text = part.slice(sepIndex + 1).trim() || props.messages.defaults.optionText(key)
      return { key, text }
    }
    const key = String.fromCharCode(65 + index)
    return { key, text: part }
  })
}

function serializeChoiceOptions(items: ChoiceOptionItem[]): string {
  const normalized = items
    .map(item => ({ key: item.key.trim(), text: item.text.trim() }))
    .filter(item => item.key && item.text)

  if (normalized.length === 0) {
    return 'A:, B:'
  }

  return normalized.map(item => `${item.key}:${item.text}`).join(', ')
}

function parseBlankItems(input: string): BlankItem[] {
  const parts = input.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) {
    return [{ key: 'b1', answer: '' }]
  }

  return parts.map((part, index) => {
    const sepIndex = part.indexOf(':')
    if (sepIndex > 0) {
      const key = part.slice(0, sepIndex).trim() || `b${index + 1}`
      const answer = part.slice(sepIndex + 1).trim() || ''
      return { key, answer }
    }
    return { key: `b${index + 1}`, answer: part }
  })
}

function serializeBlankItems(items: BlankItem[]): string {
  const normalized = items
    .map(item => ({ key: item.key.trim(), answer: item.answer.trim() }))
    .filter(item => item.key)

  if (normalized.length === 0) {
    return 'b1:'
  }

  return normalized.map(item => `${item.key}:${item.answer}`).join(', ')
}

function parseAnswerKeys(input: string): string[] {
  return input
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

function hydrateQuizDraftsFromFields() {
  if (dialogType.value !== 'quiz') return

  if (fields.value.quizType === 'choice') {
    quizChoiceOptions.value = parseChoiceOptions(fields.value.options || '')
    quizMultipleAnswers.value = parseAnswerKeys(fields.value.answer || '')
  }
  else if (fields.value.quizType === 'blank') {
    quizBlankItems.value = parseBlankItems(fields.value.blanks || '')
  }
}

function ensureChoiceAnswersValid() {
  if (dialogType.value !== 'quiz' || fields.value.quizType !== 'choice') return

  const optionKeys = new Set(
    quizChoiceOptions.value
      .map(option => option.key.trim())
      .filter(Boolean),
  )

  if (fields.value.mode === 'multiple') {
    const normalized = quizMultipleAnswers.value
      .map(key => key.trim())
      .filter(key => key && optionKeys.has(key))
    if (normalized.length !== quizMultipleAnswers.value.length) {
      quizMultipleAnswers.value = normalized
    }
  }
  else {
    const answer = (fields.value.answer || '').trim()
    if (answer && !optionKeys.has(answer)) {
      fields.value.answer = ''
    }
  }
}

function nextChoiceKey(): string {
  const used = new Set(
    quizChoiceOptions.value
      .map(option => option.key.trim().toUpperCase())
      .filter(Boolean),
  )

  for (let i = 0; i < 26; i++) {
    const candidate = String.fromCharCode(65 + i)
    if (!used.has(candidate)) return candidate
  }
  return `K${quizChoiceOptions.value.length + 1}`
}

function addChoiceOption() {
  const key = nextChoiceKey()
  quizChoiceOptions.value.push({ key, text: '' })
}

function removeChoiceOption(index: number) {
  if (quizChoiceOptions.value.length <= 1) return
  quizChoiceOptions.value.splice(index, 1)
}

function startChoiceDrag(index: number) {
  draggingChoiceIndex.value = index
  dragOverChoiceIndex.value = index
}

function onChoiceDragOver(index: number) {
  if (draggingChoiceIndex.value === null) return
  dragOverChoiceIndex.value = index
}

function dropChoiceAt(index: number) {
  const from = draggingChoiceIndex.value
  if (from === null || from === index) {
    draggingChoiceIndex.value = null
    dragOverChoiceIndex.value = null
    return
  }

  const moved = quizChoiceOptions.value.splice(from, 1)[0]
  quizChoiceOptions.value.splice(index, 0, moved)
  draggingChoiceIndex.value = null
  dragOverChoiceIndex.value = null
}

function endChoiceDrag() {
  draggingChoiceIndex.value = null
  dragOverChoiceIndex.value = null
}

function nextBlankKey(): string {
  const used = new Set(
    quizBlankItems.value
      .map(item => item.key.trim().toLowerCase())
      .filter(Boolean),
  )
  let index = 1
  while (used.has(`b${index}`)) {
    index += 1
  }
  return `b${index}`
}

function addBlankItem() {
  quizBlankItems.value.push({ key: nextBlankKey(), answer: '' })
}

function removeBlankItem(index: number) {
  if (quizBlankItems.value.length <= 1) return
  quizBlankItems.value.splice(index, 1)
}

function collectDuplicateValues(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const value of values) {
    if (seen.has(value) && !duplicates.includes(value)) {
      duplicates.push(value)
    }
    seen.add(value)
  }
  return duplicates
}

function extractBlankPlaceholders(stem: string): string[] {
  const keys: string[] = []
  const pattern = /\[\[([^\[\]\s]+)\]\]/g
  for (const match of stem.matchAll(pattern)) {
    keys.push(match[1])
  }
  return keys
}

function validateBlankQuizBeforeInsert(): string | null {
  const blankKeys = quizBlankItems.value
    .map(item => item.key.trim())
    .filter(Boolean)
  if (blankKeys.length === 0) {
    return props.messages.errors.blankQuizRequiresBlankKey
  }

  const duplicateBlankKeys = collectDuplicateValues(blankKeys)
  if (duplicateBlankKeys.length > 0) {
    return props.messages.errors.blankKeysMustBeUnique(duplicateBlankKeys)
  }

  const stem = fields.value.stem || ''
  const placeholderKeys = extractBlankPlaceholders(stem)
  if (placeholderKeys.length === 0) {
    return props.messages.errors.blankStemRequiresPlaceholders
  }

  const duplicatePlaceholders = collectDuplicateValues(placeholderKeys)
  if (duplicatePlaceholders.length > 0) {
    return props.messages.errors.duplicatePlaceholders(duplicatePlaceholders)
  }

  const blankKeySet = new Set(blankKeys)
  const placeholderSet = new Set(placeholderKeys)
  const unknownPlaceholders = [...placeholderSet].filter(key => !blankKeySet.has(key))
  if (unknownPlaceholders.length > 0) {
    return props.messages.errors.undefinedPlaceholders(unknownPlaceholders)
  }

  const missingPlaceholders = [...blankKeySet].filter(key => !placeholderSet.has(key))
  if (missingPlaceholders.length > 0) {
    return props.messages.errors.missingPlaceholders(missingPlaceholders)
  }

  return null
}

function validateBeforeInsert(): string | null {
  if (dialogType.value !== 'quiz') return null
  if (fields.value.quizType !== 'blank') return null
  return validateBlankQuizBeforeInsert()
}

watch(() => props.initialType, (t) => {
  const resolvedType = resolveDialogType(t)
  dialogType.value = resolvedType
  fields.value = getDefaultAimdFields(resolvedType, props.messages, existingQuizIdsSet.value)
  hydrateQuizDraftsFromFields()
  formError.value = ''
})

watch(localizedFieldTypes, () => {
  const resolvedType = resolveDialogType(dialogType.value)
  if (resolvedType === dialogType.value) {
    return
  }

  dialogType.value = resolvedType
  fields.value = getDefaultAimdFields(resolvedType, props.messages, existingQuizIdsSet.value)
  hydrateQuizDraftsFromFields()
  formError.value = ''
})

watch(() => props.visible, (v) => {
  if (v) {
    fields.value = getDefaultAimdFields(dialogType.value, props.messages, existingQuizIdsSet.value)
    hydrateQuizDraftsFromFields()
    formError.value = ''
  }
})

function switchType(type: string) {
  const resolvedType = resolveDialogType(type)
  dialogType.value = resolvedType
  fields.value = getDefaultAimdFields(resolvedType, props.messages, existingQuizIdsSet.value)
  hydrateQuizDraftsFromFields()
  formError.value = ''
}

const preview = computed(() => buildAimdSyntax(dialogType.value, fields.value, props.messages))

function getTypeInfo(type: string): AimdFieldType {
  return localizedFieldTypes.value.find(f => f.type === type) || { type, label: type, icon: '?', svgIcon: '', desc: '', color: '#666' }
}

const currentType = computed(() => getTypeInfo(dialogType.value))

const suggestions = computed(() => {
  if (!props.refSuggestions) return []
  return props.refSuggestions
})

const referencedLabel = computed(() => {
  if (dialogType.value === 'ref_step') return props.messages.dialog.referencedStepId
  if (dialogType.value === 'ref_var') return props.messages.dialog.referencedVariableId
  return props.messages.dialog.referencedFigureId
})

const referencedPlaceholder = computed(() => {
  if (dialogType.value === 'ref_step') return 'step_id'
  if (dialogType.value === 'ref_var') return 'var_id'
  return 'fig_id'
})

watch(() => [dialogType.value, fields.value.quizType], ([type, quizType], [prevType, prevQuizType]) => {
  if (type !== 'quiz') return
  if (type !== prevType || quizType !== prevQuizType) {
    if (quizType !== prevQuizType && prevQuizType) {
      fields.value.id = generateUniqueQuizId(quizType, existingQuizIdsSet.value)

      if (quizType === 'choice') {
        fields.value.stem = props.messages.defaults.questionStem
        fields.value.mode = 'single'
        fields.value.options = 'A:, B:'
        fields.value.answer = 'A'
        fields.value.blanks = ''
        fields.value.rubric = ''
      }
      else if (quizType === 'blank') {
        fields.value.stem = props.messages.defaults.fillQuestionStem
        fields.value.blanks = 'b1:'
        fields.value.options = ''
        fields.value.answer = ''
        fields.value.mode = ''
        fields.value.rubric = ''
        quizBlankItems.value = [{ key: 'b1', answer: '' }]
      }
      else if (quizType === 'open') {
        fields.value.stem = props.messages.defaults.fillQuestionStem
        fields.value.rubric = ''
        fields.value.options = ''
        fields.value.answer = ''
        fields.value.blanks = ''
        fields.value.mode = ''
      }
    }
    hydrateQuizDraftsFromFields()
  }
})

watch(() => fields.value.mode, () => {
  ensureChoiceAnswersValid()
})

watch(quizChoiceOptions, (items) => {
  if (dialogType.value === 'quiz' && fields.value.quizType === 'choice') {
    fields.value.options = serializeChoiceOptions(items)
    ensureChoiceAnswersValid()
  }
}, { deep: true })

watch(quizBlankItems, (items) => {
  if (dialogType.value === 'quiz' && fields.value.quizType === 'blank') {
    fields.value.blanks = serializeBlankItems(items)
  }
}, { deep: true })

watch(quizMultipleAnswers, (answers) => {
  if (dialogType.value === 'quiz' && fields.value.quizType === 'choice' && fields.value.mode === 'multiple') {
    fields.value.answer = answers.join(', ')
  }
}, { deep: true })

watch(fields, () => {
  if (formError.value) {
    formError.value = ''
  }
}, { deep: true })

watch(quizBlankItems, () => {
  if (formError.value) {
    formError.value = ''
  }
}, { deep: true })

function doInsert() {
  const validationError = validateBeforeInsert()
  if (validationError) {
    formError.value = validationError
    return
  }

  formError.value = ''
  emit('insert', buildAimdSyntax(dialogType.value, fields.value, props.messages))
  emit('update:visible', false)
}

function close() {
  emit('update:visible', false)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="aimd-dialog-overlay" @click.self="close">
      <div class="aimd-dialog">
        <div class="aimd-dialog-header">
          <span class="aimd-dialog-title">
            <span class="aimd-dialog-icon" :style="{ color: currentType.color }" v-html="currentType.svgIcon" />
            {{ props.messages.dialog.title(currentType.label) }}
          </span>
          <button class="aimd-dialog-close" @click="close">&times;</button>
        </div>

        <!-- Type selector tabs -->
        <div class="aimd-dialog-type-tabs">
          <button
            v-for="ft in localizedFieldTypes"
            :key="ft.type"
            :class="['aimd-type-tab', { active: dialogType === ft.type }]"
            :style="dialogType === ft.type ? { borderColor: ft.color, color: ft.color, background: `${ft.color}14` } : {}"
            @click="switchType(ft.type)"
          >
            <span v-html="ft.svgIcon" class="aimd-type-tab-icon" /> {{ ft.label }}
          </button>
        </div>

        <div class="aimd-dialog-body">
          <!-- var fields -->
          <template v-if="dialogType === 'var'">
            <label class="aimd-field-row">
              <span class="aimd-field-label">{{ props.messages.dialog.variableId }} <em>*</em></span>
              <input v-model="fields.name" :placeholder="props.messages.placeholders.variableId" class="aimd-field-input" />
            </label>
            <div class="aimd-field-row">
              <span class="aimd-field-label">{{ props.messages.dialog.typePresetLabel }}</span>
              <span class="aimd-field-hint">{{ props.messages.dialog.typeHint }}</span>
              <div class="aimd-var-type-grid">
                <button
                  v-for="preset in varTypePresets"
                  :key="preset.key"
                  type="button"
                  :class="['aimd-var-type-card', { active: isVarTypePresetActive(preset.value) }]"
                  @click="selectVarTypePreset(preset.value)"
                >
                  <span class="aimd-var-type-card-title">{{ preset.label }}</span>
                  <span class="aimd-var-type-card-desc">{{ preset.desc }}</span>
                </button>
              </div>
            </div>
            <label class="aimd-field-row">
              <span class="aimd-field-label">{{ props.messages.dialog.customType }}</span>
              <input
                v-model="fields.type"
                :placeholder="props.messages.placeholders.type"
                class="aimd-field-input"
              />
              <span class="aimd-field-hint">{{ props.messages.dialog.customTypeHint }}</span>
            </label>
            <label class="aimd-field-row">
              <span class="aimd-field-label">{{ props.messages.dialog.defaultValue }}</span>
              <input v-model="fields.default" :placeholder="props.messages.placeholders.defaultValue" class="aimd-field-input" />
            </label>
            <label class="aimd-field-row">
              <span class="aimd-field-label">{{ props.messages.dialog.titleLabel }}</span>
              <input v-model="fields.title" :placeholder="props.messages.placeholders.title" class="aimd-field-input" />
            </label>
          </template>

          <!-- var_table fields -->
          <template v-if="dialogType === 'var_table'">
            <label class="aimd-field-row">
              <span class="aimd-field-label">{{ props.messages.dialog.tableId }} <em>*</em></span>
              <input v-model="fields.name" :placeholder="props.messages.placeholders.tableId" class="aimd-field-input" />
            </label>
            <label class="aimd-field-row">
              <span class="aimd-field-label">{{ props.messages.dialog.subVariableColumns }}</span>
              <input v-model="fields.subvars" :placeholder="props.messages.placeholders.subVariableColumns" class="aimd-field-input" />
              <span class="aimd-field-hint">{{ props.messages.dialog.subVariableColumnsHint }}</span>
            </label>
          </template>

          <!-- step fields -->
          <template v-if="dialogType === 'step'">
            <label class="aimd-field-row">
              <span class="aimd-field-label">{{ props.messages.dialog.stepId }} <em>*</em></span>
              <input v-model="fields.name" :placeholder="props.messages.placeholders.stepId" class="aimd-field-input" />
            </label>
            <label class="aimd-field-row">
              <span class="aimd-field-label">{{ props.messages.dialog.level }}</span>
              <select v-model="fields.level" class="aimd-field-input">
                <option value="1">{{ props.messages.dialog.level1 }}</option>
                <option value="2">{{ props.messages.dialog.level2 }}</option>
                <option value="3">{{ props.messages.dialog.level3 }}</option>
              </select>
            </label>
          </template>

          <!-- quiz fields -->
          <template v-if="dialogType === 'quiz'">
            <label class="aimd-field-row">
              <span class="aimd-field-label">{{ props.messages.dialog.quizId }} <em>*</em></span>
              <input v-model="fields.id" :placeholder="props.messages.placeholders.quizId" class="aimd-field-input" />
            </label>

            <label class="aimd-field-row">
              <span class="aimd-field-label">{{ props.messages.dialog.questionType }}</span>
              <select v-model="fields.quizType" class="aimd-field-input">
                <option value="choice">{{ props.messages.quiz.types.choice }}</option>
                <option value="blank">{{ props.messages.quiz.types.blank }}</option>
                <option value="open">{{ props.messages.quiz.types.open }}</option>
              </select>
            </label>

            <label class="aimd-field-row">
              <span class="aimd-field-label">{{ props.messages.dialog.score }}</span>
              <input v-model="fields.score" :placeholder="props.messages.placeholders.score" class="aimd-field-input" />
            </label>

            <label class="aimd-field-row">
              <span class="aimd-field-label">{{ props.messages.dialog.stem }} <em>*</em></span>
              <textarea v-model="fields.stem" :placeholder="props.messages.placeholders.stem" class="aimd-field-input aimd-field-textarea" />
              <span v-if="fields.quizType === 'blank'" class="aimd-field-hint">
                {{ props.messages.dialog.blankStemHint }}
              </span>
            </label>

            <template v-if="fields.quizType === 'choice'">
              <label class="aimd-field-row">
                <span class="aimd-field-label">{{ props.messages.dialog.mode }}</span>
                <select v-model="fields.mode" class="aimd-field-input">
                  <option value="single">{{ props.messages.quiz.modes.single }}</option>
                  <option value="multiple">{{ props.messages.quiz.modes.multiple }}</option>
                </select>
              </label>

              <div class="aimd-field-row">
                <span class="aimd-field-label">{{ props.messages.dialog.options }}</span>
                <div class="aimd-collection-editor">
                  <div
                    v-for="(option, index) in quizChoiceOptions"
                    :key="`choice-option-${index}`"
                    class="aimd-collection-row aimd-option-row"
                    :class="{ 'aimd-option-row-dragover': dragOverChoiceIndex === index && draggingChoiceIndex !== null && draggingChoiceIndex !== index }"
                    @dragover.prevent="onChoiceDragOver(index)"
                    @drop.prevent="dropChoiceAt(index)"
                  >
                    <span
                      class="aimd-drag-handle"
                      :title="props.messages.dialog.dragToReorder"
                      draggable="true"
                      @dragstart="startChoiceDrag(index)"
                      @dragend="endChoiceDrag"
                    >
                      ⋮⋮
                    </span>
                    <input v-model="option.key" :placeholder="props.messages.placeholders.optionKey" class="aimd-field-input" />
                    <input v-model="option.text" :placeholder="props.messages.placeholders.optionText" class="aimd-field-input" />
                    <label class="aimd-option-answer-toggle">
                      <input
                        v-if="fields.mode === 'single'"
                        v-model="fields.answer"
                        type="radio"
                        name="aimd-quiz-choice-answer"
                        :value="option.key.trim()"
                        :disabled="!option.key.trim()"
                      />
                      <input
                        v-else
                        v-model="quizMultipleAnswers"
                        type="checkbox"
                        :value="option.key.trim()"
                        :disabled="!option.key.trim()"
                      />
                      <span>{{ props.messages.dialog.correctAnswer }}</span>
                    </label>
                    <button
                      type="button"
                      class="aimd-mini-btn"
                      :disabled="quizChoiceOptions.length <= 1"
                      @click="removeChoiceOption(index)"
                    >
                      {{ props.messages.common.remove }}
                    </button>
                  </div>
                  <button type="button" class="aimd-mini-btn aimd-mini-btn-add" @click="addChoiceOption">
                    {{ props.messages.actions.addOption }}
                  </button>
                </div>
                <span class="aimd-field-hint">{{ props.messages.dialog.optionsHint }}</span>
              </div>
            </template>

            <template v-else-if="fields.quizType === 'blank'">
              <div class="aimd-field-row">
                <span class="aimd-field-label">{{ props.messages.dialog.blanks }}</span>
                <div class="aimd-collection-editor">
                  <div v-for="(blank, index) in quizBlankItems" :key="`blank-item-${index}`" class="aimd-collection-row">
                    <input v-model="blank.key" :placeholder="props.messages.placeholders.blankKey" class="aimd-field-input" />
                    <input v-model="blank.answer" :placeholder="props.messages.placeholders.blankAnswer" class="aimd-field-input" />
                    <button
                      type="button"
                      class="aimd-mini-btn"
                      :disabled="quizBlankItems.length <= 1"
                      @click="removeBlankItem(index)"
                    >
                      {{ props.messages.common.remove }}
                    </button>
                  </div>
                  <button type="button" class="aimd-mini-btn aimd-mini-btn-add" @click="addBlankItem">
                    {{ props.messages.actions.addBlank }}
                  </button>
                </div>
                <span class="aimd-field-hint">{{ props.messages.dialog.blanksHint }}</span>
              </div>
            </template>

            <template v-else>
              <label class="aimd-field-row">
                <span class="aimd-field-label">{{ props.messages.dialog.rubric }}</span>
                <textarea v-model="fields.rubric" :placeholder="props.messages.placeholders.rubric" class="aimd-field-input aimd-field-textarea" />
              </label>
            </template>
          </template>

          <!-- check fields -->
          <template v-if="dialogType === 'check'">
            <label class="aimd-field-row">
              <span class="aimd-field-label">{{ props.messages.dialog.checkpointId }} <em>*</em></span>
              <input v-model="fields.name" :placeholder="props.messages.placeholders.checkpointId" class="aimd-field-input" />
            </label>
          </template>

          <!-- ref_step / ref_var / ref_fig -->
          <template v-if="['ref_step', 'ref_var', 'ref_fig'].includes(dialogType)">
            <label class="aimd-field-row">
              <span class="aimd-field-label">
                {{ referencedLabel }}
                <em>*</em>
              </span>
              <input
                v-model="fields.name"
                :placeholder="referencedPlaceholder"
                class="aimd-field-input"
                list="aimd-ref-suggestions"
              />
              <datalist id="aimd-ref-suggestions">
                <option v-for="s in suggestions" :key="s" :value="s" />
              </datalist>
              <span v-if="suggestions.length" class="aimd-field-hint">
                {{ props.messages.common.available }}: {{ suggestions.join(', ') }}
              </span>
            </label>
          </template>

          <!-- cite -->
          <template v-if="dialogType === 'cite'">
            <label class="aimd-field-row">
              <span class="aimd-field-label">{{ props.messages.dialog.citationId }} <em>*</em></span>
              <input v-model="fields.refs" :placeholder="props.messages.placeholders.citationIds" class="aimd-field-input" />
              <span class="aimd-field-hint">{{ props.messages.dialog.citationHint }}</span>
            </label>
          </template>

          <!-- Preview -->
          <div class="aimd-dialog-preview">
            <div class="aimd-preview-header">{{ props.messages.common.preview }}</div>
            <pre class="aimd-preview-panel"><code class="aimd-preview-code">{{ preview }}</code></pre>
          </div>

          <div v-if="formError" class="aimd-dialog-error">
            {{ formError }}
          </div>
        </div>

        <div class="aimd-dialog-footer">
          <button class="aimd-btn aimd-btn-cancel" @click="close">{{ props.messages.common.cancel }}</button>
          <button class="aimd-btn aimd-btn-primary" @click="doInsert">{{ props.messages.common.insert }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
.aimd-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(2px);
}

.aimd-dialog {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  width: 520px;
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.aimd-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.aimd-dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  display: flex;
  align-items: center;
  gap: 8px;
}

.aimd-dialog-icon {
  display: flex;
  align-items: center;
}

.aimd-dialog-icon svg {
  width: 20px;
  height: 20px;
}

.aimd-dialog-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 22px;
  color: #999;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.aimd-dialog-close:hover {
  background: #f0f2f5;
  color: #333;
}

.aimd-dialog-type-tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
  padding: 10px 12px;
  gap: 8px;
}

.aimd-type-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
  transition: all 0.15s;
}

.aimd-type-tab:hover {
  color: #374151;
  border-color: #d1d5db;
  background: #f8fafc;
}

.aimd-type-tab-icon {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.aimd-type-tab-icon svg {
  width: 14px;
  height: 14px;
}

.aimd-type-tab.active {
  font-weight: 600;
}

.aimd-dialog-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.aimd-field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.aimd-field-label {
  font-size: 13px;
  font-weight: 500;
  color: #444;
}

.aimd-field-label em {
  color: #dc2626;
  font-style: normal;
}

.aimd-field-input {
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.aimd-field-input:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.1);
}

.aimd-field-textarea {
  min-height: 72px;
  resize: vertical;
}

.aimd-field-hint {
  font-size: 11px;
  color: #999;
}

.aimd-var-type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
}

.aimd-var-type-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s, transform 0.15s;
}

.aimd-var-type-card:hover {
  border-color: #93c5fd;
  background: #f8fbff;
  transform: translateY(-1px);
}

.aimd-var-type-card:focus-visible {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.aimd-var-type-card.active {
  border-color: #2563eb;
  background: #eff6ff;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
}

.aimd-var-type-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
}

.aimd-var-type-card-desc {
  font-size: 12px;
  line-height: 1.4;
  color: #6b7280;
}

.aimd-collection-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.aimd-collection-row {
  display: grid;
  grid-template-columns: 90px 1fr auto;
  gap: 8px;
  align-items: center;
}

.aimd-option-row {
  grid-template-columns: 26px 60px 1fr 80px auto;
}

.aimd-option-row-dragover {
  background: #eff6ff;
  border-radius: 6px;
}

.aimd-option-answer-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #4b5563;
  font-size: 12px;
  user-select: none;
}

.aimd-option-answer-toggle input {
  margin: 0;
}

.aimd-drag-handle {
  color: #9ca3af;
  cursor: grab;
  user-select: none;
  text-align: center;
  font-size: 14px;
  line-height: 1;
}

.aimd-drag-handle:active {
  cursor: grabbing;
}

.aimd-mini-btn {
  border: 1px solid #d8dee8;
  background: #fff;
  color: #4b5563;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}

.aimd-mini-btn:hover {
  background: #f8fafc;
}

.aimd-mini-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.aimd-mini-btn-add {
  align-self: flex-start;
}

.aimd-dialog-preview {
  padding: 12px 14px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.aimd-preview-header {
  display: block;
  font-size: 12px;
  color: #6b7280;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.aimd-preview-panel {
  display: block;
  width: 100%;
  margin: 0;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid #dbe3ef;
  background: #fff;
  overflow: auto;
  max-height: 280px;
  line-height: 1.5;
}

.aimd-preview-code {
  display: block;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  color: #2563eb;
  word-break: break-word;
  white-space: pre-wrap;
}

.aimd-dialog-error {
  padding: 10px 12px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
}

.aimd-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid #f0f0f0;
}

.aimd-btn {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.aimd-btn-cancel {
  border: 1px solid #e0e0e0;
  background: #fff;
  color: #666;
}

.aimd-btn-cancel:hover {
  background: #f5f5f5;
}

.aimd-btn-primary {
  border: none;
  background: #1a73e8;
  color: #fff;
}

.aimd-btn-primary:hover {
  background: #1557b0;
}
</style>
