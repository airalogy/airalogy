<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { getAimdFieldDisplayLabel } from "@airalogy/aimd-core/utils"
import type { AimdVarNode } from "@airalogy/aimd-core/types"
import type { AimdRecorderMessages } from "../locales"
import { getAimdRecorderScopeLabel } from "../locales"
import type {
  AimdCollectorObservation,
  AimdCollectorRuntimeState,
  AimdFieldMeta,
} from "../types"
import type { AimdCollectorBinding } from "../composables/useCollectors"
import {
  getAimdCollectorManualValueType,
  parseAimdCollectorManualValue,
} from "../composables/useCollectors"

const props = defineProps<{
  node: AimdVarNode
  binding: AimdCollectorBinding
  value?: unknown
  state: AimdCollectorRuntimeState
  disabled?: boolean
  providerAvailable: boolean
  messages: AimdRecorderMessages
  fieldMeta?: AimdFieldMeta
  extraClasses?: string[]
}>()

const emit = defineEmits<{
  (event: "start"): void
  (event: "stop"): void
  (event: "manual", payload: { value: unknown; reason: string }): void
  (event: "blur"): void
}>()

const showManual = ref(false)
const manualValue = ref("")
const manualReason = ref("")
const manualError = ref("")

const type = computed(() => props.node.definition?.type || "Observation[str]")
const manualValueType = computed(() => getAimdCollectorManualValueType(type.value))
const title = computed(() => props.fieldMeta?.title || getAimdFieldDisplayLabel(props.node.id, props.node.definition))
const isBusy = computed(() => ["waiting_for_permission", "connecting", "collecting", "stopping"].includes(props.state.status))
const canStart = computed(() => (
  !props.disabled
  && props.providerAvailable
  && !isBusy.value
  && props.state.status !== "unsupported"
  && !props.binding.isSeries
  && props.binding.collector.mode !== "stream"
))
const canStop = computed(() => !props.disabled && ["connecting", "collecting"].includes(props.state.status))

const observations = computed<AimdCollectorObservation[]>(() => {
  const values = Array.isArray(props.value) ? props.value : [props.value]
  return values.filter((value): value is AimdCollectorObservation => Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, "value"),
  ))
})
const latestObservation = computed(() => observations.value[observations.value.length - 1])
const displayedValue = computed(() => formatValue(latestObservation.value?.value))
const displayedUnit = computed(() => latestObservation.value?.unit || String(props.node.definition?.kwargs?.unit ?? ""))
const displayedObservedAt = computed(() => {
  const value = latestObservation.value?.observed_at || props.state.lastObservedAt
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
})
const issueMessage = computed(() => {
  if (!props.providerAvailable) return props.messages.collector.providerUnavailable
  if (props.state.status === "unsupported") return props.messages.collector.unsupported
  if (props.state.error === "provider_unavailable") return props.messages.collector.providerUnavailable
  if (props.state.error === "permission_denied") return props.messages.collector.permissionDenied
  return props.state.error || ""
})

watch(
  () => props.disabled,
  disabled => {
    if (disabled) showManual.value = false
  },
)

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value
  if (["number", "boolean", "bigint"].includes(typeof value)) return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function start(): void {
  manualError.value = ""
  emit("start")
}

function toggleManual(): void {
  showManual.value = !showManual.value
  manualError.value = ""
}

function submitManual(): void {
  if (!manualReason.value.trim()) {
    manualError.value = props.messages.collector.reasonRequired
    return
  }
  const parsed = parseAimdCollectorManualValue(type.value, manualValue.value)
  if (!parsed.ok) {
    manualError.value = props.messages.collector.invalidValue
    return
  }
  emit("manual", { value: parsed.value, reason: manualReason.value.trim() })
  manualValue.value = ""
  manualReason.value = ""
  manualError.value = ""
  showManual.value = false
}
</script>

