import { restoreAimdInlineTemplates } from '@airalogy/aimd-core'
import { normalizeAimdInlineTemplateMarkdownEscapes } from './aimdInlineMarkdownNormalization'

export function normalizeComparableAimdMarkdown(markdown: string): string {
  return normalizeAimdInlineTemplateMarkdownEscapes(restoreAimdInlineTemplates(markdown))
}
