/**
 * Pure helper functions for AIMD var field rendering.
 *
 * Extracted from AimdRecorder.vue to enable reuse across
 * the recorder and the host-app rendering pipeline.
 */

import { resolveAimdTypePlugin } from '../type-plugins'
import { isAimdCodeEditorType } from '../code-types'
import {
  getAimdFileDisplayName,
  getAimdFileInputConfig,
  getAimdFileValueId,
  isAimdAiralogyFileId,
  isAimdFileLikeType,
  isKnownAimdFileTypeName,
  normalizeAimdTypeName,
  toAimdBooleanValue,
  unwrapAimdStructuredValue,
  type AimdAssetKind,
  type AimdFileInputConfig,
} from '@airalogy/aimd-core/utils'
import type {
  AimdFieldMeta,
  AimdSelectedFileValue,
  AimdTypePlugin,
  AimdTypePluginParseContext,
  AimdTypePluginValueContext,
  AimdVarInputKind,
} from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VarInputKind = AimdVarInputKind

export interface VarInputKindOptions {
  inputType?: string
  codeLanguage?: string
  kwargs?: Record<string, unknown>
  fieldMeta?: AimdFieldMeta
  typePlugin?: AimdTypePlugin
  typePlugins?: AimdTypePlugin[]
}

export interface VarInputValueOptions extends VarInputKindOptions {
  type?: string
  nodeFieldKey?: string
}

export type AimdVarEnumOption = NonNullable<AimdFieldMeta["enumOptions"]>[number]

export interface AimdNumericFieldConstraints {
  gt?: number
  ge?: number
  lt?: number
  le?: number
  multiple_of?: number
}

export interface NumericInputAttributes {
  min?: number
  max?: number
  step?: number
}

export type FileInputDisplayKind = AimdAssetKind
export type FileInputConfig = AimdFileInputConfig
export type ScalarListItemType = "string" | "int" | "float"
export type ScalarListInputItem = string | number

export function getFileInputConfig(
  type: string | undefined,
  kwargs?: Record<string, unknown>,
  fieldMeta?: AimdFieldMeta,
): FileInputConfig {
  return getAimdFileInputConfig(type, kwargs, fieldMeta)
}

export function isFileLikeVarType(
  type: string | undefined,
  kwargs?: Record<string, unknown>,
  fieldMeta?: AimdFieldMeta,
): boolean {
  return isAimdFileLikeType(type, kwargs, fieldMeta)
}

export function createSelectedFileValue(file: File): AimdSelectedFileValue {
  return {
    format: "airalogy_selected_file_v1",
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
  }
}

export function isAiralogyFileId(value: unknown): value is string {
  return isAimdAiralogyFileId(value)
}

export function getFileValueId(value: unknown): string | undefined {
  return getAimdFileValueId(value)
}

export function getFileDisplayName(value: unknown): string {
  return getAimdFileDisplayName(value, undefined, {
    hideAiralogyFileIds: true,
    keys: [
      "name",
      "fileName",
      "file_name",
      "filename",
      "originalName",
      "original_name",
      "id",
      "file_id",
      "src",
      "url",
    ],
  })
}

export function getVarEnumSelectValue(options: AimdVarEnumOption[], value: unknown): string {
  const normalized = unwrapStructuredValue(value)
  const exactIndex = options.findIndex(option => Object.is(option.value, normalized))
  if (exactIndex >= 0) {
    return String(exactIndex)
  }

  if (normalized !== undefined && normalized !== null) {
    const stringIndex = options.findIndex(option => String(option.value) === String(normalized))
    if (stringIndex >= 0) {
      return String(stringIndex)
    }
  }

  return ""
}

export function getVarEnumValueFromSelectValue(
  options: AimdVarEnumOption[],
  selectValue: string,
  emptyValue: unknown = "",
): unknown {
  const index = Number.parseInt(selectValue, 10)
  return Number.isInteger(index) && index >= 0 && index < options.length
    ? options[index].value
    : emptyValue
}

