import type { AimdClientAssignerField } from "../types/aimd"
import type { AimdStepNode, AimdStepTimerMode, AimdVarDefinition } from "../types/nodes"
export { validateClientAssigners } from "./assigner-graph"
import { parseClientAssignerContent as parseClientAssignerContentImpl } from "./client-assigner-syntax"

/**
 * Step context for building hierarchy.
 */
export interface StepContext {
  /** Steps organized by level */
  byLevel: Map<number, AimdStepNode[]>
  /** Steps indexed by id */
  byId: Map<string, AimdStepNode>
  /** All steps in order */
  allSteps: AimdStepNode[]
}

/**
 * Create initial step context.
 */
export function createStepContext(): StepContext {
  return {
    byLevel: new Map(),
    byId: new Map(),
    allSteps: [],
  }
}

/**
 * Parse key-value parameters from content.
 * Handles formats like: key=value, key="value", key='value'
 */
export function parseKeyValueParams(content: string): Record<string, string | boolean | number> {
  const params: Record<string, string | boolean | number> = {}
  // Match key=value, key="value" (with escaped quotes), key='value', or key=r"value"
  const kvPattern = /(\w+)\s*=\s*(?:r?"((?:[^"\\]|\\.)*)"|r?'((?:[^'\\]|\\.)*)'|(\S+?)(?=,|$|\s))/g
  let match: RegExpExecArray | null = kvPattern.exec(content)

  while (match !== null) {
    const key = match[1]
    let value = match[2] ?? match[3] ?? match[4]

    // Remove Python raw string prefix if present.
    if (value && typeof value === "string") {
      if (match[4] && match[4].startsWith("r\"")) {
        value = match[4].slice(2, -1)
      }
      else if (match[4] && match[4].startsWith("r'")) {
        value = match[4].slice(2, -1)
      }
      // Unescape escaped quotes within quoted strings
      if (match[2] !== undefined) {
        value = value.replace(/\\"/g, "\"")
      } else if (match[3] !== undefined) {
        value = value.replace(/\\'/g, "'")
      }
    }

    if (value === "True" || value === "true") {
      params[key] = true
    }
    else if (value === "False" || value === "false") {
      params[key] = false
    }
    else if (/^-?\d+$/.test(value)) {
      params[key] = Number.parseInt(value, 10)
    }
    else if (/^-?\d+\.\d+$/.test(value)) {
      params[key] = Number.parseFloat(value)
    }
    else {
      params[key] = value
    }
    match = kvPattern.exec(content)
  }

  return params
}