<template>
  <span
    class="aimd-rec-collector aimd-field-wrapper aimd-field-wrapper--inline"
    :class="[
      `aimd-rec-collector--${state.status}`,
      ...(extraClasses ?? []),
    ]"
    :data-rec-collector="binding.collector.id"
  >
    <span class="aimd-rec-collector__header">
      <span class="aimd-field__scope aimd-field__scope--var">{{ getAimdRecorderScopeLabel("var", messages) }}</span>
      <span class="aimd-rec-collector__identity">
        <span class="aimd-rec-collector__title">{{ title }}</span>
        <span v-if="title !== node.id" class="aimd-rec-collector__key">{{ node.id }}</span>
      </span>
      <span class="aimd-rec-collector__source" :title="binding.connector.id">
        {{ binding.collector.title || binding.collector.id }}
      </span>
      <span class="aimd-rec-collector__status" :class="`aimd-rec-collector__status--${state.status}`">
        <span class="aimd-rec-collector__status-dot" aria-hidden="true" />
        {{ messages.collector.status[state.status] }}
      </span>
    </span>

    <span class="aimd-rec-collector__body">
      <span class="aimd-rec-collector__reading">
        <span v-if="displayedValue" class="aimd-rec-collector__value" :title="displayedValue">{{ displayedValue }}</span>
        <span v-else class="aimd-rec-collector__empty">{{ messages.common.emptyValue }}</span>
        <span v-if="displayedUnit" class="aimd-rec-collector__unit">{{ displayedUnit }}</span>
      </span>

      <span class="aimd-rec-collector__meta">
        <span v-if="binding.isList">{{ messages.collector.sampleCount(observations.length) }}</span>
        <span v-if="displayedObservedAt">{{ messages.collector.lastObserved(displayedObservedAt) }}</span>
      </span>

      <span class="aimd-rec-collector__actions">
        <button
          v-if="canStop"
          type="button"
          class="aimd-rec-collector__button aimd-rec-collector__button--danger"
          :disabled="disabled"
          @click="emit('stop')"
        >
          {{ messages.collector.stop }}
        </button>
        <button
          v-else
          type="button"
          class="aimd-rec-collector__button aimd-rec-collector__button--primary"
          :disabled="!canStart"
          @click="start"
        >
          {{ state.status === "error"
            ? messages.collector.retry
            : binding.collector.mode === "snapshot"
              ? messages.collector.snapshot
              : messages.collector.start }}
        </button>
        <button
          v-if="binding.collector.manual_fallback"
          type="button"
          class="aimd-rec-collector__button"
          :disabled="disabled || isBusy"
          :aria-expanded="showManual"
          @click="toggleManual"
        >
          {{ showManual ? messages.collector.cancelManual : messages.collector.manualEntry }}
        </button>
      </span>
    </span>

    <span v-if="issueMessage" class="aimd-rec-collector__message" role="status">{{ issueMessage }}</span>

    <span v-if="showManual" class="aimd-rec-collector__manual">
      <textarea
        v-model="manualValue"
        :data-rec-focus-key="`var:${node.id}`"
        class="aimd-rec-collector__manual-value"
        rows="1"
        :placeholder="`${messages.collector.valuePlaceholder} (${manualValueType})`"
        :disabled="disabled"
        @blur="emit('blur')"
      />
      <input
        v-model="manualReason"
        class="aimd-rec-collector__manual-reason"
        type="text"
        :placeholder="messages.collector.reasonPlaceholder"
        :disabled="disabled"
        @blur="emit('blur')"
      >
      <button
        type="button"
        class="aimd-rec-collector__button aimd-rec-collector__button--primary"
        :disabled="disabled"
        @click="submitManual"
      >
        {{ messages.collector.saveManual }}
      </button>
      <span v-if="manualError" class="aimd-rec-collector__message aimd-rec-collector__message--error" role="alert">
        {{ manualError }}
      </span>
    </span>
  </span>
</template>
