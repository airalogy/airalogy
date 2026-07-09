import type {
  AimdCheckField,
  AimdQuizField,
  AimdStepField,
  AimdSubvar,
  AimdVarField,
  AimdVarTableField,
  ExtractedAimdFields,
} from '../types'
import {
  AIMD_RECORD_DATA_SCOPES,
  getAimdDisplayValue,
  isAimdPlainRecord,
  normalizeAimdRecordDataValue,
  stringifyAimdDisplayValue,
  type AimdRecordDataScope,
  type AimdRecordDataValue,
} from './record-display'

export type AimdRecordQueryFieldScope = AimdRecordDataScope | 'var_table'

export type AimdRecordFilterOperator =
  | 'contains'
  | 'equals'
  | 'regex'
  | 'empty'
  | 'not_empty'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'

export interface AimdRecordFieldRef {
  /** Stable protocol field key, for example `var:name` or `var_table:samples:blood_type`. */
  key: string
  /** Protocol-facing field scope. */
  scope: AimdRecordQueryFieldScope
  /** Field id inside its scope. For subvars this is the column id. */
  id: string
  /** Human-readable field label. */
  label: string
  /** Optional title from protocol metadata. */
  title?: string
  /** Type annotation, when known. */
  type?: string
  /** Description/help text from protocol metadata. */
  description?: string
  /** Enum values, when known. */
  enum?: unknown[]
  /** Actual record section used to store this field. Var tables are stored under `var`. */
  storageScope: AimdRecordDataScope
  /** Actual record key used to store this field. */
  storageKey: string
  /** Data-focus key used by recorder UIs to focus the field. */
  focusKey: string
  /** Parent table key for var_table subvars. */
  parentKey?: string
  /** Table id for var_table fields. */
  tableId?: string
  /** Column id for var_table subvars. */
  columnId?: string
}

export interface AimdRecordSearchOptions {
  fieldKeys?: readonly string[]
  caseSensitive?: boolean
  includeFieldLabels?: boolean
}

export interface AimdRecordSearchMatch {
  field: AimdRecordFieldRef
  value: unknown
  text: string
}

export interface AimdRecordFilter {
  fieldKey?: string
  operator?: AimdRecordFilterOperator
  value?: unknown
  caseSensitive?: boolean
}

export interface AimdRecordFilterRecordsOptions<T> {
  fields?: ExtractedAimdFields | readonly AimdRecordFieldRef[]
  getRecordData?: (record: T) => unknown
}

export interface AimdRecordFilterResult<T> {
  record: T
  matches: AimdRecordSearchMatch[]
}

type FieldRefInput = ExtractedAimdFields | readonly AimdRecordFieldRef[] | undefined

const STEP_RECORD_VALUE_KEYS = ['checked', 'annotation', 'elapsed_ms', 'started_at_ms', 'ended_at_ms'] as const
const CHECK_RECORD_VALUE_KEYS = ['checked', 'annotation'] as const

interface SimpleFieldMetadata {
  title?: string
  type?: string
  description?: string
  enum?: unknown[]
}

type SimpleFieldInput = AimdVarField | AimdStepField | AimdCheckField | AimdQuizField | SimpleFieldMetadata

function isFieldRefArray(value: FieldRefInput): value is readonly AimdRecordFieldRef[] {
  return Array.isArray(value) && value.every(item => item && typeof item === 'object' && typeof item.key === 'string')
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function extractFieldId(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return normalizeString(value)
  }
  if (!isAimdPlainRecord(value)) {
    return undefined
  }
  return normalizeString(value.id) ?? normalizeString(value.name)
}

function uniqueRefs(refs: AimdRecordFieldRef[]): AimdRecordFieldRef[] {
  const seen = new Set<string>()
  const unique: AimdRecordFieldRef[] = []
  for (const ref of refs) {
    if (seen.has(ref.key)) {
      continue
    }
    seen.add(ref.key)
    unique.push(ref)
  }
  return unique
}

function getFieldLabel(id: string, title?: string): string {
  return normalizeString(title) ?? id
}

