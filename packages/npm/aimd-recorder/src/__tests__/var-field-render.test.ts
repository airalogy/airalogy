import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AimdVarNode, AimdVarTableNode } from '@airalogy/aimd-core/types'

import AimdVarField from '../components/AimdVarField.vue'
import AimdVarTableField from '../components/AimdVarTableField.vue'
import { createAimdRecorderMessages } from '../locales'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const source = readFileSync(resolve(__dirname, '../components/AimdVarField.vue'), 'utf8')
const recorderSource = readFileSync(resolve(__dirname, '../components/AimdRecorder.vue'), 'utf8')
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

  it('keeps table metadata popovers from being clipped by table bounds', () => {
    expect(styles).toMatch(/\.aimd-field--var-table \.aimd-field__table-preview \{[\s\S]*?overflow: visible;/)
    expect(styles).toMatch(/\.aimd-field--var-table \.aimd-field__table-preview th \{[\s\S]*?overflow: visible;/)
    expect(styles).toContain('.aimd-field--var-table .aimd-field__table-preview th:has(.aimd-field__metadata-host:hover)')
  })

  it('renders editable table cell values without inherited italic preview styling', () => {
    expect(recorderSource).toMatch(/\.aimd-protocol-recorder__content :deep\(\.aimd-rec-table-cell-input\) \{[\s\S]*?font-style: normal;/)
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
})
