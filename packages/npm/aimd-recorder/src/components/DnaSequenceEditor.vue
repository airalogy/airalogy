<script setup lang="ts">
import type { AimdRecorderMessages } from "../locales"

const props = defineProps<{
  sequence: string
  invalidCharacters: string[]
  disabled: boolean
  placeholder?: string
  messages: Pick<AimdRecorderMessages, "dna">
}>()

const emit = defineEmits<{
  (e: "update:sequence", value: string): void
  (e: "blur"): void
}>()

function onSequenceInput(event: Event) {
  emit("update:sequence", (event.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <span class="aimd-dna-field__section">
    <span class="aimd-dna-field__section-title">{{ props.messages.dna.sequence }}</span>
    <textarea
      class="aimd-dna-field__sequence"
      :disabled="props.disabled"
      :placeholder="props.placeholder || props.messages.dna.sequencePlaceholder"
      :value="props.sequence"
      spellcheck="false"
      @input="onSequenceInput"
      @blur="emit('blur')"
    />
    <span
      v-if="props.invalidCharacters.length"
      class="aimd-dna-field__hint aimd-dna-field__hint--error"
    >
      {{ props.messages.dna.invalidCharacters(props.invalidCharacters.join(', ')) }}
    </span>
    <span v-else class="aimd-dna-field__hint">
      {{ props.messages.dna.iupacHint }}
    </span>
  </span>
</template>
