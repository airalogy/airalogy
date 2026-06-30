<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  parseWorkflowContent,
  type AimdWorkflowAssignerField,
  type AimdWorkflowField,
  type AimdWorkflowTransitionField,
} from '@airalogy/aimd-core'
import {
  AimdAssignerGraph,
  AimdRecorderEditor,
  applyAimdAssignedFieldsToRecord,
  buildAimdAssignerDependentData,
  cloneRecordData,
  createEmptyProtocolRecordData,
  extractAimdAssignedFields,
  getAimdAssignerFieldKey,
  type AimdAssignerGraphData,
  type AimdAssignerGraphLabels,
  type AimdAssignerGraphNodeType,
  type AimdAssignerNodeSchemaInfo,
  type AimdFieldState,
  type AimdFileUploadContext,
  type AimdResolvedFileInfo,
  type AimdAssignerMap,
  type AimdAssignerRunnerRequest,
  type AimdProtocolRecordData,
} from '@airalogy/aimd-recorder'
import {
  normalizeDemoLocale,
  useDemoLocale,
  useDemoMessages,
} from './composables/demoI18n'
import ProtocolSourceBrowser from './components/ProtocolSourceBrowser.vue'
import airalogyLogoMarkUrl from './assets/airalogy-logo-mark.svg'
import '@airalogy/aimd-recorder/styles'

type LocaleMap<T> = Record<string, T | undefined>
type EngineAction = 'parse' | 'assign' | 'validate' | 'workflow'
type WorkflowTransitionEvent = {
  id: string
  from: string[]
  to: string[]
  run?: string
  reason?: string
}
type WorkflowAttemptEvent = {
  transition: string
  assigner: string
  runtime: string
  status: string
  outputs?: Record<string, unknown>
  message?: string
}
type WorkflowMetricRow = {
  label: string
  value: string | number
  detail?: string
}
type WorkflowAssignmentPreview = {
  target: string
  path: string
  value: unknown
}
type WorkflowTransitionView = {
  transition: AimdWorkflowTransitionField
  fromLabel: string
  toLabel: string
  runLabel: string
  conditionLabel: string
  inputCount: number
  assignCount: number
  targetCount: number
  assignmentPreview: WorkflowAssignmentPreview[]
  state: 'executed' | 'skipped' | 'idle'
  stateLabel: string
}
type WorkflowRecordValueRow = {
  key: string
  node: string
  path: string
  value: unknown
  changed: boolean
}
type WorkflowPathStepEvent = {
  step: string
  path_index: number
  mode: string
  data: Record<string, unknown>
}
type WorkflowPathStepView = {
  key: string
  pathIndex: number
  title: string
  detail: string
  mode: string
  valueSummary: string
}
type WorkflowNodeSourceView = {
  id: string
  title: string
  protocolPath: string
  source: SourceFile | null
  status: 'ready' | 'missing'
}
type EngineStatusState =
  | { type: 'idle' }
  | { type: 'running' | 'complete', action: EngineAction }
  | { type: 'selectAssignerTarget' }
  | { type: 'message', message: string }

interface SourceFile {
  path: string
  relativePath: string
  content: string
  language: string
}

interface SourceDraftFile {
  relativePath: string
  content: string
}

interface ProtocolVariant {
  locale: string
  protocolDir: string
  protocolDirPath: string | null
  aimdPath?: string
  aimd: string | null
  tomlPath?: string
  toml: string | null
  assignerPath?: string
  assigner: string | null
  sourceFiles: Array<{
    path: string
    content: string | null
  }>
  sampleData: Array<{
    path: string
    content: string | null
  }>
  workflowRecordsPath?: string
  workflowRecords: string | null
}

interface ProtocolExample {
  id: string
  category: string
  source_kind?: string
  languages: string[]
  title: LocaleMap<string>
  description: LocaleMap<string>
  engine_required: boolean
  tags: string[]
  variants: Record<string, ProtocolVariant>
}

interface ProtocolRegistry {
  protocol_root: string
  source_roots?: Record<string, string>
  examples: ProtocolExample[]
}

interface HealthPayload {
  ok: boolean
  engine: {
    available: boolean
    message?: string
  }
  rootfs: {
    path: string
    exists: boolean
  }
  image: string
  mode: string
}

interface ApiEnvelope<T> {
  ok: boolean
  message?: string
  result?: T
}

const registry = ref<ProtocolRegistry | null>(null)
const health = ref<HealthPayload | null>(null)
const { locale: uiLocale } = useDemoLocale()
const messages = useDemoMessages()
const selectedProtocolId = ref('')
const selectedLocale = ref('')
const activeTab = ref<'record' | 'source' | 'graph' | 'engine'>('record')
const selectedSourcePath = ref('')
const sourceDrafts = ref<Record<string, string>>({})
const sourceContent = ref('')
const recordData = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
const recorderKey = ref(0)
const loading = ref(true)
const loadError = ref('')
const engineBusy = ref(false)
const engineStatusState = ref<EngineStatusState>({ type: 'idle' })
const lastEngineResult = ref<unknown>(null)
const parseResult = ref<Record<string, unknown> | null>(null)
const assignerTarget = ref('')
const envVarsJson = ref('{\n}')
const sandboxMode = ref('auto')
const sandboxTimeout = ref(60)
const sandboxRootfsPath = ref('')
const sandboxImage = ref('')
const fieldRuntimeState = ref<Record<string, AimdFieldState>>({})
const workflowRecordsJson = ref('{\n}')
const workflowTransitionIdsJson = ref('[]')
const workflowMaxPasses = ref(1)
const workflowAssignerRuntime = ref<'sandbox' | 'local'>('sandbox')
const selectedWorkflowNodeId = ref('')
const workflowNodeRecordData = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
const workflowNodeRecorderKey = ref(0)
const workflowNodeFieldRuntimeState = ref<Record<string, AimdFieldState>>({})
const workflowLastRunInputRecords = ref<Record<string, unknown> | null>(null)
let applyingWorkflowNodeRecord = false
let applyingWorkflowRecordsText = false

const protocols = computed(() => registry.value?.examples ?? [])

const selectedProtocol = computed(() => (
  protocols.value.find((protocol) => protocol.id === selectedProtocolId.value)
  ?? protocols.value[0]
  ?? null
))

const selectedVariant = computed(() => {
  const protocol = selectedProtocol.value
  if (!protocol) {
    return null
  }

  return protocol.variants[selectedLocale.value]
    ?? protocol.variants[protocol.languages[0]]
    ?? null
})

const protocolTitle = computed(() => {
  const protocol = selectedProtocol.value
  if (!protocol) return messages.value.app.title
  return protocol.title[selectedLocale.value] ?? protocol.title['en-US'] ?? protocol.id
})

const protocolDescription = computed(() => {
  const protocol = selectedProtocol.value
  if (!protocol) return ''
  return protocol.description[selectedLocale.value] ?? protocol.description['en-US'] ?? ''
})

const runtimeLabel = computed(() => runtimeKindLabel(selectedProtocol.value?.engine_required))

const isWorkflowExample = computed(() => (
  selectedProtocol.value?.source_kind === 'workflow'
  || selectedProtocol.value?.category === 'workflow'
))

