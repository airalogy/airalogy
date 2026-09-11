import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { AimdRecordTable } from '../vue'

const aimd = [
  ...Array.from({ length: 8 }, (_, index) => `{{var|value_${index}: str}}`),
  '{{step|prepare}} Prepare sample.',
  '{{check|quality}} Confirm quality.',
  '{{var_table|measurements, subvars=[var(concentration: float), var(signal: float)]}}',
].join('\n\n')
const records = [{ record_id: 'synthetic', data: { var: { value_0: 'Only one populated value' } } }]
const metadataColumns = [
  { key: 'time', label: 'Submitted at', getValue: () => 'Synthetic time' },
  { key: 'user', label: 'Submitted by', getValue: () => 'Synthetic user' },
]
const all = '[data-column-action="all"]'
const reset = '[data-column-action="default"]'
const fieldHeaders = 'thead [data-field-key]'
const metadataHeaders = 'thead [data-metadata-column-key]'

describe('Record table column actions', () => {
  it('selects the complete protocol catalogue and hidden metadata, then restores compact defaults', async () => {
    const wrapper = mount(AimdRecordTable, { props: { aimd, records, metadataColumns, metadataColumnKeys: [] } })
    const options = wrapper.findAll('input[data-field-key]')
    expect(options.map(option => option.attributes('data-field-key'))).toEqual(expect.arrayContaining([
      'var_table:measurements', 'var_table:measurements:concentration', 'var_table:measurements:signal',
    ]))
    expect(wrapper.findAll(fieldHeaders)).toHaveLength(6)
    await wrapper.get(all).trigger('click')
    expect(wrapper.findAll(fieldHeaders)).toHaveLength(options.length)
    expect(wrapper.findAll(metadataHeaders)).toHaveLength(2)
    expect(wrapper.findAll('input[data-field-key]')).toSatisfy((items: any[]) => items.every(item => item.element.checked))
    expect(wrapper.get(all).attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('update:fieldKeys')).toHaveLength(1)
    expect(wrapper.emitted('update:metadataColumnKeys')).toEqual([[['time', 'user']]])
    expect(wrapper.emitted('update:selectedRecordKeys')).toBeUndefined()
    await wrapper.get(reset).trigger('click')
    expect(wrapper.findAll(fieldHeaders)).toHaveLength(6)
    expect(wrapper.findAll(metadataHeaders)).toHaveLength(2)
    expect(wrapper.get(reset).attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('update:fieldKeys')).toHaveLength(2)
    wrapper.unmount()
  })

  it('keeps an independent host-defined reset target through v-model echoes', async () => {
    const defaults = ['var:value_7', 'var:value_7', 'missing']
    const wrapper = mount(AimdRecordTable, { props: {
      aimd, records, metadataColumns, defaultFieldKeys: defaults, defaultMetadataColumnKeys: [],
      fieldKeys: ['var:value_2'], metadataColumnKeys: ['time'],
    } })
    await wrapper.get(all).trigger('click')
    const selected = wrapper.emitted('update:fieldKeys')![0]![0] as string[]
    await wrapper.setProps({ fieldKeys: selected, metadataColumnKeys: ['time', 'user'] })
    await wrapper.get(reset).trigger('click')
    expect(wrapper.emitted('update:fieldKeys')!.slice(-1)[0]).toEqual([['var:value_7']])
    expect(wrapper.emitted('update:metadataColumnKeys')!.slice(-1)[0]).toEqual([[]])
    await wrapper.setProps({ fieldKeys: ['var:value_7'], metadataColumnKeys: [] })
    expect(wrapper.findAll(fieldHeaders)).toHaveLength(1)
    expect(wrapper.get(fieldHeaders).attributes('data-field-key')).toBe('var:value_7')
    expect(wrapper.findAll(metadataHeaders)).toHaveLength(0)
    expect(wrapper.emitted('update:fieldKeys')).toHaveLength(2)
    expect(defaults).toEqual(['var:value_7', 'var:value_7', 'missing'])
    wrapper.unmount()
  })

  it('normalizes obsolete selections, honours the default limit and permits individual adjustments after all', async () => {
    const wrapper = mount(AimdRecordTable, { props: {
      aimd, records, fieldKeys: ['removed'], defaultFieldKeys: ['removed'], maxDefaultColumns: 2,
    } })
    expect(wrapper.findAll(fieldHeaders)).toHaveLength(2)
    await wrapper.get(all).trigger('click')
    await wrapper.get('input[data-field-key="var:value_0"]').setValue(false)
    expect(wrapper.get(all).attributes('disabled')).toBeUndefined()
    await wrapper.get(reset).trigger('click')
    expect(wrapper.findAll(fieldHeaders)).toHaveLength(2)
    await wrapper.setProps({ aimd: '{{var|replacement: str}}' })
    expect(wrapper.get(fieldHeaders).attributes('data-field-key')).toBe('var:replacement')
    expect(wrapper.get(all).attributes('disabled')).toBeDefined()
    await wrapper.get(all).trigger('click')
    expect(wrapper.emitted('update:fieldKeys')).toHaveLength(3)
    wrapper.unmount()
  })

  it('uses host defaults for uncontrolled initial selection without storing user preferences', async () => {
    const wrapper = mount(AimdRecordTable, { props: {
      aimd, records, metadataColumns, defaultFieldKeys: ['var:value_4'], defaultMetadataColumnKeys: ['user', 'unknown'],
    } })
    expect(wrapper.get(fieldHeaders).attributes('data-field-key')).toBe('var:value_4')
    expect(wrapper.get(metadataHeaders).attributes('data-metadata-column-key')).toBe('user')
    await wrapper.get(all).trigger('click')
    await wrapper.get(reset).trigger('click')
    expect(wrapper.get(metadataHeaders).attributes('data-metadata-column-key')).toBe('user')
    wrapper.unmount()
  })

  it('handles an empty protocol, empty data and a disabled field picker', async () => {
    const wrapper = mount(AimdRecordTable, { props: { aimd: '', records: [] } })
    expect(wrapper.get(all).attributes('disabled')).toBeDefined()
    expect(wrapper.get(reset).attributes('disabled')).toBeDefined()
    await wrapper.setProps({ metadataColumns })
    await wrapper.get('input[data-metadata-column-key="user"]').setValue(false)
    await wrapper.get(all).trigger('click')
    expect(wrapper.emitted('update:fieldKeys')).toBeUndefined()
    expect(wrapper.emitted('update:metadataColumnKeys')!.slice(-1)[0]).toEqual([['time', 'user']])
    await wrapper.setProps({ showFieldPicker: false })
    expect(wrapper.find(all).exists()).toBe(false)
    wrapper.unmount()
  })

  it('provides localized, overrideable native buttons without submitting the host form', async () => {
    const wrapper = mount(AimdRecordTable, { props: { aimd, locale: 'zh-CN' } })
    expect(wrapper.get(all).text()).toBe('显示全部列')
    expect(wrapper.get(reset).text()).toBe('恢复默认列')
    expect(wrapper.get(all).attributes('type')).toBe('button')
    expect(wrapper.get(reset).attributes('type')).toBe('button')
    await wrapper.setProps({ locale: 'en-US' })
    expect(wrapper.get(all).text()).toBe('Show all columns')
    await wrapper.setProps({ messages: { recordView: { showAllColumns: 'All fields' } } })
    expect(wrapper.get(all).text()).toBe('All fields')
    wrapper.unmount()
  })
})
