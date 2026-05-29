<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import type {
  AimdAssignerGraphData,
  AimdAssignerGraphLabels,
  AimdAssignerGraphNode,
  AimdAssignerGraphNodeType,
  AimdAssignerNodeSchemaInfo,
} from "../types"

defineOptions({ name: "AimdAssignerGraph" })

interface Props {
  assignerGraph?: AimdAssignerGraphData | null
  nodeSchemaMap?: Record<string, AimdAssignerNodeSchemaInfo | undefined>
  height?: string
  loading?: boolean
  showToolbar?: boolean
  showLegend?: boolean
  allowFullscreen?: boolean
  labels?: Partial<AimdAssignerGraphLabels>
}

const props = withDefaults(defineProps<Props>(), {
  assignerGraph: null,
  nodeSchemaMap: () => ({}),
  height: "600px",
  loading: false,
  showToolbar: true,
  showLegend: true,
  allowFullscreen: true,
  labels: () => ({}),
})

const emit = defineEmits<{
  (e: "nodeClick", nodeName: string, nodeType: AimdAssignerGraphNodeType, event: MouseEvent): void
}>()

const DEFAULT_LABELS: AimdAssignerGraphLabels = {
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fitView: "Fit view",
  fullscreen: "Fullscreen",
  close: "Close",
  showTitle: "Show title",
  showName: "Show name",
  dependentField: "Dependent field",
  assigner: "Assigner",
  assignedField: "Assigned field",
  empty: "No assigner graph available",
  loading: "Loading assigner graph",
  fullscreenTitle: "Assigner topology",
}

const NODE_HEIGHT = 48
const COLUMN_GAP = 260
const ROW_GAP = 86
const GRAPH_MARGIN = 36
const MIN_NODE_WIDTH = 132
const MAX_NODE_WIDTH = 232
const MAX_LABEL_CHARS = 28

interface LayoutNode {
  name: string
  type: AimdAssignerGraphNodeType
  label: string
  fullLabel: string
  schemaInfo?: AimdAssignerNodeSchemaInfo
  x: number
  y: number
  width: number
  height: number
  highlighted: boolean
  dimmed: boolean
}

interface LayoutEdge {
  from: string
  to: string
  path: string
  highlighted: boolean
  dimmed: boolean
}

interface LayoutGraph {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  width: number
  height: number
}

const canvasRef = ref<HTMLElement | null>(null)
const selectedNodeName = ref<string | null>(null)
const zoom = ref(1)
const showTitle = ref(false)
const fullscreen = ref(false)
const graphInstanceId = `aimd-assigner-graph-${getCurrentInstance()?.uid ?? "0"}`
const markerId = `${graphInstanceId}-arrow`
const highlightedMarkerId = `${graphInstanceId}-arrow-highlighted`
let resizeObserver: ResizeObserver | null = null

const resolvedLabels = computed<AimdAssignerGraphLabels>(() => ({
  ...DEFAULT_LABELS,
  ...props.labels,
}))

const normalizedNodes = computed<AimdAssignerGraphNode[]>(() => {
  const graph = props.assignerGraph
  if (!graph) return []

  const nodesByName = new Map<string, AimdAssignerGraphNode>()
  for (const node of graph.nodes) {
    if (!node?.name) continue
    nodesByName.set(node.name, node)
  }
  for (const [from, to] of graph.edges) {
    if (from && !nodesByName.has(from)) {
      nodesByName.set(from, { name: from, type: "dependent_field" })
    }
    if (to && !nodesByName.has(to)) {
      nodesByName.set(to, { name: to, type: "assigned_field" })
    }
  }
  return [...nodesByName.values()]
})

const adjacencyMap = computed(() => {
  const map = new Map<string, { inputs: string[], outputs: string[] }>()
  for (const node of normalizedNodes.value) {
    map.set(node.name, { inputs: [], outputs: [] })
  }
  for (const [from, to] of props.assignerGraph?.edges ?? []) {
    map.get(from)?.outputs.push(to)
    map.get(to)?.inputs.push(from)
  }
  return map
})

