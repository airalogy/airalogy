/// <reference types="vite/client" />
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { parse } from 'vue/compiler-sfc'
import AimdInputFieldDialog from '../vue/AimdInputFieldDialog.vue'
import source from '../vue/AimdInputFieldDialog.vue?raw'
import { createAimdEditorMessages } from '../vue/locales'

const { descriptor } = parse(source)
const styles: HTMLStyleElement[] = []
const wrappers: VueWrapper[] = []

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  styles.splice(0).forEach(style => style.remove())
})

describe('input dialog layout', () => {
  it.each(['before', 'after'])('preserves centering when host resets load %s the component styles', async (resetOrder) => {
    const componentCss = descriptor.styles.map(style => style.content).join('\n')
    const resetCss = '* { margin: 0; padding: 0; box-sizing: border-box; }'
    for (const css of resetOrder === 'before' ? [resetCss, componentCss] : [componentCss, resetCss]) {
      const style = document.createElement('style')
      style.textContent = css
      document.head.append(style)
      styles.push(style)
    }
    const wrapper = mount(AimdInputFieldDialog, {
      attachTo: document.body,
      props: { visible: false, content: '', messages: createAimdEditorMessages('en-US') },
    })
    wrappers.push(wrapper)
    await wrapper.setProps({ visible: true })
    await flushPromises()

    const dialog = document.querySelector<HTMLDialogElement>('dialog.aimd-input-dialog')!
    const style = getComputedStyle(dialog)
    expect(dialog.open).toBe(true)
    expect(dialog.parentElement).toBe(document.body)
    expect(style.position).toBe('fixed')
    expect(style.getPropertyValue('inset')).toBe('0')
    for (const side of ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as const) {
      expect(style[side]).toBe('auto')
    }
    expect(style.maxHeight).toBe('calc(100dvh - 32px)')
    expect(style.overflow).toBe('auto')
    expect(document.activeElement).toBe(dialog.querySelector('input[name="title"]'))

    await wrapper.setProps({ visible: false })
    expect(dialog.open).toBe(false)
  })
})
