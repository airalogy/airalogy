<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onBeforeUnmount, reactive, ref, watch, type PropType, type VNode, type VNodeChild } from "vue"
import type {
  AimdCheckNode,
  AimdClientAssignerField,
  AimdCollectorValidationContext,
  AimdQuizField,
  AimdQuizGradeResult,
  AimdQuizNode,
  AimdStepNode,
  AimdVarNode,
  AimdVarTableNode,
  ExtractedAimdFields,
} from "@airalogy/aimd-core/types"
import { getAimdFieldEnumValues } from "@airalogy/aimd-core/utils"
import { parseAndExtract, renderToVue } from "@airalogy/aimd-renderer"
import type { AimdComponentRenderer } from "@airalogy/aimd-renderer"
import type { AimdRecorderMessagesInput } from "../locales"
import {
  createAimdRecorderMessages,
  resolveAimdRecorderLocale,
} from "../locales"
import type {
  AimdChoiceOptionExplanationMode,
  AimdCollectorPermissionHandler,
  AimdCollectorProviderMap,
  AimdAssignerMap,
  AimdAssignerRunner,
  AimdServerAssignerMap,
  AimdServerAssignerRunner,
  AimdEntityResolverMap,
  AimdFileInfoResolver,
  AimdFileUploadHandler,
  AimdFieldMeta,
  AimdFieldState,
  AimdRecorderFieldAdapters,
  AimdRecorderFieldType,
  AimdRecordValidationSchema,
  AimdScaleGradeDisplayMode,
  AimdTypePlugin,
  AimdProtocolRecordData,
  AimdRecorderValidationResult,
  AimdRecorderValidationTrigger,
  AimdStepDetailDisplay,
  AimdStepRecordItem,
  FieldEventPayload,
  TableEventPayload,
} from "../types"
import { createEmptyProtocolRecordData } from "../types"
import {
  getAimdVarTableCellFieldKey,
  matchesAimdValidationFieldSelector,
  validateAimdRecord,
} from "../record/validation"
import {
  applyIncomingRecord,
  applyPastedVarTableGrid,
  cloneRecordData,
  ensureDefaultsFromFields,
  getRecordDataSignature,
  getQuizDefaultValue,
  parsePastedVarTableText,
} from "../composables/useRecordState"
import {
  getVarInputKind,
  normalizeVarTypeName,
  normalizeDateTimeValueWithTimezone,
} from "../composables/useVarHelpers"
import {
  applyAimdAssignedFieldsToRecord,
  buildAimdAssignerDependentData,
  extractAimdAssignerErrorMessage,
  extractAimdAssignedFields,
  getAimdAssignerPayloadFieldKey,
  isReadonlyAimdAssignerMode,
  normalizeAimdAssignerMode,
  resolveAimdAssigners,
  type AimdResolvedAssigner,
} from "../composables/useAssignerRunner"
import {
  captureFocusSnapshot,
  restoreFocusSnapshot,
} from "../composables/useFocusManagement"
import type { FocusSnapshot } from "../composables/useFocusManagement"
import { useClientAssignerRunner } from "../composables/useClientAssignerRunner"
import type { ClientAssignerFieldDefinitions } from "../client-assigner"
import { resolveAimdRecorderFieldVNode } from "../composables/useFieldAdapters"
import { useVarTableDragDrop, getVarTableColumns } from "../composables/useVarTableDragDrop"
import { useFieldRendering } from "../composables/useFieldRendering"
import { useCodeBlockRendering } from "../composables/useCodeBlockRendering"
import { useRecordSearch } from "../composables/useRecordSearch"
import { useCollectors } from "../composables/useCollectors"
import {
  createEmptyCheckRecordItem,
  createEmptyStepRecordItem,
  formatStepDuration,
  getProtocolEstimatedDurationMs,
  getProtocolRecordedDurationMs,
  isStepTimerRunning,
  pauseStepTimer,
  resetStepTimer,
  setStepChecked,
  startStepTimer,
} from "../composables/useStepTimers"
import { createAimdTypePlugins } from "../type-plugins"
import AimdVarField from "./AimdVarField.vue"
import AimdCollectorField from "./AimdCollectorField.vue"
import AimdVarTableField from "./AimdVarTableField.vue"
import AimdRecorderSearchToolbar from "./AimdRecorderSearchToolbar.vue"
import { AimdStepField, AimdCheckField } from "./AimdStepCheckField.vue"
import AimdQuizRecorder from "./AimdQuizRecorder.vue"
import AimdAssignerCalculatorIcon from "./icons/AimdAssignerCalculatorIcon.vue"
import AimdAssignerCloudStatusIcon from "./icons/AimdAssignerCloudStatusIcon.vue"

// ---------------------------------------------------------------------------
// Props & emits
// ---------------------------------------------------------------------------

const props = withDefaults(defineProps<{
  /** AIMD markdown content to render */
  content: string
  /** Metadata-only protocol context used by embedded single-field recorder hosts. */
  protocolContext?: string
  /** Current record data (v-model) */
  modelValue?: Partial<AimdProtocolRecordData>
  /** When true all inputs are read-only */
  readonly?: boolean
  /** Used to pre-fill currenttime / username fields */
  currentUserName?: string
  now?: Date | string | number
  locale?: string
  messages?: AimdRecorderMessagesInput
  quizGrades?: Record<string, AimdQuizGradeResult | null | undefined>
  submitted?: boolean
  choiceOptionExplanationMode?: AimdChoiceOptionExplanationMode
  scaleGradeDisplayMode?: AimdScaleGradeDisplayMode
  /** Controls whether step timer / note details stay expanded */
  stepDetailDisplay?: AimdStepDetailDisplay
  /** Shows the built-in record search toolbar. */
  showSearch?: boolean
  /** Expands the built-in record search toolbar by default. */
  searchDefaultExpanded?: boolean

  // ── Extension props ──────────────────────────────────────────────────────

  /**
   * Per-field metadata keyed by "section:fieldName" (e.g. "var:temp").
   * Controls inputType overrides, assigner mode, enum options, etc.
   */
  fieldMeta?: Record<string, AimdFieldMeta>

  /**
   * Parsed protocol assigners keyed by assigned field name.
   * The recorder turns these into buttons, dependency payloads, runtime states,
   * and record writes while the host supplies the execution hook.
   */
  serverAssigners?: AimdServerAssignerMap
  /** @deprecated Use `serverAssigners` instead. */
  assigners?: AimdAssignerMap

  /**
   * Per-field runtime state keyed by "section:fieldName".
   * Drives loading / error / validationError styling.
   */
  fieldState?: Record<string, AimdFieldState>

  /** Pydantic-compatible JSON Schema returned by protocol parsing. */
  validationSchema?: AimdRecordValidationSchema

  /** Field events that trigger local validation. Explicit validate() calls always run. */
  validationTriggers?: AimdRecorderValidationTrigger[]

  /**
   * Optional wrapper applied to every rendered field VNode.
   * Receives (fieldKey, fieldType, defaultVNode) and should return a VNode.
   * Use to inject assigner buttons, dependency tags, validation errors, etc.
   */
  wrapField?: (fieldKey: string, fieldType: string, defaultVNode: VNode) => VNode

  /**
   * Renderer overrides keyed by AIMD field type ("var", "step", …).
   * Return null/undefined to fall through to the built-in renderer.
   */
  customRenderers?: Partial<Record<string, AimdComponentRenderer>>

  /**
   * Host-level field adapters with full recorder context.
   * Prefer this over `customRenderers` for new integrations.
   */
  fieldAdapters?: AimdRecorderFieldAdapters

  /**
   * EntityRef resolver map keyed by connector id/source or entity namespace.
   * Used by built-in EntityRef fields to search/select related records.
   */
  entityResolvers?: AimdEntityResolverMap

  /** Data-source providers keyed by connector id for Collector-backed vars. */
  collectorProviders?: AimdCollectorProviderMap
  /** Optional host authorization hook invoked before a Collector starts. */
  requestCollectorPermission?: AimdCollectorPermissionHandler
  /** Stable actor id recorded when a manual Collector fallback is used. */
  collectorActorId?: string
  /** Stable record key used to scope remembered Collector authorization. */
  collectorRecordKey?: string | number

  /**
   * Resolves relative paths / Airalogy file IDs to displayable URLs.
   */
  resolveFile?: (src: string) => string | null
  resolveFileInfo?: AimdFileInfoResolver

  /**
   * Uploads file-like var selections. Return the record value to store,
   * typically an Airalogy file ID or a structured file descriptor.
   */
  uploadFile?: AimdFileUploadHandler

  /**
   * Runs host-specific assigner execution. The recorder prepares dependencies
   * and applies returned `assigned_fields`; this hook only performs the call.
   */
  runServerAssigner?: AimdServerAssignerRunner
  /** @deprecated Use `runServerAssigner` instead. */
  assignerRunner?: AimdAssignerRunner

  /**
   * Type-level plugins for custom var types.
   * Plugins can define initialization, normalization, display, parsing, and full custom field widgets.
   */
  typePlugins?: AimdTypePlugin[]
}>(), {
  modelValue: undefined,
  protocolContext: undefined,
  readonly: false,
  currentUserName: undefined,
  now: undefined,
  locale: undefined,
  messages: undefined,
  quizGrades: undefined,
  submitted: false,
  choiceOptionExplanationMode: "hidden",
  scaleGradeDisplayMode: "hidden",
  stepDetailDisplay: "auto",
  showSearch: true,
  searchDefaultExpanded: false,
  fieldMeta: undefined,
  serverAssigners: undefined,
  assigners: undefined,
  fieldState: undefined,
  validationSchema: undefined,
  validationTriggers: () => ["change", "blur"],
  wrapField: undefined,
  customRenderers: undefined,
  fieldAdapters: undefined,
  entityResolvers: undefined,
  collectorProviders: undefined,
  requestCollectorPermission: undefined,
  collectorActorId: undefined,
  collectorRecordKey: undefined,
  resolveFile: undefined,
  resolveFileInfo: undefined,
  uploadFile: undefined,
  runServerAssigner: undefined,
  assignerRunner: undefined,
  typePlugins: undefined,
})

