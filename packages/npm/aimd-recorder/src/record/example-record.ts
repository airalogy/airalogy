import type { ExtractedAimdFields } from '@airalogy/aimd-core/types'
import { getAimdFieldExampleCandidates } from '@airalogy/aimd-core/utils'
import type { AimdRecordValidationSchema } from '../types'
import { createEmptyProtocolRecordData } from '../types'
import { validationMessages } from './validation-messages'
import { validateAimdRecord } from './validation'

export interface AimdExampleRecordOptions {
  schema?: AimdRecordValidationSchema
  /** Outputs calculated by the host. Client assigner outputs are detected from AIMD. */
  assignedFields?: readonly string[]
  locale?: string
  exampleText?: string
}

/** Build a new, in-memory test Record without executing assigners or contacting the host. */
export function createExampleRecord(fields: ExtractedAimdFields, options: AimdExampleRecordOptions = {}) {
  const record = createEmptyProtocolRecordData()
  const skipped: string[] = []
  const outputs = new Set([...(options.assignedFields ?? []), ...fields.client_assigner.flatMap(item => item.assigned_fields)])
  const definitions = new Map(fields.var_definitions?.map(field => [field.id, field]))
  const section = options.schema?.vars ?? options.schema?.research_variable
  const variablesSchema = section && typeof section === 'object' && !Array.isArray(section) ? section as Record<string, unknown> : undefined
  const locale = options.locale?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
  const exampleText = options.exampleText ?? (locale === 'zh-CN' ? '示例' : 'Example')
  const remaining = new Map<string, (string | number | boolean)[]>()

  for (const id of new Set(fields.var)) {
    if (outputs.has(id) || Object.prototype.hasOwnProperty.call(Object.prototype, id) || id === 'prototype') {
      skipped.push(id)
      continue
    }
    const [first, ...alternatives] = getAimdFieldExampleCandidates(definitions.get(id) ?? { id }, { variablesSchema, exampleText })
    if (first === undefined) {
      skipped.push(id)
      continue
    }
    record.var[id] = first
    remaining.set(id, alternatives)
  }
  // Retry rejected values with the same validator that checks a manual Record.
  const messages = validationMessages[locale]
  while (remaining.size) {
    const result = validateAimdRecord(fields, record, { schema: options.schema, messages })
    const schemaIssue = result.issues.find(issue => issue.fieldKey === 'var:$schema')
    if (schemaIssue?.keyword === 'compile') throw new Error(schemaIssue.message)
    const invalid = new Set(result.issues.map(issue => issue.fieldKey))
    if (!invalid.size) break
    let changed = false
    for (const [id, alternatives] of remaining) {
      if (!invalid.has(`var:${id}`)) continue
      changed = true
      if (alternatives.length) record.var[id] = alternatives.shift()
      else {
        delete record.var[id]
        remaining.delete(id)
        skipped.push(id)
      }
    }
    if (!changed) {
      if (schemaIssue) throw new Error(schemaIssue.message)
      break
    }
  }
  return { record, skipped }
}
