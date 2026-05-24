/**
 * @airalogy/aimd-renderer
 * 
 * AIMD rendering engines for HTML and Vue
 */

// Common exports
export {
  createCustomElementAimdRenderer,
  createHtmlProcessor,
  createRenderer,
  defaultRenderer,
  parseAndExtract,
  renderToHtml,
  renderToHtmlSync,
  renderToVue,
} from './common/processor'

export {
  createAimdRendererMessages,
  DEFAULT_AIMD_RENDERER_LOCALE,
  getAimdRendererQuizTypeLabel,
  resolveAimdRendererLocale,
} from './locales'

export {
  bubbleMenuEventKey,
  draftEventKey,
  fieldEventKey,
  protocolKey,
  reportEventKey,
} from './common/eventKeys'

export {
  type AssetResponse,
  createUnifiedTokenRenderer,
  type TokenLike,
  type TokenProps,
  type UnifiedRendererContext,
  type UnifiedTokenRendererOptions,
} from './common/unified-token-renderer'

// Vue renderer exports
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
  type ElementRenderer,
  hastToVue,
  renderToVNodes,
  type AimdStepCardRendererOptions,
  type ShikiHighlighter,
  type VueRendererOptions,
} from './vue/vue-renderer'

// Re-export types from aimd-core
export type {
  ProcessorOptions,
  RenderContext,
  RenderMode,
  RenderNode,
  TokenRenderRule,
} from '@airalogy/aimd-core/types'

// Re-export RenderResult from processor
export type {
  AimdAssignerVisibility,
  AimdHtmlNodeRenderer,
  AimdHtmlRendererContext,
  CustomElementAimdRendererOptions,
  AimdRendererOptions,
  RenderResult,
} from './common/processor'
export type {
  AimdRendererI18nOptions,
  AimdRendererLocale,
  AimdRendererMessages,
  AimdRendererMessagesInput,
} from './locales'

// Helper function
export function getFinalIndent(item: { parent?: any, sequence: number, level: number }): string {
  const { parent, sequence, level } = item
  let indent = String(sequence + 1)

  if (level === 1) {
    return indent
  }

  let parentNode = parent

  while (parentNode) {
    indent = `${parentNode.sequence + 1}.${indent}`
    parentNode = parentNode.parent
  }

  return indent
}

export function parseFieldTag(template: string): { type: string, name: string }[] {
  const isTable = template.startsWith("var_table")
  if (isTable) {
    const [type, _, group, ...rest] = template.split(/(\\)?\|/g)
    return [{ type, name: `${group}|${rest.filter(Boolean).join(",")}` }]
  }
  const [type, _, name] = template.split(/(\\)?\|/)
  return [{ type, name }]
}
