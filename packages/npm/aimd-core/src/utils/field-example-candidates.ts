import type { AimdVarField } from '../types/aimd'
import { getAimdBuiltInTypeMetadata, getAimdFieldEnumValues } from './field-metadata'
import { unwrapAimdNullableType } from './nullable-type'

type Scalar = string | number | boolean
type Schema = Record<string, unknown>

export interface AimdFieldExampleOptions {
  /** JSON Schema for the variables section, including local enum definitions. */
  variablesSchema?: Schema
  /** Placeholder for a plain, unconstrained text field. */
  exampleText?: string
}

function object(value: unknown): Schema {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Schema : {}
}

function scalarSchema(id: string, variables?: Schema): Schema | undefined {
  let schema = object(object(variables?.properties)[id])
  if (Array.isArray(schema.anyOf)) {
    const alternatives = schema.anyOf.map(object).filter(item => item.type !== 'null')
    if (alternatives.length !== 1) return undefined
    schema = { ...alternatives[0], ...schema }
  }
  if (typeof schema.$ref === 'string') {
    if (!schema.$ref.startsWith('#/$defs/')) return undefined
    const definition = object(object(variables?.$defs)[schema.$ref.slice('#/$defs/'.length)])
    if (!Array.isArray(definition.enum)) return undefined
    schema = { ...definition, ...schema }
  }
  if (schema.readOnly || (schema.type && !['string', 'integer', 'number', 'boolean'].includes(String(schema.type)))) return undefined
  return schema
}

const dateExamples = new Map([
  ['date', '2000-01-01'], ['datetime', '2000-01-01T12:00:00Z'],
  ['date-time', '2000-01-01T12:00:00Z'], ['time', '12:00:00'],
])

/** Return deterministic candidates for an example Record. Never initializes live fields. */
export function getAimdFieldExampleCandidates(field: AimdVarField, options: AimdFieldExampleOptions = {}): Scalar[] {
  const schema = scalarSchema(field.id, options.variablesSchema)
  if (!schema || field.kwargs?.collector) return []
  const annotated = getAimdBuiltInTypeMetadata(field.type)
  const declared = getAimdBuiltInTypeMetadata(String(schema.airalogy_type ?? ''))
  if ((schema.airalogy_type && !declared) || annotated?.preview?.kind === 'skip' || declared?.preview?.kind === 'skip') return []
  const metadata = declared ?? annotated
  const type = unwrapAimdNullableType(field.type || String(schema.type || 'str')).toLowerCase()
  const limits = { ...field.kwargs, ...schema }
  const choices = getAimdFieldEnumValues(field)
  const candidates: unknown[] = [
    ...(field.examples ?? []).slice(0, 16),
    ...(Array.isArray(schema.examples) ? schema.examples.slice(0, 16) : []),
    field.default, schema.default, ...choices.slice(0, 16),
  ]
  if (Array.isArray(schema.enum)) candidates.push(...schema.enum.slice(0, 16))
  if (metadata?.preview?.kind === 'examples') candidates.push(...metadata.preview.values.slice(0, 16))
  else if (metadata?.preview?.kind === 'enum') candidates.push(...(metadata.enum ?? []).slice(0, 16))
  else if (type.startsWith('literal[') || ['str', 'string'].includes(type)) {
    if (!type.startsWith('literal[') && !choices.length && !Array.isArray(schema.enum) && !schema.format) {
      const min = Number(limits.minLength ?? limits.min_length ?? 1)
      const max = Number(limits.maxLength ?? limits.max_length ?? 2048)
      if (min <= 2048 && min <= max) candidates.push((options.exampleText ?? 'Example').padEnd(Math.max(1, min), 'X').slice(0, max))
    }
  } else if (['float', 'number', 'int', 'integer'].includes(type)) {
    const lower = Number(limits.minimum ?? limits.ge ?? limits.exclusiveMinimum ?? limits.gt ?? 0)
    const upper = Number(limits.maximum ?? limits.le ?? limits.exclusiveMaximum ?? limits.lt ?? lower + 2)
    const step = Number(limits.multipleOf ?? limits.multiple_of ?? 1)
    const firstMultiple = Math.ceil(lower / step) * step
    const lastMultiple = Math.floor(upper / step) * step
    candidates.push(0, lower, upper, firstMultiple, firstMultiple + step, lastMultiple, lastMultiple - step, (lower + upper) / 2)
  } else if (['bool', 'boolean'].includes(type)) {
    candidates.push(false)
  } else if (!dateExamples.has(type)) {
    return []
  }
  const date = dateExamples.get(String(schema.format || type))
  if (date) candidates.push(date)
  const pattern = metadata?.pattern ? new RegExp(metadata.pattern) : undefined
  return [...new Set(candidates)].filter((value): value is Scalar => {
    if (metadata?.enum && !metadata.enum.includes(value)) return false
    if (typeof value === 'boolean') return true
    if (typeof value === 'number') return Number.isFinite(value)
    return typeof value === 'string' && value.length > 0
      && value.length >= Number(limits.min_length ?? limits.minLength ?? 0)
      && value.length <= Number(limits.max_length ?? limits.maxLength ?? Infinity)
      && (!pattern || pattern.test(value))
  })
}