const emit = defineEmits<{
  /** Full record updated (v-model) */
  (e: "update:modelValue", value: AimdProtocolRecordData): void
  /** Extracted field list changed (content reparsed) */
  (e: "fields-change", fields: ExtractedAimdFields): void
  /** Parse / render error */
  (e: "error", message: string): void
  /** Local record validation completed. */
  (e: "validation", result: AimdRecorderValidationResult): void

  // ── Granular field events ─────────────────────────────────────────────────
  /** A single field value changed */
  (e: "field-change", payload: FieldEventPayload): void
  /** A field lost focus — use to trigger external validation */
  (e: "field-blur", payload: FieldEventPayload): void

  // ── Assigner events ───────────────────────────────────────────────────────
  /** Host app should run assigner calculation for the given field */
  (e: "assigner-request", payload: FieldEventPayload): void
  /** Host app should cancel an in-flight assigner for the given field */
  (e: "assigner-cancel", payload: FieldEventPayload): void

  // ── Table events ──────────────────────────────────────────────────────────
  /** A table row was added */
  (e: "table-add-row", payload: TableEventPayload): void
  /** A table row was removed */
  (e: "table-remove-row", payload: TableEventPayload): void
}>()

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

const inlineNodes = ref<VNode[]>([])
const renderError = ref("")
const contentRoot = ref<HTMLElement | null>(null)
const localRecord = reactive<AimdProtocolRecordData>(createEmptyProtocolRecordData())
const internalValidationFieldState = ref<Record<string, AimdFieldState>>({})
let buildRequestId = 0
let inlineBuildRequestId = 0
let syncingFromExternal = false
let renderScheduled = false
let inlineRebuildSettled: Promise<void> = Promise.resolve()
let recordInitializedDuringRender = false
let pendingFocusSnapshot: FocusSnapshot | null = null
let pendingInlineBuildRequestId: number | null = null
const timerNowMs = ref(Date.now())
let protocolTimerTicker: ReturnType<typeof setInterval> | null = null
const serverAssignerAbortControllers = new Map<string, AbortController>()
const autoServerAssignerSignatures = new Map<string, string>()
let autoServerAssignerScheduled = false

const resolvedLocale = computed(() => resolveAimdRecorderLocale(props.locale))
const resolvedMessages = computed(() => createAimdRecorderMessages(resolvedLocale.value, props.messages))
const resolvedTypePlugins = computed(() => createAimdTypePlugins(props.typePlugins))
const resolvedServerAssigners = computed(() => props.serverAssigners ?? props.assigners)
const resolvedRunServerAssigner = computed(() => props.runServerAssigner ?? props.assignerRunner)

const InlineNodesOutlet = defineComponent({
  name: "AimdRecorderInlineNodesOutlet",
  props: {
    nodes: {
      type: Array as PropType<VNode[]>,
      required: true,
    },
  },
  setup(outletProps) {
    return () => outletProps.nodes
  },
})

type AssignableRecorderFieldType = Exclude<AimdRecorderFieldType, "quiz">

function applyFieldAdapter<TFieldType extends "var" | "var_table" | "step" | "check" | "quiz">(
  fieldType: TFieldType,
  fieldKey: string,
  node: any,
  value: unknown,
  defaultVNode: VNode,
): VNode {
  const validationError = effectiveFieldState.value[fieldKey]?.validationError
  const fieldVNode = h(fieldType === "var" ? "span" : "div", {
    "class": ["aimd-rec-field-host", validationError ? "aimd-rec-field-host--invalid" : undefined],
    "data-aimd-recorder-field": fieldKey,
  }, [
    defaultVNode,
    validationError
      ? h("span", { class: "aimd-rec-validation-message", role: "alert" }, validationError)
      : null,
  ])

  return resolveAimdRecorderFieldVNode(fieldType, fieldKey, node, value, fieldVNode, {
    fieldAdapters: props.fieldAdapters,
    wrapField: props.wrapField,
    readonly: props.readonly,
    locale: resolvedLocale.value,
    messages: resolvedMessages.value,
    record: localRecord,
    fieldMeta: effectiveFieldMeta.value,
    fieldState: effectiveFieldState.value,
  })
}

function getAssignerPayloadFieldKey(fieldType: AssignableRecorderFieldType, fieldKey: string): string {
  return getAimdAssignerPayloadFieldKey(fieldType, fieldKey)
}

function getManualClientAssignerForField(
  fieldType: AssignableRecorderFieldType,
  payloadFieldKey: string,
): AimdClientAssignerField | undefined {
  if (fieldType !== "var") {
    return undefined
  }

  return clientAssigners.value.find(assigner => (
    assigner.mode === "manual" && assigner.assigned_fields.includes(payloadFieldKey)
  ))
}

interface ResolvedAssignerControl {
  fieldType: AssignableRecorderFieldType
  fieldKey: string
  payloadFieldKey: string
  clientAssigner?: AimdClientAssignerField
  serverAssigner?: AimdResolvedAssigner
  serverRunKey?: string
  state?: AimdFieldState
  loading: boolean
  disabled: boolean
  label: string
  titleTarget: string
}

function resolveAssignerControl(
  fieldType: AssignableRecorderFieldType,
  fieldKey: string,
): ResolvedAssignerControl | null {
  const meta = effectiveFieldMeta.value[fieldKey]
  const payloadFieldKey = getAssignerPayloadFieldKey(fieldType, fieldKey)
  const serverAssigner = serverAssignerByFieldKey.value[fieldKey]
    ?? serverAssignerByAssignedField.value[payloadFieldKey]
  const clientAssigner = meta?.assigner || serverAssigner
    ? undefined
    : getManualClientAssignerForField(fieldType, payloadFieldKey)
  if ((!meta?.assigner && !clientAssigner && !serverAssigner) || props.readonly) {
    return null
  }

  const state = effectiveFieldState.value[fieldKey]
  const serverRunKey = serverAssigner ? getServerAssignerRunKey(serverAssigner) : undefined
  const serverGroupLoading = Boolean(serverRunKey && serverAssignerAbortControllers.has(serverRunKey))
  const loading = state?.loading === true || serverGroupLoading
  const canCancelServerRun = Boolean(
    serverAssigner
    && resolvedRunServerAssigner.value
    && serverRunKey
    && serverAssignerAbortControllers.has(serverRunKey),
  )
  const disabled = (loading && !canCancelServerRun) || state?.disabled === true
  const label = canCancelServerRun
    ? resolvedMessages.value.assigner.cancel
    : loading
      ? resolvedMessages.value.assigner.running
      : resolvedMessages.value.assigner.run
  const titleTarget = clientAssigner?.id ?? serverAssigner?.assignedField ?? payloadFieldKey

  return {
    fieldType,
    fieldKey,
    payloadFieldKey,
    clientAssigner,
    serverAssigner,
    serverRunKey,
    state,
    loading,
    disabled,
    label,
    titleTarget,
  }
}

function renderAssignerButton(control: ResolvedAssignerControl, value: unknown): VNode {
  return h("button", {
    type: "button",
    class: "aimd-rec-assigner-field__button",
    disabled: control.disabled,
    "aria-label": `${control.label}: ${control.titleTarget}`,
    onClick: (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (control.loading) {
        if (control.serverAssigner && resolvedRunServerAssigner.value) {
          cancelServerAssigner(control.serverRunKey ?? control.fieldKey)
        } else {
          emit("assigner-cancel", {
            section: control.fieldType,
            fieldKey: control.payloadFieldKey,
            value,
          })
        }
        return
      }
      if (control.clientAssigner) {
        clientAssignerRunner.triggerClientAssigner(control.clientAssigner.id)
        return
      }
      if (control.serverAssigner && resolvedRunServerAssigner.value) {
        void runServerAssigner(control.serverAssigner, control.fieldType, control.fieldKey)
        return
      }
      emit("assigner-request", {
        section: control.fieldType,
        fieldKey: control.payloadFieldKey,
        value,
      })
    },
    title: `${resolvedMessages.value.assigner.run}: ${control.titleTarget}`,
  }, [
    control.loading
      ? h("span", { class: "aimd-rec-assigner-field__spinner", "aria-hidden": "true" })
      : h(AimdAssignerCalculatorIcon),
    h("span", { class: "aimd-rec-assigner-field__label" }, control.label),
  ])
}

