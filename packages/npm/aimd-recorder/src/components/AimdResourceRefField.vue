<script setup lang="ts">
import { computed, ref, watch } from "vue"
import type { AimdVarNode } from "@airalogy/aimd-core/types"
import type {
  AimdEntityResolverMap,
  AimdFieldMeta,
  AimdProtocolRecordData,
  AimdResourceAvailability,
  AimdResourceRefValue,
  AimdResourceResolver,
  AimdResourceResolverMap,
} from "../types"
import type { AimdRecorderMessages } from "../locales"
import type { ResourceRefTypeConfig } from "../composables/useVarHelpers"
import { normalizeVarTypeName } from "../composables/useVarHelpers"
import AimdEntityRefField from "./AimdEntityRefField.vue"

const props = defineProps<{
  node: AimdVarNode
  value?: unknown
  disabled?: boolean
  messages: AimdRecorderMessages
  fieldMeta?: AimdFieldMeta
  type: string
  resourceConfig: ResourceRefTypeConfig
  resourceResolvers?: AimdResourceResolverMap
  record: AimdProtocolRecordData
}>()

const emit = defineEmits<{
  (e: "change", payload: { value: unknown }): void
  (e: "blur"): void
}>()

const availability = ref<AimdResourceAvailability | null>(null)
const availabilityError = ref("")
const availabilityLoading = ref(false)
let availabilityRequest = 0
let outputRequest = 0

const resolver = computed<AimdResourceResolver | undefined>(() => {
  const resolvers = props.resourceResolvers
  if (!resolvers) return undefined
  return (props.resourceConfig.source ? resolvers[props.resourceConfig.source] : undefined)
    ?? (props.resourceConfig.entity ? resolvers[props.resourceConfig.entity] : undefined)
    ?? resolvers.resource
})

const entityResolvers = computed<AimdEntityResolverMap | undefined>(() => {
  if (!resolver.value) return undefined
  const adapter = {
    search: resolver.value.search,
    resolve: resolver.value.resolve,
  }
  const result: AimdEntityResolverMap = {}
  if (props.resourceConfig.source) result[props.resourceConfig.source] = adapter
  if (props.resourceConfig.entity) result[props.resourceConfig.entity] = adapter
  return result
})

function asResourceRef(value: unknown): AimdResourceRefValue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  if (typeof item.id !== "string" || !item.id.trim()) return null
  return {
    ...item,
    entity: typeof item.entity === "string" && item.entity.trim()
      ? item.entity
      : props.resourceConfig.entity ?? "resource",
    id: item.id.trim(),
  } as AimdResourceRefValue
}

const selected = computed(() => {
  if (props.resourceConfig.multiple) {
    const values = Array.isArray(props.value) ? props.value : []
    return values.map(asResourceRef).filter((item): item is AimdResourceRefValue => item !== null)
  }
  const value = asResourceRef(props.value)
  return value ? [value] : []
})

function resourceContext() {
  return {
    type: props.type,
    normalizedType: normalizeVarTypeName(props.type),
    fieldKey: `var:${props.node.id}`,
    node: props.node,
    fieldMeta: props.fieldMeta,
    entity: props.resourceConfig.entity,
    source: props.resourceConfig.source,
    multiple: props.resourceConfig.multiple,
    record: props.record,
    role: props.resourceConfig.role,
    quantityField: props.resourceConfig.quantityField,
    containerRequired: props.resourceConfig.containerRequired,
    bookingRequired: props.resourceConfig.bookingRequired,
  }
}

async function loadAvailability(): Promise<void> {
  const resource = selected.value[0]
  const currentResolver = resolver.value
  const request = ++availabilityRequest
  availability.value = null
  availabilityError.value = ""
  if (!resource || !currentResolver?.getAvailability || props.resourceConfig.multiple) return
  availabilityLoading.value = true
  try {
    const result = await currentResolver.getAvailability(resource, resourceContext())
    if (request === availabilityRequest) availability.value = result
  }
  catch {
    if (request === availabilityRequest) {
      availabilityError.value = props.messages.resourceRef.availabilityFailed
    }
  }
  finally {
    if (request === availabilityRequest) availabilityLoading.value = false
  }
}

