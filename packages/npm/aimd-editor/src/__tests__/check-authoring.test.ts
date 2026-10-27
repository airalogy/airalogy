import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { parseCheckContent } from '@airalogy/aimd-core/parser'
import { updateAimdCheckField } from '../authoring/fields'
import AimdStepFieldDialog from '../vue/AimdStepFieldDialog.vue'
import { createAimdEditorMessages } from '../vue/locales'
import { buildAimdSyntax } from '../vue/types'

const messages = createAimdEditorMessages('en-US')
const wrappers: VueWrapper[] = []
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

async function openDialog(fieldContent?: string) {
  const wrapper = mount(AimdStepFieldDialog, { props: { visible: false, fieldType: 'check', content: '{{check|check_1}}', fieldContent, messages, reservedIds: ['check_2'] }, global: { stubs: { teleport: true } } })
  wrappers.push(wrapper)
  await wrapper.setProps({ visible: true })
  await flushPromises()
  return wrapper
}

describe('checkpoint authoring', () => {
  it('generates a unique ID and saves a quoted optional title without step controls', async () => {
    const wrapper = await openDialog()
    expect(wrapper.find('select[name="timer"]').exists()).toBe(false)
    expect(wrapper.get('details').attributes('open')).toBeUndefined()
    await wrapper.get('input[name="title"]').setValue('防护检查, confirm "PPE"')
    await wrapper.get('form').trigger('submit')
    expect(parseCheckContent(wrapper.emitted('save')![0][0] as string)).toMatchObject({ id: 'check_3', title: '防护检查, confirm "PPE"' })
  })

  it('edits a title without renaming the record key or dropping the checked message', async () => {
    const wrapper = await openDialog('safety_ready, title="Old", checked_message="Confirmed"')
    expect(wrapper.get('input[name="id"]').attributes('readonly')).toBeDefined()
    await wrapper.get('input[name="title"]').setValue('New')
    await wrapper.get('form').trigger('submit')
    expect(parseCheckContent(wrapper.emitted('save')![0][0] as string)).toMatchObject({ id: 'safety_ready', title: 'New', checked_message: 'Confirmed' })
  })

  it('allows a title-free checkpoint and clearing an existing title', async () => {
    const wrapper = await openDialog()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')![0][0]).toBe('check_3')
    expect(updateAimdCheckField('safety_ready, title="Old"', { id: 'not_renamed', title: '', checkedMessage: '' })).toBe('safety_ready')
    expect(buildAimdSyntax('check', { name: 'safe', title: 'Check "PPE"' })).toBe('{{check|safe, title="Check \\"PPE\\""}}')
  })
})
