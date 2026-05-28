<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onBeforeUnmount, reactive, ref, watch, type PropType, type VNode, type VNodeChild } from "vue"
import type {
  AimdCheckNode,
  AimdClientAssignerField,
  AimdQuizField,
  AimdQuizGradeResult,
  AimdQuizNode,
  AimdStepNode,
  AimdVarNode,
  AimdVarTableNode,
  ExtractedAimdFields,
} from "@airalogy/aimd-core/types"
import { parseAndExtract, renderToVue } from "@airalogy/aimd-renderer"
import type { AimdComponentRenderer } from "@airalogy/aimd-renderer"
import type { AimdRecorderMessagesInput } from "../locales"
import {
  createAimdRecorderMessages,
  resolveAimdRecorderLocale,
} from "../locales"
import type {
  AimdChoiceOptionExplanationMode,
  AimdFileUploadHandler,
  AimdFieldMeta,
  AimdFieldState,
  AimdRecorderFieldAdapters,
  AimdRecorderFieldType,
  AimdScaleGradeDisplayMode,
  AimdTypePlugin,
  AimdProtocolRecordData,
  AimdStepDetailDisplay,
  AimdStepRecordItem,
  FieldEventPayload,
  TableEventPayload,
} from "../types"
import { createEmptyProtocolRecordData } from "../types"
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
  captureFocusSnapshot,
  restoreFocusSnapshot,
} from "../composables/useFocusManagement"
import type { FocusSnapshot } from "../composables/useFocusManagement"
import { useClientAssignerRunner } from "../composables/useClientAssignerRunner"
import type { ClientAssignerFieldDefinitions } from "../client-assigner"
import { resolveAimdRecorderFieldVNode } from "../composables/useFieldAdapters"
import { useVarTableDragDrop, getVarTableColumns } from "../composables/useVarTableDragDrop"
import { useFieldRendering } from "../composables/useFieldRendering"
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
import AimdVarTableField from "./AimdVarTableField.vue"
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

  // ── Extension props ──────────────────────────────────────────────────────

  /**
   * Per-field metadata keyed by "section:fieldName" (e.g. "var:temp").
   * Controls inputType overrides, assigner mode, enum options, etc.
   */
  fieldMeta?: Record<string, AimdFieldMeta>

  /**
   * Per-field runtime state keyed by "section:fieldName".
   * Drives loading / error / validationError styling.
   */
  fieldState?: Record<string, AimdFieldState>

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
   * Resolves relative paths / Airalogy file IDs to displayable URLs.
   */
  resolveFile?: (src: string) => string | null

  /**
   * Uploads file-like var selections. Return the record value to store,
   * typically an Airalogy file ID or a structured file descriptor.
   */
  uploadFile?: AimdFileUploadHandler

  /**
   * Type-level plugins for custom var types.
   * Plugins can define initialization, normalization, display, parsing, and full custom field widgets.
   */
  typePlugins?: AimdTypePlugin[]
}>(), {
  modelValue: undefined,
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
  fieldMeta: undefined,
  fieldState: undefined,
  wrapField: undefined,
  customRenderers: undefined,
  fieldAdapters: undefined,
  resolveFile: undefined,
  uploadFile: undefined,
  typePlugins: undefined,
})

const emit = defineEmits<{
  /** Full record updated (v-model) */
  (e: "update:modelValue", value: AimdProtocolRecordData): void
  /** Extracted field list changed (content reparsed) */
  (e: "fields-change", fields: ExtractedAimdFields): void
  /** Parse / render error */
  (e: "error", message: string): void

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
let buildRequestId = 0
let inlineBuildRequestId = 0
let syncingFromExternal = false
let renderScheduled = false
let recordInitializedDuringRender = false
let pendingFocusSnapshot: FocusSnapshot | null = null
let pendingInlineBuildRequestId: number | null = null
const timerNowMs = ref(Date.now())
let protocolTimerTicker: ReturnType<typeof setInterval> | null = null

const resolvedLocale = computed(() => resolveAimdRecorderLocale(props.locale))
const resolvedMessages = computed(() => createAimdRecorderMessages(resolvedLocale.value, props.messages))
const resolvedTypePlugins = computed(() => createAimdTypePlugins(props.typePlugins))

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
  return resolveAimdRecorderFieldVNode(fieldType, fieldKey, node, value, defaultVNode, {
    fieldAdapters: props.fieldAdapters,
    wrapField: props.wrapField,
    readonly: props.readonly,
    locale: resolvedLocale.value,
    messages: resolvedMessages.value,
    record: localRecord,
    fieldMeta: props.fieldMeta,
    fieldState: props.fieldState,
  })
}

