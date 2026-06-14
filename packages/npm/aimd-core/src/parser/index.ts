/**
 * Parser exports
 */

export { default as remarkAimd } from './remark-aimd'
export { default as rehypeAimd } from './rehype-aimd'
export { validateClientAssignerFunctionSource } from './client-assigner-syntax'
export {
  NUMERIC_CONSTRAINT_KWARGS,
  isNumericVarType,
  parseDurationToMs,
  parseStepTimerMode,
  parseVarEnumValues,
  parseVarDefinition,
  parseRefsContent,
  validateVarDefaultType,
  validateVarDefinition,
  validateVarKwargs,
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
