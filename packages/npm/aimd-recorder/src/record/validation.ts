import type { ExtractedAimdFields } from "@airalogy/aimd-core/types"
import { getAimdBuiltInTypeMetadata } from "@airalogy/aimd-core/utils"
import type { ErrorObject } from "ajv"
import Ajv2020 from "ajv/dist/2020"
import addFormats from "ajv-formats"
import type { AimdRecorderMessages } from "../locales"
import type {
  AimdFieldMeta,
  AimdFieldState,
  AimdProtocolRecordData,
  AimdRecordValidationSchema,
  AimdRecorderFieldType,
  AimdRecorderValidationCode,
  AimdRecorderValidationIssue,
  AimdRecorderValidationResult,
} from "../types"
import {
  getNumericConstraintViolation,
  getResourceRefTypeConfig,
  isNullableVarType,
} from "../composables/useVarHelpers"

export interface ValidateAimdRecordOptions {
  fieldMeta?: Record<string, AimdFieldMeta>
  /** Pydantic-compatible JSON Schema returned by protocol parsing. */
  schema?: AimdRecordValidationSchema
  /** Limit validation to one or more canonical field keys. */
  fieldKeys?: string[]
  messages: AimdRecorderMessages["validation"]
}

export interface ResolveAimdRequiredFieldOptions {
  fieldMeta?: Record<string, AimdFieldMeta>
  schema?: AimdRecordValidationSchema
}

type SchemaSection = "var" | "step" | "check" | "quiz"

interface ResolvedSchemaSection {
  section: SchemaSection
  schema: Record<string, unknown>
}

const SCHEMA_SECTION_ALIASES: Array<{ section: SchemaSection; keys: string[] }> = [
  { section: "var", keys: ["vars", "var", "research_variable"] },
  { section: "step", keys: ["steps", "step", "research_step"] },
  { section: "check", keys: ["checks", "check", "research_check"] },
  { section: "quiz", keys: ["quiz", "quizzes", "research_quiz"] },
]

const schemaAjv = new Ajv2020({
  allErrors: true,
  allowUnionTypes: true,
  coerceTypes: "array",
  strict: false,
})
addFormats(schemaAjv)
const compiledSchemaValidators = new WeakMap<object, ReturnType<typeof schemaAjv.compile>>()

function getCompiledSchemaValidator(schema: Record<string, unknown>) {
  const cached = compiledSchemaValidators.get(schema)
  if (cached) return cached
  const validate = schemaAjv.compile(schema)
  compiledSchemaValidators.set(schema, validate)
  return validate
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === "string") return value.trim() === ""
  if (Array.isArray(value)) return value.length === 0
  return false
}

function resolveRequired(
  meta: AimdFieldMeta | undefined,
  kwargs: Record<string, unknown> | undefined,
  inferred: boolean,
): boolean {
  if (typeof meta?.required === "boolean") return meta.required
  if (typeof kwargs?.required === "boolean") return kwargs.required
  return inferred
}

function resolvePattern(meta: AimdFieldMeta | undefined, kwargs?: Record<string, unknown>): string | undefined {
  const value = meta?.pattern ?? kwargs?.pattern
  return typeof value === "string" && value ? value : undefined
}

function decodeJsonPointerSegment(value: string): string {
  return value.replace(/~1/g, "/").replace(/~0/g, "~")
}

function getJsonPointerSegments(path: string): string[] {
  return path
    .split("/")
    .slice(1)
    .map(decodeJsonPointerSegment)
}

export function getAimdVarTableCellFieldKey(table: string, rowIndex: number, column: string): string {
  return `var_table:${table}:${rowIndex}:${column}`
}

function getCheckLikeValue(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value
  return (value as { checked?: unknown }).checked
}

function normalizeValidationValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeValidationValue)
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (!isRecord(value)) {
    return value
  }

  const decimalLike = value as { toNumber?: () => unknown; toString?: () => string }
  if (typeof decimalLike.toNumber === "function" && typeof decimalLike.toString === "function") {
    try {
      const numericValue = decimalLike.toNumber()
      if (typeof numericValue === "number" && Number.isFinite(numericValue)) return numericValue
    }
    catch {
      // Fall through to ordinary object normalization.
    }
  }

  if (typeof value.airalogy_file_id === "string") return value.airalogy_file_id
  if (typeof value.airalogyId === "string") return value.airalogyId
  if ((value.type === "file" || value.type === "image") && typeof value.id === "string") return value.id
  if (hasOwn(value, "value") && (hasOwn(value, "displayedValue") || hasOwn(value, "formattedValue") || hasOwn(value, "type"))) {
    return normalizeValidationValue(value.value)
  }
  if (!hasOwn(value, "value") && typeof value.formattedValue === "string") return value.formattedValue

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [key, normalizeValidationValue(nestedValue)]),
  )
}

function getNormalizedSchemaSectionValue(section: SchemaSection, record: AimdProtocolRecordData): Record<string, unknown> {
  const source = record[section] ?? {}
  if (section === "step" || section === "check") {
    return Object.fromEntries(
      Object.entries(source).map(([key, value]) => [key, normalizeValidationValue(getCheckLikeValue(value))]),
    )
  }
  return normalizeValidationValue(source) as Record<string, unknown>
}

function resolveSchemaSections(schema: AimdRecordValidationSchema | undefined): ResolvedSchemaSection[] {
  if (!schema) return []

  if (schema.type === "object" || isRecord(schema.properties) || Array.isArray(schema.required)) {
    return [{ section: "var", schema }]
  }

  const resolved: ResolvedSchemaSection[] = []
  for (const entry of SCHEMA_SECTION_ALIASES) {
    const sectionSchema = entry.keys
      .map(key => schema[key])
      .find(isRecord)
    if (sectionSchema) resolved.push({ section: entry.section, schema: sectionSchema })
  }
  return resolved
}

function getSchemaCoveredFieldKeys(schemaSections: ResolvedSchemaSection[]): Set<string> {
  const keys = new Set<string>()
  for (const { section, schema } of schemaSections) {
    if (!isRecord(schema.properties)) continue
    for (const id of Object.keys(schema.properties)) {
      keys.add(`${section}:${id}`)
      if (section === "var") keys.add(`var_table:${id}`)
    }
  }
  return keys
}

function resolveLocalSchemaReference(
  root: Record<string, unknown>,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const ref = schema.$ref
  if (typeof ref !== "string" || !ref.startsWith("#/")) return schema

  let current: unknown = root
  for (const segment of getJsonPointerSegments(ref.slice(1))) {
    if (!isRecord(current)) return schema
    current = current[segment]
  }
  return isRecord(current) ? current : schema
}

function findArraySchema(
  root: Record<string, unknown>,
  candidate: unknown,
  visited = new Set<object>(),
): Record<string, unknown> | undefined {
  if (!isRecord(candidate) || visited.has(candidate)) return undefined
  visited.add(candidate)
  const schema = resolveLocalSchemaReference(root, candidate)
  if (schema !== candidate && !visited.has(schema)) {
    const referenced = findArraySchema(root, schema, visited)
    if (referenced) return referenced
  }
  if (schema.type === "array" || hasOwn(schema, "items")) return schema

  for (const branchKey of ["anyOf", "oneOf", "allOf"] as const) {
    const branches = schema[branchKey]
    if (!Array.isArray(branches)) continue
    for (const branch of branches) {
      const arraySchema = findArraySchema(root, branch, visited)
      if (arraySchema) return arraySchema
    }
  }
  return undefined
}

function schemaAllowsNull(
  root: Record<string, unknown>,
  candidate: unknown,
  visited = new Set<object>(),
): boolean {
  if (!isRecord(candidate) || visited.has(candidate)) return false
  visited.add(candidate)

  const schema = resolveLocalSchemaReference(root, candidate)
  if (schema !== candidate && schemaAllowsNull(root, schema, visited)) return true
  if (schema.nullable === true) return true
  if (schema.type === "null") return true
  if (Array.isArray(schema.type) && schema.type.includes("null")) return true

  for (const branchKey of ["anyOf", "oneOf"] as const) {
    const branches = schema[branchKey]
    if (Array.isArray(branches) && branches.some(branch => schemaAllowsNull(root, branch, visited))) {
      return true
    }
  }
  return false
}

