import * as acorn from "acorn"
import type { AimdClientAssignerField, AimdClientAssignerMode } from "../types/aimd"

const CLIENT_ASSIGNER_SUPPORTED_MODES = new Set<AimdClientAssignerMode>(["auto", "auto_first", "manual"])

const CLIENT_ASSIGNER_FORBIDDEN_PATTERNS: Array<{ pattern: RegExp, message: string }> = [
  {
    pattern: /\b(?:import|export|class|new|async|await|yield|throw|try|catch|switch|while|for|do)\b/,
    message: "contains unsupported control-flow or module syntax",
  },
  {
    pattern: /=>/,
    message: "does not allow arrow functions",
  },
  {
    pattern: /\b(?:window|document|globalThis|self|fetch|XMLHttpRequest|WebSocket|Function|eval|setTimeout|setInterval)\b/,
    message: "uses blocked runtime globals",
  },
  {
    pattern: /\b(?:__proto__|prototype|constructor|this)\b/,
    message: "uses blocked object metaprogramming features",
  },
  {
    pattern: /\bMath\s*\.\s*random\b/,
    message: "must not use randomness",
  },
  {
    pattern: /\bDate\b/,
    message: "must not use time-dependent APIs",
  },
]

/**
 * AST node types that map to forbidden syntax constructs.
 * Keys are ESTree node types, values are the error messages.
 */
const FORBIDDEN_AST_NODE_MESSAGES: Record<string, string> = {
  ImportDeclaration: "contains unsupported control-flow or module syntax",
  ImportExpression: "contains unsupported control-flow or module syntax",
  ExportNamedDeclaration: "contains unsupported control-flow or module syntax",
  ExportDefaultDeclaration: "contains unsupported control-flow or module syntax",
  ExportAllDeclaration: "contains unsupported control-flow or module syntax",
  ClassDeclaration: "contains unsupported control-flow or module syntax",
  ClassExpression: "contains unsupported control-flow or module syntax",
  NewExpression: "contains unsupported control-flow or module syntax",
  ArrowFunctionExpression: "does not allow arrow functions",
  AwaitExpression: "contains unsupported control-flow or module syntax",
  YieldExpression: "contains unsupported control-flow or module syntax",
  ThrowStatement: "contains unsupported control-flow or module syntax",
  TryStatement: "contains unsupported control-flow or module syntax",
  SwitchStatement: "contains unsupported control-flow or module syntax",
  WhileStatement: "contains unsupported control-flow or module syntax",
  ForStatement: "contains unsupported control-flow or module syntax",
  ForInStatement: "contains unsupported control-flow or module syntax",
  ForOfStatement: "contains unsupported control-flow or module syntax",
  DoWhileStatement: "contains unsupported control-flow or module syntax",
}

const FORBIDDEN_GLOBAL_NAMES = new Set([
  "window", "document", "globalThis", "self",
  "fetch", "XMLHttpRequest", "WebSocket",
  "Function", "eval", "setTimeout", "setInterval",
])

const FORBIDDEN_META_NAMES = new Set([
  "__proto__", "prototype", "constructor",
])

function walkAstNode(node: any, visitor: (node: any) => void): void {
  if (!node || typeof node !== "object") return
  visitor(node)
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end") continue
    const value = node[key]
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child.type === "string") {
          walkAstNode(child, visitor)
        }
      }
    } else if (value && typeof value === "object" && typeof value.type === "string") {
      walkAstNode(value, visitor)
    }
  }
}

function checkForbiddenName(name: string, id: string): void {
  if (FORBIDDEN_GLOBAL_NAMES.has(name)) {
    throw new Error(`client assigner "${id}" uses blocked runtime globals`)
  }
  if (FORBIDDEN_META_NAMES.has(name)) {
    throw new Error(`client assigner "${id}" uses blocked object metaprogramming features`)
  }
  if (name === "Date") {
    throw new Error(`client assigner "${id}" must not use time-dependent APIs`)
  }
}

