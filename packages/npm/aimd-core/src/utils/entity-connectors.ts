import { parseDocument } from "yaml"
import type {
  AimdConnectorAuthField,
  AimdConnectorField,
  AimdConnectorsField,
} from "../types/aimd"
import type { AimdVarNode } from "../types/nodes"

export interface AimdEntityRefValue {
  entity: string
  id: string
  source?: string
  label?: string
  version?: string | number
  snapshot?: Record<string, unknown>
  [key: string]: unknown
}

export interface AimdEntityRefOption extends AimdEntityRefValue {
  description?: string
  disabled?: boolean
}

export interface AimdEntityResolveContext {
  type?: string
  normalizedType?: string
  fieldKey?: string
  node?: AimdVarNode
  fieldMeta?: unknown
  entity?: string
  source?: string
  query?: string
  multiple?: boolean
  record?: unknown
}

export type AimdEntitySearchHandler = (
  query: string,
  context: AimdEntityResolveContext,
) => AimdEntityRefOption[] | Promise<AimdEntityRefOption[]>

export interface AimdEntityResolver {
  search: AimdEntitySearchHandler
  resolve?: (
    id: string,
    context: AimdEntityResolveContext,
  ) => AimdEntityRefOption | null | undefined | Promise<AimdEntityRefOption | null | undefined>
}

export type AimdEntityResolverEntry = AimdEntityResolver | AimdEntitySearchHandler
export type AimdEntityResolverMap = Record<string, AimdEntityResolverEntry>

export interface AimdConnectorFetchResponse {
  ok?: boolean
  status?: number
  statusText?: string
  text(): Promise<string>
}

export type AimdConnectorFetch = (
  input: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
  },
) => Promise<AimdConnectorFetchResponse>

export interface AimdConnectorRuntimeOptions {
  /** Fetch implementation used for descriptor URLs and endpoint requests. */
  fetch?: AimdConnectorFetch
  /** Base URL for relative descriptor or endpoint URLs in browser/server hosts. */
  baseUrl?: string
  /** Host-provided loader for protocol-local descriptors from .aira archives or filesystems. */
  loadDescriptor?: (
    descriptor: string,
    context: { connector: AimdConnectorField, headers: Record<string, string> },
  ) => string | Record<string, unknown> | Promise<string | Record<string, unknown>>
  /** Host-provided secret resolver. Browser apps should proxy this through a backend. */
  getSecret?: (name: string) => string | undefined | null | Promise<string | undefined | null>
}

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

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function assertNoInlineSecrets(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoInlineSecrets(item, `${path}[${index}]`))
    return
  }
  if (!isPlainObject(value)) return

  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.trim().toLowerCase()
    if (INLINE_SECRET_KEYS.has(normalizedKey) && !normalizedKey.endsWith("_env")) {
      throw new Error(`${path}.${key} must not inline secret values; use an *_env field instead`)
    }
    assertNoInlineSecrets(nestedValue, `${path}.${key}`)
  }
}

function parseDescriptorText(content: string, descriptor: string): Record<string, unknown> {
  const document = parseDocument(content.replace(/\r\n?/g, "\n"), {
    prettyErrors: true,
    uniqueKeys: true,
    merge: false,
    schema: "core",
    maxAliasCount: 32,
  } as any)
  if (document.errors.length > 0) {
    throw new Error(`Invalid connector descriptor YAML at ${descriptor}: ${document.errors[0].message}`)
  }
  const value = document.toJSON()
  if (!isPlainObject(value)) {
    throw new Error(`Connector descriptor at ${descriptor} must be a mapping/object`)
  }
  assertNoInlineSecrets(value, `connector descriptor ${descriptor}`)
  return value
}

function resolveUrl(reference: string, baseUrl?: string): string {
  if (isHttpUrl(reference)) return reference
  if (!baseUrl) return reference
  return new URL(reference, baseUrl).toString()
}

async function defaultFetchText(
  descriptor: string,
  headers: Record<string, string>,
  options: AimdConnectorRuntimeOptions,
): Promise<string> {
  const fetchImpl = options.fetch ?? globalThis.fetch
  if (!fetchImpl) {
    throw new Error(`Connector descriptor ${descriptor} requires a fetch implementation`)
  }
  if (!isHttpUrl(descriptor) && !options.baseUrl) {
    throw new Error(`Local connector descriptor ${descriptor} requires loadDescriptor or baseUrl`)
  }

  const url = resolveUrl(descriptor, options.baseUrl)
  const response = await fetchImpl(url, { method: "GET", headers })
  if (response.ok === false) {
    throw new Error(`Cannot fetch connector descriptor ${descriptor}: ${response.status ?? ""} ${response.statusText ?? ""}`.trim())
  }
  return response.text()
}