function getSchemaNullableFieldKeys(schemaSections: ResolvedSchemaSection[]): Set<string> {
  const keys = new Set<string>()
  for (const { section, schema } of schemaSections) {
    const properties = isRecord(schema.properties) ? schema.properties : {}
    for (const [id, propertySchema] of Object.entries(properties)) {
      if (schemaAllowsNull(schema, propertySchema)) {
        keys.add(`${section}:${id}`)
        if (section === "var") keys.add(`var_table:${id}`)
      }
      if (section !== "var") continue

      const arraySchema = findArraySchema(schema, propertySchema)
      const itemSchema = isRecord(arraySchema?.items)
        ? resolveLocalSchemaReference(schema, arraySchema.items)
        : undefined
      const itemProperties = itemSchema && isRecord(itemSchema.properties) ? itemSchema.properties : {}
      for (const [column, columnSchema] of Object.entries(itemProperties)) {
        if (schemaAllowsNull(schema, columnSchema)) keys.add(`var_table:${id}:${column}`)
      }
    }
  }
  return keys
}

function getSchemaRequiredFieldKeys(schemaSections: ResolvedSchemaSection[]): Set<string> {
  const keys = new Set<string>()
  for (const { section, schema } of schemaSections) {
    const required = new Set(
      Array.isArray(schema.required)
        ? schema.required.filter((key): key is string => typeof key === "string")
        : [],
    )
    const properties = isRecord(schema.properties) ? schema.properties : {}
    for (const [id, propertySchema] of Object.entries(properties)) {
      if (required.has(id)) {
        keys.add(`${section}:${id}`)
        if (section === "var") keys.add(`var_table:${id}`)
      }
      if (section !== "var") continue

      const arraySchema = findArraySchema(schema, propertySchema)
      const itemSchema = isRecord(arraySchema?.items)
        ? resolveLocalSchemaReference(schema, arraySchema.items)
        : undefined
      if (!itemSchema || !Array.isArray(itemSchema.required)) continue
      for (const column of itemSchema.required) {
        if (typeof column === "string") keys.add(`var_table:${id}:${column}`)
      }
    }
  }
  return keys
}

/** Resolve the canonical field selectors that the recorder treats as required. */
export function getAimdRequiredFieldKeys(
  fields: ExtractedAimdFields,
  options: ResolveAimdRequiredFieldOptions = {},
): Set<string> {
  const keys = new Set<string>()
  const fieldMeta = options.fieldMeta ?? {}
  const schemaSections = resolveSchemaSections(options.schema)
  const schemaCoveredKeys = getSchemaCoveredFieldKeys(schemaSections)
  const schemaRequiredKeys = getSchemaRequiredFieldKeys(schemaSections)
  const schemaNullableKeys = getSchemaNullableFieldKeys(schemaSections)

  const addWhenRequired = (
    fieldKey: string,
    kwargs: Record<string, unknown> | undefined,
    inferredRequired: boolean,
    type?: string,
  ) => {
    const required = schemaCoveredKeys.has(fieldKey)
      ? fieldMeta[fieldKey]?.required === true
        || (schemaRequiredKeys.has(fieldKey) && !schemaNullableKeys.has(fieldKey))
      : resolveRequired(fieldMeta[fieldKey], kwargs, inferredRequired && !isNullableVarType(type))
    if (required) keys.add(fieldKey)
  }

  for (const field of fields.var_definitions ?? []) {
    addWhenRequired(`var:${field.id}`, field.kwargs, !hasOwn(field, "default"), field.type)
  }

  for (const table of fields.var_table ?? []) {
    const tableKey = `var_table:${table.id}`
    addWhenRequired(tableKey, table.kwargs, !hasOwn(table, "default"), table.type_annotation)
    const schemaCovered = schemaCoveredKeys.has(tableKey)
    for (const column of table.subvars ?? []) {
      const columnKey = `${tableKey}:${column.id}`
      const required = schemaCovered
        ? fieldMeta[columnKey]?.required === true
          || (schemaRequiredKeys.has(columnKey) && !schemaNullableKeys.has(columnKey))
        : resolveRequired(
            fieldMeta[columnKey],
            column.kwargs,
            !hasOwn(column, "default") && !isNullableVarType(column.type),
          )
      if (required) keys.add(columnKey)
    }
  }

  for (const id of fields.step ?? []) {
    addWhenRequired(`step:${id}`, undefined, false)
  }
  for (const id of fields.check ?? []) {
    addWhenRequired(`check:${id}`, undefined, false)
  }
  for (const quiz of fields.quiz ?? []) {
    addWhenRequired(
      `quiz:${quiz.id}`,
      isRecord(quiz.extra) ? quiz.extra : undefined,
      false,
    )
  }

  return keys
}

