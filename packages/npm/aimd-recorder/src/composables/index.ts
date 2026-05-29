export { captureFocusSnapshot, restoreFocusSnapshot } from './useFocusManagement'
export type { FocusSnapshot } from './useFocusManagement'
export { createChainedElementRenderer, useCodeBlockRendering } from './useCodeBlockRendering'

export {
  cloneRecordData,
  normalizeCheckLike,
  normalizeStepLike,
  normalizeIncomingRecord,
  replaceSection,
  applyNormalizedRecord,
  applyIncomingRecord,
  normalizeStepFields,
  normalizeCheckFields,
  normalizeQuizFields,
  normalizeVarTableFields,
  getQuizDefaultValue,
  ensureDefaultsFromFields,
  createEmptyVarTableRow,
  normalizeVarTableRows,
} from './useRecordState'

export {
  createEmptyCheckRecordItem,
  createEmptyStepRecordItem,
  normalizeStepTimerState,
  isStepTimerRunning,
  getStepElapsedMs,
  startStepTimer,
  pauseStepTimer,
  resetStepTimer,
  setStepChecked,
  formatStepDuration,
  resolveStepTimerMode,
  getStepRemainingMs,
  isStepTimerWarning,
  getProtocolEstimatedDurationMs,
  getProtocolRecordedDurationMs,
  hasRecordedStepDuration,
} from './useStepTimers'

export {
  normalizeVarTypeName,
  getVarInputKind,
  unwrapStructuredValue,
  toBooleanValue,
  toDateValue,
  formatDateTimeWithTimezone,
  normalizeDateTimeValueWithTimezone,
  formatDateForInput,
  getFileDisplayName,
  getFileInputConfig,
  isFileLikeVarType,
  createSelectedFileValue,
  getVarEnumSelectValue,
  getVarEnumValueFromSelectValue,
  getVarInputDisplayValue,
  parseVarInputValue,
  calculateVarStackWidth,
  measureVarLabelWidth,
  measureSingleLineControlWidth,
  syncAutoWrapTextareaHeight,
  applyVarStackWidth,
} from './useVarHelpers'
export type { AimdVarEnumOption, FileInputConfig, FileInputDisplayKind, VarInputKind } from './useVarHelpers'

export {
  AIMD_DNA_SEQUENCE_FORMAT,
  normalizeDnaSequenceText,
  collectInvalidDnaSequenceCharacters,
  createEmptyDnaSequenceAnnotation,
  createEmptyDnaSequenceQualifier,
  createEmptyDnaSequenceSegment,
  getNextDnaSequenceAnnotationId,
  normalizeDnaSequenceAnnotation,
  normalizeDnaSequenceQualifier,
  normalizeDnaSequenceSegment,
  normalizeDnaSequenceValue,
  calculateDnaSequenceGcPercent,
  getDnaSequenceSegmentIssue,
  serializeDnaSequenceToGenBank,
} from './useDnaSequence'

export { useClientAssignerRunner } from './useClientAssignerRunner'
export type { ClientAssignerRunnerOptions } from './useClientAssignerRunner'

export {
  applyAimdAssignedFieldsToRecord,
  buildAimdAssignerDependentData,
  extractAimdAssignedFields,
  getAimdAssignerDependentFields,
  getAimdAssignerFieldKey,
  getAimdAssignerFieldNameSets,
  getAimdAssignerMode,
  getAimdAssignerPayloadFieldKey,
  isReadonlyAimdAssignerMode,
  normalizeAimdAssignerDependentData,
  normalizeAimdAssignerDependentValue,
  normalizeAimdAssignerMode,
  resolveAimdAssigners,
} from './useAssignerRunner'
export type { AimdResolvedAssigner } from './useAssignerRunner'

export {
  useVarTableDragDrop,
  getVarTableRowKey,
  getVarTableColumns,
} from './useVarTableDragDrop'
export type { VarTableDragState, VarTableDragDropOptions } from './useVarTableDragDrop'

export { useFieldRendering } from './useFieldRendering'
export type { VarInputDisplayOverride, FieldRenderingOptions } from './useFieldRendering'

export {
  buildAimdRecorderFieldAdapterContext,
  resolveAimdRecorderFieldVNode,
} from './useFieldAdapters'
export type { RecorderFieldAdapterResolverOptions } from './useFieldAdapters'