const highlightedNames = computed(() => {
  if (!selectedNodeName.value) return new Set<string>()

  const selected = selectedNodeName.value
  const selectedNode = normalizedNodes.value.find(node => node.name === selected)
  const highlighted = new Set<string>()
  if (!selectedNode) return highlighted

  if (selectedNode.type === "assigner") {
    highlighted.add(selected)
    const adjacent = adjacencyMap.value.get(selected)
    adjacent?.inputs.forEach(name => highlighted.add(name))
    adjacent?.outputs.forEach(name => highlighted.add(name))
    return highlighted
  }

  collectUpstream(selected, highlighted)
  collectDownstream(selected, highlighted)
  return highlighted
})

const layoutGraph = computed<LayoutGraph>(() => {
  const nodes = normalizedNodes.value
  if (!nodes.length) {
    return { nodes: [], edges: [], width: 480, height: 320 }
  }

  const ranks = computeNodeRanks(nodes, props.assignerGraph?.edges ?? [])
  const buckets = new Map<number, AimdAssignerGraphNode[]>()
  for (const node of nodes) {
    const rank = ranks.get(node.name) ?? 0
    const bucket = buckets.get(rank) ?? []
    bucket.push(node)
    buckets.set(rank, bucket)
  }

  const layoutNodes: LayoutNode[] = []
  let maxRank = 0
  let maxRows = 1
  for (const [rank, bucket] of buckets) {
    maxRank = Math.max(maxRank, rank)
    maxRows = Math.max(maxRows, bucket.length)
    const sortedBucket = [...bucket].sort(compareGraphNodes)
    sortedBucket.forEach((node, rowIndex) => {
      const schemaInfo = props.nodeSchemaMap[node.name]
      const fullLabel = getNodeDisplayLabel(node, schemaInfo)
      const label = truncateLabel(fullLabel)
      const width = getNodeWidth(label)
      const hasSelection = selectedNodeName.value !== null
      const highlighted = hasSelection && highlightedNames.value.has(node.name)
      layoutNodes.push({
        name: node.name,
        type: node.type,
        label,
        fullLabel,
        schemaInfo,
        x: GRAPH_MARGIN + rank * COLUMN_GAP,
        y: GRAPH_MARGIN + rowIndex * ROW_GAP,
        width,
        height: NODE_HEIGHT,
        highlighted,
        dimmed: hasSelection && !highlighted,
      })
    })
  }

  const nodeByName = new Map(layoutNodes.map(node => [node.name, node]))
  const layoutEdges = (props.assignerGraph?.edges ?? [])
    .map(([from, to]) => {
      const fromNode = nodeByName.get(from)
      const toNode = nodeByName.get(to)
      if (!fromNode || !toNode) return null
      const hasSelection = selectedNodeName.value !== null
      const highlighted = hasSelection && highlightedNames.value.has(from) && highlightedNames.value.has(to)
      return {
        from,
        to,
        path: createEdgePath(fromNode, toNode),
        highlighted,
        dimmed: hasSelection && !highlighted,
      } satisfies LayoutEdge
    })
    .filter((edge): edge is LayoutEdge => edge !== null)

  return {
    nodes: layoutNodes,
    edges: layoutEdges,
    width: GRAPH_MARGIN * 2 + maxRank * COLUMN_GAP + MAX_NODE_WIDTH,
    height: GRAPH_MARGIN * 2 + (maxRows - 1) * ROW_GAP + NODE_HEIGHT,
  }
})

const zoomPercent = computed(() => `${Math.round(zoom.value * 100)}%`)
const graphStyle = computed(() => ({
  "--aimd-assigner-graph-height": fullscreen.value ? "100vh" : props.height,
}))
const svgWidth = computed(() => Math.max(layoutGraph.value.width * zoom.value, 1))
const svgHeight = computed(() => Math.max(layoutGraph.value.height * zoom.value, 1))