const workflowParseState = computed<{ workflow: AimdWorkflowField | null, error: string }>(() => {
  if (!isWorkflowExample.value) return { workflow: null, error: '' }
  const workflowBlock = extractWorkflowBlock(sourceContent.value)
  if (!workflowBlock) {
    return { workflow: null, error: messages.value.workflow.emptyDefinition }
  }

  try {
    return { workflow: parseWorkflowContent(workflowBlock), error: '' }
  } catch (err) {
    return {
      workflow: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }
})

const workflowDefinition = computed(() => workflowParseState.value.workflow)
const workflowParseError = computed(() => workflowParseState.value.error)

const workflowAssigners = computed<AimdWorkflowAssignerField[]>(() => (
  workflowDefinition.value?.assigners ?? []
))

const workflowTransitions = computed<AimdWorkflowTransitionField[]>(() => (
  workflowDefinition.value?.transitions ?? []
))

const workflowNodeSourceViews = computed<WorkflowNodeSourceView[]>(() => (
  (workflowDefinition.value?.nodes ?? []).map((node) => {
    const protocolPath = workflowNodeProtocolPath(node)
    const source = protocolPath
      ? sourceFiles.value.find((file) => file.path === protocolPath) ?? null
      : null

    return {
      id: node.id,
      title: node.title ?? node.description ?? node.id,
      protocolPath,
      source,
      status: source ? 'ready' : 'missing',
    }
  })
))

const selectedWorkflowNodeView = computed(() => (
  workflowNodeSourceViews.value.find((node) => node.id === selectedWorkflowNodeId.value)
  ?? workflowNodeSourceViews.value[0]
  ?? null
))

const selectedWorkflowNodeSource = computed(() => selectedWorkflowNodeView.value?.source ?? null)

const selectedWorkflowNodeContent = computed({
  get: () => selectedWorkflowNodeSource.value?.content ?? '',
  set: (content: string) => {
    const source = selectedWorkflowNodeSource.value
    if (!source || content === source.content) return
    updateSourceDraft(source.path, content)
    resetEngineExecutionState()
  },
})

const workflowAssignerSummary = computed(() => {
  const assigners = workflowAssigners.value
  if (assigners.length === 0) return messages.value.common.none
  return `${assigners.length}: ${assigners.map((assigner) => assigner.id).join(', ')}`
})

const workflowRecordsSummary = computed(() => {
  const variant = selectedVariant.value
  if (!isWorkflowExample.value || !variant) {
    return `${variant?.sampleData.length ?? 0}`
  }

  return variant.workflowRecordsPath
    ? relativeProtocolPath(variant.workflowRecordsPath, variant.protocolDir)
    : messages.value.common.none
})

const metadataAssignerLabel = computed(() => (
  isWorkflowExample.value ? messages.value.workflow.metadata.assigners : messages.value.common.assigner
))

const metadataAssignerValue = computed(() => (
  isWorkflowExample.value
    ? workflowAssignerSummary.value
    : selectedVariant.value?.assignerPath ?? messages.value.common.none
))

const metadataSampleLabel = computed(() => (
  isWorkflowExample.value ? messages.value.workflow.metadata.records : messages.value.common.sampleFiles
))

const metadataSampleValue = computed(() => (
  isWorkflowExample.value ? workflowRecordsSummary.value : `${selectedVariant.value?.sampleData.length ?? 0}`
))

const engineAvailable = computed(() => health.value?.engine.available === true)

const engineSummary = computed(() => {
  const text = messages.value.runtime
  if (!health.value) return text.checking
  if (!health.value.engine.available) return text.unavailable
  if (health.value.mode === 'unconfigured') return text.sandboxNotConfigured
  return `${health.value.mode}${health.value.rootfs.exists ? ` / ${text.localRootfs}` : ` / ${text.image}`}`
})

const sourceRootLabel = computed(() => {
  const variant = selectedVariant.value
  return variant?.protocolDir ? `${variant.protocolDir}/` : 'protocol/'
})

const sourceFiles = computed<SourceFile[]>(() => {
  const variant = selectedVariant.value
  if (!variant) return []

  const files: SourceFile[] = []
  appendSourceFile(files, variant.aimdPath, variant.aimd, variant.protocolDir)
  appendSourceFile(files, variant.tomlPath, variant.toml, variant.protocolDir)
  appendSourceFile(files, variant.assignerPath, variant.assigner, variant.protocolDir)

  for (const file of variant.sourceFiles) {
    appendSourceFile(files, file.path, file.content, variant.protocolDir)
  }
  for (const sample of variant.sampleData) {
    appendSourceFile(files, sample.path, sample.content, variant.protocolDir)
  }

  return files
})

const hasSourceDraftChanges = computed(() => (
  sourceFiles.value.some((file) => Object.prototype.hasOwnProperty.call(sourceDrafts.value, file.path))
))

const recordSourceContent = computed({
  get: () => sourceContent.value,
  set: (content: string) => {
    handleRecordSourceContentChange(content)
  },
})

const draftSourceFiles = computed<SourceDraftFile[] | undefined>(() => {
  if (!hasSourceDraftChanges.value) return undefined
  return sourceFiles.value.map((file) => ({
    relativePath: file.relativePath,
    content: file.content,
  }))
})

const protocolAssigners = computed<AimdAssignerMap>(() => {
  const data = parseResult.value?.data
  if (!data || typeof data !== 'object') return {}
  const assigners = (data as Record<string, unknown>).assigners
  if (!assigners || typeof assigners !== 'object' || Array.isArray(assigners)) return {}
  return assigners as AimdAssignerMap
})

const protocolAssignerGraph = computed<AimdAssignerGraphData | null>(() => {
  const data = parseResult.value?.data
  if (!data || typeof data !== 'object') return null
  const graph = (data as Record<string, unknown>).assigner_graph
  if (!isObjectRecord(graph)) return null

  const rawNodes = Array.isArray(graph.nodes) ? graph.nodes : []
  const rawEdges = Array.isArray(graph.edges) ? graph.edges : []
  const nodes = rawNodes
    .map(normalizeAssignerGraphNode)
    .filter((node): node is AimdAssignerGraphData['nodes'][number] => node !== null)
  const edges = rawEdges
    .map(normalizeAssignerGraphEdge)
    .filter((edge): edge is AimdAssignerGraphData['edges'][number] => edge !== null)

  return nodes.length > 0 ? { nodes, edges } : null
})

const assignerGraphNodeSchemaMap = computed<Record<string, AimdAssignerNodeSchemaInfo>>(() => {
  const data = parseResult.value?.data
  if (!data || typeof data !== 'object') return {}
  const jsonSchema = (data as Record<string, unknown>).json_schema
  if (!isObjectRecord(jsonSchema)) return {}

  const map: Record<string, AimdAssignerNodeSchemaInfo> = {}
  for (const schema of Object.values(jsonSchema)) {
    if (!isObjectRecord(schema) || !isObjectRecord(schema.properties)) {
      continue
    }
    for (const [name, property] of Object.entries(schema.properties)) {
      if (!isObjectRecord(property)) continue
      map[name] = {
        title: typeof property.title === 'string' ? property.title : undefined,
        type: typeof property.type === 'string' ? property.type : undefined,
        format: typeof property.format === 'string' ? property.format : undefined,
        description: typeof property.description === 'string' ? property.description : undefined,
      }
    }
  }
  return map
})

const assignerGraphLabels = computed<AimdAssignerGraphLabels>(() => ({
  ...messages.value.graph,
  fullscreenTitle: messages.value.graph.title,
}))

const assignerGraphLoading = computed(() => (
  engineBusy.value
  && engineStatusState.value.type === 'running'
  && engineStatusState.value.action === 'parse'
))

const parseAssigners = computed(() => {
  return Object.keys(protocolAssigners.value)
})

const parsedFieldNames = computed(() => {
  const data = parseResult.value?.data
  const fields = data && typeof data === 'object'
    ? (data as Record<string, unknown>).fields
    : undefined
  const fieldMap = fields && typeof fields === 'object' && !Array.isArray(fields)
    ? fields as Record<string, unknown>
    : {}

  return {
    var: extractParsedFieldNameSet(fieldMap.var),
    varTable: extractParsedFieldNameSet(fieldMap.var_table),
    step: extractParsedFieldNameSet(fieldMap.step),
    check: extractParsedFieldNameSet(fieldMap.check),
  }
})

const currentVarsJson = computed(() => JSON.stringify(recordData.value.var, null, 2))

const currentRuntimeInputLabel = computed(() => (
  isWorkflowExample.value ? messages.value.engine.labels.workflowRecords : messages.value.engine.labels.currentVars
))

const currentRuntimeInputJson = computed(() => (
  isWorkflowExample.value ? workflowRecordsJson.value : currentVarsJson.value
))

const engineStatus = computed(() => {
  const status = engineStatusState.value
  if (status.type === 'idle') return ''
  if (status.type === 'message') return status.message
  if (status.type === 'selectAssignerTarget') return messages.value.engine.status.selectAssignerTarget

  const action = messages.value.engine.actions[status.action]
  const template = status.type === 'running'
    ? messages.value.engine.status.running
    : messages.value.engine.status.complete
  return formatMessage(template, { action })
})

const sandboxPayload = computed(() => {
  const payload: Record<string, unknown> = {
    timeout: sandboxTimeout.value,
  }

  if (sandboxMode.value !== 'auto') {
    payload.mode = sandboxMode.value
  }
  if (sandboxRootfsPath.value.trim()) {
    payload.rootfsPath = sandboxRootfsPath.value.trim()
  }
  if (sandboxMode.value === 'image' && sandboxImage.value.trim()) {
    payload.image = sandboxImage.value.trim()
  }

  return payload
})

const workflowInputRecords = computed<Record<string, unknown> | null>(() => (
  safeParseWorkflowRecordsText(workflowRecordsJson.value)
))

const workflowResult = computed<Record<string, unknown> | null>(() => (
  isObjectRecord(lastEngineResult.value) ? lastEngineResult.value : null
))

const workflowResultData = computed<Record<string, unknown> | null>(() => {
  const data = workflowResult.value?.data
  return isObjectRecord(data) ? data : null
})

const workflowOutputRecords = computed<Record<string, unknown> | null>(() => {
  const records = workflowResultData.value?.records
  return isObjectRecord(records) ? records : null
})

const workflowRunSucceeded = computed(() => workflowResult.value?.success === true)
const workflowRunFailed = computed(() => workflowResult.value?.success === false)

const workflowExecutedTransitions = computed<WorkflowTransitionEvent[]>(() => (
  normalizeWorkflowTransitionEvents(workflowResultData.value?.executed_transitions)
))

const workflowSkippedTransitions = computed<WorkflowTransitionEvent[]>(() => (
  normalizeWorkflowTransitionEvents(workflowResultData.value?.skipped_transitions)
))

const workflowAttempts = computed<WorkflowAttemptEvent[]>(() => (
  normalizeWorkflowAttempts(workflowResultData.value?.attempts)
))

const workflowNodeIterations = computed<Record<string, number>>(() => {
  const iterations = workflowResultData.value?.node_iterations
  if (!isObjectRecord(iterations)) return {}

  const result: Record<string, number> = {}
  for (const [node, value] of Object.entries(iterations)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[node] = value
    }
  }
  return result
})

const workflowNodeIterationRows = computed(() => (
  Object.entries(workflowNodeIterations.value).map(([node, count]) => ({ node, count }))
))

const workflowData = computed<Record<string, unknown> | null>(() => {
  const data = workflowResultData.value?.workflow_data
  return isObjectRecord(data) ? data : null
})

const workflowPathData = computed<Record<string, unknown> | null>(() => {
  const data = workflowData.value?.path_data
  return isObjectRecord(data) ? data : null
})

const workflowPathStatus = computed(() => (
  typeof workflowPathData.value?.path_status === 'string'
    ? workflowPathData.value.path_status
    : messages.value.workflow.status.pending
))

const workflowPathSteps = computed<WorkflowPathStepEvent[]>(() => (
  normalizeWorkflowPathSteps(workflowPathData.value?.steps)
))

const workflowPathStepViews = computed<WorkflowPathStepView[]>(() => (
  workflowPathSteps.value.map((step, index) => workflowPathStepView(step, index))
))

const workflowHasRunResult = computed(() => workflowResult.value !== null)

const workflowTransitionStateMap = computed(() => {
  const states = new Map<string, { state: 'executed' | 'skipped', label: string }>()
  const text = messages.value.workflow

  for (const transition of workflowSkippedTransitions.value) {
    states.set(transition.id, {
      state: 'skipped',
      label: transition.reason ? `${text.status.skipped}: ${transition.reason}` : text.status.skipped,
    })
  }

  for (const transition of workflowExecutedTransitions.value) {
    states.set(transition.id, {
      state: 'executed',
      label: text.status.executed,
    })
  }

  return states
})

const workflowMetricRows = computed<WorkflowMetricRow[]>(() => {
  const workflow = workflowDefinition.value
  const text = messages.value.workflow.metrics

  return [
    {
      label: text.nodes,
      value: workflow?.nodes.length ?? 0,
      detail: workflow?.default_initial_node
        ? `${text.initial}: ${workflow.default_initial_node}`
        : undefined,
    },
    {
      label: text.transitions,
      value: workflow?.transitions.length ?? 0,
      detail: `${workflowExecutedTransitions.value.length} ${text.executed}`,
    },
    {
      label: text.assigners,
      value: workflow?.assigners.length ?? 0,
      detail: workflowAssignerRuntime.value,
    },
    {
      label: text.records,
      value: Object.keys(workflowOutputRecords.value ?? workflowInputRecords.value ?? {}).length,
      detail: workflowRunSucceeded.value ? text.updated : text.initial,
    },
  ]
})

const workflowTransitionViews = computed<WorkflowTransitionView[]>(() => {
  const text = messages.value.workflow

  return workflowTransitions.value.map((transition) => {
    const state = workflowTransitionStateMap.value.get(transition.id)
    const assignmentPreview = workflowAssignmentPreview(transition)
    const inputCount = Object.keys(transition.inputs ?? {}).length
    const assignCount = countWorkflowAssignments(transition)
    const targetCount = Object.keys(transition.assign ?? {}).length

    return {
      transition,
      fromLabel: transition.from.join(', '),
      toLabel: transition.to.join(', '),
      runLabel: transition.run ?? text.status.directAssign,
      conditionLabel: transition.when ?? text.status.always,
      inputCount,
      assignCount,
      targetCount,
      assignmentPreview,
      state: state?.state ?? 'idle',
      stateLabel: state?.label ?? text.status.notRun,
    }
  })
})

const workflowRecordHighlights = computed<WorkflowRecordValueRow[]>(() => {
  const finalRecords = workflowOutputRecords.value ?? workflowInputRecords.value
  if (!finalRecords) return []

  const initialRows = flattenWorkflowRecordValues(
    workflowLastRunInputRecords.value ?? workflowInputRecords.value ?? {},
  )
  const initialMap = new Map(initialRows.map((row) => [row.key, JSON.stringify(row.value)]))
  const rows = flattenWorkflowRecordValues(finalRecords).map((row) => ({
    ...row,
    changed: workflowRunSucceeded.value && initialMap.get(row.key) !== JSON.stringify(row.value),
  }))
  const changedRows = rows.filter((row) => row.changed)
  return (changedRows.length > 0 ? changedRows : rows).slice(0, 14)
})

const workflowStatusText = computed(() => {
  const text = messages.value.workflow.status
  if (engineStatusState.value.type === 'running' && engineStatusState.value.action === 'workflow') {
    return text.running
  }
  if (workflowRunSucceeded.value) {
    return formatMessage(text.succeeded, {
      executed: workflowExecutedTransitions.value.length,
      skipped: workflowSkippedTransitions.value.length,
    })
  }
  if (workflowRunFailed.value) {
    const message = typeof workflowResult.value?.message === 'string' ? workflowResult.value.message : text.failed
    return message
  }
  return text.ready
})

const fieldState = computed(() => {
  return fieldRuntimeState.value
})

function formatMessage(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))
}

function runtimeKindLabel(engineRequired?: boolean) {
  return engineRequired ? messages.value.runtime.engine : messages.value.runtime.static
}