function normalizeString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  const text = String(value).trim()
  return text || undefined
}

async function buildAuthHeaders(
  auth: AimdConnectorAuthField | undefined,
  options: AimdConnectorRuntimeOptions,
): Promise<Record<string, string>> {
  if (!auth) return {}
  if (!isPlainObject(auth)) {
    throw new Error("connector auth must be a mapping/object")
  }

  const authType = normalizeString(auth.type)?.toLowerCase() ?? "bearer"
  if (authType === "none" || authType === "no_auth" || authType === "anonymous") {
    return {}
  }

  const tokenEnv = normalizeString(auth.token_env)
  if (!tokenEnv) return {}
  if (!options.getSecret) {
    throw new Error(`Connector auth requires getSecret to read ${tokenEnv}`)
  }

  const token = await options.getSecret(tokenEnv)
  if (!token) {
    throw new Error(`Connector auth requires secret ${tokenEnv}`)
  }

  if (authType === "bearer" || authType === "oauth2") {
    return { Authorization: `Bearer ${token}` }
  }
  if (authType === "api_key" || authType === "api-key" || authType === "apikey") {
    const headerName = normalizeString(auth.header) ?? "X-API-Key"
    return { [headerName]: token }
  }

  throw new Error(`Unsupported connector auth type: ${authType}`)
}

export async function loadAimdConnectorDescriptor(
  connector: AimdConnectorField,
  options: AimdConnectorRuntimeOptions = {},
): Promise<AimdConnectorField> {
  if (!isPlainObject(connector)) {
    throw new Error("connector must be a mapping/object")
  }
  assertNoInlineSecrets(connector, "connector")

  let descriptorData: Record<string, unknown> = {}
  const descriptor = normalizeString(connector.descriptor)
  if (descriptor) {
    const loaded = options.loadDescriptor
      ? await options.loadDescriptor(descriptor, { connector, headers: {} })
      : await defaultFetchText(descriptor, {}, options)

    descriptorData = typeof loaded === "string"
      ? parseDescriptorText(loaded, descriptor)
      : { ...loaded }
    assertNoInlineSecrets(descriptorData, `connector descriptor ${descriptor}`)
  }

  const descriptorEntity = normalizeString(descriptorData.entity)
  const connectorEntity = normalizeString(connector.entity)
  if (descriptorEntity && connectorEntity && descriptorEntity !== connectorEntity) {
    throw new Error(`Connector descriptor entity "${descriptorEntity}" does not match connector entity "${connectorEntity}"`)
  }

  const merged: AimdConnectorField = {
    ...(descriptorData as Record<string, unknown>),
    ...connector,
  } as AimdConnectorField

  if (isPlainObject(descriptorData.auth) || isPlainObject(connector.auth)) {
    merged.auth = {
      ...(isPlainObject(descriptorData.auth) ? descriptorData.auth : {}),
      ...(isPlainObject(connector.auth) ? connector.auth : {}),
    }
    if (merged.auth.token_env && !merged.auth.type) {
      merged.auth.type = "bearer"
    }
  }

  return merged
}

function readPath(value: unknown, path: string | undefined): unknown {
  if (!path) return value
  let current = value
  for (const rawPart of path.split(".")) {
    const part = rawPart.trim()
    if (!part) continue
    if (!isPlainObject(current)) return undefined
    current = current[part]
  }
  return current
}

function extractItems(response: unknown, operation: Record<string, unknown>): unknown[] {
  const itemsPath = normalizeString(operation.items_path)
  const source = itemsPath ? readPath(response, itemsPath) : response
  if (Array.isArray(source)) return source
  if (isPlainObject(source)) {
    for (const key of ["items", "results", "records", "data"]) {
      const value = source[key]
      if (Array.isArray(value)) return value
      if (isPlainObject(value)) {
        const nested = extractItems(value, {})
        if (nested.length > 0) return nested
      }
    }
    return [source]
  }
  return source === undefined || source === null ? [] : [source]
}

function firstStringFrom(value: Record<string, unknown>, keys: Array<string | undefined>): string | undefined {
  for (const key of keys) {
    if (!key) continue
    const text = normalizeString(value[key])
    if (text) return text
  }
  return undefined
}

