import type { ExtractedAimdFields } from '../types'
import {
  getAimdDisplayValue,
  isAimdBooleanType,
  isAimdCodeType,
  isAimdDnaType,
  isAimdFileLikeType,
  isAimdMarkdownType,
  isAimdPlainRecord,
  normalizeAimdOptionalTypeName,
} from './record-display'
import {
  collectAimdRecordFieldRefs,
  getAimdRecordFieldValue,
  stringifyAimdRecordSearchValue,
  type AimdRecordFieldRef,
} from './record-query'

export type AimdRecordViewValueKind =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'enum'
  | 'markdown'
  | 'file'
  | 'table'
  | 'step'
  | 'check'
  | 'quiz'
  | 'code'
  | 'dna'
  | 'structured'

export interface AimdRecordViewColumn extends AimdRecordFieldRef {
  valueKind: AimdRecordViewValueKind
  defaultVisible: boolean
}

export interface AimdRecordViewColumnOptions {
  /** Explicit default columns, in display order. Unknown keys are ignored. */
  defaultFieldKeys?: readonly string[]
  /** Number of automatically selected protocol fields. Defaults to 6. */
  maxDefaultColumns?: number
}

export interface AimdRecordViewCell {
  field: AimdRecordViewColumn
  value: unknown
  text: string
  empty: boolean
  count?: number
  checked?: boolean
  annotation?: string
  compareKey: string
}

const NUMBER_TYPE_RE = /^(?:int|integer|float|double|decimal|number|bigint|bigdecimal)$/
const DATE_TYPE_RE = /^(?:date|datetime|time|timestamp|localdate|localdatetime|zoneddatetime)$/

export function getAimdRecordViewValueKind(field: AimdRecordFieldRef): AimdRecordViewValueKind {
  if (field.scope === 'var_table' && !field.columnId) {
    return 'table'
  }
  if (field.scope === 'step') {
    return 'step'
  }
  if (field.scope === 'check') {
    return 'check'
  }
  if (field.scope === 'quiz') {
    return 'quiz'
  }
  if (field.enum?.length) {
    return 'enum'
  }

  const type = normalizeAimdOptionalTypeName(field.type)
  if (isAimdBooleanType(type)) {
    return 'boolean'
  }
  if (isAimdMarkdownType(type)) {
    return 'markdown'
  }
  if (isAimdFileLikeType(type)) {
    return 'file'
  }
  if (isAimdCodeType(type)) {
    return 'code'
  }
  if (isAimdDnaType(type)) {
    return 'dna'
  }
  if (NUMBER_TYPE_RE.test(type)) {
    return 'number'
  }
  if (DATE_TYPE_RE.test(type)) {
    return 'date'
  }
  return 'text'
}

function defaultColumnPriority(column: AimdRecordViewColumn): number {
  if (column.scope === 'var' && ['text', 'number', 'boolean', 'date', 'enum'].includes(column.valueKind)) {
    return 0
  }
  if (column.scope === 'check') {
    return 1
  }
  if (column.scope === 'step') {
    return 2
  }
  if (column.scope === 'quiz') {
    return 3
  }
  if (column.scope === 'var' && !column.columnId) {
    return 4
  }
  if (column.valueKind === 'table') {
    return 5
  }
  if (column.columnId) {
    return 6
  }
  return 7
}

/**
 * Build protocol-aware columns for multi-Record views.
 *
 * All fields remain available for column pickers. `defaultVisible` selects a
 * compact summary without hiding complex fields from explicit selection.
 */
export function createAimdRecordViewColumns(
  fields: ExtractedAimdFields | undefined | null,
  options: AimdRecordViewColumnOptions = {},
): AimdRecordViewColumn[] {
  const columns = collectAimdRecordFieldRefs(fields).map((field): AimdRecordViewColumn => ({
    ...field,
    valueKind: getAimdRecordViewValueKind(field),
    defaultVisible: false,
  }))

  const requestedKeys = options.defaultFieldKeys?.length
    ? options.defaultFieldKeys
    : undefined
  const maxDefaultColumns = Math.max(1, options.maxDefaultColumns ?? 6)
  const selectedKeys = new Set<string>()

  if (requestedKeys) {
    const knownKeys = new Set(columns.map(column => column.key))
    for (const key of requestedKeys) {
      if (knownKeys.has(key)) {
        selectedKeys.add(key)
      }
    }
  }
  else {
    const rankedColumns = columns
      .map((column, index) => ({ column, index }))
      .sort((left, right) => {
        const priorityDiff = defaultColumnPriority(left.column) - defaultColumnPriority(right.column)
        return priorityDiff || left.index - right.index
      })

    for (const { column } of rankedColumns) {
      if (selectedKeys.size >= maxDefaultColumns) {
        break
      }
      selectedKeys.add(column.key)
    }
  }

  return columns.map(column => ({
    ...column,
    defaultVisible: selectedKeys.has(column.key),
  }))
}

export function getDefaultAimdRecordViewFieldKeys(
  columns: readonly AimdRecordViewColumn[],
): string[] {
  return columns.filter(column => column.defaultVisible).map(column => column.key)
}

function isRecordViewValueEmpty(value: unknown): boolean {
  const displayValue = getAimdDisplayValue(value)
  if (displayValue === null || displayValue === undefined) {
    return true
  }
  if (typeof displayValue === 'string') {
    return displayValue.trim() === ''
  }
  if (Array.isArray(displayValue)) {
    return displayValue.length === 0 || displayValue.every(item => isRecordViewValueEmpty(item))
  }
  if (isAimdPlainRecord(displayValue)) {
    const values = Object.entries(displayValue)
      .filter(([key]) => !key.startsWith('__'))
      .map(([, item]) => item)
    return values.length === 0 || values.every(item => isRecordViewValueEmpty(item))
  }
  return false
}

function normalizeComparableValue(value: unknown): unknown {
  const displayValue = getAimdDisplayValue(value)
  if (Array.isArray(displayValue)) {
    return displayValue.map(normalizeComparableValue)
  }
  if (isAimdPlainRecord(displayValue)) {
    return Object.fromEntries(
      Object.entries(displayValue)
        .filter(([key]) => !key.startsWith('__'))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeComparableValue(item)]),
    )
  }
  return displayValue
}

export function getAimdRecordViewCompareKey(value: unknown): string {
  if (isRecordViewValueEmpty(value)) {
    return '__aimd_empty__'
  }
  const normalized = normalizeComparableValue(value)
  try {
    return JSON.stringify(normalized)
  }
  catch {
    return String(normalized)
  }
}

export function getAimdRecordViewCell(
  recordData: unknown,
  field: AimdRecordViewColumn,
): AimdRecordViewCell {
  const value = getAimdRecordFieldValue(recordData, field)
  const displayValue = getAimdDisplayValue(value)
  const cell: AimdRecordViewCell = {
    field,
    value,
    text: stringifyAimdRecordSearchValue(value),
    empty: isRecordViewValueEmpty(value),
    compareKey: getAimdRecordViewCompareKey(value),
  }

  if (Array.isArray(displayValue)) {
    cell.count = displayValue.length
  }

  if ((field.valueKind === 'step' || field.valueKind === 'check') && isAimdPlainRecord(displayValue)) {
    if (typeof displayValue.checked === 'boolean') {
      cell.checked = displayValue.checked
    }
    if (typeof displayValue.annotation === 'string' && displayValue.annotation.trim()) {
      cell.annotation = displayValue.annotation.trim()
    }
  }

  return cell
}
