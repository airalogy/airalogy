import type { VNode } from "vue"
import type {
  AimdCheckNode,
  AimdQuizNode,
  AimdStepNode,
  AimdVarNode,
  AimdVarTableNode,
} from "@airalogy/aimd-core/types"
import type { AimdRecorderMessages } from "./locales"

export interface AimdStepOrCheckRecordItem {
  checked: boolean
  annotation: string
}

export interface AimdCheckRecordItem extends AimdStepOrCheckRecordItem {}

export interface AimdStepRecordItem extends AimdStepOrCheckRecordItem {
  elapsed_ms: number
  timer_started_at_ms: number | null
  started_at_ms: number | null
  ended_at_ms: number | null
}

export interface AimdDnaSequenceSegment {
  start: number
  end: number
  partial_start?: boolean
  partial_end?: boolean
}

export interface AimdDnaSequenceQualifier {
  key: string
  value: string
}

export interface AimdDnaSequenceAnnotation {
  id: string
  name: string
  type: string
  strand: 1 | -1
  color?: string
  segments: AimdDnaSequenceSegment[]
  qualifiers: AimdDnaSequenceQualifier[]
}

export interface AimdDnaSequenceValue {
  format: "airalogy_dna_v1"
  name: string
  sequence: string
  topology: "linear" | "circular"
  annotations: AimdDnaSequenceAnnotation[]
}

export interface AimdProtocolRecordData {
  var: Record<string, unknown>
  step: Record<string, AimdStepRecordItem>
  check: Record<string, AimdCheckRecordItem>
  quiz: Record<string, unknown>
}

export type AimdVarInputKind = "text" | "number" | "checkbox" | "textarea" | "date" | "datetime" | "time" | "dna" | "code"
export type AimdStepDetailDisplay = "auto" | "always"
export type AimdChoiceOptionExplanationMode = "hidden" | "selected" | "submitted" | "graded"
export type AimdScaleGradeDisplayMode = "hidden" | "completed" | "submitted" | "graded"

export function createEmptyProtocolRecordData(): AimdProtocolRecordData {
  return {
    var: {},
    step: {},
    check: {},
    quiz: {},
  }
}

// ---------------------------------------------------------------------------
// Extension types — used by host apps to customise AimdRecorder behaviour
// ---------------------------------------------------------------------------

/** Field metadata — app passes via prop to describe extra field info */
export interface AimdFieldMeta {
  inputType?: string           // override built-in input kind or a host-defined custom type mapping
  codeLanguage?: string        // Monaco language id for code-like fields (e.g. "python", "json")
  required?: boolean
  pattern?: string             // regex validation
  enumOptions?: Array<{ label: string; value: unknown }>
  disabled?: boolean
  placeholder?: string
  assigner?: { mode: 'manual' | 'auto_first' | 'auto_force' }
}

/** Field runtime state — app updates dynamically via prop */
export interface AimdFieldState {
  loading?: boolean            // assigner loading
  error?: string               // assigner error
  validationError?: string     // validation error message
  disabled?: boolean           // dynamic disable
}

/** Field event payload */
export interface FieldEventPayload {
  section: 'var' | 'step' | 'check' | 'quiz' | 'var_table'
  fieldKey: string
  value?: unknown
}

/** Table event payload */
export interface TableEventPayload {
  tableName: string
  rowIndex?: number
  columns: string[]
}

export type AimdRecorderFieldType = "var" | "var_table" | "step" | "check" | "quiz"

export interface AimdRecorderFieldNodeMap {
  var: AimdVarNode
  var_table: AimdVarTableNode
  step: AimdStepNode
  check: AimdCheckNode
  quiz: AimdQuizNode
}

export type AimdRecorderFieldNode = AimdRecorderFieldNodeMap[keyof AimdRecorderFieldNodeMap]

export interface AimdTypePluginInitContext {
  type: string
  normalizedType: string
  fieldKey: string
  node: AimdVarNode
  fieldMeta?: AimdFieldMeta
  currentUserName?: string
  now?: Date | string | number
}

export interface AimdTypePluginValueContext extends AimdTypePluginInitContext {
  value: unknown
  inputKind: AimdVarInputKind
}

export interface AimdTypePluginParseContext extends AimdTypePluginInitContext {
  rawValue: string
  inputKind: AimdVarInputKind
}

export interface AimdTypePluginRenderContext extends AimdTypePluginValueContext {
  readonly: boolean
  disabled: boolean
  locale: string
  messages: AimdRecorderMessages
  record: AimdProtocolRecordData
  displayValue: string | number
  extraClasses: string[]
  placeholder?: string
  fieldState?: AimdFieldState
  emitChange: (value: unknown) => void
  emitBlur: () => void
}

export interface AimdTypePlugin {
  type: string
  aliases?: string[]
  inputKind?: AimdVarInputKind
  getInitialValue?: (context: AimdTypePluginInitContext) => unknown
  normalizeValue?: (context: AimdTypePluginValueContext) => unknown
  getDisplayValue?: (context: AimdTypePluginValueContext) => string | number
  parseInputValue?: (context: AimdTypePluginParseContext) => unknown
  renderField?: (context: AimdTypePluginRenderContext) => VNode | null | undefined
}

export interface AimdRecorderFieldAdapterContext<TFieldType extends AimdRecorderFieldType = AimdRecorderFieldType> {
  fieldType: TFieldType
  fieldKey: string
  node: AimdRecorderFieldNodeMap[TFieldType]
  value: unknown
  defaultVNode: VNode
  readonly: boolean
  locale: string
  messages: AimdRecorderMessages
  record: AimdProtocolRecordData
  fieldMeta?: Record<string, AimdFieldMeta>
  fieldState?: Record<string, AimdFieldState>
}

export type AimdRecorderFieldAdapter<TFieldType extends AimdRecorderFieldType = AimdRecorderFieldType> = (
  context: AimdRecorderFieldAdapterContext<TFieldType>,
) => VNode | null | undefined

export type AimdRecorderFieldAdapters = Partial<{
  [K in AimdRecorderFieldType]: AimdRecorderFieldAdapter<K>
}>
