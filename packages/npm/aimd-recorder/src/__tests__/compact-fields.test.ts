import { h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AimdVarField from '../components/AimdVarField.vue'
import { fieldDisplayKey } from '../composables/useFieldPresentation'
import { createAimdRecorderMessages } from '../locales'

describe('compact field presentation', () => {
  it('retains list controls, assigner actions and errors while hiding technical metadata', async () => {
    const wrapper = mount(AimdVarField, {
      props: {
        node: { type: 'aimd', fieldType: 'var', scope: 'var', id: 'field_1', raw: '{{var|field_1: list[str]}}', definition: { id: 'field_1', type: 'list[str]', kwargs: { title: 'Samples' } } },
        disabled: false, extraClasses: [], messages: createAimdRecorderMessages('en-US'),
        displayValue: '', value: ['A'] as any, inputKind: 'scalar-list', initialized: true,
        assignerControl: h('button', { class: 'test-calculate' }, 'Calculate'),
        assignerError: 'Connection unavailable',
      },
      global: { provide: { [fieldDisplayKey as symbol]: ref('compact') } },
    })
    expect(wrapper.find('.aimd-field__label').exists()).toBe(false)
    expect(wrapper.get('.test-calculate').text()).toBe('Calculate')
    expect(wrapper.text()).toContain('Connection unavailable')
    expect(wrapper.text()).toContain('JSON')
    const input = wrapper.get('.aimd-rec-scalar-list__input')
    await input.setValue('B')
    await flushPromises()
    const changes = wrapper.emitted('change') ?? []
    expect(changes[changes.length - 1]?.[0]).toMatchObject({ id: 'field_1', value: ['B'] })
    wrapper.unmount()
  })
})
