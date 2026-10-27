import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AimdRecorderWysiwygFieldHost from '../components/AimdRecorderWysiwygFieldHost.vue'
import type { RecorderMilkdownSurfaceState } from '../components/recorderMilkdownPlugin'
import { createEmptyProtocolRecordData } from '../types'
import { BUILT_IN_CODE_STR_TYPES, resolveAimdCodeEditorLanguage } from '../code-types'

vi.mock('../components/AimdCodeField.vue', () => ({ __esModule: true, default: {
  name: 'AimdCodeField', props: ['modelValue', 'language', 'disabled'], template: '<textarea class="test-code-editor" />',
} }))
vi.mock('../components/AimdMarkdownField.vue', () => ({ __esModule: true, default: {
  name: 'AimdMarkdownField', props: ['modelValue', 'disabled'], template: '<div class="test-markdown-editor" />',
} }))
vi.mock('../components/AimdDnaSequenceField.vue', () => ({ __esModule: true, default: {
  name: 'AimdDnaSequenceField', props: ['modelValue', 'disabled'], template: '<div class="test-dna-editor" />',
} }))

// Registry-driven cases automatically cover newly published built-in enums and file types.
const registry = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../aimd-core/src/types/airalogy-built-in-type-metadata.generated.json'), 'utf8')) as {
  types: Record<string, { enum?: Array<string | number | boolean> }>
}
const wrappers: VueWrapper[] = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()) })

async function mountField(type: string, initialValue?: unknown, kwargs = '', extra: Partial<RecorderMilkdownSurfaceState> = {}) {
  const state = reactive<RecorderMilkdownSurfaceState>({
    record: createEmptyProtocolRecordData(), readonly: false, fieldDisplay: 'compact', locale: 'zh-CN',
    submitted: false, choiceOptionExplanationMode: 'hidden', scaleGradeDisplayMode: 'hidden',
    stepDetailDisplay: 'auto', validationTriggers: ['change'], validationEpoch: 0,
    onUpdateRecord: value => { state.record = value }, ...extra,
  })
  if (initialValue !== undefined) state.record.var.field_1 = initialValue
  const wrapper = mount(AimdRecorderWysiwygFieldHost, {
    props: { surfaceState: state, rawContent: `{{var|field_1: ${type}, title="Test input"${kwargs}}}`, displayMode: 'inline' },
  })
  wrappers.push(wrapper)
  await flushPromises()
  await vi.dynamicImportSettled()
  await vi.waitFor(() => expect(wrapper.find('.aimd-field-wrapper, .test-markdown-editor, .test-dna-editor').exists()).toBe(true))
  return { wrapper, state }
}

