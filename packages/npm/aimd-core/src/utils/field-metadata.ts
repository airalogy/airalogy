import type { AimdVarDefinition } from "../types/nodes"

export interface AimdResolvedFieldMetadata {
  title?: string
  description?: string
  examples: unknown[]
}

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

export function getAimdFieldEnumValues(definition?: Pick<AimdVarDefinition, "enum" | "kwargs">): unknown[] {
  const parsedEnum = normalizeEnumValues(definition?.enum)
  if (parsedEnum.length > 0) {
    return parsedEnum
  }
  return normalizeEnumValues(definition?.kwargs?.enum)
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
