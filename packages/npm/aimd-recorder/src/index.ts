/**
 * @airalogy/aimd-recorder
 *
 * AIMD editor Vue components and UI
 *
 * This package provides Vue components for editing and displaying AIMD content
 */

// Re-export styles
import './styles/aimd.css'
import { AimdProtocolRecorder as DeprecatedAimdProtocolRecorder } from './components'

export { AimdRecorder, AimdRecorderEditor, AimdQuizRecorder } from './components'
export { AimdDnaSequenceField, AimdMarkdownField } from './components'
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
  AimdDnaSequenceAnnotation,
  AimdDnaSequenceQualifier,
  AimdDnaSequenceSegment,
  AimdDnaSequenceValue,
  FieldEventPayload,
  TableEventPayload,
} from './types'
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