function renderAssignerCloudStatusIcon(control: ResolvedAssignerControl): VNode {
  const statusClass = control.loading
    ? "loading"
    : control.state?.error
      ? "error"
      : control.state && control.state.loading === false
        ? "done"
        : "idle"

  if (statusClass === "loading") {
    return h("span", {
      class: ["aimd-rec-assigner-field__status", "aimd-rec-assigner-field__status--loading"],
      title: control.label,
    }, [
      h("span", { class: "aimd-rec-assigner-field__status-spinner", "aria-hidden": "true" }),
    ])
  }

  return h("span", {
    class: ["aimd-rec-assigner-field__status", `aimd-rec-assigner-field__status--${statusClass}`],
    title: statusClass === "done"
      ? control.titleTarget
      : (control.state?.error || control.titleTarget),
  }, [
    h(AimdAssignerCloudStatusIcon, {
      variant: statusClass === "done" ? "done" : "idle",
    }),
  ])
}

function withAssignerControl(
  fieldType: AssignableRecorderFieldType,
  fieldKey: string,
  value: unknown,
  defaultVNode: VNode,
): VNode {
  const control = resolveAssignerControl(fieldType, fieldKey)
  if (!control) {
    return defaultVNode
  }

  const tag = fieldType === "var" ? "span" : "div"

  return h(tag, {
    class: [
      "aimd-rec-assigner-field",
      `aimd-rec-assigner-field--${fieldType}`,
      control.loading ? "aimd-rec-assigner-field--loading" : undefined,
      control.state?.error ? "aimd-rec-assigner-field--error" : undefined,
    ],
    "data-rec-assigner-key": fieldKey,
  }, [
    renderAssignerButton(control, value),
    h("span", { class: "aimd-rec-assigner-field__control" }, [defaultVNode]),
    control.state?.error
      ? h("span", { class: "aimd-rec-assigner-field__error" }, control.state.error)
      : null,
  ])
}

const EMPTY_FIELDS: ExtractedAimdFields = {
  var: [],
  var_definitions: [],
  var_table: [],
  client_assigner: [],
  connectors: [],
  collectors: [],
  quiz: [],
  step: [],
  check: [],
  ref_step: [],
  ref_var: [],
  ref_fig: [],
  cite: [],
  fig: [],
}

const extractedFields = ref<ExtractedAimdFields>(EMPTY_FIELDS)
const collectorValidationContext = ref<AimdCollectorValidationContext>()
const clientAssigners = ref<AimdClientAssignerField[]>([])
const internalAssignerFieldState = ref<Record<string, AimdFieldState>>({})
const clientAssignerFieldDefinitions = computed<ClientAssignerFieldDefinitions>(() => {
  const definitions: ClientAssignerFieldDefinitions = {}
  for (const field of extractedFields.value.var_definitions ?? []) {
    definitions[field.id] = {
      type: field.type,
      kwargs: field.kwargs,
    }
  }
  return definitions
})
const protocolAssignerEntries = computed(() => resolveAimdAssigners(resolvedServerAssigners.value, extractedFields.value))
const serverAssignerByFieldKey = computed(() => (
  Object.fromEntries(protocolAssignerEntries.value.map(entry => [entry.fieldKey, entry]))
))
const serverAssignerByAssignedField = computed(() => (
  Object.fromEntries(protocolAssignerEntries.value.map(entry => [entry.assignedField, entry]))
))

function createEnumOptions(values: unknown[]): NonNullable<AimdFieldMeta["enumOptions"]> {
  return values.map(value => ({
    label: String(value),
    value,
  }))
}

function mergeFieldMeta(
  target: Record<string, AimdFieldMeta>,
  fieldKey: string,
  meta: AimdFieldMeta,
) {
  target[fieldKey] = {
    ...target[fieldKey],
    ...meta,
    assigner: meta.assigner ?? target[fieldKey]?.assigner,
    disabled: meta.disabled ?? target[fieldKey]?.disabled,
  }
}

const generatedEnumFieldMeta = computed<Record<string, AimdFieldMeta>>(() => {
  const meta: Record<string, AimdFieldMeta> = {}

  for (const field of extractedFields.value.var_definitions ?? []) {
    const enumValues = getAimdFieldEnumValues(field)
    if (enumValues.length > 0) {
      mergeFieldMeta(meta, `var:${field.id}`, {
        enumOptions: createEnumOptions(enumValues),
      })
    }
  }

  for (const table of extractedFields.value.var_table ?? []) {
    for (const subvar of table.subvars ?? []) {
      const enumValues = getAimdFieldEnumValues(subvar)
      if (enumValues.length > 0) {
        mergeFieldMeta(meta, `var_table:${table.id}:${subvar.id}`, {
          enumOptions: createEnumOptions(enumValues),
        })
      }
    }
  }

  return meta
})

const generatedAssignerFieldMeta = computed<Record<string, AimdFieldMeta>>(() => {
  const meta: Record<string, AimdFieldMeta> = {}
  for (const entry of protocolAssignerEntries.value) {
    meta[entry.fieldKey] = {
      assigner: { mode: normalizeAimdAssignerMode(entry.mode) },
      disabled: isReadonlyAimdAssignerMode(entry.mode) || undefined,
    }
  }
  return meta
})
const effectiveFieldMeta = computed<Record<string, AimdFieldMeta>>(() => {
  const next: Record<string, AimdFieldMeta> = {}
  for (const [fieldKey, meta] of Object.entries(generatedEnumFieldMeta.value)) {
    mergeFieldMeta(next, fieldKey, meta)
  }
  for (const [fieldKey, meta] of Object.entries(generatedAssignerFieldMeta.value)) {
    mergeFieldMeta(next, fieldKey, meta)
  }
  for (const [fieldKey, meta] of Object.entries(props.fieldMeta ?? {})) {
    mergeFieldMeta(next, fieldKey, meta)
  }
  return next
})
const effectiveFieldState = computed<Record<string, AimdFieldState>>(() => {
  const keys = new Set([
    ...Object.keys(internalAssignerFieldState.value),
    ...Object.keys(internalValidationFieldState.value),
    ...Object.keys(props.fieldState ?? {}),
  ])
  const next: Record<string, AimdFieldState> = {}

  for (const key of keys) {
    const internalState = internalAssignerFieldState.value[key]
    const validationState = internalValidationFieldState.value[key]
    const externalState = props.fieldState?.[key]
    next[key] = {
      ...internalState,
      ...validationState,
      ...externalState,
      loading: externalState?.loading ?? internalState?.loading,
      error: externalState?.error ?? internalState?.error,
      validationError: externalState?.validationError ?? validationState?.validationError,
    }
  }

  return next
})
const protocolEstimatedDurationMs = computed(() => getProtocolEstimatedDurationMs(extractedFields.value.step_hierarchy ?? []))
const protocolRecordedDurationMs = computed(() => getProtocolRecordedDurationMs(localRecord.step, timerNowMs.value))
const showProtocolTimingSummary = computed(() => protocolEstimatedDurationMs.value > 0 || protocolRecordedDurationMs.value > 0)
const protocolEstimatedDurationLabel = computed(() => formatStepDuration(protocolEstimatedDurationMs.value, resolvedLocale.value))
const protocolRecordedDurationLabel = computed(() => formatStepDuration(protocolRecordedDurationMs.value, resolvedLocale.value))
const hasRunningStepTimer = computed(() => Object.values(localRecord.step).some(step => isStepTimerRunning(step)))
const recordSearch = useRecordSearch({
  contentRoot,
  defaultExpanded: props.searchDefaultExpanded,
  fields: extractedFields,
  messages: resolvedMessages,
  onVisualStateChange: scheduleInlineRebuild,
  record: localRecord,
})
const showRecordSearchToolbar = computed(() => props.showSearch && recordSearch.fieldRefs.value.length > 0)

function syncProtocolTimerTicker() {
  if (protocolTimerTicker) {
    clearInterval(protocolTimerTicker)
    protocolTimerTicker = null
  }

  if (!hasRunningStepTimer.value) {
    return
  }

  protocolTimerTicker = setInterval(() => {
    timerNowMs.value = Date.now()
  }, 1000)
}

function getStepTimerPayload(step: AimdStepRecordItem) {
  return {
    elapsed_ms: step.elapsed_ms,
    timer_started_at_ms: step.timer_started_at_ms,
    started_at_ms: step.started_at_ms,
    ended_at_ms: step.ended_at_ms,
  }
}

function emitRecordUpdate() {
  if (syncingFromExternal) return
  emit("update:modelValue", cloneRecordData(localRecord))
}

function scheduleInlineRebuild() {
  pendingFocusSnapshot = captureFocusSnapshot(contentRoot.value) ?? pendingFocusSnapshot
  pendingInlineBuildRequestId = ++inlineBuildRequestId
  if (renderScheduled) {
    return
  }
  renderScheduled = true
  inlineRebuildSettled = Promise.resolve().then(async () => {
    renderScheduled = false
    const focusSnapshot = pendingFocusSnapshot
    const inlineRequestId = pendingInlineBuildRequestId ?? inlineBuildRequestId
    pendingFocusSnapshot = null
    pendingInlineBuildRequestId = null
    await rebuildInlineNodes(undefined, focusSnapshot, inlineRequestId)
  })
}

const { preRenderer: codeBlockPreRenderer } = useCodeBlockRendering(scheduleInlineRebuild)