function getTableSubvarLabel(table: AimdVarTableField, subvar: AimdSubvar): string {
  const tableLabel = getFieldLabel(table.id, table.title)
  return `${tableLabel}.${getFieldLabel(subvar.id, subvar.title)}`
}

function getQuizFocusKey(quiz: AimdQuizField): string {
  const prefix = `quiz:${quiz.id}`
  if (quiz.type === 'blank') {
    const firstBlank = quiz.blanks?.[0]?.key
    return firstBlank ? `${prefix}:blank:${firstBlank}` : `${prefix}:open`
  }
  if (quiz.type === 'true_false') {
    const firstOption = quiz.options?.[0]?.key ?? 'true'
    return `${prefix}:true_false:${firstOption}`
  }
  if (quiz.type === 'choice') {
    const firstOption = quiz.options?.[0]?.key
    if (firstOption) {
      return `${prefix}:${quiz.mode === 'multiple' ? 'multiple' : 'single'}:${firstOption}`
    }
  }
  if (quiz.type === 'scale') {
    const firstItem = quiz.items?.[0]?.key
    const firstOption = quiz.options?.[0]?.key
    if (firstItem && firstOption) {
      return `${prefix}:scale:${firstItem}:${firstOption}`
    }
  }
  return `${prefix}:open`
}

function normalizeFieldRefs(input: FieldRefInput): AimdRecordFieldRef[] {
  if (!input) {
    return []
  }
  if (isFieldRefArray(input)) {
    return [...input]
  }
  return collectAimdRecordFieldRefs(input)
}

function makeSimpleRef(scope: 'var' | 'step' | 'check' | 'quiz', id: string, field?: SimpleFieldInput): AimdRecordFieldRef {
  const metadata = field as SimpleFieldMetadata | undefined
  const title = normalizeString(metadata?.title)
  const type = normalizeString(metadata?.type)
  const key = `${scope}:${id}`
  const focusKey = scope === 'var'
    ? key
    : scope === 'step'
      ? `${key}:checked`
      : scope === 'check'
        ? `${key}:checked`
        : getQuizFocusKey({ id, type: 'open', stem: '', ...(field as Partial<AimdQuizField>) } as AimdQuizField)

  return {
    key,
    scope,
    id,
    label: getFieldLabel(id, title),
    title,
    type,
    description: normalizeString(metadata?.description),
    enum: Array.isArray(metadata?.enum) ? [...metadata.enum] : undefined,
    storageScope: scope,
    storageKey: id,
    focusKey,
  }
}

function createRefsFromRecordData(recordData: unknown): AimdRecordFieldRef[] {
  const normalized = normalizeAimdRecordDataValue(recordData)
  const refs: AimdRecordFieldRef[] = []
  for (const scope of AIMD_RECORD_DATA_SCOPES) {
    const section = normalized[scope]
    if (!isAimdPlainRecord(section)) {
      continue
    }
    for (const key of Object.keys(section)) {
      if (scope === 'var_table') {
        continue
      }
      refs.push(makeSimpleRef(scope, key))
    }
  }
  return refs
}

/**
 * Collect protocol-aware record field references from parsed AIMD metadata.
 */
