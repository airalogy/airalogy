/**
 * Parser exports
 */

export { default as remarkAimd } from './remark-aimd'
export { default as rehypeAimd } from './rehype-aimd'
export { validateClientAssignerFunctionSource } from './client-assigner-syntax'
export {
  parseConnectorsContent,
} from './connectors-parser'
export {
  parseCollectorsContent,
} from './collectors-parser'
export {
  isAimdWorkflowReference,
  parseWorkflowContent,
} from './workflow-parser'
export {
  AIMD_STANDARD_MEDIA_KINDS,
  NUMERIC_CONSTRAINT_KWARGS,
  isStandardAimdMediaKind,
  isNumericVarType,
  normalizeAimdMediaKind,
  parseDurationToMs,
  parseMediaContent,
  parseStepTimerMode,
  parseVarEnumValues,
  parseVarDefinition,
  parseRefsContent,
  validateMediaDefinition,
  validateVarDefaultType,
  validateVarDefinition,
  validateVarKwargs,
  type AimdStandardMediaKind,
} from './field-parsers'
export {
  protectAimdInlineTemplates,
  restoreAimdInlineTemplates,
  type AimdInlineTemplateMap,
  type ProtectedAimdInlineTemplates,
} from './inline-template-protection'
export {
  CRITIC_MARKUP_SUBSTITUTIONS_DATA_KEY,
  default as remarkCriticMarkup,
  protectCriticMarkupSubstitutions,
  splitCriticMarkupText,
  type ProtectedCriticMarkupSubstitution,
} from './critic-markup'
export { DOM_ATTR_NAME, type DomAttrName } from './constants'
