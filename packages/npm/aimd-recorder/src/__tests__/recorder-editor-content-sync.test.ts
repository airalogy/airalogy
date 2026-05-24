import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@airalogy/aimd-editor/vue', () => ({
  AimdEditor: defineComponent({
    name: 'AimdEditorMock',
    props: {
      modelValue: {
        type: String,
        default: '',
      },
      mode: {
        type: String,
        default: 'source',
      },
    },
    emits: ['update:modelValue', 'update:mode', 'ready'],
    setup(props, { emit }) {
      return () => h('textarea', {
        class: 'aimd-editor-mock',
        value: props.modelValue,
        'data-mode': props.mode,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLTextAreaElement).value),
      })
    },
  }),
}))

vi.mock('../components/AimdRecorder.vue', () => ({
  default: defineComponent({
    name: 'AimdRecorderMock',
    props: {
      content: {
        type: String,
        default: '',
      },
    },
    setup(props) {
      return () => h('div', {
        class: 'aimd-recorder-mock',
        'data-content': props.content,
      })
    },
  }),
}))

vi.mock('../components/AimdRecorderWysiwygSurface.vue', () => ({
  default: defineComponent({
    name: 'AimdRecorderWysiwygSurfaceMock',
    props: {
      content: {
        type: String,
        default: '',
      },
    },
    emits: ['update:content'],
    setup(props) {
      return () => h('div', {
        class: 'aimd-recorder-wysiwyg-surface-mock',
        'data-content': props.content,
      })
    },
  }),
}))

import AimdRecorderEditor from '../components/AimdRecorderEditor.vue'

async function flushUi() {
  await Promise.resolve()
  await nextTick()
}

describe('AimdRecorderEditor content sync', () => {
  it('keeps the source editor on the latest local draft while parent content echoes catch up', async () => {
    const wrapper = mount(AimdRecorderEditor, {
      props: {
        content: '',
        locale: 'en-US',
      },
    })

    const sourceEditor = () => wrapper.find('.aimd-editor-mock')

    await sourceEditor().setValue('a')
    await flushUi()
    await sourceEditor().setValue('ab')
    await flushUi()

    expect((sourceEditor().element as HTMLTextAreaElement).value).toBe('ab')
    expect(wrapper.emitted('update:content')?.map(event => event[0])).toEqual(['a', 'ab'])

    await wrapper.setProps({ content: 'a' })
    await flushUi()
    expect((sourceEditor().element as HTMLTextAreaElement).value).toBe('ab')

    await wrapper.setProps({ content: 'ab' })
    await flushUi()
    expect((sourceEditor().element as HTMLTextAreaElement).value).toBe('ab')
    expect(wrapper.find('.aimd-recorder-mock').attributes('data-content')).toBe('ab')
  })

  it('debounces source-to-visual syncing so the recorder-aware WYSIWYG does not rebuild on every keystroke', async () => {
    vi.useFakeTimers()

    try {
      const wrapper = mount(AimdRecorderEditor, {
        props: {
          content: '',
          locale: 'en-US',
          initialVisualEditMode: true,
        },
      })

      const sourceEditor = () => wrapper.find('.aimd-editor-mock')
      const visualSurface = () => wrapper.find('.aimd-recorder-wysiwyg-surface-mock')

      expect(visualSurface().attributes('data-content')).toBe('')

      await sourceEditor().setValue('a')
      await flushUi()
      expect(visualSurface().attributes('data-content')).toBe('')

      await sourceEditor().setValue('ab')
      await flushUi()
      expect(visualSurface().attributes('data-content')).toBe('')

      await vi.advanceTimersByTimeAsync(120)
      await flushUi()

      expect(visualSurface().attributes('data-content')).toBe('ab')
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores stale visual echoes while the source editor is the active content surface', async () => {
    vi.useFakeTimers()

    try {
      const wrapper = mount(AimdRecorderEditor, {
        attachTo: document.body,
        props: {
          content: '',
          locale: 'en-US',
          initialVisualEditMode: true,
        },
      })

      const sourceEditor = () => wrapper.find('.aimd-editor-mock')
      const visualSurface = () => wrapper.findComponent({ name: 'AimdRecorderWysiwygSurfaceMock' })

      await sourceEditor().trigger('focusin')
      await sourceEditor().setValue('a')
      await flushUi()
      await sourceEditor().setValue('ab')
      await flushUi()

      await visualSurface().vm.$emit('update:content', 'a')
      await flushUi()

      expect((sourceEditor().element as HTMLTextAreaElement).value).toBe('ab')
      expect(wrapper.emitted('update:content')?.map(event => event[0])).toEqual(['a', 'ab'])

      await vi.advanceTimersByTimeAsync(120)
      await flushUi()
      expect(visualSurface().attributes('data-content')).toBe('ab')
    } finally {
      vi.useRealTimers()
    }
  })
})