function getFieldLabel(
  fields: ExtractedAimdFields,
  section: AimdRecorderFieldType,
  id: string,
  rowIndex?: number,
  column?: string,
  messages?: AimdRecorderMessages["validation"],
): string {
  if (section === "var") {
    const field = fields.var_definitions?.find(candidate => candidate.id === id)
    return field?.title || id
  }
  if (section === "var_table") {
    const table = fields.var_table?.find(candidate => candidate.id === id)
    if (column && rowIndex !== undefined && messages) {
      const columnDefinition = table?.subvars.find(candidate => candidate.id === column)
      return messages.tableCell(rowIndex + 1, columnDefinition?.title || column)
    }
    return table?.title || id
  }
  if (section === "quiz") {
    const quiz = fields.quiz?.find(candidate => candidate.id === id)
    return quiz?.title || quiz?.stem || id
  }
  return id
}

function getIssueValue(
  record: AimdProtocolRecordData,
  section: AimdRecorderFieldType,
  id: string,
  rowIndex?: number,
  column?: string,
): unknown {
  if (section === "var") return record.var[id]
  if (section === "var_table") {
    const rows = record.var[id]
    if (rowIndex === undefined || !Array.isArray(rows)) return rows
    const row = rows[rowIndex]
    return column && isRecord(row) ? row[column] : row
  }
  if (section === "step") return getCheckLikeValue(record.step[id])
  if (section === "check") return getCheckLikeValue(record.check[id])
  return record.quiz[id]
}

function mapSchemaErrorToIssue(
  error: ErrorObject,
  section: SchemaSection,
  fields: ExtractedAimdFields,
  record: AimdProtocolRecordData,
  messages: AimdRecorderMessages["validation"],
): AimdRecorderValidationIssue | null {
  const segments = getJsonPointerSegments(error.instancePath)
  if (error.keyword === "required" && typeof error.params.missingProperty === "string") {
    segments.push(error.params.missingProperty)
  }
  if (error.keyword === "additionalProperties" && typeof error.params.additionalProperty === "string") {
    segments.push(error.params.additionalProperty)
  }
  if (error.keyword === "unevaluatedProperties" && typeof error.params.unevaluatedProperty === "string") {
    segments.push(error.params.unevaluatedProperty)
  }
  if (error.keyword === "dependentRequired" && typeof error.params.missingProperty === "string") {
    segments.push(error.params.missingProperty)
  }

  const id = segments[0]
  if (!id) {
    return {
      fieldKey: `${section}:$schema`,
      section,
      code: "schema",
      message: messages.schema("Schema", error.message || error.keyword),
      keyword: error.keyword,
      instancePath: error.instancePath,
      schemaPath: error.schemaPath,
    }
  }

  const isTable = section === "var" && fields.var_table.some(table => table.id === id)
  const issueSection: AimdRecorderFieldType = isTable ? "var_table" : section
  const rowIndex = isTable && /^\d+$/.test(segments[1] ?? "") ? Number(segments[1]) : undefined
  const column = isTable && rowIndex !== undefined ? segments[2] : undefined
  const fieldKey = isTable && rowIndex !== undefined && column
    ? getAimdVarTableCellFieldKey(id, rowIndex, column)
    : `${issueSection}:${id}`
  const label = getFieldLabel(fields, issueSection, id, rowIndex, column, messages)
  const detail = error.message || error.keyword

  let code: AimdRecorderValidationCode = "schema"
  let message = messages.schema(label, detail)
  switch (error.keyword) {
    case "required":
      code = "required"
      message = messages.required(label)
      break
    case "pattern":
      code = "pattern"
      message = messages.pattern(label)
      break
    case "enum":
    case "const":
      code = "enum"
      message = messages.enum(label)
      break
    case "type": {
      code = "type"
      const expected = String(error.params.type || "the expected type")
      message = messages.type(label, expected)
      break
    }
    case "format": {
      code = "format"
      const format = String(error.params.format || "the expected")
      message = messages.format(label, format)
      break
    }
    case "minimum":
      code = "numeric"
      message = messages.numeric(label, `Must be >= ${String(error.params.limit)}`)
      break
    case "exclusiveMinimum":
      code = "numeric"
      message = messages.numeric(label, `Must be > ${String(error.params.limit)}`)
      break
    case "maximum":
      code = "numeric"
      message = messages.numeric(label, `Must be <= ${String(error.params.limit)}`)
      break
    case "exclusiveMaximum":
      code = "numeric"
      message = messages.numeric(label, `Must be < ${String(error.params.limit)}`)
      break
    case "multipleOf":
      code = "numeric"
      message = messages.numeric(label, `Must be a multiple of ${String(error.params.multipleOf)}`)
      break
  }

  return {
    fieldKey,
    section: issueSection,
    code,
    message,
    value: getIssueValue(record, issueSection, id, rowIndex, column),
    rowIndex,
    column,
    keyword: error.keyword,
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
  }
}

