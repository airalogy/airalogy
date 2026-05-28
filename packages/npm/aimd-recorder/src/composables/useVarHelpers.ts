/**
 * Pure helper functions for AIMD var field rendering.
 *
 * Extracted from AimdRecorder.vue to enable reuse across
 * the recorder and the host-app rendering pipeline.
 */

import { resolveAimdTypePlugin } from '../type-plugins'
import { isAimdCodeEditorType } from '../code-types'
import { normalizeAimdTypeName } from '../type-utils'
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

export type FileInputDisplayKind = "file" | "csv" | "image" | "audio" | "video" | "document" | "text"

export interface FileInputConfig {
  kind: FileInputDisplayKind
  accept?: string
  badge: string
}

const FILE_CONFIG_BY_NORMALIZED_TYPE: Record<string, FileInputConfig> = {
  file: { kind: "file", badge: "FILE" },
  upload: { kind: "file", badge: "FILE" },
  csv: { kind: "csv", accept: ".csv,text/csv", badge: "CSV" },
  fileidcsv: { kind: "csv", accept: ".csv,text/csv", badge: "CSV" },
  image: { kind: "image", accept: "image/*", badge: "IMG" },
  fileidpng: { kind: "image", accept: ".png,image/png", badge: "IMG" },
  fileidjpg: { kind: "image", accept: ".jpg,.jpeg,image/jpeg", badge: "IMG" },
  fileidjpeg: { kind: "image", accept: ".jpg,.jpeg,image/jpeg", badge: "IMG" },
  fileidsvg: { kind: "image", accept: ".svg,image/svg+xml", badge: "IMG" },
  fileidwebp: { kind: "image", accept: ".webp,image/webp", badge: "IMG" },
  fileidtiff: { kind: "image", accept: ".tif,.tiff,image/tiff", badge: "IMG" },
  audio: { kind: "audio", accept: "audio/*", badge: "AUD" },
  fileidmp3: { kind: "audio", accept: ".mp3,audio/mpeg", badge: "AUD" },
  video: { kind: "video", accept: "video/*", badge: "VID" },
  fileidmp4: { kind: "video", accept: ".mp4,video/mp4", badge: "VID" },
  fileidaimd: { kind: "text", accept: ".aimd,text/plain", badge: "AIMD" },
  fileidmd: { kind: "text", accept: ".md,text/markdown,text/plain", badge: "MD" },
  fileidtxt: { kind: "text", accept: ".txt,text/plain", badge: "TXT" },
  fileidjson: { kind: "text", accept: ".json,application/json", badge: "JSON" },
  fileiddocx: { kind: "document", accept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document", badge: "DOC" },
  fileidxlsx: { kind: "document", accept: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", badge: "XLS" },
  fileidpptx: { kind: "document", accept: ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation", badge: "PPT" },
  fileidpdf: { kind: "document", accept: ".pdf,application/pdf", badge: "PDF" },
}

const FILE_KIND_BY_EXTENSION: Record<string, FileInputDisplayKind> = {
  csv: "csv",
  png: "image",
  jpg: "image",
  jpeg: "image",
  svg: "image",
  webp: "image",
  tif: "image",
  tiff: "image",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  mp4: "video",
  mov: "video",
  webm: "video",
  aimd: "text",
  md: "text",
  txt: "text",
  json: "text",
  pdf: "document",
  docx: "document",
  xlsx: "document",
  pptx: "document",
}

const FILE_BADGE_BY_KIND: Record<FileInputDisplayKind, string> = {
  file: "FILE",
  csv: "CSV",
  image: "IMG",
  audio: "AUD",
  video: "VID",
  document: "DOC",
  text: "TXT",
}

const MIME_BY_EXTENSION: Record<string, string> = {
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  webp: "image/webp",
  tif: "image/tiff",
  tiff: "image/tiff",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  webm: "video/webm",
  md: "text/markdown",
  txt: "text/plain",
  aimd: "text/plain",
  json: "application/json",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

const AIRALOGY_FILE_ID_RE = /^airalogy\.id\.file\.[A-Za-z0-9_-]+$/i

function getStringFromRecord(record: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!record) {
    return undefined
  }
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

function normalizeFileExtension(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined
  }
  const trimmed = value.trim().toLowerCase()
  if (!trimmed || trimmed === "*") {
    return undefined
  }
  return trimmed.replace(/^\./, "")
}

function getConfiguredFileExtension(kwargs?: Record<string, unknown>, fieldMeta?: AimdFieldMeta): string | undefined {
  const metaExtension = normalizeFileExtension((fieldMeta as { fileExtension?: unknown } | undefined)?.fileExtension)
  if (metaExtension) {
    return metaExtension
  }
  return normalizeFileExtension(kwargs?.file_extension)
    ?? normalizeFileExtension(kwargs?.fileExtension)
    ?? normalizeFileExtension(kwargs?.extension)
}

function acceptFromExtension(extension: string): string {
  const ext = extension.replace(/^\./, "").toLowerCase()
  const mime = MIME_BY_EXTENSION[ext]
  return mime ? `.${ext},${mime}` : `.${ext}`
}

function fileKindFromExtension(extension: string | undefined): FileInputDisplayKind {
  if (!extension) {
    return "file"
  }
  return FILE_KIND_BY_EXTENSION[extension] ?? "file"
}

function isKnownFileTypeName(normalized: string | undefined): boolean {
  if (!normalized) {
    return false
  }
  return Boolean(FILE_CONFIG_BY_NORMALIZED_TYPE[normalized])
    || normalized.startsWith("fileid")
}

export function getFileInputConfig(
  type: string | undefined,
  kwargs?: Record<string, unknown>,
  fieldMeta?: AimdFieldMeta,
): FileInputConfig {
  const normalizedInputType = normalizeAimdTypeName(fieldMeta?.inputType)
  const normalized = isKnownFileTypeName(normalizedInputType)
    ? normalizedInputType
    : normalizeVarTypeName(type)
  const configuredExtension = getConfiguredFileExtension(kwargs, fieldMeta)
  const configuredAccept = normalizeMetaString(fieldMeta?.accept)
    ?? getStringFromRecord(kwargs, ["accept", "file_accept", "fileAccept"])
  const base = FILE_CONFIG_BY_NORMALIZED_TYPE[normalized]

  if (configuredExtension) {
    const kind = fileKindFromExtension(configuredExtension)
    return {
      kind,
      accept: configuredAccept ?? acceptFromExtension(configuredExtension),
      badge: base?.badge ?? FILE_BADGE_BY_KIND[kind],
    }
  }

  if (base) {
    return {
      ...base,
      accept: configuredAccept ?? base.accept,
    }
  }

  return {
    kind: "file",
    accept: configuredAccept,
    badge: FILE_BADGE_BY_KIND.file,
  }
}

export function isFileLikeVarType(
  type: string | undefined,
  kwargs?: Record<string, unknown>,
  fieldMeta?: AimdFieldMeta,
): boolean {
  const normalized = normalizeVarTypeName(type)
  const normalizedInputType = normalizeAimdTypeName(fieldMeta?.inputType)
  return isKnownFileTypeName(normalized)
    || isKnownFileTypeName(normalizedInputType)
    || Boolean(getConfiguredFileExtension(kwargs, fieldMeta))
    || Boolean(normalizeMetaString(fieldMeta?.accept))
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
  return typeof value === "string" && AIRALOGY_FILE_ID_RE.test(value)
}

export function getFileValueId(value: unknown): string | undefined {
  const normalized = unwrapStructuredValue(value)
  if (typeof normalized === "string") {
    return normalized.trim() || undefined
  }
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    return undefined
  }
  return getStringFromRecord(normalized as Record<string, unknown>, [
    "id",
    "file_id",
    "fileId",
    "src",
  ])
}

export function getFileDisplayName(value: unknown): string {
  const normalized = unwrapStructuredValue(value)
  if (typeof normalized === "string") {
    if (isAiralogyFileId(normalized)) {
      return ""
    }
    return normalized
  }
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    return ""
  }
  const record = normalized as Record<string, unknown>
  return getStringFromRecord(record, [
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
  ]) ?? ""
}

function normalizeMetaString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
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

  if (normalized === 'dna') {
    return 'dna'
  }

  if (isKnownFileTypeName(normalized)) {
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

export function isNumericVarType(type: string | undefined): boolean {
  const normalized = normalizeVarTypeName(type)
  return normalized === "float" || normalized === "int" || normalized === "integer" || normalized === "number"
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

  const normalized = normalizeVarTypeName(type)

  if (normalized === "float" || normalized === "int" || normalized === "integer" || normalized === "number") {
    return "number"
  }

  if (normalized === "bool" || normalized === "boolean" || normalized === "checkbox") {
    return "checkbox"
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

  if (isFileLikeVarType(type, options.kwargs, options.fieldMeta)) {
    return "file"
  }

  if (isAimdCodeEditorType(type, { codeLanguage: options.codeLanguage })) {
    return 'code'
  }

  return "text"
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
  if (value && typeof value === "object" && !Array.isArray(value) && "value" in value) {
    return (value as { value: unknown }).value
  }
  return value
}

export function toBooleanValue(value: unknown): boolean {
  const normalized = unwrapStructuredValue(value)

  if (typeof normalized === "boolean") {
    return normalized
  }
  if (typeof normalized === "number") {
    return normalized !== 0
  }
  if (typeof normalized === "string") {
    const text = normalized.trim().toLowerCase()
    if (text === "" || text === "false" || text === "0" || text === "no" || text === "off") {
      return false
    }
    if (text === "true" || text === "1" || text === "yes" || text === "on") {
      return true
    }
  }
  return Boolean(normalized)
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

  if (kind === "dna") {
    return typeof normalized === "string" ? normalized : JSON.stringify(normalized)
  }

  if (kind === "file") {
    return getFileDisplayName(normalized)
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

  const normalizedType = normalizeVarTypeName(type)

  if (kind === "datetime") {
    return normalizeDateTimeValueWithTimezone(rawValue)
  }

  if (kind === "number") {
    const text = rawValue.trim()
    if (!text) {
      return ""
    }
    const parsed = normalizedType === "int" || normalizedType === "integer"
      ? Number.parseInt(text, 10)
      : Number.parseFloat(text)
    return Number.isNaN(parsed) ? rawValue : parsed
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
      return 160
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

  const labelWidth = measureVarLabelWidth(wrapper)

  let controlWidth = 0
  const input = wrapper.querySelector(".aimd-rec-inline__input--stacked, .aimd-rec-inline__textarea--stacked-text, .aimd-rec-inline__file-control") as HTMLElement | null
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