function nodeTypeRank(type: AimdAssignerGraphNodeType): number {
  if (type === "dependent_field") return 0
  if (type === "assigner") return 1
  return 2
}

function compareGraphNodes(a: AimdAssignerGraphNode, b: AimdAssignerGraphNode): number {
  const typeDiff = nodeTypeRank(a.type) - nodeTypeRank(b.type)
  if (typeDiff !== 0) return typeDiff
  return a.name.localeCompare(b.name)
}

function computeNodeRanks(
  nodes: AimdAssignerGraphNode[],
  edges: Array<[string, string]>,
): Map<string, number> {
  const nodeNames = new Set(nodes.map(node => node.name))
  const outgoing = new Map<string, string[]>()
  const incomingCount = new Map<string, number>()
  const ranks = new Map<string, number>()

  for (const node of nodes) {
    outgoing.set(node.name, [])
    incomingCount.set(node.name, 0)
    ranks.set(node.name, 0)
  }

  for (const [from, to] of edges) {
    if (!nodeNames.has(from) || !nodeNames.has(to)) continue
    outgoing.get(from)?.push(to)
    incomingCount.set(to, (incomingCount.get(to) ?? 0) + 1)
  }

  const queue = nodes
    .filter(node => (incomingCount.get(node.name) ?? 0) === 0)
    .sort(compareGraphNodes)
    .map(node => node.name)
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    const nextRank = (ranks.get(current) ?? 0) + 1
    for (const next of outgoing.get(current) ?? []) {
      ranks.set(next, Math.max(ranks.get(next) ?? 0, nextRank))
      incomingCount.set(next, Math.max(0, (incomingCount.get(next) ?? 0) - 1))
      if ((incomingCount.get(next) ?? 0) === 0) {
        queue.push(next)
      }
    }
  }

  return ranks
}

function getNodeDisplayLabel(node: AimdAssignerGraphNode, schemaInfo?: AimdAssignerNodeSchemaInfo): string {
  if (showTitle.value && schemaInfo?.title) {
    return schemaInfo.title
  }
  return node.name
}

function truncateLabel(label: string): string {
  if (label.length <= MAX_LABEL_CHARS) return label
  return `${label.slice(0, MAX_LABEL_CHARS - 1)}...`
}

function getNodeWidth(label: string): number {
  const estimated = label.length * 8.5 + 36
  return Math.max(MIN_NODE_WIDTH, Math.min(MAX_NODE_WIDTH, estimated))
}

function createEdgePath(fromNode: LayoutNode, toNode: LayoutNode): string {
  const sourceX = fromNode.x + fromNode.width
  const sourceY = fromNode.y + fromNode.height / 2
  const targetX = toNode.x
  const targetY = toNode.y + toNode.height / 2
  const offset = Math.max(54, Math.min(110, Math.abs(targetX - sourceX) / 2))
  return `M ${sourceX} ${sourceY} C ${sourceX + offset} ${sourceY}, ${targetX - offset} ${targetY}, ${targetX} ${targetY}`
}

function collectUpstream(name: string, visited: Set<string>) {
  if (visited.has(name)) return
  visited.add(name)
  for (const input of adjacencyMap.value.get(name)?.inputs ?? []) {
    collectUpstream(input, visited)
  }
}

function collectDownstream(name: string, visited: Set<string>) {
  if (visited.has(name)) return
  visited.add(name)
  for (const output of adjacencyMap.value.get(name)?.outputs ?? []) {
    collectDownstream(output, visited)
  }
}

function getNodeTooltip(node: LayoutNode): string {
  const details = [node.fullLabel]
  if (node.schemaInfo?.type) details.push(node.schemaInfo.type)
  if (node.schemaInfo?.format) details.push(node.schemaInfo.format)
  if (node.schemaInfo?.description) details.push(node.schemaInfo.description)
  return details.join("\n")
}

function onNodeClick(node: LayoutNode, event: MouseEvent) {
  selectedNodeName.value = selectedNodeName.value === node.name ? null : node.name
  emit("nodeClick", node.name, node.type, event)
}