export function collectAimdRecordFieldRefs(fields: ExtractedAimdFields | undefined | null): AimdRecordFieldRef[] {
  if (!fields) {
    return []
  }

  const refs: AimdRecordFieldRef[] = []

  const varDefinitionsById = new Map<string, AimdVarField>()
  for (const field of fields.var_definitions || []) {
    if (field?.id) {
      varDefinitionsById.set(field.id, field)
      refs.push(makeSimpleRef('var', field.id, field))
    }
  }
  for (const rawId of fields.var || []) {
    const id = extractFieldId(rawId)
    if (!id || varDefinitionsById.has(id)) {
      continue
    }
    refs.push(makeSimpleRef('var', id))
  }

  for (const table of fields.var_table || []) {
    if (!table?.id) {
      continue
    }
    const firstColumn = table.subvars?.[0]?.id
    const tableTitle = normalizeString(table.title)
    const tableKey = `var_table:${table.id}`
    refs.push({
      key: tableKey,
      scope: 'var_table',
      id: table.id,
      label: getFieldLabel(table.id, tableTitle),
      title: tableTitle,
      type: normalizeString(table.type_annotation),
      description: normalizeString(table.description),
      storageScope: 'var',
      storageKey: table.id,
      focusKey: firstColumn ? `var_table:${table.id}:0:${firstColumn}` : tableKey,
      tableId: table.id,
    })

    for (const subvar of table.subvars || []) {
      if (!subvar?.id) {
        continue
      }
      refs.push({
        key: `var_table:${table.id}:${subvar.id}`,
        scope: 'var_table',
        id: subvar.id,
        label: getTableSubvarLabel(table, subvar),
        title: normalizeString(subvar.title),
        type: normalizeString(subvar.type),
        description: normalizeString(subvar.description),
        enum: Array.isArray(subvar.enum) ? [...subvar.enum] : undefined,
        storageScope: 'var',
        storageKey: table.id,
        focusKey: `var_table:${table.id}:0:${subvar.id}`,
        parentKey: tableKey,
        tableId: table.id,
        columnId: subvar.id,
      })
    }
  }

  const stepDefinitionsById = new Map<string, AimdStepField>()
  for (const field of fields.step_hierarchy || []) {
    if (field?.id) {
      stepDefinitionsById.set(field.id, field)
      refs.push(makeSimpleRef('step', field.id, field))
    }
  }
  for (const rawId of fields.step || []) {
    const id = extractFieldId(rawId)
    if (!id || stepDefinitionsById.has(id)) {
      continue
    }
    refs.push(makeSimpleRef('step', id))
  }

  for (const rawId of fields.check || []) {
    const id = extractFieldId(rawId)
    if (id) {
      refs.push(makeSimpleRef('check', id))
    }
  }

  for (const quiz of fields.quiz || []) {
    if (quiz?.id) {
      refs.push(makeSimpleRef('quiz', quiz.id, quiz))
    }
  }

  return uniqueRefs(refs)
}

export function findAimdRecordFieldRef(
  fieldsOrRefs: FieldRefInput,
  fieldKey: string,
): AimdRecordFieldRef | undefined {
  return normalizeFieldRefs(fieldsOrRefs).find(ref => ref.key === fieldKey)
}

function parseAimdRecordFieldKey(fieldKey: string): AimdRecordFieldRef | undefined {
  const parts = fieldKey.split(':')
  const scope = parts[0]
  const id = parts[1]
  if (!id) {
    return undefined
  }
  if (scope === 'var' || scope === 'step' || scope === 'check' || scope === 'quiz') {
    return makeSimpleRef(scope, id)
  }
  if (scope === 'var_table') {
    const columnId = parts[2]
    if (columnId) {
      return {
        key: fieldKey,
        scope: 'var_table',
        id: columnId,
        label: `${id}.${columnId}`,
        storageScope: 'var',
        storageKey: id,
        focusKey: `var_table:${id}:0:${columnId}`,
        parentKey: `var_table:${id}`,
        tableId: id,
        columnId,
      }
    }
    return {
      key: fieldKey,
      scope: 'var_table',
      id,
      label: id,
      storageScope: 'var',
      storageKey: id,
      focusKey: fieldKey,
      tableId: id,
    }
  }
  return undefined
}

function getRecordSection(recordData: AimdRecordDataValue, scope: AimdRecordDataScope): Record<string, unknown> {
  const section = recordData[scope]
  return isAimdPlainRecord(section) ? section : {}
}

function getStructuredRecordText(value: unknown, preferredKeys: readonly string[]): string {
  if (!isAimdPlainRecord(value)) {
    return stringifyAimdRecordSearchValue(value)
  }
  const parts: string[] = []
  for (const key of preferredKeys) {
    const text = stringifyAimdRecordSearchValue(value[key])
    if (text) {
      parts.push(text)
    }
  }
  return parts.join(' ')
}

