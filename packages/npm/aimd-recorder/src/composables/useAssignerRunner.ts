import type { ExtractedAimdFields } from "@airalogy/aimd-core/types"
import type {
  AimdAssignerDefinition,
  AimdAssignerMap,
  AimdAssignerMode,
  AimdProtocolRecordData,
  AimdRecorderFieldType,
} from "../types"
import {
  normalizeCheckLike,
  normalizeStepLike,
} from "./useRecordState"
import { getFileValueId, isAiralogyFileId } from "./useVarHelpers"

export interface AimdResolvedAssigner {
  assignedField: string
  fieldKey: string
  mode: string
  dependentFields: string[]
  assigner: AimdAssignerDefinition
}

type AssignableRecorderFieldType = Exclude<AimdRecorderFieldType, "quiz">

interface AssignerFieldNameSets {
  var?: ReadonlySet<string>
  varTable?: ReadonlySet<string>
  step?: ReadonlySet<string>
  check?: ReadonlySet<string>
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isEmptyObjectRecord(value: unknown): boolean {
  return isObjectRecord(value) && Object.keys(value).length === 0
}

function getStringProperty(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

function getNestedErrorMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }
  if (!isObjectRecord(value)) {
    return undefined
  }
  return getStringProperty(value, [
    "error_message",
    "errorMessage",
    "message",
    "detail",
    "reason",
  ])
}

function collectAssignerResultCandidates(result: unknown): unknown[] {
  const candidates: unknown[] = [result]
  const appendNested = (value: unknown) => {
    if (!isObjectRecord(value)) return
    candidates.push(value.data)
    candidates.push(value.result)
    if (isObjectRecord(value.data)) {
      candidates.push(value.data.result)
    }
    if (isObjectRecord(value.result)) {
      candidates.push(value.result.data)
    }
  }

  appendNested(result)
  if (isObjectRecord(result)) {
    appendNested(result.data)
    appendNested(result.result)
  }

  return candidates
}

function parsedFieldName(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (!isObjectRecord(value)) return ""

  const name = value.name ?? value.id
  return typeof name === "string" && name.trim() ? name.trim() : ""
}

function extractedFieldNameSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set<string>()
  return new Set(value.map(parsedFieldName).filter(Boolean))
}

export function getAimdAssignerDependentFields(assigner: unknown): string[] {
  if (!isObjectRecord(assigner)) return []
  const fields = assigner.dependent_fields
  if (!Array.isArray(fields)) return []
  return fields
    .map(field => (typeof field === "string" ? field.trim() : ""))
    .filter(Boolean)
}

export function getAimdAssignerMode(assigner: unknown): string {
  if (!isObjectRecord(assigner)) return "manual"
  const mode = assigner.mode
  return typeof mode === "string" && mode.trim() ? mode.trim() : "manual"
}

export function normalizeAimdAssignerMode(mode: string): AimdAssignerMode {
  if (
    mode === "auto"
    || mode === "auto_first"
    || mode === "auto_force"
    || mode === "manual"
    || mode === "manual_readonly"
    || mode === "auto_readonly"
  ) {
    return mode
  }
  return "manual"
}

export function isReadonlyAimdAssignerMode(mode: string): boolean {
  return mode === "auto_readonly" || mode === "manual_readonly"
}

export function getAimdAssignerFieldNameSets(fields?: Partial<ExtractedAimdFields> | null): AssignerFieldNameSets {
  return {
    var: extractedFieldNameSet(fields?.var),
    varTable: extractedFieldNameSet(fields?.var_table),
    step: extractedFieldNameSet(fields?.step),
    check: extractedFieldNameSet(fields?.check),
  }
}

export function getAimdAssignerFieldKey(
  assignedField: string,
  fieldNameSets: AssignerFieldNameSets = {},
): string {
  const normalized = assignedField.trim()
  if (normalized.includes(".")) {
    const [tableName, ...columnParts] = normalized.split(".")
    return `var_table:${tableName}:${columnParts.join(".")}`
  }

  if (fieldNameSets.varTable?.has(normalized)) return `var_table:${normalized}`
  if (fieldNameSets.step?.has(normalized)) return `step:${normalized}`
  if (fieldNameSets.check?.has(normalized)) return `check:${normalized}`
  return `var:${normalized}`
}

export function resolveAimdAssigners(
  assigners: AimdAssignerMap | undefined,
  fields?: Partial<ExtractedAimdFields> | null,
): AimdResolvedAssigner[] {
  if (!assigners || typeof assigners !== "object" || Array.isArray(assigners)) {
    return []
  }

  const fieldNameSets = getAimdAssignerFieldNameSets(fields)
  return Object.entries(assigners)
    .map(([assignedField, assigner]) => {
      const normalizedAssignedField = assignedField.trim()
      if (!normalizedAssignedField) return null
      const definition = isObjectRecord(assigner) ? assigner : {}
      const mode = getAimdAssignerMode(definition)
      return {
        assignedField: normalizedAssignedField,
        fieldKey: getAimdAssignerFieldKey(normalizedAssignedField, fieldNameSets),
        mode,
        dependentFields: getAimdAssignerDependentFields(definition),
        assigner: definition,
      } satisfies AimdResolvedAssigner
    })
    .filter((entry): entry is AimdResolvedAssigner => entry !== null)
}

