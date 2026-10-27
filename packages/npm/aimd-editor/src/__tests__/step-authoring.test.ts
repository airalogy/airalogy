import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { parseStepContent } from '@airalogy/aimd-core/parser'
import { updateAimdStepField } from '../authoring/fields'
import AimdStepFieldDialog from '../vue/AimdStepFieldDialog.vue'
import { createAimdEditorMessages } from '../vue/locales'

const messages = createAimdEditorMessages('en-US')
const wrappers: VueWrapper[] = []
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

async function openDialog(content = '', fieldContent?: string, reservedIds: string[] = []) {
  const wrapper = mount(AimdStepFieldDialog, { props: { visible: false, content, fieldContent, reservedIds, messages }, global: { stubs: { teleport: true } } })
  wrappers.push(wrapper)
  await wrapper.setProps({ visible: true })
  await flushPromises()
  return wrapper
}

describe('step authoring', () => {
  it('generates a unique ID and saves an optional title, without renumbering existing steps', async () => {
    const wrapper = await openDialog('{{step|step_1}} {{ref_step|step_2}}', undefined, ['step_3'])
    expect(wrapper.get('details').attributes('open')).toBeUndefined()
    await wrapper.get('input[name="title"]').setValue('准备样品, mix "gently"')
    await wrapper.get('form').trigger('submit')
    const step = parseStepContent(wrapper.emitted('save')![0][0] as string)
    expect(step).toMatchObject({ id: 'step_4', title: '准备样品, mix "gently"', check: true })
  })

  it('preserves the identity and unrelated options while changing or clearing a title', () => {
    const original = 'prepare, 2, title="Old", check=True, duration="30s", timer="both", checked_message="Done", subtitle="Context", result=True'
    const values = { id: 'must_not_rename', title: 'New', level: 2, check: true, duration: '30s', timer: 'both' }
    const updated = parseStepContent(updateAimdStepField(original, values))
    expect(updated).toMatchObject({ id: 'prepare', title: 'New', level: 2, check: true, estimated_duration_ms: 30000, timer_mode: 'both', subtitle: 'Context', checked_message: 'Done', result: true })
    expect(parseStepContent(updateAimdStepField(original, { ...values, title: ' ' })).title).toBeUndefined()
  })

  it('edits existing titles without renaming record keys', async () => {
    const wrapper = await openDialog('{{step|prepare, check=True}}', 'prepare, check=True')
    expect(wrapper.get('input[name="id"]').attributes('readonly')).toBeDefined()
    await wrapper.get('input[name="title"]').setValue('Prepare sample')
    await wrapper.get('form').trigger('submit')
    expect(parseStepContent(wrapper.emitted('save')![0][0] as string).id).toBe('prepare')
  })

  it('allows a title-free step and validates IDs and countdown duration', async () => {
    const wrapper = await openDialog('{{var|taken: str}}')
    await wrapper.get('input[name="id"]').setValue('taken')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toBe(messages.inputField.duplicateId)
    await wrapper.get('input[name="id"]').setValue('1 bad')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toBe(messages.inputField.invalidId)
    await wrapper.get('input[name="id"]').setValue('prepare')
    await wrapper.get('select[name="timer"]').setValue('countdown')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toBe(messages.stepField.invalidDuration)
    await wrapper.get('input[name="duration"]').setValue('30s')
    await wrapper.get('form').trigger('submit')
    expect(parseStepContent(wrapper.emitted('save')![0][0] as string)).toMatchObject({ id: 'prepare', title: undefined, estimated_duration_ms: 30000 })
  })
})
