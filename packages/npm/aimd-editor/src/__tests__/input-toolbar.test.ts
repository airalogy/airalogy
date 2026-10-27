import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AimdEditorToolbar from '../vue/AimdEditorToolbar.vue'
import AimdInputFieldDialog from '../vue/AimdInputFieldDialog.vue'
import { createAimdEditorMessages } from '../vue/locales'

const messages = createAimdEditorMessages('zh-CN')

describe('common input toolbar', () => {
  it('exposes six common inputs with distinct presets and compact labels', async () => {
    const wrapper = mount(AimdEditorToolbar, { props: {
      showTopBar: false, showMdToolbar: false, showAimdToolbar: true, editorMode: 'wysiwyg',
      resolvedMessages: messages, localizedMdToolbarItems: [],
      localizedFieldTypes: [{ type: 'var', label: 'Input', desc: 'Input', color: '#000', svgIcon: '', icon: '' }],
    } })
    const buttons = wrapper.findAll('.aimd-input-tools > button')
    expect(buttons.map(button => button.text())).toEqual(['文本', '整数', '小数', '单选', '多选', '是／否'])
    for (const button of buttons) await button.trigger('click')
    expect(wrapper.emitted('insert-input')?.map(event => event[0])).toEqual(['str', 'int', 'float', 'choice', 'multiple-choice', 'bool | None'])
    expect(buttons.every(button => button.attributes('title')?.startsWith('插入'))).toBe(true)
    const more = wrapper.get('details')
    ;(more.element as HTMLDetailsElement).open = true
    await wrapper.get('.aimd-input-tools__menu button').trigger('click')
    expect((more.element as HTMLDetailsElement).open).toBe(false)
    expect(wrapper.emitted('insert-input')?.slice(-1)[0]).toEqual(['date'])
    wrapper.unmount()
  })

  it.each([
    ['int', 'int'], ['float', 'float'], ['bool | None', 'bool | None'],
    ['date', 'date'], ['time', 'time'], ['datetime', 'datetime'], ['file', 'FileIdPDF'],
    ['choice', 'Literal["A", "B"]'], ['multiple-choice', 'list[Literal["A", "B"]]'],
  ])('opens %s already selected without requiring a manual ID', async (preset, type) => {
    const wrapper = mount(AimdInputFieldDialog, { props: { visible: false, content: '', messages, initialPreset: preset }, global: { stubs: { teleport: true } } })
    await wrapper.setProps({ visible: true })
    expect((wrapper.get('[name="preset"]').element as HTMLSelectElement).value).toBe(preset)
    if (preset.includes('choice')) await wrapper.get('[name="options"]').setValue('A\nB')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]).toEqual([`field_1: ${type}`])
    wrapper.unmount()
  })

  it('edits multi-choice options while preserving nullable state and custom metadata', async () => {
    const field = 'samples: list[Literal["A", "B"]] | None, description="Keep"'
    const wrapper = mount(AimdInputFieldDialog, { props: { visible: false, content: `{{var|${field}}}`, fieldContent: field, messages }, global: { stubs: { teleport: true } } })
    await wrapper.setProps({ visible: true })
    expect((wrapper.get('[name="preset"]').element as HTMLSelectElement).value).toBe('multiple-choice')
    await wrapper.get('[name="options"]').setValue('A\nC')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]).toEqual(['samples: list[Literal["A", "C"]] | None, description = "Keep"'])
    wrapper.unmount()
  })

  it('selects a registered attachment format instead of an unsupported generic file type', async () => {
    const wrapper = mount(AimdInputFieldDialog, { props: { visible: false, content: '', messages, initialPreset: 'file' }, global: { stubs: { teleport: true } } })
    await wrapper.setProps({ visible: true })
    await wrapper.get('[name="fileType"]').setValue('FileIdPNG')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]).toEqual(['field_1: FileIdPNG'])
    wrapper.unmount()
  })

  it('preserves named list enums rather than expanding their registered values', async () => {
    const field = 'samples: list[BloodType] | None'
    const wrapper = mount(AimdInputFieldDialog, { props: { visible: false, content: `{{var|${field}}}`, fieldContent: field, messages }, global: { stubs: { teleport: true } } })
    await wrapper.setProps({ visible: true })
    expect((wrapper.get('[name="preset"]').element as HTMLSelectElement).value).toBe('custom')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]).toEqual([field])
    wrapper.unmount()
  })

  it.each([
    ['choice', 'Literal["A", "C"]'],
    ['multiple-choice', 'list[Literal["A", "C"]]'],
    ['bool | None', 'bool | None'],
  ])('replaces legacy enum metadata when changing to %s', async (preset, type) => {
    const field = 'status: str, enum=["A", "B"], description="Keep"'
    const wrapper = mount(AimdInputFieldDialog, { props: { visible: false, content: `{{var|${field}}}`, fieldContent: field, messages }, global: { stubs: { teleport: true } } })
    await wrapper.setProps({ visible: true })
    expect((wrapper.get('[name="preset"]').element as HTMLSelectElement).value).toBe('choice')
    await wrapper.get('[name="preset"]').setValue(preset)
    if (preset.includes('choice')) await wrapper.get('[name="options"]').setValue('A\nC')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]).toEqual([`status: ${type}, description = "Keep"`])
    wrapper.unmount()
  })
})