function validationFieldStatesEqual(
  left: Record<string, AimdFieldState>,
  right: Record<string, AimdFieldState>,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return leftKeys.length === rightKeys.length
    && leftKeys.every(key => left[key]?.validationError === right[key]?.validationError)
}

function applyValidationResult(
  result: AimdRecorderValidationResult,
  fieldKeys = result.validatedFieldKeys,
) {
  const next = fieldKeys?.length ? { ...internalValidationFieldState.value } : {}
  if (fieldKeys?.length) {
    for (const existingKey of Object.keys(next)) {
      if (fieldKeys.some(selector => matchesAimdValidationFieldSelector(existingKey, selector))) {
        delete next[existingKey]
      }
    }
  }
  Object.assign(next, result.fieldState)
  if (validationFieldStatesEqual(next, internalValidationFieldState.value)) return
  internalValidationFieldState.value = next
  scheduleInlineRebuild()
}

function clearValidation(fieldKey?: string) {
  if (Object.keys(internalValidationFieldState.value).length === 0) return
  if (!fieldKey) {
    internalValidationFieldState.value = {}
    scheduleInlineRebuild()
    return
  }

  const next = { ...internalValidationFieldState.value }
  for (const existingKey of Object.keys(next)) {
    if (matchesAimdValidationFieldSelector(existingKey, fieldKey)) delete next[existingKey]
  }
  if (validationFieldStatesEqual(next, internalValidationFieldState.value)) return
  internalValidationFieldState.value = next
  scheduleInlineRebuild()
}

function focusInvalidField(fieldKey: string): boolean {
  const exactControl = Array.from(contentRoot.value?.querySelectorAll<HTMLElement>("[data-rec-focus-key]") ?? [])
    .find(candidate => candidate.dataset.recFocusKey === fieldKey)
  if (exactControl) {
    exactControl.scrollIntoView({ behavior: "smooth", block: "center" })
    exactControl.focus({ preventScroll: true })
    return true
  }
  const element = Array.from(contentRoot.value?.querySelectorAll<HTMLElement>("[data-aimd-recorder-field]") ?? [])
    .find(candidate => candidate.dataset.aimdRecorderField === fieldKey)
  if (!element) return false
  element.scrollIntoView({ behavior: "smooth", block: "center" })
  element.querySelector<HTMLElement>("input, textarea, select, button, [tabindex]")?.focus({ preventScroll: true })
  return true
}

function focusFirstInvalidField(): boolean {
  const fieldKey = Object.keys(internalValidationFieldState.value)[0]
  return fieldKey ? focusInvalidField(fieldKey) : false
}

async function validate(options: { focus?: boolean } = {}): Promise<AimdRecorderValidationResult> {
  const result = validateAimdRecord(extractedFields.value, localRecord, {
    fieldMeta: effectiveFieldMeta.value,
    schema: props.validationSchema,
    messages: resolvedMessages.value.validation,
  })
  applyValidationResult(result)
  emit("validation", result)
  if (!result.valid && options.focus !== false) {
    await inlineRebuildSettled
    focusFirstInvalidField()
  }
  return result
}

async function validateField(
  fieldKey: string,
  options: { focus?: boolean; trigger?: AimdRecorderValidationTrigger } = {},
): Promise<AimdRecorderValidationResult> {
  const result = validateAimdRecord(extractedFields.value, localRecord, {
    fieldMeta: effectiveFieldMeta.value,
    schema: props.validationSchema,
    fieldKeys: [fieldKey],
    messages: resolvedMessages.value.validation,
  })
  applyValidationResult(result, [fieldKey])
  emit("validation", result)
  if (!result.valid && options.focus === true) {
    await inlineRebuildSettled
    const invalidKey = Object.keys(result.fieldState)[0]
    if (invalidKey) focusInvalidField(invalidKey)
  }
  return result
}

function triggerFieldValidation(trigger: Exclude<AimdRecorderValidationTrigger, "submit">, fieldKey: string) {
  if (!props.validationTriggers.includes(trigger)) return
  void validateField(fieldKey, { trigger })
}

function markRecordChanged(options?: { rebuild?: boolean, runClientAssigners?: boolean }) {
  const assignerChanged = options?.runClientAssigners ? clientAssignerRunner.applyCurrentClientAssigners() : false
  emitRecordUpdate()
  if (options?.rebuild || assignerChanged) {
    scheduleInlineRebuild()
  }
  scheduleAutoServerAssigners()
}

function setInternalAssignerStates(fieldKeys: Iterable<string>, patch: AimdFieldState) {
  const nextState = { ...internalAssignerFieldState.value }
  let changed = false

  for (const fieldKey of fieldKeys) {
    if (!fieldKey) continue
    nextState[fieldKey] = {
      ...nextState[fieldKey],
      ...patch,
    }
    changed = true
  }

  if (!changed) {
    return
  }

  internalAssignerFieldState.value = nextState
  scheduleInlineRebuild()
}

function setInternalAssignerState(fieldKey: string, patch: AimdFieldState) {
  setInternalAssignerStates([fieldKey], patch)
}

function cancelServerAssigner(fieldKey: string) {
  serverAssignerAbortControllers.get(fieldKey)?.abort()
}

function getAssignableFieldTypeFromKey(fieldKey: string): AssignableRecorderFieldType {
  if (fieldKey.startsWith("var_table:")) return "var_table"
  if (fieldKey.startsWith("step:")) return "step"
  if (fieldKey.startsWith("check:")) return "check"
  return "var"
}

function isAutoServerAssignerMode(mode: string): boolean {
  const normalized = normalizeAimdAssignerMode(mode)
  return normalized === "auto"
    || normalized === "auto_first"
    || normalized === "auto_force"
    || normalized === "auto_readonly"
}

function getRecordValueForFieldKey(fieldKey: string): unknown {
  if (fieldKey.startsWith("var_table:")) {
    const [, tableName, ...columnParts] = fieldKey.split(":")
    const rows = localRecord.var[tableName]
    if (!Array.isArray(rows)) return rows
    const columnName = columnParts.join(":")
    return columnName
      ? rows.map(row => (row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>)[columnName] : undefined))
      : rows
  }
  if (fieldKey.startsWith("step:")) return localRecord.step[fieldKey.slice("step:".length)]
  if (fieldKey.startsWith("check:")) return localRecord.check[fieldKey.slice("check:".length)]
  return localRecord.var[fieldKey.startsWith("var:") ? fieldKey.slice("var:".length) : fieldKey]
}

function isAutoServerValueReady(value: unknown): boolean {
  return value !== undefined
}

function areAutoServerDependenciesReady(assigner: AimdResolvedAssigner, dependentData: Record<string, unknown>): boolean {
  if (assigner.dependentFields.length === 0) {
    return false
  }
  return assigner.dependentFields.every(field => (
    Object.prototype.hasOwnProperty.call(dependentData, field)
    && isAutoServerValueReady(dependentData[field])
  ))
}

function shouldRunAutoFirstServerAssigner(assigner: AimdResolvedAssigner): boolean {
  if (normalizeAimdAssignerMode(assigner.mode) !== "auto_first") {
    return true
  }
  const currentValue = getRecordValueForFieldKey(assigner.fieldKey)
  return currentValue === undefined || currentValue === ""
}

function getAutoServerAssignerGroupKey(assigner: AimdResolvedAssigner): string {
  return JSON.stringify({
    mode: normalizeAimdAssignerMode(assigner.mode),
    dependentFields: assigner.dependentFields,
    assigner: assigner.assigner,
  })
}

function getServerAssignerRunKey(assigner: AimdResolvedAssigner): string {
  return getAutoServerAssignerGroupKey(assigner)
}

function scheduleAutoServerAssigners() {
  if (autoServerAssignerScheduled) {
    return
  }
  autoServerAssignerScheduled = true
  Promise.resolve().then(() => {
    autoServerAssignerScheduled = false
    void runAutoServerAssigners()
  })
}

async function runAutoServerAssigners() {
  if (props.readonly || !resolvedRunServerAssigner.value) {
    return
  }

  const visitedGroups = new Set<string>()
  for (const assigner of protocolAssignerEntries.value) {
    if (!isAutoServerAssignerMode(assigner.mode)) {
      continue
    }

    const groupKey = getServerAssignerRunKey(assigner)
    if (visitedGroups.has(groupKey)) {
      continue
    }
    visitedGroups.add(groupKey)
    if (serverAssignerAbortControllers.has(groupKey)) {
      continue
    }

    if (!shouldRunAutoFirstServerAssigner(assigner)) {
      continue
    }

    const dependentData = buildAimdAssignerDependentData(localRecord, assigner)
    if (!areAutoServerDependenciesReady(assigner, dependentData)) {
      continue
    }

    const signature = JSON.stringify(dependentData)
    if (autoServerAssignerSignatures.get(groupKey) === signature) {
      continue
    }
    autoServerAssignerSignatures.set(groupKey, signature)

    await runServerAssigner(
      assigner,
      getAssignableFieldTypeFromKey(assigner.fieldKey),
      assigner.fieldKey,
    )
  }
}

function getAssignedFieldStateKey(assignedField: string): string {
  const normalizedField = assignedField.trim()
  if (!normalizedField) {
    return ""
  }
  const mappedAssigner = serverAssignerByAssignedField.value[normalizedField]
  if (mappedAssigner) {
    return mappedAssigner.fieldKey
  }
  if (normalizedField.includes(".")) {
    const [tableName, ...columnParts] = normalizedField.split(".")
    return `var_table:${tableName}:${columnParts.join(".")}`
  }
  return `var:${normalizedField}`
}