function validateSchema(
  issues: AimdRecorderValidationIssue[],
  fields: ExtractedAimdFields,
  record: AimdProtocolRecordData,
  schemaSections: ResolvedSchemaSection[],
  messages: AimdRecorderMessages["validation"],
) {
  if (schemaSections.length === 0) return

  for (const { section, schema } of schemaSections) {
    let validate: ReturnType<typeof schemaAjv.compile>
    try {
      validate = getCompiledSchemaValidator(schema)
    }
    catch (error) {
      issues.push({
        fieldKey: `${section}:$schema`,
        section,
        code: "schema",
        message: messages.schema("Schema", error instanceof Error ? error.message : String(error)),
        keyword: "compile",
      })
      continue
    }

    validate(getNormalizedSchemaSectionValue(section, record))
    for (const error of validate.errors ?? []) {
      const issue = mapSchemaErrorToIssue(error, section, fields, record, messages)
      if (issue) issues.push(issue)
    }
  }
}

function addIssue(
  issues: AimdRecorderValidationIssue[],
  fieldKey: string,
  section: AimdRecorderFieldType,
  code: AimdRecorderValidationCode,
  message: string,
  value: unknown,
  details?: Pick<AimdRecorderValidationIssue, "rowIndex" | "column" | "keyword">,
) {
  issues.push({ fieldKey, section, code, message, value, ...details })
}

function normalizeTypeName(type: string | undefined): string {
  if (!type) return ""
  return type
    .replace(/\s+/g, "")
    .replace(/^(?:typing\.)?Optional\[(.*)\]$/i, "$1")
    .split("|")
    .find(part => !/^(?:none|null|undefined)$/i.test(part))
    ?.replace(/^(?:builtins\.|airalogy\.types\.)/, "")
    .toLowerCase() ?? ""
}

function getExpectedRuntimeType(type: string | undefined): "string" | "number" | "integer" | "boolean" | "array" | "object" | undefined {
  const normalized = normalizeTypeName(type)
  if (/^(?:str|string|date|datetime|time|uuid|decimal)$/.test(normalized)) return "string"
  if (/^(?:float|number)$/.test(normalized)) return "number"
  if (/^(?:int|integer)$/.test(normalized)) return "integer"
  if (/^(?:bool|boolean)$/.test(normalized)) return "boolean"
  if (/^(?:list|list\[|array|tuple|set)/.test(normalized)) return "array"
  const builtInType = getAimdBuiltInTypeMetadata(type)?.type
  if (builtInType === "string" || builtInType === "number" || builtInType === "integer" || builtInType === "boolean" || builtInType === "array" || builtInType === "object") {
    return builtInType
  }
  return undefined
}

function valueMatchesType(value: unknown, expected: ReturnType<typeof getExpectedRuntimeType>): boolean {
  if (!expected) return true
  if (expected === "array") return Array.isArray(value)
  if (expected === "object") return isRecord(value)
  if (expected === "boolean") return typeof value === "boolean" || value === "true" || value === "false"
  if (expected === "integer") {
    const numeric = typeof value === "number" ? value : Number(value)
    return Number.isInteger(numeric)
  }
  if (expected === "number") {
    const numeric = typeof value === "number" ? value : Number(value)
    return Number.isFinite(numeric)
  }
  return typeof value === "string"
}

function getFallbackFormat(type: string | undefined, kwargs?: Record<string, unknown>): string | undefined {
  if (typeof kwargs?.format === "string" && kwargs.format) return kwargs.format
  const normalized = normalizeTypeName(type)
  if (normalized === "date") return "date"
  if (normalized === "datetime") return "date-time"
  if (normalized === "time") return "time"
  if (normalized === "uuid") return "uuid"
  return undefined
}

function valueMatchesFormat(value: unknown, format: string): boolean {
  if (typeof value !== "string") return false
  if (format === "date") return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  if (format === "date-time") return !Number.isNaN(Date.parse(value))
  if (format === "time") return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-][0-2]\d:[0-5]\d)?$/.test(value)
  if (format === "uuid") return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  if (format === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  return true
}