function onNodeKeyboard(node: LayoutNode, event: KeyboardEvent) {
  selectedNodeName.value = selectedNodeName.value === node.name ? null : node.name
  emit("nodeClick", node.name, node.type, event as unknown as MouseEvent)
}

function clearSelection() {
  selectedNodeName.value = null
}

function clampZoom(value: number): number {
  return Math.max(0.25, Math.min(2.5, value))
}

function zoomIn() {
  zoom.value = clampZoom(zoom.value * 1.18)
}

function zoomOut() {
  zoom.value = clampZoom(zoom.value / 1.18)
}

function fitView() {
  const viewport = canvasRef.value
  if (!viewport) {
    zoom.value = 1
    return
  }
  const widthRatio = (viewport.clientWidth - 24) / layoutGraph.value.width
  const heightRatio = (viewport.clientHeight - 24) / layoutGraph.value.height
  zoom.value = clampZoom(Math.min(1, widthRatio, heightRatio) || 1)
  viewport.scrollTo({ left: 0, top: 0 })
}

function toggleDisplayMode() {
  showTitle.value = !showTitle.value
}

function toggleFullscreen() {
  fullscreen.value = !fullscreen.value
  nextTick(() => fitView())
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && fullscreen.value) {
    fullscreen.value = false
  }
}

watch(() => props.assignerGraph, () => {
  selectedNodeName.value = null
  nextTick(() => fitView())
})

watch(showTitle, () => {
  nextTick(() => fitView())
})