export function normalizeAimdEntityRefOption(
  value: unknown,
  options: { entity: string, source?: string, fieldMap?: Record<string, string> },
): AimdEntityRefOption | null {
  if (typeof value === "string") {
    const id = value.trim()
    if (!id) return null
    return {
      entity: options.entity,
      source: options.source,
      id,
      label: id,
    }
  }

  if (!isPlainObject(value)) return null

  const fieldMap = options.fieldMap ?? {}
  const id = firstStringFrom(value, [fieldMap.id, "id", "value", "key", "uuid"])
  if (!id) return null
  const label = firstStringFrom(value, [fieldMap.label, "label", "name", "title", "display_name"])
  const version = firstStringFrom(value, [fieldMap.version, "version", "revision"])

  const normalized: AimdEntityRefOption = {
    ...value,
    entity: normalizeString(value.entity) ?? options.entity,
    source: normalizeString(value.source) ?? options.source,
    id,
    label: label ?? id,
  }
  if (version) normalized.version = version
  return normalized
}

function encodeTemplateValue(value: unknown): string {
  return encodeURIComponent(String(value))
}

function formatUrlTemplate(url: string, values: Record<string, unknown>): string {
  let result = url
  for (const [key, value] of Object.entries(values)) {
    result = result.split(`{${key}}`).join(encodeTemplateValue(value))
  }
  return result
}

function formatTemplateValue(value: unknown, values: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    let result = value
    for (const [key, replacement] of Object.entries(values)) {
      result = result.split(`{${key}}`).join(String(replacement))
    }
    return result
  }
  if (Array.isArray(value)) {
    return value.map(item => formatTemplateValue(item, values))
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, formatTemplateValue(nestedValue, values)]),
    )
  }
  return value
}

function operationConfig(connector: AimdConnectorField, key: "search" | "resolve"): Record<string, unknown> {
  const operation = connector[key]
  if (!isPlainObject(operation)) {
    throw new Error(`connector ${key} operation must be a mapping/object`)
  }
  const url = normalizeString(operation.url)
  if (!url) {
    throw new Error(`connector ${key}.url is required`)
  }
  return operation
}

function appendParams(url: string, params: Record<string, unknown>, baseUrl?: string): string {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [key, String(value)] as const)
  if (entries.length === 0) return resolveUrl(url, baseUrl)

  const resolved = resolveUrl(url, baseUrl)
  if (isHttpUrl(resolved) || baseUrl) {
    const parsed = new URL(resolved, baseUrl)
    for (const [key, value] of entries) {
      parsed.searchParams.set(key, value)
    }
    return parsed.toString()
  }

  const separator = resolved.includes("?") ? "&" : "?"
  return `${resolved}${separator}${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")}`
}

async function requestJson(
  method: string,
  url: string,
  init: {
    headers: Record<string, string>
    params: Record<string, unknown>
    jsonBody: unknown
  },
  options: AimdConnectorRuntimeOptions,
): Promise<unknown> {
  const fetchImpl = options.fetch ?? globalThis.fetch
  if (!fetchImpl) {
    throw new Error(`Connector request ${url} requires a fetch implementation`)
  }

  const headers = { ...init.headers }
  let body: string | undefined
  if (init.jsonBody !== undefined && init.jsonBody !== null) {
    body = JSON.stringify(init.jsonBody)
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json"
  }

  const response = await fetchImpl(appendParams(url, init.params, options.baseUrl), {
    method,
    headers,
    body,
  })
  if (response.ok === false) {
    throw new Error(`Connector request failed for ${url}: ${response.status ?? ""} ${response.statusText ?? ""}`.trim())
  }

  const text = await response.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`Connector response from ${url} is not JSON`)
  }
}

