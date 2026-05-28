<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  AimdRecorderEditor,
  createEmptyProtocolRecordData,
  type AimdFieldState,
  type AimdProtocolRecordData,
  type FieldEventPayload,
} from '@airalogy/aimd-recorder'
import {
  normalizeDemoLocale,
  useDemoLocale,
  useDemoMessages,
} from './composables/demoI18n'
import '@airalogy/aimd-recorder/styles'

type LocaleMap<T> = Record<string, T | undefined>
type EngineAction = 'parse' | 'assign' | 'validate'
type EngineStatusState =
  | { type: 'idle' }
  | { type: 'running' | 'complete', action: EngineAction }
  | { type: 'selectAssignerTarget' }
  | { type: 'message', message: string }

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
  languages: string[]
  title: LocaleMap<string>
  description: LocaleMap<string>
  engine_required: boolean
  tags: string[]
  variants: Record<string, ProtocolVariant>
}

interface ProtocolRegistry {
  protocol_root: string
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
const activeTab = ref<'record' | 'source' | 'engine'>('record')
const activeSourceTab = ref<'aimd' | 'toml' | 'assigner' | 'sample'>('aimd')
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

const sourceTabs = computed(() => {
  const tabs: Array<{ key: 'aimd' | 'toml' | 'assigner' | 'sample', label: string }> = [
    { key: 'aimd', label: 'protocol.aimd' },
    { key: 'toml', label: 'protocol.toml' },
  ]

  if (selectedVariant.value?.assigner) {
    tabs.push({ key: 'assigner', label: 'assigner.py' })
  }
  if ((selectedVariant.value?.sampleData.length ?? 0) > 0) {
    tabs.push({ key: 'sample', label: messages.value.sourceTabs.sampleData })
  }

  return tabs
})

const activeSourceContent = computed(() => {
  const variant = selectedVariant.value
  if (!variant) return ''

  if (activeSourceTab.value === 'toml') return variant.toml ?? ''
  if (activeSourceTab.value === 'assigner') return variant.assigner ?? ''
  if (activeSourceTab.value === 'sample') {
    return variant.sampleData
      .map((sample) => [`# ${sample.path}`, sample.content ?? ''].join('\n'))
      .join('\n\n')
  }

  return variant.aimd ?? ''
})

const activeSourcePath = computed(() => {
  const variant = selectedVariant.value
  if (!variant) return ''
  if (activeSourceTab.value === 'toml') return variant.tomlPath ?? ''
  if (activeSourceTab.value === 'assigner') return variant.assignerPath ?? ''
  if (activeSourceTab.value === 'sample') return variant.sampleData.map((sample) => sample.path).join(', ')
  return variant.aimdPath ?? ''
})

const parseAssigners = computed(() => {
  const data = parseResult.value?.data
  if (!data || typeof data !== 'object') return []
  const assigners = (data as Record<string, unknown>).assigners
  if (!assigners || typeof assigners !== 'object' || Array.isArray(assigners)) return []
  return Object.keys(assigners)
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

const fieldState = computed(() => fieldRuntimeState.value)

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

function protocolLocaleLabel(locale: string) {
  const normalized = normalizeDemoLocale(locale)
  return `${messages.value.app.localeNames[normalized]} (${locale})`
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

function resetProtocolState() {
  const variant = selectedVariant.value
  sourceContent.value = variant?.aimd ?? ''
  recordData.value = createEmptyProtocolRecordData()
  fieldRuntimeState.value = {}
  engineStatusState.value = { type: 'idle' }
  lastEngineResult.value = null
  parseResult.value = null
  activeSourceTab.value = 'aimd'
  recorderKey.value += 1
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

function applyAssignedFields(result: unknown) {
  if (!result || typeof result !== 'object') {
    return
  }

  const data = (result as Record<string, unknown>).data
  if (!data || typeof data !== 'object') {
    return
  }

  const assignedFields = (data as Record<string, unknown>).assigned_fields
  if (!assignedFields || typeof assignedFields !== 'object' || Array.isArray(assignedFields)) {
    return
  }

  recordData.value = {
    ...recordData.value,
    var: {
      ...recordData.value.var,
      ...(assignedFields as Record<string, unknown>),
    },
  }
}

async function runAssign(target = assignerTarget.value) {
  if (!target.trim()) {
    engineStatusState.value = { type: 'selectAssignerTarget' }
    return
  }

  const fieldKey = target.trim()
  fieldRuntimeState.value = {
    ...fieldRuntimeState.value,
    [fieldKey]: { ...fieldRuntimeState.value[fieldKey], loading: true, error: undefined },
  }

  try {
    const result = await runEngineAction<unknown>('assign', () => (
      postEngine('assign', {
        varName: fieldKey,
        dependentData: recordData.value.var,
      })
    ))
    applyAssignedFields(result)
    fieldRuntimeState.value = {
      ...fieldRuntimeState.value,
      [fieldKey]: { ...fieldRuntimeState.value[fieldKey], loading: false, error: undefined },
    }
  } catch (err) {
    const message = err instanceof Error ? localizeErrorMessage(err.message) : String(err)
    fieldRuntimeState.value = {
      ...fieldRuntimeState.value,
      [fieldKey]: { ...fieldRuntimeState.value[fieldKey], loading: false, error: message },
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
      nextState[fieldKey] = {
        ...nextState[fieldKey],
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

function handleAssignerRequest(payload: FieldEventPayload) {
  if (payload.section !== 'var') {
    return
  }

  assignerTarget.value = payload.fieldKey
  activeTab.value = 'engine'
  void runAssign(payload.fieldKey)
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
        <h1>{{ messages.app.title }}</h1>
        <span class="brand-subtitle">{{ messages.app.subtitle }}</span>
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
        <button
          v-for="protocol in protocols"
          :key="protocol.id"
          :class="['protocol-option', { active: protocol.id === selectedProtocolId }]"
          type="button"
          @click="selectedProtocolId = protocol.id"
        >
          <span class="protocol-option__name">
            {{ protocol.title[selectedLocale] ?? protocol.title['en-US'] ?? protocol.id }}
          </span>
          <span class="protocol-option__meta">
            {{ protocol.id }} / {{ runtimeKindLabel(protocol.engine_required) }}
          </span>
        </button>
      </aside>

      <section class="protocol-workbench">
        <div class="protocol-header">
          <div>
            <div class="eyebrow">{{ categoryLabel(selectedProtocol?.category) }} / {{ runtimeLabel }}</div>
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
            :class="{ active: activeTab === 'engine' }"
            type="button"
            @click="activeTab = 'engine'"
          >
            {{ messages.tabs.engine }}
          </button>
        </nav>

        <section v-if="activeTab === 'record'" class="record-panel">
          <div class="record-toolbar">
            <button type="button" @click="resetProtocolState">{{ messages.record.reset }}</button>
            <button type="button" :disabled="engineBusy" @click="runValidate">
              {{ messages.record.validateVars }}
            </button>
          </div>
          <AimdRecorderEditor
            :key="recorderKey"
            v-model="recordData"
            v-model:content="sourceContent"
            :locale="selectedLocale"
            :field-state="fieldState"
            :show-record-data="true"
            :show-field-structure="false"
            :show-visual-edit-toggle="false"
            :fit-viewport="false"
            :editor-min-height="520"
            :recorder-min-height="520"
            :editor-props="{ readonly: true }"
            editor-title="protocol.aimd"
            :recorder-title="messages.record.recorderTitle"
            :record-data-title="messages.record.recordDataTitle"
            @assigner-request="handleAssignerRequest"
          />
        </section>

        <section v-else-if="activeTab === 'source'" class="source-panel">
          <div class="source-tabs">
            <button
              v-for="tab in sourceTabs"
              :key="tab.key"
              :class="{ active: activeSourceTab === tab.key }"
              type="button"
              @click="activeSourceTab = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>
          <div class="source-path">{{ activeSourcePath }}</div>
          <pre class="code-view"><code>{{ activeSourceContent }}</code></pre>
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
  min-height: 100vh;
  background: #f4f6f8;
  color: #1f2933;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px clamp(18px, 3vw, 34px);
  border-bottom: 1px solid #d9e2ec;
  background: #ffffff;
}

.brand-block {
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
  min-height: calc(100vh - 72px);
  place-items: center;
  color: #486581;
  font-size: 14px;
}

.error-view {
  color: #b42318;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 0;
  min-height: calc(100vh - 72px);
}

.protocol-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  display: flex;
  min-height: 70px;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #243b53;
  cursor: pointer;
  text-align: left;
}

.protocol-option:hover {
  border-color: #9fb3c8;
  background: #ffffff;
}

.protocol-option.active {
  border-color: #2f855a;
  background: #ffffff;
}

.protocol-option__name {
  font-size: 14px;
  font-weight: 750;
}

.protocol-option__meta {
  color: #627d98;
  font-size: 12px;
}

.protocol-workbench {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
  padding: 20px clamp(16px, 2.6vw, 32px) 28px;
}

.protocol-header {
  display: flex;
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
.source-tabs,
.engine-control-group,
.record-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tabbar {
  border-bottom: 1px solid #d9e2ec;
}

.tabbar button,
.source-tabs button,
.engine-control-group button,
.record-toolbar button {
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

.tabbar button.active,
.source-tabs button.active {
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
.engine-panel {
  min-width: 0;
}

.record-toolbar {
  justify-content: flex-end;
  margin-bottom: 12px;
}

.source-panel,
.engine-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.source-path {
  overflow: hidden;
  color: #627d98;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.code-view,
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
  .workspace {
    grid-template-columns: 1fr;
  }

  .protocol-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-right: none;
    border-bottom: 1px solid #d9e2ec;
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
  .brand-block,
  .topbar-controls,
  .protocol-header {
    align-items: stretch;
    flex-direction: column;
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
