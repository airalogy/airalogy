import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AimdVarNode, AimdVarTableNode } from '@airalogy/aimd-core/types'
import { getAimdBuiltInTypeEnumValues } from '@airalogy/aimd-core/utils'

import AimdRecorder from '../components/AimdRecorder.vue'
import AimdVarField from '../components/AimdVarField.vue'
import AimdVarTableField from '../components/AimdVarTableField.vue'
import { createAimdRecorderMessages } from '../locales'

vi.mock('../components/AimdCodeField.vue', () => ({
  __esModule: true,
  default: {
    name: 'AimdCodeField',
    props: ['modelValue', 'language', 'disabled', 'compact'],
    emits: ['update:modelValue', 'blur'],
    template: '<textarea class="aimd-code-field-stub" :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\')" />',
  },
}))

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const source = readFileSync(resolve(__dirname, '../components/AimdVarField.vue'), 'utf8')
const codeFieldSource = readFileSync(resolve(__dirname, '../components/AimdCodeField.vue'), 'utf8')
const markdownFieldSource = readFileSync(resolve(__dirname, '../components/AimdMarkdownField.vue'), 'utf8')
const varTableSource = readFileSync(resolve(__dirname, '../components/AimdVarTableField.vue'), 'utf8')
const recorderSource = readFileSync(resolve(__dirname, '../components/AimdRecorder.vue'), 'utf8')
const markdownNoteSource = readFileSync(resolve(__dirname, '../components/AimdMarkdownNoteField.vue'), 'utf8')
const varHelpersSource = readFileSync(resolve(__dirname, '../composables/useVarHelpers.ts'), 'utf8')
const recorderStyles = readFileSync(resolve(__dirname, '../styles/recorder.css'), 'utf8')
const rendererStyles = readFileSync(resolve(__dirname, '../../../aimd-renderer/src/styles/renderer.css'), 'utf8')

