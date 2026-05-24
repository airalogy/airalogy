/**
 * AIMD (Airalogy Interactive Markdown) Unified Type Definitions
 *
 * This file defines the canonical types for AIMD field parsing.
 * All AIMD-related code should use these types to ensure consistency.
 */

import type {
  AimdQuizBlank,
  AimdQuizMode,
  AimdQuizOption,
  AimdQuizScaleItem,
  AimdQuizType,
  AimdScaleDisplay,
  AimdStepTimerMode,
} from "./nodes"
import type { AimdQuizGradingConfig } from "./grading"

// ===== Base Types for Compatibility =====

/**
 * Scope field key — extended field key including special scopes
 */
export type ScopeFieldKey = FieldKey | "var_table" | "ref_step" | "rv_ref" | "research_step_ref"

/**
 * Field key type — maps to backend scope identifiers
 */
export type FieldKey =
  | "research_variable"
  | "research_step"
  | "research_check"
  | "research_node"
  | "research_protocol"
  | "research_result"
  | "research_record"
  | "research_question"
  | "research_workflow"
  | "research_step_ref"

/**
 * Field response key — keys used in API responses
 */
export type FieldResponseKey = "vars" | "checks" | "steps" | "var_tables"

/**
 * Field name type — short names used in AIMD syntax
 */
export type FiledName =
  | "var"
  | "var_table"
  | "step"
  | "check"
  | "ref_step"
  | "ref_var"
  | "rp"
  | "rr"
  | "rrec"
  | "rq"
  | "rnw"
  | "rn"
  | "step_ref"
  | "rv_ref"

/**
 * Record data key — keys used in record data structures
 */
export type IRecordDataKey = ScopeFieldKey | "checks" | "steps" | "vars"

/**
 * Record data item
 */
export interface IRecordDataItem {
  [key: string]: unknown
}

/**
 * Record data structure
 */
export interface IRecordData {
  [key: string]: IRecordDataItem
}

/**
 * Field item
 */
export interface IFieldItem {
  name: string
  type?: string
  [key: string]: unknown
}

/**
 * File data item
 */
export interface IFileDataItem {
  name: string
  url: string
  size?: number
  [key: string]: unknown
}

/**
 * Annotation data item
 */
export interface IAnnotationDataItem {
  id: string
  content: string
  [key: string]: unknown
}

/**
 * Dynamic table node
 */
export interface IDynamicTableNode {
  name: string
  columns: string[]
  rows?: unknown[][]
  [key: string]: unknown
}

/**
 * Field record
 */
export interface FieldRecord {
  [key: string]: unknown
}

/**
 * Extract result
 */
export interface ExtractResult {
  fields: ExtractedAimdFields
  [key: string]: unknown
}

// ===== AIMD-Specific Types =====

/**
 * Scope keys used in AIMD
 */
export type AimdScopeKey =
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
 * High-level scope names for semantic grouping
 */
export type AimdScopeName =
  | "var"
  | "step"
  | "check"
  | "quiz"
  | "workflow"

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
 * Variable type annotation (e.g., str, int, float, bool, list)
 */
export type AimdVarType = "str" | "int" | "float" | "bool" | "list" | "date" | "file" | string

/**
 * Subvar definition for var_table
 * This is the canonical format - all subvars should be normalized to this
 */
export interface AimdSubvar {
  /** Canonical column/field id */
  id: string
  /** Type annotation (str, int, float, bool, etc.) */
  type?: AimdVarType
  /** Default value */
  default?: unknown
  /** Display title */
  title?: string
  /** Description/tooltip */
  description?: string
  /** Additional kwargs from AIMD syntax */
  kwargs?: Record<string, unknown>
  /** Position info from parser */
  start_line?: number
  end_line?: number
  start_col?: number
  end_col?: number
}

/**
 * Table link definition for linked tables
 */
export interface AimdTableLink {
  source: {
    name: string
    prop: string
  }
  target: {
    name: string
    prop: string
  }
  isSource: boolean
}

/**
 * Var table field definition
 */
export interface AimdVarTableField {
  /** Canonical table id */
  id: string
  /** Scope key */
  scope: "var_table"
  /** Column definitions - always use AimdSubvar[] format */
  subvars: AimdSubvar[]
  /** Table link for linked tables */
  link?: AimdTableLink
  /** Type annotation (e.g., list, list[CustomType]) */
  type_annotation?: string
  /** Auto-generated item type name */
  auto_item_type?: string | null
  /** Explicit list item type */
  list_item_type?: string | null
  /** Position info */
  start_line?: number
  end_line?: number
  start_col?: number
  end_col?: number
}

/**
 * Simple var field definition
 */
export interface AimdVarField {
  /** Variable id */
  id: string
  /** Type annotation */
  type?: AimdVarType
  /** Default value */
  default?: unknown
  /** Display title */
  title?: string
  /** Description */
  description?: string
  /** Additional kwargs from AIMD syntax */
  kwargs?: Record<string, unknown>
}