function resolveOverrideInputKind(inputType: string | undefined, codeLanguage: string | undefined): VarInputKind | undefined {
  if (isAimdCodeEditorType(undefined, { inputType, codeLanguage })) {
    return 'code'
  }

  const normalized = normalizeAimdTypeName(inputType)

  if (!normalized) {
    return undefined
  }

  if (normalized === 'float' || normalized === 'int' || normalized === 'integer' || normalized === 'number') {
    return 'number'
  }

  if (normalized === 'bool' || normalized === 'boolean' || normalized === 'checkbox') {
    return 'checkbox'
  }

  if (normalized === 'date') {
    return 'date'
  }

  if (normalized === 'datetime') {
    return 'datetime'
  }

  if (normalized === 'time') {
    return 'time'
  }

  if (normalized === 'markdown' || normalized === 'textarea' || normalized === 'md') {
    return 'textarea'
  }

  if (normalized === 'scalarlist' || normalized === 'stringlist' || normalized === 'strlist') {
    return 'scalar-list'
  }

  if (normalized === 'dna') {
    return 'dna'
  }

  if (isKnownAimdFileTypeName(normalized)) {
    return 'file'
  }

  if (normalized === 'text' || normalized === 'string') {
    return 'text'
  }

  return undefined
}

// ---------------------------------------------------------------------------
// Type normalisation & input-kind resolution
// ---------------------------------------------------------------------------

export function normalizeVarTypeName(type: string | undefined): string {
  return normalizeAimdTypeName(type)
}

function splitTopLevelTypeUnion(annotation: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: string | null = null
  let current = ""

  for (let index = 0; index < annotation.length; index += 1) {
    const char = annotation[index]
    const previous = annotation[index - 1]

    if (quote) {
      current += char
      if (char === quote && previous !== "\\") {
        quote = null
      }
      continue
    }

    if (char === "\"" || char === "'") {
      quote = char
      current += char
      continue
    }

    if (char === "[" || char === "(" || char === "{") {
      depth += 1
      current += char
      continue
    }

    if (char === "]" || char === ")" || char === "}") {
      depth = Math.max(0, depth - 1)
      current += char
      continue
    }

    if (char === "|" && depth === 0) {
      parts.push(current.trim())
      current = ""
      continue
    }

    current += char
  }

  if (current.trim()) {
    parts.push(current.trim())
  }

  return parts.length > 0 ? parts : [annotation.trim()]
}

function canonicalizeTypeExpression(type: string | undefined): string {
  return typeof type === "string" ? type.trim().replace(/\s+/g, "").toLowerCase() : ""
}

function unwrapOptionalTypeAnnotation(type: string | undefined): string {
  let raw = typeof type === "string" ? type.trim() : ""

  for (let index = 0; index < 4; index += 1) {
    const compact = canonicalizeTypeExpression(raw)
    const optionalMatch = compact.match(/^(?:typing\.)?optional\[(.*)\]$/)
    if (optionalMatch) {
      raw = optionalMatch[1]
      continue
    }

    const unionParts = splitTopLevelTypeUnion(raw)
    if (unionParts.length > 1) {
      const valueParts = unionParts.filter(part => {
        const normalized = canonicalizeTypeExpression(part)
        return normalized !== "none" && normalized !== "null" && normalized !== "undefined"
      })
      if (valueParts.length === 1) {
        raw = valueParts[0]
        continue
      }
    }

    break
  }

  return raw
}

export function isNullableVarType(type: string | undefined): boolean {
  const raw = typeof type === "string" ? type.trim() : ""
  if (!raw) {
    return false
  }

  const compact = canonicalizeTypeExpression(raw)
  if (/^(?:typing\.)?optional\[.*\]$/.test(compact)) {
    return true
  }

  const unionParts = splitTopLevelTypeUnion(raw)
  return unionParts.length > 1 && unionParts.some(part => {
    const normalized = canonicalizeTypeExpression(part)
    return normalized === "none" || normalized === "null" || normalized === "undefined"
  })
}

