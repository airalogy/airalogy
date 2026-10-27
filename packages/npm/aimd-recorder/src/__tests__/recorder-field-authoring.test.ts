import { Schema } from '@milkdown/kit/prose/model'
import { EditorState } from '@milkdown/kit/prose/state'
import { EditorView } from '@milkdown/kit/prose/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecorderWidgetNodeView, type RecorderMilkdownSurfaceState } from '../components/recorderMilkdownPlugin'
import { createEmptyProtocolRecordData } from '../types'

vi.mock('../components/AimdRecorderWysiwygFieldHost.vue', () => ({ default: { props: ['displayMode'], template: '<span :data-display-mode="displayMode" />' } }))
vi.mock('@airalogy/aimd-editor/vue', () => ({ aimdFieldNode: {}, aimdFieldInputRule: [], aimdRemarkPlugin: [] }))

const schema = new Schema({ nodes: {
  doc: { content: 'paragraph+' },
  paragraph: { content: 'inline*', toDOM: () => ['p', 0] },
  text: { group: 'inline' },
  aimd_field: {
    inline: true, group: 'inline', atom: true,
    attrs: { fieldType: { default: 'var' }, fieldContent: { default: '' } },
    toDOM: () => ['span'],
  },
} })
const cleanups: Array<() => void> = []
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()) })

function setup() {
  const field = schema.nodes.aimd_field.create({ fieldType: 'var', fieldContent: 'field_1: str' })
  const reference = schema.nodes.aimd_field.create({ fieldType: 'ref_var', fieldContent: 'field_1' })
  const doc = schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, [field, reference]))
  const view = new EditorView(document.createElement('div'), { state: EditorState.create({ doc }) })
  const state: RecorderMilkdownSurfaceState = {
    record: createEmptyProtocolRecordData(), readonly: false, locale: 'en-US',
    submitted: false, choiceOptionExplanationMode: 'hidden', scaleGradeDisplayMode: 'hidden',
    stepDetailDisplay: 'auto', validationTriggers: ['change'], validationEpoch: 0, onUpdateRecord: vi.fn(),
  }
  let apply: ((content: string) => boolean) | undefined
  // The editor can reparse the same content without recreating the visible field host.
  const equivalentField = schema.nodes.aimd_field.create(field.attrs)
  expect(equivalentField).not.toBe(field)
  const widget = new RecorderWidgetNodeView(equivalentField, view, () => 1, {
    surfaceState: state,
    onEditField: (_field, callback) => { apply = callback },
    onDeleteField: (_field, remove) => remove(),
  }, false)
  cleanups.push(() => { widget.destroy(); view.destroy() })
  return { widget, view, state, getApply: () => apply }
}

describe('recorder field authoring', () => {
  it('uses a full-width host for step markers without changing the inline document schema', () => {
    const { widget, view } = setup()
    const step = schema.nodes.aimd_field.create({ fieldType: 'step', fieldContent: 'prepare, check=True' })
    expect(widget.update(step)).toBe(true)
    expect(widget.dom.classList.contains('aimd-recorder-wysiwyg-node--step')).toBe(true)
    expect(widget.dom.querySelector('[data-display-mode="block"]')).not.toBeNull()
    expect(step.isInline).toBe(true)
    const field = view.state.doc.nodeAt(1)!
    expect(widget.update(field)).toBe(true)
    expect(widget.dom.classList.contains('aimd-recorder-wysiwyg-node--step')).toBe(false)
    expect(widget.dom.querySelector('[data-display-mode="inline"]')).not.toBeNull()
  })

  it('saves an equivalent reparsed field and its references together', () => {
    const { widget, view, getApply } = setup()
    widget.dom.querySelector<HTMLButtonElement>('[aria-label="Edit field"]')!.click()
    expect(getApply()?.('sample_name: str, title="Sample"')).toBe(true)
    expect(view.state.doc.nodeAt(1)?.attrs.fieldContent).toBe('sample_name: str, title="Sample"')
    expect(view.state.doc.nodeAt(2)?.attrs.fieldContent).toBe('sample_name')
  })

  it('does not overwrite a field that changed while its dialog was open', () => {
    const { widget, view, getApply } = setup()
    widget.dom.querySelector<HTMLButtonElement>('[aria-label="Edit field"]')!.click()
    view.dispatch(view.state.tr.setNodeMarkup(1, undefined, { fieldType: 'var', fieldContent: 'other: int' }))
    expect(getApply()?.('sample_name: str')).toBe(false)
    expect(view.state.doc.nodeAt(1)?.attrs.fieldContent).toBe('other: int')
  })

  it('removes an equivalent reparsed field without deleting other nodes', () => {
    const { widget, view } = setup()
    widget.dom.querySelector<HTMLButtonElement>('[aria-label="Delete field"]')!.click()
    expect(view.state.doc.firstChild?.childCount).toBe(1)
    expect(view.state.doc.nodeAt(1)?.attrs.fieldType).toBe('ref_var')
  })

  it('blocks editing and deletion in readonly mode', () => {
    const { widget, view, state, getApply } = setup()
    state.readonly = true
    widget.dom.querySelector<HTMLButtonElement>('[aria-label="Edit field"]')!.click()
    widget.dom.querySelector<HTMLButtonElement>('[aria-label="Delete field"]')!.click()
    expect(getApply()).toBeUndefined()
    expect(view.state.doc.firstChild?.childCount).toBe(2)
  })
})