onMounted(() => {
  nextTick(() => fitView())
  window.addEventListener("keydown", onKeydown)
  if (typeof ResizeObserver !== "undefined" && canvasRef.value) {
    resizeObserver = new ResizeObserver(() => fitView())
    resizeObserver.observe(canvasRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown)
  resizeObserver?.disconnect()
})

defineExpose({
  zoomIn,
  zoomOut,
  fitView,
  toggleDisplayMode,
  showTitle,
  fullscreen,
})
</script>

<template>
  <div
    class="aimd-assigner-graph"
    :class="{ 'aimd-assigner-graph--fullscreen': fullscreen }"
    :style="graphStyle"
  >
    <div v-if="showToolbar" class="aimd-assigner-graph__toolbar">
      <div class="aimd-assigner-graph__toolbar-group">
        <button type="button" class="aimd-assigner-graph__icon-btn" :title="resolvedLabels.zoomIn" :aria-label="resolvedLabels.zoomIn" @click="zoomIn">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5v12M5 11h12" /><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5 21 21" /></svg>
        </button>
        <button type="button" class="aimd-assigner-graph__icon-btn" :title="resolvedLabels.fitView" :aria-label="resolvedLabels.fitView" @click="fitView">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
        </button>
        <button type="button" class="aimd-assigner-graph__icon-btn" :title="resolvedLabels.zoomOut" :aria-label="resolvedLabels.zoomOut" @click="zoomOut">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h12" /><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5 21 21" /></svg>
        </button>
        <span class="aimd-assigner-graph__zoom">{{ zoomPercent }}</span>
      </div>

      <button type="button" class="aimd-assigner-graph__mode-btn" @click="toggleDisplayMode">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h16" /></svg>
        {{ showTitle ? resolvedLabels.showName : resolvedLabels.showTitle }}
      </button>

      <button
        v-if="allowFullscreen"
        type="button"
        class="aimd-assigner-graph__mode-btn aimd-assigner-graph__fullscreen-btn"
        @click="toggleFullscreen"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></svg>
        {{ fullscreen ? resolvedLabels.close : resolvedLabels.fullscreen }}
      </button>
    </div>

    <div v-if="showLegend" class="aimd-assigner-graph__legend">
      <span class="aimd-assigner-graph__legend-item">
        <span class="aimd-assigner-graph__legend-swatch aimd-assigner-graph__legend-swatch--dependent-field" />
        {{ resolvedLabels.dependentField }}
      </span>
      <span class="aimd-assigner-graph__legend-item">
        <span class="aimd-assigner-graph__legend-swatch aimd-assigner-graph__legend-swatch--assigner" />
        {{ resolvedLabels.assigner }}
      </span>
      <span class="aimd-assigner-graph__legend-item">
        <span class="aimd-assigner-graph__legend-swatch aimd-assigner-graph__legend-swatch--assigned-field" />
        {{ resolvedLabels.assignedField }}
      </span>
    </div>

    <div ref="canvasRef" class="aimd-assigner-graph__canvas" @click.self="clearSelection">
      <div v-if="loading" class="aimd-assigner-graph__state">
        <span class="aimd-assigner-graph__spinner" aria-hidden="true" />
        {{ resolvedLabels.loading }}
      </div>
      <div v-else-if="layoutGraph.nodes.length === 0" class="aimd-assigner-graph__state">
        {{ resolvedLabels.empty }}
      </div>
      <svg
        v-else
        class="aimd-assigner-graph__svg"
        :width="svgWidth"
        :height="svgHeight"
        :viewBox="`0 0 ${layoutGraph.width} ${layoutGraph.height}`"
        role="img"
        :aria-label="resolvedLabels.fullscreenTitle"
      >
        <defs>
          <marker :id="markerId" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" class="aimd-assigner-graph__marker" />
          </marker>
          <marker :id="highlightedMarkerId" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" class="aimd-assigner-graph__marker aimd-assigner-graph__marker--highlighted" />
          </marker>
        </defs>

        <g class="aimd-assigner-graph__edges">
          <path
            v-for="edge in layoutGraph.edges"
            :key="`${edge.from}->${edge.to}`"
            class="aimd-assigner-graph__edge"
            :class="{
              'aimd-assigner-graph__edge--highlighted': edge.highlighted,
              'aimd-assigner-graph__edge--dimmed': edge.dimmed,
            }"
            :d="edge.path"
            fill="none"
            :marker-end="`url(#${edge.highlighted ? highlightedMarkerId : markerId})`"
          />
        </g>

        <g class="aimd-assigner-graph__nodes">
          <g
            v-for="node in layoutGraph.nodes"
            :key="node.name"
            class="aimd-assigner-graph__node"
            :class="[
              `aimd-assigner-graph__node--${node.type.replace('_', '-')}`,
              {
                'aimd-assigner-graph__node--highlighted': node.highlighted,
                'aimd-assigner-graph__node--dimmed': node.dimmed,
              },
            ]"
            :transform="`translate(${node.x} ${node.y})`"
            tabindex="0"
            role="button"
            :aria-label="node.fullLabel"
            @click.stop="onNodeClick(node, $event)"
            @keydown.enter.prevent="onNodeKeyboard(node, $event)"
            @keydown.space.prevent="onNodeKeyboard(node, $event)"
          >
            <title>{{ getNodeTooltip(node) }}</title>
            <rect
              class="aimd-assigner-graph__node-shape"
              :width="node.width"
              :height="node.height"
              :rx="node.type === 'assigner' ? node.height / 2 : 8"
            />
            <text
              class="aimd-assigner-graph__node-label"
              :x="node.width / 2"
              :y="node.height / 2"
              dominant-baseline="middle"
              text-anchor="middle"
            >
              {{ node.label }}
            </text>
          </g>
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.aimd-assigner-graph {
  display: flex;
  flex-direction: column;
  min-height: 360px;
  height: var(--aimd-assigner-graph-height);
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #ffffff;
  color: #1f2937;
  overflow: hidden;
}

.aimd-assigner-graph--fullscreen {
  position: fixed;
  inset: 12px;
  z-index: 1000;
  height: auto;
  box-shadow: 0 24px 72px rgba(15, 23, 42, 0.22);
}

.aimd-assigner-graph__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.aimd-assigner-graph__toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.aimd-assigner-graph__icon-btn,
.aimd-assigner-graph__mode-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 30px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  color: #334155;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  line-height: 1;
}

