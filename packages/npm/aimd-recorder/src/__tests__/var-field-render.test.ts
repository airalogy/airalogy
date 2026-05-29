import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AimdVarNode, AimdVarTableNode } from '@airalogy/aimd-core/types'

import AimdRecorder from '../components/AimdRecorder.vue'
import AimdVarField from '../components/AimdVarField.vue'
import AimdVarTableField from '../components/AimdVarTableField.vue'
import { createAimdRecorderMessages } from '../locales'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const source = readFileSync(resolve(__dirname, '../components/AimdVarField.vue'), 'utf8')
const codeFieldSource = readFileSync(resolve(__dirname, '../components/AimdCodeField.vue'), 'utf8')
const varTableSource = readFileSync(resolve(__dirname, '../components/AimdVarTableField.vue'), 'utf8')
const recorderSource = readFileSync(resolve(__dirname, '../components/AimdRecorder.vue'), 'utf8')
const varHelpersSource = readFileSync(resolve(__dirname, '../composables/useVarHelpers.ts'), 'utf8')
const styles = readFileSync(resolve(__dirname, '../styles/aimd.css'), 'utf8')

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
  })

  it('starts CodeStr and PyStr editors at a compact content-driven height', () => {
    expect(codeFieldSource).toContain('createMonacoAutoHeight')
    expect(codeFieldSource).toMatch(/const editorHeight = codeAutoHeight\.editorHeight/)
    expect(codeFieldSource).toMatch(/codeAutoHeight\.attachEditor\(monacoEditor\)/)
    expect(codeFieldSource).toContain('--aimd-code-field-editor-height')
    expect(codeFieldSource).not.toContain('min-height: 240px;')
  })

  it('keeps table metadata popovers from being clipped by table bounds', () => {
    expect(styles).toMatch(/\.aimd-field--var-table \.aimd-field__table-preview \{[\s\S]*?overflow: visible;/)
    expect(styles).toMatch(/\.aimd-field--var-table \.aimd-field__table-preview th \{[\s\S]*?overflow: visible;/)
    expect(styles).toContain('.aimd-field--var-table .aimd-field__table-preview th:has(.aimd-field__metadata-host:hover)')
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
  })

  it('clips plain stacked var controls so rounded corners render cleanly', () => {
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline--var-stacked\) \{[\s\S]*?overflow: hidden;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline--var-stacked:has\(\.aimd-field__metadata-host\)\) \{[\s\S]*?overflow: visible;/)
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-inline--has-assigner-control\) \{[\s\S]*?overflow: hidden;/)
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
    expect(source).toContain('["file", "code"].includes(inputKind)')
    expect(source).toMatch(/if \(inputKind === "code"\) \{[\s\S]*?"aimd-rec-inline--var-stacked--code",[\s\S]*?\{ controlRow: false \}/)
    expect(recorderSource).toContain('["number", "date", "datetime", "time", "text", "textarea", "checkbox", "file", "code"].includes(inputKind)')
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
    expect(styles).toContain('.aimd-field__metadata-examples')
    expect(styles).toContain('.aimd-field__metadata-example')
    expect(styles).toMatch(/\.aimd-field__metadata-example \{[\s\S]*?border: 1px solid rgba\(248, 250, 252, 0\.18\);/)
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
    expect(wrapper.find('.aimd-field__key').text()).toBe('record_date')
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
})