export function getAimdRecordFieldValue(recordData: unknown, field: AimdRecordFieldRef | string): unknown {
  const ref = typeof field === 'string' ? parseAimdRecordFieldKey(field) : field
  if (!ref) {
    return undefined
  }

  const normalized = normalizeAimdRecordDataValue(recordData)
  const section = getRecordSection(normalized, ref.storageScope)
  const rawValue = section[ref.storageKey]

  if (ref.scope === 'var_table' && ref.columnId) {
    const rows = Array.isArray(rawValue) ? rawValue : []
    return rows
      .map((row) => {
        if (!isAimdPlainRecord(row)) {
          return undefined
        }
        return getAimdDisplayValue(row[ref.columnId as string])
      })
      .filter(value => value !== undefined && value !== null && stringifyAimdRecordSearchValue(value) !== '')
  }

  return getAimdDisplayValue(rawValue)
}

export function stringifyAimdRecordSearchValue(value: unknown): string {
  const displayValue = getAimdDisplayValue(value)
  if (displayValue === null || displayValue === undefined) {
    return ''
  }
  if (Array.isArray(displayValue)) {
    return displayValue.map(item => stringifyAimdRecordSearchValue(item)).filter(Boolean).join(' ')
  }
  if (isAimdPlainRecord(displayValue)) {
    return Object.entries(displayValue)
      .filter(([key]) => !key.startsWith('__'))
      .map(([, item]) => stringifyAimdRecordSearchValue(item))
      .filter(Boolean)
      .join(' ')
  }
  return stringifyAimdDisplayValue(displayValue)
}

function isAimdRecordValueEmpty(value: unknown): boolean {
  const displayValue = getAimdDisplayValue(value)
  if (displayValue === null || displayValue === undefined) {
    return true
  }
  if (typeof displayValue === 'string') {
    return displayValue.trim() === ''
  }
  if (Array.isArray(displayValue)) {
    return displayValue.length === 0 || displayValue.every(item => isAimdRecordValueEmpty(item))
  }
  if (isAimdPlainRecord(displayValue)) {
    return Object.keys(displayValue).length === 0
      || Object.values(displayValue).every(item => isAimdRecordValueEmpty(item))
  }
  return false
}

function normalizeComparableText(value: unknown, caseSensitive?: boolean): string {
  const text = stringifyAimdRecordSearchValue(value)
  return caseSensitive ? text : text.toLocaleLowerCase()
}

function normalizeExpectedText(value: unknown, caseSensitive?: boolean): string {
  const text = value === undefined || value === null ? '' : String(value)
  return caseSensitive ? text : text.toLocaleLowerCase()
}

function valuesEqual(actual: unknown, expected: unknown, caseSensitive?: boolean): boolean {
  const displayActual = getAimdDisplayValue(actual)
  const displayExpected = getAimdDisplayValue(expected)

  if (Array.isArray(displayActual)) {
    return displayActual.some(item => valuesEqual(item, displayExpected, caseSensitive))
  }
  if (typeof displayActual === 'number' || typeof displayActual === 'boolean') {
    return displayActual === displayExpected || String(displayActual) === String(displayExpected)
  }
  return normalizeComparableText(displayActual, caseSensitive) === normalizeExpectedText(displayExpected, caseSensitive)
}

function compareNumeric(actual: unknown, expected: unknown, predicate: (left: number, right: number) => boolean): boolean {
  const displayActual = getAimdDisplayValue(actual)
  if (Array.isArray(displayActual)) {
    return displayActual.some(item => compareNumeric(item, expected, predicate))
  }

  const left = typeof displayActual === 'number' ? displayActual : Number(displayActual)
  const right = typeof expected === 'number' ? expected : Number(expected)
  return Number.isFinite(left) && Number.isFinite(right) && predicate(left, right)
}

