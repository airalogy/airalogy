import { reactive } from "vue"
import type {
  AimdCollectorField,
  AimdConnectorField,
  AimdVarField,
  ExtractedAimdFields,
} from "@airalogy/aimd-core/types"
import type {
  AimdCollectorObservation,
  AimdCollectorObservationInput,
  AimdCollectorPermissionHandler,
  AimdCollectorProviderMap,
  AimdCollectorRuntimeState,
  AimdProtocolRecordData,
} from "../types"
import { cloneRecordData } from "./useRecordState"

export interface AimdCollectorBinding {
  collector: AimdCollectorField
  connector: AimdConnectorField
  field: AimdVarField
  fieldKey: string
  isList: boolean
  isSeries: boolean
}

export interface AimdCollectorRuntimeOptions {
  fields: () => ExtractedAimdFields
  record: AimdProtocolRecordData
  providers: () => AimdCollectorProviderMap | undefined
  requestPermission: () => AimdCollectorPermissionHandler | undefined
  actorId: () => string | undefined
  onChange: (fieldId: string, value: unknown) => void
  onError?: (message: string) => void
}

export interface AimdCollectorManualValueResult {
  ok: boolean
  value?: unknown
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function flattenConnectors(fields: ExtractedAimdFields): Map<string, AimdConnectorField> {
  const result = new Map<string, AimdConnectorField>()
  for (const registry of fields.connectors ?? []) {
    for (const [id, connector] of Object.entries(registry.connectors)) {
      result.set(id, connector)
    }
  }
  return result
}

function flattenCollectors(fields: ExtractedAimdFields): Map<string, AimdCollectorField> {
  const result = new Map<string, AimdCollectorField>()
  for (const registry of fields.collectors ?? []) {
    for (const [id, collector] of Object.entries(registry.collectors)) {
      result.set(id, collector)
    }
  }
  return result
}

export function getAimdCollectorBinding(
  fields: ExtractedAimdFields,
  fieldId: string,
): AimdCollectorBinding | null {
  const field = fields.var_definitions?.find(candidate => candidate.id === fieldId)
  const collectorId = asNonEmptyString(field?.kwargs?.collector)
  if (!field || !collectorId) return null

  const collector = flattenCollectors(fields).get(collectorId)
  if (!collector) return null
  const connector = flattenConnectors(fields).get(collector.connector)
  if (!connector) return null

  const compactType = String(field.type ?? "").replace(/\s+/g, "")
  return {
    collector,
    connector,
    field,
    fieldKey: `var:${fieldId}`,
    isList: /^(?:list|List)\[Observation\[/.test(compactType),
    isSeries: /^ObservationSeriesRef\[/.test(compactType),
  }
}

function parseObservedAt(value: unknown, fallback: string): string {
  if (value === undefined || value === null || value === "") return fallback
  if (typeof value !== "string") {
    throw new Error("Collector observed_at must be an ISO 8601 string")
  }
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("Collector observed_at must be a valid ISO 8601 timestamp")
  }
  return timestamp.toISOString()
}

function isObservationEnvelope(value: unknown): value is AimdCollectorObservationInput {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, "value"),
  )
}

function createCollectorObservation(
  rawValue: unknown,
  binding: AimdCollectorBinding,
): AimdCollectorObservation {
  const receivedAt = new Date().toISOString()
  const input = isObservationEnvelope(rawValue) ? rawValue : { value: rawValue }
  const unit = asNonEmptyString(input.unit) ?? asNonEmptyString(binding.field.kwargs?.unit)
  const quality = asNonEmptyString(input.quality)
  const deviceId = asNonEmptyString(input.device_id)

  return {
    value: input.value,
    observed_at: parseObservedAt(input.observed_at, receivedAt),
    received_at: receivedAt,
    source: {
      kind: "collector",
      connector: binding.connector.id,
      collector: binding.collector.id,
      ...(deviceId ? { device_id: deviceId } : {}),
    },
    ...(unit ? { unit } : {}),
    ...(quality ? { quality } : {}),
    ...(typeof input.sequence === "number" && Number.isFinite(input.sequence)
      ? { sequence: input.sequence }
      : {}),
    ...(input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? { metadata: { ...input.metadata } }
      : {}),
  }
}

function createManualObservation(
  value: unknown,
  reason: string,
  binding: AimdCollectorBinding,
  actorId?: string,
): AimdCollectorObservation {
  const timestamp = new Date().toISOString()
  const unit = asNonEmptyString(binding.field.kwargs?.unit)
  const normalizedActorId = asNonEmptyString(actorId)
  return {
    value,
    observed_at: timestamp,
    received_at: timestamp,
    source: {
      kind: "manual",
      collector: binding.collector.id,
      reason: reason.trim(),
      ...(normalizedActorId ? { actor_id: normalizedActorId } : {}),
    },
    ...(unit ? { unit } : {}),
  }
}

function getObservationValueCount(value: unknown): number {
  if (Array.isArray(value)) return value.length
  return value === undefined || value === null ? 0 : 1
}

function waitForInterval(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const timer = setTimeout(resolve, delayMs)
    signal.addEventListener("abort", () => {
      clearTimeout(timer)
      resolve()
    }, { once: true })
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function getAimdCollectorManualValueType(type: string): string {
  const compact = type.replace(/\s+/g, "")
  const match = compact.match(/Observation\[(.+?)\]/)
  return match?.[1] ?? "str"
}

export function parseAimdCollectorManualValue(
  type: string,
  input: string,
): AimdCollectorManualValueResult {
  const valueType = getAimdCollectorManualValueType(type).toLowerCase()
  if (valueType === "str" || valueType === "string") return { ok: true, value: input }
  if (valueType === "int" || valueType === "integer") {
    if (!/^[+-]?\d+$/.test(input.trim())) return { ok: false }
    return { ok: true, value: Number.parseInt(input.trim(), 10) }
  }
  if (["float", "number", "decimal"].includes(valueType)) {
    const value = Number(input.trim())
    return input.trim() && Number.isFinite(value) ? { ok: true, value } : { ok: false }
  }
  if (valueType === "bool" || valueType === "boolean") {
    const normalized = input.trim().toLowerCase()
    if (["true", "1", "yes"].includes(normalized)) return { ok: true, value: true }
    if (["false", "0", "no"].includes(normalized)) return { ok: true, value: false }
    return { ok: false }
  }
  try {
    return { ok: true, value: JSON.parse(input) }
  } catch {
    return { ok: false }
  }
}

export function useCollectors(options: AimdCollectorRuntimeOptions) {
  const states = reactive<Record<string, AimdCollectorRuntimeState>>({})
  const controllers = new Map<string, AbortController>()
  const recordPermissions = new Set<string>()
  const pendingStarts = new Set<string>()
  let lifecycleGeneration = 0

  function resolveBinding(fieldId: string): AimdCollectorBinding | null {
    return getAimdCollectorBinding(options.fields(), fieldId)
  }

  function getState(fieldId: string): AimdCollectorRuntimeState {
    const existing = states[fieldId]
    if (existing) return existing
    const state = reactive<AimdCollectorRuntimeState>({
      status: "idle",
      sampleCount: getObservationValueCount(options.record.var[fieldId]),
    })
    states[fieldId] = state
    return state
  }

  function updateState(fieldId: string, patch: Partial<AimdCollectorRuntimeState>): void {
    Object.assign(getState(fieldId), patch)
  }

  function writeObservation(fieldId: string, observation: AimdCollectorObservation): void {
    const binding = resolveBinding(fieldId)
    if (!binding) return
    const currentValue = options.record.var[fieldId]
    const nextValue = binding.isList
      ? [...(Array.isArray(currentValue) ? currentValue : []), observation]
      : observation
    options.onChange(fieldId, nextValue)
    updateState(fieldId, {
      lastObservedAt: observation.observed_at,
      sampleCount: getObservationValueCount(nextValue),
    })
  }

  async function requestStartPermission(binding: AimdCollectorBinding): Promise<boolean> {
    if (recordPermissions.has(binding.collector.id)) return true
    const requestPermission = options.requestPermission()
    if (!requestPermission) return true

    updateState(binding.field.id, { status: "waiting_for_permission", error: undefined })
    const decision = await requestPermission({
      connector: binding.connector,
      collector: binding.collector,
      fieldKey: binding.fieldKey,
      record: cloneRecordData(options.record),
    })
    if (decision === "record") recordPermissions.add(binding.collector.id)
    return decision === true || decision === "once" || decision === "record"
  }

  async function readOne(binding: AimdCollectorBinding, signal: AbortSignal): Promise<void> {
    const provider = options.providers()?.[binding.connector.id]
    if (!provider) throw new Error(`No Collector provider is registered for ${binding.connector.id}`)
    const rawValue = await provider.read({
      connector: binding.connector,
      collector: binding.collector,
      fieldKey: binding.fieldKey,
      record: cloneRecordData(options.record),
      signal,
    })
    if (signal.aborted) return
    writeObservation(binding.field.id, createCollectorObservation(rawValue, binding))
  }

  async function start(fieldId: string): Promise<void> {
    const binding = resolveBinding(fieldId)
    if (!binding || controllers.has(fieldId) || pendingStarts.has(fieldId)) return
    if (binding.collector.mode === "stream" || binding.isSeries) {
      updateState(fieldId, { status: "unsupported", error: undefined })
      return
    }
    if (!options.providers()?.[binding.connector.id]) {
      updateState(fieldId, { status: "error", error: "provider_unavailable" })
      return
    }

    const startGeneration = lifecycleGeneration
    pendingStarts.add(fieldId)
    try {
      const permitted = await requestStartPermission(binding)
      if (startGeneration !== lifecycleGeneration) return
      if (!permitted) {
        updateState(fieldId, { status: "error", error: "permission_denied" })
        return
      }
    } catch (error) {
      const message = errorMessage(error)
      updateState(fieldId, { status: "error", error: message })
      options.onError?.(message)
      return
    } finally {
      pendingStarts.delete(fieldId)
    }

    const controller = new AbortController()
    controllers.set(fieldId, controller)
    updateState(fieldId, { status: "connecting", error: undefined })

    try {
      if (binding.collector.mode === "snapshot") {
        await readOne(binding, controller.signal)
        updateState(fieldId, { status: "completed" })
        return
      }

      updateState(fieldId, { status: "collecting" })
      const intervalMs = binding.collector.interval_ms ?? 1000
      while (!controller.signal.aborted) {
        await readOne(binding, controller.signal)
        if (controller.signal.aborted) break
        await waitForInterval(intervalMs, controller.signal)
      }
      updateState(fieldId, { status: "completed" })
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = errorMessage(error)
        updateState(fieldId, { status: "error", error: message })
        options.onError?.(message)
      }
    } finally {
      if (controllers.get(fieldId) === controller) controllers.delete(fieldId)
    }
  }

  function stop(fieldId: string): void {
    const controller = controllers.get(fieldId)
    if (!controller) return
    updateState(fieldId, { status: "stopping" })
    controller.abort()
  }

  function stopAll(options?: { resetPermissions?: boolean }): void {
    lifecycleGeneration += 1
    pendingStarts.clear()
    for (const controller of controllers.values()) controller.abort()
    controllers.clear()
    for (const state of Object.values(states)) {
      if (["connecting", "collecting", "stopping", "waiting_for_permission"].includes(state.status)) {
        state.status = "completed"
      }
    }
    if (options?.resetPermissions) recordPermissions.clear()
  }

  function writeManual(fieldId: string, value: unknown, reason: string): boolean {
    const binding = resolveBinding(fieldId)
    if (!binding || !binding.collector.manual_fallback || !reason.trim()) return false
    writeObservation(fieldId, createManualObservation(value, reason, binding, options.actorId()))
    updateState(fieldId, { status: "completed", error: undefined })
    return true
  }

  function hasProvider(fieldId: string): boolean {
    const binding = resolveBinding(fieldId)
    return Boolean(binding && options.providers()?.[binding.connector.id])
  }

  function isRunning(fieldId: string): boolean {
    return controllers.has(fieldId)
  }

  return {
    states,
    getState,
    resolveBinding,
    hasProvider,
    isRunning,
    start,
    stop,
    stopAll,
    writeManual,
  }
}
