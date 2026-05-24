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
  parseVarDefinition,
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
export { DOM_ATTR_NAME, type DomAttrName } from './constants'
