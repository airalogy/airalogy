import type { AimdClientAssignerField } from "../types/aimd"

export type AimdAssignerGraphRuntime = "client" | "server"

export interface AimdAssignerGraphNode {
  id: string
  runtime: AimdAssignerGraphRuntime
  mode: string
  dependent_fields: string[]
  assigned_fields: string[]
}

function splitTopLevelSegments(source: string, delimiter: string): string[] {
  const segments: string[] = []
  let current = ""
  let quote: string | null = null
  let depthParen = 0
  let depthBracket = 0
  let depthBrace = 0

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    const prev = index > 0 ? source[index - 1] : ""

    if (quote) {
      current += char
      if (char === quote && prev !== "\\") {
        quote = null
      }
      continue
    }

    if (char === `"` || char === `'`) {
      quote = char
      current += char
      continue
    }

    if (char === "(") {
      depthParen += 1
      current += char
      continue
    }
    if (char === ")") {
      depthParen = Math.max(0, depthParen - 1)
      current += char
      continue
    }
    if (char === "[") {
      depthBracket += 1
      current += char
      continue
    }
    if (char === "]") {
      depthBracket = Math.max(0, depthBracket - 1)
      current += char
      continue
    }
    if (char === "{") {
      depthBrace += 1
      current += char
      continue
    }
    if (char === "}") {
      depthBrace = Math.max(0, depthBrace - 1)
      current += char
      continue
    }

    if (
      char === delimiter
      && depthParen === 0
      && depthBracket === 0
      && depthBrace === 0
    ) {
      const trimmed = current.trim()
      if (trimmed) {
        segments.push(trimmed)
      }
      current = ""
      continue
    }

    current += char
  }

  const trimmed = current.trim()
  if (trimmed) {
    segments.push(trimmed)
  }

  return segments
}

function findMatchingDelimiter(source: string, startIndex: number, openChar: string, closeChar: string): number {
  let quote: string | null = null
  let depth = 0

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index]
    const prev = index > 0 ? source[index - 1] : ""

    if (quote) {
      if (char === quote && prev !== "\\") {
        quote = null
      }
      continue
    }

    if (char === `"` || char === `'`) {
      quote = char
      continue
    }

    if (char === openChar) {
      depth += 1
      continue
    }

    if (char === closeChar) {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }

  return -1
}

function splitKeywordAssignment(segment: string): [string, string] | null {
  let quote: string | null = null
  let depthParen = 0
  let depthBracket = 0
  let depthBrace = 0

  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index]
    const prev = index > 0 ? segment[index - 1] : ""

    if (quote) {
      if (char === quote && prev !== "\\") {
        quote = null
      }
      continue
    }

    if (char === `"` || char === `'`) {
      quote = char
      continue
    }

    if (char === "(") {
      depthParen += 1
      continue
    }
    if (char === ")") {
      depthParen = Math.max(0, depthParen - 1)
      continue
    }
    if (char === "[") {
      depthBracket += 1
      continue
    }
    if (char === "]") {
      depthBracket = Math.max(0, depthBracket - 1)
      continue
    }
    if (char === "{") {
      depthBrace += 1
      continue
    }
    if (char === "}") {
      depthBrace = Math.max(0, depthBrace - 1)
      continue
    }

    if (char === "=" && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      return [segment.slice(0, index).trim(), segment.slice(index + 1).trim()]
    }
  }

  return null
}

function parsePythonStringLiteral(source: string, context: string): string {
  const trimmed = source.trim()
  if (trimmed.length < 2) {
    throw new Error(`${context} must be a quoted Python string`)
  }

  const quote = trimmed[0]
  if ((quote !== `"` && quote !== `'`) || trimmed[trimmed.length - 1] !== quote) {
    throw new Error(`${context} must be a quoted Python string`)
  }

  return trimmed.slice(1, -1)
}

function parsePythonStringList(source: string, context: string): string[] {
  const trimmed = source.trim()
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    throw new Error(`${context} must be a Python list of quoted field ids`)
  }

  const inner = trimmed.slice(1, -1).trim()
  if (!inner) {
    return []
  }

  const items = splitTopLevelSegments(inner, ",")
  return items.map((item) => {
    const value = parsePythonStringLiteral(item, context).trim()
    if (!value) {
      throw new Error(`${context} must not contain empty field ids`)
    }
    return value
  })
}

function parseDecoratorKeywordArgs(source: string): Record<string, string> {
  const keywordArgs: Record<string, string> = {}
  for (const segment of splitTopLevelSegments(source, ",")) {
    const assignment = splitKeywordAssignment(segment)
    if (!assignment) {
      continue
    }
    const [key, value] = assignment
    if (key) {
      keywordArgs[key] = value
    }
  }
  return keywordArgs
}