/**
 * Quiz field definition
 */
export interface AimdQuizField {
  /** Quiz id (also used as field key) */
  id: string
  /** Quiz type */
  type: AimdQuizType
  /** Question stem */
  stem: string
  /** Optional score */
  score?: number
  /** Optional display title */
  title?: string
  /** Optional description/help text */
  description?: string
  /** Choice mode */
  mode?: AimdQuizMode
  /** Scale display mode */
  display?: AimdScaleDisplay
  /** Choice options */
  options?: AimdQuizOption[]
  /** Standard answer */
  answer?: string | string[] | boolean
  /** Blank definitions */
  blanks?: AimdQuizBlank[]
  /** Scale item definitions */
  items?: AimdQuizScaleItem[]
  /** Open question rubric */
  rubric?: string
  /** Optional grading policy */
  grading?: AimdQuizGradingConfig
  /** Optional default value */
  default?: unknown
  /** Extra unreserved metadata */
  extra?: Record<string, unknown>
}

/**
 * Step field definition
 */
export interface AimdStepField {
  /** Step id */
  id: string
  /** Step number */
  step?: string
  /** Indentation level */
  level?: number
  /** Sequence within the same level */
  sequence?: number
  /** Has check checkbox */
  has_check?: boolean
  /** Expected duration for the step in milliseconds. */
  estimated_duration_ms?: number
  /** Timer display mode for recorder UIs. */
  timer_mode?: AimdStepTimerMode
  /** Whether this step has children */
  has_children?: boolean
  /** Parent step id */
  parent_id?: string
  /** Previous step id */
  prev_id?: string
  /** Next step id */
  next_id?: string
}

/**
 * Check field definition
 */
export interface AimdCheckField {
  /** Checkpoint id */
  id: string
}

/**
 * Reference field definition
 */
export interface AimdRefField {
  /** Reference target id */
  id: string
  /** Reference type */
  type: "ref_step" | "ref_var" | "ref_fig"
}

/**
 * Figure field definition
 */
export interface AimdFigField {
  /** Figure ID (short ID used in references) */
  id: string
  /** Image source (local path, URL, or Airalogy file ID) */
  src: string
  /** Figure title (optional but recommended) */
  title?: string
  /** Figure legend/caption (optional but recommended) */
  legend?: string
  /** Figure sequence number (auto-generated during rendering) */
  sequence?: number
}

/**
 * Client runtime assigner modes currently supported by the recorder runtime.
 */
export type AimdClientAssignerMode = "auto" | "auto_first" | "manual"

/**
 * Frontend-only assigner definition extracted from
 * ```assigner runtime=client``` blocks.
 */
export interface AimdClientAssignerField {
  /** Stable assigner id */
  id: string
  /** Runtime discriminator */
  runtime: "client"
  /** Trigger policy */
  mode: AimdClientAssignerMode
  /** Fields read by this assigner */
  dependent_fields: string[]
  /** Fields written by this assigner */
  assigned_fields: string[]
  /** Named function source extracted from the block */
  function_source: string
}

/**
 * Extracted AIMD fields from markdown
 * This is the canonical output format from remark-aimd
 */
export interface ExtractedAimdFields {
  /** Simple variables */
  var: string[]
  /** Simple variable definitions with type, default, and kwargs metadata */
  var_definitions?: AimdVarField[]
  /** Variable tables with full definitions */
  var_table: AimdVarTableField[]
  /** Frontend-only assigners from fenced `assigner runtime=client` blocks */
  client_assigner: AimdClientAssignerField[]
  /** Quiz definitions from ```quiz code blocks */
  quiz: AimdQuizField[]
  /** Steps */
  step: string[]
  /** Checkpoints */
  check: string[]
  /** Step references */
  ref_step: string[]
  /** Variable references */
  ref_var: string[]
  /** Figure references */
  ref_fig?: string[]
  /** Citations */
  cite?: string[]
  /** Figures with full definitions */
  fig?: AimdFigField[]
  /** Step hierarchy for nested steps */
  step_hierarchy?: AimdStepField[]
}

/**
 * Template environment with extracted fields
 * Used for passing data between components
 */
export interface AimdTemplateEnv {
  /** Extracted fields */
  fields: ExtractedAimdFields
  /** Typed field definitions from backend */
  typed?: Record<string, Record<string, Record<string, unknown>>>
  /** Record data for steps and refs */
  record?: {
    byId: Record<string, unknown>
    byLevel: Record<number, unknown[]>
    byScope: Record<string, Record<string, unknown>>
  }
  /** Table definitions for var_table */
  tables?: Array<[string, AimdVarTableField]>
  /** Reference definitions */
  refs?: {
    ref_step: Array<{
      id: string
      line: number
      sequence: number
    }>
    ref_var: Array<{
      id: string
      line: number
      sequence: number
    }>
  }
}
