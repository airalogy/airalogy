import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import type { AimdTypePluginRenderContext } from '../types'

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

vi.mock('@airalogy/aimd-editor/vue', async () => {
  const { defineComponent, h } = await import('vue')

  return {
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

const pluginVarNode = {
  type: 'aimd',
  fieldType: 'var',
  id: 'report',
  name: 'report',
  label: 'report',
  raw: '{{var|report: ReportDoc}}',
  scope: 'var',
  definition: {
    name: 'report',
    type: 'ReportDoc',
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
  let currentVarNode: any = varNode

  beforeEach(() => {
    currentFields = fields
    currentVarNode = varNode
    mocks.parseAndExtract.mockImplementation(() => currentFields)
    mocks.renderToVue.mockImplementation(async (
      _content: string,
      options: { aimdRenderers: { var: (node: unknown) => unknown } },
    ) => ({
      fields: currentFields,
      nodes: [options.aimdRenderers.var(currentVarNode)],
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
    expect(wrapper.find('.aimd-rec-inline--has-assigner-control').exists()).toBe(true)
    expect(wrapper.find('.aimd-rec-inline__assigner-prefix').exists()).toBe(true)
    expect(wrapper.find('.aimd-rec-inline__assigner-status').exists()).toBe(true)
    expect(wrapper.find('.aimd-rec-assigner-field--var').exists()).toBe(false)

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
    expect(wrapper.find('.aimd-rec-inline__assigner-error').text()).toBe('计算失败')
    expect(wrapper.find('.aimd-rec-assigner-field__status--loading').exists()).toBe(true)
  })

  it('rebuilds assigner controls when runtime field metadata arrives after mount', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: '{{var|ic50: float}}',
        locale: 'en-US',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
      },
    })

    await flushPromises()
    await nextTick()
    expect(wrapper.find('.aimd-rec-assigner-field__button').exists()).toBe(false)

    await wrapper.setProps({
      fieldMeta: {
        'var:ic50': {
          assigner: { mode: 'manual' },
        },
      },
    })
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.aimd-rec-assigner-field__button').text()).toBe('Run Assigner')

    await wrapper.setProps({
      fieldMeta: {
        'var:ic50': {
          assigner: { mode: 'manual' },
        },
      },
      fieldState: {
        'var:ic50': {
          loading: true,
        },
      },
    })
    await flushPromises()
    await nextTick()

    const button = wrapper.find('.aimd-rec-assigner-field__button')
    expect(button.text()).toBe('Running')
    expect(button.attributes('disabled')).toBeDefined()
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

  it('mounts assigner controls inside type-plugin variable fields that support inline assigners', async () => {
    currentVarNode = pluginVarNode
    currentFields = {
      ...fields,
      var: ['report'],
      var_definitions: [{ name: 'report', type: 'ReportDoc' }],
    }

    const wrapper = mount(AimdRecorder, {
      props: {
        content: '{{var|report: ReportDoc}}',
        locale: 'zh-CN',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
        typePlugins: [{
          type: 'ReportDoc',
          inputKind: 'textarea',
          supportsInlineAssignerControl: true,
          renderField: (context: AimdTypePluginRenderContext) => h('div', {
            class: 'custom-inline-assigner-field',
          }, [
            h('span', { class: 'custom-inline-assigner-action' }, [
              context.assignerControl,
            ]),
            h('span', { class: 'custom-inline-assigner-state' }, [
              context.assignerStatus,
            ]),
          ]),
        }],
        fieldMeta: {
          'var:report': {
            assigner: { mode: 'manual' },
          },
        },
      },
    })

    await flushPromises()
    await nextTick()
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.custom-inline-assigner-field').exists()).toBe(true)
    expect(wrapper.find('.custom-inline-assigner-action .aimd-rec-assigner-field__button').exists()).toBe(true)
    expect(wrapper.find('.custom-inline-assigner-state .aimd-rec-assigner-field__status').exists()).toBe(true)
    expect(wrapper.find('.aimd-rec-assigner-field--var').exists()).toBe(false)
  })
})