function validateValue(
  issues: AimdRecorderValidationIssue[],
  options: ValidateAimdRecordOptions,
  input: {
    fieldKey: string
    section: AimdRecorderFieldType
    label: string
    value: unknown
    type?: string
    kwargs?: Record<string, unknown>
    meta?: AimdFieldMeta
    enumValues?: unknown[]
    rowIndex?: number
    column?: string
    inferredRequired?: boolean
    schemaCovered?: boolean
    schemaRequired?: boolean
    schemaNullable?: boolean
  },
) {
  const {
    fieldKey,
    section,
    label,
    value,
    type,
    kwargs,
    meta,
    enumValues,
    rowIndex,
    column,
    inferredRequired = false,
    schemaCovered = false,
    schemaRequired = false,
    schemaNullable = false,
  } = input
  const details = { rowIndex, column }
  const fallbackKwargs = schemaCovered ? undefined : kwargs
  const fallbackEnumValues = schemaCovered ? undefined : enumValues
  const explicitlyRequired = meta?.required === true || (!schemaCovered && kwargs?.required === true)
  const nullable = schemaCovered ? schemaNullable : isNullableVarType(type)
  const required = schemaCovered
    ? schemaRequired || meta?.required === true
    : resolveRequired(meta, kwargs, inferredRequired && !nullable)
  const allowedNullableEmpty = value === null && nullable && !explicitlyRequired

  if (required && isEmptyValue(value) && !allowedNullableEmpty) {
    addIssue(issues, fieldKey, section, "required", options.messages.required(label), value, details)
    return
  }
  if (isEmptyValue(value)) return

  const pattern = resolvePattern(meta, fallbackKwargs)
  if (pattern) {
    try {
      if (!new RegExp(pattern).test(String(value))) {
        addIssue(issues, fieldKey, section, "pattern", options.messages.pattern(label), value, details)
      }
    }
    catch {
      addIssue(issues, fieldKey, section, "pattern", options.messages.pattern(label), value, details)
    }
  }

  const allowedValues = meta?.enumOptions?.map(option => option.value) ?? fallbackEnumValues
  if (allowedValues?.length && !allowedValues.some(item => Object.is(item, value))) {
    addIssue(issues, fieldKey, section, "enum", options.messages.enum(label), value, details)
  }

  if (!schemaCovered) {
    const expectedType = getExpectedRuntimeType(type)
    if (!valueMatchesType(value, expectedType)) {
      addIssue(issues, fieldKey, section, "type", options.messages.type(label, expectedType || type || "valid"), value, details)
    }

    const format = getFallbackFormat(type, kwargs)
    if (format && !valueMatchesFormat(value, format)) {
      addIssue(issues, fieldKey, section, "format", options.messages.format(label, format), value, details)
    }
  }

  const numericViolation = getNumericConstraintViolation(value, type, fallbackKwargs)
  if (numericViolation) {
    addIssue(issues, fieldKey, section, "numeric", options.messages.numeric(label, numericViolation), value, details)
  }
}

