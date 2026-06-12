<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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
type EngineAction = 'parse' | 'assign' | 'validate'
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
  sampleData: Array<{
    path: string
    content: string | null
  }>
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

const fieldState = computed(() => {
  return fieldRuntimeState.value
})

function formatMessage(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))
}

function runtimeKindLabel(engineRequired?: boolean) {
  return engineRequired ? messages.value.runtime.engine : messages.value.runtime.static
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
  engineStatusState.value = { type: 'idle' }
  lastEngineResult.value = null
  parseResult.value = null
  assignerTarget.value = ''
  recorderKey.value += 1
}

function resetEngineExecutionState() {
  fieldRuntimeState.value = {}
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
  if (message === 'No protocol selected') return errors.noProtocolSelected
  if (message.startsWith('Unknown protocol example')) return errors.unknownProtocol
  if (message.includes('does not provide locale')) return errors.unsupportedLocale
  if (message.includes('has no protocol directory')) return errors.missingProtocolDir
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
  if (!selectedProtocol.value?.engine_required || !engineAvailable.value) {
    return
  }

  try {
    await runParse()
  } catch {
    // The Engine panel keeps the localized status/error for the user.
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
            <span class="meta-label">{{ messages.common.assigner }}</span>
            <span class="meta-value">{{ selectedVariant?.assignerPath ?? messages.common.none }}</span>
          </div>
          <div>
            <span class="meta-label">{{ messages.common.sampleFiles }}</span>
            <span class="meta-value">{{ selectedVariant?.sampleData.length ?? 0 }}</span>
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
              <button type="button" :disabled="engineBusy" @click="runParse">
                {{ messages.engine.actions.parse }}
              </button>
              <button type="button" :disabled="engineBusy" @click="runValidate">
                {{ messages.engine.actions.validate }}
              </button>
              <button type="button" :disabled="engineBusy || !assignerTarget.trim()" @click="runAssign()">
                {{ messages.engine.actions.assign }}
              </button>
            </div>

            <div class="engine-form-grid">
              <label>
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
              <label>
                <span>{{ messages.engine.labels.rootfsPath }}</span>
                <input v-model="sandboxRootfsPath" :placeholder="messages.common.optional" />
              </label>
              <label>
                <span>{{ messages.engine.labels.image }}</span>
                <input v-model="sandboxImage" placeholder="numbcoder/airalogy-engine:0.1" />
              </label>
            </div>

            <label class="env-editor">
              <span>{{ messages.engine.labels.envVarsJson }}</span>
              <textarea v-model="envVarsJson" spellcheck="false"></textarea>
            </label>
          </div>

          <div class="engine-output-grid">
            <section>
              <div class="panel-head">
                <span>{{ messages.engine.labels.currentVars }}</span>
              </div>
              <pre class="json-view"><code>{{ currentVarsJson }}</code></pre>
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
.env-editor span {
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
.source-toolbar button {
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

.engine-output-grid section {
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
  .engine-output-grid {
    grid-template-columns: 1fr;
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
}
</style>
