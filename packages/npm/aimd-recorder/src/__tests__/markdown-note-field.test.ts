import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

const { renderToVueMock } = vi.hoisted(() => ({
  renderToVueMock: vi.fn(),
}))

vi.mock('@airalogy/aimd-editor/vue', () => ({
  AimdEditor: defineComponent({
    name: 'AimdEditorMock',
    props: {
      modelValue: {
        type: String,
        default: '',
      },
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () => h('textarea', {
        class: 'aimd-editor-mock',
        value: props.modelValue,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLTextAreaElement).value),
      })
    },
  }),
}))

vi.mock('@airalogy/aimd-renderer', () => ({
  renderToVue: renderToVueMock,
}))

import AimdMarkdownNoteField from '../components/AimdMarkdownNoteField.vue'

async function flushUi() {
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}

describe('AimdMarkdownNoteField', () => {
  it('renders saved notes as compact markdown preview by default', async () => {
    renderToVueMock.mockImplementation(async (content: string) => ({
      nodes: [h('div', { class: 'aimd-rendered-note' }, `rendered:${content}`)],
      fields: {},
    }))

    const wrapper = mount(AimdMarkdownNoteField, {
      props: {
        modelValue: '**keep cold**',
        locale: 'en-US',
      },
    })

    await flushUi()

    expect(renderToVueMock).toHaveBeenCalledWith('**keep cold**', { locale: 'en-US' })
    expect(wrapper.find('.aimd-markdown-note-field__preview').exists()).toBe(true)
    expect(wrapper.find('.aimd-rendered-note').text()).toContain('rendered:**keep cold**')
    expect(wrapper.find('.aimd-editor-mock').exists()).toBe(false)
  })

  it('switches to editor mode only when the user asks to edit', async () => {
    renderToVueMock.mockImplementation(async (content: string) => ({
      nodes: [h('div', { class: 'aimd-rendered-note' }, `rendered:${content}`)],
      fields: {},
    }))

    const wrapper = mount(AimdMarkdownNoteField, {
      props: {
        modelValue: '- add buffer',
        locale: 'en-US',
      },
    })

    await flushUi()
    await wrapper.find('.aimd-markdown-note-field__preview-edit').trigger('click')
    await nextTick()

    expect(wrapper.find('.aimd-editor-mock').exists()).toBe(true)
    expect(wrapper.find('.aimd-markdown-note-field__preview').exists()).toBe(false)
  })

  it('opens empty notes directly in editor mode', () => {
    const wrapper = mount(AimdMarkdownNoteField, {
      props: {
        modelValue: '',
        locale: 'en-US',
      },
    })

    expect(wrapper.find('.aimd-editor-mock').exists()).toBe(true)
    expect(wrapper.find('.aimd-markdown-note-field__preview').exists()).toBe(false)
  })

  it('returns to preview mode after blur when the note has content', async () => {
    renderToVueMock.mockImplementation(async (content: string) => ({
      nodes: [h('div', { class: 'aimd-rendered-note' }, `rendered:${content}`)],
      fields: {},
    }))

    const wrapper = mount(AimdMarkdownNoteField, {
      props: {
        modelValue: '',
        locale: 'en-US',
      },
      attachTo: document.body,
    })

    await wrapper.find('.aimd-editor-mock').setValue('Use **fresh** tip')
    await wrapper.trigger('focusout', { relatedTarget: document.body })
    await flushUi()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Use **fresh** tip'])
    expect(wrapper.emitted('blur')).toBeTruthy()
    expect(wrapper.find('.aimd-markdown-note-field__preview').exists()).toBe(true)
    expect(wrapper.find('.aimd-editor-mock').exists()).toBe(false)

    wrapper.unmount()
  })

  it('offers an explicit close action while editing notes', async () => {
    const wrapper = mount(AimdMarkdownNoteField, {
      props: {
        modelValue: '',
        locale: 'en-US',
      },
    })

    await wrapper.find('.aimd-markdown-note-field__editor-close').trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('blur')).toBeTruthy()
  })
})
