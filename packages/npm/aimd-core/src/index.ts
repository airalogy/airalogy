/**
 * @airalogy/aimd-core
 *
 * Core AIMD (Airalogy Markdown) parser and syntax definitions
 *
 * This package provides:
 * - AIMD syntax parsing (remark plugin)
 * - Type definitions for AIMD nodes
 * - Syntax highlighting grammar (TextMate/Shiki)
 * - Utility functions for AIMD manipulation
 */

// Parser exports
export { default as remarkAimd } from './parser/remark-aimd'
export { default as rehypeAimd } from './parser/rehype-aimd'
export {
  protectAimdInlineTemplates,
  restoreAimdInlineTemplates,
  type AimdInlineTemplateMap,
  type ProtectedAimdInlineTemplates,
} from './parser/inline-template-protection'
export { DOM_ATTR_NAME, type DomAttrName } from './parser/constants'

// Type exports
export type {
  // AIMD unified types (canonical types for AIMD parsing)
  AimdCheckField,
  AimdClientAssignerField,
  AimdClientAssignerMode,
  AimdFieldType,
  AimdQuizField,
  AimdRefField,
  AimdScopeKey,
  AimdScopeName,
  AimdStepField,
  AimdSubvar,
  AimdTableLink,
  AimdTemplateEnv,
  AimdVarField,
  AimdVarTableField,
  AimdVarType,
  ExtractedAimdFields,
} from './types/aimd'

export type {
  // Node types
  AimdCheckNode,
  AimdCiteNode,
  AimdFigNode,
  AimdNode,
  AimdQuizBlank,
  AimdQuizFollowupField,
  AimdQuizFollowupType,
  AimdQuizMode,
  AimdQuizNode,
  AimdQuizOption,
  AimdQuizScaleItem,
  AimdQuizType,
  AimdScaleDisplay,
  AimdRefNode,
  AimdScope,
  AimdStepNode,
  AimdStepTimerMode,
  AimdVarDefinition,
  AimdVarNode,
  AimdVarTableNode,
  BaseNode,
  IndentNode,
} from './types/nodes'

export type {
  AimdBlankQuizGradingConfig,
  AimdChoiceQuizGradingConfig,
  AimdOpenQuizGradingConfig,
  AimdQuizBlankGradeDetail,
  AimdQuizBlankGradingRule,
  AimdQuizGradeMethod,
  AimdQuizGradeReport,
  AimdQuizGradeResult,
  AimdQuizGradeSummary,
  AimdQuizGradeStatus,
  AimdQuizGradingConfig,
  AimdQuizGradingOptions,
  AimdQuizGradingProvider,
  AimdQuizNumericRule,
  AimdQuizProviderRequest,
  AimdQuizRubricItem,
  AimdQuizRubricItemGradeDetail,
  AimdQuizScaleBand,
  AimdQuizScaleBandMatch,
  AimdScaleQuizGradingConfig,
  AimdQuizTextNormalizeRule,
} from './types/grading'

export type {
  // Compatibility types for business logic
  FieldKey,
  FieldRecord,
  FieldResponseKey,
  FiledName,
  IAnnotationDataItem,
  IDynamicTableNode,
  IFieldItem,
  IFileDataItem,
  IRecordData,
  IRecordDataItem,
  IRecordDataKey,
  ScopeFieldKey,
} from './types/aimd'

// Syntax exports (for editor highlighting)
export {
  AIMD_SCOPES,
  aimdInjection,
  aimdLanguage,
  aimdTheme as aimdSyntaxTheme,
} from './syntax/aimd-grammar'

// Utility exports
export {
  findVarTable,
  getSubvarDef,
  getSubvarNames,
  hasSubvars,
  isVarTableField,
  mergeVarTableInfo,
  normalizeSubvars,
  toTemplateEnv,
} from './utils/aimd-utils'

// Domain constants
export {
  getRecordDataKey,
  getSchemaKey,
  scopeColorRecord,
  scopeKeyRecord,
  scopeNameRecord,
} from './utils/constants'

// Regex patterns
export {
  DYNAMIC_TABLE_LINK,
  DYNAMIC_TABLE_SUB_VAR,
  ESCAPED_PROTOCOL_FIELDS,
} from './utils/patterns'

// Schema utilities
export {
  type SchemaToInputType,
  convertToScientificString,
  formatRawValue,
  formatter,
  isWipValue,
  parser,
  schemaToInputType,
  validator,
} from './utils/schema'

export {
  gradeQuizAnswer,
  gradeScaleQuizLocally,
  gradeQuizRecordAnswers,
  isScaleQuizAnswerComplete,
  resolveQuizMaxScore,
} from './grading'