function splitTopLevelCommaSegments(content: string): string[] {
  const parts: string[] = []
  let current = ""
  let quote: "\"" | "'" | null = null
  let escaped = false
  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0

  for (const char of content) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (quote) {
      current += char
      if (char === "\\") {
        escaped = true
      }
      else if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === "\"" || char === "'") {
      quote = char
      current += char
      continue
    }

    if (char === "(") {
      parenDepth += 1
      current += char
      continue
    }
    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1)
      current += char
      continue
    }
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
    if (char === "{") {
      braceDepth += 1
      current += char
      continue
    }
    if (char === "}") {
      braceDepth = Math.max(0, braceDepth - 1)
      current += char
      continue
    }

    if (char === "," && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
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

function findMatchingBracketIndex(content: string, openIndex: number): number {
  let quote: "\"" | "'" | null = null
  let escaped = false
  let depth = 0

  for (let index = openIndex; index < content.length; index += 1) {
    const char = content[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (quote) {
      if (char === "\\") {
        escaped = true
      }
      else if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === "\"" || char === "'") {
      quote = char
      continue
    }

    if (char === "[") {
      depth += 1
      continue
    }

    if (char === "]") {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }

  return -1
}

/**
 * Parse fenced-code meta into a flat key/value object.
 * Supports `runtime=client` and quoted values.
 */
export function parseFenceMeta(meta: string | null | undefined): Record<string, string | boolean | number> {
  if (!meta || !meta.trim()) {
    return {}
  }

  const params: Record<string, string | boolean | number> = {}
  const kvPattern = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/g
  let match: RegExpExecArray | null = kvPattern.exec(meta)

  while (match !== null) {
    const key = match[1]
    const rawValue = match[2] ?? match[3] ?? match[4] ?? ""
    if (rawValue === "true" || rawValue === "True") {
      params[key] = true
    }
    else if (rawValue === "false" || rawValue === "False") {
      params[key] = false
    }
    else if (/^-?\d+$/.test(rawValue)) {
      params[key] = Number.parseInt(rawValue, 10)
    }
    else if (/^-?\d+\.\d+$/.test(rawValue)) {
      params[key] = Number.parseFloat(rawValue)
    }
    else {
      params[key] = rawValue
    }
    match = kvPattern.exec(meta)
  }

  return params
}

const DURATION_PART_PATTERN = /(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)/gi
const STEP_TIMER_MODES = new Set<AimdStepTimerMode>(["elapsed", "countdown", "both"])
const NUMERIC_VAR_TYPES = new Set(["int", "integer", "float", "number"])
export const NUMERIC_CONSTRAINT_KWARGS = ["gt", "ge", "lt", "le", "multiple_of"] as const

export function isNumericVarType(type: string | undefined): boolean {
  return type !== undefined && NUMERIC_VAR_TYPES.has(type.toLowerCase())
}

export function parseDurationToMs(value: unknown): number | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  DURATION_PART_PATTERN.lastIndex = 0

  let totalMs = 0
  let lastIndex = 0
  let matched = false
  let match: RegExpExecArray | null = DURATION_PART_PATTERN.exec(trimmed)

  while (match !== null) {
    if (trimmed.slice(lastIndex, match.index).trim()) {
      return undefined
    }

    matched = true
    const amount = Number.parseFloat(match[1])
    const unit = match[2].toLowerCase()
    const multiplier = unit === "d"
      ? 24 * 60 * 60 * 1000
      : unit === "h"
      ? 60 * 60 * 1000
      : unit === "m"
        ? 60 * 1000
        : unit === "s"
          ? 1000
          : 1

    totalMs += amount * multiplier
    lastIndex = match.index + match[0].length
    match = DURATION_PART_PATTERN.exec(trimmed)
  }

  if (!matched || trimmed.slice(lastIndex).trim()) {
    return undefined
  }

  return Math.round(totalMs)
}

function getEstimatedStepDurationMs(props: Record<string, string | boolean | number>): number | undefined {
  if ("duration" in props) {
    const parsed = parseDurationToMs(props.duration)
    if (parsed !== undefined) {
      return parsed
    }
  }

  return undefined
}

export function parseStepTimerMode(value: unknown): AimdStepTimerMode | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  if (!STEP_TIMER_MODES.has(normalized as AimdStepTimerMode)) {
    return undefined
  }

  return normalized as AimdStepTimerMode
}

/**
 * Parse step content according to AIMD spec.
 * Supports formats:
 * - "step_id"
 * - "step_id, 2" (level as second param)
 * - "step_id, 2, check=True"
 * - "step_id, 2, check=True, checked_message='message'"
 */
export function parseStepContent(content: string): {
  id: string
  level: number
  check: boolean
  title?: string
  subtitle?: string
  checked_message?: string
  estimated_duration_ms?: number
  timer_mode?: AimdStepTimerMode
  result?: boolean
  props: Record<string, string | boolean | number>
} {
  const trimmed = content.trim()
  const parts = trimmed.split(/,\s*/)
  const id = parts[0].trim()
  let level = 1
  let check = false
  let title: string | undefined
  let subtitle: string | undefined
  let checked_message: string | undefined
  let result = false

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim()

    if (/^\d+$/.test(part)) {
      level = Number.parseInt(part, 10)
      continue
    }

    const kvParams = parseKeyValueParams(part)
    if ("check" in kvParams) {
      check = Boolean(kvParams.check)
    }
    if ("title" in kvParams) {
      title = String(kvParams.title)
    }
    if ("subtitle" in kvParams) {
      subtitle = String(kvParams.subtitle)
    }
    if ("checked_message" in kvParams) {
      checked_message = String(kvParams.checked_message)
    }
    if ("result" in kvParams) {
      result = Boolean(kvParams.result)
    }
    if ("level" in kvParams) {
      level = Number(kvParams.level)
    }
  }

  level = Math.max(1, Math.min(3, level))

  const props = parseKeyValueParams(trimmed)
  const estimated_duration_ms = getEstimatedStepDurationMs(props)
  const timer_mode = parseStepTimerMode(props.timer)

  return { id, level, check, title, subtitle, checked_message, estimated_duration_ms, timer_mode, result, props }
}

/**
 * Parse checkpoint content according to AIMD spec.
 * Supports formats:
 * - "checkpoint_id"
 * - "checkpoint_id, checked_message='message'"
 */
