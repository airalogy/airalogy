import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { parseAndExtract } from '@airalogy/aimd-renderer'
import AimdRecorder from '../components/AimdRecorder.vue'
import { createAimdRecorderMessages } from '../locales'
import { createEmptyProtocolRecordData } from '../types'
import { validateAimdRecord } from '../record/validation'

describe('multi-select inputs', () => {
  it.each(['compact', 'detailed'] as const)('stores typed arrays and supports clearing to null in %s mode', async fieldDisplay => {
    const wrapper = mount(AimdRecorder, { props: {
      content: '{{var|choices: list[Literal[1, 2, 3]] | None, title="Numbers"}}',
      fieldDisplay, locale: 'en-US', modelValue: createEmptyProtocolRecordData(),
    } })
    await vi.waitFor(() => expect(wrapper.findAll('.aimd-rec-multi-select input')).toHaveLength(3))
    const inputs = wrapper.findAll('.aimd-rec-multi-select input')
    const value = () => (wrapper.emitted('update:modelValue')?.slice(-1)[0]?.[0] as any).var.choices
    await inputs[0].setValue(true)
    await inputs[1].setValue(true)
    expect(value()).toEqual([1, 2])
    await inputs[0].setValue(false)
    expect(value()).toEqual([2])
    await wrapper.get('.aimd-rec-multi-select__unset').trigger('click')
    expect(value()).toBeNull()
    await wrapper.setProps({ readonly: true })
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.findAll('.aimd-rec-multi-select input').every(input => input.attributes('disabled') !== undefined)).toBe(true))
    wrapper.unmount()
  })

  it('uses the registered enum values for list[BloodType] without a scalar enum override', async () => {
    const wrapper = mount(AimdRecorder, { props: {
      content: '{{var|choices: list[BloodType]}}', locale: 'en-US', modelValue: createEmptyProtocolRecordData(),
    } })
    await vi.waitFor(() => expect(wrapper.find('.aimd-rec-multi-select').exists()).toBe(true))
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.findAll('.aimd-rec-multi-select__option').length).toBeGreaterThan(1)
    wrapper.unmount()
  })

  it('validates every item, including numeric value types', () => {
    const fields = parseAndExtract('{{var|choices: list[Literal[1, 2]] | None}}')
    const options = { messages: createAimdRecorderMessages('en-US').validation }
    const record = createEmptyProtocolRecordData()
    for (const value of [[1, 2], [], null]) {
      record.var.choices = value
      expect(validateAimdRecord(fields, record, options).valid).toBe(true)
    }
    for (const value of [[3], ['1'], [1, 3], '1']) {
      record.var.choices = value
      expect(validateAimdRecord(fields, record, options).valid).toBe(false)
    }
  })
})
