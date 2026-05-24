<script setup lang="ts">
import { computed } from 'vue'
import { useDemoLocale, useDemoMessages } from '../composables/demoI18n'
import {
  DEMO_EXAMPLES,
  resolveDemoExampleText,
  type DemoExample,
} from '../composables/sampleContent'

const props = defineProps<{
  selectedId: string
}>()

const emit = defineEmits<{
  (event: 'select', id: string): void
  (event: 'reset'): void
}>()

const { locale } = useDemoLocale()
const messages = useDemoMessages()

const examples = computed(() => DEMO_EXAMPLES)

function getTitle(example: DemoExample): string {
  return resolveDemoExampleText(example.title, locale.value)
}

function getDescription(example: DemoExample): string {
  return resolveDemoExampleText(example.description, locale.value)
}

function getBadge(example: DemoExample): string {
  return example.kind === 'case'
    ? messages.value.examples.caseBadge
    : messages.value.examples.exampleBadge
}
</script>

<template>
  <section class="demo-example-picker">
    <div class="demo-example-picker__header">
      <h3 class="demo-example-picker__title">{{ messages.examples.title }}</h3>
      <button type="button" class="demo-example-picker__reset" @click="emit('reset')">
        {{ messages.examples.resetCurrent }}
      </button>
    </div>

    <div class="demo-example-picker__list">
      <button
        v-for="example in examples"
        :key="example.id"
        type="button"
        :class="['demo-example-picker__item', { 'demo-example-picker__item--active': example.id === props.selectedId }]"
        @click="emit('select', example.id)"
      >
        <span class="demo-example-picker__item-head">
          <span class="demo-example-picker__item-title">{{ getTitle(example) }}</span>
          <span class="demo-example-picker__badge">{{ getBadge(example) }}</span>
        </span>
        <span class="demo-example-picker__desc">{{ getDescription(example) }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.demo-example-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  background: #fff;
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
  .demo-example-picker__header {
    align-items: stretch;
    flex-direction: column;
  }

  .demo-example-picker__reset {
    width: fit-content;
  }
}
</style>
