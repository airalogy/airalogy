import type { AimdStepField, AimdStepTimerMode } from "@airalogy/aimd-core/types"
import type { AimdCheckRecordItem, AimdStepRecordItem } from "../types"

export function createEmptyCheckRecordItem(): AimdCheckRecordItem {
  return {
    checked: false,
    annotation: "",
  }
}

export function createEmptyStepRecordItem(): AimdStepRecordItem {
  return {
    ...createEmptyCheckRecordItem(),
    elapsed_ms: 0,
    timer_started_at_ms: null,
    started_at_ms: null,
    ended_at_ms: null,
  }
}

function normalizeFiniteNumber(value: unknown, fallback: number | null = 0): number | null {
  if (value == null) {
    return fallback
  }

  const numeric = typeof value === "number"
    ? value
    : (typeof value === "string" && value.trim() ? Number(value) : Number.NaN)

  if (!Number.isFinite(numeric)) {
    return fallback
  }

  return Math.max(0, numeric)
}

export function isStepTimerRunning(step: Pick<AimdStepRecordItem, "timer_started_at_ms">): boolean {
  return typeof step.timer_started_at_ms === "number" && Number.isFinite(step.timer_started_at_ms)
}

export function getStepElapsedMs(step: Pick<AimdStepRecordItem, "elapsed_ms" | "timer_started_at_ms">, nowMs = Date.now()): number {
  const storedElapsedMs = normalizeFiniteNumber(step.elapsed_ms, 0) ?? 0
  if (!isStepTimerRunning(step)) {
    return storedElapsedMs
  }

  const timerStartedAtMs = normalizeFiniteNumber(step.timer_started_at_ms, null)
  if (timerStartedAtMs == null) {
    return storedElapsedMs
  }

  return storedElapsedMs + Math.max(0, nowMs - timerStartedAtMs)
}

export function startStepTimer(step: AimdStepRecordItem, nowMs = Date.now()): boolean {
  if (isStepTimerRunning(step)) {
    return false
  }

  if (step.started_at_ms == null) {
    step.started_at_ms = nowMs
  }
  step.timer_started_at_ms = nowMs
  step.ended_at_ms = null
  return true
}

export function pauseStepTimer(step: AimdStepRecordItem, nowMs = Date.now()): boolean {
  if (!isStepTimerRunning(step)) {
    return false
  }

  step.elapsed_ms = getStepElapsedMs(step, nowMs)
  step.timer_started_at_ms = null
  if (step.started_at_ms == null) {
    step.started_at_ms = nowMs
  }
  step.ended_at_ms = nowMs
  return true
}

export function resetStepTimer(step: AimdStepRecordItem): boolean {
  const hadTimingData = (
    step.elapsed_ms > 0
    || step.timer_started_at_ms != null
    || step.started_at_ms != null
    || step.ended_at_ms != null
  )

  step.elapsed_ms = 0
  step.timer_started_at_ms = null
  step.started_at_ms = null
  step.ended_at_ms = null

  return hadTimingData
}

export function setStepChecked(step: AimdStepRecordItem, checked: boolean, nowMs = Date.now()): boolean {
  if (checked && isStepTimerRunning(step)) {
    pauseStepTimer(step, nowMs)
  }

  const changed = step.checked !== checked
  step.checked = checked
  return changed
}

export function formatStepDuration(ms: number, locale: string | undefined): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const days = Math.floor(totalSeconds / (24 * 3600))
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const zh = locale?.toLowerCase().startsWith("zh")

  const parts: string[] = []
  if (days > 0) {
    parts.push(zh ? `${days}天` : `${days}d`)
  }
  if (hours > 0) {
    parts.push(zh ? `${hours}小时` : `${hours}h`)
  }
  if (minutes > 0) {
    parts.push(zh ? `${minutes}分` : `${minutes}m`)
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(zh ? `${seconds}秒` : `${seconds}s`)
  }

  return zh ? parts.join("") : parts.join(" ")
}

