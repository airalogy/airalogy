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
  isAimdWorkflowReference,
  parseWorkflowContent,
} from './parser/workflow-parser'
export {
  CRITIC_MARKUP_SUBSTITUTIONS_DATA_KEY,
  remarkCriticMarkup,
  protectCriticMarkupSubstitutions,
  splitCriticMarkupText,
  type ProtectedCriticMarkupSubstitution,
  protectAimdInlineTemplates,
  restoreAimdInlineTemplates,
  type AimdInlineTemplateMap,
  type ProtectedAimdInlineTemplates,
} from './parser'
export { DOM_ATTR_NAME, type DomAttrName } from './parser/constants'

// Type exports
export type {
  // AIMD unified types (canonical types for AIMD parsing)
  AimdCheckField,
  AimdClientAssignerField,
  AimdClientAssignerMode,
  AimdFieldType,
  AimdMediaField,
  AimdQuizField,
  AimdRefField,
  AimdReferenceField,
  AimdScopeKey,
  AimdScopeName,
  AimdStepField,
  AimdSubvar,
  AimdTableLink,
  AimdTemplateEnv,
  AimdVarField,
  AimdVarTableField,
  AimdVarType,
  AimdWorkflowAssignerField,
  AimdWorkflowAssignValue,
  AimdWorkflowField,
  AimdWorkflowNodeField,
  AimdWorkflowPermissions,
  AimdWorkflowTransitionField,
  ExtractedAimdFields,
} from './types/aimd'

export type {
  // Node types
  AimdCheckNode,
  AimdCiteNode,
  AimdCriticAdditionNode,
  AimdCriticCommentNode,
  AimdCriticDeletionNode,
  AimdCriticHighlightNode,
  AimdCriticMarkupBaseNode,
  AimdCriticMarkupChild,
  AimdCriticMarkupKind,
  AimdCriticMarkupNode,
  AimdCriticMarkupNodeType,
  AimdCriticSubstitutionNode,
  AimdFigNode,
  AimdMediaNode,
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
  AimdReferenceEntry,
  AimdRefsNode,
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

export {
  formatAimdExampleValue,
  formatAimdExamples,
  getAimdFieldDescription,
  getAimdFieldDisplayLabel,
  getAimdFieldEnumValues,
  getAimdFieldExamples,
  getAimdFieldTitle,
  resolveAimdFieldMetadata,
  type AimdResolvedFieldMetadata,
} from './utils/field-metadata'

export {
  AIMD_AIRALOGY_FILE_ID_RE,
  AIMD_FILE_BADGE_BY_KIND,
  AIMD_FILE_ID_VALUE_KEYS,
  AIMD_FILE_INPUT_CONFIG_BY_TYPE,
  AIMD_FILE_KIND_BY_EXTENSION,
  AIMD_FILE_REFERENCE_VALUE_KEYS,
  AIMD_MIME_BY_EXTENSION,
  AIMD_RECORD_DATA_SCOPES,
  getAimdAcceptFromExtension,
  getAimdAssetMediaSource,
  getAimdConfiguredFileExtension,
  getAimdDisplayValue,
  getAimdFileDisplayName,
  getAimdFileExtension,
  getAimdFileExtensionFromTypeName,
  getAimdFileInputConfig,
  getAimdFileKindFromExtension,
  getAimdFileKindFromMimeType,
  getAimdFileKindFromType,
  getAimdFileValueId,
  getAimdStringFromRecord,
  inferAimdAssetKind,
  isAimdAiralogyFileId,
  isAimdBooleanType,
  isAimdCodeType,
  isAimdDnaType,
  isAimdEmbeddableAssetUrl,
  isAimdFileLikeType,
  isAimdMarkdownType,
  isAimdPlainRecord,
  isKnownAimdFileTypeName,
  normalizeAimdFileExtension,
  normalizeAimdOptionalTypeName,
  normalizeAimdRecordDataValue,
  normalizeAimdString,
  normalizeAimdTypeName,
  resolveAimdRecordData,
  stringifyAimdDisplayValue,
  toAimdBooleanValue,
  unwrapAimdStructuredValue,
  type AimdAssetKind,
  type AimdAssetLike,
  type AimdFileInputConfig,
  type AimdFileInputMetadata,
  type AimdRecordDataScope,
  type AimdRecordDataValue,
} from './utils/record-display'

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