describe('compact visual form field controls', () => {
  for (const [type, metadata] of Object.entries(registry.types).filter(([, metadata]) => metadata.enum?.length)) {
    for (const annotation of [type, `${type} | None`, `Optional[${type}]`]) {
      it(`renders ${annotation} as a selectable enum with typed values`, async () => {
        const { wrapper, state } = await mountField(annotation)
        const select = wrapper.get('select[data-rec-focus-key="var:field_1"]')
        expect(select.findAll('option').slice(1).map(option => option.text())).toEqual(metadata.enum!.map(String))
        await select.setValue('0')
        expect(state.record.var.field_1).toEqual(metadata.enum![0])
        if (annotation !== type) {
          expect(select.find('option[value=""]').text()).toBe('未填写')
          await select.setValue('')
          expect(state.record.var.field_1).toBeNull()
        }
      })
    }
  }

  it('supports explicit Literal and enum metadata without stringifying numbers or booleans', async () => {
    const { wrapper, state } = await mountField('Literal[1, 2] | None')
    await wrapper.get('select').setValue('1')
    expect(state.record.var.field_1).toBe(2)
    const overridden = await mountField('str', undefined, '', { fieldMeta: { 'var:field_1': { enumOptions: [{ value: false, label: 'No' }, { value: true, label: 'Yes' }] } } })
    await overridden.wrapper.get('select').setValue('0')
    expect(overridden.state.record.var.field_1).toBe(false)
  })

  it('shows explicit yes/no feedback for a non-nullable boolean checkbox', async () => {
    const { wrapper, state } = await mountField('bool', false)
    const checkbox = wrapper.get('input[type="checkbox"]')
    expect(wrapper.get('.aimd-rec-inline__boolean-state').text()).toBe('否')
    await checkbox.setValue(true)
    expect(state.record.var.field_1).toBe(true)
    await vi.waitFor(() => expect(wrapper.get('.aimd-rec-inline__boolean-state').text()).toBe('是'))
    await checkbox.setValue(false)
    expect(state.record.var.field_1).toBe(false)
  })

  it.each(['bool | None', 'Optional[bool]', 'typing.Union[None, bool]'])('renders %s as an unset/yes/no select', async type => {
    const { wrapper, state } = await mountField(type)
    const select = wrapper.get('select')
    expect(select.findAll('option').map(option => option.text())).toEqual(['未填写', '是', '否'])
    for (const [selected, expected] of [['true', true], ['false', false], ['', null]] as const) {
      await select.setValue(selected)
      expect(state.record.var.field_1).toBe(expected)
    }
  })

  it.each([
    ['str', 'textarea', 'hello', 'hello'],
    ['int', 'input', '12', 12],
    ['float', 'input', '1.25', 1.25],
    ['date', 'input[type="date"]', '2026-10-27', '2026-10-27'],
    ['time', 'input[type="time"]', '12:30', '12:30'],
  ])('uses the native control and preserves the value type for %s', async (type, selector, input, value) => {
    const { wrapper, state } = await mountField(`${type} | None`)
    const control = wrapper.get(`${selector}[data-rec-focus-key="var:field_1"]`)
    await control.setValue(input)
    expect(state.record.var.field_1).toEqual(value)
    await control.setValue('')
    expect(state.record.var.field_1).toBeNull()
  })

  it.each(['list[str]', 'list[int]', 'list[float]'])('retains item and JSON modes for %s', async type => {
    const numeric = type !== 'list[str]'
    const { wrapper, state } = await mountField(`${type} | None`, numeric ? [1] : ['A'])
    const control = wrapper.get('.aimd-rec-scalar-list__input')
    await control.setValue(numeric ? '2' : 'B')
    expect(state.record.var.field_1).toEqual(numeric ? [2] : ['B'])
    expect(wrapper.text()).toContain('JSON')
    expect(wrapper.find('.aimd-rec-scalar-list__remove').exists()).toBe(true)
  })

  it.each(['datetime', 'CurrentTime'])('keeps date/time entry for %s', async type => {
    const { wrapper, state } = await mountField(`${type} | None`)
    const control = wrapper.get('input[type="datetime-local"]')
    await control.setValue('2026-10-27T12:30')
    expect(state.record.var.field_1).toMatch(/^2026-10-27T12:30[+-]\d{2}:\d{2}$/)
    await control.setValue('')
    expect(state.record.var.field_1).toBeNull()
  })

  it('retains user-name defaults and custom type plugins', async () => {
    const user = await mountField('UserName', undefined, '', { currentUserName: 'Operator' })
    const userInput = user.wrapper.get('textarea')
    expect((userInput.element as HTMLTextAreaElement).value).toBe('Operator')
    await userInput.setValue('Other operator')
    expect(user.state.record.var.field_1).toBe('Other operator')
    const custom = await mountField('LabFlag | None', undefined, '', {
      typePlugins: [{ type: 'LabFlag', inputKind: 'boolean-select' }],
    })
    await custom.wrapper.get('select').setValue('true')
    expect(custom.state.record.var.field_1).toBe(true)
  })

  it.each(['dict[str, int]', 'list[dict]', 'list[bool]'])('retains structured JSON entry for %s', async type => {
    const { wrapper, state } = await mountField(type)
    const json = type.startsWith('dict') ? '{"count":2}' : type === 'list[bool]' ? '[true,false]' : '[{"count":2}]'
    await wrapper.get('textarea').setValue(json)
    expect(state.record.var.field_1).toEqual(JSON.parse(json))
  })

  it.each(Object.keys(registry.types).filter(type => type.startsWith('FileId')))('keeps the file chooser for %s', async type => {
    const { wrapper } = await mountField(`${type} | None`)
    expect(wrapper.get('input[type="file"]').attributes('accept')).toBeTruthy()
  })

  it.each(BUILT_IN_CODE_STR_TYPES)('selects the dedicated code editor for %s', async type => {
    const { wrapper } = await mountField(`${type} | None`)
    const editor = wrapper.getComponent({ name: 'AimdCodeField' })
    expect(editor.props('language')).toBe(resolveAimdCodeEditorLanguage(type))
  })

  it.each(['AiralogyMarkdown', 'DNASequence'])('retains the dedicated %s component', async type => {
    const { wrapper } = await mountField(`${type} | None`)
    expect(wrapper.findComponent({ name: type === 'AiralogyMarkdown' ? 'AimdMarkdownField' : 'AimdDnaSequenceField' }).exists()).toBe(true)
  })

  it.each(['EntityRef', 'ResourceRef'])('retains resolver-backed lookup for %s', async type => {
    const { wrapper } = await mountField(`${type} | None`, undefined, `, entity="plasmid", source="registry"${type === 'ResourceRef' ? ', resource_role="reference"' : ''}`)
    expect(wrapper.find('.aimd-rec-entity-ref').exists()).toBe(true)
  })

  it('keeps Collector actions and writes provider observations', async () => {
    const read = vi.fn().mockResolvedValue({ value: 23.4, observed_at: '2026-10-27T04:00:00Z' })
    const { wrapper, state } = await mountField('Observation[float] | None', undefined, ', collector="sensor"', {
      protocolContext: '```connectors\ngateway:\n  kind: data_source\n  descriptor: ./sensor.yaml\n```\n\n```collectors\nsensor:\n  connector: gateway\n  mode: snapshot\n```',
      collectorProviders: { gateway: { read } },
      requestCollectorPermission: async () => 'record' as const,
    })
    await wrapper.get('.aimd-rec-collector__button--primary').trigger('click')
    await vi.waitFor(() => expect(state.record.var.field_1).toMatchObject({ value: 23.4, source: { kind: 'collector', collector: 'sensor' } }))
    expect(read).toHaveBeenCalledTimes(1)
  })
})
