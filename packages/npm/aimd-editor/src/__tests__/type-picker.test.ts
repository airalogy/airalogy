import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { getAimdBuiltInTypeNames } from '@airalogy/aimd-core/utils'
import { parseVarDefinition } from '@airalogy/aimd-core/parser'
import AimdTypePicker from '../vue/AimdTypePicker.vue'
import AimdInputFieldDialog from '../vue/AimdInputFieldDialog.vue'
import { createAimdEditorMessages } from '../vue/locales'

const messages = createAimdEditorMessages('en-US')
const wrappers: VueWrapper[] = []
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

describe('advanced type picker', () => {
  it('lists the generated registry and host extensions without maintaining another built-in list', async () => {
    const wrapper = mount(AimdTypePicker, { props: { modelValue: 'str | None', messages, varTypePlugins: [{ key: 'lab', value: 'LabSample', label: 'Lab sample', desc: '' }] } })
    wrappers.push(wrapper)
    expect(wrapper.findAll('optgroup')[0].findAll('option').map(option => option.attributes('value'))).toEqual(getAimdBuiltInTypeNames())
    await wrapper.get('select').setValue('LabSample')
    expect(wrapper.emitted('update:modelValue')?.slice(-1)[0]).toEqual(['LabSample | None'])
    await wrapper.get('input').setValue('list[LabSample] | None')
    expect(wrapper.emitted('update:modelValue')?.slice(-1)[0]).toEqual(['list[LabSample] | None'])
  })

  it('keeps existing custom expressions and saves a selected built-in while retaining other metadata', async () => {
    const wrapper = mount(AimdInputFieldDialog, { props: { visible: false, content: '', fieldContent: 'sample: LabSample | None, title="Sample", description="Context"', messages }, global: { stubs: { teleport: true } } })
    wrappers.push(wrapper)
    await wrapper.setProps({ visible: true })
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('input[name="type"]').element.value).toBe('LabSample | None')
    const name = getAimdBuiltInTypeNames()[0]
    await wrapper.get('select[name="knownType"]').setValue(name)
    expect(wrapper.get<HTMLInputElement>('input[name="type"]').element.value).toBe(`${name} | None`)
    await wrapper.get('form').trigger('submit')
    expect(parseVarDefinition(wrapper.emitted('save')![0][0] as string)).toMatchObject({ id: 'sample', type: `${name} | None`, kwargs: { title: 'Sample', description: 'Context' } })
  })

  it('allows a free expression after choosing a registered type', async () => {
    const wrapper = mount(AimdInputFieldDialog, { props: { visible: false, content: '', initialPreset: 'custom', messages }, global: { stubs: { teleport: true } } })
    wrappers.push(wrapper)
    await wrapper.setProps({ visible: true })
    await flushPromises()
    expect(wrapper.get('details').attributes('open')).toBeDefined()
    await wrapper.get('select[name="knownType"]').setValue(getAimdBuiltInTypeNames()[0])
    await wrapper.get('input[name="type"]').setValue('list[LabSample] | None')
    await wrapper.get('form').trigger('submit')
    expect(parseVarDefinition(wrapper.emitted('save')![0][0] as string).type).toBe('list[LabSample] | None')
  })
})