describe('AimdVarField render behavior', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shares compact layout syncing between textareas and single-line inputs', () => {
    expect(source).toMatch(/function syncCompactControlLayout\(control: HTMLInputElement \| HTMLTextAreaElement\)/)
    expect(source).toMatch(/if \(typeof HTMLTextAreaElement !== "undefined" && control instanceof HTMLTextAreaElement\) \{\s*syncAutoWrapTextareaHeight\(control\)\s*\}/)
  })

  it('resizes single-line inputs while the user types', () => {
    expect(source).toMatch(/onInput: \(event: Event\) => \{\s*const el = event\.target as HTMLInputElement\s*syncCompactControlLayout\(el\)\s*syncNumberValidity\(el\)\s*onVarChange\(el\.value\)\s*\}/)
  })

  it('applies Pydantic-style numeric constraints from AIMD kwargs', () => {
    expect(source).toMatch(/getNumericInputAttributes\(type, node\.definition\?\.kwargs\)/)
    expect(source).toMatch(/getNumericConstraintViolation\(displayValue, type, node\.definition\?\.kwargs\)/)
    expect(source).toMatch(/control\.setCustomValidity\(violation \?\? ""\)/)
  })

  it('renders code-like vars with the dedicated code editor field', () => {
    expect(source).toMatch(/const AimdCodeField = defineAsyncComponent\(\(\) => import\("\.\/AimdCodeField\.vue"\)\)/)
    expect(source).toMatch(/if \(inputKind === "code"\)/)
    expect(source).toMatch(/language: codeLanguage/)
    expect(source).toMatch(/"aimd-rec-inline--var-stacked--code"/)
    expect(source).toMatch(/language: "json"/)
  })

  it('starts code editors at a content-driven height and supports compact density', () => {
    expect(codeFieldSource).toContain('createMonacoAutoHeight')
    expect(codeFieldSource).toMatch(/const editorHeight = codeAutoHeight\.editorHeight/)
    expect(codeFieldSource).toMatch(/codeAutoHeight\.attachEditor\(monacoEditor\)/)
    expect(codeFieldSource).toContain('compact?: boolean')
    expect(codeFieldSource).toContain("verticalPadding: props.compact ? 12 : 24")
    expect(codeFieldSource).toContain("padding: props.compact ? { top: 6, bottom: 6 } : { top: 12, bottom: 12 }")
    expect(codeFieldSource).toContain('--aimd-code-field-editor-height')
    expect(codeFieldSource).not.toContain('min-height: 240px;')
  })

  it('layers recorder styles on top of renderer styles', () => {
    expect(recorderStyles).toContain('@import "@airalogy/aimd-renderer/styles";')
    expect(recorderSource).toContain('class="aimd-protocol-recorder__content aimd-renderer"')
    expect(markdownFieldSource).toContain('class="aimd-markdown-field__preview aimd-renderer"')
    expect(markdownNoteSource).toContain('class="aimd-markdown-note-field__preview aimd-renderer"')
    expect(recorderStyles).toContain('.aimd-field--editable')
    expect(recorderStyles).toContain('.aimd-field--no-style')
    expect(recorderStyles).toContain('.aimd-field-wrapper--inline')
    expect(recorderStyles).not.toContain('.aimd-figure {')
    expect(recorderSource).not.toMatch(/\.aimd-protocol-recorder__content :deep\(h[1-3]\)/)
    expect(recorderSource).not.toMatch(/\.aimd-protocol-recorder__content :deep\(p\)/)
    expect(recorderSource).not.toMatch(/\.aimd-protocol-recorder__content :deep\(ul\),\n\.aimd-protocol-recorder__content :deep\(ol\)/)
    expect(markdownFieldSource).not.toMatch(/\.aimd-markdown-field__preview :deep\(ul\),\n\.aimd-markdown-field__preview :deep\(ol\)/)
  })

  it('keeps table metadata popovers from being clipped by table bounds', () => {
    expect(rendererStyles).toMatch(/\.aimd-field--var-table \.aimd-field__table-preview \{[\s\S]*?overflow: visible;/)
    expect(rendererStyles).toMatch(/\.aimd-field--var-table \.aimd-field__table-preview th \{[\s\S]*?overflow: visible;/)
    expect(rendererStyles).toContain('.aimd-field--var-table .aimd-field__table-preview th:has(.aimd-field__metadata-host:hover)')
  })

  it('keeps figure images and captions visually attached without card elevation', () => {
    expect(rendererStyles).toMatch(/\.aimd-figure \{[\s\S]*?width: fit-content;/)
    expect(rendererStyles).toMatch(/\.aimd-figure \{[\s\S]*?overflow: hidden;/)
    expect(rendererStyles).not.toContain('box-shadow: 0 10px 28px')
    expect(rendererStyles).toMatch(/\.aimd-figure__caption \{[\s\S]*?border-top: 1px solid #d8e2ef;/)
    expect(rendererStyles).toMatch(/\.aimd-figure__legend \{[\s\S]*?margin: 4px 0 0;/)
  })

  it('uses selectable citation popovers instead of pseudo-element tooltips', () => {
    expect(rendererStyles).toContain('.aimd-cite__popover')
    expect(rendererStyles).not.toContain('.aimd-cite__ref::after')
    expect(rendererStyles).toMatch(/\.aimd-cite__popover \{[\s\S]*?pointer-events: none;/)
    expect(rendererStyles).toMatch(/\.aimd-cite__popover \{[\s\S]*?user-select: text;/)
    expect(rendererStyles).toMatch(/\.aimd-cite__popover::before \{[\s\S]*?height: 10px;/)
    expect(rendererStyles).toMatch(/\.aimd-cite__ref:hover \.aimd-cite__popover,[\s\S]*?pointer-events: auto;/)
  })

  it('marks internal references as focusable route-safe targets', () => {
    expect(rendererStyles).toMatch(/\.aimd-ref\[data-aimd-ref-target\] \{[\s\S]*?cursor: pointer;/)
    expect(rendererStyles).toMatch(/\.aimd-ref\[data-aimd-ref-target\]:focus-visible \{[\s\S]*?outline: 2px solid rgba\(25, 118, 210, 0\.36\);/)
  })

  it('renders editable table cell values without inherited italic preview styling', () => {
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-table-cell-input\) \{[\s\S]*?font-style: normal;/)
  })

  it('keeps card-style table rows compact in dense recorder layouts', () => {
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-card-list\) \{[\s\S]*?gap: 8px;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-card\) \{[\s\S]*?padding: 7px 10px 9px;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-card__field\) \{[\s\S]*?padding-top: 6px;[\s\S]*?margin-top: 6px;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-card__input\) \{[\s\S]*?height: 30px;/)
    expect(recorderSource).toContain('.aimd-rec-card .aimd-rec-inline-table__drag-handle')
  })

  it('shows visible row numbers for table and card var_table layouts', () => {
    expect(varTableSource).toContain('function renderRowNumber')
    expect(varTableSource).toContain('aimd-rec-inline-table__row-control')
    expect(varTableSource).toContain('aimd-rec-card__row-meta')
    expect(varTableSource).toContain('aimd-rec-inline-table__row-head-label')
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline-table__row-number\) \{[\s\S]*?font-variant-numeric: tabular-nums;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline-table__row-number\) \{[\s\S]*?background: transparent;[\s\S]*?font-style: normal;/)
  })

  it('clips plain stacked var controls so rounded corners render cleanly', () => {
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline--var-stacked\) \{[\s\S]*?overflow: hidden;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline--var-stacked:has\(\.aimd-field__metadata-host\)\) \{[\s\S]*?overflow: visible;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline--has-assigner-control\) \{[\s\S]*?overflow: hidden;/)
  })

  it('lets stacked var fields widen before wrapping long metadata keys', () => {
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline--var-stacked\) \{[\s\S]*?width: max-content;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline--var-stacked \.aimd-field--no-style\.aimd-field__label\) \{[\s\S]*?flex-wrap: nowrap;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline--var-stacked \.aimd-field__scope\) \{[\s\S]*?flex: 0 0 auto;[\s\S]*?white-space: nowrap;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline--var-stacked \.aimd-field__name\) \{[\s\S]*?flex: 0 0 auto;[\s\S]*?min-width: max-content;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline--var-stacked \.aimd-field__key\) \{[\s\S]*?overflow: visible;[\s\S]*?white-space: nowrap;/)
  })

  it('keeps complex markdown tables scrollable without expanding the recorder', () => {
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(table:not\(\.aimd-rec-inline-table__table\):not\(\.aimd-scale__table\)\) \{[\s\S]*?display: block;[\s\S]*?max-width: 100%;[\s\S]*?overflow-x: auto;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(table:not\(\.aimd-rec-inline-table__table\):not\(\.aimd-scale__table\) th:first-child\),[\s\S]*?\.aimd-protocol-recorder__content :deep\(table:not\(\.aimd-rec-inline-table__table\):not\(\.aimd-scale__table\) td:first-child\) \{[\s\S]*?position: sticky;[\s\S]*?left: 0;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(table:not\(\.aimd-rec-inline-table__table\):not\(\.aimd-scale__table\) \.aimd-rec-inline--var-stacked\) \{[\s\S]*?width: min\(360px, 100%\);[\s\S]*?max-width: min\(360px, 100%\);/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(table:not\(\.aimd-rec-inline-table__table\):not\(\.aimd-scale__table\) \.aimd-rec-inline--var-stacked \.aimd-field__title\),[\s\S]*?\.aimd-protocol-recorder__content :deep\(table:not\(\.aimd-rec-inline-table__table\):not\(\.aimd-scale__table\) \.aimd-rec-inline--var-stacked \.aimd-field__key\) \{[\s\S]*?overflow: hidden;[\s\S]*?text-overflow: ellipsis;/)
    expect(source).toContain('class: "aimd-field__title", title: displayTitle')
    expect(source).toContain('class: "aimd-field__key", title: id')
  })

  it('normalizes stacked var value typography across native control types', () => {
    expect(recorderSource).toContain('--rec-body-font-size: 14px;')
    expect(recorderSource).toContain('--rec-var-value-font-size: var(--rec-body-font-size);')
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content \{[\s\S]*?font-size: var\(--rec-body-font-size\);/)
    expect(source).toContain('aimd-rec-inline__value-control aimd-rec-inline__input aimd-rec-inline__input--stacked')
    expect(source).toContain('aimd-rec-inline__value-control aimd-rec-inline__textarea aimd-rec-inline__textarea--stacked')
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline--var-stacked \.aimd-rec-inline__value-control\) \{[\s\S]*?font: inherit;[\s\S]*?font-size: var\(--rec-var-value-font-size\);/)
    expect(recorderSource).toContain('.aimd-rec-inline__value-control::-webkit-datetime-edit')
  })

  it('uses wrapped line-numbered code blocks in recorder markdown output', () => {
    expect(recorderSource).toContain('useCodeBlockRendering')
    expect(recorderSource).toMatch(/elementRenderers:\s*\{\s*pre: codeBlockPreRenderer/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-code-block\) \{[\s\S]*?overflow: hidden;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-code-block__line\) \{[\s\S]*?grid-template-columns: max-content minmax\(0, 1fr\);/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-code-block__line-code\) \{[\s\S]*?white-space: pre-wrap;[\s\S]*?overflow-wrap: anywhere;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-code-block--wrap \.aimd-code-block__line-code\) \{[\s\S]*?text-indent: calc\(-1 \* var\(--aimd-code-wrap-indent, 0ch\)\);/)
  })

  it('lets block recorder fields fill the available panel width', () => {
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline--var-markdown\) \{[\s\S]*?width: 100%;[\s\S]*?box-sizing: border-box;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline--step\) \{[\s\S]*?width: 100%;[\s\S]*?box-sizing: border-box;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline--check\) \{[\s\S]*?width: 100%;/)
    expect(recorderSource).not.toContain('width: min(100%, 1040px);')
  })

  it('keeps step body content inside the step card width', () => {
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-step-field__body\) \{[\s\S]*?width: 100%;[\s\S]*?max-width: 100%;[\s\S]*?overflow-wrap: anywhere;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-step-field__body \.aimd-step-body\) \{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-step-field__body \.aimd-step-body > \*\) \{[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%;[\s\S]*?overflow-wrap: anywhere;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-step-field__body \.aimd-rec-inline--var-markdown\),\n\.aimd-protocol-recorder__content :deep\(\.aimd-step-field__body \.aimd-field--var-table\) \{[\s\S]*?width: 100%;[\s\S]*?max-width: 100%;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-step-field__body \.aimd-field--var-table\) \{[\s\S]*?overflow-x: auto;/)
    expect(recorderSource).not.toContain('line-height: 1.72;')
  })

  it('renders file-like vars with a native file picker control', async () => {
    const node: AimdVarNode = {
      type: 'aimd',
      fieldType: 'var',
      scope: 'var',
      id: 'dose_response_file',
      raw: '{{var|dose_response_file}}',
      definition: {
        id: 'dose_response_file',
        type: 'FileIdCSV',
        kwargs: {
          title: 'Dose response file',
        },
      },
    }
    const uploadFile = vi.fn(() => 'uploaded-file-id')

    const wrapper = mount(AimdVarField, {
      props: {
        node,
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
        displayValue: '',
        inputKind: 'file',
        initialized: true,
        uploadFile,
      },
    })

    const input = wrapper.find('input[type="file"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('accept')).toBe('.csv,text/csv')
    expect(wrapper.find('.aimd-rec-file-field__badge').text()).toBe('CSV')
    expect(wrapper.find('.aimd-rec-file-field__name').text()).toBe('Choose file')

    const file = new File(['a,b\n1,2'], 'dose.csv', { type: 'text/csv' })
    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true,
    })
    await input.trigger('change')
    await Promise.resolve()

    expect(uploadFile).toHaveBeenCalledWith(file, expect.objectContaining({
      fieldKey: 'var:dose_response_file',
      type: 'FileIdCSV',
      normalizedType: 'fileidcsv',
      accept: '.csv,text/csv',
    }))
    expect(wrapper.emitted('change')?.[0]?.[0]).toMatchObject({
      id: 'dose_response_file',
      value: 'uploaded-file-id',
      type: 'FileIdCSV',
      inputKind: 'file',
    })
  })

  it('places file assigner actions in the field header instead of the file card body', () => {
    const node: AimdVarNode = {
      type: 'aimd',
      fieldType: 'var',
      scope: 'var',
      id: 'dose_response_file',
      raw: '{{var|dose_response_file}}',
      definition: {
        id: 'dose_response_file',
        type: 'FileIdCSV',
      },
    }

    const wrapper = mount(AimdVarField, {
      props: {
        node,
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
        displayValue: '',
        inputKind: 'file',
        initialized: true,
        assignerControl: h('button', { class: 'assigner-test-button', type: 'button' }, 'run'),
        assignerStatus: h('span', { class: 'assigner-test-status' }, 'idle'),
      },
    })

    expect(wrapper.find('.aimd-rec-inline__header-assigner-actions').exists()).toBe(true)
    expect(wrapper.find('.aimd-rec-inline__header-assigner-action .assigner-test-button').exists()).toBe(true)
    expect(wrapper.find('.aimd-rec-inline__header-assigner-state .assigner-test-status').exists()).toBe(true)
    expect(wrapper.find('.aimd-rec-inline__control-row').exists()).toBe(false)
    expect(recorderSource).toContain('.aimd-rec-inline__header-assigner-actions')
  })

  it('places code assigner actions in the field header instead of a side prefix', () => {
    expect(source).toContain('["file", "code", "scalar-list"].includes(inputKind)')
    expect(source).toMatch(/if \(inputKind === "code"\) \{[\s\S]*?"aimd-rec-inline--var-stacked--code",[\s\S]*?\{ controlRow: false \}/)
    expect(recorderSource).toContain('["number", "date", "datetime", "time", "text", "textarea", "scalar-list", "checkbox", "boolean-select", "file", "code"].includes(inputKind)')
  })

  it('renders nullable boolean vars as tri-state select fields', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: 'Rash: {{var|reaction_rash: bool | None}}',
        locale: 'en-US',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    const select = wrapper.find<HTMLSelectElement>('select[data-rec-focus-key="var:reaction_rash"]')
    expect(select.exists()).toBe(true)
    expect(select.classes()).toContain('aimd-rec-inline__boolean-select')
    expect(select.findAll('option').map(option => option.text())).toEqual(['Not set', 'True', 'False'])
    expect(select.element.value).toBe('')

    await select.setValue('true')
    await flushPromises()

    let updates = wrapper.emitted('update:modelValue') ?? []
    let latest = updates[updates.length - 1]?.[0] as { var?: Record<string, unknown> } | undefined
    expect(latest?.var?.reaction_rash).toBe(true)

    await select.setValue('')
    await flushPromises()

    updates = wrapper.emitted('update:modelValue') ?? []
    latest = updates[updates.length - 1]?.[0] as { var?: Record<string, unknown> } | undefined
    expect(latest?.var?.reaction_rash).toBeNull()
  })

  it('renders scalar-list fields as full-row controls with horizontal items before wrapping', () => {
    expect(source).toContain('{ controlRow: false, headerAction: modeToolbar }')
    expect(source).toContain('context.measureText(line).width')
    expect(source).toContain('syncScalarListTextInputLayout(el)')
    expect(source).toContain('"--aimd-rec-scalar-list-input-width"')
    expect(source).toContain('hasExplicitLineBreak(item)')
    expect(source).toMatch(/isNumericScalarList\s*\?\s*h\("input"/)
    expect(source).toContain('h("textarea"')
    expect(source).toContain('syncAutoWrapTextareaHeight(control)')
    expect(source).toContain('props.messages.scalarList.itemIndex(rowIndex + 1)')
    expect(recorderSource).toContain('.aimd-rec-inline__header-extra-action')
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline--var-stacked--scalar-list\) \{[\s\S]*?display: flex;[\s\S]*?width: 100%;[\s\S]*?margin: 12px 0;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-scalar-list__items\) \{[\s\S]*?flex-flow: row wrap;[\s\S]*?gap: 5px;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-scalar-list__rows\) \{[\s\S]*?display: contents;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-scalar-list__row\) \{[\s\S]*?display: inline-flex;[\s\S]*?align-items: stretch;[\s\S]*?gap: 0;[\s\S]*?width: fit-content;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-scalar-list__row--has-drag\.aimd-rec-scalar-list__row--has-remove\) \{[\s\S]*?--aimd-rec-scalar-list-control-offset: 68px;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-scalar-list__row--multiline\) \{[\s\S]*?flex: 1 1 100%;[\s\S]*?width: 100%;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-scalar-list__input\) \{[\s\S]*?width: var\(--aimd-rec-scalar-list-input-width, calc\(8em \+ 16px\)\);[\s\S]*?max-width: min\(calc\(42em \+ 16px\), calc\(100% - var\(--aimd-rec-scalar-list-control-offset, 0px\)\)\);/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-scalar-list__input--text\) \{[\s\S]*?resize: none;[\s\S]*?overflow: hidden;[\s\S]*?white-space: pre-wrap;[\s\S]*?overflow-wrap: anywhere;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-scalar-list__row--multiline \.aimd-rec-scalar-list__input--text\) \{[\s\S]*?flex: 1 1 auto;[\s\S]*?width: auto;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-scalar-list__index\) \{[\s\S]*?min-width: 22px;[\s\S]*?min-height: 26px;[\s\S]*?font-size: 10px;[\s\S]*?font-variant-numeric: tabular-nums;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-scalar-list__drag\) \{[\s\S]*?width: 20px;[\s\S]*?min-height: 26px;[\s\S]*?font-size: 12px;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-scalar-list__remove\) \{[\s\S]*?width: 26px;[\s\S]*?min-height: 26px;[\s\S]*?font-size: 13px;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-scalar-list__row--drop-target-before\)::before,[\s\S]*?\.aimd-protocol-recorder__content :deep\(\.aimd-rec-scalar-list__row--drop-target-after\)::after \{[\s\S]*?animation: aimd-rec-scalar-list-insert-pulse/)
    expect(recorderSource).toContain('@keyframes aimd-rec-scalar-list-insert-pulse')
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-scalar-list__mode-button:first-child\) \{[\s\S]*?border-radius: 5px 0 0 5px;/)
    expect(recorderSource).not.toContain('min-height: 72px;')
  })

  it('renders explicit multiline list string items as full-row controls', async () => {
    const node: AimdVarNode = {
      type: 'aimd',
      fieldType: 'var',
      scope: 'var',
      id: 'sample_notes',
      raw: '{{var|sample_notes}}',
      definition: {
        id: 'sample_notes',
        type: 'list[str]',
      },
    }

    const wrapper = mount(AimdVarField, {
      props: {
        node,
        value: ['a\nb\nc'] as any,
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
        displayValue: '["a\\nb\\nc"]',
        inputKind: 'scalar-list',
        initialized: true,
      },
    })

    const row = wrapper.find('.aimd-rec-scalar-list__row')
    expect(row.classes()).toContain('aimd-rec-scalar-list__row--multiline')
    expect(wrapper.find<HTMLTextAreaElement>('.aimd-rec-scalar-list__input').element.value).toBe('a\nb\nc')
  })

  it('renders list[str] vars as repeatable string inputs', async () => {
    const node: AimdVarNode = {
      type: 'aimd',
      fieldType: 'var',
      scope: 'var',
      id: 'sample_tags',
      raw: '{{var|sample_tags}}',
      definition: {
        id: 'sample_tags',
        type: 'list[str]',
        kwargs: {
          title: 'Sample tags',
        },
      },
    }

    const wrapper = mount(AimdVarField, {
      props: {
        node,
        value: ['alpha'] as any,
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
        displayValue: '["alpha"]',
        inputKind: 'scalar-list',
        initialized: true,
      },
    })

    const getInputs = () => wrapper.findAll<HTMLInputElement>('.aimd-rec-scalar-list__input')
    const getLatestChange = () => {
      const changes = wrapper.emitted('change') ?? []
      return changes[changes.length - 1]?.[0]
    }
    expect(getInputs()).toHaveLength(1)
    expect(getInputs()[0].element.tagName).toBe('TEXTAREA')
    expect(getInputs()[0].element.value).toBe('alpha')
    expect(wrapper.findAll('.aimd-rec-scalar-list__index').map(index => index.text())).toEqual(['1'])
    expect(wrapper.find('.aimd-rec-scalar-list__index').attributes('title')).toBe('Item 1')
    expect(wrapper.find('.aimd-rec-scalar-list__add').text()).toBe('Add item')

    await wrapper.find('.aimd-rec-scalar-list__add').trigger('click')
    await wrapper.vm.$nextTick()
    expect(getInputs()).toHaveLength(2)
    expect(wrapper.findAll('.aimd-rec-scalar-list__index').map(index => index.text())).toEqual(['1', '2'])
    expect(getLatestChange()).toMatchObject({
      id: 'sample_tags',
      value: ['alpha'],
      type: 'list[str]',
      inputKind: 'scalar-list',
    })

    await getInputs()[1].setValue('beta')
    await wrapper.vm.$nextTick()
    expect(getLatestChange()).toMatchObject({
      value: ['alpha', 'beta'],
    })

    const dragButtons = wrapper.findAll('.aimd-rec-scalar-list__drag')
    expect(dragButtons).toHaveLength(2)
    await dragButtons[1].trigger('dragstart', {
      dataTransfer: {
        effectAllowed: '',
        setData: vi.fn(),
      },
    })
    await wrapper.findAll('.aimd-rec-scalar-list__row')[0].trigger('dragover')
    expect(wrapper.findAll('.aimd-rec-scalar-list__row')[0].classes()).toContain('aimd-rec-scalar-list__row--drop-target-before')
    await wrapper.findAll('.aimd-rec-scalar-list__row')[0].trigger('drop')
    await wrapper.vm.$nextTick()
    expect(getLatestChange()).toMatchObject({
      value: ['beta', 'alpha'],
    })

    await wrapper.findAll('.aimd-rec-scalar-list__remove')[0].trigger('click')
    await wrapper.vm.$nextTick()
    expect(getLatestChange()).toMatchObject({
      value: ['alpha'],
    })
  })

  it('renders list[int] vars as repeatable number inputs', async () => {
    const node: AimdVarNode = {
      type: 'aimd',
      fieldType: 'var',
      scope: 'var',
      id: 'counts',
      raw: '{{var|counts}}',
      definition: {
        id: 'counts',
        type: 'list[int]',
        kwargs: {
          title: 'Counts',
        },
      },
    }

    const wrapper = mount(AimdVarField, {
      props: {
        node,
        value: [1] as any,
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
        displayValue: '[1]',
        inputKind: 'scalar-list',
        initialized: true,
      },
    })

    const getInputs = () => wrapper.findAll<HTMLInputElement>('.aimd-rec-scalar-list__input')
    const getLatestChange = () => {
      const changes = wrapper.emitted('change') ?? []
      return changes[changes.length - 1]?.[0]
    }
    expect(getInputs()).toHaveLength(1)
    expect(getInputs()[0].attributes('type')).toBe('number')
    expect(getInputs()[0].attributes('step')).toBe('1')
    expect(getInputs()[0].element.value).toBe('1')

    await wrapper.find('.aimd-rec-scalar-list__add').trigger('click')
    await wrapper.vm.$nextTick()
    await getInputs()[1].setValue('2')
    await wrapper.vm.$nextTick()
    expect(getLatestChange()).toMatchObject({
      id: 'counts',
      value: [1, 2],
      type: 'list[int]',
      inputKind: 'scalar-list',
    })
  })

  it('edits scalar-list vars in JSON mode without emitting invalid JSON', async () => {
    const node: AimdVarNode = {
      type: 'aimd',
      fieldType: 'var',
      scope: 'var',
      id: 'sample_tags',
      raw: '{{var|sample_tags}}',
      definition: {
        id: 'sample_tags',
        type: 'list[str]',
      },
    }

    const wrapper = mount(AimdVarField, {
      props: {
        node,
        value: ['alpha'] as any,
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
        displayValue: '["alpha"]',
        inputKind: 'scalar-list',
        initialized: true,
      },
    })

    const modeButtons = wrapper.findAll('.aimd-rec-scalar-list__mode-button')
    expect(modeButtons.map(button => button.text())).toEqual(['Items', 'JSON'])
    expect(wrapper.find('.aimd-field__label .aimd-rec-scalar-list__toolbar').exists()).toBe(true)
    expect(wrapper.find('.aimd-rec-inline__scalar-list > .aimd-rec-scalar-list__toolbar').exists()).toBe(false)

    await modeButtons[1].trigger('click')
    await wrapper.vm.$nextTick()
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()
    const jsonEditor = wrapper.findComponent({ name: 'AimdCodeField' })
    expect(jsonEditor.exists()).toBe(true)
    expect(jsonEditor.props('modelValue')).toContain('"alpha"')
    expect(jsonEditor.props('language')).toBe('json')
    expect(jsonEditor.props('compact')).toBe(true)

    await jsonEditor.vm.$emit('update:modelValue', '["aaa", "bbb"]')
    await wrapper.vm.$nextTick()
    const getLatestChange = () => {
      const changes = wrapper.emitted('change') ?? []
      return changes[changes.length - 1]?.[0]
    }
    expect(getLatestChange()).toMatchObject({
      id: 'sample_tags',
      value: ['aaa', 'bbb'],
      type: 'list[str]',
      inputKind: 'scalar-list',
    })

    const emittedCount = (wrapper.emitted('change') ?? []).length
    await jsonEditor.vm.$emit('update:modelValue', '{"bad": true}')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.aimd-rec-scalar-list__json-error').text()).toBe('JSON value must be an array.')
    expect((wrapper.emitted('change') ?? [])).toHaveLength(emittedCount)

    await modeButtons[0].trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll<HTMLInputElement>('.aimd-rec-scalar-list__input').map(input => input.element.value)).toEqual(['aaa', 'bbb'])
  })

  it('parses numeric scalar-list JSON according to the item type', async () => {
    const node: AimdVarNode = {
      type: 'aimd',
      fieldType: 'var',
      scope: 'var',
      id: 'counts',
      raw: '{{var|counts}}',
      definition: {
        id: 'counts',
        type: 'list[int]',
      },
    }

    const wrapper = mount(AimdVarField, {
      props: {
        node,
        value: [] as any,
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
        displayValue: '[]',
        inputKind: 'scalar-list',
        initialized: true,
      },
    })

    await wrapper.findAll('.aimd-rec-scalar-list__mode-button')[1].trigger('click')
    await wrapper.vm.$nextTick()
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()
    const jsonEditor = wrapper.findComponent({ name: 'AimdCodeField' })
    await jsonEditor.vm.$emit('update:modelValue', '[1, 2]')
    await wrapper.vm.$nextTick()
    const getLatestChange = () => {
      const changes = wrapper.emitted('change') ?? []
      return changes[changes.length - 1]?.[0]
    }
    expect(getLatestChange()).toMatchObject({
      value: [1, 2],
    })

    const emittedCount = (wrapper.emitted('change') ?? []).length
    await jsonEditor.vm.$emit('update:modelValue', '[1.2]')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.aimd-rec-scalar-list__json-error').text()).toBe('JSON array items do not match this list type.')
    expect((wrapper.emitted('change') ?? [])).toHaveLength(emittedCount)
  })

  it('shows file ids as user-facing file cards instead of raw ids', async () => {
    const fileId = 'airalogy.id.file.11111111-1111-1111-1111-111111111111'
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => 't_min,area_a,area_p\n0,1000,0\n5,800,200\n',
    })))
    const node: AimdVarNode = {
      type: 'aimd',
      fieldType: 'var',
      scope: 'var',
      id: 'dose_response_file',
      raw: '{{var|dose_response_file}}',
      definition: {
        id: 'dose_response_file',
        type: 'FileIdCSV',
      },
    }

    const wrapper = mount(AimdVarField, {
      props: {
        node,
        value: fileId as any,
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
        displayValue: '',
        inputKind: 'file',
        initialized: true,
        resolveFile: (src: string) => `/api/files/${src}`,
      },
    })

    expect(wrapper.text()).not.toContain(fileId)
    expect(wrapper.find('.aimd-rec-file-field__name').text()).toBe('Selected file')
    expect(wrapper.find('.aimd-rec-file-card__action[href]').attributes('href')).toBe(`/api/files/${fileId}`)
    expect(wrapper.find('.aimd-rec-file-card__action--danger').exists()).toBe(true)
    await flushPromises()
    expect(wrapper.find('.aimd-rec-file-field__csv-preview').text()).toContain('t_min')
    expect(wrapper.find('.aimd-rec-file-field__csv-preview').text()).toContain('1000')
  })

  it('renders image file ids with an inline preview when a resolver is available', () => {
    const fileId = 'airalogy.id.file.22222222-2222-2222-2222-222222222222'
    const node: AimdVarNode = {
      type: 'aimd',
      fieldType: 'var',
      scope: 'var',
      id: 'chart',
      raw: '{{var|chart}}',
      definition: {
        id: 'chart',
        type: 'FileIdPNG',
      },
    }

    const wrapper = mount(AimdVarField, {
      props: {
        node,
        value: fileId as any,
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
        displayValue: '',
        inputKind: 'file',
        initialized: true,
        resolveFile: (src: string) => `/api/files/${src}`,
      },
    })

    const preview = wrapper.find('.aimd-rec-file-field__preview img')
    expect(preview.exists()).toBe(true)
    expect(preview.attributes('src')).toBe(`/api/files/${fileId}`)
    expect(wrapper.text()).not.toContain(fileId)
    expect((wrapper.find('.aimd-rec-inline--var-stacked').element as HTMLElement).style.width).toBe('360px')
    expect(varHelpersSource).toContain('case "image":')
    expect(varHelpersSource).toContain('return 360')
    expect(recorderSource).toContain('.aimd-rec-inline__file-control[data-file-kind="image"] .aimd-rec-file-field__preview')
  })

  it('uses host-resolved file metadata for file cards', async () => {
    const fileId = 'airalogy.id.file.33333333-3333-3333-3333-333333333333'
    const node: AimdVarNode = {
      type: 'aimd',
      fieldType: 'var',
      scope: 'var',
      id: 'chart',
      raw: '{{var|chart}}',
      definition: {
        id: 'chart',
        type: 'FileIdSVG',
      },
    }

    const wrapper = mount(AimdVarField, {
      props: {
        node,
        value: fileId as any,
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
        displayValue: '',
        inputKind: 'file',
        initialized: true,
        resolveFile: (src: string) => `/api/files/${src}`,
        resolveFileInfo: async (src: string) => ({
          id: src,
          name: 'conversion_curve.svg',
          url: `/signed/${src}`,
          content_type: 'image/svg+xml',
          size: 2048,
        }),
      },
    })

    await flushPromises()

    expect(wrapper.find('.aimd-rec-file-field__name').text()).toBe('conversion_curve.svg')
    expect(wrapper.find('.aimd-rec-file-card__meta').text()).toContain('IMG')
    expect(wrapper.find('.aimd-rec-file-card__meta').text()).toContain('2.0 KB')
    expect(wrapper.find('.aimd-rec-file-field__preview img').attributes('src')).toBe(`/signed/${fileId}`)
  })

  it('falls back to serializable selected-file metadata without an upload handler', async () => {
    const node: AimdVarNode = {
      type: 'aimd',
      fieldType: 'var',
      scope: 'var',
      id: 'image_file',
      raw: '{{var|image_file}}',
      definition: {
        id: 'image_file',
        type: 'image',
      },
    }

    const wrapper = mount(AimdVarField, {
      props: {
        node,
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
        displayValue: '',
        inputKind: 'file',
        initialized: true,
      },
    })

    const input = wrapper.find('input[type="file"]')
    expect(input.attributes('accept')).toBe('image/*')
    const file = new File(['png'], 'chart.png', {
      type: 'image/png',
      lastModified: 456,
    })
    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true,
    })
    await input.trigger('change')
    await Promise.resolve()

    expect(wrapper.emitted('change')?.[0]?.[0]).toMatchObject({
      id: 'image_file',
      value: {
        format: 'airalogy_selected_file_v1',
        name: 'chart.png',
        type: 'image/png',
        size: 3,
        lastModified: 456,
      },
      inputKind: 'file',
    })
  })

  it('styles metadata examples as distinct chips', () => {
    expect(rendererStyles).toContain('.aimd-field__metadata-examples')
    expect(rendererStyles).toContain('.aimd-field__metadata-example')
    expect(rendererStyles).toMatch(/\.aimd-field__metadata-example \{[\s\S]*?border: 1px solid rgba\(248, 250, 252, 0\.18\);/)
  })

  it('renders AIMD var metadata and uses examples as placeholders', () => {
    const node: AimdVarNode = {
      type: 'aimd',
      fieldType: 'var',
      scope: 'var',
      id: 'record_date',
      raw: '{{var|record_date}}',
      definition: {
        id: 'record_date',
        type: 'str',
        kwargs: {
          title: 'Record date',
          description: 'ISO date',
          examples: ['2026-05-26', '2026-05-27'],
        },
      },
    }

    const wrapper = mount(AimdVarField, {
      props: {
        node,
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
        displayValue: '',
        inputKind: 'text',
        initialized: true,
      },
    })

    expect(wrapper.find('.aimd-field__title').text()).toBe('Record date')
    expect(wrapper.find('.aimd-field__title').attributes('title')).toBe('Record date')
    expect(wrapper.find('.aimd-field__key').text()).toBe('record_date')
    expect(wrapper.find('.aimd-field__key').attributes('title')).toBe('record_date')
    expect(wrapper.find('.aimd-field__description').exists()).toBe(false)
    expect(wrapper.find('.aimd-field__metadata-popover').text()).toContain('ISO date')
    expect(wrapper.find('.aimd-field__metadata-examples-label').text()).toBe('e.g.')
    expect(wrapper.findAll('.aimd-field__metadata-example').map(example => example.text())).toEqual(['2026-05-26', '2026-05-27'])
    expect(wrapper.find('.aimd-field__metadata-host').attributes('tabindex')).toBe('0')
    expect(wrapper.find('.aimd-field__metadata-host').attributes('title')).toBeUndefined()
    expect(wrapper.find('.aimd-field__metadata-host').attributes('aria-label')).toContain('ISO date')
    expect(wrapper.find('.aimd-field__label').attributes('title')).toBeUndefined()
    expect(wrapper.find('.aimd-field__label').classes()).toContain('aimd-field__label--has-metadata')
    expect((wrapper.find('input, textarea').element as HTMLInputElement | HTMLTextAreaElement).placeholder).toBe('2026-05-26')
  })

  it('does not use AIMD var titles as placeholders', () => {
    const node: AimdVarNode = {
      type: 'aimd',
      fieldType: 'var',
      scope: 'var',
      id: 'operator',
      raw: '{{var|operator}}',
      definition: {
        id: 'operator',
        type: 'str',
        kwargs: {
          title: 'Operator',
        },
      },
    }

    const wrapper = mount(AimdVarField, {
      props: {
        node,
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
        displayValue: '',
        inputKind: 'text',
        initialized: true,
      },
    })

    expect(wrapper.find('.aimd-field__title').text()).toBe('Operator')
    expect((wrapper.find('input, textarea').element as HTMLInputElement | HTMLTextAreaElement).placeholder).toBe('')
  })

  it('lets fieldMeta override AIMD var display metadata', () => {
    const node: AimdVarNode = {
      type: 'aimd',
      fieldType: 'var',
      scope: 'var',
      id: 'record_date',
      raw: '{{var|record_date}}',
      definition: {
        id: 'record_date',
        type: 'str',
        kwargs: {
          title: 'AIMD title',
          description: 'AIMD description',
          examples: ['aimd-example'],
        },
      },
    }

    const wrapper = mount(AimdVarField, {
      props: {
        node,
        disabled: false,
        extraClasses: [],
        messages: createAimdRecorderMessages('en-US'),
        fieldMeta: {
          title: 'Runtime title',
          description: 'Runtime description',
          examples: ['runtime-example'],
        },
        displayValue: '',
        inputKind: 'text',
        initialized: true,
      },
    })

    expect(wrapper.find('.aimd-field__title').text()).toBe('Runtime title')
    expect(wrapper.find('.aimd-field__description').exists()).toBe(false)
    expect(wrapper.find('.aimd-field__metadata-popover').text()).toContain('Runtime description')
    expect(wrapper.find('.aimd-field__metadata-example').text()).toBe('runtime-example')
    expect(wrapper.find('.aimd-field__metadata-host').attributes('title')).toBeUndefined()
    expect(wrapper.find('.aimd-field__metadata-host').attributes('aria-label')).toContain('Runtime description')
    expect((wrapper.find('input, textarea').element as HTMLInputElement | HTMLTextAreaElement).placeholder).toBe('runtime-example')
  })

  it('renders parsed Literal vars as select fields in AimdRecorder', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: 'Review type: {{var|review_type: Literal["quick", "scoping"] = "scoping", title = "Review type"}}',
        locale: 'en-US',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    const select = wrapper.find('select[data-rec-focus-key="var:review_type"]')
    expect(select.exists()).toBe(true)
    expect(select.findAll('option').map(option => option.text())).toEqual(['quick', 'scoping'])
    expect((select.element as HTMLSelectElement).value).toBe('1')

    await select.setValue('0')
    await flushPromises()

    const updates = wrapper.emitted('update:modelValue') ?? []
    const latest = updates[updates.length - 1]?.[0] as { var?: Record<string, unknown> } | undefined
    expect(latest?.var?.review_type).toBe('quick')
  })

  it('renders official Airalogy built-in enum types as select fields in AimdRecorder', async () => {
    const enumValues = getAimdBuiltInTypeEnumValues('BloodType | None')
    expect(enumValues.length).toBeGreaterThan(0)

    const wrapper = mount(AimdRecorder, {
      props: {
        content: 'Blood type: {{var|blood_type: BloodType | None, title = "Blood type"}}',
        locale: 'en-US',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    const select = wrapper.find('select[data-rec-focus-key="var:blood_type"]')
    expect(select.exists()).toBe(true)
    expect(select.findAll('option').map(option => option.text())).toEqual([
      '',
      ...enumValues.map(value => String(value)),
    ])

    await select.setValue('0')
    await flushPromises()

    const updates = wrapper.emitted('update:modelValue') ?? []
    let latest = updates[updates.length - 1]?.[0] as { var?: Record<string, unknown> } | undefined
    expect(latest?.var?.blood_type).toBe(enumValues[0])

    const selectedSelect = wrapper.find('select[data-rec-focus-key="var:blood_type"]')
    expect(selectedSelect.findAll('option').map(option => option.text())).toEqual([
      '',
      ...enumValues.map(value => String(value)),
    ])

    await selectedSelect.setValue('')
    await flushPromises()

    const clearUpdates = wrapper.emitted('update:modelValue') ?? []
    latest = clearUpdates[clearUpdates.length - 1]?.[0] as { var?: Record<string, unknown> } | undefined
    expect(latest?.var?.blood_type).toBeNull()
  })

  it('renders scalar list vars as repeatable inputs in AimdRecorder', async () => {
    const wrapper = mount(AimdRecorder, {
      props: {
        content: 'Tags: {{var|sample_tags: list[str], title = "Sample tags"}} Counts: {{var|counts: list[int], title = "Counts"}}',
        locale: 'en-US',
        modelValue: { var: {}, step: {}, check: {}, quiz: {} },
      },
    })

    await flushPromises()
    await wrapper.vm.$nextTick()
    await vi.dynamicImportSettled()
    await wrapper.vm.$nextTick()

    const getInputs = () => wrapper.findAll<HTMLInputElement>('.aimd-rec-scalar-list__input')
    expect(getInputs()).toHaveLength(2)
    expect(getInputs()[0].attributes('data-rec-focus-key')).toBe('var:sample_tags')
    expect(getInputs()[1].attributes('data-rec-focus-key')).toBe('var:counts')
    expect(getInputs()[1].attributes('type')).toBe('number')

    expect(getInputs()[0].element.tagName).toBe('TEXTAREA')

    await wrapper.find<HTMLTextAreaElement>('textarea[data-rec-focus-key="var:sample_tags"]').setValue('qc')
    await flushPromises()

    await wrapper.findAll('.aimd-rec-scalar-list__add')[0].trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find<HTMLTextAreaElement>('textarea[data-rec-focus-key="var:sample_tags:1"]').setValue('rna')
    await flushPromises()

    await wrapper.find<HTMLInputElement>('input[data-rec-focus-key="var:counts"]').setValue('1')
    await flushPromises()
    await wrapper.findAll('.aimd-rec-scalar-list__add')[1].trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find<HTMLInputElement>('input[data-rec-focus-key="var:counts:1"]').setValue('2')
    await flushPromises()

    const updates = wrapper.emitted('update:modelValue') ?? []
    const latest = updates[updates.length - 1]?.[0] as { var?: Record<string, unknown> } | undefined
    expect(latest?.var?.sample_tags).toEqual(['qc', 'rna'])
    expect(latest?.var?.counts).toEqual([1, 2])
  })

  it('renders AIMD var_table and column metadata', () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    const node: AimdVarTableNode = {
      type: 'aimd',
      fieldType: 'var_table',
      scope: 'var_table',
      id: 'samples',
      raw: '{{var_table|samples}}',
      columns: ['sample_id'],
      definition: {
        id: 'samples',
        kwargs: {
          title: 'Samples',
          description: 'Measured rows',
          examples: ['S-001 row'],
        },
        subvars: {
          sample_id: {
            id: 'sample_id',
            type: 'str',
            kwargs: {
              title: 'Sample ID',
              description: 'Tube identifier',
              examples: ['S-001'],
            },
          },
        },
      },
    }

    const wrapper = mount(AimdVarTableField, {
      props: {
        node,
        rows: [{ sample_id: '' }],
        columns: ['sample_id'],
        disabled: false,
        readonly: false,
        settlingRowKey: null,
        messages: createAimdRecorderMessages('en-US'),
      },
    })

    expect(wrapper.text()).toContain('Samples')
    expect(wrapper.text()).toContain('samples')
    expect(wrapper.text()).toContain('Measured rows')
    expect(wrapper.text()).toContain('S-001 row')
    expect(wrapper.text()).toContain('Sample ID')
    expect(wrapper.text()).toContain('sample_id')
    expect(wrapper.findAll('.aimd-field__description')).toHaveLength(0)
    expect(wrapper.findAll('.aimd-field__metadata-popover').some(popover => popover.text().includes('Tube identifier'))).toBe(true)
    expect(wrapper.findAll('.aimd-field__metadata-popover').some(popover => popover.text().includes('S-001'))).toBe(true)
    expect(wrapper.find('.aimd-field__metadata-popover').exists()).toBe(true)
    expect((wrapper.find('input').element as HTMLInputElement).placeholder).toBe('S-001')
  })

  it('renders table row numbers without adding data columns', () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    const node: AimdVarTableNode = {
      type: 'aimd',
      fieldType: 'var_table',
      scope: 'var_table',
      id: 'samples',
      raw: '{{var_table|samples}}',
      columns: ['sample_id'],
      definition: {
        id: 'samples',
        subvars: {
          sample_id: {
            id: 'sample_id',
            type: 'str',
          },
        },
      },
    }

    const wrapper = mount(AimdVarTableField, {
      props: {
        node,
        rows: [{ sample_id: 'A' }, { sample_id: 'B' }],
        columns: ['sample_id'],
        disabled: false,
        readonly: false,
        settlingRowKey: null,
        messages: createAimdRecorderMessages('en-US'),
      },
    })

    expect(wrapper.find('.aimd-rec-inline-table__row-head-label').text()).toBe('#')
    expect(wrapper.findAll('.aimd-rec-inline-table__row-number').map(number => number.text())).toEqual(['1', '2'])
    expect(wrapper.findAll('.aimd-rec-inline-table__value-cell')).toHaveLength(2)
  })

  it('places table assigner actions in the table header', () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    const node: AimdVarTableNode = {
      type: 'aimd',
      fieldType: 'var_table',
      scope: 'var_table',
      id: 'samples',
      raw: '{{var_table|samples}}',
      columns: ['sample_id'],
      definition: {
        id: 'samples',
        subvars: {
          sample_id: {
            id: 'sample_id',
            type: 'str',
          },
        },
      },
    }

    const wrapper = mount(AimdVarTableField, {
      props: {
        node,
        rows: [{ sample_id: '' }],
        columns: ['sample_id'],
        disabled: false,
        readonly: false,
        settlingRowKey: null,
        messages: createAimdRecorderMessages('en-US'),
        assignerControl: h('button', { class: 'assigner-test-button', type: 'button' }, 'run'),
        assignerStatus: h('span', { class: 'assigner-test-status' }, 'idle'),
        assignerError: 'Missing source data',
      },
    })

    expect(wrapper.find('.aimd-rec-inline-table__header-actions').exists()).toBe(true)
    expect(wrapper.find('.aimd-rec-inline-table__header-action .assigner-test-button').exists()).toBe(true)
    expect(wrapper.find('.aimd-rec-inline-table__header-state .assigner-test-status').exists()).toBe(true)
    expect(wrapper.find('.aimd-rec-inline-table__assigner-error').text()).toBe('Missing source data')
    expect(recorderSource).toContain('.aimd-rec-inline-table__header-actions')
  })

  it('does not use AIMD var_table titles as cell placeholders and honors explicit column placeholders', () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    const node: AimdVarTableNode = {
      type: 'aimd',
      fieldType: 'var_table',
      scope: 'var_table',
      id: 'samples',
      raw: '{{var_table|samples}}',
      columns: ['sample_id'],
      definition: {
        id: 'samples',
        kwargs: {
          title: 'Samples',
        },
        subvars: {
          sample_id: {
            id: 'sample_id',
            type: 'str',
            kwargs: {
              title: 'Sample ID',
            },
          },
        },
      },
    }

    const wrapper = mount(AimdVarTableField, {
      props: {
        node,
        rows: [{ sample_id: '' }],
        columns: ['sample_id'],
        disabled: false,
        readonly: false,
        settlingRowKey: null,
        messages: createAimdRecorderMessages('en-US'),
      },
    })

    expect(wrapper.text()).toContain('Samples')
    expect(wrapper.text()).toContain('Sample ID')
    expect((wrapper.find('input').element as HTMLInputElement).placeholder).toBe('')

    const wrapperWithPlaceholder = mount(AimdVarTableField, {
      props: {
        node,
        rows: [{ sample_id: '' }],
        columns: ['sample_id'],
        disabled: false,
        readonly: false,
        settlingRowKey: null,
        messages: createAimdRecorderMessages('en-US'),
        fieldMeta: {
          'var_table:samples:sample_id': {
            placeholder: 'Runtime sample',
          },
        },
      },
    })

    expect((wrapperWithPlaceholder.find('input').element as HTMLInputElement).placeholder).toBe('Runtime sample')
  })

  it('renders var_table enum metadata as select cells', async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    const node: AimdVarTableNode = {
      type: 'aimd',
      fieldType: 'var_table',
      scope: 'var_table',
      id: 'screening',
      raw: '{{var_table|screening}}',
      columns: ['decision'],
      definition: {
        id: 'screening',
        subvars: {
          decision: {
            id: 'decision',
            type: 'Literal["include", "exclude"]',
            enum: ['include', 'exclude'],
            kwargs: {
              title: 'Decision',
            },
          },
        },
      },
    }

    const wrapper = mount(AimdVarTableField, {
      props: {
        node,
        rows: [{ decision: 'exclude' }],
        columns: ['decision'],
        disabled: false,
        readonly: false,
        settlingRowKey: null,
        messages: createAimdRecorderMessages('en-US'),
      },
    })

    const select = wrapper.find('select[data-rec-focus-key="var_table:screening:0:decision"]')
    expect(select.exists()).toBe(true)
    expect((select.element as HTMLSelectElement).value).toBe('1')

    await select.setValue('0')

    const cellUpdates = wrapper.emitted('cell-input') ?? []
    expect(cellUpdates[cellUpdates.length - 1]?.[0]).toMatchObject({
      tableName: 'screening',
      column: 'decision',
      rowIndex: 0,
      value: 'include',
    })
  })

  it('keeps nullable var_table enum cells clearable to null', async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})

    const node: AimdVarTableNode = {
      type: 'aimd',
      fieldType: 'var_table',
      scope: 'var_table',
      id: 'screening',
      raw: '{{var_table|screening}}',
      columns: ['decision'],
      definition: {
        id: 'screening',
        subvars: {
          decision: {
            id: 'decision',
            type: 'Literal["include", "exclude"] | None',
            enum: ['include', 'exclude'],
          },
        },
      },
    }

    const wrapper = mount(AimdVarTableField, {
      props: {
        node,
        rows: [{ decision: 'include' }],
        columns: ['decision'],
        disabled: false,
        readonly: false,
        settlingRowKey: null,
        messages: createAimdRecorderMessages('en-US'),
      },
    })

    const select = wrapper.find('select[data-rec-focus-key="var_table:screening:0:decision"]')
    expect(select.findAll('option').map(option => option.text())).toEqual(['', 'include', 'exclude'])

    await select.setValue('')

    const cellUpdates = wrapper.emitted('cell-input') ?? []
    expect(cellUpdates[cellUpdates.length - 1]?.[0]).toMatchObject({
      tableName: 'screening',
      column: 'decision',
      rowIndex: 0,
      value: null,
    })
  })
})
