import type { AimdVarDefinition } from "../types/nodes"
import builtInTypeMetadata from "../types/airalogy-built-in-type-metadata.generated.json"

export interface AimdBuiltInTypeMetadata {
  type_name: string
  import_from: string
  aliases?: string[]
  storage_kind?: string
  ui_kind?: string
  type?: string
  title?: string
  description?: string
  enum?: unknown[]
  schema_extra?: Record<string, unknown>
}

interface AimdBuiltInTypeMetadataRegistry {
  version: number
  types: Record<string, AimdBuiltInTypeMetadata>
}

export interface AimdResolvedFieldMetadata {
  title?: string
  description?: string
  examples: unknown[]
}

const officialTypeMetadata = builtInTypeMetadata as AimdBuiltInTypeMetadataRegistry
const officialTypeMetadataByLookupName = Object.fromEntries(
  Object.values(officialTypeMetadata.types).flatMap(metadata => [
    [metadata.type_name, metadata],
    ...(metadata.aliases ?? []).map(alias => [alias, metadata] as const),
  ]),
) as Record<string, AimdBuiltInTypeMetadata>
const noneTypeNames = new Set(["None", "none", "null", "Null", "undefined"])

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function normalizeExamples(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.filter(item => item !== undefined && item !== null)
  }
  if (value === undefined || value === null || value === "") {
    return []
  }
  return [value]
}

function isSupportedEnumValue(value: unknown): boolean {
  return typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
    || value === null
}

function normalizeEnumValues(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(isSupportedEnumValue)
}

function normalizeTypeToken(value: string): string | undefined {
  const token = value.trim()
  if (!/^(?:(?:typing|typing_extensions|airalogy\.types)\.)?[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
    return undefined
  }
  const parts = token.split(".")
  return parts[parts.length - 1]
}

function splitTopLevelTypeUnion(annotation: string): string[] {
  const parts: string[] = []
  let current = ""
  let bracketDepth = 0

  for (const char of annotation) {
    if (char === "[") {
      bracketDepth += 1
      current += char
      continue
    }
    if (char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1)
      current += char
      continue
    }
    if (char === "|" && bracketDepth === 0) {
      const trimmed = current.trim()
      if (trimmed) {
        parts.push(trimmed)
      }
      current = ""
      continue
    }
    current += char
  }

  const trimmed = current.trim()
  if (trimmed) {
    parts.push(trimmed)
  }

  return parts
}

function unwrapOptionalTypeAnnotation(annotation: string): string {
  const optionalMatch = annotation
    .trim()
    .match(/^(?:(?:typing|typing_extensions)\.)?Optional\s*\[([\s\S]+)\]$/)
  return optionalMatch ? optionalMatch[1].trim() : annotation.trim()
}

function resolveSingleNamedType(annotation?: string): string | undefined {
  if (!annotation) {
    return undefined
  }

  const unwrapped = unwrapOptionalTypeAnnotation(annotation)
  const unionParts = splitTopLevelTypeUnion(unwrapped)
  const candidates = (unionParts.length > 0 ? unionParts : [unwrapped])
    .map(normalizeTypeToken)
    .filter((token): token is string => typeof token === "string" && !noneTypeNames.has(token))

  return candidates.length === 1 ? candidates[0] : undefined
}

export function getAimdBuiltInTypeMetadata(typeAnnotation?: string): AimdBuiltInTypeMetadata | undefined {
  const typeName = resolveSingleNamedType(typeAnnotation)
  return typeName ? officialTypeMetadataByLookupName[typeName] : undefined
}

export function getAimdBuiltInTypeEnumValues(typeAnnotation?: string): unknown[] {
  return normalizeEnumValues(getAimdBuiltInTypeMetadata(typeAnnotation)?.enum)
}

export function getAimdFieldTitle(definition?: Pick<AimdVarDefinition, "kwargs">): string | undefined {
  return normalizeString(definition?.kwargs?.title)
}

export function getAimdFieldDescription(definition?: Pick<AimdVarDefinition, "kwargs">): string | undefined {
  return normalizeString(definition?.kwargs?.description)
}

export function getAimdFieldExamples(definition?: Pick<AimdVarDefinition, "kwargs">): unknown[] {
  const kwargs = definition?.kwargs
  if (!kwargs) {
    return []
  }

  const pluralExamples = normalizeExamples(kwargs.examples)
  if (pluralExamples.length > 0) {
    return pluralExamples
  }

  return normalizeExamples(kwargs.example)
}

export function getAimdFieldEnumValues(definition?: Pick<AimdVarDefinition, "enum" | "kwargs" | "type">): unknown[] {
  const parsedEnum = normalizeEnumValues(definition?.enum)
  if (parsedEnum.length > 0) {
    return parsedEnum
  }
  const explicitEnum = normalizeEnumValues(definition?.kwargs?.enum)
  if (explicitEnum.length > 0) {
    return explicitEnum
  }
  return getAimdBuiltInTypeEnumValues(definition?.type)
}

export function resolveAimdFieldMetadata(definition?: Pick<AimdVarDefinition, "kwargs">): AimdResolvedFieldMetadata {
  return {
    title: getAimdFieldTitle(definition),
    description: getAimdFieldDescription(definition),
    examples: getAimdFieldExamples(definition),
  }
}

export function getAimdFieldDisplayLabel(id: string, definition?: Pick<AimdVarDefinition, "kwargs">): string {
  return getAimdFieldTitle(definition) ?? id
}

export function formatAimdExampleValue(value: unknown): string {
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value)
  }
  if (value === null) {
    return "null"
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function formatAimdExamples(examples: unknown[]): string | undefined {
  const formatted = examples
    .map(formatAimdExampleValue)
    .map(value => value.trim())
    .filter(Boolean)

  return formatted.length > 0 ? formatted.join(", ") : undefined
}