export function parseCheckContent(content: string): {
  id: string
  checked_message?: string
  label: string
} {
  const trimmed = content.trim()
  const parts = trimmed.split(/,\s*/)
  const id = parts[0].trim()
  let checked_message: string | undefined

  for (let i = 1; i < parts.length; i++) {
    const kvParams = parseKeyValueParams(parts[i])
    if ("checked_message" in kvParams) {
      checked_message = String(kvParams.checked_message)
    }
  }

  return { id, checked_message, label: id }
}

/**
 * Parse a frontend-only assigner stored in a fenced
 * `assigner runtime=client` block using the canonical
 * `assigner(config, function ...)` syntax.
 */
export function parseClientAssignerContent(content: string): AimdClientAssignerField {
  return parseClientAssignerContentImpl(content)
}

/**
 * Calculate the final step indent (e.g., "1.2.3").
 */
function calculateStepIndent(step: AimdStepNode, context: StepContext): string {
  const { sequence, level, parent_id } = step
  let indent = String(sequence + 1)

  if (level === 1) {
    return indent
  }

  let currentParentId = parent_id
  while (currentParentId) {
    const parent = context.byId.get(currentParentId)
    if (parent) {
      indent = `${parent.sequence + 1}.${indent}`
      currentParentId = parent.parent_id
    }
    else {
      break
    }
  }

  return indent
}

/**
 * Register a step node in the context and set up hierarchy.
 */
export function registerStep(node: AimdStepNode, context: StepContext): void {
  const { id, level } = node

  const internalLevel = level - 1

  context.byId.set(id, node)
  context.allSteps.push(node)

  if (!context.byLevel.has(internalLevel)) {
    context.byLevel.set(internalLevel, [])
  }
  const levelSteps = context.byLevel.get(internalLevel)!

  if (internalLevel > 0) {
    const parentLevel = context.byLevel.get(internalLevel - 1)
    if (parentLevel && parentLevel.length > 0) {
      const parent = parentLevel[parentLevel.length - 1]
      node.parent_id = parent.id
      parent.has_children = true
    }
  }

  const siblings = levelSteps.filter(s => s.parent_id === node.parent_id)
  if (siblings.length > 0) {
    const prevSibling = siblings[siblings.length - 1]
    node.prev_id = prevSibling.id
    node.sequence = prevSibling.sequence + 1
    prevSibling.next_id = id
  }
  else {
    node.sequence = 0
  }

  levelSteps.push(node)
  node.step = calculateStepIndent(node, context)
}

/**
 * Parse variable type definition syntax according to AIMD spec.
 */