/**
 * AST-based validation of client assigner function source.
 * Catches Unicode escape bypasses (e.g. `e\u0076al`) that regex misses,
 * because acorn resolves escapes when building the AST.
 */
function validateFunctionSourceAst(functionSource: string, id: string): void {
  let ast: acorn.Node
  try {
    ast = acorn.parse(functionSource, {
      ecmaVersion: 2022,
      sourceType: "script",
    })
  } catch {
    throw new Error(`client assigner "${id}" contains invalid JavaScript syntax`)
  }

  let functionDeclCount = 0
  let hasReturn = false

  walkAstNode(ast, (node: any) => {
    const forbiddenMessage = FORBIDDEN_AST_NODE_MESSAGES[node.type]
    if (forbiddenMessage) {
      throw new Error(`client assigner "${id}" ${forbiddenMessage}`)
    }

    if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
      functionDeclCount++
      if (node.async) {
        throw new Error(`client assigner "${id}" contains unsupported control-flow or module syntax`)
      }
      if (node.generator) {
        throw new Error(`client assigner "${id}" contains unsupported control-flow or module syntax`)
      }
    }

    if (node.type === "ReturnStatement") {
      hasReturn = true
    }

    if (node.type === "ThisExpression") {
      throw new Error(`client assigner "${id}" uses blocked object metaprogramming features`)
    }

    // Identifier check — acorn resolves Unicode escapes, so e\u0076al → "eval"
    if (node.type === "Identifier") {
      checkForbiddenName(node.name, id)
    }

    // Computed member access with string literals: obj["eval"], obj["__proto__"]
    if (
      node.type === "MemberExpression"
      && node.computed
      && node.property?.type === "Literal"
      && typeof node.property.value === "string"
    ) {
      checkForbiddenName(node.property.value, id)
    }

    // Math.random
    if (
      node.type === "MemberExpression"
      && !node.computed
      && node.object?.type === "Identifier"
      && node.object.name === "Math"
      && node.property?.type === "Identifier"
      && node.property.name === "random"
    ) {
      throw new Error(`client assigner "${id}" must not use randomness`)
    }
  })

  if (functionDeclCount !== 1) {
    throw new Error(`client assigner "${id}" must contain exactly one function definition`)
  }

  if (!hasReturn) {
    throw new Error(`client assigner "${id}" must return an object containing assigned field values`)
  }
}

function normalizeIdentifierList(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`client assigner "${fieldName}" must be an array of field ids`)
  }

  const normalized = value
    .map(item => typeof item === "string" ? item.trim() : "")
    .filter(Boolean)

  if (normalized.length !== value.length) {
    throw new Error(`client assigner "${fieldName}" must contain only non-empty strings`)
  }

  return Array.from(new Set(normalized))
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

