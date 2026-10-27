import { findAimdInlineTemplates } from '@airalogy/aimd-core/parser'

const MARKDOWN_ESCAPABLE_PATTERN = /[\\!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~-]/

function normalizeSingleAimdInlineTemplate(template: string): string {
  let result = ''
  let quote: string | undefined
  for (let index = 0; index < template.length; index++) {
    const char = template[index]
    if (quote) {
      result += char
      if (char === '\\' && index + 1 < template.length) result += template[++index]
      else if (char === quote) quote = undefined
      continue
    }
    if (char === '"' || char === "'") quote = char
    if (char === '\\' && MARKDOWN_ESCAPABLE_PATTERN.test(template[index + 1] ?? '')) {
      result += template[++index]
      continue
    }
    // Older visual-editor drafts escaped leading indentation as character references.
    if (char === '&' && /^[ \t]*$/.test(result.slice(result.lastIndexOf('\n') + 1))) {
      const space = template.slice(index).match(/^&#(?:x0*20|0*32);/i)
      if (space) {
        result += ' '
        index += space[0].length - 1
        continue
      }
    }
    result += char
  }
  return result
}

export function normalizeAimdInlineTemplateMarkdownEscapes(content: string): string {
  let normalized = ''
  let lastIndex = 0
  for (const match of findAimdInlineTemplates(content, { allowMarkdownEscapedTypes: true })) {
    normalized += content.slice(lastIndex, match.start) + normalizeSingleAimdInlineTemplate(match.raw)
    lastIndex = match.end
  }
  return normalized + content.slice(lastIndex)
}