function getAssignerPayloadFieldKey(fieldType: AssignableRecorderFieldType, fieldKey: string): string {
  const prefix = `${fieldType}:`
  return fieldKey.startsWith(prefix) ? fieldKey.slice(prefix.length) : fieldKey
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
  const meta = props.fieldMeta?.[fieldKey]
  const payloadFieldKey = getAssignerPayloadFieldKey(fieldType, fieldKey)
  const clientAssigner = meta?.assigner ? undefined : getManualClientAssignerForField(fieldType, payloadFieldKey)
  if ((!meta?.assigner && !clientAssigner) || props.readonly) {
    return null
  }

  const state = props.fieldState?.[fieldKey]
  const loading = state?.loading === true
  const disabled = loading || state?.disabled === true
  const label = loading ? resolvedMessages.value.assigner.running : resolvedMessages.value.assigner.run
  const titleTarget = clientAssigner?.id ?? payloadFieldKey

  return {
    fieldType,
    fieldKey,
    payloadFieldKey,
    clientAssigner,
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
      if (control.clientAssigner) {
        assignerRunner.triggerClientAssigner(control.clientAssigner.id)
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
const clientAssigners = ref<AimdClientAssignerField[]>([])
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
const protocolEstimatedDurationMs = computed(() => getProtocolEstimatedDurationMs(extractedFields.value.step_hierarchy ?? []))
const protocolRecordedDurationMs = computed(() => getProtocolRecordedDurationMs(localRecord.step, timerNowMs.value))
const showProtocolTimingSummary = computed(() => protocolEstimatedDurationMs.value > 0 || protocolRecordedDurationMs.value > 0)
const protocolEstimatedDurationLabel = computed(() => formatStepDuration(protocolEstimatedDurationMs.value, resolvedLocale.value))
const protocolRecordedDurationLabel = computed(() => formatStepDuration(protocolRecordedDurationMs.value, resolvedLocale.value))
const hasRunningStepTimer = computed(() => Object.values(localRecord.step).some(step => isStepTimerRunning(step)))

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
  Promise.resolve().then(() => {
    renderScheduled = false
    const focusSnapshot = pendingFocusSnapshot
    const inlineRequestId = pendingInlineBuildRequestId ?? inlineBuildRequestId
    pendingFocusSnapshot = null
    pendingInlineBuildRequestId = null
    void rebuildInlineNodes(undefined, focusSnapshot, inlineRequestId)
  })
}

function markRecordChanged(options?: { rebuild?: boolean, runClientAssigners?: boolean }) {
  const assignerChanged = options?.runClientAssigners ? assignerRunner.applyCurrentClientAssigners() : false
  emitRecordUpdate()
  if (options?.rebuild || assignerChanged) {
    scheduleInlineRebuild()
  }
}

// ---------------------------------------------------------------------------
// Composables
// ---------------------------------------------------------------------------

const assignerRunner = useClientAssignerRunner({
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
  fieldMeta: () => props.fieldMeta,
  fieldState: () => props.fieldState,
  typePlugins: () => resolvedTypePlugins.value,
  wrapField: () => props.wrapField,
})

// ---------------------------------------------------------------------------
// Inline field renderers
// ---------------------------------------------------------------------------

function renderInlineVar(node: AimdVarNode): VNode {
  const id = node.id
  const fieldKey = `var:${id}`
  const meta = props.fieldMeta?.[fieldKey]

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
    markRecordChanged({ runClientAssigners: true })
    emit("field-change", { section: "var", fieldKey: id, value })
  }

  function emitVarBlur() {
    emit("field-blur", { section: "var", fieldKey: id })
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
  const extraClasses = fieldRendering.fieldStateClasses(fieldKey)
  const canUseInternalAssignerControl = Boolean(meta?.enumOptions?.length)
    || ["number", "date", "datetime", "time", "text", "textarea", "checkbox", "file"].includes(inputKind)
  const internalAssignerControl = canUseInternalAssignerControl
    ? resolveAssignerControl("var", fieldKey)
    : null

  if (typePlugin?.renderField) {
    const pluginSupportsInternalAssignerControl = typePlugin.supportsInlineAssignerControl === true
    const pluginAssignerControl = pluginSupportsInternalAssignerControl ? internalAssignerControl : null
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
      fieldState: props.fieldState?.[fieldKey],
      assignerControl: pluginAssignerControl
        ? renderAssignerButton(pluginAssignerControl, localRecord.var[id])
        : undefined,
      assignerStatus: pluginAssignerControl
        ? renderAssignerCloudStatusIcon(pluginAssignerControl)
        : undefined,
      assignerError: pluginAssignerControl?.state?.error,
      uploadFile: props.uploadFile,
      resolveFile: props.resolveFile,
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
  const disabledColumns = columns.filter(column => !!props.fieldMeta?.[`var_table:${tableName}:${column}`]?.disabled)

  const vnode = h(AimdVarTableField, {
    node,
    rows,
    columns,
    disabled,
    readonly: props.readonly,
    settlingRowKey: tableDragDrop.getSettlingVarTableRowKey(),
    messages: resolvedMessages.value,
    fieldMeta: props.fieldMeta,
    fieldState: props.fieldState,
    onCellInput: (payload: { tableName: string, column: string, rowIndex: number, value: string, row: Record<string, string> }) => {
      payload.row[payload.column] = payload.value
      markRecordChanged({ runClientAssigners: true })
      emit("field-change", {
        section: "var_table",
        fieldKey: `${payload.tableName}:${payload.column}`,
        value: payload.value,
      })
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
        emit("field-change", {
          section: "var_table",
          fieldKey: `${payload.tableName}:${cell.column}`,
          value: cell.value,
        })
      }
    },
    onCellBlur: (payload: { tableName: string, column: string }) => {
      emit("field-blur", { section: "var_table", fieldKey: `${payload.tableName}:${payload.column}` })
    },
    onAddRow: (payload: { tableName: string, columns: string[] }) => {
      tableDragDrop.addVarTableRow(payload.tableName, payload.columns)
    },
    onRemoveRow: (payload: { tableName: string, rowIndex: number, columns: string[] }) => {
      tableDragDrop.removeVarTableRow(payload.tableName, payload.rowIndex, payload.columns)
    },
    onDragStart: (payload: { tableName: string, rowIndex: number, event: DragEvent }) => {
      tableDragDrop.startVarTableRowDrag(payload.tableName, payload.rowIndex, payload.event)
    },
    onDragOver: (payload: { tableName: string, rowIndex: number, event: DragEvent }) => {
      tableDragDrop.handleVarTableRowDragOver(payload.tableName, payload.rowIndex, payload.event)
    },
    onDragDrop: (payload: { tableName: string, rowIndex: number, columns: string[], event: DragEvent }) => {
      tableDragDrop.handleVarTableRowDrop(payload.tableName, payload.rowIndex, payload.columns, payload.event)
    },
    onDragEnd: () => {
      tableDragDrop.endVarTableRowDrag()
    },
  })

  const assignerVNode = withAssignerControl("var_table", fieldKey, rows, vnode)
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
  const extraClasses = fieldRendering.fieldStateClasses(fieldKey)
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
  const extraClasses = fieldRendering.fieldStateClasses(fieldKey)
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
    },
    onAnnotationChange: (payload: { id: string, value: string }) => {
      state.annotation = payload.value
      markRecordChanged()
      emit("field-change", { section: "check", fieldKey: `${payload.id}:annotation`, value: payload.value })
    },
    onBlur: (payload: { id: string }) => {
      emit("field-blur", { section: "check", fieldKey: payload.id })
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
  try {
    renderError.value = ""
    const extracted = parseAndExtract(props.content || "")
    if (currentRequestId !== buildRequestId) return

    extractedFields.value = extracted
    clientAssigners.value = extracted.client_assigner || []
    emit("fields-change", extracted)

    const defaultsChanged = ensureDefaultsFromFields(localRecord, extracted)
    const assignerChanged = assignerRunner.applyCurrentClientAssigners()
    if (defaultsChanged || assignerChanged) {
      emitRecordUpdate()
    }

    await rebuildInlineNodes(currentRequestId, undefined, currentInlineRequestId)
  } catch (error) {
    if (currentRequestId !== buildRequestId) {
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    renderError.value = message
    inlineNodes.value = []
    extractedFields.value = EMPTY_FIELDS
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
    const assignerChanged = assignerRunner.applyCurrentClientAssigners()
    if (assignerChanged) {
      emitRecordUpdate()
    }
    if (shouldRebuild || assignerChanged) {
      scheduleInlineRebuild()
    }
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
    stepDetailDisplay: props.stepDetailDisplay,
    customRenderers: props.customRenderers,
    fieldAdapters: props.fieldAdapters,
    typePlugins: props.typePlugins,
  }),
  () => {
    scheduleInlineRebuild()
  },
  { deep: true },
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
  if (protocolTimerTicker) {
    clearInterval(protocolTimerTicker)
  }
})

defineExpose({
  runClientAssigner: assignerRunner.triggerClientAssigner,
  runManualClientAssigners: assignerRunner.triggerManualClientAssigners,
})
</script>

<template>
  <div class="aimd-protocol-recorder">
    <div v-if="renderError" class="aimd-protocol-recorder__error">{{ renderError }}</div>

    <template v-else>
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

      <div v-if="inlineNodes.length" ref="contentRoot" class="aimd-protocol-recorder__content">
        <InlineNodesOutlet :nodes="inlineNodes" />
      </div>

      <div v-else class="aimd-protocol-recorder__empty">{{ resolvedMessages.common.emptyContent }}</div>
    </template>
  </div>
</template>

<style scoped>
.aimd-protocol-recorder {
  --rec-text: #253041;
  --rec-muted: #667085;
  --rec-border: #e3e8ef;
  --rec-focus: #2f6fed;
  --rec-error: #e03050;
  --rec-body-font-size: 14px;
  --rec-var-control-height: 30px;
  --rec-var-value-font-size: var(--rec-body-font-size);
  --rec-var-single-line-height: 1.4;
  --rec-var-text-wrap-line-height: 1.4;
}

.aimd-protocol-recorder__error {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #f4b3c1;
  background: #fff3f6;
  color: #b4234d;
  font-size: 13px;
}

.aimd-protocol-recorder__timing {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.aimd-protocol-recorder__timing-pill {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid #d5dde8;
  border-radius: 999px;
  background: #f8fafc;
  color: #334155;
  font-size: 12px;
  font-weight: 600;
}

.aimd-protocol-recorder__timing-pill--estimate {
  border-color: #f1d39a;
  background: #fff8ea;
  color: #9a5800;
}

.aimd-protocol-recorder__content {
  padding: 18px 20px;
  border: 1px solid var(--rec-border);
  border-radius: 14px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  color: var(--rec-text);
  font-size: var(--rec-body-font-size);
  line-height: 1.7;
}

.aimd-protocol-recorder__empty {
  padding: 24px;
  border: 1px dashed #d7dbe3;
  border-radius: 8px;
  color: #7b8595;
  text-align: center;
}

/* ── Typography ─────────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(h1) { margin: 0.45em 0 0.5em; font-size: 1.7em; line-height: 1.25; }
.aimd-protocol-recorder__content :deep(h2) { margin: 0.8em 0 0.45em; font-size: 1.35em; line-height: 1.3; }
.aimd-protocol-recorder__content :deep(h3) { margin: 0.7em 0 0.4em; font-size: 1.15em; }
.aimd-protocol-recorder__content :deep(p) { margin: 0.45em 0; color: var(--rec-text); }
.aimd-protocol-recorder__content :deep(ul),
.aimd-protocol-recorder__content :deep(ol) { margin: 0.35em 0; padding-left: 22px; }
.aimd-protocol-recorder__content :deep(table) { border-collapse: collapse; margin: 10px 0; font-size: 14px; }
.aimd-protocol-recorder__content :deep(th),
.aimd-protocol-recorder__content :deep(td) { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
.aimd-protocol-recorder__content :deep(th) { background: #f8fafc; }
.aimd-protocol-recorder__content :deep(blockquote) { margin: 8px 0; padding: 8px 12px; border-left: 3px solid #d8dee8; color: #666; background: #fafbfc; }
.aimd-protocol-recorder__content :deep(code) { background: #f0f2f5; border-radius: 4px; padding: 2px 5px; }

/* ── Field base ─────────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(.aimd-field) {
  border-radius: 10px;
  margin: 6px 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
}
.aimd-protocol-recorder__content :deep(.aimd-field__scope) {
  border-radius: 6px;
  padding: 1px 7px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-transform: lowercase;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field) {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 0;
  vertical-align: middle;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field--var) {
  align-items: flex-end;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field--var_table),
.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field--step),
.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field--check) {
  display: flex;
  align-items: flex-start;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field__control) {
  min-width: 0;
  flex: 1 1 auto;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field--var .aimd-rec-assigner-field__control) {
  flex: 0 1 auto;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field__button) {
  display: inline-flex;
  flex: 0 0 auto;
  width: 30px;
  min-width: 30px;
  height: 34px;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid #2563eb;
  border-radius: 7px 0 0 7px;
  margin-right: -1px;
  background: #2563eb;
  color: #ffffff;
  cursor: pointer;
  font-size: 17px;
  line-height: 1;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
  transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field__button:hover:not(:disabled)) {
  border-color: #1d4ed8;
  background: #1d4ed8;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field__button:focus-visible) {
  outline: 2px solid rgba(37, 99, 235, 0.35);
  outline-offset: 2px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field__button:disabled) {
  cursor: not-allowed;
  opacity: 0.7;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field__icon) {
  display: block;
  width: 1em;
  height: 1em;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field__label) {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field__spinner) {
  width: 15px;
  height: 15px;
  border: 2px solid rgba(255, 255, 255, 0.38);
  border-top-color: #ffffff;
  border-radius: 999px;
  animation: aimd-rec-assigner-spin 0.75s linear infinite;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field__error) {
  min-width: 0;
  margin-left: 8px;
  color: #b42318;
  font-size: 12px;
  line-height: 1.35;
}

@keyframes aimd-rec-assigner-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── Field colours ──────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(.aimd-field--var) { background: #f3f8ff; border-color: #c9dcff; color: #1c4e90; }
.aimd-protocol-recorder__content :deep(.aimd-field--var .aimd-field__scope) { background: #dceaff; color: #255eab; }
.aimd-protocol-recorder__content :deep(.aimd-field--step) { background: #fff9ef; border-color: #f4d9a8; color: #9a5800; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--step > .aimd-step-field__main .aimd-rec-inline__check-wrap > .aimd-field__scope) { background: #ffe8bf; color: #9a5800; }
.aimd-protocol-recorder__content :deep(.aimd-field--check) { background: #fffafa; border-color: rgba(185, 28, 28, 0.2); color: #2b3443; padding: 3px 8px; }
.aimd-protocol-recorder__content :deep(.aimd-field--check .aimd-field__scope) { background: #fee2e2; color: #991b1b; }
.aimd-protocol-recorder__content :deep(.aimd-field--check.aimd-rec-inline--check-passed) { background: #f6fdf9; border-color: rgba(22, 101, 52, 0.22); color: #1f3d2a; }
.aimd-protocol-recorder__content :deep(.aimd-field--check.aimd-rec-inline--check-passed .aimd-field__scope) { background: #dcfce7; color: #166534; }
.aimd-protocol-recorder__content :deep(.aimd-field--var-table) {
  display: block;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(251, 252, 251, 0.98) 100%);
  border: 1px solid #dee7df;
  color: #334155;
  border-radius: 16px;
  padding: 12px 14px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 8px 24px rgba(15, 23, 42, 0.025);
}
.aimd-protocol-recorder__content :deep(.aimd-field--var-table .aimd-field__scope) {
  background: #edf6ee;
  color: #446a4f;
}
.aimd-protocol-recorder__content :deep(.aimd-field--var-table .aimd-field__name) {
  color: #1f2937;
}
.aimd-protocol-recorder__content :deep(.aimd-field--var-table .aimd-field__header) {
  display: inline-flex;
  flex-wrap: wrap;
  max-width: 100%;
}
.aimd-protocol-recorder__content :deep(.aimd-field--var-table .aimd-field__table-preview),
.aimd-protocol-recorder__content :deep(.aimd-field--var-table .aimd-rec-card-list) {
  width: 100%;
  max-width: 100%;
}
/* ── Error & loading ────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--error) { border-color: var(--rec-error) !important; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--error:focus-within) { box-shadow: 0 0 0 2px rgba(224, 48, 80, 0.12); }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--loading) { opacity: 0.6; pointer-events: none; }
.aimd-protocol-recorder__content :deep(.aimd-rec-table-cell-input--error) { border-color: var(--rec-error) !important; }

/* ── Inline layout ──────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(.aimd-rec-inline) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 5px 3px;
  vertical-align: middle;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-multiline) { align-items: flex-start; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked) {
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  margin: 5px 3px;
  width: fit-content;
  min-width: 0;
  max-width: 100%;
  border: 1px solid var(--aimd-border-color, #90caf9);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: none;
  background: #f7fbff;
}
/* Metadata popovers need to escape the compact field; plain fields clip child backgrounds so corners stay clean. */
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked:has(.aimd-field__metadata-host)) {
  overflow: visible;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked--textarea) { min-width: 0; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked--checkbox) { width: fit-content; min-width: 0; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked:focus-within) {
  border-color: var(--aimd-border-color-focus, #4181fd);
  box-shadow: 0 0 0 2px rgba(65, 129, 253, 0.14);
}
	.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked .aimd-field) { margin: 0; box-shadow: none; }
	.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked .aimd-field--no-style.aimd-field__label) { min-height: 30px; border-radius: 6px 6px 0 0; }
	.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked .aimd-field__scope) { align-self: center; height: 22px; margin-left: 3px; padding: 0 7px; border-radius: 6px; }
	.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked .aimd-field__name) {
	  display: flex;
	  flex: 1;
	  align-items: center;
	  min-width: 0;
	  padding: 4px 10px 4px 6px;
	  font-size: 13px;
	  font-weight: 600;
	  color: #1565c0;
	  white-space: nowrap;
	}
	.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked .aimd-field__name--with-metadata) {
	  align-items: flex-start;
	  justify-content: center;
	  gap: 2px;
	  min-height: 34px;
	  white-space: normal;
	}
	.aimd-protocol-recorder__content :deep(.aimd-field__key) {
	  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
	  font-size: 11px;
	  font-weight: 500;
	  line-height: 1.2;
	  color: #64748b;
	}
	.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked .aimd-field__id) { display: flex; flex: 1; align-items: center; padding: 0 10px 0 6px; font-size: 13px; font-weight: 500; color: #1565c0; white-space: nowrap; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-markdown) {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  width: min(100%, 1040px);
  max-width: 100%;
  margin: 12px 0;
  vertical-align: top;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked--code) {
  width: min(100%, 980px);
  min-width: min(420px, 100%);
  max-width: 100%;
  margin: 12px 0;
  vertical-align: top;
}