function splitTopLevelProperty(source: string, delimiter: ":" | "=" = ":"): [string, string] | null {
  let quote: string | null = null
  let depthParen = 0
  let depthBracket = 0
  let depthBrace = 0

  for (let index = 0; index < source.length; index += 1) {
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

    if (char === delimiter && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      return [source.slice(0, index).trim(), source.slice(index + 1).trim()]
    }
  }

  return null
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

function parseJsStringLiteral(expression: string, context: string): string {
  const trimmed = expression.trim()
  if (trimmed.length < 2) {
    throw new Error(`client assigner "${context}" must be a quoted string`)
  }

  const quote = trimmed[0]
  if ((quote !== `"` && quote !== `'`) || trimmed[trimmed.length - 1] !== quote) {
    throw new Error(`client assigner "${context}" must be a quoted string`)
  }

  return trimmed.slice(1, -1)
}

function parseJsStringArrayLiteral(expression: string, context: string): string[] {
  const trimmed = expression.trim()
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    throw new Error(`client assigner "${context}" must be an array of field ids`)
  }

  const inner = trimmed.slice(1, -1).trim()
  if (!inner) {
    return []
  }

  const values: string[] = []
  let index = 0

  while (index < inner.length) {
    while (index < inner.length && /[\s,]/.test(inner[index])) {
      index += 1
    }
    if (index >= inner.length) {
      break
    }

    const quote = inner[index]
    if (quote !== `"` && quote !== `'`) {
      throw new Error(`client assigner "${context}" must contain only quoted field ids`)
    }

    let value = ""
    let closed = false
    index += 1
    while (index < inner.length) {
      const char = inner[index]
      if (char === "\\") {
        const escaped = inner[index + 1]
        if (typeof escaped === "undefined") {
          throw new Error(`client assigner "${context}" contains an unterminated string`)
        }
        value += escaped
        index += 2
        continue
      }
      if (char === quote) {
        index += 1
        closed = true
        break
      }
      value += char
      index += 1
    }

    if (!closed) {
      throw new Error(`client assigner "${context}" contains an unterminated string`)
    }

    const normalized = value.trim()
    if (!normalized) {
      throw new Error(`client assigner "${context}" must not contain empty field ids`)
    }
    if (!values.includes(normalized)) {
      values.push(normalized)
    }

    while (index < inner.length && /\s/.test(inner[index])) {
      index += 1
    }
    if (index < inner.length && inner[index] === ",") {
      index += 1
    }
  }

  return normalizeIdentifierList(values, context)
}

function parseConfigObjectLiteral(source: string): Record<string, string> {
  const trimmed = source.trim()
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    throw new Error("client assigner config must be an object literal")
  }

  const body = trimmed.slice(1, -1).trim()
  if (!body) {
    throw new Error("client assigner config must not be empty")
  }

  const config: Record<string, string> = {}
  for (const segment of splitTopLevelSegments(body, ",")) {
    const property = splitTopLevelProperty(segment, ":")
    if (!property) {
      throw new Error("client assigner config entries must use key: value syntax")
    }

    const [rawKey, rawValue] = property
    const key = /^[A-Za-z_][A-Za-z0-9_]*$/.test(rawKey)
      ? rawKey
      : parseJsStringLiteral(rawKey, "config key")

    if (key in config) {
      throw new Error(`client assigner config defines "${key}" more than once`)
    }
    config[key] = rawValue
  }

  return config
}

