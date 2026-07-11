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
  renderDefaultAimdNode,
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
  AimdMarkdownPreview,
  type AimdMarkdownPreviewRenderOptions,
  type AimdMarkdownPreviewRenderResult,
  type AimdMarkdownPreviewReadonlyRecordData,
  type AimdMarkdownPreviewUrlResolver,
  type AimdMarkdownPreviewUrlResolverResult,
} from './markdown-preview'

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
  type ReadonlyRecordMarkdownRenderOptions,
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

export type {
  AimdAssignerVisibility,
  AimdRendererOptions,
  AimdWorkflowRenderOptions,
  AimdWorkflowRunState,
  RenderResult,
} from '../common/processor'
export type {
  AimdAssetUrlResolver,
  AimdAssetUrlResolveContext,
} from '../common/assetUrls'
export type {
  AimdRendererI18nOptions,
  AimdRendererLocale,
  AimdRendererMessages,
  AimdRendererMessagesInput,
} from '../locales'
