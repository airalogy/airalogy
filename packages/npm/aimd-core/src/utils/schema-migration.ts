export type AimdMigrationOperation =
  | { op: "rename" | "copy"; from: string; to: string }
  | { op: "remove"; field: string }
  | { op: "set_default"; field: string; value: unknown }

export interface AimdMigrationManifest {
  version: "airalogy.migration.v1"
  from: string
  to: string
  operations?: AimdMigrationOperation[]
  transform?: {
    entrypoint: string
    /** SHA-256 of the packaged source file, verified before sandbox execution. */
    code_hash: string
  }
}

export interface AimdMigrationIssue {
  path: string
  message: string
}

export interface AimdMigrationResult {
  data: Record<string, unknown>
  status: "completed" | "needs_review" | "failed"
  issues: AimdMigrationIssue[]
  /** Stable SHA-256 hash when Web Crypto is available; otherwise canonical rules are returned. */
  canonicalRules: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
const FORBIDDEN_PATH_SEGMENTS = new Set(["__proto__", "constructor", "prototype"])

export function validateAimdMigrationManifest(value: unknown): AimdMigrationIssue[] {
  if (!isObject(value)) return [{ path: "", message: "migration manifest must be an object" }]
  const issues: AimdMigrationIssue[] = []
  if (value.version !== "airalogy.migration.v1") {
    issues.push({ path: "version", message: 'version must be "airalogy.migration.v1"' })
  }
  for (const key of ["from", "to"] as const) {
    if (typeof value[key] !== "string" || !SEMVER_PATTERN.test(value[key].trim())) {
      issues.push({ path: key, message: `${key} must be a semantic version` })
    }
  }
  const operations = value.operations ?? []
  if (!Array.isArray(operations)) {
    issues.push({ path: "operations", message: "operations must be a list" })
    return issues
  }
  operations.forEach((operation, index) => {
    const path = `operations.${index}`
    if (!isObject(operation)) {
      issues.push({ path, message: "operation must be an object" })
      return
    }
    if (!["rename", "copy", "remove", "set_default"].includes(String(operation.op))) {
      issues.push({ path: `${path}.op`, message: `unsupported migration operation: ${String(operation.op)}` })
      return
    }
    const requiredKeys = operation.op === "rename" || operation.op === "copy" ? ["from", "to"] : ["field"]
    for (const key of requiredKeys) {
      if (typeof operation[key] !== "string" || !(operation[key] as string).trim()) {
        issues.push({ path: `${path}.${key}`, message: `${key} must be a field path` })
      }
      else if ((operation[key] as string).split(".").some(segment => FORBIDDEN_PATH_SEGMENTS.has(segment))) {
        issues.push({ path: `${path}.${key}`, message: `${key} contains a forbidden field path segment` })
      }
    }
    if (operation.op === "set_default" && !Object.prototype.hasOwnProperty.call(operation, "value")) {
      issues.push({ path: `${path}.value`, message: "set_default requires value" })
    }
  })
  if (value.transform !== undefined) {
    if (!isObject(value.transform)) {
      issues.push({ path: "transform", message: "transform must be an object" })
    }
    else {
      const entrypoint = value.transform.entrypoint
      if (typeof entrypoint !== "string" || !entrypoint.includes(":")) {
        issues.push({
          path: "transform.entrypoint",
          message: "entrypoint must use a package-relative path and function name",
        })
      }
      else if (entrypoint.startsWith("/") || entrypoint.split(":", 1)[0].split("/").includes("..")) {
        issues.push({ path: "transform.entrypoint", message: "entrypoint must stay inside the Protocol package" })
      }
      else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(entrypoint.slice(entrypoint.lastIndexOf(":") + 1))) {
        issues.push({ path: "transform.entrypoint", message: "entrypoint function name must be a Python identifier" })
      }
      if (typeof value.transform.code_hash !== "string" || !/^[a-fA-F0-9]{64}$/.test(value.transform.code_hash)) {
        issues.push({
          path: "transform.code_hash",
          message: "code_hash must be the 64-character SHA-256 of the packaged function",
        })
      }
    }
  }
  return issues
}

export async function hashAimdMigrationManifest(
  manifest: AimdMigrationManifest,
): Promise<string> {
  const canonical = JSON.stringify(stable(manifest))
  const runtimeCrypto = (globalThis as unknown as {
    crypto?: {
      subtle?: {
        digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>
      }
    }
  }).crypto
  if (!runtimeCrypto?.subtle) {
    throw new Error("Web Crypto is required to hash an AIMD migration manifest")
  }
  const bytes = new TextEncoder().encode(canonical)
  const digest = await runtimeCrypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (isObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
  }
  return value
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function segments(path: string): string[] {
  return path.split(".").filter(Boolean)
}

function read(data: Record<string, unknown>, path: string): [boolean, unknown] {
  let current: unknown = data
  for (const segment of segments(path)) {
    if (!isObject(current) || !Object.prototype.hasOwnProperty.call(current, segment)) return [false, undefined]
    current = current[segment]
  }
  return [true, current]
}

function write(data: Record<string, unknown>, path: string, value: unknown, onlyMissing = false): void {
  const pathSegments = segments(path)
  if (!pathSegments.length) return
  let current = data
  for (const segment of pathSegments.slice(0, -1)) {
    if (!isObject(current[segment])) current[segment] = {}
    current = current[segment] as Record<string, unknown>
  }
  const key = pathSegments[pathSegments.length - 1]
  if (!onlyMissing || !Object.prototype.hasOwnProperty.call(current, key)) current[key] = clone(value)
}

function remove(data: Record<string, unknown>, path: string): void {
  const pathSegments = segments(path)
  if (!pathSegments.length) return
  let current: unknown = data
  for (const segment of pathSegments.slice(0, -1)) {
    if (!isObject(current) || !isObject(current[segment])) return
    current = current[segment]
  }
  if (isObject(current)) delete current[pathSegments[pathSegments.length - 1]]
}

export function applyAimdDeclarativeMigration(
  recordData: Record<string, unknown>,
  manifest: AimdMigrationManifest,
): AimdMigrationResult {
  const validationIssues = validateAimdMigrationManifest(manifest)
  const canonicalRules = JSON.stringify(stable(manifest))
  if (validationIssues.length) {
    return { data: clone(recordData), status: "failed", issues: validationIssues, canonicalRules }
  }
  const data = clone(recordData)
  const issues: AimdMigrationIssue[] = []
  for (const [index, operation] of (manifest.operations ?? []).entries()) {
    if (operation.op === "rename" || operation.op === "copy") {
      const [found, value] = read(data, operation.from)
      if (!found) {
        issues.push({
          path: `operations.${index}.from`,
          message: `source field "${operation.from}" was not collected`,
        })
        continue
      }
      write(data, operation.to, value)
      if (operation.op === "rename") remove(data, operation.from)
    }
    else if (operation.op === "remove") remove(data, operation.field)
    else if (operation.op === "set_default") {
      write(data, operation.field, operation.value, true)
    }
  }
  return {
    data,
    status: issues.length || manifest.transform ? "needs_review" : "completed",
    issues,
    canonicalRules,
  }
}