function parseClientAssignerInvocation(content: string): { configSource: string, functionSource: string } {
  const trimmed = content.trim()
  const match = /^assigner\s*\(/.exec(trimmed)
  if (!match) {
    throw new Error("client assigner block must contain exactly one assigner(...) call")
  }

  const openParenIndex = trimmed.indexOf("(", match.index)
  const closeParenIndex = findMatchingDelimiter(trimmed, openParenIndex, "(", ")")
  if (closeParenIndex === -1) {
    throw new Error("client assigner call is missing a closing \")\"")
  }

  const trailing = trimmed.slice(closeParenIndex + 1).trim()
  if (trailing && trailing !== ";") {
    throw new Error("client assigner block must contain exactly one assigner(...) call")
  }

  const argsSource = trimmed.slice(openParenIndex + 1, closeParenIndex).trim()
  const args = splitTopLevelSegments(argsSource, ",")
  if (args.length !== 2) {
    throw new Error("client assigner call must receive exactly two arguments: config and function")
  }

  return {
    configSource: args[0],
    functionSource: args[1],
  }
}

interface ParsedClientAssignerFunction {
  id: string
  function_source: string
}

function parseClientAssignerFunction(source: string): ParsedClientAssignerFunction {
  const trimmed = source.trim()
  const match = /^function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(trimmed)
  if (!match) {
    throw new Error("client assigner second argument must be a named function")
  }

  const id = match[1]
  const openParenIndex = trimmed.indexOf("(", match.index)
  const closeParenIndex = findMatchingDelimiter(trimmed, openParenIndex, "(", ")")
  if (closeParenIndex === -1) {
    throw new Error(`client assigner "${id}" function parameters are missing a closing ")"`)
  }
  const paramsSource = trimmed.slice(openParenIndex + 1, closeParenIndex).trim()
  const params = paramsSource ? splitTopLevelSegments(paramsSource, ",") : []
  if (params.length !== 1) {
    throw new Error(`client assigner "${id}" function must accept exactly one dependent_fields parameter`)
  }

  let bodyStart = closeParenIndex + 1
  while (bodyStart < trimmed.length && /\s/.test(trimmed[bodyStart])) {
    bodyStart += 1
  }
  if (bodyStart >= trimmed.length || trimmed[bodyStart] !== "{") {
    throw new Error(`client assigner "${id}" function must be followed by a body`)
  }

  const bodyEnd = findMatchingDelimiter(trimmed, bodyStart, "{", "}")
  if (bodyEnd === -1) {
    throw new Error(`client assigner "${id}" function body is missing a closing "}"`)
  }

  const trailing = trimmed.slice(bodyEnd + 1).trim()
  if (trailing) {
    throw new Error(`client assigner "${id}" function must not contain trailing statements`)
  }

  return {
    id,
    function_source: trimmed,
  }
}

export function validateClientAssignerFunctionSource(functionSource: string, id: string): void {
  // Fast-path: regex checks for obvious violations with clear error messages
  const matches = functionSource.match(/\bfunction\b/g) ?? []
  if (matches.length !== 1) {
    throw new Error(`client assigner "${id}" must contain exactly one function definition`)
  }

  for (const { pattern, message } of CLIENT_ASSIGNER_FORBIDDEN_PATTERNS) {
    if (pattern.test(functionSource)) {
      throw new Error(`client assigner "${id}" ${message}`)
    }
  }

  if (!/\breturn\b/.test(functionSource)) {
    throw new Error(`client assigner "${id}" must return an object containing assigned field values`)
  }

  // Authoritative: AST-based validation catches Unicode escapes and other regex bypasses
  validateFunctionSourceAst(functionSource, id)
}

export function parseClientAssignerContent(content: string): AimdClientAssignerField {
  const { configSource, functionSource } = parseClientAssignerInvocation(content)
  const parsedFunction = parseClientAssignerFunction(functionSource)
  validateClientAssignerFunctionSource(parsedFunction.function_source, parsedFunction.id)

  const config = parseConfigObjectLiteral(configSource)
  const allowedConfigKeys = new Set(["mode", "dependent_fields", "assigned_fields"])
  for (const key of Object.keys(config)) {
    if (!allowedConfigKeys.has(key)) {
      throw new Error(`client assigner "${parsedFunction.id}" does not support config key "${key}"`)
    }
  }

  const modeRaw = parseJsStringLiteral(config.mode ?? "", `${parsedFunction.id}.mode`)
  if (!CLIENT_ASSIGNER_SUPPORTED_MODES.has(modeRaw as AimdClientAssignerMode)) {
    throw new Error(`client assigner "${parsedFunction.id}" only supports mode "auto", "auto_first", or "manual"`)
  }

  const assigned_fields = parseJsStringArrayLiteral(
    config.assigned_fields ?? "",
    `${parsedFunction.id}.assigned_fields`,
  )
  const dependent_fields = parseJsStringArrayLiteral(
    config.dependent_fields ?? "",
    `${parsedFunction.id}.dependent_fields`,
  )

  if (assigned_fields.length === 0) {
    throw new Error(`client assigner "${parsedFunction.id}" must define at least one assigned field`)
  }
  if (dependent_fields.length === 0 && modeRaw !== "manual") {
    throw new Error(`client assigner "${parsedFunction.id}" must define at least one dependent field`)
  }

  return {
    id: parsedFunction.id,
    runtime: "client",
    mode: modeRaw as AimdClientAssignerMode,
    dependent_fields,
    assigned_fields,
    function_source: parsedFunction.function_source,
  }
}
