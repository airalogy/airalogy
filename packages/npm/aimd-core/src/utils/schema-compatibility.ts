export type AimdSchemaCompatibility = "compatible" | "conditional" | "breaking" | "unknown"
export type AimdSemverBump = "patch" | "minor" | "major"

export interface AimdSchemaChange {
  path: string
  kind: string
  classification: AimdSchemaCompatibility
  message: string
  before?: unknown
  after?: unknown
}

export interface AimdSchemaCompatibilityReport {
  status: AimdSchemaCompatibility
  recommended_bump: AimdSemverBump
  changes: AimdSchemaChange[]
}

const ANNOTATION_KEYS = ["$comment", "deprecated", "description", "examples", "title"] as const
const CONSTRAINT_KEYS = [
  "additionalProperties",
  "const",
  "default",
  "exclusiveMaximum",
  "exclusiveMinimum",
  "format",
  "maxItems",
  "maxLength",
  "maximum",
  "minItems",
  "minLength",
  "minimum",
  "multipleOf",
  "pattern",
] as const

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function properties(schema: Record<string, unknown>): Record<string, unknown> {
  return asObject(schema.properties)
}

function required(schema: Record<string, unknown>): Set<string> {
  return new Set(Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === "string") : [])
}

function typeSignature(value: unknown): unknown {
  const schema = asObject(value)
  if ("$ref" in schema) return ["$ref", schema.$ref]
  for (const key of ["anyOf", "oneOf"] as const) {
    if (Array.isArray(schema[key])) {
      return [key, schema[key].map(item => JSON.stringify(typeSignature(item))).sort()]
    }
  }
  return schema.type
}

function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function joinPath(prefix: string, suffix: string): string {
  return prefix ? `${prefix}.${suffix}` : suffix
}