function validateResourceRefValue(
  issues: AimdRecorderValidationIssue[],
  options: ValidateAimdRecordOptions,
  input: {
    fieldKey: string
    label: string
    value: unknown
    type?: string
    kwargs?: Record<string, unknown>
    meta?: AimdFieldMeta
  },
): void {
  const config = getResourceRefTypeConfig(input.type, input.kwargs, input.meta)
  if (!config || isEmptyValue(input.value)) return
  const values = config.multiple
    ? Array.isArray(input.value) ? input.value : [input.value]
    : [input.value]
  for (const value of values) {
    if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()) {
      addIssue(
        issues,
        input.fieldKey,
        "var",
        "resource",
        options.messages.resource(input.label, options.messages.resourceInvalid),
        input.value,
      )
      return
    }
    if (config.containerRequired && (typeof value.container_id !== "string" || !value.container_id.trim())) {
      addIssue(
        issues,
        input.fieldKey,
        "var",
        "resource",
        options.messages.resource(input.label, options.messages.resourceContainerRequired),
        input.value,
      )
      return
    }
    if (config.bookingRequired && (typeof value.booking_id !== "string" || !value.booking_id.trim())) {
      addIssue(
        issues,
        input.fieldKey,
        "var",
        "resource",
        options.messages.resource(input.label, options.messages.resourceBookingRequired),
        input.value,
      )
      return
    }
  }
}

function matchesFieldSelector(fieldKey: string, selector: string): boolean {
  if (fieldKey === selector) return true
  const selectorParts = selector.split(":")
  if (selectorParts[0] !== "var_table") return false

  if (selectorParts.length === 2) {
    return fieldKey.startsWith(`${selector}:`)
  }
  if (selectorParts.length === 3) {
    const [section, table, column] = selectorParts
    const fieldParts = fieldKey.split(":")
    return fieldParts[0] === section
      && fieldParts[1] === table
      && fieldParts.length === 4
      && fieldParts[3] === column
  }
  return false
}

export function matchesAimdValidationFieldSelector(fieldKey: string, selector: string): boolean {
  return matchesFieldSelector(fieldKey, selector)
}

