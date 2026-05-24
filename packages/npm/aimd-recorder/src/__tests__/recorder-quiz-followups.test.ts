import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const quizNode = {
    type: 'aimd',
    fieldType: 'quiz',
    id: 'quiz_followup',
    raw: '',
    quizType: 'choice',
    stem: 'Do you smoke?',
    mode: 'single',
    options: [
      {
        key: 'yes',
        text: 'Yes',
        followups: [
          { key: 'years', type: 'int', required: true, title: 'Years' },
        ],
      },
      { key: 'no', text: 'No' },
    ],
  }

  const fields = {
    var: [],
    var_definitions: [],
    var_table: [],
    client_assigner: [],
    quiz: [
      {
        id: 'quiz_followup',
        type: 'choice',
        stem: 'Do you smoke?',
        mode: 'single',
        options: quizNode.options,
      },
    ],
    step: [],
    check: [],
    ref_step: [],
    ref_var: [],
    ref_fig: [],
    cite: [],
    fig: [],
  }

  return {
    parseAndExtract: vi.fn(() => fields),
    renderToVue: vi.fn(async (
      _content: string,
      options: { aimdRenderers: { quiz: (node: unknown) => unknown } },
    ) => ({
      fields,
      nodes: [options.aimdRenderers.quiz(quizNode)],
    })),
  }
})

vi.mock('@airalogy/aimd-renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@airalogy/aimd-renderer')>()
  return {
    ...actual,
    parseAndExtract: mocks.parseAndExtract,
    renderToVue: mocks.renderToVue,
  }
})

import AimdRecorder from '../components/AimdRecorder.vue'

describe('AimdRecorder quiz followups', () => {
  it('rebuilds inline quiz widgets so followups appear after selecting an option', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: 'mock content',
        locale: 'en-US',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('Years')

    const yesInput = wrapper.find('input[type="radio"][value="yes"]')
    expect(yesInput.exists()).toBe(true)

    await yesInput.setValue()
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Years')
    expect(wrapper.find('input[data-rec-focus-key="quiz:quiz_followup:single:yes:followup:years"]').exists()).toBe(true)
    expect(mocks.renderToVue).toHaveBeenCalledTimes(2)
  })
})