export function normalizeAimdAssignerDependentValue(value: unknown): unknown {
  if (value === "") return undefined

  if (Array.isArray(value)) {
    const normalizedItems = value
      .map(item => normalizeAimdAssignerDependentValue(item))
      .filter(item => item !== undefined && !isEmptyObjectRecord(item))
    return normalizedItems
  }

  if (isObjectRecord(value)) {
    const fileId = getFileValueId(value)
    if (isAiralogyFileId(fileId)) {
      return fileId
    }

    const normalizedObject = Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, normalizeAimdAssignerDependentValue(item)] as const)
        .filter(([, item]) => item !== undefined),
    )
    return normalizedObject
  }

  return value
}

export function normalizeAimdAssignerDependentData(value: unknown): Record<string, unknown> {
  const normalized = normalizeAimdAssignerDependentValue(value)
  return isObjectRecord(normalized) ? normalized : {}
}

function readRecordFieldValue(record: AimdProtocolRecordData, field: string): unknown {
  if (Object.prototype.hasOwnProperty.call(record.var, field)) return record.var[field]
  if (Object.prototype.hasOwnProperty.call(record.step, field)) return record.step[field]
  if (Object.prototype.hasOwnProperty.call(record.check, field)) return record.check[field]
  if (Object.prototype.hasOwnProperty.call(record.quiz, field)) return record.quiz[field]

  if (field.includes(".")) {
    const [tableName, ...columnParts] = field.split(".")
    const columnName = columnParts.join(".")
    const tableValue = record.var[tableName]
    if (Array.isArray(tableValue) && columnName) {
      return tableValue.map((row) => (isObjectRecord(row) ? row[columnName] : undefined))
    }
  }

  return undefined
}

export function buildAimdAssignerDependentData(
  record: AimdProtocolRecordData,
  assigner: Pick<AimdResolvedAssigner, "dependentFields"> | AimdAssignerDefinition | unknown,
): Record<string, unknown> {
  const dependentFields = Array.isArray((assigner as { dependentFields?: unknown } | null)?.dependentFields)
    ? (assigner as { dependentFields: string[] }).dependentFields
    : getAimdAssignerDependentFields(assigner)

  if (dependentFields.length === 0) {
    return normalizeAimdAssignerDependentData(record.var)
  }

  return Object.fromEntries(
    dependentFields
      .map((field) => [field, normalizeAimdAssignerDependentValue(readRecordFieldValue(record, field))] as const)
      .filter(([, value]) => value !== undefined),
  )
}

export function extractAimdAssignedFields(result: unknown): Record<string, unknown> {
  const candidates = collectAssignerResultCandidates(result)

  for (const candidate of candidates) {
    if (!isObjectRecord(candidate)) continue
    const snakeCase = candidate.assigned_fields
    if (isObjectRecord(snakeCase)) return snakeCase
    const camelCase = candidate.assignedFields
    if (isObjectRecord(camelCase)) return camelCase
  }

  return {}
}

export function extractAimdAssignerErrorMessage(result: unknown): string | undefined {
  const candidates = collectAssignerResultCandidates(result)

  for (const candidate of candidates) {
    if (!isObjectRecord(candidate)) continue

    const success = candidate.success
    const status = candidate.status
    const failed = success === false
      || success === "false"
      || status === "error"
      || status === "failed"

    if (!failed) {
      continue
    }

    return getStringProperty(candidate, [
      "error_message",
      "errorMessage",
      "message",
      "detail",
      "reason",
      "output",
    ])
      ?? getNestedErrorMessage(candidate.error)
      ?? getNestedErrorMessage(candidate.exception)
      ?? "Assigner failed"
  }

  return undefined
}

export function applyAimdAssignedFieldsToRecord(
  record: AimdProtocolRecordData,
  assignedFields: Record<string, unknown>,
): boolean {
  let changed = false

  for (const [field, value] of Object.entries(assignedFields)) {
    const normalizedField = field.trim()
    if (!normalizedField) continue

    if (normalizedField.includes(".")) {
      const [tableName, ...columnParts] = normalizedField.split(".")
      const columnName = columnParts.join(".")
      const tableValue = record.var[tableName]
      if (Array.isArray(tableValue) && columnName) {
        if (Array.isArray(value)) {
          tableValue.forEach((row, index) => {
            if (isObjectRecord(row) && index < value.length) {
              row[columnName] = value[index]
            }
          })
        } else {
          tableValue.forEach((row) => {
            if (isObjectRecord(row)) {
              row[columnName] = value
            }
          })
        }
        changed = true
        continue
      }
    }

    if (Object.prototype.hasOwnProperty.call(record.step, normalizedField)) {
      record.step[normalizedField] = normalizeStepLike(value)
      changed = true
      continue
    }

    if (Object.prototype.hasOwnProperty.call(record.check, normalizedField)) {
      record.check[normalizedField] = normalizeCheckLike(value)
      changed = true
      continue
    }

    record.var[normalizedField] = value
    changed = true
  }

  return changed
}

export function getAimdAssignerPayloadFieldKey(
  fieldType: AssignableRecorderFieldType,
  fieldKey: string,
): string {
  const prefix = `${fieldType}:`
  return fieldKey.startsWith(prefix) ? fieldKey.slice(prefix.length) : fieldKey
}
