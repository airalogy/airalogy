import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import AimdRecorderWysiwygFieldHost from '../components/AimdRecorderWysiwygFieldHost.vue'
import { createEmptyProtocolRecordData } from '../types'
import type { RecorderMilkdownSurfaceState } from '../components/recorderMilkdownPlugin'
import { createEmptyStepRecordItem } from '../composables/useStepTimers'

vi.mock('@airalogy/aimd-editor/vue', () => ({
  AimdEditor: { props: ['modelValue'], template: '<textarea :value="modelValue" />' },
}))

function createSurfaceState(): RecorderMilkdownSurfaceState {
  return {
    record: createEmptyProtocolRecordData(),
    readonly: false,
    submitted: false,
    choiceOptionExplanationMode: 'hidden',
    scaleGradeDisplayMode: 'hidden',
    stepDetailDisplay: 'auto',
    validationTriggers: ['change', 'blur'],
    validationEpoch: 0,
    onUpdateRecord: () => {},
  }
}

describe('AimdRecorderWysiwygFieldHost', () => {
  it('updates a checkpoint title without resetting checked state, notes or other fields', async () => {
    const state = reactive(createSurfaceState())
    state.fieldDisplay = 'compact'
    state.record.check.safety_ready = { checked: true, annotation: 'Retain note' }
    state.record.var.existing = 'keep'
    state.onUpdateRecord = vi.fn(value => { state.record = value })
    const wrapper = mount(AimdRecorderWysiwygFieldHost, { props: { surfaceState: state, rawContent: '{{check|safety_ready, title="Safety check"}}', displayMode: 'inline' } })
    await vi.waitFor(() => expect(wrapper.find('.aimd-check-field__title').text()).toBe('Safety check'))
    expect(wrapper.find('.aimd-check-field__key').exists()).toBe(false)
    await wrapper.setProps({ rawContent: '{{check|safety_ready, title="Review PPE"}}' })
    await vi.waitFor(() => expect(wrapper.get('.aimd-check-field__title').text()).toBe('Review PPE'))
    expect(state.record.check.safety_ready).toEqual({ checked: true, annotation: 'Retain note' })
    await wrapper.get('[data-rec-focus-key="check:safety_ready:checked"]').setValue(false)
    await flushPromises()
    expect(state.record.check.safety_ready).toMatchObject({ checked: false, annotation: 'Retain note' })
    expect(state.record.var.existing).toBe('keep')
    wrapper.unmount()
  })

  it('renders a checkpoint badge once without creating a phantom body', async () => {
    const state = reactive(createSurfaceState())
    state.locale = 'zh-CN'
    state.record.var.existing = 'keep'
    state.onUpdateRecord = vi.fn(value => { state.record = value })
    const rawContent = '{{check|safety_ready}}'
    const wrapper = mount(AimdRecorderWysiwygFieldHost, {
      props: { surfaceState: state, rawContent, displayMode: 'inline' },
    })
    await vi.waitFor(() => expect(wrapper.find('[data-rec-focus-key="check:safety_ready:checked"]').exists()).toBe(true))
    expect(wrapper.findAll('.aimd-rec-inline--check .aimd-field__scope').map(node => node.text())).toEqual(['检查点'])
    expect(wrapper.find('.aimd-check-field__body').exists()).toBe(false)
    expect(wrapper.get('.aimd-check-field__key').text()).toBe('safety_ready')
    await wrapper.get('[data-rec-focus-key="check:safety_ready:checked"]').setValue(true)
    await flushPromises()
    expect(state.record.check.safety_ready.checked).toBe(true)
    expect(state.record.var.existing).toBe('keep')
    expect(wrapper.props('rawContent')).toBe(rawContent)
    wrapper.unmount()
  })

  it('uses document step numbering and preserves filled data when changing a title', async () => {
    const state = reactive(createSurfaceState())
    state.protocolContext = '{{step|prepare}}\n\n{{step|mix, title="Mix"}}\n\n{{step|verify, 2}}'
    state.record.step.mix = { ...createEmptyStepRecordItem(), checked: true, annotation: 'Retain note', elapsed_ms: 5000 }
    state.fieldDisplay = 'compact'
    state.onUpdateRecord = vi.fn(value => { state.record = value })
    const wrapper = mount(AimdRecorderWysiwygFieldHost, {
      props: { surfaceState: state, rawContent: '{{step|mix, title="Mix", check=True}}', displayMode: 'block' },
    })
    await vi.waitFor(() => expect(wrapper.find('.aimd-step-field__title').text()).toBe('Mix'))
    expect(wrapper.get('.aimd-rec-inline__step-num').text()).toBe('2')
    expect(wrapper.find('.aimd-step-field__id').exists()).toBe(false)
    await wrapper.setProps({ rawContent: '{{step|mix, title="Mix gently", check=True}}' })
    await vi.waitFor(() => expect(wrapper.get('.aimd-step-field__title').text()).toBe('Mix gently'))
    expect(state.record.step.mix).toMatchObject({ checked: true, annotation: 'Retain note', elapsed_ms: 5000 })
    expect((wrapper.get('[data-rec-focus-key="step:mix:checked"]').element as HTMLInputElement).checked).toBe(true)
    await wrapper.setProps({ rawContent: '{{step|verify, 2, title="Verify"}}' })
    await vi.waitFor(() => expect(wrapper.get('.aimd-rec-inline__step-num').text()).toBe('2.1'))
    wrapper.unmount()
  })
  it('renders a standalone step header without a phantom body and preserves checkbox updates', async () => {
    const state = reactive(createSurfaceState())
    state.record.var.existing = 'keep'
    state.onUpdateRecord = vi.fn(value => { state.record = value })
    const rawContent = '{{step|prepare, check=True}}'
    const wrapper = mount(AimdRecorderWysiwygFieldHost, {
      props: { surfaceState: state, rawContent, displayMode: 'block' },
    })
    await vi.waitFor(() => expect(wrapper.find('[data-rec-focus-key="step:prepare:checked"]').exists()).toBe(true))
    expect(wrapper.find('.aimd-step-field__body').exists()).toBe(false)
    expect(wrapper.find('.aimd-step-field__main-actions .aimd-step-field__toggle--annotation').exists()).toBe(true)
    await wrapper.get('[data-rec-focus-key="step:prepare:checked"]').setValue(true)
    await flushPromises()
    expect(state.record.step.prepare.checked).toBe(true)
    expect(state.record.var.existing).toBe('keep')
    expect(wrapper.props('rawContent')).toBe(rawContent)
    wrapper.unmount()
  })

  it('fills real typed Record values in compact mode without changing the field definition', async () => {
    const state = reactive(createSurfaceState())
    state.locale = 'en-US'
    state.fieldDisplay = 'compact'
    state.record.var.other = 'keep me'
    state.onUpdateRecord = vi.fn(value => { state.record = value })
    const rawContent = '{{var|field_1: float, title="Temperature", ge=0}}'
    const wrapper = mount(AimdRecorderWysiwygFieldHost, {
      props: { surfaceState: state, rawContent, displayMode: 'inline' },
    })
    await vi.waitFor(() => expect(wrapper.find('[data-rec-focus-key="var:field_1"]').exists()).toBe(true))
    expect(wrapper.find('.aimd-field__label').exists()).toBe(false)
    expect(wrapper.find('.aimd-recorder-search-toolbar').exists()).toBe(false)
    const input = wrapper.get('[data-rec-focus-key="var:field_1"]')
    expect(input.attributes('aria-label')).toBe('Temperature')
    await input.setValue('37.5')
    await flushPromises()
    expect(state.record.var).toMatchObject({ field_1: 37.5, other: 'keep me' })
    expect(wrapper.props('rawContent')).toBe(rawContent)
    state.fieldDisplay = 'detailed'
    await flushPromises()
    expect(wrapper.get('.aimd-field__key').text()).toBe('field_1')
    await vi.waitFor(() => expect((wrapper.get('[data-rec-focus-key="var:field_1"]').element as HTMLInputElement).value).toBe('37.5'))
    state.readonly = true
    await flushPromises()
    expect(wrapper.get('[data-rec-focus-key="var:field_1"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('renders inline var fields with the real recorder input UI instead of AIMD chips', async () => {
    const wrapper = mount(AimdRecorderWysiwygFieldHost, {
      props: {
        surfaceState: createSurfaceState(),
        rawContent: '{{var|sample_name: str}}',
        displayMode: 'inline',
      },
    })
    await vi.waitFor(() => {
      expect(wrapper.find('.aimd-rec-inline--var-stacked').exists()).toBe(true)
    })

    expect(wrapper.html()).toContain('aimd-rec-inline--var-stacked')
    expect(wrapper.html()).toContain('data-rec-focus-key="var:sample_name"')
    expect(wrapper.html()).not.toContain('aimd-field-chip')
  })

  it('forwards the shared validation contract into embedded recorders', () => {
    const schema = {
      vars: {
        type: 'object',
        required: ['sample_name'],
        properties: { sample_name: { type: 'string', minLength: 1 } },
      },
    }
    const surfaceState = createSurfaceState()
    surfaceState.validationSchema = schema
    surfaceState.validationTriggers = ['blur']

    const wrapper = mount(AimdRecorderWysiwygFieldHost, {
      props: {
        surfaceState,
        rawContent: '{{var|sample_name: str}}',
        displayMode: 'inline',
      },
    })
    const recorder = wrapper.getComponent({ name: 'AimdRecorder' })
    expect(recorder.props('validationSchema')).toEqual(schema)
    expect(recorder.props('validationTriggers')).toEqual(['blur'])
  })
})
