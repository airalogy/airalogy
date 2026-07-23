/**
 * @airalogy/aimd-recorder
 *
 * AIMD editor Vue components and UI
 *
 * This package provides Vue components for editing and displaying AIMD content
 */

// Re-export styles
import './styles/recorder.css'
import { AimdProtocolRecorder as DeprecatedAimdProtocolRecorder } from './components'

export {
  AimdAssignerGraph,
  AimdCollectorField,
  AimdRecorder,
  AimdRecorderEditor,
  AimdQuizRecorder,
  AimdRequiredMarker,
  AimdResourceForm,
} from './components'
export { AimdDnaSequenceField, AimdEntityRefField, AimdMarkdownField, AimdResourceRefField } from './components'
/**
 * @deprecated Use `AimdRecorder` instead.
 */
export const AimdProtocolRecorder = DeprecatedAimdProtocolRecorder
export {
  createAimdRecorderMessages,
  DEFAULT_AIMD_RECORDER_LOCALE,
  resolveAimdRecorderLocale,
} from './locales'
export type {
  AimdProtocolRecordData,
  AimdAssignerDefinition,
  AimdAssignerGraphData,
  AimdAssignerGraphEdge,
  AimdAssignerGraphLabels,
  AimdAssignerGraphNode,
  AimdAssignerGraphNodeType,
  AimdAssignerMap,
  AimdAssignerNodeSchemaInfo,
  AimdAssignerRunner,
  AimdAssignerRunnerRequest,
  AimdServerAssignerMap,
  AimdServerAssignerRunner,
  AimdServerAssignerRunnerRequest,
  AimdFileUploadContext,
  AimdFileUploadHandler,
  AimdCollectorObservation,
  AimdCollectorObservationInput,
  AimdCollectorObservationSource,
  AimdCollectorPermissionDecision,
  AimdCollectorPermissionHandler,
  AimdCollectorPermissionRequest,
  AimdCollectorProviderMap,
  AimdCollectorProviderRequest,
  AimdCollectorRuntimeState,
  AimdCollectorRuntimeStatus,
  AimdDataSourceProvider,
  AimdFileResolveContext,
  AimdFileInfoResolver,
  AimdEntityResolveContext,
  AimdEntityResolver,
  AimdEntityResolverEntry,
  AimdEntityResolverMap,
  AimdEntityRefOption,
  AimdEntityRefValue,
  AimdEntitySearchHandler,
  AimdEquipmentSlotOption,
  AimdPreparedResourceOutput,
  AimdResourceAvailability,
  AimdResourceContainerOption,
  AimdResourceLotOption,
  AimdResourceRefOption,
  AimdResourceRefValue,
  AimdResourceResolveContext,
  AimdResourceResolver,
  AimdResourceResolverMap,
  AimdResolvedFileInfo,
  AimdSelectedFileValue,
  AimdTypePlugin,
  AimdTypePluginInitContext,
  AimdTypePluginParseContext,
  AimdTypePluginRenderContext,
  AimdTypePluginValueContext,
  AimdVarInputKind,
  AimdStepDetailDisplay,
  AimdChoiceOptionExplanationMode,
  AimdScaleGradeDisplayMode,
  AimdRecorderFieldAdapter,
  AimdRecorderFieldAdapterContext,
  AimdRecorderFieldAdapters,
  AimdRecorderFieldNode,
  AimdRecorderFieldNodeMap,
  AimdRecorderFieldType,
  AimdCheckRecordItem,
  AimdStepRecordItem,
  AimdStepOrCheckRecordItem,
  AimdFieldMeta,
  AimdFieldState,
  AimdRecorderValidationCode,
  AimdRecorderValidationTrigger,
  AimdRecordValidationSchema,
  AimdRecorderValidationIssue,
  AimdRecorderValidationResult,
  AimdDnaSequenceAnnotation,
  AimdDnaSequenceQualifier,
  AimdDnaSequenceSegment,
  AimdDnaSequenceValue,
  FieldEventPayload,
  TableEventPayload,
} from './types'
export {
  getAimdRequiredFieldKeys,
  getAimdVarTableCellFieldKey,
  matchesAimdValidationFieldSelector,
  validateAimdField,
  validateAimdRecord,
  type ResolveAimdRequiredFieldOptions,
  type ValidateAimdRecordOptions,
} from './record/validation'
export { createEmptyProtocolRecordData } from './types'
export {
  BUILT_IN_AIMD_TYPE_PLUGINS,
  createAimdTypePlugins,
  resolveAimdTypePlugin,
} from './type-plugins'
export type {
  AimdRecorderI18nOptions,
  AimdRecorderLocale,
  AimdRecorderMessages,
  AimdRecorderMessagesInput,
} from './locales'
export * from './composables'
