import { parseCheckContent, parseStepContent, parseVarDefinition } from '@airalogy/aimd-core/parser'
import { parseAndExtract } from '@airalogy/aimd-renderer'

export const AIMD_FIELD_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Include references so inserting a new field cannot accidentally resolve an unrelated reference. */
export function collectAimdFieldIds(markdown: string): Set<string> {
  const ids = new Set<string>()
  try {
    const fields = parseAndExtract(markdown)
    for (const value of Object.values(fields)) {
      if (!Array.isArray(value)) continue
      for (const field of value) {
        if (typeof field === 'string') ids.add(field)
        else if (field && typeof field.id === 'string') ids.add(field.id)
      }
    }
  } catch {
    // Broken draft blocks must not prevent insertion; reserve all visible template IDs conservatively.
    for (const match of markdown.matchAll(/\{\{\w+\|\s*([A-Za-z_]\w*)/g)) ids.add(match[1])
  }
  return ids
}

export function createAimdFieldId(existingIds: Iterable<string>, prefix = 'field'): string {
  const ids = new Set(existingIds)
  const base = AIMD_FIELD_ID_PATTERN.test(prefix) ? prefix : 'field'
  let serial = 1
  while (ids.has(`${base}_${serial}`)) serial += 1
  return `${base}_${serial}`
}

export function serializeAimdFieldValue(value: unknown): string {
  if (value === null) return 'None'
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (Array.isArray(value)) return `[${value.map(serializeAimdFieldValue).join(', ')}]`
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).map(([key, item]) => `${JSON.stringify(key)}: ${serializeAimdFieldValue(item)}`).join(', ')}}`
  }
  return JSON.stringify(value)
}

/** Edit common properties while retaining defaults and other parsed field metadata. */
export function updateAimdInputField(
  original: string | undefined,
  values: { id: string; type: string; title: string; defaultRaw: string; clearEnum?: boolean },
): string {
  const definition = original ? parseVarDefinition(original) : undefined
  if (definition?.subvars) throw new Error('Table definitions must be edited with the table editor.')
  const kwargs = { ...definition?.kwargs }
  if (values.clearEnum) delete kwargs.enum
  if (values.title.trim()) kwargs.title = values.title.trim()
  else delete kwargs.title
  let result = values.id.trim()
  if (values.type.trim()) result += `: ${values.type.trim()}`
  if (values.defaultRaw.trim()) result += ` = ${values.defaultRaw.trim()}`
  for (const [key, value] of Object.entries(kwargs)) {
    result += `, ${key} = ${serializeAimdFieldValue(value)}`
  }
  return result
}

/** Keep the step identity and unrelated options intact when editing presentation. */
export function updateAimdStepField(
  original: string | undefined,
  values: { id: string; title: string; level: number; check: boolean; duration: string; timer: string },
): string {
  const parsed = original ? parseStepContent(original) : undefined
  const kwargs = { ...parsed?.props }
  delete kwargs.level
  if (values.title.trim()) kwargs.title = values.title.trim()
  else delete kwargs.title
  if (values.check || 'check' in kwargs) kwargs.check = values.check
  if (values.duration.trim()) kwargs.duration = values.duration.trim()
  else delete kwargs.duration
  if (values.timer !== 'elapsed' || 'timer' in kwargs) kwargs.timer = values.timer
  return `${parsed?.id ?? values.id.trim()}${values.level === 1 ? '' : `, ${values.level}`}${Object.entries(kwargs).map(([key, value]) => `, ${key}=${serializeAimdFieldValue(value)}`).join('')}`
}

export function updateAimdCheckField(
  original: string | undefined,
  values: { id: string; title: string; checkedMessage: string },
): string {
  const parsed = original ? parseCheckContent(original) : undefined
  return `${parsed?.id ?? values.id.trim()}${values.title.trim() ? `, title=${JSON.stringify(values.title.trim())}` : ''}${values.checkedMessage ? `, checked_message=${JSON.stringify(values.checkedMessage)}` : ''}`
}