watch(
  () => [
    selected.value[0]?.id,
    selected.value[0]?.lot_id,
    props.resourceResolvers,
  ],
  () => void loadAvailability(),
  { immediate: true },
)

function emitSinglePatch(patch: Partial<AimdResourceRefValue>): void {
  const current = selected.value[0]
  if (!current) return
  emit("change", { value: { ...current, ...patch } })
}

async function prepareOutputValue(value: unknown): Promise<unknown> {
  const currentResolver = resolver.value
  if (props.resourceConfig.role !== "output" || !currentResolver?.prepareOutput) {
    return value
  }
  const values = props.resourceConfig.multiple
    ? (Array.isArray(value) ? value : [])
    : [value]
  const preparedValues: AimdResourceRefValue[] = []
  for (const item of values) {
    const draft = asResourceRef(item)
    if (!draft) continue
    const prepared = await currentResolver.prepareOutput(draft, resourceContext())
    preparedValues.push({
      ...prepared.value,
      prepared_output: prepared.payload,
    })
  }
  return props.resourceConfig.multiple ? preparedValues : preparedValues[0] ?? value
}

async function onBaseChange(value: unknown): Promise<void> {
  const request = ++outputRequest
  availabilityError.value = ""
  try {
    const prepared = await prepareOutputValue(value)
    if (request === outputRequest) emit("change", { value: prepared })
  }
  catch {
    if (request === outputRequest) {
      availabilityError.value = props.messages.resourceRef.prepareOutputFailed
    }
  }
}

function slotValue(slot: NonNullable<AimdResourceAvailability["equipment_slots"]>[number]): string {
  return slot.id ?? `${slot.starts_at}/${slot.ends_at}`
}

function onBookingChange(value: string): void {
  const slot = availability.value?.equipment_slots?.find(item => slotValue(item) === value)
  emitSinglePatch({
    booking_id: value || undefined,
    snapshot: slot
      ? { ...(selected.value[0]?.snapshot ?? {}), booking_slot: slot }
      : selected.value[0]?.snapshot,
  })
}
</script>

