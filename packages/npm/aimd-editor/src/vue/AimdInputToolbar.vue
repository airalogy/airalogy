<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom'
import { CalendarDays, SquareCheck, ChevronDown, CircleDot, Clock, Hash, ListChecks, ListOrdered, Paperclip, Settings2, TextCursorInput, ToggleLeft } from '@lucide/vue'
import type { AimdEditorMessages } from './locales'

const props = defineProps<{ messages: AimdEditorMessages }>()
const emit = defineEmits<{ (e: 'insert', preset: string): void }>()
const trigger = ref<HTMLButtonElement>()
const menu = ref<HTMLElement>()
const open = ref(false)
const menuHost = ref<Element>()
let initialItem = 0
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

function showMore(last = false) {
  if (!trigger.value) return
  initialItem = last ? secondary.value.length - 1 : 0
  menuHost.value = trigger.value.closest('dialog[open], [popover], [role="dialog"]') ?? trigger.value.ownerDocument.body
  open.value = true
}
function closeMore(restoreFocus = false) {
  open.value = false
  if (restoreFocus) trigger.value?.focus({ preventScroll: true })
}
function insert(preset: string) {
  if (open.value) closeMore(true)
  emit('insert', preset)
}
function onMenuKey(event: KeyboardEvent) {
  if (event.key === 'Tab' || event.key === 'Escape') {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
    }
    // Tab continues from the toolbar in document order after the portal closes.
    closeMore(true)
    return
  }
  const items = Array.from(menu.value?.querySelectorAll('button') ?? [])
  const index = items.indexOf(event.target as HTMLButtonElement)
  let next: number
  switch (event.key) {
    case 'Home': next = 0; break
    case 'End': next = items.length - 1; break
    case 'ArrowDown': next = (index + 1) % items.length; break
    case 'ArrowUp': next = (index - 1 + items.length) % items.length; break
    default: return
  }
  event.preventDefault()
  items[next]?.focus()
}

watch(menu, (floating, _, onCleanup) => {
  const anchor = trigger.value
  if (!floating || !anchor) return
  const doc = anchor.ownerDocument
  const dismissOutside = (event: Event) => {
    if (event.target instanceof Node && !floating.contains(event.target) && !anchor.contains(event.target)) closeMore()
  }
  doc.addEventListener('pointerdown', dismissOutside, true)
  doc.addEventListener('focusin', dismissOutside)
  let active = true
  let positioned = false
  const stop = autoUpdate(anchor, floating, async () => {
    const { x, y } = await computePosition(anchor, floating, {
      strategy: 'fixed', placement: 'bottom-start',
      middleware: [
        offset(4), flip({ padding: 8 }), shift({ padding: 8 }),
        size({ padding: 8, apply({ availableHeight }) { floating.style.maxHeight = `${Math.max(0, availableHeight)}px` } }),
      ],
    })
    if (!active) return
    floating.style.left = `${x}px`
    floating.style.top = `${y}px`
    if (!positioned) {
      positioned = true
      floating.style.visibility = 'visible'
      floating.querySelectorAll('button')[initialItem]?.focus({ preventScroll: true })
    }
  })
  onCleanup(() => {
    active = false
    stop()
    doc.removeEventListener('pointerdown', dismissOutside, true)
    doc.removeEventListener('focusin', dismissOutside)
  })
}, { flush: 'post' })
</script>

<template>
  <div class="aimd-input-tools" role="group" :aria-label="messages.inputField.insert">
    <button v-for="item in common" :key="item.preset" type="button" :title="messages.inputField.insertType(item.label)" :aria-label="messages.inputField.insertType(item.label)" @mousedown.prevent @click="insert(item.preset)">
      <component :is="item.icon" :size="16" aria-hidden="true" />
      <span>{{ item.label }}</span>
    </button>
    <button ref="trigger" type="button" class="aimd-input-tools__more" aria-haspopup="menu" :aria-expanded="open"
      @mousedown.prevent @click="open ? closeMore(true) : showMore()" @keydown.down.prevent="showMore()" @keydown.up.prevent="showMore(true)">
      <ListChecks :size="16" aria-hidden="true" /><span>{{ messages.inputField.more }}</span><ChevronDown :size="14" aria-hidden="true" />
    </button>
    <Teleport v-if="open && menuHost" :to="menuHost">
      <div ref="menu" class="aimd-input-tools__menu" role="menu" :aria-label="messages.inputField.more" @keydown="onMenuKey">
        <button v-for="item in secondary" :key="item.preset" type="button" role="menuitem" tabindex="-1" :title="messages.inputField.insertType(item.label)" @mousedown.prevent @click="insert(item.preset)">
          <component :is="item.icon" :size="16" aria-hidden="true" /><span>{{ item.label }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.aimd-input-tools { display: flex; flex: 0 0 100%; flex-wrap: wrap; align-items: center; gap: 4px; min-width: 0; padding-top: 6px; border-top: 1px solid #e0e5eb; }
button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; box-sizing: border-box; padding: 5px 9px; border: 1px solid transparent; border-radius: 4px; background: transparent; color: inherit; font: inherit; font-size: 13px; line-height: 20px; white-space: nowrap; cursor: pointer; }
button:hover, .aimd-input-tools__more[aria-expanded="true"] { background: #eaf2fc; color: #1769d2; }
button:focus-visible { outline: 2px solid #1769d2; outline-offset: 1px; }
svg { flex-shrink: 0; }
.aimd-input-tools__menu { position: fixed; top: 0; left: 0; visibility: hidden; z-index: 1100; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; box-sizing: border-box; width: 190px; max-width: calc(100vw - 16px); padding: 4px; border: 1px solid #d0d7de; border-radius: 6px; background: white; color: #24292f; box-shadow: 0 4px 14px rgb(0 0 0 / 12%); }
.aimd-input-tools__menu button { flex: none; justify-content: flex-start; }
@media (max-width: 480px) { button { padding-inline: 7px; } }
</style>