export function isNumericVarType(type: string | undefined): boolean {
  const normalized = normalizeVarTypeName(unwrapOptionalTypeAnnotation(type))
  return normalized === "float" || normalized === "int" || normalized === "integer" || normalized === "number"
}

function getScalarListItemTypeFromExpression(type: string | undefined): ScalarListItemType | undefined {
  const normalized = canonicalizeTypeExpression(type).replace(/^typing\./, "")
  if (normalized === "str" || normalized === "string" || normalized === "builtins.str") {
    return "string"
  }
  if (normalized === "int" || normalized === "integer" || normalized === "builtins.int") {
    return "int"
  }
  if (normalized === "float" || normalized === "number" || normalized === "builtins.float") {
    return "float"
  }
  return undefined
}

export function getScalarListItemType(type: string | undefined): ScalarListItemType | undefined {
  const compact = canonicalizeTypeExpression(unwrapOptionalTypeAnnotation(type)).replace(/^typing\./, "")

  if (compact.endsWith("[]")) {
    return getScalarListItemTypeFromExpression(compact.slice(0, -2))
  }

  const listMatch = compact.match(/^(?:list|array)\[(.*)\]$/)
  return listMatch ? getScalarListItemTypeFromExpression(listMatch[1]) : undefined
}

export function isScalarListVarType(type: string | undefined): boolean {
  return getScalarListItemType(type) !== undefined
}

export function isStructuredVarType(type: string | undefined): boolean {
  const unwrappedType = unwrapOptionalTypeAnnotation(type)
  const raw = canonicalizeTypeExpression(unwrappedType).replace(/^typing\./, "")
  const normalized = normalizeVarTypeName(unwrappedType)
  return normalized === "json"
    || normalized === "list"
    || raw.startsWith("list[")
    || normalized === "array"
    || raw.startsWith("array[")
    || normalized === "dict"
    || raw.startsWith("dict[")
    || normalized === "map"
    || raw.startsWith("map[")
    || normalized === "object"
    || normalized === "record"
}

export function getVarInputKind(type: string | undefined, options: VarInputKindOptions = {}): VarInputKind {
  const override = resolveOverrideInputKind(options.inputType, options.codeLanguage)
  if (override) {
    return override
  }

  const typePlugin = options.typePlugin ?? resolveAimdTypePlugin(type, options.typePlugins)
  if (typePlugin?.inputKind) {
    return typePlugin.inputKind
  }

  if (isScalarListVarType(type)) {
    return "scalar-list"
  }

  const unwrappedType = unwrapOptionalTypeAnnotation(type)
  const normalized = normalizeVarTypeName(unwrappedType)

  if (normalized === "float" || normalized === "int" || normalized === "integer" || normalized === "number") {
    return "number"
  }

  if (normalized === "bool" || normalized === "boolean" || normalized === "checkbox") {
    return isNullableVarType(type) ? "boolean-select" : "checkbox"
  }

  if (normalized === "date") {
    return "date"
  }

  if (normalized === "datetime" || normalized === "currenttime") {
    return "datetime"
  }

  if (normalized === "time" || normalized === "duration") {
    return "time"
  }

  if (normalized === "dnasequence") {
    return "dna"
  }

  if (normalized === "md" || normalized === "markdown" || normalized === "airalogymarkdown") {
    return "textarea"
  }

  if (isStructuredVarType(type)) {
    return "textarea"
  }

  if (isFileLikeVarType(unwrappedType, options.kwargs, options.fieldMeta)) {
    return "file"
  }

  if (isAimdCodeEditorType(unwrappedType, { codeLanguage: options.codeLanguage })) {
    return 'code'
  }

  return "text"
}