<template>
  <span class="aimd-rec-resource-ref">
    <AimdEntityRefField
      :node="node"
      :value="value"
      :disabled="disabled"
      :messages="messages"
      :field-meta="fieldMeta"
      :type="type"
      :entity-config="resourceConfig"
      :entity-resolvers="entityResolvers"
      :record="record"
      @change="onBaseChange($event.value)"
      @blur="emit('blur')"
    />

    <span
      v-if="selected.length === 1 && !resourceConfig.multiple"
      class="aimd-rec-resource-ref__details"
    >
      <span
        v-if="availabilityLoading || availability?.available !== undefined"
        class="aimd-rec-resource-ref__available"
      >
        {{ messages.resourceRef.available }}:
        {{ availabilityLoading ? "…" : availability?.available }}
        {{ availability?.unit || "" }}
      </span>
      <span v-if="availabilityError" class="aimd-rec-resource-ref__error">
        {{ availabilityError }}
      </span>

      <label v-if="availability?.lots?.length" class="aimd-rec-resource-ref__field">
        <span>{{ messages.resourceRef.lot }}</span>
        <select
          :disabled="disabled"
          :value="selected[0].lot_id || ''"
          @change="emitSinglePatch({ lot_id: ($event.target as HTMLSelectElement).value || undefined, container_id: undefined })"
          @blur="emit('blur')"
        >
          <option value="">{{ messages.resourceRef.selectLot }}</option>
          <option
            v-for="lot in availability.lots"
            :key="lot.id"
            :value="lot.id"
            :disabled="lot.disabled"
          >
            {{ lot.label || lot.id }}
            <template v-if="lot.available !== undefined">
              — {{ lot.available }} {{ lot.unit || availability.unit || "" }}
            </template>
          </option>
        </select>
      </label>

      <label
        v-if="availability?.containers?.length || resourceConfig.containerRequired"
        class="aimd-rec-resource-ref__field"
      >
        <span>{{ messages.resourceRef.container }}</span>
        <select
          :disabled="disabled"
          :value="selected[0].container_id || ''"
          @change="emitSinglePatch({ container_id: ($event.target as HTMLSelectElement).value || undefined })"
          @blur="emit('blur')"
        >
          <option value="">{{ messages.resourceRef.selectContainer }}</option>
          <option
            v-for="container in availability?.containers || []"
            :key="container.id"
            :value="container.id"
            :disabled="container.disabled || Boolean(selected[0].lot_id && container.lot_id && container.lot_id !== selected[0].lot_id)"
          >
            {{ container.label || container.id }}
            <template v-if="container.location"> — {{ container.location }}</template>
          </option>
        </select>
      </label>

      <span
        v-if="resourceConfig.role === 'input' || resourceConfig.role === 'output'"
        class="aimd-rec-resource-ref__quantity-row"
      >
        <label v-if="!resourceConfig.quantityField" class="aimd-rec-resource-ref__field">
          <span>{{ messages.resourceRef.quantity }}</span>
          <input
            type="number"
            min="0"
            step="any"
            :disabled="disabled"
            :value="selected[0].quantity ?? ''"
            @input="emitSinglePatch({ quantity: ($event.target as HTMLInputElement).value || undefined })"
            @blur="emit('blur')"
          >
        </label>
        <label class="aimd-rec-resource-ref__field aimd-rec-resource-ref__field--unit">
          <span>{{ messages.resourceRef.unit }}</span>
          <input
            type="text"
            :disabled="disabled"
            :value="selected[0].unit || availability?.unit || ''"
            @input="emitSinglePatch({ unit: ($event.target as HTMLInputElement).value || undefined })"
            @blur="emit('blur')"
          >
        </label>
      </span>

      <span
        v-if="resourceConfig.quantityField"
        class="aimd-rec-resource-ref__binding"
      >
        {{ messages.resourceRef.quantityFrom(resourceConfig.quantityField) }}
      </span>

      <label
        v-if="resourceConfig.role === 'equipment' && (availability?.equipment_slots?.length || resourceConfig.bookingRequired)"
        class="aimd-rec-resource-ref__field"
      >
        <span>{{ messages.resourceRef.booking }}</span>
        <select
          :disabled="disabled"
          :value="selected[0].booking_id || ''"
          @change="onBookingChange(($event.target as HTMLSelectElement).value)"
          @blur="emit('blur')"
        >
          <option value="">{{ messages.resourceRef.selectBooking }}</option>
          <option
            v-for="slot in availability?.equipment_slots || []"
            :key="slotValue(slot)"
            :value="slotValue(slot)"
            :disabled="slot.available === false"
          >
            {{ slot.label || `${slot.starts_at} – ${slot.ends_at}` }}
          </option>
        </select>
      </label>
    </span>
  </span>
</template>

<style scoped>
.aimd-rec-resource-ref,
.aimd-rec-resource-ref__details {
  display: flex;
  min-width: 0;
  width: 100%;
  flex-direction: column;
  gap: 0.5rem;
}

.aimd-rec-resource-ref__details {
  padding: 0.625rem;
  border: 1px solid color-mix(in srgb, var(--aimd-rec-accent, #1473e6) 18%, transparent);
  border-radius: 0.625rem;
  background: color-mix(in srgb, var(--aimd-rec-accent, #1473e6) 4%, transparent);
}

.aimd-rec-resource-ref__available {
  color: var(--aimd-rec-text-muted, #64748b);
  font-size: 0.8125rem;
}

.aimd-rec-resource-ref__error {
  color: var(--aimd-rec-danger, #dc2626);
  font-size: 0.8125rem;
}

.aimd-rec-resource-ref__binding {
  color: var(--aimd-rec-text-muted, #64748b);
  font-size: 0.75rem;
}

.aimd-rec-resource-ref__field {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(5rem, max-content) minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem;
  color: var(--aimd-rec-text-muted, #64748b);
  font-size: 0.8125rem;
}

.aimd-rec-resource-ref__field select,
.aimd-rec-resource-ref__field input {
  min-width: 0;
  height: 2rem;
  padding: 0 0.5rem;
  border: 1px solid var(--aimd-rec-border, #cbd5e1);
  border-radius: 0.375rem;
  color: var(--aimd-rec-text, #0f172a);
  background: var(--aimd-rec-surface, #fff);
}

.aimd-rec-resource-ref__quantity-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(8rem, 0.45fr);
  gap: 0.5rem;
}

@media (max-width: 640px) {
  .aimd-rec-resource-ref__quantity-row {
    grid-template-columns: 1fr;
  }
}
</style>
