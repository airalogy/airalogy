import type { AimdFieldType } from "../types/nodes"

const AIMD_INLINE_TEMPLATE_START_PATTERN = /\{\{\s*(var_table|var|step|check|ref_step|ref_var|ref_fig|ref_media|cite)\s*\|/g
const AIMD_ESCAPED_INLINE_TEMPLATE_START_PATTERN = /\{\{\s*(var(?:\\?_table)?|step|check|ref\\?_(?:step|var|fig|media)|cite)\s*\|/g

export interface AimdInlineTemplateScanOptions {
  /** Only for repairing visual-editor drafts, not formal AIMD parsing. */
  allowMarkdownEscapedTypes?: boolean
}

export interface AimdInlineTemplateMatch {
  type: AimdFieldType
  content: string
  raw: string
  start: number
  end: number
}

function isEscaped(value: string, index: number): boolean {
  let slashCount = 0

  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1
  }

  return slashCount % 2 === 1
}

function findTemplateEnd(value: string, contentStart: number): number {
  let quote: "\"" | "'" | null = null

  for (let index = contentStart; index < value.length; index += 1) {
    const char = value[index]

    if (quote) {
      if (char === quote && !isEscaped(value, index)) {
        quote = null
      }
      continue
    }

    if (char === "\"" || char === "'") {
      quote = char
      continue
    }

    if (char === "}" && value[index + 1] === "}") {
      return index + 2
    }
  }

  return -1
}

export function findAimdInlineTemplates(value: string, options: AimdInlineTemplateScanOptions = {}): AimdInlineTemplateMatch[] {
  const matches: AimdInlineTemplateMatch[] = []
  const startPattern = options.allowMarkdownEscapedTypes
    ? AIMD_ESCAPED_INLINE_TEMPLATE_START_PATTERN
    : AIMD_INLINE_TEMPLATE_START_PATTERN
  let searchIndex = 0

  while (searchIndex < value.length) {
    startPattern.lastIndex = searchIndex
    const match = startPattern.exec(value)

    if (!match) {
      break
    }

    const start = match.index
    const contentStart = startPattern.lastIndex
    const end = findTemplateEnd(value, contentStart)

    if (end === -1) {
      searchIndex = contentStart
      continue
    }

    const rawContent = value.slice(contentStart, end - 2)
    const raw = value.slice(start, end)

    matches.push({
      type: match[1].replace(/\\_/g, "_") as AimdFieldType,
      content: rawContent.trim(),
      raw,
      start,
      end,
    })

    searchIndex = end
  }

  return matches
}
