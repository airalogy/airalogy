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
} from './field-metadata'

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
} from './record-display'

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
