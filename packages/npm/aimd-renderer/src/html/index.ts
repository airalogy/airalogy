/**
 * HTML rendering exports
 */

export {
  createCustomElementAimdRenderer,
  createHtmlProcessor,
  renderToHtml,
  renderToHtmlSync,
  parseAndExtract,
} from '../common/processor'

export {
  createAimdRendererMessages,
  DEFAULT_AIMD_RENDERER_LOCALE,
  resolveAimdRendererLocale,
} from '../locales'

export type { ProcessorOptions } from '@airalogy/aimd-core/types'
export type {
  AimdAssignerVisibility,
  AimdHtmlNodeRenderer,
  AimdHtmlRendererContext,
  CustomElementAimdRendererOptions,
  AimdRendererOptions,
  RenderResult,
} from '../common/processor'
export type {
  AimdRendererI18nOptions,
  AimdRendererLocale,
  AimdRendererMessages,
  AimdRendererMessagesInput,
} from '../locales'
