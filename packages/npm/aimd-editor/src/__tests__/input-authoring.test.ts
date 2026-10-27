import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { parseVarDefinition } from '@airalogy/aimd-core/parser'
import { collectAimdFieldIds, createAimdFieldId, updateAimdInputField } from '../authoring/fields'
import AimdInputFieldDialog from '../vue/AimdInputFieldDialog.vue'
import { createAimdEditorMessages } from '../vue/locales'

const messages = createAimdEditorMessages('en-US')
const wrappers: VueWrapper[] = []
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

async function openDialog(content = '', fieldContent?: string) {
  const wrapper = mount(AimdInputFieldDialog, {
    props: { visible: false, content, fieldContent, messages },
    global: { stubs: { teleport: true } },
  })
  wrappers.push(wrapper)
  await wrapper.setProps({ visible: true })
  await flushPromises()
  return wrapper
}

describe('input authoring', () => {
  it('does not silently replace a table definition with a scalar input', () => {
    expect(() => updateAimdInputField('samples, subvars=[name: str, count: int]', {
      id: 'samples', type: 'str', title: '', defaultRaw: '',
    })).toThrow('Table definitions')
  })

  it('reserves detached Record IDs and does not assign old data to a new field', async () => {
    const wrapper = await openDialog()
    await wrapper.setProps({ visible: false, reservedIds: ['field_1', 'field_2'] })
    await wrapper.setProps({ visible: true })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]).toEqual(['field_3: str'])
  })

  it('generates persistent IDs without renumbering existing fields and reserves references', () => {
    const content = '{{var|field_1: str}} {{var|field_3: int}} {{ref_var|field_2}}'
    const id = createAimdFieldId(collectAimdFieldIds(content))
    expect(id).toBe('field_4')
    const saved = `${content} {{var|${id}: str}}`
    expect(collectAimdFieldIds(saved).has(id)).toBe(true)
    expect(createAimdFieldId(collectAimdFieldIds(saved))).toBe('field_5')
  })

  it('preserves defaults and unrelated constraints while escaping a changed title', () => {
    const result = updateAimdInputField('mass: float = 2, gt=0, description="measured", title="Old"', {
      id: 'mass', type: 'float', title: 'Sample "mass"', defaultRaw: '2',
    })
    const parsed = parseVarDefinition(result)
    expect(parsed.id).toBe('mass')
    expect(parsed.default).toBe(2)
    expect(parsed.kwargs).toEqual({ gt: 0, description: 'measured', title: 'Sample "mass"' })
  })

  it('inserts a text field without requiring a title or manual ID', async () => {
    const wrapper = await openDialog('{{var|field_1: str}}')
    expect(wrapper.get('details').attributes('open')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]).toEqual(['field_2: str'])
  })

  it('blocks duplicate and invalid custom IDs and accepts a valid replacement', async () => {
    const wrapper = await openDialog('{{var|occupied: str}}')
    await wrapper.get('input[name="id"]').setValue('occupied')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toBe(messages.inputField.duplicateId)
    await wrapper.get('input[name="id"]').setValue('1 bad')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toBe(messages.inputField.invalidId)
    expect(wrapper.emitted('save')).toBeUndefined()
    await wrapper.get('input[name="id"]').setValue('sample_name')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]).toEqual(['sample_name: str'])
  })

  it('creates and edits dropdown choices without requiring Literal syntax', async () => {
    const wrapper = await openDialog()
    await wrapper.get('select[name="preset"]').setValue('choice')
    await wrapper.get('textarea[name="options"]').setValue('Ready\nWaiting')
    await wrapper.get('form').trigger('submit')
    const content = wrapper.emitted('save')?.[0]?.[0] as string
    expect(parseVarDefinition(content).enum).toEqual(['Ready', 'Waiting'])
    const editing = await openDialog(`{{var|${content}}}`, content)
    expect((editing.get('select[name="preset"]').element as HTMLSelectElement).value).toBe('choice')
    await editing.get('input[name="title"]').setValue('Status')
    await editing.get('form').trigger('submit')
    const updated = parseVarDefinition(editing.emitted('save')?.[0]?.[0] as string)
    expect(updated.id).toBe('field_1')
    expect(updated.enum).toEqual(['Ready', 'Waiting'])
  })
})
