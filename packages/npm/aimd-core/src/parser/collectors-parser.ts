import type {
  AimdCollectorField,
  AimdCollectorLifecycleField,
  AimdCollectorLifecycleTrigger,
  AimdCollectorMode,
  AimdCollectorsField,
} from "../types/aimd"
import { parseDurationToMs } from "./field-parsers"
import { parseDocument } from "yaml"

const COLLECTOR_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/
const MODES = new Set<AimdCollectorMode>(["snapshot", "polling", "stream"])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== "string") throw new Error(`${fieldName} must be a string`)
  const normalized = value.trim()
  return normalized || undefined
}

function requiredString(value: unknown, fieldName: string): string {
  const normalized = optionalString(value, fieldName)
  if (!normalized) throw new Error(`${fieldName} must be a non-empty string`)
  return normalized
}

function parseYamlMapping(content: string): Record<string, unknown> {
  const document = parseDocument(content.replace(/\r\n?/g, "\n"), {
    prettyErrors: true,
    uniqueKeys: true,
    merge: false,
    schema: "core",
    maxAliasCount: 32,
  } as any)

  if (document.errors.length > 0) {
    throw new Error(`Invalid collectors YAML: ${document.errors[0].message}`)
  }

  const value = document.toJSON()
  if (!isPlainObject(value)) {
    throw new Error("collectors block must be a YAML mapping/object")
  }
  return value
}

function parseLifecycleTrigger(
  value: unknown,
  phase: "start" | "stop",
  fieldName: string,
): AimdCollectorLifecycleTrigger {
  const allowedString = phase === "start"
    ? new Set(["manual", "record_start"])
    : new Set(["manual", "record_complete"])
  const allowedStepEvent = phase === "start" ? "step_start" : "step_complete"

  if (typeof value === "string") {
    const normalized = value.trim()
    if (allowedString.has(normalized)) {
      return normalized as AimdCollectorLifecycleTrigger
    }
    throw new Error(`${fieldName} must be ${[...allowedString].join(" or ")}`)
  }

  if (!isPlainObject(value)) {
    throw new Error(`${fieldName} must be a lifecycle event string or mapping/object`)
  }

  const event = requiredString(value.event, `${fieldName}.event`)
  if (event !== allowedStepEvent) {
    throw new Error(`${fieldName}.event must be ${allowedStepEvent}`)
  }
  const step = requiredString(value.step, `${fieldName}.step`)
  return { event, step } as AimdCollectorLifecycleTrigger
}

function normalizeLifecycle(value: unknown, fieldName: string): AimdCollectorLifecycleField {
  if (value === undefined || value === null) {
    return { start: "manual", stop: "manual" }
  }
  if (!isPlainObject(value)) {
    throw new Error(`${fieldName} must be a mapping/object`)
  }
  return {
    start: parseLifecycleTrigger(value.start ?? "manual", "start", `${fieldName}.start`),
    stop: parseLifecycleTrigger(value.stop ?? "manual", "stop", `${fieldName}.stop`),
  }
}

function normalizeCollector(raw: unknown, id: string): AimdCollectorField {
  if (!COLLECTOR_ID_PATTERN.test(id)) {
    throw new Error(`collectors.${id} must use an identifier key`)
  }
  if (!isPlainObject(raw)) {
    throw new Error(`collectors.${id} must be a mapping/object`)
  }

  const fieldName = `collectors.${id}`
  const connector = requiredString(raw.connector, `${fieldName}.connector`)
  const modeText = optionalString(raw.mode, `${fieldName}.mode`) ?? "snapshot"
  if (!MODES.has(modeText as AimdCollectorMode)) {
    throw new Error(`${fieldName}.mode must be snapshot, polling, or stream`)
  }
  const mode = modeText as AimdCollectorMode
  const interval = optionalString(raw.interval, `${fieldName}.interval`)
  let intervalMs: number | undefined
  if (mode === "polling") {
    if (!interval) throw new Error(`${fieldName}.interval is required for polling mode`)
    intervalMs = parseDurationToMs(interval)
    if (intervalMs === undefined || intervalMs <= 0) {
      throw new Error(`${fieldName}.interval must be a positive duration such as 250ms, 5s, or 1min`)
    }
  }
  else if (interval) {
    throw new Error(`${fieldName}.interval is only valid for polling mode`)
  }

  const manualFallback = raw.manual_fallback ?? false
  if (typeof manualFallback !== "boolean") {
    throw new Error(`${fieldName}.manual_fallback must be a boolean`)
  }

  const collector: AimdCollectorField = {
    ...raw,
    id,
    connector,
    mode,
    lifecycle: normalizeLifecycle(raw.lifecycle, `${fieldName}.lifecycle`),
    manual_fallback: manualFallback,
  }

  const channel = optionalString(raw.channel, `${fieldName}.channel`)
  if (channel) collector.channel = channel
  if (interval && intervalMs !== undefined) {
    collector.interval = interval
    collector.interval_ms = intervalMs
  }
  const title = optionalString(raw.title, `${fieldName}.title`)
  if (title) collector.title = title

  return collector
}

export function parseCollectorsContent(content: string): AimdCollectorsField {
  const data = parseYamlMapping(content)
  const version = data.version
  if (version !== undefined && typeof version !== "string" && typeof version !== "number") {
    throw new Error("collectors.version must be a string or number")
  }

  let rawCollectors: Record<string, unknown>
  if (data.collectors !== undefined && data.collectors !== null) {
    const extraKeys = Object.keys(data).filter(key => key !== "version" && key !== "collectors")
    if (extraKeys.length > 0) {
      throw new Error("collectors block must not mix top-level collector ids with collectors.collectors")
    }
    if (!isPlainObject(data.collectors)) {
      throw new Error("collectors.collectors must be a mapping/object")
    }
    rawCollectors = data.collectors
  }
  else {
    rawCollectors = Object.fromEntries(Object.entries(data).filter(([key]) => key !== "version"))
  }

  const collectors: Record<string, AimdCollectorField> = {}
  for (const [id, raw] of Object.entries(rawCollectors)) {
    collectors[id] = normalizeCollector(raw, id)
  }
  if (Object.keys(collectors).length === 0) {
    throw new Error("collectors block must contain at least one collector")
  }

  return {
    ...(version !== undefined ? { version } : {}),
    collectors,
    raw: content,
  }
}