.aimd-assigner-graph__icon-btn {
  width: 30px;
  padding: 0;
}

.aimd-assigner-graph__mode-btn {
  padding: 0 10px;
}

.aimd-assigner-graph__fullscreen-btn {
  margin-left: auto;
}

.aimd-assigner-graph__icon-btn:hover,
.aimd-assigner-graph__mode-btn:hover {
  border-color: #94a3b8;
  background: #f1f5f9;
}

.aimd-assigner-graph__icon-btn svg,
.aimd-assigner-graph__mode-btn svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.aimd-assigner-graph__zoom {
  min-width: 42px;
  color: #64748b;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.aimd-assigner-graph__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
  color: #64748b;
  font-size: 13px;
}

.aimd-assigner-graph__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.aimd-assigner-graph__legend-swatch {
  width: 28px;
  height: 17px;
  border: 1.5px solid currentColor;
  border-radius: 5px;
}

.aimd-assigner-graph__legend-swatch--dependent-field {
  background: #eff6ff;
  color: #60a5fa;
}

.aimd-assigner-graph__legend-swatch--assigner {
  border-radius: 999px;
  background: #fdf2f8;
  color: #ec4899;
}

.aimd-assigner-graph__legend-swatch--assigned-field {
  background: #f0fdf4;
  color: #22c55e;
}

.aimd-assigner-graph__canvas {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #f8fafc;
}

.aimd-assigner-graph__state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #64748b;
  font-size: 14px;
}

.aimd-assigner-graph__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(37, 99, 235, 0.2);
  border-top-color: #2563eb;
  border-radius: 999px;
  animation: aimd-assigner-graph-spin 0.8s linear infinite;
}

.aimd-assigner-graph__svg {
  display: block;
}

.aimd-assigner-graph__edge {
  stroke: #94a3b8;
  stroke-width: 1.4;
  opacity: 1;
  transition: opacity 0.16s ease, stroke 0.16s ease, stroke-width 0.16s ease;
}

.aimd-assigner-graph__edge--highlighted {
  stroke: #f59e0b;
  stroke-width: 2.2;
}

.aimd-assigner-graph__edge--dimmed {
  opacity: 0.16;
}

.aimd-assigner-graph__marker {
  fill: #94a3b8;
}

.aimd-assigner-graph__marker--highlighted {
  fill: #f59e0b;
}

.aimd-assigner-graph__node {
  cursor: pointer;
  outline: none;
  transition: opacity 0.16s ease;
}

.aimd-assigner-graph__node--dimmed {
  opacity: 0.32;
}

.aimd-assigner-graph__node-shape {
  fill: #ffffff;
  stroke: #94a3b8;
  stroke-width: 1.8;
  filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.08));
  transition: fill 0.16s ease, stroke 0.16s ease, stroke-width 0.16s ease;
}

.aimd-assigner-graph__node--dependent-field .aimd-assigner-graph__node-shape {
  fill: #eff6ff;
  stroke: #60a5fa;
}

.aimd-assigner-graph__node--assigner .aimd-assigner-graph__node-shape {
  fill: #fdf2f8;
  stroke: #ec4899;
}

.aimd-assigner-graph__node--assigned-field .aimd-assigner-graph__node-shape {
  fill: #f0fdf4;
  stroke: #22c55e;
}

.aimd-assigner-graph__node--highlighted .aimd-assigner-graph__node-shape,
.aimd-assigner-graph__node:focus-visible .aimd-assigner-graph__node-shape {
  stroke: #f59e0b;
  stroke-width: 2.4;
}

.aimd-assigner-graph__node-label {
  fill: #334155;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;
}

.aimd-assigner-graph__node--dependent-field .aimd-assigner-graph__node-label {
  fill: #1d4ed8;
}

.aimd-assigner-graph__node--assigner .aimd-assigner-graph__node-label {
  fill: #be185d;
}

.aimd-assigner-graph__node--assigned-field .aimd-assigner-graph__node-label {
  fill: #15803d;
}

@keyframes aimd-assigner-graph-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
