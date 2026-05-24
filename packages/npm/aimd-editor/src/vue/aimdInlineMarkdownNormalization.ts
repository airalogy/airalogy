const AIMD_INLINE_TEMPLATE_TYPE_PATTERN = String.raw`(?:var(?:\\?_table)?|step|check|ref\\?_(?:step|var|fig)|cite)`
const AIMD_INLINE_TEMPLATE_PATTERN = new RegExp(String.raw`\{\{${AIMD_INLINE_TEMPLATE_TYPE_PATTERN}\s*\|[^}]+?\}\}`, 'g')
const MARKDOWN_ESCAPABLE_PATTERN = /\\([\\!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~-])/g

function normalizeSingleAimdInlineTemplate(template: string): string {
  return template.replace(MARKDOWN_ESCAPABLE_PATTERN, '$1')
}

export function normalizeAimdInlineTemplateMarkdownEscapes(content: string): string {
  return content.replace(AIMD_INLINE_TEMPLATE_PATTERN, normalizeSingleAimdInlineTemplate)
}
