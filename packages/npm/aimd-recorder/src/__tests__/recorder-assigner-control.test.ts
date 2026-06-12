import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import type { AimdAssignerRunnerRequest, AimdTypePluginRenderContext } from '../types'

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

const varTableNode = {
  type: 'aimd',
  fieldType: 'var_table',
  scope: 'var_table',
  id: 'print_nodes',
  raw: '{{var_table|print_nodes}}',
  columns: ['site_id'],
  definition: {
    id: 'print_nodes',
    subvars: {
      site_id: {
        id: 'site_id',
        type: 'str',
      },
    },
  },
}

const varTableField = {
  id: 'print_nodes',
  subvars: [
    {
      id: 'site_id',
      type: 'str',
    },
  ],
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
  let currentVarNodes: any[] | null = null

  beforeEach(() => {
    currentFields = fields
    currentVarNode = varNode
    currentVarNodes = null
    mocks.parseAndExtract.mockImplementation(() => currentFields)
    mocks.renderToVue.mockImplementation(async (
      _content: string,
      options: { aimdRenderers: { var: (node: unknown) => unknown } },
    ) => ({
      fields: currentFields,
      nodes: (currentVarNodes ?? [currentVarNode]).map(node => options.aimdRenderers.var(node)),
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

  it('runs host assigners from parsed assigner metadata and applies assigned fields', async () => {
    const runServerAssigner = vi.fn(async (_request: AimdAssignerRunnerRequest) => ({
      data: {
        assigned_fields: {
          ic50: 42,
        },
      },
    }))

    const wrapper = mount(AimdRecorder, {
      props: {
        content: '{{var|ic50: float}}',
        locale: 'en-US',
        modelValue: {
          var: {
            source: '12',
            empty_input: '',
          },
          step: {},
          check: {},
          quiz: {},
        },
        serverAssigners: {
          ic50: {
            mode: 'manual',
            dependent_fields: ['source', 'empty_input'],
          },
        },
        runServerAssigner,
      },
    })

    await flushPromises()
    await nextTick()

    const button = wrapper.find('.aimd-rec-assigner-field__button')
    expect(button.exists()).toBe(true)

    await button.trigger('click')
    await flushPromises()
    await nextTick()

    expect(runServerAssigner).toHaveBeenCalledTimes(1)
    const [request] = (runServerAssigner.mock.calls[0] ?? []) as unknown as [AimdAssignerRunnerRequest]
    expect(request).toMatchObject({
      section: 'var',
      fieldKey: 'var:ic50',
      assignedField: 'ic50',
      dependentData: {
        source: '12',
      },
    })
    expect(wrapper.emitted('assigner-request')).toBeUndefined()

    const updates = wrapper.emitted('update:modelValue') ?? []
    const latestRecord = updates[updates.length - 1]?.[0] as { var?: Record<string, unknown> } | undefined
    expect(latestRecord?.var?.ic50).toBe(42)
  })

  it('keeps assigner controls visible after a list var receives assigned data', async () => {
    currentVarNode = {
      ...varNode,
      id: 'image_ids',
      name: 'image_ids',
      label: 'image_ids',
      raw: '{{var|image_ids: list[str]}}',
      definition: {
        id: 'image_ids',
        name: 'image_ids',
        type: 'list[str]',
      },
    }
    currentFields = {
      ...fields,
      var: ['image_ids'],
      var_definitions: [{ id: 'image_ids', name: 'image_ids', type: 'list[str]' }],
    }
    const runServerAssigner = vi.fn(async (_request: AimdAssignerRunnerRequest) => ({
      data: {
        assigned_fields: {
          image_ids: ['airalogy.id.file.image-a.png', 'airalogy.id.file.image-b.png'],
        },
      },
    }))

    const wrapper = mount(AimdRecorder, {
      props: {
        content: '{{var|image_ids: list[str]}}',
        locale: 'en-US',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
        serverAssigners: {
          image_ids: {
            mode: 'manual',
            dependent_fields: ['aimd_content'],
          },
        },
        runServerAssigner,
      },
    })

    await flushPromises()
    await nextTick()

    const button = wrapper.find('.aimd-rec-assigner-field__button')
    expect(button.exists()).toBe(true)

    await button.trigger('click')
    await flushPromises()
    await nextTick()
    await flushPromises()
    await nextTick()

    expect(runServerAssigner).toHaveBeenCalledTimes(1)
    const updates = wrapper.emitted('update:modelValue') ?? []
    const latestRecord = updates[updates.length - 1]?.[0] as { var?: Record<string, unknown> } | undefined
    expect(latestRecord?.var?.image_ids).toEqual(['airalogy.id.file.image-a.png', 'airalogy.id.file.image-b.png'])
    expect(wrapper.find('.aimd-rec-assigner-field__button').exists()).toBe(true)
    expect((wrapper.find('textarea.aimd-rec-inline__textarea').element as HTMLTextAreaElement).value).toContain('"airalogy.id.file.image-a.png"')
  })

  it('runs auto host assigners when dependent fields become available', async () => {
    const runServerAssigner = vi.fn(async (_request: AimdAssignerRunnerRequest) => ({
      data: {
        assigned_fields: {
          ic50: 42,
        },
      },
    }))

    const wrapper = mount(AimdRecorder, {
      props: {
        content: '{{var|ic50: float}}',
        locale: 'en-US',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
        serverAssigners: {
          ic50: {
            mode: 'auto',
            dependent_fields: ['kinetics_file'],
          },
        },
        runServerAssigner,
      },
    })

    await flushPromises()
    await nextTick()

    expect(runServerAssigner).not.toHaveBeenCalled()

    await wrapper.setProps({
      modelValue: {
        var: {
          kinetics_file: 'airalogy.id.file.csv',
        },
        step: {},
        check: {},
        quiz: {},
      },
    })
    await flushPromises()
    await nextTick()

    expect(runServerAssigner).toHaveBeenCalledTimes(1)
    const [request] = (runServerAssigner.mock.calls[0] ?? []) as unknown as [AimdAssignerRunnerRequest]
    expect(request).toMatchObject({
      section: 'var',
      fieldKey: 'var:ic50',
      assignedField: 'ic50',
      dependentData: {
        kinetics_file: 'airalogy.id.file.csv',
      },
    })

    const updates = wrapper.emitted('update:modelValue') ?? []
    const latestRecord = updates[updates.length - 1]?.[0] as { var?: Record<string, unknown> } | undefined
    expect(latestRecord?.var?.ic50).toBe(42)
  })

  it('marks all returned assigned fields as done after a shared server assigner run', async () => {
    const finalConvNode = {
      ...varNode,
      id: 'final_conv_pct',
      name: 'final_conv_pct',
      label: 'final_conv_pct',
      raw: '{{var|final_conv_pct: float}}',
      definition: {
        name: 'final_conv_pct',
        type: 'float',
      },
    }
    const rateNode = {
      ...varNode,
      id: 'k_obs',
      name: 'k_obs',
      label: 'k_obs',
      raw: '{{var|k_obs: float}}',
      definition: {
        name: 'k_obs',
        type: 'float',
      },
    }
    currentVarNodes = [finalConvNode, rateNode]
    currentFields = {
      ...fields,
      var: ['final_conv_pct', 'k_obs'],
      var_definitions: [
        { name: 'final_conv_pct', type: 'float' },
        { name: 'k_obs', type: 'float' },
      ],
    }
    const sharedAssigner = {
      mode: 'manual',
      dependent_fields: ['kinetics_file'],
    }
    const runServerAssigner = vi.fn(async (_request: AimdAssignerRunnerRequest) => ({
      data: {
        assigned_fields: {
          final_conv_pct: 96.5,
          k_obs: 0.125,
        },
      },
    }))

    const wrapper = mount(AimdRecorder, {
      props: {
        content: '{{var|final_conv_pct: float}}{{var|k_obs: float}}',
        locale: 'en-US',
        modelValue: {
          var: {
            kinetics_file: 'airalogy.id.file.csv',
          },
          step: {},
          check: {},
          quiz: {},
        },
        serverAssigners: {
          final_conv_pct: sharedAssigner,
          k_obs: { ...sharedAssigner },
        },
        runServerAssigner,
      },
    })

    await flushPromises()
    await nextTick()

    const buttons = wrapper.findAll('.aimd-rec-assigner-field__button')
    expect(buttons).toHaveLength(2)
    await buttons[0].trigger('click')
    await flushPromises()
    await nextTick()

    expect(runServerAssigner).toHaveBeenCalledTimes(1)
    const updates = wrapper.emitted('update:modelValue') ?? []
    const latestRecord = updates[updates.length - 1]?.[0] as { var?: Record<string, unknown> } | undefined
    expect(latestRecord?.var?.final_conv_pct).toBe(96.5)
    expect(latestRecord?.var?.k_obs).toBe(0.125)
    expect(wrapper.findAll('.aimd-rec-assigner-field__status--done')).toHaveLength(2)
  })

  it('shows running state on every field in a shared server assigner batch', async () => {
    const finalConvNode = {
      ...varNode,
      id: 'final_conv_pct',
      name: 'final_conv_pct',
      label: 'final_conv_pct',
      raw: '{{var|final_conv_pct: float}}',
      definition: {
        name: 'final_conv_pct',
        type: 'float',
      },
    }
    const rateNode = {
      ...varNode,
      id: 'k_obs',
      name: 'k_obs',
      label: 'k_obs',
      raw: '{{var|k_obs: float}}',
      definition: {
        name: 'k_obs',
        type: 'float',
      },
    }
    currentVarNodes = [finalConvNode, rateNode]
    currentFields = {
      ...fields,
      var: ['final_conv_pct', 'k_obs'],
      var_definitions: [
        { name: 'final_conv_pct', type: 'float' },
        { name: 'k_obs', type: 'float' },
      ],
    }
    const sharedAssigner = {
      mode: 'manual',
      dependent_fields: ['kinetics_file'],
    }
    let resolveRun: (value: unknown) => void = () => {}
    const runServerAssigner = vi.fn((_request: AimdAssignerRunnerRequest) => new Promise((resolve) => {
      resolveRun = resolve
    }))

    const wrapper = mount(AimdRecorder, {
      props: {
        content: '{{var|final_conv_pct: float}}{{var|k_obs: float}}',
        locale: 'en-US',
        modelValue: {
          var: {
            kinetics_file: 'airalogy.id.file.csv',
          },
          step: {},
          check: {},
          quiz: {},
        },
        serverAssigners: {
          final_conv_pct: sharedAssigner,
          k_obs: { ...sharedAssigner },
        },
        runServerAssigner,
      },
    })

    await flushPromises()
    await nextTick()

    const buttons = wrapper.findAll('.aimd-rec-assigner-field__button')
    expect(buttons).toHaveLength(2)
    await buttons[0].trigger('click')
    await flushPromises()
    await nextTick()

    expect(runServerAssigner).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('.aimd-rec-assigner-field__spinner')).toHaveLength(2)
    expect(wrapper.findAll('.aimd-rec-assigner-field__status--loading')).toHaveLength(2)

    resolveRun({
      data: {
        assigned_fields: {
          final_conv_pct: 96.5,
          k_obs: 0.125,
        },
      },
    })
    await flushPromises()
    await nextTick()

    expect(wrapper.findAll('.aimd-rec-assigner-field__status--done')).toHaveLength(2)
  })

  it('mounts shared server assigner controls on every declared assigned field', async () => {
    const finalConvNode = {
      ...varNode,
      id: 'final_conv_pct',
      name: 'final_conv_pct',
      label: 'final_conv_pct',
      raw: '{{var|final_conv_pct: float}}',
      definition: {
        name: 'final_conv_pct',
        type: 'float',
      },
    }
    const rateNode = {
      ...varNode,
      id: 'k_obs',
      name: 'k_obs',
      label: 'k_obs',
      raw: '{{var|k_obs: float}}',
      definition: {
        name: 'k_obs',
        type: 'float',
      },
    }
    currentVarNodes = [finalConvNode, rateNode]
    currentFields = {
      ...fields,
      var: ['final_conv_pct', 'k_obs'],
      var_definitions: [
        { name: 'final_conv_pct', type: 'float' },
        { name: 'k_obs', type: 'float' },
      ],
    }
    const runServerAssigner = vi.fn(async () => ({
      data: {
        assigned_fields: {
          final_conv_pct: 96.5,
          k_obs: 0.125,
        },
      },
    }))

    const wrapper = mount(AimdRecorder, {
      props: {
        content: '{{var|final_conv_pct: float}}{{var|k_obs: float}}',
        locale: 'en-US',
        modelValue: {
          var: {
            kinetics_file: 'airalogy.id.file.csv',
          },
          step: {},
          check: {},
          quiz: {},
        },
        serverAssigners: {
          final_conv_pct: {
            mode: 'manual',
            dependent_fields: ['kinetics_file'],
            assigned_fields: ['final_conv_pct', 'k_obs'],
          },
        },
        runServerAssigner,
      },
    })

    await flushPromises()
    await nextTick()

    const buttons = wrapper.findAll('.aimd-rec-assigner-field__button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].attributes('aria-label')).toContain('final_conv_pct')
    expect(buttons[1].attributes('aria-label')).toContain('k_obs')

    await buttons[1].trigger('click')
    await flushPromises()
    await nextTick()

    expect(runServerAssigner).toHaveBeenCalledTimes(1)
    const [request] = (runServerAssigner.mock.calls[0] ?? []) as unknown as [AimdAssignerRunnerRequest]
    expect(request).toMatchObject({
      section: 'var',
      fieldKey: 'var:k_obs',
      assignedField: 'k_obs',
      dependentData: {
        kinetics_file: 'airalogy.id.file.csv',
      },
    })
    expect(wrapper.findAll('.aimd-rec-assigner-field__status--done')).toHaveLength(2)
  })

  it('mounts server assigner controls inside var table headers', async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    currentFields = {
      ...fields,
      var: [],
      var_definitions: [],
      var_table: [varTableField],
    }
    mocks.renderToVue.mockImplementation(async (
      _content: string,
      options: { aimdRenderers: { var_table: (node: unknown) => unknown } },
    ) => ({
      fields: currentFields,
      nodes: [options.aimdRenderers.var_table(varTableNode)],
    }))
    const runServerAssigner = vi.fn(async () => ({
      data: {
        assigned_fields: {
          print_nodes: [{ site_id: 'S01' }],
        },
      },
    }))

    const wrapper = mount(AimdRecorder, {
      props: {
        content: '{{var_table|print_nodes}}',
        locale: 'zh-CN',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
        serverAssigners: {
          print_nodes: {
            mode: 'manual',
            dependent_fields: ['site_csv_file'],
          },
        },
        runServerAssigner,
      },
    })

    await flushPromises()
    await nextTick()

    const button = wrapper.find('.aimd-rec-inline-table__header-action .aimd-rec-assigner-field__button')
    expect(button.exists()).toBe(true)
    expect(wrapper.find('.aimd-rec-assigner-field--var_table').exists()).toBe(false)

    await button.trigger('click')
    await flushPromises()
    await nextTick()

    expect(runServerAssigner).toHaveBeenCalledTimes(1)
    const [request] = (runServerAssigner.mock.calls[0] ?? []) as unknown as [AimdAssignerRunnerRequest]
    expect(request).toMatchObject({
      section: 'var_table',
      fieldKey: 'var_table:print_nodes',
      assignedField: 'print_nodes',
    })
  })

  it('falls back to assigner-request for parsed assigners without a runner', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: '{{var|ic50: float}}',
        locale: 'en-US',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
        serverAssigners: {
          ic50: {
            mode: 'manual',
            dependent_fields: [],
          },
        },
      },
    })

    await flushPromises()
    await nextTick()

    await wrapper.find('.aimd-rec-assigner-field__button').trigger('click')

    expect(wrapper.emitted('assigner-request')?.[0]?.[0]).toMatchObject({
      section: 'var',
      fieldKey: 'ic50',
    })
  })

  it('passes an AbortSignal to host assigners and cancels in-flight runs', async () => {
    let receivedRequest: AimdAssignerRunnerRequest | undefined
    const runServerAssigner = vi.fn(async (request: AimdAssignerRunnerRequest) => {
      receivedRequest = request
      return new Promise((resolve) => {
        request.signal?.addEventListener('abort', () => resolve({ data: { assigned_fields: {} } }), { once: true })
      })
    })

    const wrapper = mount(AimdRecorder, {
      props: {
        content: '{{var|ic50: float}}',
        locale: 'en-US',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
        serverAssigners: {
          ic50: {
            mode: 'manual',
            dependent_fields: [],
          },
        },
        runServerAssigner,
      },
    })

    await flushPromises()
    await nextTick()

    const button = wrapper.find('.aimd-rec-assigner-field__button')
    await button.trigger('click')
    await flushPromises()
    await nextTick()

    expect(receivedRequest?.signal).toBeInstanceOf(AbortSignal)
    expect(receivedRequest?.signal?.aborted).toBe(false)
    expect(wrapper.find('.aimd-rec-assigner-field__button').text()).toBe('Cancel')

    await wrapper.find('.aimd-rec-assigner-field__button').trigger('click')

    expect(receivedRequest?.signal?.aborted).toBe(true)
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

  it('shows server assigner business failures inside built-in markdown fields', async () => {
    currentVarNode = {
      ...pluginVarNode,
      raw: '{{var|report: AiralogyMarkdown}}',
      definition: {
        name: 'report',
        type: 'AiralogyMarkdown',
      },
    }
    currentFields = {
      ...fields,
      var: ['report'],
      var_definitions: [{ name: 'report', type: 'AiralogyMarkdown' }],
    }
    const runServerAssigner = vi.fn(async () => ({
      data: {
        success: false,
        error_message: 'Missing dependent field: final_conv_pct',
      },
    }))

    const wrapper = mount(AimdRecorder, {
      props: {
        content: '{{var|report: AiralogyMarkdown}}',
        locale: 'en-US',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
        serverAssigners: {
          report: {
            mode: 'manual',
            dependent_fields: ['final_conv_pct'],
          },
        },
        runServerAssigner,
      },
    })

    await flushPromises()
    await nextTick()
    await flushPromises()
    await nextTick()
    await vi.dynamicImportSettled()
    await nextTick()

    const button = wrapper.find('.aimd-rec-assigner-field__button')
    expect(button.exists()).toBe(true)

    await button.trigger('click')
    await flushPromises()
    await nextTick()
    await flushPromises()
    await nextTick()

    expect(runServerAssigner).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.aimd-rec-inline__assigner-error').text()).toBe('Missing dependent field: final_conv_pct')
    expect(wrapper.find('.aimd-rec-assigner-field__status--error').exists()).toBe(true)
  })

  it('mounts auto server assigner controls inside built-in markdown fields', async () => {
    currentVarNode = {
      ...pluginVarNode,
      raw: '{{var|report: AiralogyMarkdown}}',
      definition: {
        name: 'report',
        type: 'AiralogyMarkdown',
      },
    }
    currentFields = {
      ...fields,
      var: ['report'],
      var_definitions: [{ name: 'report', type: 'AiralogyMarkdown' }],
    }

    const wrapper = mount(AimdRecorder, {
      props: {
        content: '{{var|report: AiralogyMarkdown}}',
        locale: 'zh-CN',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
        serverAssigners: {
          report: {
            mode: 'auto',
            dependent_fields: ['source_file'],
          },
        },
      },
    })

    await flushPromises()
    await nextTick()
    await vi.dynamicImportSettled()
    await nextTick()

    expect(wrapper.find('.aimd-markdown-field__assigner-action .aimd-rec-assigner-field__button').exists()).toBe(true)
    expect(wrapper.find('.aimd-markdown-field__assigner-state .aimd-rec-assigner-field__status').exists()).toBe(true)
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
