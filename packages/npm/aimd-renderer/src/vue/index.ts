/**
 * Vue rendering exports
 */

export {
  type AimdComponentRenderer,
  type AimdRendererContext,
  type AssetResolver,
  createAssetRenderer,
  createCodeBlockRenderer,
  createComponentRenderer,
  createEmbeddedRenderer,
  createMermaidRenderer,
  createStepCardRenderer,
  loadShikiHighlighter,
  type CodeBlockRendererOptions,
  type ElementRenderer,
  hastToVue,
  renderToVNodes,
  type LoadShikiHighlighterOptions,
  type AimdStepCardRendererOptions,
  type ShikiHighlighter,
  type VueRendererOptions,
} from './vue-renderer'

export {
  AIMD_RECORD_RENDER_SCOPES,
  createReadonlyRecordAimdRenderers,
  createReadonlyRecordElementRenderers,
  createReadonlyRecordRenderContext,
  normalizeRecordRenderValue,
  renderReadonlyRecordToVue,
  type AimdRecordRenderScope,
  type AimdRecordRenderValue,
  type ReadonlyRecordAsset,
  type ReadonlyRecordAssetKind,
  type ReadonlyRecordAssetResolveContext,
  type ReadonlyRecordAssetResolver,
  type ReadonlyRecordRenderContextInput,
  type ReadonlyRecordVueRendererOptions,
} from './readonly-record-renderer'

export {
  renderToVue,
  createRenderer,
  defaultRenderer,
} from '../common/processor'

export {
  createAimdRendererMessages,
  DEFAULT_AIMD_RENDERER_LOCALE,
  resolveAimdRendererLocale,
} from '../locales'

export type {
  RenderContext,
  RenderMode,
  ProcessorOptions,
} from '@airalogy/aimd-core/types'

export type { AimdAssignerVisibility, AimdRendererOptions, RenderResult } from '../common/processor'
export type {
  AimdRendererI18nOptions,
  AimdRendererLocale,
  AimdRendererMessages,
  AimdRendererMessagesInput,
} from '../locales'