function getDeclaredServerAssignerStateKeys(assigner: AimdResolvedAssigner, fallbackFieldKey: string): string[] {
  const declaredFields = Array.isArray(assigner.assigner.assigned_fields)
    ? assigner.assigner.assigned_fields
    : Array.isArray((assigner.assigner as { assignedFields?: unknown }).assignedFields)
      ? (assigner.assigner as { assignedFields: unknown[] }).assignedFields
      : []
  const stateKeys = new Set<string>([fallbackFieldKey])
  for (const field of declaredFields) {
    if (typeof field !== "string") continue
    const stateKey = getAssignedFieldStateKey(field)
    if (stateKey) {
      stateKeys.add(stateKey)
    }
  }
  return [...stateKeys]
}

function getServerAssignerGroupStateKeys(assigner: AimdResolvedAssigner, fallbackFieldKey: string): string[] {
  const groupKey = getServerAssignerRunKey(assigner)
  const stateKeys = new Set<string>(getDeclaredServerAssignerStateKeys(assigner, fallbackFieldKey))
  for (const entry of protocolAssignerEntries.value) {
    if (getServerAssignerRunKey(entry) !== groupKey) {
      continue
    }
    stateKeys.add(entry.fieldKey)
    for (const stateKey of getDeclaredServerAssignerStateKeys(entry, entry.fieldKey)) {
      stateKeys.add(stateKey)
    }
  }
  return [...stateKeys]
}

function getReturnedServerAssignerStateKeys(
  assignedFields: Record<string, unknown>,
  fallbackFieldKey: string,
): string[] {
  const stateKeys = new Set<string>([fallbackFieldKey])
  for (const field of Object.keys(assignedFields)) {
    const stateKey = getAssignedFieldStateKey(field)
    if (stateKey) {
      stateKeys.add(stateKey)
    }
  }
  return [...stateKeys]
}

