<script setup lang="ts">
import { createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import SeqViz, { type SeqVizProps } from "seqviz"
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"

export interface AimdSeqVizAnnotation {
  id: string
  name: string
  start: number
  end: number
  direction?: 1 | -1
  color?: string
}

export interface AimdSeqVizSelection {
  clockwise?: boolean
  color?: string
  direction?: number
  end?: number
  id?: string
  length?: number
  name?: string
  start?: number
  type: string
  viewer?: "LINEAR" | "CIRCULAR"
}

export interface AimdSeqVizExternalSelection {
  clockwise?: boolean
  end: number
  start: number
}

const props = withDefaults(defineProps<{
  name?: string
  sequence: string
  topology: "linear" | "circular"
  annotations: AimdSeqVizAnnotation[]
  selection?: AimdSeqVizExternalSelection | null
}>(), {
  name: "",
  selection: null,
})

const emit = defineEmits<{
  (e: "selection", value: AimdSeqVizSelection): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let root: Root | null = null

const viewerProps = computed<SeqVizProps>(() => ({
  name: props.name,
  seq: props.sequence,
  seqType: "dna",
  annotations: props.annotations as unknown as SeqVizProps["annotations"],
  primers: [],
  viewer: props.topology === "circular" ? "both" : "linear",
  selection: props.selection ?? undefined,
  disableExternalFonts: true,
  rotateOnScroll: props.topology === "circular",
  showComplement: true,
  showIndex: true,
  zoom: {
    linear: props.topology === "circular" ? 36 : 52,
  },
  style: {
    width: "100%",
    minHeight: props.topology === "circular" ? "420px" : "280px",
    height: props.topology === "circular" ? "420px" : "280px",
  },
  onSelection: selection => emit("selection", selection as unknown as AimdSeqVizSelection),
}))

function renderViewer() {
  if (!containerRef.value) {
    return
  }

  if (!root) {
    root = createRoot(containerRef.value)
  }

  root.render(createElement(SeqViz, viewerProps.value))
}

let renderDebounceTimer: ReturnType<typeof setTimeout> | null = null

watch(viewerProps, () => {
  if (renderDebounceTimer !== null) {
    clearTimeout(renderDebounceTimer)
  }
  renderDebounceTimer = setTimeout(() => {
    renderDebounceTimer = null
    renderViewer()
  }, 16)
}, { deep: true })

onMounted(() => {
  renderViewer()
})

onBeforeUnmount(() => {
  if (renderDebounceTimer !== null) {
    clearTimeout(renderDebounceTimer)
  }
  root?.unmount()
  root = null
})
</script>

<template>
  <div ref="containerRef" class="aimd-seqviz-viewer" />
</template>

<style scoped>
.aimd-seqviz-viewer {
  width: 100%;
  min-height: 280px;
}
</style>