function extractWorkflowBlock(content: string) {
  const match = content.match(/(?:^|\n)(```|~~~)\s*workflow[^\n]*\n([\s\S]*?)\n\1\s*(?:\n|$)/)
  return match?.[2]?.trim() ?? ''
}

function workflowNodeProtocolPath(node: AimdWorkflowField['nodes'][number]) {
  const rawPath = node.protocol ?? node.protocol_id
  const variant = selectedVariant.value
  if (!rawPath || !variant?.protocolDir) return ''

  const normalizedPath = rawPath
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/^\/+/, '')
  const normalizedDir = variant.protocolDir.replace(/^\/+|\/+$/g, '')
  return `${normalizedDir}/${normalizedPath}`
}

function categoryLabel(category?: string) {
  if (!category) return ''
  return messages.value.categories[category] ?? category
}

function sourceKindLabel(sourceKind?: string) {
  if (!sourceKind) return messages.value.sourceKinds.protocol
  return messages.value.sourceKinds[sourceKind] ?? sourceKind
}

function protocolLocaleLabel(locale: string) {
  const normalized = normalizeDemoLocale(locale)
  return `${messages.value.app.localeNames[normalized]} (${locale})`
}

function sourceFileLanguage(pathValue: string) {
  const lowerPath = pathValue.toLowerCase()
  if (lowerPath.endsWith('.aimd')) return 'aimd'
  if (lowerPath.endsWith('.toml')) return 'toml'
  if (lowerPath.endsWith('.py')) return 'python'
  if (lowerPath.endsWith('.csv')) return 'csv'
  if (lowerPath.endsWith('.json')) return 'json'
  if (lowerPath.endsWith('.md')) return 'markdown'
  if (lowerPath.endsWith('.yaml') || lowerPath.endsWith('.yml')) return 'yaml'
  return 'plaintext'
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function safeParseWorkflowRecordsText(text: string) {
  try {
    const parsed = JSON.parse(text.trim() || '{}') as unknown
    return isObjectRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function cloneJsonValue<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T
}

function workflowRecordToProtocolRecordData(record: unknown): AimdProtocolRecordData {
  const source = isObjectRecord(record) && isObjectRecord(record.data)
    ? record.data
    : record
  const nextRecord = createEmptyProtocolRecordData()
  if (!isObjectRecord(source)) return nextRecord

  if (isObjectRecord(source.var)) {
    nextRecord.var = cloneJsonValue(source.var)
  }
  if (isObjectRecord(source.step)) {
    nextRecord.step = cloneJsonValue(source.step) as AimdProtocolRecordData['step']
  }
  if (isObjectRecord(source.check)) {
    nextRecord.check = cloneJsonValue(source.check) as AimdProtocolRecordData['check']
  }
  if (isObjectRecord(source.quiz)) {
    nextRecord.quiz = cloneJsonValue(source.quiz)
  }

  return nextRecord
}

function protocolRecordDataToWorkflowRecord(
  recordDataValue: AimdProtocolRecordData,
  existingRecord: unknown,
) {
  const base = isObjectRecord(existingRecord) ? cloneJsonValue(existingRecord) : {}
  return {
    ...base,
    data: cloneJsonValue(recordDataValue),
  }
}

function setWorkflowRecordsJson(records: Record<string, unknown>) {
  workflowRecordsJson.value = JSON.stringify(records, null, 2)
}

function scheduleWorkflowSyncFlagReset(flag: 'node' | 'records') {
  void nextTick(() => {
    if (flag === 'node') {
      applyingWorkflowNodeRecord = false
    } else {
      applyingWorkflowRecordsText = false
    }
  })
}

function loadSelectedWorkflowNodeRecord(records = workflowInputRecords.value) {
  const nodeId = selectedWorkflowNodeId.value
  if (!nodeId) {
    applyingWorkflowNodeRecord = true
    workflowNodeRecordData.value = createEmptyProtocolRecordData()
    workflowNodeFieldRuntimeState.value = {}
    workflowNodeRecorderKey.value += 1
    scheduleWorkflowSyncFlagReset('node')
    return
  }

  applyingWorkflowNodeRecord = true
  workflowNodeRecordData.value = workflowRecordToProtocolRecordData(records?.[nodeId])
  workflowNodeFieldRuntimeState.value = {}
  workflowNodeRecorderKey.value += 1
  scheduleWorkflowSyncFlagReset('node')
}

function updateWorkflowRecordsFromSelectedNode(recordDataValue: AimdProtocolRecordData) {
  const nodeId = selectedWorkflowNodeId.value
  if (!nodeId) return

  const records = cloneJsonValue(workflowInputRecords.value ?? {})
  records[nodeId] = protocolRecordDataToWorkflowRecord(recordDataValue, records[nodeId])
  applyingWorkflowRecordsText = true
  setWorkflowRecordsJson(records)
  scheduleWorkflowSyncFlagReset('records')
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

function normalizeWorkflowTransitionEvents(value: unknown): WorkflowTransitionEvent[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!isObjectRecord(item) || typeof item.id !== 'string' || !item.id.trim()) {
        return null
      }
      return {
        id: item.id.trim(),
        from: normalizeStringArray(item.from),
        to: normalizeStringArray(item.to),
        run: typeof item.run === 'string' && item.run.trim() ? item.run.trim() : undefined,
        reason: typeof item.reason === 'string' && item.reason.trim() ? item.reason.trim() : undefined,
      }
    })
    .filter((item): item is WorkflowTransitionEvent => item !== null)
}

function normalizeWorkflowAttempts(value: unknown): WorkflowAttemptEvent[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!isObjectRecord(item)) return null
      if (typeof item.transition !== 'string' || typeof item.assigner !== 'string') {
        return null
      }
      const outputs = isObjectRecord(item.outputs) ? item.outputs : undefined
      return {
        transition: item.transition,
        assigner: item.assigner,
        runtime: typeof item.runtime === 'string' ? item.runtime : '',
        status: typeof item.status === 'string' ? item.status : '',
        outputs,
        message: typeof item.message === 'string' ? item.message : undefined,
      }
    })
    .filter((item): item is WorkflowAttemptEvent => item !== null)
}

function normalizeWorkflowPathSteps(value: unknown): WorkflowPathStepEvent[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!isObjectRecord(item) || typeof item.step !== 'string') return null
      const pathIndex = typeof item.path_index === 'number' && Number.isFinite(item.path_index)
        ? item.path_index
        : 0
      return {
        step: item.step,
        path_index: pathIndex,
        mode: typeof item.mode === 'string' ? item.mode : 'ai',
        data: isObjectRecord(item.data) ? item.data : {},
      }
    })
    .filter((item): item is WorkflowPathStepEvent => item !== null)
}

function workflowPathStepTitle(step: WorkflowPathStepEvent) {
  const labels = messages.value.workflow.stepLabels
  if (step.step === 'record_protocol') return labels.recordProtocol
  if (step.step === 'add_next_protocol') return labels.addNextProtocol
  if (step.step === 'add_initial_values_for_fields_in_next_protocol') return labels.addInitialValues
  if (step.step === 'add_research_goal') return labels.addResearchGoal
  if (step.step === 'add_research_strategy') return labels.addResearchStrategy
  if (step.step === 'add_phased_research_conclusion') return labels.addPhasedConclusion
  if (step.step === 'add_final_research_conclusion') return labels.addFinalConclusion
  return step.step.replace(/_/g, ' ')
}

function workflowPathStepDetail(step: WorkflowPathStepEvent) {
  const labels = messages.value.workflow.labels
  const nodeId = typeof step.data.node_id === 'string' ? step.data.node_id : ''
  const transitionId = typeof step.data.transition_id === 'string' ? step.data.transition_id : ''
  const protocolIndex = typeof step.data.protocol_index === 'number' ? step.data.protocol_index : undefined
  const parts: string[] = []
  if (nodeId) parts.push(`${labels.node}: ${nodeId}`)
  if (protocolIndex !== undefined && protocolIndex >= 0) {
    parts.push(`${labels.protocolIndex}: ${protocolIndex}`)
  }
  if (transitionId) parts.push(`${labels.transition}: ${transitionId}`)
  parts.push(`${labels.mode}: ${step.mode}`)
  return parts.join(' / ')
}

function workflowPathStepValueSummary(step: WorkflowPathStepEvent) {
  if (isObjectRecord(step.data.values)) {
    const entries = Object.entries(step.data.values)
    if (entries.length === 0) return messages.value.workflow.status.none
    return entries.map(([key, value]) => `${key}: ${formatWorkflowValue(value)}`).join('; ')
  }
  if (typeof step.data.record_id === 'string') return step.data.record_id
  if (typeof step.data.airalogy_record_id === 'string') return step.data.airalogy_record_id
  return ''
}

function workflowPathStepView(step: WorkflowPathStepEvent, index: number): WorkflowPathStepView {
  return {
    key: `${index}-${step.step}-${step.path_index}`,
    pathIndex: step.path_index,
    title: workflowPathStepTitle(step),
    detail: workflowPathStepDetail(step),
    mode: step.mode,
    valueSummary: workflowPathStepValueSummary(step),
  }
}

function countWorkflowAssignments(transition: AimdWorkflowTransitionField) {
  return Object.values(transition.assign ?? {}).reduce((count, assignments) => (
    count + Object.keys(assignments).length
  ), 0)
}

function workflowAssignmentPreview(transition: AimdWorkflowTransitionField) {
  const preview: WorkflowAssignmentPreview[] = []
  for (const [target, assignments] of Object.entries(transition.assign ?? {})) {
    for (const [pathValue, value] of Object.entries(assignments)) {
      preview.push({ target, path: pathValue, value })
    }
  }
  return preview.slice(0, 5)
}

function workflowOutputEntries(value: unknown) {
  if (!isObjectRecord(value)) return []
  return Object.entries(value).slice(0, 6).map(([key, entryValue]) => ({
    key,
    value: entryValue,
  }))
}

function formatWorkflowValue(value: unknown) {
  if (value === null || value === undefined) return String(value)
  if (typeof value === 'string') {
    return value.length > 96 ? `${value.slice(0, 93)}...` : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.map(formatWorkflowValue).join(', ')}]`
  if (isObjectRecord(value)) {
    const keys = Object.keys(value)
    return keys.length > 0 ? `{ ${keys.slice(0, 4).join(', ')}${keys.length > 4 ? ', ...' : ''} }` : '{}'
  }
  return String(value)
}

function flattenWorkflowRecordValues(records: Record<string, unknown>) {
  const rows: WorkflowRecordValueRow[] = []
  for (const [node, record] of Object.entries(records)) {
    if (!isObjectRecord(record)) continue
    const data = isObjectRecord(record.data) ? record.data : record
    for (const scope of ['var', 'step', 'check']) {
      const scopeValues = data[scope]
      if (!isObjectRecord(scopeValues)) continue
      for (const [fieldName, fieldValue] of Object.entries(scopeValues)) {
        if ((scope === 'step' || scope === 'check') && isObjectRecord(fieldValue)) {
          const visibleKeys = ['checked', 'annotation', 'value']
          const visibleEntries = visibleKeys
            .filter((key) => Object.prototype.hasOwnProperty.call(fieldValue, key))
            .map((key) => [key, fieldValue[key]] as const)
          if (visibleEntries.length > 0) {
            for (const [key, value] of visibleEntries) {
              pushWorkflowRecordValue(rows, node, `${scope}.${fieldName}.${key}`, value)
            }
            continue
          }
        }
        pushWorkflowRecordValue(rows, node, `${scope}.${fieldName}`, fieldValue)
      }
    }
  }
  return rows
}

function pushWorkflowRecordValue(
  rows: WorkflowRecordValueRow[],
  node: string,
  pathValue: string,
  value: unknown,
) {
  rows.push({
    key: `${node}.${pathValue}`,
    node,
    path: pathValue,
    value,
    changed: false,
  })
}

function parsedFieldName(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (!isObjectRecord(value)) return ''

  const name = value.name ?? value.id
  return typeof name === 'string' && name.trim() ? name.trim() : ''
}

function extractParsedFieldNameSet(value: unknown) {
  if (!Array.isArray(value)) return new Set<string>()
  return new Set(value.map(parsedFieldName).filter(Boolean))
}

function isAssignerGraphNodeType(value: unknown): value is AimdAssignerGraphNodeType {
  return value === 'dependent_field' || value === 'assigner' || value === 'assigned_field'
}

function normalizeAssignerGraphNode(value: unknown): AimdAssignerGraphData['nodes'][number] | null {
  if (!isObjectRecord(value) || typeof value.name !== 'string' || !value.name.trim()) {
    return null
  }
  return {
    name: value.name.trim(),
    type: isAssignerGraphNodeType(value.type) ? value.type : 'dependent_field',
  }
}

function normalizeAssignerGraphEdge(value: unknown): AimdAssignerGraphData['edges'][number] | null {
  if (!Array.isArray(value) || value.length < 2) return null
  const [from, to] = value
  if (typeof from !== 'string' || typeof to !== 'string') return null
  const trimmedFrom = from.trim()
  const trimmedTo = to.trim()
  return trimmedFrom && trimmedTo ? [trimmedFrom, trimmedTo] : null
}

function assignedFieldToRecorderFieldKey(assignedField: string) {
  const names = parsedFieldNames.value
  return getAimdAssignerFieldKey(assignedField, {
    var: names.var,
    varTable: names.varTable,
    step: names.step,
    check: names.check,
  })
}

function relativeProtocolPath(pathValue: string, protocolDir?: string) {
  const normalizedPath = pathValue.replace(/^\/+/, '')
  const normalizedDir = protocolDir?.replace(/^\/+|\/+$/g, '')

  if (normalizedDir && normalizedPath.startsWith(`${normalizedDir}/`)) {
    return normalizedPath.slice(normalizedDir.length + 1)
  }

  const segments = normalizedPath.split('/')
  return segments[segments.length - 1] ?? normalizedPath
}

function appendSourceFile(
  files: SourceFile[],
  pathValue: string | undefined,
  content: string | null | undefined,
  protocolDir?: string,
) {
  if (!pathValue) return
  if (files.some((file) => file.path === pathValue)) return
  const relativePath = relativeProtocolPath(pathValue, protocolDir)
  files.push({
    path: pathValue,
    relativePath,
    content: sourceContentForPath(pathValue, content),
    language: sourceFileLanguage(relativePath),
  })
}

function originalSourceContent(pathValue: string) {
  const variant = selectedVariant.value
  if (!variant) return ''
  if (pathValue === variant.aimdPath) return variant.aimd ?? ''
  if (pathValue === variant.tomlPath) return variant.toml ?? ''
  if (pathValue === variant.assignerPath) return variant.assigner ?? ''
  const sourceFile = variant.sourceFiles.find((file) => file.path === pathValue)
  if (sourceFile) return sourceFile.content ?? ''
  return variant.sampleData.find((sample) => sample.path === pathValue)?.content ?? ''
}

function sourceContentForPath(pathValue: string, originalContent: string | null | undefined) {
  return sourceDrafts.value[pathValue] ?? originalContent ?? ''
}

function clearCurrentSourceDrafts() {
  const currentPaths = new Set(sourceFiles.value.map((file) => file.path))
  if (currentPaths.size === 0) return

  const nextDrafts = { ...sourceDrafts.value }
  for (const pathValue of currentPaths) {
    delete nextDrafts[pathValue]
  }
  sourceDrafts.value = nextDrafts
}

function resetRuntimeState() {
  recordData.value = createEmptyProtocolRecordData()
  fieldRuntimeState.value = {}
  workflowNodeFieldRuntimeState.value = {}
  workflowLastRunInputRecords.value = null
  engineStatusState.value = { type: 'idle' }
  lastEngineResult.value = null
  parseResult.value = null
  assignerTarget.value = ''
  workflowTransitionIdsJson.value = '[]'
  workflowMaxPasses.value = 1
  recorderKey.value += 1
  workflowNodeRecorderKey.value += 1
}

function resetEngineExecutionState() {
  fieldRuntimeState.value = {}
  workflowNodeFieldRuntimeState.value = {}
  workflowLastRunInputRecords.value = null
  engineStatusState.value = { type: 'idle' }
  lastEngineResult.value = null
  parseResult.value = null
  assignerTarget.value = ''
}

function updateSourceDraft(pathValue: string, content: string) {
  const originalContent = originalSourceContent(pathValue)
  const nextDrafts = { ...sourceDrafts.value }

  if (content === originalContent) {
    delete nextDrafts[pathValue]
  } else {
    nextDrafts[pathValue] = content
  }

  sourceDrafts.value = nextDrafts
}

function handleSourceContentChange(payload: { path: string, content: string }) {
  if (payload.content === sourceContentForPath(payload.path, originalSourceContent(payload.path))) {
    return
  }

  updateSourceDraft(payload.path, payload.content)

  if (payload.path === selectedVariant.value?.aimdPath) {
    sourceContent.value = payload.content
  }
  resetRuntimeState()
}

function handleRecordSourceContentChange(content: string) {
  if (content === sourceContent.value) {
    return
  }

  const aimdPath = selectedVariant.value?.aimdPath
  sourceContent.value = content
  if (aimdPath) {
    updateSourceDraft(aimdPath, content)
  }
  resetEngineExecutionState()
}

function bestProtocolLocale(protocol: ProtocolExample | undefined, preferredLocale: string) {
  if (!protocol) return ''
  const normalizedPreferred = normalizeDemoLocale(preferredLocale)
  return protocol.languages.find((locale) => normalizeDemoLocale(locale) === normalizedPreferred)
    ?? protocol.languages[0]
    ?? ''
}

function localizeErrorMessage(message: string) {
  const errors = messages.value.errors
  if (message.includes('Local Airalogy Engine rootfs not found')) return errors.rootfsNotFound
  if (message === 'varName is required') return errors.varNameRequired
  if (message === 'Request body is too large') return errors.bodyTooLarge
  if (message === 'Env vars must be a JSON object') return errors.envVarsObject
  if (message === 'Workflow records must be a JSON object') return errors.workflowRecordsObject
  if (message === 'No protocol selected') return errors.noProtocolSelected
  if (message.startsWith('Unknown protocol example')) return errors.unknownProtocol
  if (message.includes('does not provide locale')) return errors.unsupportedLocale
  if (message.includes('has no protocol directory')) return errors.missingProtocolDir
  if (message === 'transitionIds must be an array') return errors.workflowTransitionIdsArray
  return message
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const payload = await response.json()

  if (!response.ok || payload.ok === false) {
    const fallback = formatMessage(messages.value.errors.requestFailed, { status: response.status })
    throw new Error(localizeErrorMessage(payload.message ?? fallback))
  }

  return payload as T
}

async function uploadProtocolFile(file: File, context: AimdFileUploadContext): Promise<string> {
  const form = new FormData()
  form.append('file', file, file.name)
  form.append('fieldKey', context.fieldKey)
  form.append('type', context.type)

  const response = await fetch('/api/files/upload', {
    method: 'POST',
    body: form,
  })
  const payload = await response.json() as ApiEnvelope<{ id?: string, file_name?: string }>

  if (!response.ok || payload.ok === false || !payload.result?.id) {
    const fallback = formatMessage(messages.value.errors.requestFailed, { status: response.status })
    throw new Error(localizeErrorMessage(payload.message ?? fallback))
  }

  return payload.result.id
}

function resolveProtocolFile(src: string) {
  return src.startsWith('airalogy.id.file.')
    ? `/api/files/${encodeURIComponent(src)}`
    : null
}

async function resolveProtocolFileInfo(src: string): Promise<AimdResolvedFileInfo | null> {
  if (!src.startsWith('airalogy.id.file.')) {
    return null
  }

  const response = await fetch(`/api/files/${encodeURIComponent(src)}/metadata`)
  const payload = await response.json() as ApiEnvelope<{
    id?: string
    name?: string
    file_name?: string
    content_type?: string
    size?: number
  }>

  if (!response.ok || payload.ok === false || !payload.result) {
    return {
      id: src,
      url: resolveProtocolFile(src) ?? undefined,
    }
  }

  const url = resolveProtocolFile(src) ?? undefined
  return {
    id: payload.result.id ?? src,
    name: payload.result.name ?? payload.result.file_name,
    url,
    thumbnailUrl: url,
    content_type: payload.result.content_type,
    size: payload.result.size,
  }
}

function resetProtocolState(resetSourceDrafts = false) {
  const variant = selectedVariant.value
  if (resetSourceDrafts) {
    clearCurrentSourceDrafts()
  }
  sourceContent.value = variant?.aimdPath ? sourceContentForPath(variant.aimdPath, variant.aimd) : ''
  workflowRecordsJson.value = variant?.workflowRecords?.trim()
    ? variant.workflowRecords
    : '{\n}'
  resetRuntimeState()
  selectedSourcePath.value = variant?.aimdPath ?? sourceFiles.value[0]?.path ?? ''
  void refreshProtocolMetadata()
}

function parseEnvVars() {
  const trimmed = envVarsJson.value.trim()
  if (!trimmed || trimmed === '{}') {
    return undefined
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error(messages.value.errors.envVarsInvalidJson)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(messages.value.errors.envVarsObject)
  }

  return parsed
}

function parseJsonObject(text: string, invalidJsonMessage: string, objectMessage: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(invalidJsonMessage)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(objectMessage)
  }
  return parsed as Record<string, unknown>
}

function parseWorkflowRecords() {
  return parseJsonObject(
    workflowRecordsJson.value.trim() || '{}',
    messages.value.errors.workflowRecordsInvalidJson,
    messages.value.errors.workflowRecordsObject,
  )
}

function parseWorkflowTransitionIds() {
  const trimmed = workflowTransitionIdsJson.value.trim()
  if (!trimmed || trimmed === '[]') {
    return undefined
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error(messages.value.errors.workflowTransitionIdsInvalidJson)
  }
  if (!Array.isArray(parsed)) {
    throw new Error(messages.value.errors.workflowTransitionIdsArray)
  }

  const transitionIds = parsed
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
  return transitionIds.length > 0 ? transitionIds : undefined
}

async function postEngine<T>(action: 'parse' | 'assign' | 'validate', body: Record<string, unknown>) {
  const protocol = selectedProtocol.value
  const variant = selectedVariant.value
  if (!protocol || !variant) {
    throw new Error(messages.value.errors.noProtocolSelected)
  }

  return apiJson<ApiEnvelope<T>>(
    `/api/protocols/${encodeURIComponent(protocol.id)}/${encodeURIComponent(variant.locale)}/${action}`,
    {
      method: 'POST',
      body: JSON.stringify({
        ...body,
        envVars: parseEnvVars(),
        sandbox: sandboxPayload.value,
        sourceFiles: draftSourceFiles.value,
      }),
    },
  )
}

async function postWorkflowRun<T>() {
  const protocol = selectedProtocol.value
  const variant = selectedVariant.value
  if (!protocol || !variant) {
    throw new Error(messages.value.errors.noProtocolSelected)
  }

  return apiJson<ApiEnvelope<T>>(
    `/api/workflows/${encodeURIComponent(protocol.id)}/${encodeURIComponent(variant.locale)}/run`,
    {
      method: 'POST',
      body: JSON.stringify({
        records: parseWorkflowRecords(),
        transitionIds: parseWorkflowTransitionIds(),
        maxPasses: workflowMaxPasses.value,
        assignerRuntime: workflowAssignerRuntime.value,
        envVars: parseEnvVars(),
        sandbox: sandboxPayload.value,
        sourceFiles: draftSourceFiles.value,
      }),
    },
  )
}

async function runEngineAction<T>(action: EngineAction, fn: () => Promise<ApiEnvelope<T>>) {
  engineBusy.value = true
  engineStatusState.value = { type: 'running', action }

  try {
    const response = await fn()
    lastEngineResult.value = response.result
    if (
      response.result
      && typeof response.result === 'object'
      && 'success' in response.result
      && (response.result as { success?: unknown }).success === false
    ) {
      const result = response.result as Record<string, unknown>
      const message = typeof result.message === 'string'
        ? result.message
        : typeof result.output === 'string' && result.output.trim()
          ? result.output.trim()
          : 'Engine action failed'
      throw new Error(message)
    }
    engineStatusState.value = { type: 'complete', action }
    return response.result
  } catch (err) {
    const message = err instanceof Error ? localizeErrorMessage(err.message) : String(err)
    lastEngineResult.value = { success: false, message }
    engineStatusState.value = { type: 'message', message }
    throw err
  } finally {
    engineBusy.value = false
  }
}

async function runParse() {
  const result = await runEngineAction<Record<string, unknown>>('parse', () => (
    postEngine('parse', {})
  ))
  parseResult.value = result ?? null

  if (parseAssigners.value.length > 0 && !parseAssigners.value.includes(assignerTarget.value)) {
    assignerTarget.value = parseAssigners.value[0]
  }
}

async function refreshProtocolMetadata() {
  if (!selectedProtocol.value?.engine_required || !engineAvailable.value || isWorkflowExample.value) {
    return
  }

  try {
    await runParse()
  } catch {
    // The Engine panel keeps the localized status/error for the user.
  }
}

async function runWorkflow() {
  const runInputRecords = cloneJsonValue(parseWorkflowRecords())
  workflowLastRunInputRecords.value = runInputRecords
  const result = await runEngineAction<unknown>('workflow', () => postWorkflowRun())

  if (isObjectRecord(result)) {
    const data = result.data
    const records = isObjectRecord(data) && isObjectRecord(data.records)
      ? data.records
      : null
    if (records) {
      applyingWorkflowRecordsText = true
      setWorkflowRecordsJson(records)
      scheduleWorkflowSyncFlagReset('records')
      loadSelectedWorkflowNodeRecord(records)
    }
  }
}

async function runProtocolAssigner(request: AimdAssignerRunnerRequest) {
  return runEngineAction<unknown>('assign', () => (
    postEngine('assign', {
      varName: request.assignedField,
      dependentData: request.dependentData,
    })
  ))
}

async function runAssign(target = assignerTarget.value) {
  if (!target.trim()) {
    engineStatusState.value = { type: 'selectAssignerTarget' }
    return
  }

  const fieldKey = target.trim()
  const stateKey = assignedFieldToRecorderFieldKey(fieldKey)
  fieldRuntimeState.value = {
    ...fieldRuntimeState.value,
    [stateKey]: { ...fieldRuntimeState.value[stateKey], loading: true, error: undefined },
  }

  try {
    const assigner = protocolAssigners.value[fieldKey]
    const result = await runProtocolAssigner({
      section: 'var',
      fieldKey: stateKey,
      assignedField: fieldKey,
      dependentData: buildAimdAssignerDependentData(recordData.value, assigner),
      record: cloneRecordData(recordData.value),
      assigner: isObjectRecord(assigner) ? assigner : {},
    })
    const assignedFields = extractAimdAssignedFields(result)
    if (Object.keys(assignedFields).length > 0) {
      const nextRecord = cloneRecordData(recordData.value)
      applyAimdAssignedFieldsToRecord(nextRecord, assignedFields)
      recordData.value = nextRecord
    }
    fieldRuntimeState.value = {
      ...fieldRuntimeState.value,
      [stateKey]: { ...fieldRuntimeState.value[stateKey], loading: false, error: undefined },
    }
  } catch (err) {
    const message = err instanceof Error ? localizeErrorMessage(err.message) : String(err)
    fieldRuntimeState.value = {
      ...fieldRuntimeState.value,
      [stateKey]: { ...fieldRuntimeState.value[stateKey], loading: false, error: message },
    }
  }
}

function applyValidationErrors(result: unknown) {
  const nextState: Record<string, AimdFieldState> = { ...fieldRuntimeState.value }

  for (const state of Object.values(nextState)) {
    delete state.validationError
  }

  if (!result || typeof result !== 'object') {
    fieldRuntimeState.value = nextState
    return
  }

  const data = (result as Record<string, unknown>).data
  const errors = data && typeof data === 'object'
    ? (data as Record<string, unknown>).errors
    : undefined

  if (Array.isArray(errors)) {
    for (const error of errors) {
      if (!error || typeof error !== 'object') continue
      const loc = (error as Record<string, unknown>).loc
      const fieldKey = Array.isArray(loc) ? String(loc[0]) : undefined
      if (!fieldKey) continue
      const stateKey = assignedFieldToRecorderFieldKey(fieldKey)
      nextState[stateKey] = {
        ...nextState[stateKey],
        validationError: (error as Record<string, unknown>).msg
          ? String((error as Record<string, unknown>).msg)
          : messages.value.errors.invalidValue,
      }
    }
  }

  fieldRuntimeState.value = nextState
}

async function runValidate() {
  const result = await runEngineAction<unknown>('validate', () => (
    postEngine('validate', {
      vars: recordData.value.var,
    })
  ))
  applyValidationErrors(result)
}

async function loadDemo() {
  loading.value = true
  loadError.value = ''

  try {
    const [nextHealth, nextRegistry] = await Promise.all([
      apiJson<HealthPayload>('/api/health'),
      apiJson<ProtocolRegistry>('/api/protocols'),
    ])
    health.value = nextHealth
    registry.value = nextRegistry
    selectedProtocolId.value = nextRegistry.examples[0]?.id ?? ''
    selectedLocale.value = bestProtocolLocale(nextRegistry.examples[0], uiLocale.value)
    sandboxMode.value = nextHealth.mode === 'image' ? 'image' : 'auto'
    sandboxRootfsPath.value = nextHealth.rootfs.exists ? nextHealth.rootfs.path : ''
    sandboxImage.value = nextHealth.mode === 'image' ? nextHealth.image : ''
    workflowAssignerRuntime.value = nextHealth.mode === 'unconfigured' ? 'local' : 'sandbox'
  } catch (err) {
    loadError.value = err instanceof Error ? localizeErrorMessage(err.message) : String(err)
  } finally {
    loading.value = false
  }
}

watch(selectedProtocol, (protocol) => {
  if (!protocol) return
  if (!protocol.languages.includes(selectedLocale.value)) {
    selectedLocale.value = bestProtocolLocale(protocol, selectedLocale.value)
  }
})

watch(selectedVariant, () => {
  resetProtocolState()
})

watch(sourceFiles, (files) => {
  if (files.length === 0) {
    selectedSourcePath.value = ''
    return
  }

  if (!files.some((file) => file.path === selectedSourcePath.value)) {
    selectedSourcePath.value = files[0].path
  }
}, { immediate: true })

watch(parseAssigners, (assigners) => {
  if (assigners.length > 0 && !assigners.includes(assignerTarget.value)) {
    assignerTarget.value = assigners[0]
  }
})

watch(workflowDefinition, (workflow) => {
  const nodes = workflow?.nodes ?? []
  if (nodes.length === 0) {
    selectedWorkflowNodeId.value = ''
    return
  }

  if (!nodes.some((node) => node.id === selectedWorkflowNodeId.value)) {
    selectedWorkflowNodeId.value = workflow?.default_initial_node
      && nodes.some((node) => node.id === workflow.default_initial_node)
      ? workflow.default_initial_node
      : nodes[0].id
  }
}, { immediate: true })

watch(selectedWorkflowNodeId, () => {
  loadSelectedWorkflowNodeRecord()
})

watch(workflowRecordsJson, () => {
  if (applyingWorkflowRecordsText) return
  workflowLastRunInputRecords.value = null
  loadSelectedWorkflowNodeRecord()
})

watch(workflowNodeRecordData, (record) => {
  if (applyingWorkflowNodeRecord) return
  updateWorkflowRecordsFromSelectedNode(record)
}, { deep: true })

onMounted(() => {
  void loadDemo()
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand-block">
        <img class="brand-logo" :src="airalogyLogoMarkUrl" alt="" aria-hidden="true" />
        <div class="brand-copy">
          <h1>{{ messages.app.title }}</h1>
          <span class="brand-subtitle">{{ messages.app.subtitle }}</span>
        </div>
      </div>
      <div class="topbar-controls">
        <label class="ui-locale-select">
          <span>{{ messages.app.languageLabel }}</span>
          <select v-model="uiLocale">
            <option value="zh-CN">{{ messages.app.localeNames['zh-CN'] }}</option>
            <option value="en-US">{{ messages.app.localeNames['en-US'] }}</option>
          </select>
        </label>
        <div class="runtime-block">
          <span :class="['runtime-dot', { ok: engineAvailable }]"></span>
          <span>{{ engineSummary }}</span>
        </div>
      </div>
    </header>

    <main v-if="loading" class="loading-view">
      {{ messages.loading.registry }}
    </main>

    <main v-else-if="loadError" class="loading-view error-view">
      {{ loadError }}
    </main>

    <main v-else class="workspace">
      <aside class="protocol-list">
        <div class="section-label">{{ messages.common.protocols }}</div>
        <div
          v-for="protocol in protocols"
          :key="protocol.id"
          :class="['protocol-option', { active: protocol.id === selectedProtocolId }]"
        >
          <button
            class="protocol-option__hitbox"
            type="button"
            :aria-current="protocol.id === selectedProtocolId ? 'true' : undefined"
            :aria-label="`${protocol.title[selectedLocale] ?? protocol.title['en-US'] ?? protocol.id} ${protocol.id}`"
            @click="selectedProtocolId = protocol.id"
          ></button>
          <span class="protocol-option__name">
            {{ protocol.title[selectedLocale] ?? protocol.title['en-US'] ?? protocol.id }}
          </span>
          <span class="protocol-option__meta">
            {{ protocol.id }} / {{ sourceKindLabel(protocol.source_kind) }} / {{ runtimeKindLabel(protocol.engine_required) }}
          </span>
        </div>
      </aside>

      <section class="protocol-workbench">
        <div class="protocol-header">
          <div>
            <div class="eyebrow">{{ categoryLabel(selectedProtocol?.category) }} / {{ sourceKindLabel(selectedProtocol?.source_kind) }} / {{ runtimeLabel }}</div>
            <h2>{{ protocolTitle }}</h2>
            <p>{{ protocolDescription }}</p>
          </div>
          <label class="locale-select">
            <span>{{ messages.app.protocolLanguageLabel }}</span>
            <select v-model="selectedLocale">
              <option
                v-for="locale in selectedProtocol?.languages ?? []"
                :key="locale"
                :value="locale"
              >
                {{ protocolLocaleLabel(locale) }}
              </option>
            </select>
          </label>
        </div>

        <div class="metadata-row">
          <div>
            <span class="meta-label">{{ messages.common.protocolDir }}</span>
            <span class="meta-value">{{ selectedVariant?.protocolDir }}</span>
          </div>
          <div>
            <span class="meta-label">{{ metadataAssignerLabel }}</span>
            <span class="meta-value">{{ metadataAssignerValue }}</span>
          </div>
          <div>
            <span class="meta-label">{{ metadataSampleLabel }}</span>
            <span class="meta-value">{{ metadataSampleValue }}</span>
          </div>
        </div>

        <nav class="tabbar">
          <button
            :class="{ active: activeTab === 'record' }"
            type="button"
            @click="activeTab = 'record'"
          >
            {{ messages.tabs.record }}
          </button>
          <button
            :class="{ active: activeTab === 'source' }"
            type="button"
            @click="activeTab = 'source'"
          >
            {{ messages.tabs.source }}
          </button>
          <button
            :class="{ active: activeTab === 'graph' }"
            type="button"
            @click="activeTab = 'graph'"
          >
            {{ messages.tabs.graph }}
          </button>
          <button
            :class="{ active: activeTab === 'engine' }"
            type="button"
            @click="activeTab = 'engine'"
          >
            {{ messages.tabs.engine }}
          </button>
        </nav>

        <section v-if="activeTab === 'record'" class="record-panel">
          <template v-if="isWorkflowExample">
            <div class="record-toolbar">
              <span :class="['source-draft-state', { active: hasSourceDraftChanges }]">
                {{ hasSourceDraftChanges ? messages.source.draftActive : messages.source.draftHint }}
              </span>
              <div class="record-toolbar__actions">
                <button
                  type="button"
                  :disabled="!hasSourceDraftChanges"
                  @click="resetProtocolState(true)"
                >
                  {{ messages.source.resetDraft }}
                </button>
                <button type="button" @click="resetProtocolState">{{ messages.record.reset }}</button>
                <button type="button" :disabled="engineBusy" @click="runWorkflow">
                  {{ messages.engine.actions.workflow }}
                </button>
              </div>
            </div>
            <section class="workflow-dashboard">
              <div v-if="workflowParseError" class="workflow-alert workflow-alert--error">
                <strong>{{ messages.workflow.status.parseError }}</strong>
                <span>{{ workflowParseError }}</span>
              </div>

              <div class="workflow-overview">
                <div class="workflow-overview__copy">
                  <div class="eyebrow">{{ messages.workflow.title }}</div>
                  <h3>{{ workflowDefinition?.title ?? protocolTitle }}</h3>
                  <p>{{ workflowDefinition?.description ?? protocolDescription }}</p>
                </div>
                <div class="workflow-run-box">
                  <label>
                    <span>{{ messages.engine.labels.assignerRuntime }}</span>
                    <select v-model="workflowAssignerRuntime">
                      <option value="sandbox">{{ messages.engine.assignerRuntimes.sandbox }}</option>
                      <option value="local">{{ messages.engine.assignerRuntimes.local }}</option>
                    </select>
                  </label>
                  <label>
                    <span>{{ messages.engine.labels.maxPasses }}</span>
                    <input v-model.number="workflowMaxPasses" min="1" max="50" type="number" />
                  </label>
                  <button class="primary-action" type="button" :disabled="engineBusy || !!workflowParseError" @click="runWorkflow">
                    {{ messages.engine.actions.workflow }}
                  </button>
                </div>
              </div>

              <div class="workflow-metrics">
                <div v-for="metric in workflowMetricRows" :key="metric.label" class="workflow-metric">
                  <span>{{ metric.label }}</span>
                  <strong>{{ metric.value }}</strong>
                  <small v-if="metric.detail">{{ metric.detail }}</small>
                </div>
              </div>

              <div :class="['workflow-run-status', { success: workflowRunSucceeded, failed: workflowRunFailed, running: engineBusy }]">
                <span>{{ messages.workflow.status.latestRun }}</span>
                <strong>{{ workflowStatusText }}</strong>
              </div>

              <section class="workflow-node-recorder">
                <div class="workflow-node-recorder__head">
                  <div>
                    <span>{{ messages.workflow.sections.nodeRecorder }}</span>
                    <strong>{{ selectedWorkflowNodeView?.id ?? messages.common.none }}</strong>
                  </div>
                  <span class="workflow-node-recorder__sync">
                    {{ messages.workflow.nodeRecorder.autoSync }}
                  </span>
                </div>

                <div class="workflow-node-selector" role="tablist" :aria-label="messages.workflow.sections.nodes">
                  <button
                    v-for="node in workflowNodeSourceViews"
                    :key="node.id"
                    :class="{ active: node.id === selectedWorkflowNodeId, missing: node.status === 'missing' }"
                    type="button"
                    role="tab"
                    :aria-selected="node.id === selectedWorkflowNodeId ? 'true' : 'false'"
                    @click="selectedWorkflowNodeId = node.id"
                  >
                    <strong>{{ node.id }}</strong>
                    <span>{{ node.title }}</span>
                  </button>
                </div>

                <div v-if="selectedWorkflowNodeView?.status === 'missing'" class="workflow-alert workflow-alert--error">
                  <strong>{{ messages.workflow.nodeRecorder.missingSource }}</strong>
                  <span>{{ selectedWorkflowNodeView.protocolPath }}</span>
                </div>
                <AimdRecorderEditor
                  v-else-if="selectedWorkflowNodeSource"
                  :key="workflowNodeRecorderKey"
                  v-model="workflowNodeRecordData"
                  v-model:content="selectedWorkflowNodeContent"
                  :locale="selectedLocale"
                  :field-state="workflowNodeFieldRuntimeState"
                  :show-record-data="false"
                  :show-field-structure="false"
                  :show-visual-edit-toggle="false"
                  :initial-source-collapsed="true"
                  :fit-viewport="false"
                  :editor-min-height="420"
                  :recorder-min-height="420"
                  :editor-title="selectedWorkflowNodeSource.relativePath"
                  :recorder-title="messages.workflow.nodeRecorder.recorderTitle"
                  :record-data-title="messages.workflow.nodeRecorder.recordDataTitle"
                  :upload-file="uploadProtocolFile"
                  :resolve-file="resolveProtocolFile"
                  :resolve-file-info="resolveProtocolFileInfo"
                />
                <p v-else class="workflow-empty">{{ messages.workflow.emptyDefinition }}</p>
              </section>

              <div class="workflow-layout">
                <section class="workflow-panel">
                  <div class="workflow-panel__head">
                    <div>
                      <span>{{ messages.workflow.sections.nodes }}</span>
                      <strong>{{ workflowDefinition?.nodes.length ?? 0 }}</strong>
                    </div>
                  </div>
                  <div v-if="workflowDefinition?.nodes.length" class="workflow-node-list">
                    <div v-for="node in workflowDefinition.nodes" :key="node.id" class="workflow-node-row">
                      <div>
                        <strong>{{ node.id }}</strong>
                        <span>{{ node.title ?? node.description ?? node.protocol ?? node.protocol_id ?? node.id }}</span>
                      </div>
                      <code>{{ node.protocol ?? node.protocol_id ?? messages.common.none }}</code>
                      <span v-if="workflowNodeIterations[node.id] !== undefined" class="workflow-badge">
                        {{ workflowNodeIterations[node.id] }} {{ messages.workflow.labels.nodeRuns }}
                      </span>
                    </div>
                  </div>
                  <p v-else class="workflow-empty">{{ messages.workflow.emptyDefinition }}</p>
                </section>

                <section class="workflow-panel">
                  <div class="workflow-panel__head">
                    <div>
                      <span>{{ messages.workflow.sections.transitions }}</span>
                      <strong>{{ workflowTransitionViews.length }}</strong>
                    </div>
                  </div>
                  <div v-if="workflowTransitionViews.length" class="workflow-transition-list">
                    <article
                      v-for="item in workflowTransitionViews"
                      :key="item.transition.id"
                      :class="['workflow-transition-row', item.state]"
                    >
                      <div class="workflow-transition-row__top">
                        <strong>{{ item.transition.id }}</strong>
                        <span class="workflow-badge">{{ item.stateLabel }}</span>
                      </div>
                      <div class="workflow-route">
                        <span>{{ item.fromLabel }}</span>
                        <b>&rarr;</b>
                        <span>{{ item.toLabel }}</span>
                      </div>
                      <dl class="workflow-transition-facts">
                        <div>
                          <dt>{{ messages.workflow.labels.run }}</dt>
                          <dd>{{ item.runLabel }}</dd>
                        </div>
                        <div>
                          <dt>{{ messages.workflow.labels.when }}</dt>
                          <dd>{{ item.conditionLabel }}</dd>
                        </div>
                        <div>
                          <dt>{{ messages.workflow.labels.assignments }}</dt>
                          <dd>{{ item.assignCount }} / {{ item.targetCount }} {{ messages.workflow.labels.targets }}</dd>
                        </div>
                      </dl>
                      <div v-if="item.assignmentPreview.length > 0" class="workflow-assignment-preview">
                        <div v-for="assignment in item.assignmentPreview" :key="`${item.transition.id}-${assignment.target}-${assignment.path}`">
                          <code>{{ assignment.target }}.{{ assignment.path }}</code>
                          <span>{{ formatWorkflowValue(assignment.value) }}</span>
                        </div>
                      </div>
                    </article>
                  </div>
                  <p v-else class="workflow-empty">{{ messages.workflow.emptyDefinition }}</p>
                </section>
              </div>

              <div class="workflow-layout workflow-layout--result">
                <section class="workflow-panel workflow-panel--result">
                  <div class="workflow-panel__head">
                    <div>
                      <span>{{ messages.workflow.sections.result }}</span>
                      <strong>{{ workflowHasRunResult ? messages.workflow.status.available : messages.workflow.status.pending }}</strong>
                    </div>
                  </div>

                  <div v-if="!workflowHasRunResult" class="workflow-empty">
                    {{ messages.workflow.status.noResult }}
                  </div>
                  <div v-else class="workflow-result-stack">
                    <div class="workflow-result-group workflow-result-group--wide">
                      <span>
                        {{ messages.workflow.sections.pathSteps }}
                        <small>{{ messages.workflow.labels.pathStatus }}: {{ workflowPathStatus }}</small>
                      </span>
                      <div v-if="workflowPathStepViews.length > 0" class="workflow-path-step-list">
                        <div v-for="step in workflowPathStepViews" :key="step.key" class="workflow-path-step-row">
                          <strong>{{ step.pathIndex }}. {{ step.title }}</strong>
                          <span>{{ step.detail }}</span>
                          <code v-if="step.valueSummary">{{ step.valueSummary }}</code>
                        </div>
                      </div>
                      <span v-else class="workflow-empty-inline">{{ messages.workflow.status.none }}</span>
                    </div>

                    <div class="workflow-result-group">
                      <span>{{ messages.workflow.sections.executed }}</span>
                      <div class="workflow-chip-row">
                        <span v-for="transition in workflowExecutedTransitions" :key="transition.id" class="workflow-chip success">
                          {{ transition.id }}
                        </span>
                        <span v-if="workflowExecutedTransitions.length === 0" class="workflow-empty-inline">
                          {{ messages.workflow.status.none }}
                        </span>
                      </div>
                    </div>

                    <div class="workflow-result-group">
                      <span>{{ messages.workflow.sections.skipped }}</span>
                      <div class="workflow-chip-row">
                        <span v-for="transition in workflowSkippedTransitions" :key="transition.id" class="workflow-chip muted">
                          {{ transition.id }}{{ transition.reason ? ` / ${transition.reason}` : '' }}
                        </span>
                        <span v-if="workflowSkippedTransitions.length === 0" class="workflow-empty-inline">
                          {{ messages.workflow.status.none }}
                        </span>
                      </div>
                    </div>

                    <div v-if="workflowAttempts.length > 0" class="workflow-result-group">
                      <span>{{ messages.workflow.sections.attempts }}</span>
                      <div class="workflow-attempt-list">
                        <div v-for="attempt in workflowAttempts" :key="`${attempt.transition}-${attempt.assigner}`" class="workflow-attempt-row">
                          <div>
                            <strong>{{ attempt.assigner }}</strong>
                            <span>{{ attempt.transition }} / {{ attempt.runtime }} / {{ attempt.status }}</span>
                          </div>
                          <div v-if="workflowOutputEntries(attempt.outputs).length > 0" class="workflow-output-list">
                            <span v-for="entry in workflowOutputEntries(attempt.outputs)" :key="entry.key">
                              <code>{{ entry.key }}</code>{{ formatWorkflowValue(entry.value) }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div v-if="workflowNodeIterationRows.length > 0" class="workflow-result-group">
                      <span>{{ messages.workflow.sections.nodeRuns }}</span>
                      <div class="workflow-chip-row">
                        <span v-for="row in workflowNodeIterationRows" :key="row.node" class="workflow-chip">
                          {{ row.node }}: {{ row.count }}
                        </span>
                      </div>
                    </div>

                    <div class="workflow-result-group">
                      <span>{{ messages.workflow.sections.records }}</span>
                      <div class="workflow-record-values">
                        <div v-for="row in workflowRecordHighlights" :key="row.key" :class="{ changed: row.changed }">
                          <code>{{ row.node }}.{{ row.path }}</code>
                          <span>{{ formatWorkflowValue(row.value) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

              </div>

              <details class="workflow-raw-result workflow-raw-records">
                <summary>{{ messages.workflow.sections.advancedRecords }}</summary>
                <label class="env-editor">
                  <span>{{ messages.engine.labels.workflowRecords }}</span>
                  <textarea v-model="workflowRecordsJson" spellcheck="false"></textarea>
                </label>
              </details>

              <details class="workflow-raw-result">
                <summary>{{ messages.workflow.sections.rawResult }}</summary>
                <pre class="json-view"><code>{{ JSON.stringify(lastEngineResult, null, 2) }}</code></pre>
              </details>
            </section>
          </template>
          <template v-else>
            <div class="record-toolbar">
              <span :class="['source-draft-state', { active: hasSourceDraftChanges }]">
                {{ hasSourceDraftChanges ? messages.source.draftActive : messages.source.draftHint }}
              </span>
              <div class="record-toolbar__actions">
                <button
                  type="button"
                  :disabled="!hasSourceDraftChanges"
                  @click="resetProtocolState(true)"
                >
                  {{ messages.source.resetDraft }}
                </button>
                <button type="button" @click="resetProtocolState">{{ messages.record.reset }}</button>
                <button type="button" :disabled="engineBusy" @click="runValidate">
                  {{ messages.record.validateVars }}
                </button>
              </div>
            </div>
            <AimdRecorderEditor
              :key="recorderKey"
              v-model="recordData"
              v-model:content="recordSourceContent"
              :locale="selectedLocale"
              :server-assigners="protocolAssigners"
              :field-state="fieldState"
              :show-record-data="true"
              :show-field-structure="false"
              :show-visual-edit-toggle="false"
              :fit-viewport="true"
              :editor-min-height="520"
              :recorder-min-height="520"
              editor-title="protocol.aimd"
              :recorder-title="messages.record.recorderTitle"
              :record-data-title="messages.record.recordDataTitle"
              :upload-file="uploadProtocolFile"
              :resolve-file="resolveProtocolFile"
              :resolve-file-info="resolveProtocolFileInfo"
              :run-server-assigner="runProtocolAssigner"
            />
          </template>
        </section>

        <section v-else-if="activeTab === 'source'" class="source-panel">
          <div class="source-toolbar">
            <span :class="['source-draft-state', { active: hasSourceDraftChanges }]">
              {{ hasSourceDraftChanges ? messages.source.draftActive : messages.source.draftHint }}
            </span>
            <button
              type="button"
              :disabled="!hasSourceDraftChanges"
              @click="resetProtocolState(true)"
            >
              {{ messages.source.resetDraft }}
            </button>
          </div>
          <ProtocolSourceBrowser
            v-model="selectedSourcePath"
            :files="sourceFiles"
            :labels="messages.source"
            :root-label="sourceRootLabel"
            @content-change="handleSourceContentChange"
          />
        </section>

        <section v-else-if="activeTab === 'graph'" class="graph-panel">
          <AimdAssignerGraph
            :assigner-graph="protocolAssignerGraph"
            :node-schema-map="assignerGraphNodeSchemaMap"
            :loading="assignerGraphLoading"
            :labels="assignerGraphLabels"
            height="640px"
          />
        </section>

        <section v-else class="engine-panel">
          <div class="engine-controls">
            <div class="engine-control-group">
              <template v-if="isWorkflowExample">
                <button type="button" :disabled="engineBusy" @click="runWorkflow">
                  {{ messages.engine.actions.workflow }}
                </button>
              </template>
              <template v-else>
                <button type="button" :disabled="engineBusy" @click="runParse">
                  {{ messages.engine.actions.parse }}
                </button>
                <button type="button" :disabled="engineBusy" @click="runValidate">
                  {{ messages.engine.actions.validate }}
                </button>
                <button type="button" :disabled="engineBusy || !assignerTarget.trim()" @click="runAssign()">
                  {{ messages.engine.actions.assign }}
                </button>
              </template>
            </div>

            <div class="engine-form-grid">
              <label v-if="!isWorkflowExample">
                <span>{{ messages.engine.labels.assignerTarget }}</span>
                <select v-if="parseAssigners.length > 0" v-model="assignerTarget">
                  <option v-for="name in parseAssigners" :key="name" :value="name">
                    {{ name }}
                  </option>
                </select>
                <input v-else v-model="assignerTarget" :placeholder="messages.common.varFieldName" />
              </label>
              <label>
                <span>{{ messages.engine.labels.sandboxMode }}</span>
                <select v-model="sandboxMode">
                  <option value="auto">{{ messages.engine.modes.auto }}</option>
                  <option value="rootfs">{{ messages.engine.modes.rootfs }}</option>
                  <option value="image">{{ messages.engine.modes.image }}</option>
                </select>
              </label>
              <label>
                <span>{{ messages.engine.labels.timeout }}</span>
                <input v-model.number="sandboxTimeout" min="1" max="600" type="number" />
              </label>
              <label v-if="isWorkflowExample">
                <span>{{ messages.engine.labels.assignerRuntime }}</span>
                <select v-model="workflowAssignerRuntime">
                  <option value="sandbox">{{ messages.engine.assignerRuntimes.sandbox }}</option>
                  <option value="local">{{ messages.engine.assignerRuntimes.local }}</option>
                </select>
              </label>
              <label v-if="isWorkflowExample">
                <span>{{ messages.engine.labels.maxPasses }}</span>
                <input v-model.number="workflowMaxPasses" min="1" max="50" type="number" />
              </label>
              <label>
                <span>{{ messages.engine.labels.rootfsPath }}</span>
                <input v-model="sandboxRootfsPath" :placeholder="messages.common.optional" />
              </label>
              <label>
                <span>{{ messages.engine.labels.image }}</span>
                <input v-model="sandboxImage" placeholder="numbcoder/airalogy-engine:0.1" />
              </label>
            </div>

            <label v-if="isWorkflowExample" class="env-editor">
              <span>{{ messages.engine.labels.transitionIds }}</span>
              <textarea v-model="workflowTransitionIdsJson" spellcheck="false"></textarea>
            </label>
            <details v-if="isWorkflowExample" class="workflow-raw-result workflow-raw-records">
              <summary>{{ messages.workflow.sections.advancedRecords }}</summary>
              <label class="env-editor">
                <span>{{ messages.engine.labels.workflowRecords }}</span>
                <textarea v-model="workflowRecordsJson" spellcheck="false"></textarea>
              </label>
            </details>
            <label class="env-editor">
              <span>{{ messages.engine.labels.envVarsJson }}</span>
              <textarea v-model="envVarsJson" spellcheck="false"></textarea>
            </label>
          </div>

          <div class="engine-output-grid">
            <section>
              <div class="panel-head">
                <span>{{ currentRuntimeInputLabel }}</span>
              </div>
              <pre class="json-view"><code>{{ currentRuntimeInputJson }}</code></pre>
            </section>
            <section>
              <div class="panel-head">
                <span>{{ messages.engine.labels.engineResult }}</span>
                <span>{{ engineStatus }}</span>
              </div>
              <pre class="json-view"><code>{{ JSON.stringify(lastEngineResult, null, 2) }}</code></pre>
            </section>
          </div>
        </section>
      </section>
    </main>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

.app-shell {
  display: flex;
  height: 100vh;
  height: 100dvh;
  min-height: 100vh;
  flex-direction: column;
  overflow: hidden;
  background: #f4f6f8;
  color: #1f2933;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.topbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px clamp(18px, 3vw, 34px);
  border-bottom: 1px solid #d9e2ec;
  background: #ffffff;
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.brand-logo {
  display: block;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
}

.brand-copy {
  display: flex;
  align-items: baseline;
  gap: 14px;
  min-width: 0;
}

.brand-block h1 {
  margin: 0;
  color: #102a43;
  font-size: 22px;
  font-weight: 760;
  letter-spacing: 0;
  white-space: nowrap;
}

.brand-subtitle {
  overflow: hidden;
  color: #52606d;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-controls {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.ui-locale-select {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #627d98;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.ui-locale-select select {
  width: auto;
  min-width: 96px;
}

.runtime-block {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid #bcccdc;
  border-radius: 8px;
  background: #f8fafc;
  color: #334e68;
  font-size: 13px;
  font-weight: 650;
  white-space: nowrap;
}

.runtime-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #d64545;
}

.runtime-dot.ok {
  background: #0e9f6e;
}

.loading-view {
  display: grid;
  flex: 1 1 auto;
  min-height: 0;
  place-items: center;
  color: #486581;
  font-size: 14px;
}

.error-view {
  color: #b42318;
}

.workspace {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 0;
  min-height: 0;
  overflow: hidden;
}

.protocol-list {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
  padding: 18px;
  border-right: 1px solid #d9e2ec;
  background: #edf2f7;
}

.section-label,
.eyebrow,
.meta-label,
.locale-select span,
.engine-form-grid span,
.env-editor span,
.workflow-run-box span {
  color: #627d98;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.protocol-option {
  position: relative;
  display: block;
  flex: 0 0 auto;
  width: 100%;
  min-height: 70px;
  padding: 12px 13px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #243b53;
  text-align: left;
  white-space: normal;
}

.protocol-option:hover,
.protocol-option:focus-within {
  border-color: #9fb3c8;
  background: #ffffff;
}

.protocol-option.active {
  border-color: #2f855a;
  background: #ffffff;
}

.protocol-option__hitbox {
  position: absolute;
  inset: 0;
  z-index: 2;
  appearance: none;
  border: 0;
  border-radius: inherit;
  background: transparent;
  cursor: pointer;
}

.protocol-option__hitbox:focus-visible {
  outline: 2px solid rgba(47, 133, 90, 0.32);
  outline-offset: 2px;
}

.protocol-option__name {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 14px;
  font-weight: 750;
  line-height: 1.35;
  white-space: normal;
  word-break: break-word;
}

.protocol-option__meta {
  display: block;
  margin-top: 8px;
  min-width: 0;
  color: #627d98;
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
  white-space: normal;
  word-break: break-word;
}

.protocol-workbench {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
  padding: 20px clamp(16px, 2.6vw, 32px) 28px;
}

.protocol-header {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.protocol-header h2 {
  margin: 5px 0 7px;
  color: #102a43;
  font-size: 26px;
  font-weight: 760;
  letter-spacing: 0;
}

.protocol-header p {
  max-width: 840px;
  margin: 0;
  color: #486581;
  font-size: 14px;
  line-height: 1.55;
}

.locale-select,
.engine-form-grid label,
.env-editor {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

select,
input,
textarea {
  width: 100%;
  border: 1px solid #bcccdc;
  border-radius: 6px;
  background: #ffffff;
  color: #102a43;
  font: inherit;
}

select,
input {
  min-height: 36px;
  padding: 0 10px;
}

textarea {
  min-height: 118px;
  padding: 10px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 1.45;
  resize: vertical;
}

.metadata-row {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.metadata-row > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #ffffff;
}

.meta-value {
  overflow: hidden;
  color: #243b53;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tabbar,
.engine-control-group,
.record-toolbar,
.source-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tabbar {
  flex: 0 0 auto;
  border-bottom: 1px solid #d9e2ec;
}

.tabbar button,
.engine-control-group button,
.record-toolbar button,
.source-toolbar button,
.workflow-run-box button,
.workflow-node-selector button {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid #bcccdc;
  border-radius: 7px;
  background: #ffffff;
  color: #334e68;
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
}

.tabbar button {
  margin-bottom: -1px;
  border-bottom-color: transparent;
  border-radius: 7px 7px 0 0;
}

.tabbar button.active {
  border-color: #2f855a;
  background: #e6f4ea;
  color: #276749;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.record-panel,
.source-panel,
.graph-panel,
.engine-panel {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.record-toolbar {
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.record-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
}

.source-toolbar {
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
}

.source-draft-state {
  color: #627d98;
  font-size: 12px;
  font-weight: 650;
}

.source-draft-state.active {
  color: #276749;
}

.record-panel,
.source-panel,
.graph-panel,
.engine-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.record-panel,
.graph-panel,
.engine-panel {
  overflow: auto;
}

.source-panel {
  overflow: hidden;
}

.source-panel :deep(.protocol-source-browser) {
  flex: 1 1 auto;
  min-height: 0;
}

.json-view {
  overflow: auto;
  min-height: 360px;
  max-height: 65vh;
  margin: 0;
  padding: 14px;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #111827;
  color: #dbeafe;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.engine-controls {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #ffffff;
}

.engine-form-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.engine-output-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 12px;
}

.workflow-record-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: 12px;
  min-height: 0;
}

.engine-output-grid section {
  min-width: 0;
}

.workflow-record-grid section {
  min-width: 0;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 32px;
  color: #486581;
  font-size: 12px;
  font-weight: 700;
}

.workflow-dashboard {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workflow-alert {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid #f5c2c7;
  border-radius: 8px;
  background: #fff1f2;
  color: #9f1239;
  font-size: 13px;
}

.workflow-overview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
  gap: 14px;
  align-items: stretch;
}

.workflow-overview__copy,
.workflow-run-box,
.workflow-panel,
.workflow-run-status,
.workflow-metric {
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #ffffff;
}

.workflow-overview__copy {
  min-width: 0;
  padding: 16px;
}

.workflow-overview__copy h3 {
  margin: 5px 0 8px;
  color: #102a43;
  font-size: 22px;
  font-weight: 760;
  letter-spacing: 0;
}

.workflow-overview__copy p {
  max-width: 860px;
  margin: 0;
  color: #486581;
  font-size: 14px;
  line-height: 1.55;
}

.workflow-run-box {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 92px;
  gap: 10px;
  align-content: start;
  padding: 14px;
}

.workflow-run-box label {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.workflow-run-box .primary-action {
  grid-column: 1 / -1;
}

.primary-action {
  min-height: 38px;
  border-color: #276749;
  background: #276749;
  color: #ffffff;
}

.workflow-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.workflow-metric {
  display: flex;
  min-width: 0;
  min-height: 82px;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 12px;
}

.workflow-metric span,
.workflow-panel__head span,
.workflow-result-group > span {
  color: #627d98;
  font-size: 11px;
  font-weight: 760;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.workflow-metric strong {
  color: #102a43;
  font-size: 24px;
  font-weight: 760;
  line-height: 1;
}

.workflow-metric small {
  overflow: hidden;
  color: #486581;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-run-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  color: #334e68;
  font-size: 13px;
}

.workflow-run-status span {
  color: #627d98;
  font-weight: 760;
}

.workflow-run-status strong {
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: right;
}

.workflow-run-status.success {
  border-color: #8fcb9b;
  background: #f0fff4;
  color: #276749;
}

.workflow-run-status.failed {
  border-color: #f5c2c7;
  background: #fff1f2;
  color: #9f1239;
}

.workflow-node-recorder {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #ffffff;
}

.workflow-node-recorder__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.workflow-node-recorder__head > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.workflow-node-recorder__head span:first-child,
.workflow-node-recorder__sync {
  color: #627d98;
  font-size: 11px;
  font-weight: 760;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.workflow-node-recorder__head strong {
  color: #102a43;
  font-size: 16px;
}

.workflow-node-recorder__sync {
  max-width: 360px;
  text-align: right;
}

.workflow-node-selector {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.workflow-node-selector button {
  display: flex;
  min-height: 58px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 3px;
  background: #f8fafc;
  text-align: left;
}

.workflow-node-selector button.active {
  border-color: #2f855a;
  background: #e6f4ea;
  color: #276749;
}

.workflow-node-selector button.missing {
  border-color: #f5c2c7;
}

.workflow-node-selector button strong {
  max-width: 100%;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
}

.workflow-node-selector button span {
  max-width: 100%;
  overflow: hidden;
  color: #627d98;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workflow-node-recorder :deep(.aimd-recorder-editor) {
  min-height: 0;
}

.workflow-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
  gap: 12px;
  align-items: start;
}

.workflow-layout--result {
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
}

.workflow-panel {
  min-width: 0;
  overflow: hidden;
}

.workflow-panel__head {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid #d9e2ec;
}

.workflow-panel__head > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.workflow-panel__head strong {
  color: #102a43;
  font-size: 14px;
}

.workflow-node-list,
.workflow-transition-list,
.workflow-result-stack {
  display: flex;
  flex-direction: column;
}

.workflow-node-row,
.workflow-transition-row,
.workflow-attempt-row {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 9px;
  padding: 13px 14px;
  border-bottom: 1px solid #e6edf5;
}

.workflow-node-row:last-child,
.workflow-transition-row:last-child,
.workflow-attempt-row:last-child {
  border-bottom: 0;
}

.workflow-node-row > div,
.workflow-transition-row__top,
.workflow-attempt-row > div:first-child {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.workflow-node-row strong,
.workflow-transition-row strong,
.workflow-attempt-row strong {
  color: #102a43;
  font-size: 13px;
}

.workflow-node-row span,
.workflow-attempt-row span {
  min-width: 0;
  color: #52606d;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.workflow-node-row code,
.workflow-assignment-preview code,
.workflow-record-values code,
.workflow-output-list code {
  color: #334e68;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 12px;
}

.workflow-badge,
.workflow-chip {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  max-width: 100%;
  padding: 0 8px;
  border: 1px solid #bcccdc;
  border-radius: 999px;
  background: #f8fafc;
  color: #334e68;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.workflow-transition-row.executed {
  border-left: 3px solid #2f855a;
}

.workflow-transition-row.skipped {
  border-left: 3px solid #9fb3c8;
}

.workflow-route {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  color: #334e68;
  font-size: 13px;
}

.workflow-route span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.workflow-route b {
  color: #627d98;
}

.workflow-transition-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.workflow-transition-facts div {
  min-width: 0;
}

.workflow-transition-facts dt {
  margin: 0 0 3px;
  color: #829ab1;
  font-size: 11px;
  font-weight: 700;
}

.workflow-transition-facts dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
  color: #243b53;
  font-size: 12px;
}

.workflow-assignment-preview,
.workflow-output-list,
.workflow-record-values {
  display: grid;
  gap: 6px;
}

.workflow-assignment-preview div,
.workflow-record-values div,
.workflow-output-list span {
  display: grid;
  grid-template-columns: minmax(140px, 0.45fr) minmax(0, 1fr);
  gap: 8px;
  min-width: 0;
  padding: 7px 8px;
  border-radius: 6px;
  background: #f8fafc;
  color: #334e68;
  font-size: 12px;
}

.workflow-record-values div.changed {
  background: #f0fff4;
}

.workflow-result-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 13px 14px;
  border-bottom: 1px solid #e6edf5;
}

.workflow-result-group:last-child {
  border-bottom: 0;
}

.workflow-result-group > span:first-child {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  color: #627d98;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.workflow-result-group > span:first-child small {
  color: #829ab1;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
}

.workflow-path-step-list {
  display: grid;
  gap: 7px;
}

.workflow-path-step-row {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid #d9e2ec;
  border-radius: 6px;
  background: #f8fafc;
}

.workflow-path-step-row strong {
  color: #102a43;
  font-size: 13px;
}

.workflow-path-step-row span,
.workflow-path-step-row code {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #52606d;
  font-size: 12px;
}

.workflow-path-step-row code {
  color: #334e68;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}

.workflow-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.workflow-chip.success {
  border-color: #8fcb9b;
  background: #f0fff4;
  color: #276749;
}

.workflow-chip.muted {
  color: #52606d;
}

.workflow-empty,
.workflow-empty-inline {
  color: #627d98;
  font-size: 13px;
}

.workflow-empty {
  margin: 0;
  padding: 16px 14px;
}

.workflow-panel--editor textarea {
  min-height: 430px;
  border: 0;
  border-radius: 0;
  border-top: 1px solid #eef2f7;
}

.workflow-raw-result {
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #ffffff;
}

.workflow-raw-result summary {
  min-height: 42px;
  padding: 12px 14px;
  color: #334e68;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
}

.workflow-raw-result .json-view {
  border-right: 0;
  border-bottom: 0;
  border-left: 0;
  border-radius: 0 0 8px 8px;
}

.workflow-raw-records .env-editor {
  padding: 0 14px 14px;
}

.workflow-raw-records textarea {
  min-height: 220px;
  border-radius: 6px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 1.5;
}

.json-view {
  min-height: 280px;
  max-height: 50vh;
  background: #1f2933;
  color: #e6fffa;
}

@media (max-width: 1100px) {
  .app-shell {
    height: auto;
    overflow: visible;
  }

  .workspace {
    grid-template-columns: 1fr;
    overflow: visible;
  }

  .protocol-list {
    display: grid;
    align-items: start;
    overflow: visible;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-right: none;
    border-bottom: 1px solid #d9e2ec;
  }

  .protocol-workbench,
  .source-panel {
    overflow: visible;
  }

  .section-label {
    grid-column: 1 / -1;
  }

  .engine-form-grid,
  .metadata-row,
  .engine-output-grid,
  .workflow-record-grid,
  .workflow-overview,
  .workflow-layout {
    grid-template-columns: 1fr;
  }

  .workflow-layout--result {
    grid-template-columns: 1fr;
  }

  .workflow-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .workflow-node-selector {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .topbar,
  .topbar-controls,
  .protocol-header {
    align-items: stretch;
    flex-direction: column;
  }

  .brand-copy {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }

  .ui-locale-select,
  .runtime-block {
    justify-content: space-between;
  }

  .brand-subtitle {
    white-space: normal;
  }

  .protocol-list {
    grid-template-columns: 1fr;
  }

  .workflow-metrics,
  .workflow-run-box,
  .workflow-node-selector,
  .workflow-transition-facts,
  .workflow-assignment-preview div,
  .workflow-record-values div,
  .workflow-output-list span {
    grid-template-columns: 1fr;
  }

  .workflow-run-status,
  .workflow-node-recorder__head,
  .workflow-node-row > div,
  .workflow-transition-row__top,
  .workflow-attempt-row > div:first-child {
    align-items: flex-start;
    flex-direction: column;
  }

  .workflow-node-recorder__sync {
    max-width: none;
    text-align: left;
  }
}
</style>
