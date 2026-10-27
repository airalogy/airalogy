<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom'

const props = defineProps<{ label: string; hint: string; disabled?: boolean }>()
const emit = defineEmits<{ (e: 'click'): void }>()
const tooltipId = `import-hint-${useId()}`
const button = ref<HTMLButtonElement>()
const tooltip = ref<HTMLElement>()
const open = ref(false)
const positioned = ref(false)
const position = ref({ left: '0px', top: '0px' })
let closeTimer: ReturnType<typeof setTimeout> | undefined

function show() {
  clearTimeout(closeTimer)
  if (!props.disabled) open.value = true
}
function hide() { clearTimeout(closeTimer); open.value = false }
function leave() { closeTimer = setTimeout(hide, 150) }
function escape(event: KeyboardEvent) { if (event.key === 'Escape') hide() }

watch(open, async (visible, _, onCleanup) => {
  positioned.value = false
  if (!visible) return
  let disposed = false
  let cleanup: (() => void) | undefined
  window.addEventListener('keydown', escape)
  onCleanup(() => { disposed = true; cleanup?.(); window.removeEventListener('keydown', escape) })
  await nextTick()
  if (disposed || !button.value || !tooltip.value) return
  const reference = button.value
  const floating = tooltip.value
  cleanup = autoUpdate(reference, floating, async () => {
    const result = await computePosition(reference, floating, {
      strategy: 'fixed', placement: 'bottom-start',
      middleware: [offset(8), flip({ padding: 12 }), shift({ padding: 12 }), size({ padding: 12, apply({ availableHeight }) { floating.style.maxHeight = `${Math.max(0, availableHeight)}px` } })],
    })
    if (!disposed) { position.value = { left: `${result.x}px`, top: `${result.y}px` }; positioned.value = true }
  })
})
watch(() => props.disabled, disabled => { if (disabled) hide() })
onBeforeUnmount(() => clearTimeout(closeTimer))
</script>

<template>
  <button ref="button" type="button" class="workspace-import-button" :disabled="disabled" :aria-describedby="open ? tooltipId : undefined" @mouseenter="show" @mouseleave="leave" @focus="show" @blur="hide" @click="hide(); emit('click')">{{ label }}</button>
  <Teleport to="body">
    <div v-if="open" :id="tooltipId" ref="tooltip" role="tooltip" class="workspace-import-tooltip" :style="{ ...position, visibility: positioned ? 'visible' : 'hidden' }" @mouseenter="show" @mouseleave="leave" v-text="hint" />
  </Teleport>
</template>

<style scoped>
.workspace-import-button { height: 32px; padding: 0 14px; border: 1px solid #c8d2df; border-radius: 7px; background: #fff; color: #243447; font-size: 13px; font-weight: 650; cursor: pointer; white-space: nowrap; }
.workspace-import-button:hover { border-color: #8ea6c2; background: #f8fafc; }
.workspace-import-button:disabled { cursor: not-allowed; opacity: .65; }
.workspace-import-button:focus-visible { outline: 2px solid #1769d2; outline-offset: 2px; }
.workspace-import-tooltip { position: fixed; z-index: 1100; box-sizing: border-box; width: min(360px, calc(100vw - 24px)); padding: 10px 12px; overflow: auto; border: 1px solid #cbd7e6; border-radius: 8px; background: #fff; box-shadow: 0 6px 20px rgb(15 23 42 / 16%); color: #334155; font: 500 12px/1.55 system-ui, sans-serif; text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
