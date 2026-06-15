<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDemoLocale, useDemoMessages } from '../composables/demoI18n'
import {
  DEMO_EXAMPLES,
  resolveDemoExampleText,
  type DemoExample,
} from '../composables/sampleContent'

const props = withDefaults(defineProps<{
  selectedId: string
  variant?: 'compact' | 'list'
}>(), {
  variant: 'compact',
})

const emit = defineEmits<{
  (event: 'select', id: string): void
  (event: 'reset'): void
}>()

const { locale } = useDemoLocale()
const messages = useDemoMessages()

const examples = computed(() => DEMO_EXAMPLES)
const isListOpen = ref(false)
const selectedExample = computed(() => (
  examples.value.find(example => example.id === props.selectedId) ?? examples.value[0]
))
const toggleLabel = computed(() => (
  isListOpen.value
    ? messages.value.examples.hideList
    : messages.value.examples.changeCurrent
))

function getTitle(example: DemoExample): string {
  return resolveDemoExampleText(example.title, locale.value)
}

function getDescription(example: DemoExample): string {
  return resolveDemoExampleText(example.description, locale.value)
}

function getBadge(example: DemoExample): string {
  if (example.kind === 'protocol') {
    return messages.value.examples.protocolBadge
  }
  if (example.kind === 'case') {
    return messages.value.examples.caseBadge
  }
  return messages.value.examples.exampleBadge
}

function handleSelect(id: string) {
  emit('select', id)
  isListOpen.value = false
}

function handleReset() {
  emit('reset')
  isListOpen.value = false
}
</script>

<template>
  <section
    class="demo-example-picker"
    :class="`demo-example-picker--${props.variant}`"
  >
    <div v-if="props.variant === 'compact'" class="demo-example-picker__current">
      <span class="demo-example-picker__current-copy">
        <span class="demo-example-picker__current-label">{{ messages.examples.title }}</span>
        <span class="demo-example-picker__current-title">{{ getTitle(selectedExample) }}</span>
        <span class="demo-example-picker__badge">{{ getBadge(selectedExample) }}</span>
        <span class="demo-example-picker__current-desc">{{ getDescription(selectedExample) }}</span>
      </span>
      <span class="demo-example-picker__current-actions">
        <button
          type="button"
          class="demo-example-picker__control demo-example-picker__control--primary"
          :aria-expanded="isListOpen"
          @click="isListOpen = !isListOpen"
        >
          {{ toggleLabel }}
        </button>
        <button type="button" class="demo-example-picker__control" @click="handleReset">
          {{ messages.examples.resetCurrent }}
        </button>
      </span>
    </div>

    <div
      v-if="props.variant === 'list' || isListOpen"
      class="demo-example-picker__list-panel"
      :class="{ 'demo-example-picker__list-panel--popover': props.variant === 'compact' }"
    >
      <div class="demo-example-picker__header">
        <h3 class="demo-example-picker__title">{{ messages.examples.title }}</h3>
        <button type="button" class="demo-example-picker__reset" @click="handleReset">
          {{ messages.examples.resetCurrent }}
        </button>
      </div>

      <div class="demo-example-picker__list">
        <button
          v-for="example in examples"
          :key="example.id"
          type="button"
          :class="['demo-example-picker__item', { 'demo-example-picker__item--active': example.id === props.selectedId }]"
          @click="handleSelect(example.id)"
        >
          <span class="demo-example-picker__item-head">
            <span class="demo-example-picker__item-title">{{ getTitle(example) }}</span>
            <span class="demo-example-picker__badge">{{ getBadge(example) }}</span>
          </span>
          <span class="demo-example-picker__desc">{{ getDescription(example) }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.demo-example-picker {
  position: relative;
}

.demo-example-picker--list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  background: #fff;
}

.demo-example-picker__current {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 10px 9px 14px;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
}

.demo-example-picker__current-copy {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.demo-example-picker__current-label {
  flex: 0 0 auto;
  color: #667085;
  font-size: 12px;
  font-weight: 700;
}

.demo-example-picker__current-title {
  min-width: 0;
  overflow: hidden;
  color: #1d2939;
  font-size: 14px;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.demo-example-picker__current-desc {
  min-width: 0;
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.demo-example-picker__current-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.demo-example-picker__list-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.demo-example-picker__list-panel--popover {
  position: absolute;
  z-index: 30;
  top: calc(100% + 8px);
  right: 0;
  left: 0;
  max-height: min(56vh, 430px);
  overflow: auto;
  padding: 14px;
  border: 1px solid #cfd9e8;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
}

.demo-example-picker__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.demo-example-picker__title {
  color: #1a1a2e;
  font-size: 14px;
  font-weight: 700;
}

.demo-example-picker__reset {
  height: 30px;
  padding: 0 10px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #fff;
  color: #475467;
  cursor: pointer;
  font-size: 12px;
}

.demo-example-picker__reset:hover {
  border-color: #1a73e8;
  color: #1a73e8;
}

.demo-example-picker__control {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #fff;
  color: #475467;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.demo-example-picker__control:hover {
  border-color: #1a73e8;
  color: #1a73e8;
}

.demo-example-picker__control--primary {
  border-color: #b7d0ff;
  background: #eef4ff;
  color: #1a73e8;
}

.demo-example-picker__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
}

.demo-example-picker__item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  background: #fcfcfd;
  color: #344054;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
}

.demo-example-picker__item:hover {
  border-color: #adc8f8;
  background: #f8fbff;
}

.demo-example-picker__item--active {
  border-color: #1a73e8;
  background: #f3f7ff;
  box-shadow: 0 0 0 1px rgba(26, 115, 232, 0.12);
}

.demo-example-picker__item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.demo-example-picker__item-title {
  color: #1d2939;
  font-size: 14px;
  font-weight: 700;
}

.demo-example-picker__badge {
  flex: 0 0 auto;
  padding: 2px 7px;
  border-radius: 999px;
  background: #eef4ff;
  color: #1a73e8;
  font-size: 11px;
  font-weight: 700;
}

.demo-example-picker__desc {
  display: block;
  color: #475467;
  font-size: 12px;
  line-height: 1.45;
}

@media (max-width: 640px) {
  .demo-example-picker__current {
    align-items: stretch;
    flex-direction: column;
  }

  .demo-example-picker__current-copy {
    flex-wrap: wrap;
  }

  .demo-example-picker__current-desc {
    flex-basis: 100%;
  }

  .demo-example-picker__current-actions {
    justify-content: flex-start;
  }

  .demo-example-picker__header {
    align-items: stretch;
    flex-direction: column;
  }

  .demo-example-picker__reset {
    width: fit-content;
  }
}
</style>