async function runServerAssigner(
  assigner: AimdResolvedAssigner,
  fieldType: AssignableRecorderFieldType,
  fieldKey: string,
) {
  const runner = resolvedRunServerAssigner.value
  if (!runner) return

  const runKey = getServerAssignerRunKey(assigner)
  const groupStateKeys = getServerAssignerGroupStateKeys(assigner, fieldKey)
  serverAssignerAbortControllers.get(runKey)?.abort()
  const abortController = new AbortController()
  serverAssignerAbortControllers.set(runKey, abortController)
  setInternalAssignerStates(groupStateKeys, { loading: true, error: undefined })

  try {
    const result = await runner({
      section: fieldType,
      fieldKey,
      assignedField: assigner.assignedField,
      dependentData: buildAimdAssignerDependentData(localRecord, assigner),
      record: cloneRecordData(localRecord),
      assigner: assigner.assigner,
      signal: abortController.signal,
    })
    const errorMessage = extractAimdAssignerErrorMessage(result)
    if (errorMessage) {
      throw new Error(errorMessage)
    }
    const assignedFields = extractAimdAssignedFields(result)
    const returnedStateKeys = getReturnedServerAssignerStateKeys(assignedFields, fieldKey)
    const completedStateKeys = [...new Set([...groupStateKeys, ...returnedStateKeys])]
    if (Object.keys(assignedFields).length > 0) {
      applyAimdAssignedFieldsToRecord(localRecord, assignedFields)
      markRecordChanged({ rebuild: true, runClientAssigners: true })
    } else {
      emitRecordUpdate()
    }
    if (serverAssignerAbortControllers.get(runKey) === abortController) {
      setInternalAssignerStates(completedStateKeys, { loading: false, error: undefined })
    }
  } catch (error) {
    if (abortController.signal.aborted) {
      if (serverAssignerAbortControllers.get(runKey) === abortController) {
        setInternalAssignerStates(groupStateKeys, { loading: false, error: undefined })
      }
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    setInternalAssignerStates(groupStateKeys, { loading: false, error: message })
  } finally {
    if (serverAssignerAbortControllers.get(runKey) === abortController) {
      serverAssignerAbortControllers.delete(runKey)
    }
  }
}

// ---------------------------------------------------------------------------
// Composables
// ---------------------------------------------------------------------------

const clientAssignerRunner = useClientAssignerRunner({
  readonly: () => props.readonly,
  clientAssigners,
  fieldDefinitions: () => clientAssignerFieldDefinitions.value,
  localRecord,
  onError: (message) => emit("error", message),
  emitRecordUpdate,
  scheduleInlineRebuild,
})

const tableDragDrop = useVarTableDragDrop({
  readonly: () => props.readonly,
  localRecord,
  markRecordChanged,
  scheduleInlineRebuild,
  emitTableAddRow: (payload) => emit("table-add-row", payload),
  emitTableRemoveRow: (payload) => emit("table-remove-row", payload),
})

const fieldRendering = useFieldRendering({
  readonly: () => props.readonly,
  currentUserName: () => props.currentUserName,
  now: () => props.now,
  fieldMeta: () => effectiveFieldMeta.value,
  fieldState: () => effectiveFieldState.value,
  typePlugins: () => resolvedTypePlugins.value,
  wrapField: () => props.wrapField,
})

const collectorRuntime = useCollectors({
  fields: () => extractedFields.value,
  record: localRecord,
  providers: () => props.collectorProviders,
  requestPermission: () => props.requestCollectorPermission,
  actorId: () => props.collectorActorId,
  onChange: (fieldId, value) => {
    localRecord.var[fieldId] = value
    markRecordChanged({ rebuild: true, runClientAssigners: true })
    emit("field-change", { section: "var", fieldKey: fieldId, value })
  },
})

// ---------------------------------------------------------------------------
// Inline field renderers
// ---------------------------------------------------------------------------

function renderInlineVar(node: AimdVarNode): VNode {
  const id = node.id
  const fieldKey = `var:${id}`
  const baseMeta = effectiveFieldMeta.value[fieldKey]
  const nodeEnumValues = getAimdFieldEnumValues(node.definition)
  const meta = nodeEnumValues.length > 0 && !baseMeta?.enumOptions
    ? {
        ...(baseMeta ?? {}),
        enumOptions: createEnumOptions(nodeEnumValues),
      }
    : baseMeta

  // 1. Custom renderer override
  if (props.customRenderers?.var) {
    const custom = props.customRenderers.var(node, {} as any, [])
    if (custom) {
      const assignerVNode = withAssignerControl("var", fieldKey, localRecord.var[id], custom as VNode)
      return applyFieldAdapter("var", fieldKey, node, localRecord.var[id], assignerVNode)
    }
  }

  const type = node.definition?.type || "str"
  const typePlugin = fieldRendering.getTypePlugin(fieldKey, type)
  const inputKind = getVarInputKind(type, {
    inputType: meta?.inputType,
    codeLanguage: meta?.codeLanguage,
    kwargs: node.definition?.kwargs,
    fieldMeta: meta,
    typePlugin,
  })
  const placeholder = meta?.placeholder ?? fieldRendering.getVarPlaceholder(node, meta)

  function emitVarChange(value: unknown) {
    fieldRendering.clearVarInputDisplayOverride(id)
    localRecord.var[id] = value
    markRecordChanged({ rebuild: inputKind === "file", runClientAssigners: true })
    emit("field-change", { section: "var", fieldKey: id, value })
    triggerFieldValidation("change", fieldKey)
  }

  function emitVarBlur() {
    emit("field-blur", { section: "var", fieldKey: id })
    triggerFieldValidation("blur", fieldKey)
  }

  // 2. Initialise value
  if (!(id in localRecord.var)) {
    localRecord.var[id] = fieldRendering.getVarInitialValue(node, type, fieldKey)
    const initialDisplayOverride = fieldRendering.getVarInitialDisplayOverride(node, type, fieldKey)
    if (initialDisplayOverride) {
      fieldRendering.setVarInputDisplayOverride(id, initialDisplayOverride)
    }
    recordInitializedDuringRender = true
  }
  const collectorBinding = collectorRuntime.resolveBinding(id)
  if (collectorBinding) {
    const disabled = fieldRendering.isFieldDisabled(fieldKey)
    const vnode = h(AimdCollectorField, {
      node,
      binding: collectorBinding,
      value: localRecord.var[id],
      state: collectorRuntime.getState(id),
      disabled,
      providerAvailable: collectorRuntime.hasProvider(id),
      messages: resolvedMessages.value,
      fieldMeta: meta,
      extraClasses: [
        ...fieldRendering.fieldStateClasses(fieldKey),
        ...recordSearch.getFieldClasses(fieldKey),
      ],
      onStart: () => { void collectorRuntime.start(id) },
      onStop: () => collectorRuntime.stop(id),
      onManual: (payload: { value: unknown; reason: string }) => {
        collectorRuntime.writeManual(id, payload.value, payload.reason)
      },
      onBlur: emitVarBlur,
    })
    return applyFieldAdapter("var", fieldKey, node, localRecord.var[id], vnode)
  }
  if (inputKind === "datetime") {
    const norm = normalizeDateTimeValueWithTimezone(localRecord.var[id])
    if (norm !== localRecord.var[id]) {
      localRecord.var[id] = norm
      recordInitializedDuringRender = true
    }
  }
  const normalizedValue = fieldRendering.normalizeVarValue(
    node,
    type,
    fieldKey,
    localRecord.var[id],
    inputKind,
  )
  if (JSON.stringify(normalizedValue) !== JSON.stringify(localRecord.var[id])) {
    localRecord.var[id] = normalizedValue
    recordInitializedDuringRender = true
  }

  const displayValue = fieldRendering.getVarDisplayValue(
    id,
    node,
    type,
    localRecord.var[id],
    inputKind,
    fieldKey,
  )
  const disabled = fieldRendering.isFieldDisabled(fieldKey)
  const extraClasses = [
    ...fieldRendering.fieldStateClasses(fieldKey),
    ...recordSearch.getFieldClasses(fieldKey),
  ]
  const canUseInternalAssignerControl = Boolean(meta?.enumOptions?.length)
    || ["number", "date", "datetime", "time", "text", "textarea", "scalar-list", "entity-ref", "checkbox", "boolean-select", "file", "code"].includes(inputKind)
  const fieldAssignerControl = resolveAssignerControl("var", fieldKey)
  const internalAssignerControl = canUseInternalAssignerControl ? fieldAssignerControl : null

  if (typePlugin?.renderField) {
    const pluginSupportsInternalAssignerControl = typePlugin.supportsInlineAssignerControl === true
    const pluginAssignerControl = pluginSupportsInternalAssignerControl ? fieldAssignerControl : null
    const pluginVNode = typePlugin.renderField({
      type,
      normalizedType: normalizeVarTypeName(type),
      fieldKey,
      node,
      value: localRecord.var[id],
      inputKind,
      fieldMeta: meta,
      currentUserName: props.currentUserName,
      now: props.now,
      readonly: props.readonly,
      disabled,
      locale: resolvedLocale.value,
      messages: resolvedMessages.value,
      record: localRecord,
      displayValue,
      extraClasses,
      placeholder,
      fieldState: effectiveFieldState.value[fieldKey],
      assignerControl: pluginAssignerControl
        ? renderAssignerButton(pluginAssignerControl, localRecord.var[id])
        : undefined,
      assignerStatus: pluginAssignerControl
        ? renderAssignerCloudStatusIcon(pluginAssignerControl)
        : undefined,
      assignerError: pluginAssignerControl?.state?.error,
      uploadFile: props.uploadFile,
      resolveFile: props.resolveFile,
      resolveFileInfo: props.resolveFileInfo,
      entityResolvers: props.entityResolvers,
      emitChange: emitVarChange,
      emitBlur: emitVarBlur,
    })

    if (pluginVNode) {
      const assignerVNode = pluginAssignerControl
        ? pluginVNode
        : withAssignerControl("var", fieldKey, localRecord.var[id], pluginVNode)
      return applyFieldAdapter("var", fieldKey, node, localRecord.var[id], assignerVNode)
    }
  }

  const vnode = h(AimdVarField, {
    node,
    value: localRecord.var[id] as any,
    disabled,
    extraClasses,
    messages: resolvedMessages.value,
    fieldMeta: meta,
    displayValue,
    inputKind,
    typePlugin,
    initialized: id in localRecord.var,
    assignerControl: internalAssignerControl
      ? renderAssignerButton(internalAssignerControl, localRecord.var[id])
      : undefined,
    assignerStatus: internalAssignerControl
      ? renderAssignerCloudStatusIcon(internalAssignerControl)
      : undefined,
    assignerError: internalAssignerControl?.state?.error,
    uploadFile: props.uploadFile,
    resolveFile: props.resolveFile,
    resolveFileInfo: props.resolveFileInfo,
    entityResolvers: props.entityResolvers,
    record: localRecord,
    onChange: (payload: { id: string, value: unknown, type: string, inputKind: string }) => {
      emitVarChange(payload.value)
    },
    onBlur: () => emitVarBlur(),
  })

  const assignerVNode = internalAssignerControl
    ? vnode
    : withAssignerControl("var", fieldKey, localRecord.var[id], vnode)
  return applyFieldAdapter("var", fieldKey, node, localRecord.var[id], assignerVNode)
}

function renderInlineVarTable(node: AimdVarTableNode): VNode {
  const tableName = node.id
  const fieldKey = `var_table:${tableName}`
  const columns = getVarTableColumns(node)
  const rows = tableDragDrop.ensureVarTableRows(tableName, columns)
  const disabled = fieldRendering.isFieldDisabled(fieldKey)
  const disabledColumns = columns.filter(column => !!effectiveFieldMeta.value[`var_table:${tableName}:${column}`]?.disabled)
  const tableAssignerControl = resolveAssignerControl("var_table", fieldKey)
  const extraClasses = [
    ...fieldRendering.fieldStateClasses(fieldKey),
    ...recordSearch.getFieldClasses(fieldKey),
  ]

  const vnode = h(AimdVarTableField, {
    node,
    rows,
    columns,
    disabled,
    readonly: props.readonly,
    extraClasses,
    settlingRowKey: tableDragDrop.getSettlingVarTableRowKey(),
    messages: resolvedMessages.value,
    fieldMeta: effectiveFieldMeta.value,
    fieldState: effectiveFieldState.value,
    assignerControl: tableAssignerControl
      ? renderAssignerButton(tableAssignerControl, rows)
      : undefined,
    assignerStatus: tableAssignerControl
      ? renderAssignerCloudStatusIcon(tableAssignerControl)
      : undefined,
    assignerError: tableAssignerControl?.state?.error,
    onCellInput: (payload: { tableName: string, column: string, rowIndex: number, value: string, row: Record<string, string> }) => {
      payload.row[payload.column] = payload.value
      markRecordChanged({ runClientAssigners: true })
      const validationFieldKey = getAimdVarTableCellFieldKey(payload.tableName, payload.rowIndex, payload.column)
      emit("field-change", {
        section: "var_table",
        fieldKey: `${payload.tableName}:${payload.column}`,
        value: payload.value,
        rowIndex: payload.rowIndex,
        column: payload.column,
      })
      triggerFieldValidation("change", validationFieldKey)
    },
    onCellPaste: (payload: { tableName: string, column: string, rowIndex: number, text: string }) => {
      const startColumnIndex = columns.indexOf(payload.column)
      if (startColumnIndex < 0) {
        return
      }

      const pastedGrid = parsePastedVarTableText(payload.text)
      const result = applyPastedVarTableGrid(
        rows,
        columns,
        payload.rowIndex,
        startColumnIndex,
        pastedGrid,
        { disabledColumns },
      )

      if (result.rowsAdded === 0 && result.changedCells.length === 0) {
        return
      }

      // Var tables are rendered through rebuilt inline VNodes, so pasted updates
      // need a refresh even when they only overwrite existing cells.
      markRecordChanged({ rebuild: true, runClientAssigners: true })
      for (let index = 0; index < result.rowsAdded; index += 1) {
        emit("table-add-row", { tableName: payload.tableName, columns })
      }
      for (const cell of result.changedCells) {
        const validationFieldKey = getAimdVarTableCellFieldKey(payload.tableName, cell.rowIndex, cell.column)
        emit("field-change", {
          section: "var_table",
          fieldKey: `${payload.tableName}:${cell.column}`,
          value: cell.value,
          rowIndex: cell.rowIndex,
          column: cell.column,
        })
        triggerFieldValidation("change", validationFieldKey)
      }
    },
    onCellBlur: (payload: { tableName: string, column: string, rowIndex: number }) => {
      emit("field-blur", {
        section: "var_table",
        fieldKey: `${payload.tableName}:${payload.column}`,
        rowIndex: payload.rowIndex,
        column: payload.column,
      })
      triggerFieldValidation("blur", getAimdVarTableCellFieldKey(payload.tableName, payload.rowIndex, payload.column))
    },
    onAddRow: (payload: { tableName: string, columns: string[] }) => {
      tableDragDrop.addVarTableRow(payload.tableName, payload.columns)
      triggerFieldValidation("change", `var_table:${payload.tableName}`)
    },
    onRemoveRow: (payload: { tableName: string, rowIndex: number, columns: string[] }) => {
      tableDragDrop.removeVarTableRow(payload.tableName, payload.rowIndex, payload.columns)
      triggerFieldValidation("change", `var_table:${payload.tableName}`)
    },
    onDragStart: (payload: { tableName: string, rowIndex: number, event: DragEvent }) => {
      tableDragDrop.startVarTableRowDrag(payload.tableName, payload.rowIndex, payload.event)
    },
    onDragOver: (payload: { tableName: string, rowIndex: number, event: DragEvent }) => {
      tableDragDrop.handleVarTableRowDragOver(payload.tableName, payload.rowIndex, payload.event)
    },
    onDragDrop: (payload: { tableName: string, rowIndex: number, columns: string[], event: DragEvent }) => {
      tableDragDrop.handleVarTableRowDrop(payload.tableName, payload.rowIndex, payload.columns, payload.event)
      triggerFieldValidation("change", `var_table:${payload.tableName}`)
    },
    onDragEnd: () => {
      tableDragDrop.endVarTableRowDrag()
    },
  })

  const assignerVNode = tableAssignerControl
    ? vnode
    : withAssignerControl("var_table", fieldKey, rows, vnode)
  return applyFieldAdapter("var_table", fieldKey, node, rows, assignerVNode)
}

function isGroupedStepBodyNode(node: unknown): node is VNode {
  if (!node || typeof node !== "object") {
    return false
  }

  const props = (node as VNode).props as Record<string, unknown> | null | undefined
  if (!props) {
    return false
  }

  const classNames = getVNodeClassNames(props.class)

  return props["data-aimd-step-body"] === "true"
    || props["data-aimd-step-body"] === true
    || props.dataAimdStepBody === "true"
    || props.dataAimdStepBody === true
    || classNames.some((className) => typeof className === "string" && className.includes("aimd-step-body"))
}

function normalizeStepBodyNodes(bodyNodes: VNodeChild[] = []): VNodeChild[] {
  if (bodyNodes.length === 0) {
    return []
  }

  const groupedBody = bodyNodes.find((child) => isGroupedStepBodyNode(child))
  if (!groupedBody || typeof groupedBody !== "object" || groupedBody === null) {
    return bodyNodes
  }

  const groupedChildren = (groupedBody as VNode).children
  if (Array.isArray(groupedChildren)) {
    return groupedChildren as VNodeChild[]
  }

  if (groupedChildren == null) {
    return []
  }

  return [groupedChildren as VNodeChild]
}

function isGroupedCheckBodyNode(node: unknown): node is VNode {
  if (!node || typeof node !== "object" || !("props" in node)) {
    return false
  }

  const props = (node as VNode).props as Record<string, unknown> | null | undefined
  if (!props) {
    return false
  }

  const classValue = props.class
  const classNames = Array.isArray(classValue)
    ? classValue
    : typeof classValue === "string"
      ? [classValue]
      : []

  return props["data-aimd-check-body"] === "true"
    || props["data-aimd-check-body"] === true
    || props.dataAimdCheckBody === "true"
    || props.dataAimdCheckBody === true
    || classNames.some((className) => typeof className === "string" && className.includes("aimd-check-body"))
}

function getVNodeClassNames(classValue: unknown): string[] {
  if (Array.isArray(classValue)) {
    return classValue.flatMap(item => getVNodeClassNames(item))
  }

  if (typeof classValue === "string") {
    return classValue.split(/\s+/).filter(Boolean)
  }

  if (classValue && typeof classValue === "object") {
    return Object.entries(classValue as Record<string, unknown>)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([className]) => className)
  }

  return []
}

