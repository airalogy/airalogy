// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import WorkspaceImportButton from './WorkspaceImportButton.vue'

const { cleanup, computePosition } = vi.hoisted(() => ({ cleanup: vi.fn(), computePosition: vi.fn(async () => ({ x: 12, y: 80 })) }))
vi.mock('@floating-ui/dom', () => ({
  computePosition, autoUpdate: (_reference: unknown, _floating: unknown, update: () => void) => { update(); return cleanup },
  offset: vi.fn(), flip: vi.fn(), shift: vi.fn(), size: vi.fn(),
}))
const wrappers: VueWrapper[] = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); document.body.innerHTML = ''; vi.clearAllMocks(); vi.useRealTimers() })
function create() {
  const wrapper = mount(WorkspaceImportButton, { attachTo: document.body, props: { label: 'Import package', hint: 'Import .aira packages.\nImages use relative paths.' } })
  wrappers.push(wrapper)
  return wrapper
}

describe('import package hint', () => {
  it('escapes clipping ancestors, preserves only intended line breaks, and uses viewport-aware placement', async () => {
    const wrapper = create()
    await wrapper.get('button').trigger('mouseenter')
    await flushPromises()
    const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]')!
    expect(tooltip.parentElement).toBe(document.body)
    expect(tooltip.textContent).toBe('Import .aira packages.\nImages use relative paths.')
    expect(tooltip.style.left).toBe('12px')
    expect(tooltip.style.top).toBe('80px')
    expect(computePosition).toHaveBeenCalledWith(wrapper.get('button').element, tooltip, expect.objectContaining({ strategy: 'fixed', placement: 'bottom-start' }))
    expect(wrapper.get('button').attributes('aria-describedby')).toBe(tooltip.id)
  })

  it('supports keyboard focus, Escape and cleanup', async () => {
    const wrapper = create()
    await wrapper.get('button').trigger('focus')
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
    expect(cleanup).toHaveBeenCalled()
    await wrapper.get('button').trigger('focus')
    await flushPromises()
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('stays open while hovering the hint and closes after leaving', async () => {
    const wrapper = create()
    await wrapper.get('button').trigger('mouseenter')
    await flushPromises()
    vi.useFakeTimers()
    await wrapper.get('button').trigger('mouseleave')
    document.querySelector('[role="tooltip"]')!.dispatchEvent(new MouseEvent('mouseenter'))
    await vi.advanceTimersByTimeAsync(200)
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull()
    document.querySelector('[role="tooltip"]')!.dispatchEvent(new MouseEvent('mouseleave'))
    await vi.advanceTimersByTimeAsync(200)
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
  })
})