function compareSchemaNode(
  previous: Record<string, unknown>,
  current: Record<string, unknown>,
  path: string,
  changes: AimdSchemaChange[],
): void {
  const beforeProperties = properties(previous)
  const afterProperties = properties(current)
  const beforeRequired = required(previous)
  const afterRequired = required(current)
  const beforeNames = new Set(Object.keys(beforeProperties))
  const afterNames = new Set(Object.keys(afterProperties))
  const displayPath = path || "$"

  const beforeType = typeSignature(previous)
  const afterType = typeSignature(current)
  if (!equal(beforeType, afterType)) {
    changes.push({
      path: joinPath(path, "type"),
      kind: "type_changed",
      classification: "breaking",
      message: `Schema at "${displayPath}" changed type.`,
      before: beforeType,
      after: afterType,
    })
  }

  if (Array.isArray(previous.enum) && Array.isArray(current.enum) && !equal(previous.enum, current.enum)) {
    const afterEnum = current.enum as unknown[]
    const removed = (previous.enum as unknown[]).filter(item =>
      !afterEnum.some(candidate => equal(candidate, item)),
    )
    changes.push({
      path: joinPath(path, "enum"),
      kind: removed.length ? "enum_narrowed" : "enum_expanded",
      classification: removed.length ? "breaking" : "compatible",
      message: removed.length
        ? `Schema at "${displayPath}" no longer accepts existing enum values.`
        : `Schema at "${displayPath}" accepts additional enum values.`,
      before: previous.enum,
      after: current.enum,
    })
  }

  for (const key of CONSTRAINT_KEYS) {
    if (!equal(previous[key], current[key])) {
      changes.push({
        path: joinPath(path, key),
        kind: "constraint_changed",
        classification: "conditional",
        message: `Constraint "${key}" changed at "${displayPath}"; existing values require validation.`,
        before: previous[key],
        after: current[key],
      })
    }
  }
  for (const key of ANNOTATION_KEYS) {
    if (!equal(previous[key], current[key])) {
      changes.push({
        path: joinPath(path, key),
        kind: "annotation_changed",
        classification: "compatible",
        message: `Annotation "${key}" changed at "${displayPath}".`,
        before: previous[key],
        after: current[key],
      })
    }
  }

  for (const field of [...beforeNames].filter(name => !afterNames.has(name)).sort()) {
    const fieldPath = joinPath(joinPath(path, "properties"), field)
    changes.push({
      path: fieldPath,
      kind: "field_removed",
      classification: "breaking",
      message: `Field "${fieldPath}" was removed.`,
      before: beforeProperties[field],
      after: undefined,
    })
  }

  for (const field of [...afterNames].filter(name => !beforeNames.has(name)).sort()) {
    const fieldPath = joinPath(joinPath(path, "properties"), field)
    const isRequired = afterRequired.has(field)
    const hasDefault = Object.prototype.hasOwnProperty.call(asObject(afterProperties[field]), "default")
    const classification: AimdSchemaCompatibility = isRequired
      ? hasDefault ? "conditional" : "breaking"
      : "compatible"
    changes.push({
      path: fieldPath,
      kind: "field_added",
      classification,
      message: classification === "breaking"
        ? `Required field "${fieldPath}" was added without a default.`
        : classification === "conditional"
          ? `Required field "${fieldPath}" was added with an explicit default.`
          : `Optional field "${fieldPath}" was added.`,
      before: undefined,
      after: afterProperties[field],
    })
  }

  for (const field of [...beforeNames].filter(name => afterNames.has(name)).sort()) {
    const beforeValue = beforeProperties[field]
    const afterValue = afterProperties[field]
    const fieldPath = joinPath(joinPath(path, "properties"), field)
    if (
      beforeValue && typeof beforeValue === "object" && !Array.isArray(beforeValue)
      && afterValue && typeof afterValue === "object" && !Array.isArray(afterValue)
    ) {
      compareSchemaNode(asObject(beforeValue), asObject(afterValue), fieldPath, changes)
    }
    else if (!equal(beforeValue, afterValue)) {
      changes.push({
        path: fieldPath,
        kind: "schema_changed",
        classification: "unknown",
        message: `Field "${fieldPath}" has an unsupported schema change.`,
        before: beforeValue,
        after: afterValue,
      })
    }
  }

  for (const field of [...afterRequired].filter(name => !beforeRequired.has(name) && beforeNames.has(name)).sort()) {
    const fieldPath = joinPath(joinPath(path, "required"), field)
    const hasDefault = Object.prototype.hasOwnProperty.call(asObject(afterProperties[field]), "default")
    changes.push({
      path: fieldPath,
      kind: "field_became_required",
      classification: hasDefault ? "conditional" : "breaking",
      message: `Existing field "${fieldPath}" became required.`,
      before: false,
      after: true,
    })
  }
  for (const field of [...beforeRequired].filter(name => !afterRequired.has(name) && afterNames.has(name)).sort()) {
    const fieldPath = joinPath(joinPath(path, "required"), field)
    changes.push({
      path: fieldPath,
      kind: "field_became_optional",
      classification: "compatible",
      message: `Existing field "${fieldPath}" became optional.`,
      before: true,
      after: false,
    })
  }

  if (
    previous.items && typeof previous.items === "object" && !Array.isArray(previous.items)
    && current.items && typeof current.items === "object" && !Array.isArray(current.items)
  ) {
    compareSchemaNode(
      asObject(previous.items),
      asObject(current.items),
      joinPath(path, "items"),
      changes,
    )
  }
  else if (!equal(previous.items, current.items)) {
    changes.push({
      path: joinPath(path, "items"),
      kind: "items_changed",
      classification: "unknown",
      message: `Array item Schema changed at "${displayPath}".`,
      before: previous.items,
      after: current.items,
    })
  }
}

export function compareAimdJsonSchemas(
  previous: Record<string, unknown>,
  current: Record<string, unknown>,
): AimdSchemaCompatibilityReport {
  const changes: AimdSchemaChange[] = []
  compareSchemaNode(previous, current, "", changes)

  const classifications = new Set(changes.map(change => change.classification))
  if (classifications.has("breaking")) return { status: "breaking", recommended_bump: "major", changes }
  if (classifications.has("unknown")) return { status: "unknown", recommended_bump: "major", changes }
  if (classifications.has("conditional")) return { status: "conditional", recommended_bump: "major", changes }
  const structural = changes.some(change => change.kind !== "annotation_changed")
  return { status: "compatible", recommended_bump: structural ? "minor" : "patch", changes }
}
