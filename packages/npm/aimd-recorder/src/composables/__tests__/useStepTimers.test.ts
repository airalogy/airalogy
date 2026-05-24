import { describe, expect, it } from 'vitest'

import {
  createEmptyStepRecordItem,
  formatStepDuration,
  getProtocolEstimatedDurationMs,
  getStepElapsedMs,
  getStepRemainingMs,
  isStepTimerWarning,
  pauseStepTimer,
  resetStepTimer,
  resolveStepTimerMode,
  startStepTimer,
} from '../useStepTimers'

describe('useStepTimers', () => {
  it('formats durations in a compact human-readable form', () => {
    expect(formatStepDuration(3_723_000, 'en-US')).toBe('1h 2m 3s')
    expect(formatStepDuration(125_000, 'zh-CN')).toBe('2分5秒')
    expect(formatStepDuration(187_200_000, 'en-US')).toBe('2d 4h')
  })

  it('tracks elapsed time across start, pause, and reset', () => {
    const step = createEmptyStepRecordItem()

    expect(startStepTimer(step, 1_000)).toBe(true)
    expect(getStepElapsedMs(step, 2_500)).toBe(1_500)

    expect(pauseStepTimer(step, 4_000)).toBe(true)
    expect(step.elapsed_ms).toBe(3_000)

    expect(startStepTimer(step, 5_000)).toBe(true)
    expect(getStepElapsedMs(step, 6_500)).toBe(4_500)

    expect(resetStepTimer(step)).toBe(true)
    expect(step).toEqual(createEmptyStepRecordItem())
  })

  it('resolves countdown modes only when an estimate exists', () => {
    expect(resolveStepTimerMode({ timer_mode: 'countdown', estimated_duration_ms: 30_000 })).toBe('countdown')
    expect(resolveStepTimerMode({ timer_mode: 'both', estimated_duration_ms: 30_000 })).toBe('both')
    expect(resolveStepTimerMode({ timer_mode: 'countdown' })).toBe('elapsed')
  })

  it('computes remaining time and warning thresholds for countdown timers', () => {
    const step = createEmptyStepRecordItem()
    startStepTimer(step, 0)

    expect(getStepRemainingMs(step, 30_000, 15_000)).toBe(15_000)
    expect(isStepTimerWarning(15_000, 30_000)).toBe(false)
    expect(getStepRemainingMs(step, 30_000, 25_000)).toBe(5_000)
    expect(isStepTimerWarning(5_000, 30_000)).toBe(true)
    expect(getStepRemainingMs(step, 30_000, 35_000)).toBe(-5_000)
  })

  it('avoids double-counting child estimates when a parent step already has an estimate', () => {
    expect(getProtocolEstimatedDurationMs([
      { id: 'parent', estimated_duration_ms: 60_000 },
      { id: 'child_a', parent_id: 'parent', estimated_duration_ms: 10_000 },
      { id: 'child_b', parent_id: 'parent', estimated_duration_ms: 15_000 },
      { id: 'sibling', estimated_duration_ms: 5_000 },
    ])).toBe(65_000)
  })
})
