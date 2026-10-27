const EMPTY_TYPES = new Set(['none', 'nonetype', 'null', 'undefined'])

function splitTypeExpression(value: string, separator: string): string[] {
  const parts: string[] = []
  let start = 0
  let depth = 0
  let quote = ''
  let escaped = false
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
    } else if (char === '"' || char === "'") quote = char
    else if ('[({'.includes(char)) depth += 1
    else if ('])}'.includes(char)) depth -= 1
    else if (char === separator && depth === 0) {
      parts.push(value.slice(start, index).trim())
      start = index + 1
    }
  }
  parts.push(value.slice(start).trim())
  return parts
}

function typeParts(value: string): { optional?: string; union: string[] } {
  const topLevelUnion = splitTypeExpression(value, '|')
  if (topLevelUnion.length > 1) return { union: topLevelUnion }
  const generic = value.match(/^(?:(?:typing|typing_extensions)\.)?(Optional|Union)\s*\[([\s\S]*)\]$/i)
  if (generic?.[1].toLowerCase() === 'optional') return { optional: generic[2].trim(), union: [] }
  return { union: generic ? splitTypeExpression(generic[2], ',') : topLevelUnion }
}

function isEmptyType(value: string): boolean {
  return EMPTY_TYPES.has(value.toLowerCase())
}

/** Unwrap nullable single-type annotations without changing literals or multi-type unions. */
export function unwrapAimdNullableType(value: unknown): string {
  let type = typeof value === 'string' ? value.trim() : ''
  for (let depth = 0; depth < 32; depth += 1) {
    const { optional, union } = typeParts(type)
    if (optional !== undefined && optional !== type) { type = optional; continue }
    const nonEmpty = union.filter(part => !isEmptyType(part))
    if (union.length > 1 && nonEmpty.length === 1 && nonEmpty[0]) { type = nonEmpty[0]; continue }
    break
  }
  return type
}

export function isAimdNullableType(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const { optional, union } = typeParts(value.trim())
  return optional !== undefined || (union.length > 1 && union.some(isEmptyType))
}
