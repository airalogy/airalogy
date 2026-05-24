import type { AimdQuizGradingConfig } from "./grading"

/**
 * Core AIMD Node Types
 * 
 * These types represent the parsed AIMD syntax nodes.
 * Business-specific types should remain in the application layer.
 */

/**
 * AIMD field types
 */
export type AimdFieldType =
  | "var"
  | "var_table"
  | "quiz"
  | "step"
  | "check"
  | "ref_step"
  | "ref_var"
  | "ref_fig"
  | "cite"
  | "fig"

/**
 * AIMD scopes
 */
export type AimdScope =
  | "var"
  | "var_table"
  | "quiz"
  | "step"
  | "check"
  | "ref_step"
  | "ref_var"
  | "ref_fig"
  | "cite"
  | "fig"

/**
 * AIMD quiz metadata
 */
export type AimdQuizType = "choice" | "true_false" | "blank" | "open" | "scale"
export type AimdQuizMode = "single" | "multiple"
export type AimdStepTimerMode = "elapsed" | "countdown" | "both"
export type AimdScaleDisplay = "matrix" | "list"
export type AimdQuizFollowupType = "str" | "int" | "float" | "bool"

export interface AimdQuizFollowupField {
  key: string
  type: AimdQuizFollowupType
  required: boolean
  title?: string
  description?: string
  unit?: string
  default?: string | number | boolean
}

export interface AimdQuizOption {
  key: string
  text: string
  explanation?: string
  points?: number
  followups?: AimdQuizFollowupField[]
}

export interface AimdQuizBlank {
  key: string
  answer: string
}

export interface AimdQuizScaleItem {
  key: string
  stem: string
  description?: string
}

/**
 * Quiz preview visibility control
 */
export interface QuizPreviewOptions {
  /** Whether to reveal standard answers in preview (choice answer / blank answers) */
  showAnswers?: boolean
  /** Whether to reveal rubric in preview (open questions) */
  showRubric?: boolean
}

/**
 * AIMD variable definition
 */
export interface AimdVarDefinition {
  id: string
  type?: string
  default?: string | number | boolean | null
  /** Original AIMD default literal, preserved for UI display when lexical form matters. */
  defaultRaw?: string
  required?: boolean
  subvars?: Record<string, AimdVarDefinition>
  /** Additional kwargs like pattern, title, description, etc. */
  kwargs?: Record<string, string | number | boolean>
  /** Validation warnings (e.g. type/default mismatch). Non-breaking. */
  warnings?: string[]
}

/**
 * AIMD node base type
 */
export interface BaseNode {
  type: "aimd"
  fieldType: AimdFieldType
  /** Canonical stable identifier used in AIMD source and references. */
  id: string
  scope: AimdScope
  raw: string
}

/**
 * AIMD variable node
 */
export interface AimdVarNode extends BaseNode {
  fieldType: "var"
  definition?: AimdVarDefinition
}

/**
 * AIMD table variable node
 */
export interface AimdVarTableNode extends BaseNode {
  fieldType: "var_table"
  columns: string[]
  definition?: AimdVarDefinition
}

/**
 * AIMD quiz node (from ```quiz code blocks)
 */
export interface AimdQuizNode extends BaseNode {
  fieldType: "quiz"
  quizType: AimdQuizType
  stem: string
  score?: number
  title?: string
  description?: string
  mode?: AimdQuizMode
  display?: AimdScaleDisplay
  options?: AimdQuizOption[]
  answer?: string | string[] | boolean
  blanks?: AimdQuizBlank[]
  items?: AimdQuizScaleItem[]
  rubric?: string
  grading?: AimdQuizGradingConfig
  default?: unknown
  extra?: Record<string, unknown>
}

/**
 * Indent node (for step hierarchy)
 */
export interface IndentNode {
  parent?: IndentNode
  sequence: number
  level: number
}

/**
 * AIMD step node with hierarchy information
 */