function isDefaultCheckControlNode(node: unknown): boolean {
  if (!node || typeof node !== "object" || !("type" in node) || !("props" in node)) {
    return false
  }

  const vnode = node as VNode
  const props = vnode.props as Record<string, unknown> | null | undefined
  if (!props) {
    return false
  }

  const classNames = getVNodeClassNames(props.class)

  return (
    vnode.type === "input"
    && props.type === "checkbox"
    && classNames.includes("aimd-checkbox")
  ) || (
    vnode.type === "span"
    && classNames.includes("aimd-field__label")
  )
}

function normalizeCheckBodyNodes(bodyNodes: VNodeChild[] = []): VNodeChild[] {
  if (bodyNodes.length === 0) {
    return []
  }

  const groupedBody = bodyNodes.find((child) => isGroupedCheckBodyNode(child))
  if (groupedBody && typeof groupedBody === "object" && groupedBody !== null) {
    const groupedChildren = (groupedBody as VNode).children
    if (Array.isArray(groupedChildren)) {
      return groupedChildren as VNodeChild[]
    }

    if (groupedChildren == null) {
      return []
    }

    return [groupedChildren as VNodeChild]
  }

  const withoutDefaultControl = bodyNodes.filter(child => !isDefaultCheckControlNode(child))
  if (withoutDefaultControl.length !== bodyNodes.length) {
    return withoutDefaultControl
  }

  return bodyNodes
}

function renderInlineStep(node: AimdStepNode, bodyNodes: VNodeChild[] = []): VNode {
  const id = node.id
  const fieldKey = `step:${id}`
  if (!(id in localRecord.step)) {
    localRecord.step[id] = createEmptyStepRecordItem()
    recordInitializedDuringRender = true
  }

  const state = localRecord.step[id]
  const disabled = fieldRendering.isFieldDisabled(fieldKey)
  const extraClasses = [
    ...fieldRendering.fieldStateClasses(fieldKey),
    ...recordSearch.getFieldClasses(fieldKey),
  ]
  const normalizedBodyNodes = normalizeStepBodyNodes(bodyNodes)

  const vnode = h(AimdStepField, {
    node,
    state,
    bodyNodes: normalizedBodyNodes,
    disabled,
    extraClasses,
    detailDisplay: props.stepDetailDisplay,
    locale: resolvedLocale.value,
    messages: resolvedMessages.value,
    onCheckChange: (payload: { id: string, value: boolean }) => {
      const wasRunning = isStepTimerRunning(state)
      setStepChecked(state, payload.value, Date.now())
      timerNowMs.value = Date.now()
      markRecordChanged()
      emit("field-change", { section: "step", fieldKey: payload.id, value: payload.value })
      triggerFieldValidation("change", fieldKey)
      if (wasRunning) {
        emit("field-change", { section: "step", fieldKey: `${payload.id}:timer`, value: getStepTimerPayload(state) })
      }
    },
    onAnnotationChange: (payload: { id: string, value: string }) => {
      state.annotation = payload.value
      markRecordChanged()
      emit("field-change", { section: "step", fieldKey: `${payload.id}:annotation`, value: payload.value })
    },
    onTimerStart: (payload: { id: string }) => {
      if (!startStepTimer(state, Date.now())) {
        return
      }
      timerNowMs.value = Date.now()
      markRecordChanged()
      emit("field-change", { section: "step", fieldKey: `${payload.id}:timer`, value: getStepTimerPayload(state) })
    },
    onTimerPause: (payload: { id: string }) => {
      if (!pauseStepTimer(state, Date.now())) {
        return
      }
      timerNowMs.value = Date.now()
      markRecordChanged()
      emit("field-change", { section: "step", fieldKey: `${payload.id}:timer`, value: getStepTimerPayload(state) })
    },
    onTimerReset: (payload: { id: string }) => {
      if (!resetStepTimer(state)) {
        return
      }
      timerNowMs.value = Date.now()
      markRecordChanged()
      emit("field-change", { section: "step", fieldKey: `${payload.id}:timer`, value: getStepTimerPayload(state) })
    },
    onBlur: (payload: { id: string }) => {
      emit("field-blur", { section: "step", fieldKey: payload.id })
      triggerFieldValidation("blur", fieldKey)
    },
  })

  const assignerVNode = withAssignerControl("step", fieldKey, state, vnode)
  return applyFieldAdapter("step", fieldKey, node, state, assignerVNode)
}

function renderInlineCheck(node: AimdCheckNode, bodyNodes: VNodeChild[] = []): VNode {
  const id = node.id
  const fieldKey = `check:${id}`
  if (!(id in localRecord.check)) {
    localRecord.check[id] = createEmptyCheckRecordItem()
    recordInitializedDuringRender = true
  }

  const state = localRecord.check[id]
  const disabled = fieldRendering.isFieldDisabled(fieldKey)
  const extraClasses = [
    ...fieldRendering.fieldStateClasses(fieldKey),
    ...recordSearch.getFieldClasses(fieldKey),
  ]
  const normalizedBodyNodes = normalizeCheckBodyNodes(bodyNodes)

  const vnode = h(AimdCheckField, {
    node,
    state,
    bodyNodes: normalizedBodyNodes,
    disabled,
    extraClasses,
    locale: resolvedLocale.value,
    messages: resolvedMessages.value,
    onCheckChange: (payload: { id: string, value: boolean }) => {
      state.checked = payload.value
      markRecordChanged()
      emit("field-change", { section: "check", fieldKey: payload.id, value: payload.value })
      triggerFieldValidation("change", fieldKey)
    },
    onAnnotationChange: (payload: { id: string, value: string }) => {
      state.annotation = payload.value
      markRecordChanged()
      emit("field-change", { section: "check", fieldKey: `${payload.id}:annotation`, value: payload.value })
    },
    onBlur: (payload: { id: string }) => {
      emit("field-blur", { section: "check", fieldKey: payload.id })
      triggerFieldValidation("blur", fieldKey)
    },
  })

  const assignerVNode = withAssignerControl("check", fieldKey, state, vnode)
  return applyFieldAdapter("check", fieldKey, node, state, assignerVNode)
}

