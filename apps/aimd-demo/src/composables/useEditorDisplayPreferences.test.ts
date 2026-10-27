import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { EDITOR_FIELD_DISPLAY_KEY, useEditorDisplayPreferences } from './useEditorDisplayPreferences'

describe('editor display preferences', () => {
  it('defaults to detailed without writing into template or record storage', () => {
    const scope = effectScope()
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() }
    const prefs = scope.run(() => useEditorDisplayPreferences({ storage }))!
    expect(prefs.showFieldDetails.value).toBe(true)
    expect(storage.setItem).not.toHaveBeenCalled()
    prefs.showFieldDetails.value = false
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(EDITOR_FIELD_DISPLAY_KEY, 'compact')
    prefs.showFieldDetails.value = true
    expect(storage.setItem).toHaveBeenLastCalledWith(EDITOR_FIELD_DISPLAY_KEY, 'detailed')
    scope.stop()
  })

  it('restores an existing preference and ignores unrecognized values', () => {
    for (const [value, expected] of [['detailed', true], ['compact', false], ['invalid', true]] as const) {
      const scope = effectScope()
      const prefs = scope.run(() => useEditorDisplayPreferences({ storage: { getItem: () => value, setItem() {} } }))!
      expect(prefs.showFieldDetails.value).toBe(expected)
      scope.stop()
    }
  })

  it('lets the app configure the initial display without overriding a saved preference', () => {
    for (const saved of [null, 'invalid', 'detailed', 'compact']) {
      const scope = effectScope()
      const prefs = scope.run(() => useEditorDisplayPreferences({
        defaultDisplay: 'compact', storage: { getItem: () => saved, setItem() {} },
      }))!
      expect(prefs.showFieldDetails.value).toBe(saved === 'detailed')
      scope.stop()
    }
  })

  it('restores the user choice on the next visit', () => {
    let saved: string | null = null
    const storage = { getItem: () => saved, setItem(_key: string, value: string) { saved = value } }
    const first = effectScope()
    const prefs = first.run(() => useEditorDisplayPreferences({ storage }))!
    prefs.showFieldDetails.value = false
    first.stop()
    const second = effectScope()
    expect(second.run(() => useEditorDisplayPreferences({ storage }))!.showFieldDetails.value).toBe(false)
    second.stop()
  })

  it('keeps editing available when browser storage is blocked', () => {
    const scope = effectScope()
    const prefs = scope.run(() => useEditorDisplayPreferences({
      storage: { getItem() { throw new Error('blocked') }, setItem() { throw new Error('quota exceeded') } },
    }))!
    expect(prefs.showFieldDetails.value).toBe(true)
    expect(() => { prefs.showFieldDetails.value = false }).not.toThrow()
    expect(prefs.showFieldDetails.value).toBe(false)
    scope.stop()
  })
})