/* ── Stacked input controls ─────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input--stacked) {
  width: 100%;
  min-width: 0;
  height: var(--rec-var-control-height);
  font: inherit;
  font-size: var(--rec-var-value-font-size);
  font-weight: 400;
  line-height: var(--rec-var-single-line-height);
  color: var(--rec-text);
  border: 0 none;
  border-top: 1px solid var(--aimd-border-color, #90caf9);
  border-radius: 0 0 6px 6px;
  margin: 0;
  box-shadow: none;
  padding: 0 10px;
  background: #fff;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input--stacked:focus) { border-color: var(--aimd-border-color, #90caf9); box-shadow: none; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea--stacked:not(.aimd-rec-inline__textarea--stacked-text)) {
  width: 100%;
  min-width: 0;
  min-height: 82px;
  font: inherit;
  font-size: var(--rec-var-value-font-size);
  font-weight: 400;
  line-height: var(--rec-var-text-wrap-line-height);
  color: var(--rec-text);
  border: 0 none;
  border-top: 1px solid var(--aimd-border-color, #90caf9);
  border-radius: 0 0 6px 6px;
  margin: 0;
  box-shadow: none;
  padding: 8px 10px;
  background: #fff;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea--stacked-text) {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: var(--rec-var-control-height);
  font: inherit;
  font-size: var(--rec-var-value-font-size);
  font-weight: 400;
  line-height: var(--rec-var-text-wrap-line-height);
  color: var(--rec-text);
  border: 0 none;
  border-top: 1px solid var(--aimd-border-color, #90caf9);
  border-radius: 0 0 6px 6px;
  margin: 0;
  box-shadow: none;
  padding: 5px 10px;
  background: #fff;
  box-sizing: border-box;
  resize: none;
  overflow: hidden;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea--stacked:focus) { border-color: var(--aimd-border-color, #90caf9); box-shadow: none; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__checkbox-row) {
  display: flex;
  align-items: center;
  min-height: 38px;
  padding: 0 10px;
  border-top: 1px solid var(--aimd-border-color, #90caf9);
  background: #fff;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__file-control) {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  min-height: var(--rec-var-control-height);
  padding: 0 8px;
  border-top: 1px solid var(--aimd-border-color, #90caf9);
  border-radius: 0 0 6px 6px;
  box-sizing: border-box;
  background: #fff;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__trigger) {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  min-height: var(--rec-var-control-height);
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__trigger--disabled) {
  cursor: not-allowed;
  opacity: 0.72;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__input) {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__badge) {
  display: inline-flex;
  flex: 0 0 auto;
  min-width: 38px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  border-radius: 6px;
  background: #e3f2fd;
  color: #1565c0;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__badge--csv),
.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__badge--text) {
  background: #e0f2fe;
  color: #0369a1;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__badge--image) {
  background: #dcfce7;
  color: #15803d;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__badge--audio),
.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__badge--video) {
  background: #fef3c7;
  color: #a16207;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__badge--document) {
  background: #ede9fe;
  color: #6d28d9;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__name) {
  min-width: 0;
  overflow: hidden;
  color: var(--rec-text);
  font-size: var(--rec-var-value-font-size);
  font-weight: 400;
  line-height: var(--rec-var-single-line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__name--placeholder) {
  color: #94a3b8;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__link),
.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__clear) {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  line-height: 1;
  text-decoration: none;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__clear) {
  width: 24px;
  padding: 0;
  cursor: pointer;
  font-size: 18px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__link:hover),
.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__clear:hover) {
  background: #f1f5f9;
  color: #1f2937;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-file-field__error) {
  flex: 0 0 auto;
  color: #dc2626;
  font-size: 12px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline--has-assigner-control) {
  overflow: hidden;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__control-row) {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: var(--rec-var-control-height);
  align-items: stretch;
  border-top: 1px solid var(--aimd-border-color, #90caf9);
  border-radius: 0 0 6px 6px;
  overflow: hidden;
  background: #fff;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__assigner-prefix) {
  display: flex;
  flex: 0 0 36px;
  align-items: stretch;
  justify-content: stretch;
  border-right: 1px solid #e2e8f0;
  background: #f8fafc;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__control-main) {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: stretch;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__assigner-status) {
  display: flex;
  flex: 0 0 30px;
  align-items: center;
  justify-content: center;
  border-left: 1px solid #e2e8f0;
  background: #fff;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__control-row .aimd-rec-inline__input--stacked),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__control-row .aimd-rec-inline__textarea--stacked),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__control-row .aimd-rec-inline__checkbox-row),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__control-row .aimd-rec-inline__file-control) {
  width: 100%;
  height: auto;
  min-height: var(--rec-var-control-height);
  flex: 1 1 auto;
  border-top: 0;
  border-radius: 0;
  background: transparent;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__control-row .aimd-rec-inline__checkbox-row) {
  padding: 0 10px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__assigner-prefix .aimd-rec-assigner-field__button) {
  width: 100%;
  min-width: 0;
  height: auto;
  min-height: var(--rec-var-control-height);
  border: 0;
  border-radius: 0;
  margin: 0;
  background: transparent;
  color: #1976d2;
  font-size: 17px;
  box-shadow: none;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__assigner-prefix .aimd-rec-assigner-field__button:hover:not(:disabled)) {
  background: #eff6ff;
  color: #1565c0;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__assigner-prefix .aimd-rec-assigner-field__button:disabled) {
  opacity: 0.68;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__assigner-prefix .aimd-rec-assigner-field__spinner) {
  border-color: rgba(25, 118, 210, 0.25);
  border-top-color: #1976d2;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field__status) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 17px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field__status--done) {
  color: #16a34a;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field__status--error) {
  color: #dc2626;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-assigner-field__status-spinner) {
  width: 15px;
  height: 15px;
  border: 2px solid rgba(25, 118, 210, 0.2);
  border-top-color: #1976d2;
  border-radius: 999px;
  animation: aimd-rec-assigner-spin 0.75s linear infinite;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline__assigner-error) {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 4px 8px;
  border-top: 1px solid #fecaca;
  background: #fff7f7;
  color: #b42318;
  font-size: 12px;
  line-height: 1.35;
}

/* ── Select ─────────────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__select) { appearance: auto; cursor: pointer; height: var(--rec-var-control-height); padding: 0 8px; background: #fff; }

/* ── Step / check ───────────────────────────────────────────────────────── */
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--step),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--check) { gap: 8px; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--check) {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  width: min(100%, 1040px);
  max-width: 100%;
  margin: 10px 0;
  padding: 10px 12px;
  border: 1px solid rgba(185, 28, 28, 0.2);
  border-left-width: 3px;
  border-radius: 14px;
  background: #fffafa;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 8px 24px rgba(185, 28, 28, 0.025);
  box-sizing: border-box;
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--check-passed) {
  border-color: rgba(22, 101, 52, 0.22);
  background: #f6fdf9;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 8px 24px rgba(22, 101, 52, 0.035);
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__main) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--check > .aimd-rec-inline__check-wrap) {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__header) {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px 12px;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--check-bodyless .aimd-check-field__header) {
  align-items: center;
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__actions) {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__toggle) {
  gap: 8px;
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__toggle-btn) {
  color: #475569;
  border-color: rgba(100, 116, 139, 0.2);
  background: rgba(255, 255, 255, 0.82);
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__toggle-btn:hover:not(:disabled)) {
  border-color: rgba(100, 116, 139, 0.34);
  background: rgba(255, 255, 255, 0.96);
  color: #334155;
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__key) {
  font-size: 12px;
  font-weight: 600;
  color: #4f5f77;
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__body) {
  min-width: 0;
  color: var(--rec-text);
  font-size: 14px;
  line-height: 1.65;
  transition: color 0.2s ease, opacity 0.2s ease, text-decoration-color 0.2s ease;
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__body p) {
  margin: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__body--checked) {
  color: #24563e;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--check > .aimd-rec-inline__check-wrap > .aimd-field__name),
.aimd-protocol-recorder__content :deep(.aimd-check-field__body) {
  min-width: 0;
  overflow-wrap: anywhere;
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__banner) {
  padding: 8px 10px;
  border: 1px solid rgba(22, 101, 52, 0.16);
  border-radius: 10px;
  background: rgba(236, 253, 245, 0.92);
  color: #166534;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__details) {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding-top: 10px;
  border-top: 1px solid rgba(185, 28, 28, 0.1);
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--check-passed .aimd-check-field__details) {
  border-top-color: rgba(22, 101, 52, 0.12);
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__detail--annotation) {
  display: flex;
  width: 100%;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-check-field__annotation-editor) {
  width: 100%;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--step) {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  width: min(100%, 1040px);
  max-width: 100%;
  margin: 16px 0;
  padding: 14px 16px 16px;
  border: 1px solid #f1d6a1;
  border-radius: 18px;
  background: #fff;
  box-shadow: none;
  color: var(--rec-text);
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__main) {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px 14px;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__main-meta) {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__main-actions) {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__body) {
  min-width: 0;
  color: var(--rec-text);
  font-size: 15px;
  line-height: 1.72;
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__body .aimd-step-body) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__body p) {
  margin: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__details) {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding-top: 12px;
  border-top: 1px solid rgba(154, 88, 0, 0.12);
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__detail--timer) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__detail--annotation) {
  display: flex;
  width: 100%;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--quiz) { display: block; margin: 12px 0; padding: 0; border: none; background: transparent; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--quiz.aimd-field--quiz) { border-radius: 12px; border-color: #f6ddb0; background: #fffdf6; padding: 10px 12px; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__check-wrap) {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__step-num) { font-weight: 600; color: #9a5800; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--step > .aimd-step-field__main .aimd-rec-inline__check-wrap > .aimd-field__name) {
  font-size: 1.02rem;
  font-weight: 700;
  line-height: 1.3;
  color: #7b4300;
  overflow-wrap: anywhere;
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__pill) {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(154, 88, 0, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #8a5a12;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__pill--estimate) {
  background: rgba(255, 244, 222, 0.95);
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__pill--actual) {
  color: #6b7280;
  border-color: rgba(107, 114, 128, 0.16);
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__pill--running) {
  color: #14532d;
  border-color: rgba(22, 101, 52, 0.2);
  background: rgba(236, 253, 245, 0.96);
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__hero) {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid rgba(154, 88, 0, 0.18);
  border-radius: 999px;
  background: rgba(255, 247, 237, 0.96);
  color: #9a5800;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__hero--countdown) {
  border-color: rgba(154, 88, 0, 0.18);
  background: rgba(255, 247, 237, 0.96);
  color: #9a5800;
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__hero--warning) {
  border-color: rgba(180, 83, 9, 0.26);
  background: rgba(255, 251, 235, 0.98);
  color: #b45309;
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__hero--overtime) {
  border-color: rgba(185, 28, 28, 0.24);
  background: rgba(254, 242, 242, 0.98);
  color: #b91c1c;
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__controls) {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__btn) {
  border: 1px solid #d1d9e6;
  border-radius: 999px;
  min-height: 28px;
  padding: 0 10px;
  background: #fff;
  color: #334155;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s, color 0.2s;
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__btn:hover:not(:disabled)) {
  border-color: #9db1cc;
  background: #f7faff;
  color: #1f4f8f;
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__btn:disabled) {
  opacity: 0.45;
  cursor: not-allowed;
}
.aimd-protocol-recorder__content :deep(.aimd-step-timer__btn--ghost) {
  background: transparent;
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__toggle) {
  color: #8a5a12;
  border-color: rgba(154, 88, 0, 0.18);
  background: rgba(255, 255, 255, 0.82);
}
.aimd-protocol-recorder__content :deep(.aimd-step-field__toggle:hover:not(:disabled)) {
  border-color: rgba(154, 88, 0, 0.34);
  background: rgba(255, 248, 235, 0.98);
  color: #7b4300;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline input[type="checkbox"]),
.aimd-protocol-recorder__content :deep(.aimd-checkbox) { width: 16px; height: 16px; accent-color: var(--rec-focus); }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--check-open .aimd-checkbox) { accent-color: #dc2626; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--check-passed .aimd-checkbox) { accent-color: #16a34a; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input) {
  height: 30px;
  min-width: 94px;
  padding: 0 10px;
  border: 1px solid #c8d3e1;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  background: #fff;
  color: var(--rec-text);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input::placeholder) { color: #98a2b3; }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input:focus) { border-color: var(--rec-focus); box-shadow: 0 0 0 2px rgba(47, 111, 237, 0.12); }
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var .aimd-rec-inline__input) { width: clamp(120px, 28vw, 280px); }
.aimd-protocol-recorder__content :deep(.aimd-step-field__annotation-editor) {
  width: 100%;
  min-width: 0;
}

@media (max-width: 640px) {
  .aimd-protocol-recorder__content :deep(.aimd-step-field__details) {
    padding-top: 10px;
  }
  .aimd-protocol-recorder__content :deep(.aimd-step-field__main) {
    flex-direction: column;
  }
  .aimd-protocol-recorder__content :deep(.aimd-step-field__main-actions) {
    justify-content: flex-start;
  }
  .aimd-protocol-recorder__content :deep(.aimd-rec-inline--check) {
    gap: 10px;
  }
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__input.aimd-rec-inline__input--stacked),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__textarea.aimd-rec-inline__textarea--stacked) {
  border: 0 none;
  border-top: 1px solid var(--aimd-border-color, #90caf9);
  border-radius: 0 0 6px 6px;
  box-shadow: none;
  font-family: inherit;
  outline: none;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline--var-stacked .aimd-rec-inline__value-control) {
  font: inherit;
  font-size: var(--rec-var-value-font-size);
  font-weight: 400;
  color: var(--rec-text);
  letter-spacing: 0;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__value-control::-webkit-datetime-edit),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__value-control::-webkit-datetime-edit-fields-wrapper),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__value-control::-webkit-datetime-edit-text),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__value-control::-webkit-datetime-edit-year-field),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__value-control::-webkit-datetime-edit-month-field),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__value-control::-webkit-datetime-edit-day-field),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__value-control::-webkit-datetime-edit-hour-field),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__value-control::-webkit-datetime-edit-minute-field),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__value-control::-webkit-datetime-edit-second-field),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__value-control::-webkit-datetime-edit-ampm-field) {
  font: inherit;
  line-height: inherit;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__control-row .aimd-rec-inline__input.aimd-rec-inline__input--stacked),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__control-row .aimd-rec-inline__textarea.aimd-rec-inline__textarea--stacked) {
  border: 0 none;
  border-radius: 0;
  box-shadow: none;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__control-row .aimd-rec-inline__input.aimd-rec-inline__input--stacked:focus),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline__control-row .aimd-rec-inline__textarea.aimd-rec-inline__textarea--stacked:focus) {
  border: 0 none;
  box-shadow: none;
  outline: none;
}
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__table td) {
  vertical-align: middle;
  transition:
    background-color 0.2s ease,
    box-shadow 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.2s ease;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__table th) {
  vertical-align: middle;
  padding-top: 8px;
  padding-bottom: 8px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__table) {
  width: max-content;
  min-width: 100%;
  table-layout: auto;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__table col) {
  transition: width 0.18s ease;
}

	.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__column-head) {
	  color: #64748b;
	  font-size: 11px;
	  font-weight: 700;
	  letter-spacing: 0;
	  text-transform: none;
	  white-space: nowrap;
	  padding-left: 6px;
	  padding-right: 6px;
	}

	.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__column-label) {
	  display: inline-flex;
	  flex-direction: column;
	  align-items: flex-start;
	  gap: 2px;
	  max-width: 100%;
	  line-height: 1.25;
	  white-space: normal;
	}

	.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__column-label .aimd-field__title) {
	  font-weight: 700;
	  color: #475569;
	}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__column-head--compact) {
  text-align: center;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__column-head--wide) {
  letter-spacing: 0.06em;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-col) {
  width: 44px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__action-col) {
  width: 56px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-head),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-cell) {
  width: 34px;
  text-align: center;
  vertical-align: middle;
  padding-left: 0;
  padding-right: 0;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__action-head),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__action-cell) {
  width: 40px;
  text-align: center;
  padding-left: 0;
  padding-right: 0;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row--alt .aimd-rec-inline-table__value-cell) {
  background: rgba(248, 250, 252, 0.2);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__value-cell) {
  position: relative;
  min-width: 0;
  padding-top: 6px;
  padding-bottom: 6px;
  padding-left: 6px;
  padding-right: 6px;
  transition: background-color 0.18s ease, box-shadow 0.18s ease;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__value-cell--compact) {
  text-align: center;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__value-cell:hover) {
  background: rgba(248, 250, 252, 0.58);
  box-shadow: inset 0 0 0 1px rgba(203, 213, 225, 0.26);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__value-cell:focus-within) {
  background: rgba(239, 246, 255, 0.96);
  box-shadow: inset 0 0 0 1px rgba(47, 111, 237, 0.14);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__table--dragging) {
  cursor: grabbing;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row--dragging-source td) {
  opacity: 0.5;
  transform: scale(0.985);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row--drag-over td) {
  background: linear-gradient(180deg, #f5f9ff 0%, #edf4ff 100%);
  box-shadow:
    inset 0 0 0 1px rgba(47, 111, 237, 0.18),
    0 10px 24px rgba(47, 111, 237, 0.08);
  transform: translateY(-2px);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row--settling td) {
  animation: aimd-rec-inline-table-row-settle 0.48s cubic-bezier(0.22, 1, 0.36, 1);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__actions) {
  display: flex;
  justify-content: flex-start;
  margin-top: 12px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__add-btn) {
  border: 1px solid #c8d3e1;
  border-radius: 999px;
  padding: 6px 12px;
  background: #fff;
  color: #334155;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s, color 0.2s;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__add-btn:hover) {
  border-color: #9db1cc;
  background: #f7faff;
  color: #1f4f8f;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__add-btn:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__icon-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #b0bccb;
  cursor: pointer;
  opacity: 0.08;
  transition:
    opacity 0.18s ease,
    color 0.18s ease,
    background-color 0.18s ease,
    transform 0.18s ease;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row:hover .aimd-rec-inline-table__icon-btn),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__icon-btn:focus-visible) {
  opacity: 1;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__icon-btn:hover:not(:disabled)) {
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
  transform: translateY(-1px);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__icon-btn svg) {
  width: 14px;
  height: 14px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__icon-btn:disabled) {
  opacity: 0.36;
  cursor: not-allowed;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__icon-btn--visible) {
  opacity: 1;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle) {
  display: inline-grid;
  grid-template-columns: repeat(2, 3px);
  grid-auto-rows: 3px;
  gap: 3px 3px;
  padding: 4px 6px;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  border-radius: 999px;
  color: #bcc6d3;
  cursor: grab;
  user-select: none;
  opacity: 0.35;
  transition: background-color 0.2s, color 0.2s, opacity 0.2s, transform 0.2s ease;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-dot) {
  width: 3px;
  height: 3px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.82;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle:hover) {
  background: rgba(148, 163, 184, 0.12);
  color: #7c8ea5;
  opacity: 1;
  transform: translateY(-1px);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row:hover .aimd-rec-inline-table__drag-handle),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle:focus-visible) {
  opacity: 0.92;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle:hover .aimd-rec-inline-table__drag-dot) {
  opacity: 1;
  transform: scale(1.08);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle--disabled) {
  opacity: 0.45;
  cursor: not-allowed;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle--disabled:hover) {
  background: transparent;
  color: #b6c2d1;
  transform: none;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle--dragging),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle:active) {
  cursor: grabbing;
  color: #5d7699;
  transform: scale(0.96);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle--dragging .aimd-rec-inline-table__drag-dot),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-handle:active .aimd-rec-inline-table__drag-dot) {
  transform: scale(0.92);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-table-cell-input) {
  width: 100%;
  height: 34px;
  padding: 0 6px;
  border: 0;
  border-radius: 0;
  font-size: 13px;
  font-style: normal;
  line-height: 1.35;
  outline: none;
  box-sizing: border-box;
  color: var(--rec-text);
  background: transparent;
  box-shadow: none;
  min-width: 8ch;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__value-cell--compact .aimd-rec-table-cell-input) {
  min-width: 6ch;
  text-align: center;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__value-cell--wide .aimd-rec-table-cell-input) {
  min-width: 14ch;
  padding-left: 6px;
  padding-right: 6px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__drag-head),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__action-head) {
  color: transparent;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row:hover .aimd-rec-inline-table__drag-cell),