export interface AimdStepNode extends BaseNode {
  fieldType: "step"
  /** Step level (1-3 per AIMD spec) */
  level: number
  /** Step sequence within its level (0-based) */
  sequence: number
  /** Final display indent (e.g., "1.2.3") */
  step: string
  /** Parent step id (if any) */
  parent_id?: string
  /** Previous sibling step id (if any) */
  prev_id?: string
  /** Next sibling step id (if any) */
  next_id?: string
  /** Whether this step has children */
  has_children?: boolean
  /** Whether this step has a checkbox (check=True in AIMD) */
  check?: boolean
  /** Explicit title declared in AIMD step kwargs. */
  title?: string
  /** Optional subtitle declared in AIMD step kwargs. */
  subtitle?: string
  /** Message to display when step is checked */
  checked_message?: string
  /** Expected duration for the step in milliseconds. */
  estimated_duration_ms?: number
  /** Timer display mode for recorder UIs. */
  timer_mode?: AimdStepTimerMode
  /** Whether this step should be treated as a result/output step. */
  result?: boolean
  /** Preserved step kwargs for host-side render adapters. */
  props?: Record<string, string | boolean | number>
  /** Parent node reference (for hierarchy) */
  parent?: IndentNode
}

/**
 * AIMD checkpoint node
 */
export interface AimdCheckNode extends BaseNode {
  fieldType: "check"
  /** Display label for the checkpoint */
  label?: string
  /** Message to display when checkpoint is checked */
  checked_message?: string
}

/**
 * AIMD reference node
 */
export interface AimdRefNode extends BaseNode {
  fieldType: "ref_step" | "ref_var" | "ref_fig"
  refTarget: string
}

/**
 * AIMD citation node
 */
export interface AimdCiteNode extends BaseNode {
  fieldType: "cite"
  /** Citation references (comma-separated in source) */
  refs: string[]
}

/**
 * AIMD figure node
 */
export interface AimdFigNode extends BaseNode {
  fieldType: "fig"
  /** Figure ID (used for references) */
  id: string
  /** Image source (local path, URL, or Airalogy file ID) */
  src: string
  /** Figure title (optional but recommended) */
  title?: string
  /** Figure legend/caption (optional but recommended) */
  legend?: string
  /** Figure sequence number (auto-generated) */
  sequence?: number
}

/**
 * Union type of all AIMD nodes
 */
export type AimdNode = 
  | AimdVarNode 
  | AimdVarTableNode 
  | AimdQuizNode
  | AimdStepNode 
  | AimdCheckNode 
  | AimdRefNode 
  | AimdCiteNode 
  | AimdFigNode

/**
 * Processor options
 */
export interface ProcessorOptions {
  mode?: "preview" | "edit" | "report"
  gfm?: boolean
  math?: boolean
  sanitize?: boolean
  /** Enable single line break to <br> conversion (default: true for AIMD) */
  breaks?: boolean
  /** Quiz preview visibility policy */
  quizPreview?: QuizPreviewOptions
}

/**
 * Render context
 */
export interface RenderContext {
  mode: "preview" | "edit" | "report"
  value?: Record<string, Record<string, unknown>>
  readonly?: boolean
  /** Quiz preview visibility policy */
  quizPreview?: QuizPreviewOptions
}

/**
 * Render modes
 */
export type RenderMode = "preview" | "edit" | "report"

/**
 * Render node
 */
export interface RenderNode {
  type: string
  [key: string]: unknown
}

/**
 * Token render rule (for compatibility)
 */
export type TokenRenderRule = (node: AimdNode, ctx: RenderContext) => unknown

// Note: The following types are re-exported for compatibility
// but their actual implementations remain in the application layer
export type {
  ExtractedAimdFields,
  AimdVarTableField,
  AimdVarField,
  AimdStepField,
  AimdCheckField,
  AimdRefField,
  AimdFigField,
} from './aimd'
