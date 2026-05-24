<script setup lang="ts">
import type { AimdRecorderMessages } from "../locales"
import type { DnaEditorMode } from "../composables/useDnaSequenceField"

const props = defineProps<{
  editorMode: DnaEditorMode
  topology: "linear" | "circular"
  sequenceLength: number
  gcPercent: number | null
  disabled: boolean
  importErrorMessage: string | null
  isInteractiveMode: boolean
  messages: Pick<AimdRecorderMessages, "dna">
}>()

const emit = defineEmits<{
  (e: "update:editorMode", value: DnaEditorMode): void
  (e: "update:topology", value: "linear" | "circular"): void
  (e: "importFile"): void
  (e: "exportGenBank"): void
  (e: "blur"): void
}>()

function setEditorMode(mode: DnaEditorMode) {
  emit("update:editorMode", mode)
}
</script>

<template>
  <span class="aimd-dna-field__toolbar">
    <label class="aimd-dna-field__toolbar-item aimd-dna-field__toolbar-item--mode">
      <span class="aimd-dna-field__toolbar-label">{{ props.messages.dna.editMode }}</span>
      <span class="aimd-dna-field__mode-switch" role="tablist" :aria-label="props.messages.dna.editMode">
        <button
          type="button"
          class="aimd-dna-field__mode-button"
          :class="{ 'aimd-dna-field__mode-button--active': editorMode === 'interactive' }"
          :disabled="props.disabled"
          @click="setEditorMode('interactive')"
        >
          {{ props.messages.dna.interactiveMode }}
        </button>
        <button
          type="button"
          class="aimd-dna-field__mode-button"
          :class="{ 'aimd-dna-field__mode-button--active': editorMode === 'raw' }"
          :disabled="props.disabled"
          @click="setEditorMode('raw')"
        >
          {{ props.messages.dna.rawMode }}
        </button>
      </span>
    </label>

    <label class="aimd-dna-field__toolbar-item">
      <span class="aimd-dna-field__toolbar-label">{{ props.messages.dna.topology }}</span>
      <select
        class="aimd-dna-field__select"
        :value="props.topology"
        :disabled="props.disabled"
        @change="emit('update:topology', ($event.target as HTMLSelectElement).value === 'circular' ? 'circular' : 'linear')"
        @blur="emit('blur')"
      >
        <option value="linear">{{ props.messages.dna.linear }}</option>
        <option value="circular">{{ props.messages.dna.circular }}</option>
      </select>
    </label>

    <span class="aimd-dna-field__stat">{{ props.messages.dna.length(props.sequenceLength) }}</span>
    <span class="aimd-dna-field__stat">
      {{ props.gcPercent === null ? props.messages.dna.gcUnavailable : props.messages.dna.gc(`${props.gcPercent.toFixed(1)}%`) }}
    </span>
    <span class="aimd-dna-field__toolbar-spacer" />
    <button
      type="button"
      class="aimd-dna-field__action aimd-dna-field__action--toolbar"
      :disabled="props.disabled"
      @click="emit('importFile')"
    >
      {{ props.messages.dna.onboardingImportFile }}
    </button>
    <button
      type="button"
      class="aimd-dna-field__action aimd-dna-field__action--toolbar"
      :disabled="props.disabled || props.sequenceLength <= 0"
      @click="emit('exportGenBank')"
    >
      {{ props.messages.dna.exportGenBank }}
    </button>
  </span>

  <span
    v-if="props.importErrorMessage && (!props.isInteractiveMode || props.sequenceLength > 0)"
    class="aimd-dna-field__hint aimd-dna-field__hint--error aimd-dna-field__hint--toolbar"
  >
    {{ props.importErrorMessage }}
  </span>
</template>
