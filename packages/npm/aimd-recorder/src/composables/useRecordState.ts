/**
 * Record-state normalisation and field-default helpers.
 *
 * Extracted from AimdRecorder.vue so the logic can be reused
 * by both the recorder and the host-app rendering pipeline.
 */

import type { AimdQuizField, AimdVarTableField } from "@airalogy/aimd-core/types"
import type {
  AimdCheckRecordItem,
  AimdProtocolRecordData,
  AimdStepRecordItem,
} from "../types"
import { createEmptyProtocolRecordData } from "../types"
import {
  createEmptyCheckRecordItem,
  createEmptyStepRecordItem,
  normalizeStepTimerState,
} from "./useStepTimers"

// ---------------------------------------------------------------------------
// Deep clone
// ---------------------------------------------------------------------------

export function cloneRecordData(value: AimdProtocolRecordData): AimdProtocolRecordData {
  return JSON.parse(JSON.stringify(value))
}

function stableSerialize(value: unknown): string {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => stableSerialize(item)).join(",")}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))

  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(",")}}`
}

export function getRecordDataSignature(value: Partial<AimdProtocolRecordData> | undefined): string {
  return stableSerialize(normalizeIncomingRecord(value))
}

// ---------------------------------------------------------------------------
// Step / check normalisation
// ---------------------------------------------------------------------------

export function normalizeCheckLike(value: unknown): AimdCheckRecordItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyCheckRecordItem()
  }

  const obj = value as Record<string, unknown>
  return {
    checked: Boolean(obj.checked),
    annotation: typeof obj.annotation === "string" ? obj.annotation : "",
  }
}

export function normalizeStepLike(value: unknown): AimdStepRecordItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyStepRecordItem()
  }

  const obj = value as Record<string, unknown>
  return {
    checked: Boolean(obj.checked),
    annotation: typeof obj.annotation === "string" ? obj.annotation : "",
    ...normalizeStepTimerState(obj),
  }
}

// ---------------------------------------------------------------------------
// Incoming record normalisation
// ---------------------------------------------------------------------------

export function normalizeIncomingRecord(value: Partial<AimdProtocolRecordData> | undefined): AimdProtocolRecordData {
  const normalized = createEmptyProtocolRecordData()
  if (!value || typeof value !== "object") {
    return normalized
  }

  if (value.var && typeof value.var === "object") {
    normalized.var = { ...value.var }
  }
  if (value.quiz && typeof value.quiz === "object") {
    normalized.quiz = { ...value.quiz }
  }
  if (value.step && typeof value.step === "object") {
    for (const [key, item] of Object.entries(value.step)) {
      normalized.step[key] = normalizeStepLike(item)
    }
  }
  if (value.check && typeof value.check === "object") {
    for (const [key, item] of Object.entries(value.check)) {
      normalized.check[key] = normalizeCheckLike(item)
    }
  }

  return normalized
}

// ---------------------------------------------------------------------------
// Section replacement (reactive-safe)
// ---------------------------------------------------------------------------

export function replaceSection(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const key of Object.keys(target)) {
    delete target[key]
  }
  Object.assign(target, source)
}

export function applyNormalizedRecord(localRecord: AimdProtocolRecordData, normalized: AimdProtocolRecordData) {
  replaceSection(localRecord.var as Record<string, unknown>, normalized.var)
  replaceSection(localRecord.step as Record<string, unknown>, normalized.step as Record<string, unknown>)
  replaceSection(localRecord.check as Record<string, unknown>, normalized.check as Record<string, unknown>)
  replaceSection(localRecord.quiz as Record<string, unknown>, normalized.quiz)
}

export function applyIncomingRecord(localRecord: AimdProtocolRecordData, value: Partial<AimdProtocolRecordData> | undefined) {
  applyNormalizedRecord(localRecord, normalizeIncomingRecord(value))
}

// ---------------------------------------------------------------------------
// Field normalisation helpers
// ---------------------------------------------------------------------------

export function normalizeStepFields(raw: unknown): Array<{ name: string }> {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw
    .map((item) => {
      if (typeof item === "string" && item.trim()) {
        return { name: item.trim() }
      }
      if (item && typeof item === "object" && typeof (item as any).name === "string") {
        return { name: (item as any).name as string }
      }
      return null
    })
    .filter((item): item is { name: string } => item !== null)
}

export function normalizeCheckFields(raw: unknown): Array<{ name: string, label?: string }> {
  if (!Array.isArray(raw)) {
    return []
  }

  const normalized: Array<{ name: string, label?: string }> = []
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      const label = item.trim()
      normalized.push({ name: label, label })
      continue
    }

    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>
      if (typeof obj.name === "string") {
        normalized.push({
          name: obj.name,
          label: typeof obj.label === "string" ? obj.label : undefined,
        })
      }
    }
  }

  return normalized
}

export function normalizeQuizFields(raw: unknown): AimdQuizField[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.filter((item): item is AimdQuizField => (
    !!item
    && typeof item === "object"
    && typeof (item as any).id === "string"
    && typeof (item as any).type === "string"
    && typeof (item as any).stem === "string"
  ))
}

export function normalizeVarTableFields(raw: unknown): AimdVarTableField[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.filter((item): item is AimdVarTableField => (
    !!item
    && typeof item === "object"
    && typeof (item as any).id === "string"
    && Array.isArray((item as any).subvars)
  ))
}

// ---------------------------------------------------------------------------
// Quiz default values
// ---------------------------------------------------------------------------

type OptionFollowupPrimitive = string | number | boolean

function quizHasOptionFollowups(quiz: AimdQuizField): boolean {
  return (quiz.type === "choice" || quiz.type === "true_false")
    && Array.isArray(quiz.options)
    && quiz.options.some(option => Array.isArray(option.followups) && option.followups.length > 0)
}

function buildOptionFollowupDefaultMap(
  quiz: AimdQuizField,
  selectedKeys: string[],
): Record<string, Record<string, OptionFollowupPrimitive>> {
  const selectedKeySet = new Set(selectedKeys)
  const followups: Record<string, Record<string, OptionFollowupPrimitive>> = {}

  for (const option of quiz.options || []) {
    if (!selectedKeySet.has(option.key) || !Array.isArray(option.followups)) {
      continue
    }

    const fieldDefaults: Record<string, OptionFollowupPrimitive> = {}
    for (const followup of option.followups) {
      if (followup.default !== undefined) {
        fieldDefaults[followup.key] = followup.default
      }
    }
    if (Object.keys(fieldDefaults).length > 0) {
      followups[option.key] = fieldDefaults
    }
  }

  return followups
}

export function getQuizDefaultValue(quiz: AimdQuizField): unknown {
  if (quiz.type === "choice") {
    const optionKeys = new Set((quiz.options || []).map(option => option.key))
    const hasFollowups = quizHasOptionFollowups(quiz)
    if (quiz.mode === "multiple") {
      let selected: string[] = []
      if (Array.isArray(quiz.default)) {
        selected = quiz.default.filter((item): item is string => typeof item === "string" && optionKeys.has(item))
      }
      if (hasFollowups) {
        return {
          selected,
          followups: buildOptionFollowupDefaultMap(quiz, selected),
        }
      }
      return selected
    }

    let selected = ""
    if (typeof quiz.default === "string" && optionKeys.has(quiz.default)) {
      selected = quiz.default
    }
    if (hasFollowups) {
      return {
        selected,
        followups: buildOptionFollowupDefaultMap(quiz, selected ? [selected] : []),
      }
    }
    return selected
  }

  if (quiz.type === "true_false") {
    const selected = typeof quiz.default === "boolean" ? quiz.default : null
    if (selected !== null && quizHasOptionFollowups(quiz)) {
      return {
        selected,
        followups: buildOptionFollowupDefaultMap(quiz, [String(selected)]),
      }
    }
    return selected
  }

  if (quiz.type === "blank") {
    const blankKeys = (quiz.blanks || []).map(blank => blank.key)
    if (quiz.default && typeof quiz.default === "object" && !Array.isArray(quiz.default)) {
      const objDefault = quiz.default as Record<string, unknown>
      const normalized: Record<string, string> = {}
      for (const key of blankKeys) {
        const value = objDefault[key]
        normalized[key] = typeof value === "string" ? value : ""
      }
      return normalized
    }

    if (typeof quiz.default === "string" && blankKeys.length === 1) {
      return { [blankKeys[0]]: quiz.default }
    }

    const blankValueMap: Record<string, string> = {}
    for (const key of blankKeys) {
      blankValueMap[key] = ""
    }
    return blankValueMap
  }

  if (quiz.type === "scale") {
    const itemKeys = (quiz.items || []).map(item => item.key)
    const optionKeys = new Set((quiz.options || []).map(option => option.key))
    const defaultMap: Record<string, string> = {}
    const rawDefault = quiz.default && typeof quiz.default === "object" && !Array.isArray(quiz.default)
      ? quiz.default as Record<string, unknown>
      : {}

    for (const key of itemKeys) {
      const value = rawDefault[key]
      defaultMap[key] = typeof value === "string" && optionKeys.has(value) ? value : ""
    }

    return defaultMap
  }

  if (typeof quiz.default === "string") {
    return quiz.default
  }
  return ""
}

// ---------------------------------------------------------------------------
// Var-table row helpers
// ---------------------------------------------------------------------------

export function createEmptyVarTableRow(columns: string[]): Record<string, string> {
  const row: Record<string, string> = {}
  for (const column of columns) {
    row[column] = ""
  }
  return row
}

export function normalizeVarTableRows(raw: unknown, columns: string[]): Record<string, string>[] {
  if (!Array.isArray(raw)) {
    return [createEmptyVarTableRow(columns)]
  }

  const rows = raw.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return createEmptyVarTableRow(columns)
    }
    const source = item as Record<string, unknown>
    const row: Record<string, string> = {}
    for (const column of columns) {
      const value = source[column]
      row[column] = typeof value === "string" ? value : `${value ?? ""}`
    }
    return row
  })

  if (rows.length === 0) {
    rows.push(createEmptyVarTableRow(columns))
  }

  return rows
}

function isPlaceholderVarTableRows(rows: Record<string, string>[], columns: string[]): boolean {
  if (rows.length !== 1) {
    return false
  }

  return columns.every(column => rows[0]?.[column] === "")
}

export interface VarTablePastedCell {
  rowIndex: number
  column: string
  value: string
}

export interface ApplyVarTablePasteResult {
  rowsAdded: number
  changedCells: VarTablePastedCell[]
}

export function parsePastedVarTableText(text: string): string[][] {
  if (text === "") {
    return []
  }

  const normalized = text.replace(/\r\n?/g, "\n")
  const lines = normalized.split("\n")
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop()
  }

  return lines.map(line => line.split("\t"))
}

export function applyPastedVarTableGrid(
  rows: Record<string, string>[],
  columns: string[],
  startRowIndex: number,
  startColumnIndex: number,
  pastedGrid: string[][],
  options?: { disabledColumns?: string[] },
): ApplyVarTablePasteResult {
  const changedCells: VarTablePastedCell[] = []
  if (
    columns.length === 0
    || pastedGrid.length === 0
    || startRowIndex < 0
    || startColumnIndex < 0
  ) {
    return { rowsAdded: 0, changedCells }
  }

  const disabledColumns = new Set(options?.disabledColumns ?? [])
  let rowsAdded = 0

  for (const [rowOffset, pastedRow] of pastedGrid.entries()) {
    const targetRowIndex = startRowIndex + rowOffset
    const writableCells = pastedRow
      .map((value, columnOffset) => ({
        value,
        columnIndex: startColumnIndex + columnOffset,
      }))
      .filter(({ columnIndex }) => columnIndex >= 0 && columnIndex < columns.length)
      .map(({ value, columnIndex }) => ({
        value,
        column: columns[columnIndex],
      }))
      .filter(({ column }) => !disabledColumns.has(column))

    if (writableCells.length === 0) {
      continue
    }

    while (targetRowIndex >= rows.length) {
      rows.push(createEmptyVarTableRow(columns))
      rowsAdded += 1
    }

    const targetRow = rows[targetRowIndex]
    for (const { column, value } of writableCells) {
      if (targetRow[column] === value) {
        continue
      }
      targetRow[column] = value
      changedCells.push({ rowIndex: targetRowIndex, column, value })
    }
  }

  return { rowsAdded, changedCells }
}

// ---------------------------------------------------------------------------
// Ensure defaults from extracted fields
// ---------------------------------------------------------------------------

import type { ExtractedAimdFields } from "@airalogy/aimd-core/types"

export function ensureDefaultsFromFields(localRecord: AimdProtocolRecordData, fields: ExtractedAimdFields): boolean {
  let changed = false

  for (const vt of normalizeVarTableFields(fields.var_table)) {
    const columns = vt.subvars.map(subvar => subvar.id)
    const hasExistingRows = vt.id in localRecord.var
    const defaultRows = Array.isArray(vt.default) && vt.default.length > 0
      ? normalizeVarTableRows(vt.default, columns)
      : undefined
    const rows = hasExistingRows ? localRecord.var[vt.id] : (defaultRows ?? vt.default)
    const existingRows = normalizeVarTableRows(rows, columns)
    const shouldApplyDefaults = Boolean(
      hasExistingRows
      && defaultRows
      && isPlaceholderVarTableRows(existingRows, columns)
      && !isPlaceholderVarTableRows(defaultRows, columns),
    )
    const normalizedRows = shouldApplyDefaults && defaultRows ? defaultRows : existingRows
    if (!hasExistingRows || JSON.stringify(normalizedRows) !== JSON.stringify(rows)) {
      localRecord.var[vt.id] = normalizedRows
      changed = true
    }
  }

  for (const step of normalizeStepFields(fields.step)) {
    if (!(step.name in localRecord.step)) {
      localRecord.step[step.name] = createEmptyStepRecordItem()
      changed = true
    }
  }

  for (const check of normalizeCheckFields(fields.check)) {
    if (!(check.name in localRecord.check)) {
      localRecord.check[check.name] = createEmptyCheckRecordItem()
      changed = true
    }
  }

  for (const quiz of normalizeQuizFields(fields.quiz)) {
    if (!(quiz.id in localRecord.quiz)) {
      localRecord.quiz[quiz.id] = getQuizDefaultValue(quiz)
      changed = true
    }
  }

  return changed
}
