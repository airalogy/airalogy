import type {
  AimdVarField,
  ExtractedAimdFields,
} from "../types/aimd"

export type AimdProtocolKind = "experiment" | "resource_definition"
export type AimdResourceRole = "input" | "output" | "reference" | "equipment"

export interface AimdProtocolMetadata {
  kind?: AimdProtocolKind
  [key: string]: unknown
}

export interface AimdResourceFieldContract {
  resource_role: AimdResourceRole
  quantity_field?: string
  container_required: boolean
  booking_required: boolean
}

export interface AimdResourceValidationIssue {
  code: string
  message: string
  field?: string
  path?: string
}

export const AIMD_RESOURCE_DEFINITION_FORBIDDEN_FIELDS = [
  "assigner",
  "check",
  "client_assigner",
  "collector",
  "collectors",
  "quiz",
  "step",
  "workflow",
  "workflow_assigner",
] as const

const RESOURCE_METADATA_KEYS = [
  "resource_role",
  "quantity_field",
  "container_required",
  "booking_required",
] as const

function hasItems(value: unknown): boolean {
  return (Array.isArray(value) && value.length > 0)
    || (Boolean(value) && typeof value === "object" && Object.keys(value as object).length > 0)
}

function normalizeType(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, "")
}

function isResourceRefType(value: unknown): boolean {
  return /(^|[\[|,])ResourceRef(?:\[[^\]]+\])?(?=$|[\]|,])/.test(normalizeType(value))
}

function isNumericType(value: unknown): boolean {
  const type = normalizeType(value)
    .replace(/^Optional\[(.*)\]$/, "$1")
    .replace(/\|None/g, "")
    .replace(/None\|/g, "")
  return [
    "Decimal",
    "NonNegativeFloat",
    "NonNegativeInt",
    "PositiveFloat",
    "PositiveInt",
    "float",
    "int",
  ].includes(type)
}

function collectVariables(fields: ExtractedAimdFields): Map<string, AimdVarField> {
  const variables = new Map<string, AimdVarField>()
  for (const field of fields.var_definitions ?? []) variables.set(field.id, field)
  for (const table of fields.var_table ?? []) {
    for (const subvar of table.subvars ?? []) {
      variables.set(`${table.id}.${subvar.id}`, subvar)
    }
  }
  return variables
}

function resourceMetadata(field: AimdVarField): Partial<AimdResourceFieldContract> {
  const kwargs = field.kwargs ?? {}
  return Object.fromEntries(
    RESOURCE_METADATA_KEYS
      .filter(key => Object.prototype.hasOwnProperty.call(kwargs, key))
      .map(key => [key, kwargs[key]]),
  ) as Partial<AimdResourceFieldContract>
}

export function normalizeAimdProtocolKind(value: unknown): AimdProtocolKind {
  if (value === undefined || value === null || value === "") return "experiment"
  if (value !== "experiment" && value !== "resource_definition") {
    throw new Error('Protocol kind must be "experiment" or "resource_definition".')
  }
  return value
}

export function validateAimdProtocolKind(
  metadata: Record<string, unknown>,
  fields: Record<string, unknown> = {},
): string[] {
  let kind: AimdProtocolKind
  try {
    kind = normalizeAimdProtocolKind(metadata.kind)
  }
  catch (error) {
    return [error instanceof Error ? error.message : String(error)]
  }
  if (kind !== "resource_definition") return []
  return AIMD_RESOURCE_DEFINITION_FORBIDDEN_FIELDS
    .filter(fieldName => hasItems(fields[fieldName]))
    .map(fieldName => `Resource definition Protocols must not contain "${fieldName}" fields.`)
}

export function validateAimdResourceFields(
  fields: ExtractedAimdFields,
): AimdResourceValidationIssue[] {
  const variables = collectVariables(fields)
  const issues: AimdResourceValidationIssue[] = []
  for (const [fieldName, field] of variables) {
    const metadata = resourceMetadata(field)
    const metadataKeys = Object.keys(metadata)
    const resourceRef = isResourceRefType(field.type)
    if (metadataKeys.length > 0 && !resourceRef) {
      issues.push({
        code: "resource_metadata_requires_resource_ref",
        field: fieldName,
        message: `${fieldName} uses resource metadata but is not typed as ResourceRef`,
      })
      continue
    }
    if (!resourceRef) continue
    if (metadata.resource_role === undefined) {
      issues.push({
        code: "resource_role_required",
        field: fieldName,
        message: `${fieldName} must declare resource_role`,
      })
      continue
    }
    if (!["input", "output", "reference", "equipment"].includes(String(metadata.resource_role))) {
      issues.push({
        code: "invalid_resource_metadata",
        field: fieldName,
        message: `${fieldName} resource_role must be input, output, reference, or equipment`,
      })
      continue
    }
    for (const key of ["container_required", "booking_required"] as const) {
      if (metadata[key] !== undefined && typeof metadata[key] !== "boolean") {
        issues.push({
          code: "invalid_resource_metadata",
          field: fieldName,
          message: `${fieldName} ${key} must be a boolean`,
        })
      }
    }
    if (metadata.booking_required === true && metadata.resource_role !== "equipment") {
      issues.push({
        code: "booking_requires_equipment_role",
        field: fieldName,
        message: `${fieldName} can require a booking only when resource_role=equipment`,
      })
    }
    if (metadata.container_required === true && metadata.resource_role === "equipment") {
      issues.push({
        code: "equipment_cannot_require_container",
        field: fieldName,
        message: `${fieldName} cannot require an inventory container when resource_role=equipment`,
      })
    }
    if (metadata.quantity_field === undefined) continue
    if (typeof metadata.quantity_field !== "string" || !metadata.quantity_field.trim()) {
      issues.push({
        code: "invalid_resource_metadata",
        field: fieldName,
        message: `${fieldName} quantity_field must be a non-empty field path`,
      })
      continue
    }
    const quantityPath = metadata.quantity_field.trim().replace(/^var\./, "")
    const tablePrefix = fieldName.includes(".") ? fieldName.slice(0, fieldName.lastIndexOf(".")) : undefined
    const target = variables.get(quantityPath)
      ?? (tablePrefix ? variables.get(`${tablePrefix}.${quantityPath}`) : undefined)
    if (!target) {
      issues.push({
        code: "unknown_quantity_field",
        field: fieldName,
        message: `${fieldName} references unknown quantity_field ${metadata.quantity_field}`,
      })
    }
    else if (!isNumericType(target.type)) {
      issues.push({
        code: "quantity_field_must_be_numeric",
        field: fieldName,
        message: `${fieldName} quantity_field ${metadata.quantity_field} must use a numeric type`,
      })
    }
  }
  return issues
}

export function validateAimdProtocolContract(
  metadata: AimdProtocolMetadata,
  fields: ExtractedAimdFields,
): AimdResourceValidationIssue[] {
  const kindIssues = validateAimdProtocolKind(
    metadata,
    fields as unknown as Record<string, unknown>,
  ).map(message => ({
    code: "resource_definition_forbidden_feature",
    message,
  }))
  return [...kindIssues, ...validateAimdResourceFields(fields)]
}
