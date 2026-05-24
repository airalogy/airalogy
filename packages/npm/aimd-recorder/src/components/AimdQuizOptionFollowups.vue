<script setup lang="ts">
import type { AimdQuizFollowupField } from "@airalogy/aimd-core/types"

type FollowupPrimitive = string | number | boolean
type FollowupInputScope = "true_false" | "single" | "multiple"

const props = defineProps<{
  quizId: string
  optionKey: string
  inputScope: FollowupInputScope
  followups: AimdQuizFollowupField[]
  values: Record<string, FollowupPrimitive>
  readonly?: boolean
  focusKeyPrefix?: string
}>()

const emit = defineEmits<{
  (e: "update", followup: AimdQuizFollowupField, value: string | boolean): void
}>()

function getFollowupLabel(followup: AimdQuizFollowupField): string {
  return followup.title || followup.key
}

function getFollowupTextValue(followup: AimdQuizFollowupField): string {
  const value = props.values[followup.key]
  if (typeof value === "string" || typeof value === "number") {
    return String(value)
  }
  return ""
}

function getFollowupBooleanValue(followup: AimdQuizFollowupField): boolean {
  return props.values[followup.key] === true
}
</script>

<template>
  <div class="aimd-quiz-recorder__followups">
    <label
      v-for="followup in followups"
      :key="`${quizId}-${inputScope}-${optionKey}-followup-${followup.key}`"
      class="aimd-quiz-recorder__followup"
    >
      <span class="aimd-quiz-recorder__followup-label">{{ getFollowupLabel(followup) }}</span>
      <input
        v-if="followup.type === 'bool'"
        type="checkbox"
        class="aimd-quiz-recorder__followup-checkbox"
        :data-rec-focus-key="`${focusKeyPrefix || `quiz:${quizId}`}:${inputScope}:${optionKey}:followup:${followup.key}`"
        :checked="getFollowupBooleanValue(followup)"
        :disabled="readonly"
        @change="emit('update', followup, ($event.target as HTMLInputElement).checked)"
      />
      <input
        v-else
        :type="followup.type === 'str' ? 'text' : 'number'"
        :step="followup.type === 'int' ? '1' : undefined"
        class="aimd-quiz-recorder__followup-input"
        :data-rec-focus-key="`${focusKeyPrefix || `quiz:${quizId}`}:${inputScope}:${optionKey}:followup:${followup.key}`"
        :value="getFollowupTextValue(followup)"
        :readonly="readonly"
        @input="emit('update', followup, ($event.target as HTMLInputElement).value)"
      />
      <span v-if="followup.unit" class="aimd-quiz-recorder__followup-unit">{{ followup.unit }}</span>
    </label>
  </div>
</template>

<style scoped>
.aimd-quiz-recorder__followups {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-left: 22px;
  padding: 8px 10px;
  border-left: 2px solid #dbeafe;
  background: #f8fbff;
}

.aimd-quiz-recorder__followup {
  display: grid;
  grid-template-columns: minmax(92px, max-content) minmax(120px, 1fr) auto;
  gap: 6px;
  align-items: center;
  font-size: 13px;
}

.aimd-quiz-recorder__followup-label {
  color: #344054;
  font-weight: 500;
}

.aimd-quiz-recorder__followup-input {
  min-width: 0;
  width: 100%;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 14px;
  line-height: 1.4;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.aimd-quiz-recorder__followup-input:focus {
  border-color: #4181fd;
  box-shadow: 0 0 0 2px rgba(65, 129, 253, 0.1);
}

.aimd-quiz-recorder__followup-checkbox {
  justify-self: start;
  width: 16px;
  height: 16px;
  accent-color: #4181fd;
}

.aimd-quiz-recorder__followup-unit {
  color: #667085;
}
</style>
