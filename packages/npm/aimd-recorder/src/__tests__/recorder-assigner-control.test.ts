import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  parseAndExtract: vi.fn(),
  renderToVue: vi.fn(),
}))

vi.mock('@airalogy/aimd-renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@airalogy/aimd-renderer')>()
  return {
    ...actual,
    parseAndExtract: mocks.parseAndExtract,
    renderToVue: mocks.renderToVue,
  }
})

import AimdRecorder from '../components/AimdRecorder.vue'

const varNode = {
  type: 'aimd',
  fieldType: 'var',
  id: 'ic50',
  name: 'ic50',
  label: 'ic50',
  raw: '{{var|ic50: float}}',
  scope: 'var',
  definition: {
    name: 'ic50',
    type: 'float',
  },
}

const fields = {
  var: ['ic50'],
  var_definitions: [{ name: 'ic50', type: 'float' }],
  var_table: [],
  client_assigner: [],
  quiz: [],
  step: [],
  check: [],
  ref_step: [],
  ref_var: [],
  ref_fig: [],
  cite: [],
  fig: [],
}

describe('AimdRecorder assigner controls', () => {
  let currentFields: any = fields

  beforeEach(() => {
    currentFields = fields
    mocks.parseAndExtract.mockImplementation(() => currentFields)
    mocks.renderToVue.mockImplementation(async (
      _content: string,
      options: { aimdRenderers: { var: (node: unknown) => unknown } },
    ) => ({
      fields: currentFields,
      nodes: [options.aimdRenderers.var(varNode)],
    }))
  })

  it('renders a built-in assigner button from field metadata and emits requests', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: '{{var|ic50: float}}',
        locale: 'en-US',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
        fieldMeta: {
          'var:ic50': {
            assigner: { mode: 'manual' },
          },
        },
      },
    })

    await flushPromises()
    await nextTick()

    const button = wrapper.find('.aimd-rec-assigner-field__button')
    expect(button.exists()).toBe(true)
    expect(button.text()).toBe('Run Assigner')

    await button.trigger('click')

    expect(wrapper.emitted('assigner-request')?.[0]?.[0]).toMatchObject({
      section: 'var',
      fieldKey: 'ic50',
    })
  })

  it('shows localized loading and error state for assigner fields', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: '{{var|ic50: float}}',
        locale: 'zh-CN',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
        fieldMeta: {
          'var:ic50': {
            assigner: { mode: 'manual' },
          },
        },
        fieldState: {
          'var:ic50': {
            loading: true,
            error: '计算失败',
          },
        },
      },
    })

    await flushPromises()
    await nextTick()

    const button = wrapper.find('.aimd-rec-assigner-field__button')
    expect(button.text()).toBe('运行中')
    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper.find('.aimd-rec-assigner-field__error').text()).toBe('计算失败')
  })

  it('mounts manual client assigners from AIMD metadata onto assigned fields', async () => {
    currentFields = {
      ...fields,
      client_assigner: [{
        id: 'manual_ic50',
        runtime: 'client',
        mode: 'manual',
        dependent_fields: [],
        assigned_fields: ['ic50'],
        function_source: 'function assign(fields) { return { ic50: 12.5 }; }',
      }],
    }

    const wrapper = mount(AimdRecorder, {
      props: {
        content: '{{var|ic50: float}}',
        locale: 'en-US',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
      },
    })

    await flushPromises()
    await nextTick()

    const button = wrapper.find('.aimd-rec-assigner-field__button')
    expect(button.exists()).toBe(true)

    await button.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('assigner-request')).toBeUndefined()
    const updates = wrapper.emitted('update:modelValue') ?? []
    const latestRecord = updates[updates.length - 1]?.[0] as { var?: Record<string, unknown> } | undefined
    expect(latestRecord?.var?.ic50).toBe(12.5)
  })
})
