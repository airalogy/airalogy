import { findAimdInlineTemplates } from "./inline-template-scanner"

const AIMD_INLINE_TEMPLATE_TOKEN_PATTERN = /AIMDINLINETEMPLATE([0-9a-f]+)TOKEN/g
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export type AimdInlineTemplateMap = Record<string, string>

export interface ProtectedAimdInlineTemplates {
  content: string
  templates: AimdInlineTemplateMap
}

function encodeTemplateToken(value: string): string {
  const bytes = textEncoder.encode(value)
  let hex = ''

  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0')
  }

  return `AIMDINLINETEMPLATE${hex}TOKEN`
}

function decodeTemplateToken(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2)

  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16)
  }

  return textDecoder.decode(bytes)
}

export function protectAimdInlineTemplates(content: string): ProtectedAimdInlineTemplates {
  const templates: AimdInlineTemplateMap = {}
  const matches = findAimdInlineTemplates(content)
  let protectedContent = ""
  let lastIndex = 0

  for (const match of matches) {
    protectedContent += content.slice(lastIndex, match.start)

    const token = encodeTemplateToken(match.raw)
    templates[token] = match.raw
    protectedContent += token
    lastIndex = match.end
  }

  protectedContent += content.slice(lastIndex)

  return {
    content: protectedContent,
    templates,
  }
}

export function restoreAimdInlineTemplates(
  content: string,
  templates?: AimdInlineTemplateMap,
): string {
  let restored = content

  if (templates && Object.keys(templates).length > 0) {
    for (const [token, raw] of Object.entries(templates)) {
      restored = restored.split(token).join(raw)
    }
  }

  return restored.replace(AIMD_INLINE_TEMPLATE_TOKEN_PATTERN, (_, hex: string) => {
    try {
      return decodeTemplateToken(hex)
    } catch {
      return _
    }
  })
}