function buildRequest(
  operation: Record<string, unknown>,
  values: { query?: string, id?: string },
  headers: Record<string, string>,
): {
  method: string
  url: string
  headers: Record<string, string>
  params: Record<string, unknown>
  jsonBody: unknown
} {
  const method = normalizeString(operation.method)?.toUpperCase() ?? "GET"
  const url = formatUrlTemplate(String(operation.url), values)
  const params = isPlainObject(operation.params)
    ? { ...(formatTemplateValue(operation.params, values) as Record<string, unknown>) }
    : {}

  if (values.query !== undefined) {
    const queryParam = normalizeString(operation.query_param) ?? "q"
    if (params[queryParam] === undefined) {
      params[queryParam] = values.query
    }
  }
  if (values.id !== undefined && !String(operation.url).includes("{id}")) {
    const idParam = normalizeString(operation.id_param)
    if (idParam) params[idParam] = values.id
  }

  const requestHeaders = { ...headers }
  if (isPlainObject(operation.headers)) {
    for (const [key, value] of Object.entries(operation.headers)) {
      requestHeaders[key] = String(formatTemplateValue(value, values))
    }
  }

  const jsonBody = isPlainObject(operation.json) || Array.isArray(operation.json)
    ? formatTemplateValue(operation.json, values)
    : undefined
  return { method, url, headers: requestHeaders, params, jsonBody }
}

export async function searchAimdEntityConnector(
  connector: AimdConnectorField,
  query: string,
  options: AimdConnectorRuntimeOptions = {},
): Promise<AimdEntityRefOption[]> {
  const resolved = await loadAimdConnectorDescriptor(connector, options)
  const entity = normalizeString(resolved.entity)
  if (!entity) throw new Error("entity_source connector entity is required")
  const operation = operationConfig(resolved, "search")
  const authHeaders = await buildAuthHeaders(resolved.auth, options)
  const request = buildRequest(operation, { query }, authHeaders)
  const response = await requestJson(request.method, request.url, {
    headers: request.headers,
    params: request.params,
    jsonBody: request.jsonBody,
  }, options)
  const fieldMap = isPlainObject(operation.field_map)
    ? operation.field_map as Record<string, string>
    : undefined
  return extractItems(response, operation)
    .map(item => normalizeAimdEntityRefOption(item, {
      entity,
      source: resolved.id,
      fieldMap,
    }))
    .filter((item): item is AimdEntityRefOption => item !== null)
}

export async function resolveAimdEntityConnector(
  connector: AimdConnectorField,
  id: string,
  options: AimdConnectorRuntimeOptions = {},
): Promise<AimdEntityRefOption | null> {
  const resolved = await loadAimdConnectorDescriptor(connector, options)
  const entity = normalizeString(resolved.entity)
  if (!entity) throw new Error("entity_source connector entity is required")
  const operation = operationConfig(resolved, "resolve")
  const authHeaders = await buildAuthHeaders(resolved.auth, options)
  const request = buildRequest(operation, { id }, authHeaders)
  const response = await requestJson(request.method, request.url, {
    headers: request.headers,
    params: request.params,
    jsonBody: request.jsonBody,
  }, options)
  const fieldMap = isPlainObject(operation.field_map)
    ? operation.field_map as Record<string, string>
    : undefined
  for (const item of extractItems(response, operation)) {
    const normalized = normalizeAimdEntityRefOption(item, {
      entity,
      source: resolved.id,
      fieldMap,
    })
    if (normalized) return normalized
  }
  return null
}

function flattenConnectorInput(
  input: AimdConnectorsField | AimdConnectorsField[] | Record<string, AimdConnectorField>,
): Record<string, AimdConnectorField> {
  if (Array.isArray(input)) {
    return Object.assign({}, ...input.map(block => block.connectors))
  }
  const maybeBlock = input as AimdConnectorsField
  if (isPlainObject(maybeBlock.connectors)) {
    return maybeBlock.connectors as Record<string, AimdConnectorField>
  }
  return input as Record<string, AimdConnectorField>
}

export function createAimdEntityResolversFromConnectors(
  input: AimdConnectorsField | AimdConnectorsField[] | Record<string, AimdConnectorField>,
  options: AimdConnectorRuntimeOptions = {},
): AimdEntityResolverMap {
  const connectors = flattenConnectorInput(input)
  const resolvers: AimdEntityResolverMap = {}

  for (const [connectorId, connector] of Object.entries(connectors)) {
    if (connector.kind !== "entity_source") continue
    const normalizedConnector: AimdConnectorField = {
      ...connector,
      id: connector.id || connectorId,
    }
    const resolver: AimdEntityResolver = {
      search: (query) => searchAimdEntityConnector(normalizedConnector, query, options),
      resolve: (id) => resolveAimdEntityConnector(normalizedConnector, id, options),
    }
    resolvers[normalizedConnector.id] = resolver
    if (normalizedConnector.entity && !resolvers[normalizedConnector.entity]) {
      resolvers[normalizedConnector.entity] = resolver
    }
  }

  return resolvers
}
