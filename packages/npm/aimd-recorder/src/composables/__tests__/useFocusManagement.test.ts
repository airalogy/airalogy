import { describe, expect, it, vi } from 'vitest'

import { captureFocusSnapshot, restoreFocusSnapshot } from '../useFocusManagement'

describe('useFocusManagement', () => {
  it('captures and restores focus selection for recorder inputs', () => {
    const contentRoot = document.createElement('div')
    const input = document.createElement('input')
    input.dataset.recFocusKey = 'var:sample_name'
    input.value = 'hello'
    contentRoot.appendChild(input)
    document.body.appendChild(contentRoot)

    input.focus()
    input.setSelectionRange(1, 4, 'forward')

    const snapshot = captureFocusSnapshot(contentRoot)
    expect(snapshot).toMatchObject({
      key: 'var:sample_name',
      selectionStart: 1,
      selectionEnd: 4,
      selectionDirection: 'forward',
    })

    const focusSpy = vi.spyOn(input, 'focus')
    restoreFocusSnapshot(contentRoot, snapshot)

    expect(focusSpy).toHaveBeenCalled()
    expect(document.activeElement).toBe(input)

    focusSpy.mockRestore()
    contentRoot.remove()
  })

  it('restores scrollable ancestor positions after rebuild focus restoration', () => {
    const contentRoot = document.createElement('div')
    const scroller = document.createElement('div')
    const input = document.createElement('input')

    scroller.style.overflow = 'auto'
    Object.defineProperty(scroller, 'scrollHeight', { value: 500, configurable: true })
    Object.defineProperty(scroller, 'clientHeight', { value: 120, configurable: true })
    scroller.scrollTop = 180

    input.dataset.recFocusKey = 'var:temperature'
    scroller.appendChild(contentRoot)
    contentRoot.appendChild(input)
    document.body.appendChild(scroller)

    input.focus()
    const snapshot = captureFocusSnapshot(contentRoot)
    expect(snapshot?.scrollTargets?.[0]?.top).toBe(180)

    scroller.scrollTop = 0
    const focusSpy = vi.spyOn(input, 'focus').mockImplementation(() => {
      scroller.scrollTop = 0
    })

    restoreFocusSnapshot(contentRoot, snapshot)

    expect(scroller.scrollTop).toBe(180)

    focusSpy.mockRestore()
    scroller.remove()
  })
})