export function parseVarDefinition(content: string): AimdVarDefinition {
  const trimmed = content.trim()

  const subvarsStart = trimmed.indexOf("subvars")
  let subvarsContent: string | undefined
  let subvarDefs: Record<string, AimdVarDefinition> | undefined

  if (subvarsStart !== -1) {
    const openBracketIndex = trimmed.indexOf("[", subvarsStart)
    if (openBracketIndex !== -1) {
      const closeBracketIndex = findMatchingBracketIndex(trimmed, openBracketIndex)
      if (closeBracketIndex !== -1) {
        subvarsContent = trimmed.slice(openBracketIndex + 1, closeBracketIndex)
      }
    }
  }

  if (subvarsContent) {
    const subvarParts = splitTopLevelCommaSegments(subvarsContent)
    subvarDefs = {}

    for (const part of subvarParts) {
      if (/^var\s*\(/.test(part) || /^[A-Za-z_]\w*\s*[:=]/.test(part)) {
        const subDef = parseSimpleVarDef(part)
        subvarDefs[subDef.id] = subDef
      }
      else {
        subvarDefs[part] = { id: part }
      }
    }
  }

  const contentWithoutSubvars = splitTopLevelCommaSegments(trimmed)
    .filter(part => !/^subvars\s*=/.test(part))
    .join(", ")

  const def = parseSimpleVarDef(contentWithoutSubvars)

  return subvarDefs
    ? {
        ...def,
        subvars: subvarDefs,
      }
    : def
}

/**
 * Parse simple var definition: name, name: type, name: type = default.
 */
function parseSimpleVarDef(content: string): AimdVarDefinition {
  let trimmed = content.trim()

  if (trimmed.startsWith("var(") && trimmed.endsWith(")")) {
    trimmed = trimmed.slice(4, -1).trim()
  }
  else if (trimmed.startsWith("var (") && trimmed.endsWith(")")) {
    trimmed = trimmed.slice(5, -1).trim()
  }

  const parts = splitTopLevelCommaSegments(trimmed)
  const mainPart = (parts[0] || "").trim()
  const kvParts = parts.slice(1).filter(part => /^\w+\s*=/.test(part))
  const kvParams = parseKeyValueParams(kvParts.join(", "))

  if (!mainPart.includes(":")) {
    const eqIndex = mainPart.indexOf("=")
    if (eqIndex > 0) {
      const defaultRaw = mainPart.slice(eqIndex + 1).trim()
      const result: AimdVarDefinition = {
        id: mainPart.slice(0, eqIndex).trim(),
        default: parseDefaultValue(defaultRaw),
        defaultRaw,
      }
      if (Object.keys(kvParams).length > 0) {
        result.kwargs = kvParams
      }
      return result
    }
    const result: AimdVarDefinition = { id: mainPart.split(/\s/)[0].trim() }
    if (Object.keys(kvParams).length > 0) {
      result.kwargs = kvParams
    }
    return result
  }

  const colonIndex = mainPart.indexOf(":")
  const id = mainPart.slice(0, colonIndex).trim()
  const rest = mainPart.slice(colonIndex + 1).trim()

  const eqIndex = rest.indexOf("=")
  let type: string
  let defaultValue: string | number | boolean | null | undefined
  let defaultRaw: string | undefined

  if (eqIndex > 0) {
    type = rest.slice(0, eqIndex).trim()
    defaultRaw = rest.slice(eqIndex + 1).trim()
    defaultValue = parseDefaultValue(defaultRaw)
  }
  else {
    type = rest.trim()
  }

  const result: AimdVarDefinition = { id, type }

  if (defaultValue !== undefined) {
    result.default = defaultValue
    result.defaultRaw = defaultRaw
  }

  if (Object.keys(kvParams).length > 0) {
    result.kwargs = kvParams
  }

  return result
}

/**
 * Parse default value.
 */
function parseDefaultValue(value: string): string | number | boolean | null {
  const trimmed = value.trim()

  if (trimmed === "true" || trimmed === "True")
    return true
  if (trimmed === "false" || trimmed === "False")
    return false

  if (trimmed === "null" || trimmed === "None")
    return null

  if (/^-?\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10)
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return Number.parseFloat(trimmed)
  }

  if ((trimmed.startsWith("\"") && trimmed.endsWith("\""))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

/**
 * Validate that a variable's default value matches its declared type.
 * Returns an array of warning messages (empty if valid).
 * This is non-breaking — it collects warnings rather than throwing.
 */
export function validateVarDefaultType(def: AimdVarDefinition): string[] {
  if (def.type === undefined || def.default === undefined || def.default === null) {
    return []
  }

  const warnings: string[] = []
  const type = def.type.toLowerCase()
  const value = def.default

  switch (type) {
    case "int":
    case "integer":
      if (typeof value === "number") {
        if (!Number.isInteger(value)) {
          warnings.push(`"${def.id}": default ${value} is not an integer`)
        }
      } else if (typeof value === "string") {
        if (!/^-?\d+$/.test(value)) {
          warnings.push(`"${def.id}": default "${value}" is not a valid integer`)
        }
      } else if (typeof value === "boolean") {
        warnings.push(`"${def.id}": default is boolean, expected integer`)
      }
      break

    case "float":
    case "number":
      if (typeof value === "string") {
        if (Number.isNaN(Number(value))) {
          warnings.push(`"${def.id}": default "${value}" is not a valid number`)
        }
      } else if (typeof value === "boolean") {
        warnings.push(`"${def.id}": default is boolean, expected float`)
      }
      break

    case "bool":
    case "boolean":
      if (typeof value !== "boolean") {
        if (typeof value === "number" && (value === 0 || value === 1)) {
          // 0 and 1 are acceptable as bool defaults
        } else {
          warnings.push(`"${def.id}": default ${JSON.stringify(value)} is not a valid boolean`)
        }
      }
      break

    case "str":
    case "string":
    case "text":
      if (typeof value !== "string") {
        warnings.push(`"${def.id}": default ${JSON.stringify(value)} is not a string`)
      }
      break

    case "date":
      if (typeof value === "string") {
        if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
          warnings.push(`"${def.id}": default "${value}" does not match ISO date format`)
        }
      } else {
        warnings.push(`"${def.id}": default ${JSON.stringify(value)} is not a valid date string`)
      }
      break
  }

  return warnings
}

/**
 * Validate Pydantic-style var kwargs that AIMD understands.
 * Numeric constraints are only meaningful for numeric AIMD variable types.
 */
export function validateVarKwargs(def: AimdVarDefinition): string[] {
  const warnings: string[] = []
  const kwargs = def.kwargs
  const type = def.type?.toLowerCase()

  if (kwargs) {
    const numericConstraintKeys = NUMERIC_CONSTRAINT_KWARGS.filter(key =>
      Object.prototype.hasOwnProperty.call(kwargs, key),
    )

    if (numericConstraintKeys.length > 0 && !isNumericVarType(type)) {
      const typeLabel = type ?? "untyped"
      warnings.push(
        `"${def.id}": numeric constraints (${numericConstraintKeys.join(", ")}) only apply to int/integer/float/number variables, not ${typeLabel}`,
      )
    }
    else if (numericConstraintKeys.length > 0) {
      for (const key of numericConstraintKeys) {
        const value = kwargs[key]
        if (typeof value !== "number" || Number.isNaN(value)) {
          warnings.push(`"${def.id}": numeric constraint "${key}" must be a number`)
        }
        else if (key === "multiple_of" && value <= 0) {
          warnings.push(`"${def.id}": numeric constraint "multiple_of" must be greater than 0`)
        }
      }
    }
  }

  if (def.subvars) {
    for (const subDef of Object.values(def.subvars)) {
      warnings.push(...validateVarKwargs(subDef))
    }
  }

  return warnings
}

function validateVarDefaultTypeDeep(def: AimdVarDefinition): string[] {
  const warnings = validateVarDefaultType(def)

  if (def.subvars) {
    for (const subDef of Object.values(def.subvars)) {
      warnings.push(...validateVarDefaultTypeDeep(subDef))
    }
  }

  return warnings
}

/**
 * Validate a parsed var definition and nested subvars without throwing.
 */
export function validateVarDefinition(def: AimdVarDefinition): string[] {
  return [
    ...validateVarDefaultTypeDeep(def),
    ...validateVarKwargs(def),
  ]
}

/**
 * Parse fig code block content (YAML format).
 */
export function parseFigContent(content: string): {
  id: string
  src: string
  title?: string
  legend?: string
} {
  const lines = content.split("\n")
  const result: Record<string, string> = {}
  let currentKey: string | null = null
  let currentValue = ""
  let isMultiline = false

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (!trimmedLine && !isMultiline) {
      continue
    }

    const match = trimmedLine.match(/^(\w+):\s*(.*)$/)
    if (match) {
      if (currentKey) {
        result[currentKey] = currentValue.trim()
      }

      currentKey = match[1]
      const value = match[2]

      if (value === "|") {
        isMultiline = true
        currentValue = ""
      }
      else {
        isMultiline = false
        currentValue = value
      }
    }
    else if (currentKey && (isMultiline || trimmedLine)) {
      if (currentValue) {
        currentValue += `\n${line}`
      }
      else {
        currentValue = line
      }
    }
  }

  if (currentKey) {
    result[currentKey] = currentValue.trim()
  }

  if (!result.id || !result.src) {
    throw new Error("fig block must have \"id\" and \"src\" fields")
  }

  return {
    id: result.id,
    src: result.src,
    title: result.title,
    legend: result.legend,
  }
}

/**
 * Parse table column definition (for var_table).
 */
export function parseTableColumns(content: string): {
  id: string
  columns: string[]
  definition?: AimdVarDefinition
} {
  if (content.includes("subvars")) {
    const def = parseVarDefinition(content)
    const raw = def.subvars
    const columns = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.keys(raw) : [])
    return {
      id: def.id,
      columns,
      definition: def,
    }
  }

  const parenMatch = content.match(/^(\w+)\s*\(([^)]+)\)/)
  if (parenMatch) {
    return {
      id: parenMatch[1],
      columns: parenMatch[2].split(",").map(s => s.trim()).filter(Boolean),
    }
  }

  const def = parseVarDefinition(content)
  return {
    id: def.id,
    columns: [],
    definition: def,
  }
}

/**
 * Determine if content represents a var_table (has subvars).
 */
export function isVarTable(content: string): boolean {
  return /subvars\s*=\s*\[/.test(content)
}
