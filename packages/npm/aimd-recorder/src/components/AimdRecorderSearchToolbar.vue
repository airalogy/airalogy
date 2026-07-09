<script setup lang="ts">
import { nextTick, ref, watch } from "vue"
import type { AimdRecordFieldRef } from "@airalogy/aimd-core/utils"
import type { AimdRecorderMessages } from "../locales"

const props = defineProps<{
  fieldKey: string
  fieldRefs: AimdRecordFieldRef[]
  matchCount: number
  messages: AimdRecorderMessages
  panelVisible: boolean
  query: string
  resultLabel: string
}>()

const emit = defineEmits<{
  (event: "clear"): void
  (event: "collapse"): void
  (event: "expand"): void
  (event: "next"): void
  (event: "previous"): void
  (event: "update:fieldKey", value: string): void
  (event: "update:query", value: string): void
}>()

const searchInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.panelVisible,
  async (panelVisible) => {
    if (!panelVisible) {
      return
    }
    await nextTick()
    searchInputRef.value?.focus()
  },
)
</script>

<template>
  <div
    class="aimd-protocol-recorder__search-shell"
    :class="{ 'aimd-protocol-recorder__search-shell--expanded': panelVisible }"
  >
    <button
      v-if="!panelVisible"
      type="button"
      class="aimd-protocol-recorder__search-toggle"
      data-rec-search-toggle
      :aria-label="messages.search.label"
      @click="emit('expand')"
    >
      {{ messages.search.label }}
    </button>
    <div v-else class="aimd-protocol-recorder__search">
      <select
        class="aimd-protocol-recorder__search-field"
        :aria-label="messages.search.fieldLabel"
        :value="fieldKey"
        @change="emit('update:fieldKey', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ messages.search.allFields }}</option>
        <option
          v-for="field in fieldRefs"
          :key="field.key"
          :value="field.key"
        >
          {{ field.label }}
        </option>
      </select>
      <input
        ref="searchInputRef"
        class="aimd-protocol-recorder__search-input"
        type="search"
        :value="query"
        :placeholder="messages.search.placeholder"
        :aria-label="messages.search.label"
        @input="emit('update:query', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="emit('next')"
      >
      <span v-if="resultLabel" class="aimd-protocol-recorder__search-count">
        {{ resultLabel }}
      </span>
      <button
        type="button"
        class="aimd-protocol-recorder__search-button"
        :disabled="matchCount === 0"
        :aria-label="messages.search.previous"
        :title="messages.search.previous"
        @click="emit('previous')"
      >
        &lt;
      </button>
      <button
        type="button"
        class="aimd-protocol-recorder__search-button"
        :disabled="matchCount === 0"
        :aria-label="messages.search.next"
        :title="messages.search.next"
        @click="emit('next')"
      >
        &gt;
      </button>
      <button
        v-if="query || fieldKey"
        type="button"
        class="aimd-protocol-recorder__search-button aimd-protocol-recorder__search-button--clear"
        :aria-label="messages.search.clear"
        :title="messages.search.clear"
        @click="emit('clear')"
      >
        x
      </button>
      <button
        v-else
        type="button"
        class="aimd-protocol-recorder__search-button aimd-protocol-recorder__search-button--collapse"
        data-rec-search-collapse
        :aria-label="messages.search.collapse"
        :title="messages.search.collapse"
        @click="emit('collapse')"
      >
        {{ messages.search.collapse }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.aimd-protocol-recorder__search-shell {
  position: sticky;
  top: var(--aimd-recorder-search-sticky-top, 0px);
  z-index: 30;
  display: flex;
  justify-content: flex-end;
  box-sizing: border-box;
  margin-inline: calc(-1 * var(--aimd-recorder-gutter-x));
  margin-bottom: 0;
  padding: 0 var(--aimd-recorder-gutter-x);
  background: transparent;
  pointer-events: none;
}

.aimd-protocol-recorder__search-shell--expanded {
  justify-content: stretch;
  margin-bottom: 8px;
  padding-block: 0;
  padding-inline: var(--aimd-recorder-gutter-x);
  border: 1px solid #d8e4f2;
  border-radius: 0 0 10px 10px;
  background: #f8fbff;
  backdrop-filter: blur(4px);
  box-shadow: 0 1px 0 rgba(23, 45, 77, 0.06);
  pointer-events: auto;
}

.aimd-protocol-recorder__search {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  pointer-events: auto;
}

.aimd-protocol-recorder__search-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid #c8d4e3;
  border-radius: 8px;
  background: #fff;
  color: #0b63c7;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(23, 45, 77, 0.06);
  pointer-events: auto;
}

.aimd-protocol-recorder__search-field,
.aimd-protocol-recorder__search-input {
  min-height: 32px;
  border: 1px solid #c8d4e3;
  border-radius: 8px;
  background: #fff;
  color: var(--rec-text);
  font: inherit;
}

.aimd-protocol-recorder__search-field {
  max-width: min(240px, 100%);
  padding: 0 28px 0 10px;
}

.aimd-protocol-recorder__search-input {
  flex: 1 1 240px;
  min-width: min(220px, 100%);
  padding: 0 10px;
}

.aimd-protocol-recorder__search-field:focus,
.aimd-protocol-recorder__search-input:focus,
.aimd-protocol-recorder__search-toggle:focus,
.aimd-protocol-recorder__search-button:focus {
  outline: 2px solid color-mix(in srgb, var(--rec-focus) 26%, transparent);
  outline-offset: 1px;
  border-color: #75b7ff;
}

.aimd-protocol-recorder__search-count {
  min-width: 72px;
  color: var(--rec-muted);
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}

.aimd-protocol-recorder__search-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #c8d4e3;
  border-radius: 8px;
  background: #fff;
  color: #0b63c7;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.aimd-protocol-recorder__search-button:disabled {
  color: #98a2b3;
  cursor: default;
  opacity: 0.65;
}

.aimd-protocol-recorder__search-button--clear {
  color: #475467;
}

.aimd-protocol-recorder__search-button--collapse {
  width: auto;
  min-width: 48px;
  padding: 0 10px;
  color: #475467;
  font-size: 12px;
}
</style>
