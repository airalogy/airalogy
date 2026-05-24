/**
 * Utility functions
 */

export {
  findVarTable,
  getSubvarDef,
  getSubvarNames,
  hasSubvars,
  isVarTableField,
  mergeVarTableInfo,
  normalizeSubvars,
  toTemplateEnv,
} from './aimd-utils'

// Domain constants
export {
  getRecordDataKey,
  getSchemaKey,
  scopeColorRecord,
  scopeKeyRecord,
  scopeNameRecord,
} from './constants'

// Regex patterns
export {
  DYNAMIC_TABLE_LINK,
  DYNAMIC_TABLE_SUB_VAR,
  ESCAPED_PROTOCOL_FIELDS,
} from './patterns'

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
} from './schema'
