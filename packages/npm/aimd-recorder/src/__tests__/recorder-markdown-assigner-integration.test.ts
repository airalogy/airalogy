import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import AimdRecorder from '../components/AimdRecorder.vue'

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

describe('AimdRecorder markdown assigner integration', () => {
  it('shows an auto server assigner button on parsed AiralogyMarkdown fields', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: '图生成状态：{{var|graph_generation_note: AiralogyMarkdown = "", title = "图生成状态"}}',
        locale: 'zh-CN',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
        serverAssigners: {
          graph_generation_note: {
            mode: 'auto',
            dependent_fields: ['site_csv_file'],
          },
        },
      },
    })

    await flushPromises()
    await nextTick()
    await vi.dynamicImportSettled()
    await nextTick()

    expect(wrapper.find('.aimd-markdown-field__assigner-action .aimd-rec-assigner-field__button').exists()).toBe(true)
  })
})
