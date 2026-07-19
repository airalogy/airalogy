<script setup lang="ts">
import { computed, ref, watch } from "vue"
import type { AimdVarNode } from "@airalogy/aimd-core/types"
import type {
  AimdEntityRefOption,
  AimdEntityRefValue,
  AimdEntityResolverEntry,
  AimdEntityResolverMap,
  AimdFieldMeta,
  AimdProtocolRecordData,
} from "../types"
import type { AimdRecorderMessages } from "../locales"
import type { EntityRefTypeConfig } from "../composables/useVarHelpers"
import { normalizeVarTypeName } from "../composables/useVarHelpers"

const props = defineProps<{
  node: AimdVarNode
  value?: unknown
  disabled?: boolean
  messages: AimdRecorderMessages
  fieldMeta?: AimdFieldMeta
  type: string
  entityConfig: EntityRefTypeConfig
  entityResolvers?: AimdEntityResolverMap
  record: AimdProtocolRecordData
}>()

const emit = defineEmits<{
  (e: "change", payload: { value: unknown }): void
  (e: "blur"): void
}>()

const query = ref("")
const options = ref<AimdEntityRefOption[]>([])
const searching = ref(false)
const searchError = ref("")
let searchRequestId = 0

const fieldKey = computed(() => `var:${props.node.id}`)
const entityName = computed(() => props.entityConfig.entity || "entity")
const resolver = computed<AimdEntityResolverEntry | undefined>(() => {
  const resolvers = props.entityResolvers
  if (!resolvers) return undefined
  return (props.entityConfig.source ? resolvers[props.entityConfig.source] : undefined)
    ?? (props.entityConfig.entity ? resolvers[props.entityConfig.entity] : undefined)
})