.aimd-protocol-recorder__content :deep(.aimd-rec-inline-table__row:hover .aimd-rec-inline-table__action-cell) {
  background: transparent;
  box-shadow: none;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-table-cell-input--compact) {
  font-variant-numeric: tabular-nums;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-table-cell-input--wide) {
  line-height: 1.42;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-table-cell-input:focus) {
  box-shadow: none;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-table-cell-input::placeholder) {
  color: #94a3b8;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card-list) {
  display: grid;
  gap: 12px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card) {
  position: relative;
  padding: 10px 12px 12px;
  border: 1px solid #dbe4ec;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__toolbar) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__field) {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px solid #eef2f7;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__field--title) {
  margin-top: 0;
  border-top: 0;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__body) {
  display: grid;
  gap: 0;
}

	.aimd-protocol-recorder__content :deep(.aimd-rec-card__label) {
	  display: inline-flex;
	  flex-direction: column;
	  align-items: flex-start;
	  gap: 2px;
	  color: #64748b;
	  font-size: 11px;
	  font-weight: 700;
	  letter-spacing: 0;
	  line-height: 1.25;
	  text-transform: none;
	}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__input) {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid #d7e0ea;
  border-radius: 10px;
  background: #f8fafc;
  color: var(--rec-text);
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__input:hover) {
  background: #ffffff;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__input:focus) {
  border-color: var(--rec-focus);
  box-shadow: 0 0 0 2px rgba(47, 111, 237, 0.1);
  background: #ffffff;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__input::placeholder) {
  color: #94a3b8;
}

.aimd-protocol-recorder__content :deep(.aimd-rec-card__input--error) {
  border-color: var(--rec-error);
}

@keyframes aimd-rec-inline-table-row-settle {
  0% {
    background-color: #deebff;
    box-shadow:
      inset 0 0 0 1px rgba(47, 111, 237, 0.22),
      0 14px 28px rgba(47, 111, 237, 0.14);
    transform: translateY(8px) scale(0.985);
  }

  60% {
    background-color: #edf4ff;
    box-shadow:
      inset 0 0 0 1px rgba(47, 111, 237, 0.12),
      0 8px 18px rgba(47, 111, 237, 0.08);
    transform: translateY(-1px) scale(1);
  }

  100% {
    background-color: transparent;
    box-shadow: none;
    transform: none;
  }
}
</style>
