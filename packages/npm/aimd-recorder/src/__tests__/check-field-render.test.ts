import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AimdRecorder from '../components/AimdRecorder.vue'
import { createEmptyProtocolRecordData } from '../types'

vi.mock('@airalogy/aimd-editor/vue', () => ({ AimdEditor: { props: ['modelValue'], template: '<textarea :value="modelValue" />' } }))

describe('checkpoint rendering', () => {
  it.each(['detailed', 'compact'] as const)('shows an optional title once and preserves the record identity (%s)', async fieldDisplay => {
    const wrapper = mount(AimdRecorder, { props: {
      content: '{{check|safety_ready, title="Safety <check>"}} Confirm **PPE**.',
      locale: 'en-US', fieldDisplay,
      modelValue: { ...createEmptyProtocolRecordData(), check: { safety_ready: { checked: true, annotation: 'Reviewed' } } },
    } })
    await vi.waitFor(() => expect(wrapper.find('.aimd-check-field__title').exists()).toBe(true))
    expect(wrapper.findAll('.aimd-check-field__title')).toHaveLength(1)
    expect(wrapper.get('.aimd-check-field__title').text()).toBe('Safety <check>')
    expect(wrapper.find('check').exists()).toBe(false)
    expect(wrapper.find('.aimd-check-field__key').exists()).toBe(fieldDisplay === 'detailed')
    expect(wrapper.get('.aimd-check-field__body').text()).toBe('Confirm PPE.')
    await wrapper.setProps({ content: '{{check|safety_ready, title="Updated safety check"}} Confirm **PPE**.' })
    await vi.waitFor(() => expect(wrapper.get('.aimd-check-field__title').text()).toBe('Updated safety check'))
    const checkbox = wrapper.get<HTMLInputElement>('[data-rec-focus-key="check:safety_ready:checked"]')
    expect(checkbox.element.checked).toBe(true)
    await checkbox.setValue(false)
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.slice(-1)[0]?.[0]).toMatchObject({ check: { safety_ready: { checked: false, annotation: 'Reviewed' } } })
    wrapper.unmount()
  })

  it.each([
    { locale: 'zh-CN', label: '检查点' },
    { locale: 'en-US', label: 'check' },
  ])('does not treat the preview badge as checkpoint body ($locale)', async ({ locale, label }) => {
    const wrapper = mount(AimdRecorder, {
      props: { content: '{{check|safety_ready}}', locale, modelValue: createEmptyProtocolRecordData() },
    })
    await vi.waitFor(() => expect(wrapper.find('.aimd-check-field__toggle').exists()).toBe(true))
    expect(wrapper.findAll('.aimd-rec-inline--check .aimd-field__scope').map(node => node.text())).toEqual([label])
    expect(wrapper.find('.aimd-check-field__body').exists()).toBe(false)
    expect(wrapper.get('.aimd-check-field__key').text()).toBe('safety_ready')
    await wrapper.get('[data-rec-focus-key="check:safety_ready:checked"]').setValue(true)
    await flushPromises()
    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(updates[updates.length - 1]?.[0]).toMatchObject({ check: { safety_ready: { checked: true } } })
    wrapper.unmount()
  })

  it('preserves real checkpoint instructions and nested field controls', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: '{{check|safety_ready}} Confirm **PPE** and record {{var|operator: str}} before continuing.',
        locale: 'en-US',
        modelValue: createEmptyProtocolRecordData(),
      },
    })
    await vi.waitFor(() => expect(wrapper.find('.aimd-check-field__body').exists()).toBe(true))
    const check = wrapper.get('.aimd-rec-inline--check')
    expect(check.findAll('.aimd-check-field__header .aimd-field__scope')).toHaveLength(1)
    expect(check.get('.aimd-check-field__body strong').text()).toBe('PPE')
    expect(check.get('.aimd-check-field__body').text()).toContain('before continuing.')
    expect(check.find('[data-rec-focus-key="var:operator"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