function normalizeEntityString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function normalizeEntityRefValue(value: unknown): AimdEntityRefValue | null {
  if (typeof value === "string") {
    const id = value.trim()
    if (!id) return null
    return {
      entity: entityName.value,
      source: props.entityConfig.source,
      id,
      label: id,
    }
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const id = normalizeEntityString(record.id)
    ?? normalizeEntityString(record.value)
    ?? normalizeEntityString(record.key)
  if (!id) return null

  const label = normalizeEntityString(record.label)
    ?? normalizeEntityString(record.name)
    ?? normalizeEntityString(record.title)
    ?? id
  const entity = normalizeEntityString(record.entity) ?? entityName.value
  const source = normalizeEntityString(record.source) ?? props.entityConfig.source

  const normalizedRecord = { ...record }
  delete normalizedRecord.disabled

  return {
    ...normalizedRecord,
    entity,
    id,
    source,
    label,
  }
}

const selectedRefs = computed<AimdEntityRefValue[]>(() => {
  if (props.entityConfig.multiple) {
    const values = Array.isArray(props.value) ? props.value : (props.value ? [props.value] : [])
    return values
      .map(item => normalizeEntityRefValue(item))
      .filter((item): item is AimdEntityRefValue => item !== null)
  }

  const normalized = normalizeEntityRefValue(props.value)
  return normalized ? [normalized] : []
})

const selectedKeySet = computed(() => new Set(
  selectedRefs.value.map(item => `${item.source ?? ""}:${item.entity}:${item.id}`),
))

function makeSearchContext() {
  return {
    type: props.type,
    normalizedType: normalizeVarTypeName(props.type),
    fieldKey: fieldKey.value,
    node: props.node,
    fieldMeta: props.fieldMeta,
    entity: props.entityConfig.entity,
    source: props.entityConfig.source,
    query: query.value,
    multiple: props.entityConfig.multiple,
    record: props.record,
  }
}

async function runSearch(): Promise<void> {
  const currentQuery = query.value.trim()
  const currentResolver = resolver.value
  const requestId = ++searchRequestId
  options.value = []
  searchError.value = ""
  if (!currentResolver || !currentQuery) {
    searching.value = false
    return
  }

  searching.value = true
  try {
    const search = typeof currentResolver === "function"
      ? currentResolver
      : currentResolver.search
    const result = await search(currentQuery, makeSearchContext())
    if (requestId === searchRequestId) {
      options.value = result
        .map(item => normalizeEntityRefValue(item))
        .filter((item): item is AimdEntityRefValue => item !== null)
        .map((item) => {
          const raw = result.find(candidate => normalizeEntityRefValue(candidate)?.id === item.id)
          return {
            ...(raw ?? item),
            ...item,
            disabled: Boolean((raw as AimdEntityRefOption | undefined)?.disabled),
            description: (raw as AimdEntityRefOption | undefined)?.description,
          }
        })
    }
  } catch {
    if (requestId === searchRequestId) {
      searchError.value = props.messages.entityRef.searchFailed
    }
  } finally {
    if (requestId === searchRequestId) {
      searching.value = false
    }
  }
}

watch(
  () => [
    query.value,
    props.entityResolvers,
    props.entityConfig.entity,
    props.entityConfig.source,
  ] as const,
  () => {
    void runSearch()
  },
  { immediate: true },
)

function emitSelected(nextRefs: AimdEntityRefValue[]): void {
  emit("change", {
    value: props.entityConfig.multiple
      ? nextRefs
      : nextRefs[0] ?? null,
  })
}

function selectRef(value: unknown): void {
  const normalized = normalizeEntityRefValue(value)
  if (!normalized) return

  if (props.entityConfig.multiple) {
    const key = `${normalized.source ?? ""}:${normalized.entity}:${normalized.id}`
    if (!selectedKeySet.value.has(key)) {
      emitSelected([...selectedRefs.value, normalized])
    }
  } else {
    emitSelected([normalized])
  }

  query.value = ""
  options.value = []
}

function selectManualQuery(): void {
  const id = query.value.trim()
  if (!id) return
  selectRef(id)
}

function removeRef(index: number): void {
  const nextRefs = selectedRefs.value.filter((_, itemIndex) => itemIndex !== index)
  emitSelected(nextRefs)
}

function clearSingle(): void {
  emitSelected([])
}

function optionKey(option: AimdEntityRefOption): string {
  return `${option.source ?? ""}:${option.entity}:${option.id}`
}

function displayLabel(value: AimdEntityRefValue): string {
  return value.label || value.id
}
</script>

<template>
  <span class="aimd-rec-entity-ref">
    <span v-if="selectedRefs.length" class="aimd-rec-entity-ref__selected">
      <span
        v-for="(item, index) in selectedRefs"
        :key="`${item.source ?? ''}:${item.entity}:${item.id}:${index}`"
        class="aimd-rec-entity-ref__chip"
      >
        <span class="aimd-rec-entity-ref__entity">{{ item.entity }}</span>
        <span class="aimd-rec-entity-ref__label" :title="displayLabel(item)">
          {{ displayLabel(item) }}
        </span>
        <span class="aimd-rec-entity-ref__id" :title="item.id">{{ item.id }}</span>
        <button
          v-if="!disabled"
          type="button"
          class="aimd-rec-entity-ref__chip-remove"
          :aria-label="messages.entityRef.remove"
          :title="messages.entityRef.remove"
          @click="removeRef(index)"
        >
          ×
        </button>
      </span>
    </span>

    <span class="aimd-rec-entity-ref__search-row">
      <input
        v-model="query"
        :data-rec-focus-key="fieldKey"
        class="aimd-rec-inline__value-control aimd-rec-inline__input aimd-rec-inline__input--stacked aimd-rec-entity-ref__input"
        :disabled="disabled"
        :placeholder="resolver ? messages.entityRef.searchPlaceholder(entityName) : messages.entityRef.manualIdPlaceholder"
        @keydown.enter.prevent="selectManualQuery"
        @blur="emit('blur')"
      >
      <button
        v-if="query.trim() && !disabled"
        type="button"
        class="aimd-rec-entity-ref__action"
        @click="selectManualQuery"
      >
        {{ entityConfig.multiple ? messages.entityRef.add : messages.entityRef.select }}
      </button>
      <button
        v-if="!entityConfig.multiple && selectedRefs.length && !disabled"
        type="button"
        class="aimd-rec-entity-ref__action aimd-rec-entity-ref__action--secondary"
        @click="clearSingle"
      >
        {{ messages.entityRef.clear }}
      </button>
    </span>

    <span v-if="!resolver" class="aimd-rec-entity-ref__hint">
      {{ messages.entityRef.noResolver }}
    </span>
    <span v-else-if="searchError" class="aimd-rec-entity-ref__error">
      {{ searchError }}
    </span>
    <span
      v-else-if="query.trim() && !searching && options.length === 0"
      class="aimd-rec-entity-ref__hint"
    >
      {{ messages.entityRef.noMatches }}
    </span>

    <span v-if="options.length" class="aimd-rec-entity-ref__options">
      <button
        v-for="option in options"
        :key="optionKey(option)"
        type="button"
        class="aimd-rec-entity-ref__option"
        :disabled="disabled || option.disabled || selectedKeySet.has(optionKey(option))"
        @click="selectRef(option)"
      >
        <span class="aimd-rec-entity-ref__option-label">{{ displayLabel(option) }}</span>
        <span class="aimd-rec-entity-ref__option-id">{{ option.id }}</span>
        <span v-if="option.description" class="aimd-rec-entity-ref__option-description">
          {{ option.description }}
        </span>
      </button>
    </span>
  </span>
</template>