function stringifyStructuredInputValue(value: unknown): string {
  if (typeof value === "string") {
    return value
  }
  if (value === null || typeof value === "undefined") {
    return ""
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function normalizeScalarListNumberItem(text: string, itemType: ScalarListItemType): ScalarListInputItem {
  const parsed = Number(text)
  if (!Number.isFinite(parsed)) {
    return text
  }
  if (itemType === "int" && !Number.isInteger(parsed)) {
    return text
  }
  return parsed
}

export function normalizeScalarListInputItems(
  items: unknown[],
  itemType: ScalarListItemType = "string",
): ScalarListInputItem[] {
  return items
    .map(item => item === null || typeof item === "undefined" ? "" : String(item).trim())
    .filter(item => item.length > 0)
    .map(item => itemType === "string" ? item : normalizeScalarListNumberItem(item, itemType))
}

export function getScalarListInputItems(value: unknown): string[] {
  const normalized = unwrapStructuredValue(value)

  if (Array.isArray(normalized)) {
    return normalized.map(item => item === null || typeof item === "undefined" ? "" : String(item))
  }

  if (typeof normalized === "string") {
    const text = normalized.trim()
    if (!text) {
      return []
    }
    if (text.startsWith("[")) {
      try {
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed)) {
          return parsed.map(item => item === null || typeof item === "undefined" ? "" : String(item))
        }
      } catch {
        // Fall through to plain text handling.
      }
    }
    return text.includes("\n")
      ? text.split(/\r?\n/)
      : [normalized]
  }

  if (normalized === null || typeof normalized === "undefined") {
    return []
  }

  return [String(normalized)]
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export function getNumericFieldConstraints(
  type: string | undefined,
  kwargs?: Record<string, unknown>,
): AimdNumericFieldConstraints {
  if (!isNumericVarType(type) || !kwargs) {
    return {}
  }

  const constraints: AimdNumericFieldConstraints = {}
  const gt = toFiniteNumber(kwargs.gt)
  const ge = toFiniteNumber(kwargs.ge)
  const lt = toFiniteNumber(kwargs.lt)
  const le = toFiniteNumber(kwargs.le)
  const multipleOf = toFiniteNumber(kwargs.multiple_of)

  if (gt !== undefined) constraints.gt = gt
  if (ge !== undefined) constraints.ge = ge
  if (lt !== undefined) constraints.lt = lt
  if (le !== undefined) constraints.le = le
  if (multipleOf !== undefined && multipleOf > 0) constraints.multiple_of = multipleOf

  return constraints
}

export function getNumericInputAttributes(
  type: string | undefined,
  kwargs?: Record<string, unknown>,
): NumericInputAttributes {
  const constraints = getNumericFieldConstraints(type, kwargs)
  const lowerBounds = [constraints.gt, constraints.ge].filter((value): value is number => value !== undefined)
  const upperBounds = [constraints.lt, constraints.le].filter((value): value is number => value !== undefined)

  return {
    min: lowerBounds.length ? Math.max(...lowerBounds) : undefined,
    max: upperBounds.length ? Math.min(...upperBounds) : undefined,
    step: constraints.multiple_of,
  }
}

export function getNumericConstraintViolation(
  value: unknown,
  type: string | undefined,
  kwargs?: Record<string, unknown>,
): string | null {
  const constraints = getNumericFieldConstraints(type, kwargs)
  if (Object.keys(constraints).length === 0) {
    return null
  }

  if (value === null || typeof value === "undefined") {
    return null
  }
  if (typeof value === "string" && value.trim() === "") {
    return null
  }

  const numericValue = toFiniteNumber(value)
  if (numericValue === undefined) {
    return null
  }

  if (constraints.gt !== undefined && !(numericValue > constraints.gt)) {
    return `Must be > ${constraints.gt}`
  }
  if (constraints.ge !== undefined && !(numericValue >= constraints.ge)) {
    return `Must be >= ${constraints.ge}`
  }
  if (constraints.lt !== undefined && !(numericValue < constraints.lt)) {
    return `Must be < ${constraints.lt}`
  }
  if (constraints.le !== undefined && !(numericValue <= constraints.le)) {
    return `Must be <= ${constraints.le}`
  }
  if (constraints.multiple_of !== undefined) {
    const quotient = numericValue / constraints.multiple_of
    if (Math.abs(quotient - Math.round(quotient)) > 1e-9) {
      return `Must be a multiple of ${constraints.multiple_of}`
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Structured-value helpers
// ---------------------------------------------------------------------------

export function unwrapStructuredValue(value: unknown): unknown {
  return unwrapAimdStructuredValue(value)
}

export function toBooleanValue(value: unknown): boolean {
  return toAimdBooleanValue(value)
}

export function toDateValue(value: unknown): Date | null {
  const normalized = unwrapStructuredValue(value)

  if (normalized instanceof Date) {
    return Number.isNaN(normalized.getTime()) ? null : normalized
  }

  if (typeof normalized === "number") {
    const date = new Date(normalized)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof normalized === "string" && normalized.trim()) {
    const text = normalized.trim().replace(/\s+/, "T")
    const date = new Date(text)
    return Number.isNaN(date.getTime()) ? null : date
  }

  return null
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

function formatTimezoneOffset(date: Date): string {
  const totalMinutes = -date.getTimezoneOffset()
  const sign = totalMinutes >= 0 ? "+" : "-"
  const absMinutes = Math.abs(totalMinutes)
  const hours = Math.floor(absMinutes / 60)
  const minutes = absMinutes % 60
  return `${sign}${pad2(hours)}:${pad2(minutes)}`
}

export function formatDateTimeWithTimezone(date: Date): string {
  const year = date.getFullYear()
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  const hour = pad2(date.getHours())
  const minute = pad2(date.getMinutes())
  return `${year}-${month}-${day}T${hour}:${minute}${formatTimezoneOffset(date)}`
}

export function normalizeDateTimeValueWithTimezone(value: unknown): unknown {
  const normalized = unwrapStructuredValue(value)

  if (typeof normalized === "string") {
    const text = normalized.trim()
    if (!text) {
      return ""
    }

    const normalizedText = text.replace(" ", "T")
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(normalizedText)) {
      return normalizedText
    }

    const parsed = new Date(normalizedText)
    return Number.isNaN(parsed.getTime()) ? value : formatDateTimeWithTimezone(parsed)
  }

  if (normalized === null || typeof normalized === "undefined") {
    return ""
  }

  const parsed = toDateValue(normalized)
  return parsed ? formatDateTimeWithTimezone(parsed) : value
}

export function formatDateForInput(value: unknown, kind: "date" | "datetime" | "time"): string {
  const normalized = unwrapStructuredValue(value)

  if (typeof normalized === "string" && normalized.trim()) {
    const text = normalized.trim()

    if (kind === "date" && /^\d{4}-\d{2}-\d{2}/.test(text)) {
      return text.slice(0, 10)
    }

    if (kind === "datetime") {
      const normalizedText = text.replace(" ", "T")
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalizedText)) {
        return normalizedText.slice(0, 16)
      }
    }

    if (kind === "time" && /^\d{2}:\d{2}/.test(text)) {
      return text.slice(0, 8)
    }
  }

  const date = toDateValue(normalized)
  if (!date) {
    return ""
  }

  const year = date.getFullYear()
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  const hour = pad2(date.getHours())
  const minute = pad2(date.getMinutes())
  const second = pad2(date.getSeconds())

  if (kind === "date") {
    return `${year}-${month}-${day}`
  }
  if (kind === "time") {
    return `${hour}:${minute}:${second}`
  }
  return `${year}-${month}-${day}T${hour}:${minute}`
}

// ---------------------------------------------------------------------------
// Display / parse values
// ---------------------------------------------------------------------------

export function getVarInputDisplayValue(
  value: unknown,
  kind: VarInputKind,
  options: VarInputValueOptions = {},
): string | number {
  const typePlugin = options.typePlugin
  if (typePlugin?.getDisplayValue) {
    const context: AimdTypePluginValueContext = {
      type: options.type || 'str',
      normalizedType: normalizeVarTypeName(options.type),
      fieldKey: options.nodeFieldKey ?? '',
      node: {} as never,
      value,
      inputKind: kind,
      fieldMeta: options.fieldMeta as never,
    }
    return typePlugin.getDisplayValue(context)
  }

  const normalized = unwrapStructuredValue(value)

  if (kind === "date" || kind === "datetime" || kind === "time") {
    return formatDateForInput(normalized, kind)
  }

  if (kind === "number") {
    return typeof normalized === "number" ? normalized : (typeof normalized === "string" ? normalized : "")
  }

  if (kind === "boolean-select") {
    if (typeof normalized === "boolean") {
      return normalized ? "true" : "false"
    }
    if (typeof normalized === "string") {
      const text = normalized.trim().toLowerCase()
      if (["true", "1", "yes", "on"].includes(text)) {
        return "true"
      }
      if (["false", "0", "no", "off"].includes(text)) {
        return "false"
      }
    }
    return ""
  }

  if (kind === "dna") {
    return typeof normalized === "string" ? normalized : JSON.stringify(normalized)
  }

  if (kind === "file") {
    return getFileDisplayName(normalized)
  }

  if (kind === "scalar-list") {
    return JSON.stringify(normalizeScalarListInputItems(
      getScalarListInputItems(normalized),
      getScalarListItemType(options.type) ?? "string",
    ))
  }

  if (isStructuredVarType(options.type)) {
    return stringifyStructuredInputValue(normalized)
  }

  if (typeof normalized === "string") {
    return normalized
  }

  if (normalized === null || typeof normalized === "undefined") {
    return ""
  }

  return String(normalized)
}

export function parseVarInputValue(
  rawValue: string,
  type: string | undefined,
  kind: VarInputKind,
  options: VarInputValueOptions = {},
): unknown {
  const typePlugin = options.typePlugin ?? resolveAimdTypePlugin(type, options.typePlugins)
  if (typePlugin?.parseInputValue) {
    const context: AimdTypePluginParseContext = {
      type: type || 'str',
      normalizedType: normalizeVarTypeName(type),
      fieldKey: options.nodeFieldKey ?? '',
      node: {} as never,
      rawValue,
      inputKind: kind,
      fieldMeta: options.fieldMeta as never,
    }
    return typePlugin.parseInputValue(context)
  }

  const nullableType = isNullableVarType(type)
  const normalizedType = normalizeVarTypeName(unwrapOptionalTypeAnnotation(type))

  if ((kind === "date" || kind === "datetime" || kind === "time") && nullableType && rawValue.trim() === "") {
    return null
  }

  if (kind === "datetime") {
    return normalizeDateTimeValueWithTimezone(rawValue)
  }

  if (kind === "number") {
    const text = rawValue.trim()
    if (!text) {
      return nullableType ? null : ""
    }
    const parsed = normalizedType === "int" || normalizedType === "integer"
      ? Number.parseInt(text, 10)
      : Number.parseFloat(text)
    return Number.isNaN(parsed) ? rawValue : parsed
  }

  if (kind === "scalar-list") {
    return normalizeScalarListInputItems(
      getScalarListInputItems(rawValue),
      getScalarListItemType(type) ?? "string",
    )
  }

  if (kind === "boolean-select") {
    const text = rawValue.trim().toLowerCase()
    if (!text) {
      return null
    }
    if (text === "true") {
      return true
    }
    if (text === "false") {
      return false
    }
    return rawValue
  }

  if (isStructuredVarType(type)) {
    const text = rawValue.trim()
    if (!text) {
      return nullableType ? null : ""
    }
    try {
      return JSON.parse(text)
    } catch {
      return rawValue
    }
  }

  if (nullableType && rawValue.trim() === "") {
    return null
  }

  return rawValue
}

// ---------------------------------------------------------------------------
// Width calculation helpers
// ---------------------------------------------------------------------------

function getVarControlMinWidth(inputKind: VarInputKind): number {
  switch (inputKind) {
    case "textarea":
    case "dna":
    case "code":
    case "file":
    case "scalar-list":
      return inputKind === "scalar-list" ? 220 : 160
    default:
      return 0
  }
}

function getVarControlExtraWidth(inputKind: VarInputKind): number {
  switch (inputKind) {
    case "datetime":
      return 36
    case "date":
      return 32
    case "time":
      return 28
    case "file":
      return 24
    case "scalar-list":
      return 16
    default:
      return 4
  }
}

function getFileControlMinWidth(input: HTMLElement | null): number {
  if (!input?.classList.contains("aimd-rec-inline__file-control")) {
    return 0
  }

  switch (input.dataset.fileKind) {
    case "image":
      return 360
    case "csv":
      return 280
    default:
      return 220
  }
}

export function calculateVarStackWidth(name: string, inputKind: VarInputKind): string {
  const labelChars = Math.max(name.length + 7, 10)
  const approximateCharWidth = 8
  const horizontalPadding = 16
  const widthPx = Math.round(labelChars * approximateCharWidth + horizontalPadding)
  const minWidthPx = getVarControlMinWidth(inputKind)
  const finalWidthPx = Math.max(minWidthPx, widthPx)

  return `${finalWidthPx}px`
}

function parsePx(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

let varTextMeasureCanvas: HTMLCanvasElement | null = null

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof window === "undefined") {
    return null
  }

  if (!varTextMeasureCanvas) {
    varTextMeasureCanvas = document.createElement("canvas")
  }

  return varTextMeasureCanvas.getContext("2d")
}

function measureStyledTextWidth(text: string, computed: CSSStyleDeclaration): number {
  const ctx = getMeasureContext()
  if (!ctx) {
    return 0
  }

  const fontSize = computed.fontSize || "16px"
  const fontFamily = computed.fontFamily || "sans-serif"
  const fontWeight = computed.fontWeight || "400"
  const fontStyle = computed.fontStyle || "normal"
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`

  return ctx.measureText(text).width
}

function measureLabelTokenWidth(token: HTMLElement): number {
  if (typeof window === "undefined") {
    return token.scrollWidth
  }

  const computed = window.getComputedStyle(token)
  const text = (token.textContent || "").trim()
  const textWidth = measureStyledTextWidth(text, computed)
  const horizontal =
    parsePx(computed.paddingLeft)
    + parsePx(computed.paddingRight)
    + parsePx(computed.borderLeftWidth)
    + parsePx(computed.borderRightWidth)
    + parsePx(computed.marginLeft)
    + parsePx(computed.marginRight)

  return textWidth + horizontal
}

function getElementHorizontalSpace(element: HTMLElement): number {
  if (typeof window === "undefined") {
    return 0
  }

  const computed = window.getComputedStyle(element)
  return parsePx(computed.paddingLeft)
    + parsePx(computed.paddingRight)
    + parsePx(computed.borderLeftWidth)
    + parsePx(computed.borderRightWidth)
    + parsePx(computed.marginLeft)
    + parsePx(computed.marginRight)
}

function measureFieldNameWidth(name: HTMLElement): number {
  const title = name.querySelector(".aimd-field__title") as HTMLElement | null
  const key = name.querySelector(".aimd-field__key") as HTMLElement | null
  const visibleTokenWidth = Math.max(
    title ? measureLabelTokenWidth(title) : 0,
    key ? measureLabelTokenWidth(key) : 0,
  )

  if (visibleTokenWidth > 0) {
    return visibleTokenWidth + getElementHorizontalSpace(name)
  }

  return measureLabelTokenWidth(name)
}

export function measureVarLabelWidth(wrapper: HTMLElement): number {
  const scope = wrapper.querySelector(".aimd-field__scope--var") as HTMLElement | null
  const name = wrapper.querySelector(".aimd-field__name") as HTMLElement | null
  const id = wrapper.querySelector(".aimd-field__id") as HTMLElement | null
  if (scope && name) {
    return measureLabelTokenWidth(scope) + measureFieldNameWidth(name) + 4
  }

  if (scope && id) {
    return measureLabelTokenWidth(scope) + measureLabelTokenWidth(id) + 4
  }

  const fallbackLabel = wrapper.querySelector(".aimd-field__label") as HTMLElement | null
  return fallbackLabel ? fallbackLabel.scrollWidth + 2 : 0
}

export function measureSingleLineControlWidth(input: HTMLElement): number {
  if (typeof window === "undefined") {
    return input.scrollWidth
  }

  const ctx = getMeasureContext()
  if (!ctx) {
    return input.scrollWidth
  }

  const computed = window.getComputedStyle(input)
  const fontSize = computed.fontSize || "16px"
  const fontFamily = computed.fontFamily || "sans-serif"
  const fontWeight = computed.fontWeight || "400"
  const fontStyle = computed.fontStyle || "normal"
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`

  const text = "value" in input
    ? ((input as HTMLInputElement | HTMLTextAreaElement).value || (input as HTMLInputElement | HTMLTextAreaElement).placeholder || "")
    : ((input.textContent || "").trim())
  const textWidth = ctx.measureText(text).width
  const padding = parsePx(computed.paddingLeft) + parsePx(computed.paddingRight)
  return textWidth + padding + 2
}

function measureOptionalControlSlotWidth(wrapper: HTMLElement, selector: string, fallbackWidth: number): number {
  const element = wrapper.querySelector(selector) as HTMLElement | null
  if (!element) {
    return 0
  }
  return element.offsetWidth || fallbackWidth
}

// ---------------------------------------------------------------------------
// Textarea auto-height
// ---------------------------------------------------------------------------

export function syncAutoWrapTextareaHeight(textarea: HTMLTextAreaElement) {
  if (typeof window === "undefined") {
    return
  }

  const isCompactText = textarea.classList.contains("aimd-rec-inline__textarea--stacked-text")
  textarea.style.height = "auto"
  const computed = window.getComputedStyle(textarea)
  const minHeight = isCompactText
    ? (parsePx(computed.getPropertyValue("--rec-var-control-height")) || parsePx(computed.height))
    : (parsePx(computed.minHeight) || parsePx(computed.height))

  if (isCompactText && textarea.value.length === 0) {
    textarea.style.height = `${Math.ceil(minHeight)}px`
    return
  }

  const borderHeight = parsePx(computed.borderTopWidth) + parsePx(computed.borderBottomWidth)
  const nextHeight = Math.max(minHeight, textarea.scrollHeight + borderHeight)
  textarea.style.height = `${Math.ceil(nextHeight)}px`
}

export function applyVarStackWidth(target: HTMLElement, inputKind: VarInputKind) {
  const wrapper = target.closest(".aimd-rec-inline--var-stacked") as HTMLElement | null
  if (!wrapper || typeof window === "undefined") {
    return
  }

  if (inputKind === "scalar-list") {
    wrapper.style.width = "100%"
    wrapper.style.maxWidth = "100%"
    return
  }

  const labelWidth = measureVarLabelWidth(wrapper)

  let controlWidth = 0
  const input = wrapper.querySelector(".aimd-rec-inline__input--stacked, .aimd-rec-inline__textarea--stacked-text, .aimd-rec-inline__file-control, .aimd-rec-inline__scalar-list") as HTMLElement | null
  const minWidthPx = Math.max(getVarControlMinWidth(inputKind), getFileControlMinWidth(input))
  if (input) {
    controlWidth = measureSingleLineControlWidth(input) + getVarControlExtraWidth(inputKind)
  }

  if (wrapper.querySelector(".aimd-rec-inline__control-row")) {
    controlWidth += measureOptionalControlSlotWidth(wrapper, ".aimd-rec-inline__assigner-prefix", 36)
      + measureOptionalControlSlotWidth(wrapper, ".aimd-rec-inline__assigner-status", 30)
  }

  const measuredWidth = Math.max(minWidthPx, labelWidth, controlWidth)
  wrapper.style.width = `${Math.ceil(measuredWidth)}px`
  wrapper.style.maxWidth = "100%"
}