function buildNodeKey(assigner: AimdAssignerGraphNode): string {
  return `${assigner.runtime}:${assigner.id}`
}

export function validateAssignerGraph(assigners: AimdAssignerGraphNode[]): void {
  const assignerKeys = new Set<string>()
  const assignedFieldOwners = new Map<string, AimdAssignerGraphNode>()

  for (const assigner of assigners) {
    const assignerKey = buildNodeKey(assigner)
    if (assignerKeys.has(assignerKey)) {
      throw new Error(`duplicate ${assigner.runtime} assigner id: ${assigner.id}`)
    }
    assignerKeys.add(assignerKey)

    for (const field of assigner.assigned_fields) {
      const existingOwner = assignedFieldOwners.get(field)
      if (existingOwner) {
        throw new Error(
          `assigned field "${field}" is already handled by ${existingOwner.runtime} assigner "${existingOwner.id}"`,
        )
      }
      assignedFieldOwners.set(field, assigner)
    }
  }

  const dependencyGraph = new Map<string, Set<string>>()
  for (const assigner of assigners) {
    const assignerKey = buildNodeKey(assigner)
    const dependencies = new Set<string>()

    for (const field of assigner.dependent_fields) {
      const upstreamOwner = assignedFieldOwners.get(field)
      if (upstreamOwner && buildNodeKey(upstreamOwner) !== assignerKey) {
        dependencies.add(buildNodeKey(upstreamOwner))
      }
    }

    dependencyGraph.set(assignerKey, dependencies)
  }

  const assignerByKey = new Map(assigners.map(assigner => [buildNodeKey(assigner), assigner]))
  const visiting = new Set<string>()
  const visited = new Set<string>()

  function dfs(assignerKey: string, trail: string[]): void {
    if (visited.has(assignerKey)) {
      return
    }
    if (visiting.has(assignerKey)) {
      const cycleStart = trail.indexOf(assignerKey)
      const cyclePath = [...trail.slice(cycleStart), assignerKey]
        .map((key) => {
          const assigner = assignerByKey.get(key)
          return assigner ? `${assigner.runtime}:${assigner.id}` : key
        })
      throw new Error(`circular assigner dependency detected: ${cyclePath.join(" -> ")}`)
    }

    visiting.add(assignerKey)
    const nextTrail = [...trail, assignerKey]
    for (const dependency of dependencyGraph.get(assignerKey) ?? []) {
      dfs(dependency, nextTrail)
    }
    visiting.delete(assignerKey)
    visited.add(assignerKey)
  }

  for (const assigner of assigners) {
    dfs(buildNodeKey(assigner), [])
  }
}

export function validateClientAssigners(assigners: AimdClientAssignerField[]): void {
  validateAssignerGraph(assigners)
}

export function extractPythonAssignerGraphNodes(code: string): AimdAssignerGraphNode[] {
  const nodes: AimdAssignerGraphNode[] = []
  const decoratorPattern = /@(?:(?:[A-Za-z_][A-Za-z0-9_]*)\.)*assigner\s*\(/g

  let match: RegExpExecArray | null = decoratorPattern.exec(code)
  while (match !== null) {
    const openParenIndex = code.indexOf("(", match.index)
    const closeParenIndex = findMatchingDelimiter(code, openParenIndex, "(", ")")
    if (closeParenIndex === -1) {
      throw new Error("server assigner decorator is missing a closing ')'")
    }

    const decoratorArgs = code.slice(openParenIndex + 1, closeParenIndex)
    const remainder = code.slice(closeParenIndex + 1)
    const functionMatch = /^\s*(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/m.exec(remainder)
    if (!functionMatch) {
      throw new Error("server assigner decorator must be followed by a function definition")
    }

    const keywordArgs = parseDecoratorKeywordArgs(decoratorArgs)
    const id = functionMatch[1]
    const assigned_fields = parsePythonStringList(
      keywordArgs.assigned_fields ?? "[]",
      `server assigner "${id}" assigned_fields`,
    )
    const dependent_fields = parsePythonStringList(
      keywordArgs.dependent_fields ?? "[]",
      `server assigner "${id}" dependent_fields`,
    )
    const mode = keywordArgs.mode
      ? parsePythonStringLiteral(keywordArgs.mode, `server assigner "${id}" mode`)
      : "auto_first"

    if (assigned_fields.length === 0) {
      throw new Error(`server assigner "${id}" must define at least one assigned field`)
    }
    if (dependent_fields.length === 0 && mode !== "manual" && mode !== "manual_readonly") {
      throw new Error(`server assigner "${id}" must define at least one dependent field`)
    }

    nodes.push({
      id,
      runtime: "server",
      mode,
      dependent_fields,
      assigned_fields,
    })

    decoratorPattern.lastIndex = closeParenIndex + 1
    match = decoratorPattern.exec(code)
  }

  return nodes
}