export function doesAimdRecordValueMatch(
  value: unknown,
  operator: AimdRecordFilterOperator = 'contains',
  expected?: unknown,
  options: { caseSensitive?: boolean } = {},
): boolean {
  switch (operator) {
    case 'empty':
      return isAimdRecordValueEmpty(value)
    case 'not_empty':
      return !isAimdRecordValueEmpty(value)
    case 'equals':
      return valuesEqual(value, expected, options.caseSensitive)
    case 'regex': {
      const pattern = expected === undefined || expected === null ? '' : String(expected)
      if (!pattern) {
        return true
      }
      try {
        return new RegExp(pattern, options.caseSensitive ? '' : 'i').test(stringifyAimdRecordSearchValue(value))
      }
      catch {
        return false
      }
    }
    case 'gt':
      return compareNumeric(value, expected, (left, right) => left > right)
    case 'gte':
      return compareNumeric(value, expected, (left, right) => left >= right)
    case 'lt':
      return compareNumeric(value, expected, (left, right) => left < right)
    case 'lte':
      return compareNumeric(value, expected, (left, right) => left <= right)
    case 'contains':
    default: {
      const needle = normalizeExpectedText(expected, options.caseSensitive).trim()
      if (!needle) {
        return true
      }
      return normalizeComparableText(value, options.caseSensitive).includes(needle)
    }
  }
}

export function searchAimdRecordFields(
  recordData: unknown,
  query: unknown,
  fieldsOrRefs?: FieldRefInput,
  options: AimdRecordSearchOptions = {},
): AimdRecordSearchMatch[] {
  const needle = normalizeExpectedText(query, options.caseSensitive).trim()
  if (!needle) {
    return []
  }

  const fieldKeySet = options.fieldKeys ? new Set(options.fieldKeys) : null
  const refs = normalizeFieldRefs(fieldsOrRefs)
  const searchableRefs = refs.length > 0 ? refs : createRefsFromRecordData(recordData)
  const matches: AimdRecordSearchMatch[] = []

  for (const field of searchableRefs) {
    if (fieldKeySet && !fieldKeySet.has(field.key)) {
      continue
    }
    const value = getAimdRecordFieldValue(recordData, field)
    const valueText = field.scope === 'step'
      ? getStructuredRecordText(value, STEP_RECORD_VALUE_KEYS)
      : field.scope === 'check'
        ? getStructuredRecordText(value, CHECK_RECORD_VALUE_KEYS)
        : stringifyAimdRecordSearchValue(value)
    const labelText = options.includeFieldLabels ? ` ${field.label} ${field.key}` : ''
    const haystack = options.caseSensitive ? `${valueText}${labelText}` : `${valueText}${labelText}`.toLocaleLowerCase()
    if (haystack.includes(needle)) {
      matches.push({ field, value, text: valueText })
    }
  }

  return matches
}

export function filterAimdRecord(
  recordData: unknown,
  fieldsOrRefs: FieldRefInput,
  filter: AimdRecordFilter,
): boolean {
  return matchAimdRecordFilterFields(recordData, fieldsOrRefs, filter).length > 0
}

function matchAimdRecordFilterFields(
  recordData: unknown,
  fieldsOrRefs: FieldRefInput,
  filter: AimdRecordFilter,
): AimdRecordSearchMatch[] {
  const operator = filter.operator ?? 'contains'
  const refs = normalizeFieldRefs(fieldsOrRefs)
  const searchableRefs = refs.length > 0 ? refs : createRefsFromRecordData(recordData)
  const selectedRefs = filter.fieldKey
    ? [
        searchableRefs.find(item => item.key === filter.fieldKey)
          ?? parseAimdRecordFieldKey(filter.fieldKey),
      ].filter((ref): ref is AimdRecordFieldRef => Boolean(ref))
    : searchableRefs

  return selectedRefs.map((ref) => {
    const value = getAimdRecordFieldValue(recordData, ref)
    return doesAimdRecordValueMatch(value, operator, filter.value, { caseSensitive: filter.caseSensitive })
      ? {
          field: ref,
          value,
          text: stringifyAimdRecordSearchValue(value),
        }
      : null
  }).filter((match): match is AimdRecordSearchMatch => match !== null)
}

export function filterAimdRecords<T>(
  records: readonly T[],
  filter: AimdRecordFilter,
  options: AimdRecordFilterRecordsOptions<T> = {},
): AimdRecordFilterResult<T>[] {
  const getRecordData = options.getRecordData ?? ((record: T) => record)
  return records
    .map((record) => {
      const recordData = getRecordData(record)
      const matches = matchAimdRecordFilterFields(recordData, options.fields, filter)
      return matches.length > 0 ? { record, matches } : null
    })
    .filter((item): item is AimdRecordFilterResult<T> => item !== null)
}