function finalizeIssues(
  issues: AimdRecorderValidationIssue[],
  fieldKeys: string[] | undefined,
): AimdRecorderValidationIssue[] {
  const selected = fieldKeys?.length
    ? issues.filter(issue => fieldKeys.some(selector => matchesFieldSelector(issue.fieldKey, selector)))
    : issues
  const keysWithSpecificIssues = new Set(
    selected
      .filter(issue => issue.keyword !== "anyOf" && issue.keyword !== "oneOf")
      .map(issue => issue.fieldKey),
  )
  const keysWithRequiredIssues = new Set(
    selected
      .filter(issue => issue.code === "required")
      .map(issue => issue.fieldKey),
  )
  const seen = new Set<string>()
  return selected.filter((issue) => {
    if (issue.code !== "required" && keysWithRequiredIssues.has(issue.fieldKey)) return false
    if ((issue.keyword === "anyOf" || issue.keyword === "oneOf") && keysWithSpecificIssues.has(issue.fieldKey)) {
      return false
    }
    const identity = `${issue.fieldKey}\u0000${issue.code}`
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

export function validateAimdRecord(
  fields: ExtractedAimdFields,
  record: AimdProtocolRecordData,
  options: ValidateAimdRecordOptions,
): AimdRecorderValidationResult {
  const issues: AimdRecorderValidationIssue[] = []
  const fieldMeta = options.fieldMeta ?? {}
  const schemaSections = resolveSchemaSections(options.schema)
  const schemaCoveredKeys = getSchemaCoveredFieldKeys(schemaSections)
  const schemaRequiredKeys = getSchemaRequiredFieldKeys(schemaSections)
  const schemaNullableKeys = getSchemaNullableFieldKeys(schemaSections)

  validateSchema(issues, fields, record, schemaSections, options.messages)

  for (const field of fields.var_definitions ?? []) {
    const fieldKey = `var:${field.id}`
    validateValue(issues, options, {
      fieldKey,
      section: "var",
      label: field.title || field.id,
      value: record.var[field.id],
      type: field.type,
      kwargs: field.kwargs,
      meta: fieldMeta[fieldKey],
      enumValues: field.enum,
      inferredRequired: !hasOwn(field, "default"),
      schemaCovered: schemaCoveredKeys.has(fieldKey),
      schemaRequired: schemaRequiredKeys.has(fieldKey),
      schemaNullable: schemaNullableKeys.has(fieldKey),
    })
    validateResourceRefValue(issues, options, {
      fieldKey,
      label: field.title || field.id,
      value: record.var[field.id],
      type: field.type,
      kwargs: field.kwargs,
      meta: fieldMeta[fieldKey],
    })
  }

  for (const table of fields.var_table ?? []) {
    const tableKey = `var_table:${table.id}`
    const rows = Array.isArray(record.var[table.id]) ? record.var[table.id] as Record<string, unknown>[] : []
    const schemaCovered = schemaCoveredKeys.has(tableKey)
    const required = schemaCovered
      ? fieldMeta[tableKey]?.required === true
        || (schemaRequiredKeys.has(tableKey) && !schemaNullableKeys.has(tableKey))
      : resolveRequired(
          fieldMeta[tableKey],
          table.kwargs,
          !hasOwn(table, "default") && !isNullableVarType(table.type_annotation),
        )
    if (required && rows.length === 0) {
      addIssue(issues, tableKey, "var_table", "required", options.messages.required(table.title || table.id), rows)
      continue
    }
    rows.forEach((row, rowIndex) => {
      for (const column of table.subvars) {
        const columnMetaKey = `${tableKey}:${column.id}`
        const cellKey = getAimdVarTableCellFieldKey(table.id, rowIndex, column.id)
        validateValue(issues, options, {
          fieldKey: cellKey,
          section: "var_table",
          label: options.messages.tableCell(rowIndex + 1, column.title || column.id),
          value: row?.[column.id],
          type: column.type,
          kwargs: column.kwargs,
          meta: fieldMeta[columnMetaKey],
          enumValues: column.enum,
          rowIndex,
          column: column.id,
          inferredRequired: !hasOwn(column, "default"),
          schemaCovered,
          schemaRequired: schemaRequiredKeys.has(columnMetaKey),
          schemaNullable: schemaNullableKeys.has(columnMetaKey),
        })
      }
    })
  }

  for (const id of fields.step ?? []) {
    const fieldKey = `step:${id}`
    validateValue(issues, options, {
      fieldKey,
      section: "step",
      label: id,
      value: getCheckLikeValue(record.step[id]),
      meta: fieldMeta[fieldKey],
      schemaCovered: schemaCoveredKeys.has(fieldKey),
      schemaRequired: schemaRequiredKeys.has(fieldKey),
    })
  }
  for (const id of fields.check ?? []) {
    const fieldKey = `check:${id}`
    validateValue(issues, options, {
      fieldKey,
      section: "check",
      label: id,
      value: getCheckLikeValue(record.check[id]),
      meta: fieldMeta[fieldKey],
      schemaCovered: schemaCoveredKeys.has(fieldKey),
      schemaRequired: schemaRequiredKeys.has(fieldKey),
    })
  }
  for (const quiz of fields.quiz ?? []) {
    const fieldKey = `quiz:${quiz.id}`
    const extra = isRecord(quiz.extra) ? quiz.extra : undefined
    validateValue(issues, options, {
      fieldKey,
      section: "quiz",
      label: quiz.title || quiz.stem || quiz.id,
      value: record.quiz[quiz.id],
      kwargs: extra,
      meta: fieldMeta[fieldKey],
      schemaCovered: schemaCoveredKeys.has(fieldKey),
      schemaRequired: schemaRequiredKeys.has(fieldKey),
    })
  }

  const finalIssues = finalizeIssues(issues, options.fieldKeys)
  const fieldState: Record<string, AimdFieldState> = {}
  for (const issue of finalIssues) {
    fieldState[issue.fieldKey] ??= { validationError: issue.message }
  }
  return {
    valid: finalIssues.length === 0,
    issues: finalIssues,
    fieldState,
    validatedFieldKeys: options.fieldKeys?.length ? [...options.fieldKeys] : undefined,
  }
}

export function validateAimdField(
  fields: ExtractedAimdFields,
  record: AimdProtocolRecordData,
  fieldKey: string,
  options: ValidateAimdRecordOptions,
): AimdRecorderValidationResult {
  return validateAimdRecord(fields, record, {
    ...options,
    fieldKeys: [fieldKey],
  })
}
