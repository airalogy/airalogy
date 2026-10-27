<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CalendarDays, SquareCheck, ChevronDown, CircleDot, Clock, Hash, ListChecks, ListOrdered, Paperclip, Settings2, TextCursorInput, ToggleLeft } from '@lucide/vue'
import type { AimdEditorMessages } from './locales'

const props = defineProps<{ messages: AimdEditorMessages }>()
const emit = defineEmits<{ (e: 'insert', preset: string): void }>()
const more = ref<HTMLDetailsElement>()
const menuLeft = ref(0)
const common = computed(() => [
  { preset: 'str', label: props.messages.inputField.text, icon: TextCursorInput },
  { preset: 'int', label: props.messages.inputField.integer, icon: Hash },
  { preset: 'float', label: props.messages.inputField.number, icon: Hash },
  { preset: 'choice', label: props.messages.inputField.choice, icon: CircleDot },
  { preset: 'multiple-choice', label: props.messages.inputField.multipleChoice, icon: SquareCheck },
  { preset: 'bool | None', label: props.messages.inputField.boolean, icon: ToggleLeft },
])
const secondary = computed(() => [
  { preset: 'date', label: props.messages.inputField.date, icon: CalendarDays },
  { preset: 'time', label: props.messages.inputField.time, icon: Clock },
  { preset: 'datetime', label: props.messages.inputField.datetime, icon: CalendarDays },
  { preset: 'list[str]', label: props.messages.inputField.list, icon: ListOrdered },
  { preset: 'file', label: props.messages.inputField.file, icon: Paperclip },
  { preset: 'custom', label: props.messages.inputField.custom, icon: Settings2 },
])

function closeMore(restoreFocus = false) {
  if (!more.value?.open) return
  more.value.open = false
  if (restoreFocus) more.value.querySelector('summary')?.focus()
}
function insert(preset: string) {
  closeMore()
  emit('insert', preset)
}
function onOutside(event: MouseEvent) {
  if (event.target instanceof Node && !more.value?.contains(event.target)) closeMore()
}
function positionMenu() {
  if (!more.value?.open) return
  const left = more.value.getBoundingClientRect().left
  menuLeft.value = Math.max(8 - left, Math.min(0, window.innerWidth - left - 198))
}
onMounted(() => document.addEventListener('click', onOutside))
onBeforeUnmount(() => document.removeEventListener('click', onOutside))
</script>

<template>
  <div class="aimd-input-tools" role="group" :aria-label="messages.inputField.insert">
    <button v-for="item in common" :key="item.preset" type="button" :title="messages.inputField.insertType(item.label)" :aria-label="messages.inputField.insertType(item.label)" @mousedown.prevent @click="insert(item.preset)">
      <component :is="item.icon" :size="16" aria-hidden="true" />
      <span>{{ item.label }}</span>
    </button>
    <details ref="more" class="aimd-input-tools__more" @toggle="positionMenu" @keydown.esc.stop.prevent="closeMore(true)">
      <summary><ListChecks :size="16" aria-hidden="true" /><span>{{ messages.inputField.more }}</span><ChevronDown :size="14" aria-hidden="true" /></summary>
      <div class="aimd-input-tools__menu" :style="{ left: `${menuLeft}px` }" role="group" :aria-label="messages.inputField.more">
        <button v-for="item in secondary" :key="item.preset" type="button" :title="messages.inputField.insertType(item.label)" @click="insert(item.preset)">
          <component :is="item.icon" :size="16" aria-hidden="true" /><span>{{ item.label }}</span>
        </button>
      </div>
    </details>
  </div>
</template>

<style scoped>
.aimd-input-tools { display: flex; flex: 0 0 100%; flex-wrap: wrap; align-items: center; gap: 4px; min-width: 0; padding-top: 6px; border-top: 1px solid #e0e5eb; }
button, summary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; box-sizing: border-box; padding: 5px 9px; border: 1px solid transparent; border-radius: 4px; background: transparent; color: inherit; font: inherit; font-size: 13px; line-height: 20px; white-space: nowrap; cursor: pointer; }
button:hover, summary:hover, details[open] > summary { background: #eaf2fc; color: #1769d2; }
button:focus-visible, summary:focus-visible { outline: 2px solid #1769d2; outline-offset: 1px; }
svg { flex-shrink: 0; }
summary { list-style: none; }
summary::-webkit-details-marker { display: none; }
.aimd-input-tools__more { position: relative; }
.aimd-input-tools__menu { position: absolute; top: calc(100% + 4px); z-index: 80; display: flex; flex-direction: column; box-sizing: border-box; width: 190px; max-width: calc(100vw - 16px); padding: 4px; border: 1px solid #d0d7de; border-radius: 6px; background: white; color: #24292f; box-shadow: 0 4px 14px rgb(0 0 0 / 12%); }
.aimd-input-tools__menu button { justify-content: flex-start; }
@media (max-width: 480px) { button, summary { padding-inline: 7px; } }
</style>
