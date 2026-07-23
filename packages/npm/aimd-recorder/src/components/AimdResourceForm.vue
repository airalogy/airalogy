<script setup lang="ts">
import { ref, useAttrs } from "vue"
import type { ExtractedAimdFields } from "@airalogy/aimd-core/types"
import {
  validateAimdProtocolContract,
  type AimdResourceValidationIssue,
} from "@airalogy/aimd-core"
import type {
  AimdProtocolRecordData,
  AimdRecorderValidationResult,
  AimdResourceResolverMap,
} from "../types"
import AimdRecorder from "./AimdRecorder.vue"

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  content: string
  modelValue?: Partial<AimdProtocolRecordData>
  readonly?: boolean
  locale?: string
  resourceResolvers?: AimdResourceResolverMap
  title?: string
  description?: string
}>(), {
  modelValue: undefined,
  readonly: false,
  locale: undefined,
  resourceResolvers: undefined,
  title: undefined,
  description: undefined,
})

const emit = defineEmits<{
  (event: "update:modelValue", value: AimdProtocolRecordData): void
  (event: "fields-change", fields: ExtractedAimdFields): void
  (event: "error", message: string): void
  (event: "validation", result: AimdRecorderValidationResult): void
  (event: "contract-error", issues: AimdResourceValidationIssue[]): void
}>()

const attrs = useAttrs()
const recorder = ref<InstanceType<typeof AimdRecorder> | null>(null)

function handleFieldsChange(fields: ExtractedAimdFields): void {
  emit("fields-change", fields)
  const issues = validateAimdProtocolContract(
    { kind: "resource_definition" },
    fields,
  )
  if (issues.length > 0) emit("contract-error", issues)
}

function validate(options?: { focus?: boolean }): Promise<AimdRecorderValidationResult> {
  if (!recorder.value) {
    return Promise.resolve({
      valid: true,
      issues: [],
      fieldState: {},
    })
  }
  return recorder.value.validate(options)
}

defineExpose({
  validate,
  validateField: (...args: Parameters<NonNullable<typeof recorder.value>["validateField"]>) =>
    recorder.value?.validateField(...args),
  clearValidation: (...args: Parameters<NonNullable<typeof recorder.value>["clearValidation"]>) =>
    recorder.value?.clearValidation(...args),
  focusFirstInvalidField: () => recorder.value?.focusFirstInvalidField() ?? false,
})
</script>

<template>
  <section class="aimd-resource-form">
    <header v-if="title || description" class="aimd-resource-form__header">
      <h2 v-if="title" class="aimd-resource-form__title">{{ title }}</h2>
      <p v-if="description" class="aimd-resource-form__description">{{ description }}</p>
    </header>
    <AimdRecorder
      ref="recorder"
      v-bind="attrs"
      :content="content"
      :model-value="modelValue"
      :readonly="readonly"
      :locale="locale"
      :resource-resolvers="resourceResolvers"
      :show-search="false"
      @update:model-value="emit('update:modelValue', $event)"
      @fields-change="handleFieldsChange"
      @error="emit('error', $event)"
      @validation="emit('validation', $event)"
    />
  </section>
</template>

<style scoped>
.aimd-resource-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  min-width: 0;
}

.aimd-resource-form__header {
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--aimd-rec-border, #d8e2ef);
}

.aimd-resource-form__title,
.aimd-resource-form__description {
  margin: 0;
}

.aimd-resource-form__title {
  color: var(--aimd-rec-text, #172b4d);
  font-size: 1.125rem;
  line-height: 1.35;
}

.aimd-resource-form__description {
  margin-top: 0.25rem;
  color: var(--aimd-rec-text-muted, #64748b);
  font-size: 0.875rem;
  line-height: 1.55;
}
</style>
