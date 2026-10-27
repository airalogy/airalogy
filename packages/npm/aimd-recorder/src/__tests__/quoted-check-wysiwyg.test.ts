import { Editor, defaultValueCtx, rootCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { getMarkdown } from '@milkdown/kit/utils'
import { protectAimdInlineTemplates } from '@airalogy/aimd-core'
import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createRecorderMilkdownPlugins, type RecorderMilkdownSurfaceState } from '../components/recorderMilkdownPlugin'
import { createEmptyProtocolRecordData } from '../types'

// Keep the real Milkdown plugins while excluding the unrelated Monaco source editor.
vi.mock('../../../aimd-editor/src/vue/AimdSourceEditor.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../../../aimd-editor/src/vue/AimdEditor.vue', () => ({
  default: { props: ['modelValue'], template: '<textarea :value="modelValue" />' },
}))

let editor: Editor | undefined
afterEach(async () => {
  await editor?.destroy()
  editor = undefined
  document.body.replaceChildren()
})

it('renders and edits the complete quoted checkpoint through the real visual editor pipeline', async () => {
  const message = '这里的 AIMD 样式文本保持为普通文字：{{ref_var|stable_wait_s}}。'
  const raw = `{{check|quoted_message_boundary, checked_message="${message}"}}`
  const content = `${raw} Outside {{ref_var|stable_wait_s}}.`
  const root = document.createElement('div')
  document.body.append(root)
  const state: RecorderMilkdownSurfaceState = {
    record: createEmptyProtocolRecordData(), readonly: false, locale: 'zh-CN',
    submitted: false, choiceOptionExplanationMode: 'hidden', scaleGradeDisplayMode: 'hidden',
    stepDetailDisplay: 'auto', validationTriggers: ['change'], validationEpoch: 0,
    onUpdateRecord: value => { state.record = value },
  }
  state.record.var.stable_wait_s = 10
  const onEditField = vi.fn()
  editor = await Editor.make().config(ctx => {
    ctx.set(rootCtx, root)
    ctx.set(defaultValueCtx, protectAimdInlineTemplates(content).content)
  }).use(commonmark).use(createRecorderMilkdownPlugins({ surfaceState: state, onEditField })).create()

  await vi.waitFor(() => expect(root.querySelector('[data-rec-focus-key="check:quoted_message_boundary:checked"]')).not.toBeNull())
  expect(root.textContent).not.toContain('{{check|')
  expect(root.querySelectorAll('.aimd-recorder-wysiwyg-node')).toHaveLength(1)
  expect(root.querySelectorAll('.aimd-field-chip[data-field-type="ref_var"]')).toHaveLength(1)
  const checkbox = root.querySelector<HTMLInputElement>('[data-rec-focus-key="check:quoted_message_boundary:checked"]')!
  checkbox.click()
  await flushPromises()
  await vi.waitFor(() => expect(root.querySelector('.aimd-check-field__banner')?.textContent).toBe(message))
  expect(state.record.check.quoted_message_boundary.checked).toBe(true)
  expect(state.record.var.stable_wait_s).toBe(10)

  root.querySelector<HTMLButtonElement>('[aria-label="编辑字段"]')!.click()
  expect(onEditField.mock.calls[0][0]).toMatchObject({ id: 'quoted_message_boundary', raw })
  expect(editor.action(getMarkdown()).trim()).toBe(content)
})