function renderInlineQuiz(node: AimdQuizNode): VNode {
  const quizId = node.id
  const fieldKey = `quiz:${quizId}`
  const quizField = {
    id: quizId,
    type: node.quizType,
    stem: node.stem,
    title: node.title,
    description: node.description,
    mode: node.mode,
    display: node.display,
    options: node.options,
    blanks: node.blanks,
    items: node.items,
    grading: node.grading,
    default: node.default,
    rubric: node.rubric,
    score: node.score,
    extra: node.extra,
  } as AimdQuizField

  if (!(quizId in localRecord.quiz)) {
    localRecord.quiz[quizId] = getQuizDefaultValue(quizField)
  }

  const vnode = h(AimdQuizRecorder, {
    class: "aimd-rec-inline aimd-rec-inline--quiz",
    extraClasses: recordSearch.getFieldClasses(fieldKey),
    quiz: quizField,
    modelValue: localRecord.quiz[quizId],
    grade: props.quizGrades?.[quizId] ?? null,
    submitted: props.submitted,
    readonly: props.readonly,
    focusKeyPrefix: `quiz:${quizId}`,
    locale: resolvedLocale.value,
    messages: props.messages,
    choiceOptionExplanationMode: props.choiceOptionExplanationMode,
    scaleGradeDisplayMode: props.scaleGradeDisplayMode,
    "onUpdate:modelValue": (value: unknown) => {
      localRecord.quiz[quizId] = value
      markRecordChanged({ rebuild: true })
      emit("field-change", { section: "quiz", fieldKey: quizId, value })
      triggerFieldValidation("change", fieldKey)
    },
  })

  return applyFieldAdapter("quiz", fieldKey, node, localRecord.quiz[quizId], vnode)
}

// ---------------------------------------------------------------------------
// Rebuild pipeline
// ---------------------------------------------------------------------------

async function rebuildInlineNodes(
  expectedRequestId?: number,
  focusSnapshot?: FocusSnapshot | null,
  expectedInlineRequestId?: number,
) {
  recordInitializedDuringRender = false
  const rendered = await renderToVue(props.content || "", {
    locale: resolvedLocale.value,
    groupStepBodies: true,
    groupCheckBodies: true,
    context: {
      mode: "edit",
      readonly: props.readonly,
      value: localRecord as Record<string, Record<string, unknown>>,
    },
    blockVarTypes: ["AiralogyMarkdown"],
    resolveAssetUrl: props.resolveFile,
    collectorContext: collectorValidationContext.value,
    elementRenderers: {
      pre: codeBlockPreRenderer,
    },
    aimdRenderers: {
      var: node => renderInlineVar(node as AimdVarNode),
      var_table: node => renderInlineVarTable(node as AimdVarTableNode),
      step: (node, _ctx, children) => renderInlineStep(node as AimdStepNode, children),
      check: (node, _ctx, children) => renderInlineCheck(node as AimdCheckNode, children),
      quiz: node => renderInlineQuiz(node as AimdQuizNode),
    },
  })

  if (
    (expectedRequestId !== undefined && expectedRequestId !== buildRequestId)
    || (expectedInlineRequestId !== undefined && expectedInlineRequestId !== inlineBuildRequestId)
  ) {
    return
  }

  inlineNodes.value = rendered.nodes
  await nextTick()
  restoreFocusSnapshot(contentRoot.value, focusSnapshot ?? null)

  if (recordInitializedDuringRender) emitRecordUpdate()
}

async function parseAndBuild() {
  const currentRequestId = ++buildRequestId
  const currentInlineRequestId = ++inlineBuildRequestId
  autoServerAssignerSignatures.clear()
  try {
    renderError.value = ""
    const contextFields = props.protocolContext
      ? parseAndExtract(props.protocolContext)
      : undefined
    collectorValidationContext.value = contextFields
      ? {
          connectors: contextFields.connectors,
          collectors: contextFields.collectors,
          step: contextFields.step,
        }
      : undefined
    const extracted = parseAndExtract([props.protocolContext, props.content].filter(Boolean).join("\n\n"))
    if (currentRequestId !== buildRequestId) return

    extractedFields.value = extracted
    clientAssigners.value = extracted.client_assigner || []
    internalValidationFieldState.value = {}
    emit("fields-change", extracted)

    const defaultsChanged = ensureDefaultsFromFields(localRecord, extracted)
    const assignerChanged = clientAssignerRunner.applyCurrentClientAssigners()
    if (defaultsChanged || assignerChanged) {
      emitRecordUpdate()
    }

    await rebuildInlineNodes(currentRequestId, undefined, currentInlineRequestId)
    scheduleAutoServerAssigners()
  } catch (error) {
    if (currentRequestId !== buildRequestId) {
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    renderError.value = message
    inlineNodes.value = []
    extractedFields.value = EMPTY_FIELDS
    collectorValidationContext.value = undefined
    clientAssigners.value = []
    emit("fields-change", EMPTY_FIELDS)
    emit("error", message)
  }
}

// ---------------------------------------------------------------------------
// Watchers
// ---------------------------------------------------------------------------

watch(
  () => props.modelValue,
  (value) => {
    const shouldRebuild = getRecordDataSignature(value) !== getRecordDataSignature(localRecord)
    if (!shouldRebuild) {
      return
    }
    syncingFromExternal = true
    applyIncomingRecord(localRecord, value)
    syncingFromExternal = false
    const assignerChanged = clientAssignerRunner.applyCurrentClientAssigners()
    if (assignerChanged) {
      emitRecordUpdate()
    }
    if (shouldRebuild || assignerChanged) {
      scheduleInlineRebuild()
    }
    scheduleAutoServerAssigners()
  },
  { deep: true, immediate: true },
)

watch(hasRunningStepTimer, () => {
  timerNowMs.value = Date.now()
  syncProtocolTimerTicker()
}, { immediate: true })

watch(
  () => ({
    content: props.content,
    protocolContext: props.protocolContext,
    locale: props.locale,
    messages: props.messages,
  }),
  () => {
    void parseAndBuild()
  },
  { immediate: true, deep: true },
)

watch(
  () => ({
    readonly: props.readonly,
    currentUserName: props.currentUserName,
    now: props.now,
    fieldMeta: props.fieldMeta,
    fieldState: props.fieldState,
    validationSchema: props.validationSchema,
    serverAssigners: props.serverAssigners,
    assigners: props.assigners,
    runServerAssigner: props.runServerAssigner,
    assignerRunner: props.assignerRunner,
    stepDetailDisplay: props.stepDetailDisplay,
    customRenderers: props.customRenderers,
    fieldAdapters: props.fieldAdapters,
    typePlugins: props.typePlugins,
    collectorProviders: props.collectorProviders,
  }),
  () => {
    scheduleInlineRebuild()
    scheduleAutoServerAssigners()
  },
  { deep: true },
)

watch(
  () => [props.content, props.protocolContext] as const,
  () => collectorRuntime.stopAll({ resetPermissions: true }),
)

watch(
  () => props.collectorRecordKey,
  () => collectorRuntime.stopAll({ resetPermissions: true }),
)

watch(
  () => props.readonly,
  readonly => {
    if (readonly) collectorRuntime.stopAll()
  },
)

watch(
  () => props.quizGrades,
  () => {
    scheduleInlineRebuild()
  },
  { deep: true },
)

watch(
  () => props.choiceOptionExplanationMode,
  () => {
    scheduleInlineRebuild()
  },
)

watch(
  () => props.scaleGradeDisplayMode,
  () => {
    scheduleInlineRebuild()
  },
)

watch(
  () => props.submitted,
  () => {
    scheduleInlineRebuild()
  },
)

onBeforeUnmount(() => {
  collectorRuntime.stopAll({ resetPermissions: true })
  for (const controller of serverAssignerAbortControllers.values()) {
    controller.abort()
  }
  serverAssignerAbortControllers.clear()
  if (protocolTimerTicker) {
    clearInterval(protocolTimerTicker)
  }
})

defineExpose({
  validate,
  validateField,
  clearValidation,
  focusFirstInvalidField,
  runClientAssigner: clientAssignerRunner.triggerClientAssigner,
  runManualClientAssigners: clientAssignerRunner.triggerManualClientAssigners,
  startCollector: collectorRuntime.start,
  stopCollector: collectorRuntime.stop,
})
</script>

<template>
  <div class="aimd-protocol-recorder">
    <div v-if="renderError" class="aimd-protocol-recorder__error">{{ renderError }}</div>

    <template v-else>
      <AimdRecorderSearchToolbar
        v-if="showRecordSearchToolbar"
        v-model:field-key="recordSearch.fieldKey.value"
        v-model:query="recordSearch.query.value"
        :field-refs="recordSearch.fieldRefs.value"
        :match-count="recordSearch.matches.value.length"
        :messages="resolvedMessages"
        :panel-visible="recordSearch.panelVisible.value"
        :result-label="recordSearch.resultLabel.value"
        @clear="recordSearch.clear"
        @collapse="recordSearch.collapse"
        @expand="recordSearch.expand"
        @next="recordSearch.focusNextMatch"
        @previous="recordSearch.focusPreviousMatch"
      />

      <div v-if="showProtocolTimingSummary" class="aimd-protocol-recorder__timing">
        <span
          v-if="protocolEstimatedDurationMs > 0"
          class="aimd-protocol-recorder__timing-pill aimd-protocol-recorder__timing-pill--estimate"
        >
          {{ resolvedMessages.step.protocolEstimatedTotal(protocolEstimatedDurationLabel) }}
        </span>
        <span
          v-if="protocolRecordedDurationMs > 0"
          class="aimd-protocol-recorder__timing-pill"
        >
          {{ resolvedMessages.step.protocolRecordedTotal(protocolRecordedDurationLabel) }}
        </span>
      </div>

      <div v-if="inlineNodes.length" ref="contentRoot" class="aimd-protocol-recorder__content aimd-renderer">
        <InlineNodesOutlet :nodes="inlineNodes" />
      </div>

      <div v-else class="aimd-protocol-recorder__empty">{{ resolvedMessages.common.emptyContent }}</div>
    </template>
  </div>
</template>
