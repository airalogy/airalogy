import type { AimdFieldType } from "../types/nodes"

const AIMD_INLINE_TEMPLATE_START_PATTERN = /\{\{\s*(var_table|var|step|check|ref_step|ref_var|ref_fig|cite)\s*\|/g

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

export function findAimdInlineTemplates(value: string): AimdInlineTemplateMatch[] {
  const matches: AimdInlineTemplateMatch[] = []
  let searchIndex = 0

  while (searchIndex < value.length) {
    AIMD_INLINE_TEMPLATE_START_PATTERN.lastIndex = searchIndex
    const match = AIMD_INLINE_TEMPLATE_START_PATTERN.exec(value)

    if (!match) {
      break
    }

    const start = match.index
    const contentStart = AIMD_INLINE_TEMPLATE_START_PATTERN.lastIndex
    const end = findTemplateEnd(value, contentStart)

    if (end === -1) {
      searchIndex = contentStart
      continue
    }

    const rawContent = value.slice(contentStart, end - 2)
    const raw = value.slice(start, end)

    matches.push({
      type: match[1] as AimdFieldType,
      content: rawContent.trim(),
      raw,
      start,
      end,
    })

    searchIndex = end
  }

  return matches
}
