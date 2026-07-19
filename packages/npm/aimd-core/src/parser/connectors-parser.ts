import type {
  AimdConnectorAuthField,
  AimdConnectorField,
  AimdConnectorsField,
} from "../types/aimd"
import { parseDocument } from "yaml"

const CONNECTOR_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/
const ENTITY_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/
const INLINE_SECRET_KEYS = new Set([
  "access_token",
  "api_key",
  "apikey",
  "bearer",
  "client_secret",
  "password",
  "refresh_token",
  "secret",
  "token",
])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`)
  }
  const trimmed = value.trim()
  return trimmed || undefined
}

function nonEmptyString(value: unknown, fieldName: string): string {
  const text = optionalString(value, fieldName)
  if (!text) {
    throw new Error(`${fieldName} must be a non-empty string`)
  }
  return text
}

function parseConnectorsYamlMapping(content: string): Record<string, unknown> {
  const normalized = content.replace(/\r\n?/g, "\n")
  const document = parseDocument(normalized, {
    prettyErrors: true,
    uniqueKeys: true,
    merge: false,
    schema: "core",
    maxAliasCount: 32,
  } as any)

  if (document.errors.length > 0) {
    const firstError = document.errors[0]
    throw new Error(`Invalid connectors YAML: ${firstError.message}`)
  }

  const value = document.toJSON()
  if (!isPlainObject(value)) {
    throw new Error("connectors block must be a YAML mapping/object")
  }
  return value
}

function assertNoInlineSecrets(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoInlineSecrets(item, `${path}[${index}]`))
    return
  }
  if (!isPlainObject(value)) {
    return
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.trim().toLowerCase()
    if (INLINE_SECRET_KEYS.has(normalizedKey) && !normalizedKey.endsWith("_env")) {
      throw new Error(`${path}.${key} must not inline secret values; use an *_env field instead`)
    }
    assertNoInlineSecrets(nestedValue, `${path}.${key}`)
  }
}

function normalizeAuth(value: unknown, fieldName: string): AimdConnectorAuthField | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (!isPlainObject(value)) {
    throw new Error(`${fieldName} must be a mapping/object`)
  }

  assertNoInlineSecrets(value, fieldName)
  const auth: AimdConnectorAuthField = { ...value }
  const type = optionalString(value.type, `${fieldName}.type`)
  auth.type = type ?? "bearer"
  const tokenEnv = optionalString(value.token_env, `${fieldName}.token_env`)
  if (tokenEnv) auth.token_env = tokenEnv
  return auth
}

function normalizeConnector(rawConnector: unknown, id: string): AimdConnectorField {
  if (!CONNECTOR_ID_PATTERN.test(id)) {
    throw new Error(`connectors.${id} must use an identifier key`)
  }
  if (!isPlainObject(rawConnector)) {
    throw new Error(`connectors.${id} must be a mapping/object`)
  }

  assertNoInlineSecrets(rawConnector, `connectors.${id}`)

  const kind = nonEmptyString(rawConnector.kind, `connectors.${id}.kind`)
  const connector: AimdConnectorField = {
    ...rawConnector,
    id,
    kind,
  }

  const entity = optionalString(rawConnector.entity, `connectors.${id}.entity`)
  if (entity) {
    if (!ENTITY_NAME_PATTERN.test(entity)) {
      throw new Error(`connectors.${id}.entity must start with a letter and contain only letters, digits, underscores, or hyphens`)
    }
    connector.entity = entity
  }

  const descriptor = optionalString(rawConnector.descriptor, `connectors.${id}.descriptor`)
  if (descriptor) connector.descriptor = descriptor

  const title = optionalString(rawConnector.title, `connectors.${id}.title`)
  if (title) connector.title = title
  const description = optionalString(rawConnector.description, `connectors.${id}.description`)
  if (description) connector.description = description

  const auth = normalizeAuth(rawConnector.auth, `connectors.${id}.auth`)
  if (auth) connector.auth = auth

  if (kind === "entity_source") {
    if (!connector.entity) {
      throw new Error(`connectors.${id}.entity is required for entity_source connectors`)
    }
    if (!connector.descriptor && connector.search === undefined && connector.resolve === undefined) {
      throw new Error(`connectors.${id} must define descriptor, search, or resolve for entity_source connectors`)
    }
  }

  return connector
}

export function parseConnectorsContent(content: string): AimdConnectorsField {
  const data = parseConnectorsYamlMapping(content)

  const version = data.version ?? 1
  if (typeof version !== "string" && typeof version !== "number") {
    throw new Error("connectors.version must be a string or number")
  }

  let rawConnectors: Record<string, unknown>
  if (data.connectors !== undefined && data.connectors !== null) {
    const extraKeys = Object.keys(data).filter(key => key !== "version" && key !== "connectors")
    if (extraKeys.length > 0) {
      throw new Error("connectors block must not mix top-level connector ids with connectors.connectors")
    }
    if (!isPlainObject(data.connectors)) {
      throw new Error("connectors.connectors must be a mapping/object")
    }
    rawConnectors = data.connectors
  } else {
    rawConnectors = Object.fromEntries(
      Object.entries(data).filter(([key]) => key !== "version"),
    )
  }

  const connectors: Record<string, AimdConnectorField> = {}
  for (const [id, rawConnector] of Object.entries(rawConnectors)) {
    connectors[id] = normalizeConnector(rawConnector, id)
  }

  if (Object.keys(connectors).length === 0) {
    throw new Error("connectors block must contain at least one connector")
  }

  const result: AimdConnectorsField = {
    connectors,
    raw: content,
    version,
  }

  return result
}