export function resolveStepTimerMode(
  step: Pick<AimdStepField, "timer_mode" | "estimated_duration_ms">,
): AimdStepTimerMode {
  const configuredMode = step.timer_mode ?? "elapsed"
  const estimate = normalizeFiniteNumber(step.estimated_duration_ms, null)

  if ((configuredMode === "countdown" || configuredMode === "both") && (estimate == null || estimate <= 0)) {
    return "elapsed"
  }

  return configuredMode
}

export function getStepRemainingMs(
  step: Pick<AimdStepRecordItem, "elapsed_ms" | "timer_started_at_ms">,
  estimatedDurationMs: number | undefined,
  nowMs = Date.now(),
): number | undefined {
  const estimate = normalizeFiniteNumber(estimatedDurationMs, null)
  if (estimate == null || estimate <= 0) {
    return undefined
  }

  return estimate - getStepElapsedMs(step, nowMs)
}

export function isStepTimerWarning(
  remainingMs: number | undefined,
  estimatedDurationMs: number | undefined,
): boolean {
  const estimate = normalizeFiniteNumber(estimatedDurationMs, null)
  if (estimate == null || estimate <= 0 || remainingMs == null || remainingMs <= 0) {
    return false
  }

  return remainingMs <= 10_000 || remainingMs / estimate <= 0.2
}

export function getProtocolEstimatedDurationMs(steps: AimdStepField[] | undefined): number {
  if (!steps?.length) {
    return 0
  }

  const byId = new Map(steps.map(step => [step.id, step]))
  let total = 0

  for (const step of steps) {
    if (typeof step.estimated_duration_ms !== "number" || !Number.isFinite(step.estimated_duration_ms) || step.estimated_duration_ms <= 0) {
      continue
    }

    let coveredByAncestor = false
    let parentId = step.parent_id
    while (parentId) {
      const parent = byId.get(parentId)
      if (!parent) {
        break
      }
      if (typeof parent.estimated_duration_ms === "number" && Number.isFinite(parent.estimated_duration_ms) && parent.estimated_duration_ms > 0) {
        coveredByAncestor = true
        break
      }
      parentId = parent.parent_id
    }

    if (!coveredByAncestor) {
      total += step.estimated_duration_ms
    }
  }

  return total
}

export function getProtocolRecordedDurationMs(
  steps: Record<string, AimdStepRecordItem>,
  nowMs = Date.now(),
): number {
  return Object.values(steps).reduce((total, step) => total + getStepElapsedMs(step, nowMs), 0)
}

export function hasRecordedStepDuration(step: Pick<AimdStepRecordItem, "elapsed_ms" | "timer_started_at_ms" | "started_at_ms" | "ended_at_ms">): boolean {
  return (
    getStepElapsedMs(step as Pick<AimdStepRecordItem, "elapsed_ms" | "timer_started_at_ms">) > 0
    || step.started_at_ms != null
    || step.ended_at_ms != null
  )
}

export function normalizeStepTimerState(value: unknown): Pick<AimdStepRecordItem, "elapsed_ms" | "timer_started_at_ms" | "started_at_ms" | "ended_at_ms"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      elapsed_ms: 0,
      timer_started_at_ms: null,
      started_at_ms: null,
      ended_at_ms: null,
    }
  }

  const obj = value as Record<string, unknown>
  const elapsed_ms = normalizeFiniteNumber(obj.elapsed_ms, 0) ?? 0
  const timer_started_at_ms = normalizeFiniteNumber(obj.timer_started_at_ms, null)
  const started_at_ms = normalizeFiniteNumber(obj.started_at_ms, null)
  const ended_at_ms = normalizeFiniteNumber(obj.ended_at_ms, null)

  return {
    elapsed_ms,
    timer_started_at_ms,
    started_at_ms,
    ended_at_ms,
  }
}
