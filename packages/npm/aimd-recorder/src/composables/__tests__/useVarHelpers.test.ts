import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  normalizeVarTypeName,
  getVarInputKind,
  getScalarListInputItems,
  getScalarListItemType,
  isNullableVarType,
  isScalarListVarType,
  isStructuredVarType,
  normalizeScalarListInputItems,
  unwrapStructuredValue,
  toBooleanValue,
  toDateValue,
  formatDateTimeWithTimezone,
  normalizeDateTimeValueWithTimezone,
  formatDateForInput,
  getFileDisplayName,
  getFileInputConfig,
  getVarInputDisplayValue,
  parseVarInputValue,
  getNumericConstraintViolation,
  getNumericFieldConstraints,
  getNumericInputAttributes,
  calculateVarStackWidth,
  applyVarStackWidth,
  syncAutoWrapTextareaHeight,
  measureVarLabelWidth,
  createSelectedFileValue,
} from '../useVarHelpers'

// ---------------------------------------------------------------------------
// normalizeVarTypeName
// ---------------------------------------------------------------------------

describe('normalizeVarTypeName', () => {
  it('defaults to str for undefined', () => {
    expect(normalizeVarTypeName(undefined)).toBe('str')
  })

  it('defaults to str for empty string', () => {
    expect(normalizeVarTypeName('')).toBe('str')
  })

  it('lowercases', () => {
    expect(normalizeVarTypeName('Float')).toBe('float')
  })

  it('removes spaces, underscores, hyphens', () => {
    expect(normalizeVarTypeName('dna_sequence')).toBe('dnasequence')
    expect(normalizeVarTypeName('dna-sequence')).toBe('dnasequence')
    expect(normalizeVarTypeName('dna sequence')).toBe('dnasequence')
  })

  it('trims whitespace', () => {
    expect(normalizeVarTypeName('  int  ')).toBe('int')
  })
})

// ---------------------------------------------------------------------------
// getVarInputKind
// ---------------------------------------------------------------------------

describe('getVarInputKind', () => {
  it('returns "text" for undefined', () => {
    expect(getVarInputKind(undefined)).toBe('text')
  })

  it('returns "text" for str', () => {
    expect(getVarInputKind('str')).toBe('text')
  })

  it('returns "number" for numeric types', () => {
    expect(getVarInputKind('float')).toBe('number')
    expect(getVarInputKind('int')).toBe('number')
    expect(getVarInputKind('integer')).toBe('number')
    expect(getVarInputKind('number')).toBe('number')
  })

  it('returns "checkbox" for boolean types', () => {
    expect(getVarInputKind('bool')).toBe('checkbox')
    expect(getVarInputKind('boolean')).toBe('checkbox')
    expect(getVarInputKind('checkbox')).toBe('checkbox')
  })

  it('returns "boolean-select" for nullable boolean types', () => {
    expect(getVarInputKind('bool | None')).toBe('boolean-select')
    expect(getVarInputKind('None | bool')).toBe('boolean-select')
    expect(getVarInputKind('Optional[bool]')).toBe('boolean-select')
    expect(getVarInputKind('typing.Optional[boolean]')).toBe('boolean-select')
  })

  it('unwraps nullable annotations for built-in input kinds', () => {
    expect(getVarInputKind('int | None')).toBe('number')
    expect(getVarInputKind('Optional[datetime]')).toBe('datetime')
  })

  it('returns "date" for date', () => {
    expect(getVarInputKind('date')).toBe('date')
  })

  it('returns "datetime" for datetime types', () => {
    expect(getVarInputKind('datetime')).toBe('datetime')
    expect(getVarInputKind('currenttime')).toBe('datetime')
  })

  it('returns "time" for time types', () => {
    expect(getVarInputKind('time')).toBe('time')
    expect(getVarInputKind('duration')).toBe('time')
  })

  it('returns "dna" for dna_sequence', () => {
    expect(getVarInputKind('dna_sequence')).toBe('dna')
  })

  it('returns "textarea" for markdown types', () => {
    expect(getVarInputKind('md')).toBe('textarea')
    expect(getVarInputKind('markdown')).toBe('textarea')
    expect(getVarInputKind('airalogymarkdown')).toBe('textarea')
  })

  it('returns "scalar-list" for scalar list types', () => {
    expect(getVarInputKind('list[str]')).toBe('scalar-list')
    expect(getVarInputKind('list[str] | None')).toBe('scalar-list')
    expect(getVarInputKind('Optional[list[str]]')).toBe('scalar-list')
    expect(getVarInputKind('typing.List[str]')).toBe('scalar-list')
    expect(getVarInputKind('array[string]')).toBe('scalar-list')
    expect(getVarInputKind('str[]')).toBe('scalar-list')
    expect(getVarInputKind('list[int]')).toBe('scalar-list')
    expect(getVarInputKind('list[float]')).toBe('scalar-list')
    expect(getVarInputKind('array[number]')).toBe('scalar-list')
    expect(getVarInputKind('int[]')).toBe('scalar-list')
  })

  it('returns "textarea" for structured non-scalar list and object types', () => {
    expect(getVarInputKind('list')).toBe('textarea')
    expect(getVarInputKind('list[bool]')).toBe('textarea')
    expect(getVarInputKind('list[dict[str, int]]')).toBe('textarea')
    expect(getVarInputKind('dict[str, int]')).toBe('textarea')
    expect(getVarInputKind('json')).toBe('textarea')
    expect(getVarInputKind('Listener')).toBe('text')
  })

  it('returns "code" for built-in CodeStr aliases', () => {
    expect(getVarInputKind('PyStr')).toBe('code')
    expect(getVarInputKind('JsStr')).toBe('code')
    expect(getVarInputKind('TsStr')).toBe('code')
    expect(getVarInputKind('JsonStr')).toBe('code')
    expect(getVarInputKind('YamlStr')).toBe('code')
    expect(getVarInputKind('TomlStr')).toBe('code')
    expect(getVarInputKind('CodeStr')).toBe('code')
  })

  it('returns "code" when field metadata forces a code editor language', () => {
    expect(getVarInputKind('str', { inputType: 'code', codeLanguage: 'python' })).toBe('code')
    expect(getVarInputKind('str', { inputType: 'yaml' })).toBe('code')
    expect(getVarInputKind('str', { codeLanguage: 'sql' })).toBe('code')
  })

  it('returns "file" for file-like AIMD types and metadata overrides', () => {
    expect(getVarInputKind('FileIdCSV')).toBe('file')
    expect(getVarInputKind('csv')).toBe('file')
    expect(getVarInputKind('FileIdPNG')).toBe('file')
    expect(getVarInputKind('image')).toBe('file')
    expect(getVarInputKind('str', { inputType: 'audio' })).toBe('file')
    expect(getVarInputKind('str', { kwargs: { file_extension: 'xlsx' } })).toBe('file')
    expect(getVarInputKind('str', { fieldMeta: { accept: '.pdf' } })).toBe('file')
  })
})

// ---------------------------------------------------------------------------
// File-like vars
// ---------------------------------------------------------------------------

describe('file-like var helpers', () => {
  it('resolves accept strings and display badges for built-in file aliases', () => {
    expect(getFileInputConfig('FileIdCSV')).toMatchObject({
      kind: 'csv',
      accept: '.csv,text/csv',
      badge: 'CSV',
    })
    expect(getFileInputConfig('FileIdPNG')).toMatchObject({
      kind: 'image',
      accept: '.png,image/png',
      badge: 'IMG',
    })
    expect(getFileInputConfig('FileIdMOV')).toMatchObject({
      kind: 'video',
      accept: '.mov,video/quicktime',
      badge: 'VID',
    })
    expect(getFileInputConfig('FileIdWAV')).toMatchObject({
      kind: 'audio',
      accept: '.wav,audio/wav',
      badge: 'AUD',
    })
    expect(getFileInputConfig('str', undefined, { inputType: 'image' })).toMatchObject({
      kind: 'image',
      accept: 'image/*',
      badge: 'IMG',
    })
  })

  it('honors explicit accept and file extension metadata', () => {
    expect(getFileInputConfig('str', { file_extension: 'xlsx' })).toMatchObject({
      kind: 'document',
      accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      badge: 'DOC',
    })
    expect(getFileInputConfig('FileIdCSV', undefined, { accept: '.tsv,text/tab-separated-values' })).toMatchObject({
      kind: 'csv',
      accept: '.tsv,text/tab-separated-values',
      badge: 'CSV',
    })
  })

  it('extracts display names from file ids and structured file values', () => {
    expect(getFileDisplayName('file-123')).toBe('file-123')
    expect(getFileDisplayName({ name: 'dose.csv' })).toBe('dose.csv')
    expect(getFileDisplayName({ value: { file_name: 'chart.svg' } })).toBe('chart.svg')
  })

  it('creates serializable selected-file metadata when no host upload handler is provided', () => {
    const file = new File(['a,b\n1,2'], 'dose.csv', {
      type: 'text/csv',
      lastModified: 123,
    })

    expect(createSelectedFileValue(file)).toEqual({
      format: 'airalogy_selected_file_v1',
      name: 'dose.csv',
      type: 'text/csv',
      size: 7,
      lastModified: 123,
    })
  })
})

// ---------------------------------------------------------------------------
// Numeric Pydantic-style constraints
// ---------------------------------------------------------------------------

describe('numeric field constraints', () => {
  it('reads Pydantic-style numeric constraints only for numeric var types', () => {
    expect(getNumericFieldConstraints('float', { gt: 0, le: 100, multiple_of: 0.5 })).toEqual({
      gt: 0,
      le: 100,
      multiple_of: 0.5,
    })
    expect(getNumericFieldConstraints('str', { gt: 0 })).toEqual({})
  })

  it('maps inclusive native input attributes from numeric constraints', () => {
    expect(getNumericInputAttributes('int', { ge: 0, le: 10, multiple_of: 2 })).toEqual({
      min: 0,
      max: 10,
      step: 2,
    })
    expect(getNumericInputAttributes('float', { gt: 0, lt: 1 })).toEqual({
      min: 0,
      max: 1,
      step: undefined,
    })
  })

  it('validates strict and inclusive numeric bounds without treating empty values as violations', () => {
    expect(getNumericConstraintViolation('', 'float', { gt: 0 })).toBeNull()
    expect(getNumericConstraintViolation(0, 'float', { gt: 0 })).toBe('Must be > 0')
    expect(getNumericConstraintViolation(0, 'float', { ge: 0 })).toBeNull()
    expect(getNumericConstraintViolation(10, 'float', { lt: 10 })).toBe('Must be < 10')
    expect(getNumericConstraintViolation(10, 'float', { le: 10 })).toBeNull()
  })

  it('validates numeric multiples', () => {
    expect(getNumericConstraintViolation(4, 'int', { multiple_of: 2 })).toBeNull()
    expect(getNumericConstraintViolation(5, 'int', { multiple_of: 2 })).toBe('Must be a multiple of 2')
  })
})

// ---------------------------------------------------------------------------
// unwrapStructuredValue
// ---------------------------------------------------------------------------

describe('unwrapStructuredValue', () => {
  it('unwraps { value: x }', () => {
    expect(unwrapStructuredValue({ value: 42 })).toBe(42)
  })

  it('passes through non-structured', () => {
    expect(unwrapStructuredValue('hello')).toBe('hello')
    expect(unwrapStructuredValue(42)).toBe(42)
    expect(unwrapStructuredValue(null)).toBe(null)
  })

  it('passes through arrays', () => {
    expect(unwrapStructuredValue([1, 2])).toEqual([1, 2])
  })

  it('passes through objects without value key', () => {
    expect(unwrapStructuredValue({ name: 'test' })).toEqual({ name: 'test' })
  })
})

// ---------------------------------------------------------------------------
// toBooleanValue
// ---------------------------------------------------------------------------

describe('toBooleanValue', () => {
  it('handles boolean values', () => {
    expect(toBooleanValue(true)).toBe(true)
    expect(toBooleanValue(false)).toBe(false)
  })

  it('handles numeric values', () => {
    expect(toBooleanValue(1)).toBe(true)
    expect(toBooleanValue(0)).toBe(false)
    expect(toBooleanValue(42)).toBe(true)
  })

  it('handles string truthy values', () => {
    expect(toBooleanValue('true')).toBe(true)
    expect(toBooleanValue('1')).toBe(true)
    expect(toBooleanValue('yes')).toBe(true)
    expect(toBooleanValue('on')).toBe(true)
  })

  it('handles string falsy values', () => {
    expect(toBooleanValue('false')).toBe(false)
    expect(toBooleanValue('0')).toBe(false)
    expect(toBooleanValue('no')).toBe(false)
    expect(toBooleanValue('off')).toBe(false)
    expect(toBooleanValue('')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(toBooleanValue('TRUE')).toBe(true)
    expect(toBooleanValue('False')).toBe(false)
  })

  it('unwraps structured values', () => {
    expect(toBooleanValue({ value: true })).toBe(true)
    expect(toBooleanValue({ value: 'false' })).toBe(false)
  })

  it('handles null/undefined', () => {
    expect(toBooleanValue(null)).toBe(false)
    expect(toBooleanValue(undefined)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// toDateValue
// ---------------------------------------------------------------------------

describe('toDateValue', () => {
  it('returns null for null/undefined', () => {
    expect(toDateValue(null)).toBe(null)
    expect(toDateValue(undefined)).toBe(null)
  })

  it('returns null for empty string', () => {
    expect(toDateValue('')).toBe(null)
  })

  it('parses ISO date string', () => {
    const date = toDateValue('2024-01-15')
    expect(date).toBeInstanceOf(Date)
    expect(date!.getFullYear()).toBe(2024)
  })

  it('parses timestamp number', () => {
    const timestamp = new Date('2024-06-15').getTime()
    const date = toDateValue(timestamp)
    expect(date).toBeInstanceOf(Date)
  })

  it('returns null for invalid date string', () => {
    expect(toDateValue('not-a-date')).toBe(null)
  })

  it('returns Date as-is if valid', () => {
    const d = new Date('2024-01-01')
    expect(toDateValue(d)).toBe(d)
  })

  it('returns null for invalid Date object', () => {
    expect(toDateValue(new Date('invalid'))).toBe(null)
  })

  it('unwraps structured values', () => {
    const date = toDateValue({ value: '2024-06-15' })
    expect(date).toBeInstanceOf(Date)
  })
})

// ---------------------------------------------------------------------------
// formatDateTimeWithTimezone
// ---------------------------------------------------------------------------

describe('formatDateTimeWithTimezone', () => {
  it('formats date with timezone offset', () => {
    const date = new Date('2024-06-15T10:30:00')
    const result = formatDateTimeWithTimezone(date)
    expect(result).toMatch(/^2024-06-15T10:30[+-]\d{2}:\d{2}$/)
  })
})

// ---------------------------------------------------------------------------
// normalizeDateTimeValueWithTimezone
// ---------------------------------------------------------------------------

describe('normalizeDateTimeValueWithTimezone', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeDateTimeValueWithTimezone('')).toBe('')
  })

  it('returns empty string for null', () => {
    expect(normalizeDateTimeValueWithTimezone(null)).toBe('')
  })

  it('passes through valid ISO datetime', () => {
    const iso = '2024-06-15T10:30:00+08:00'
    expect(normalizeDateTimeValueWithTimezone(iso)).toBe(iso)
  })

  it('normalizes space-separated datetime', () => {
    const result = normalizeDateTimeValueWithTimezone('2024-06-15 10:30:00+08:00')
    expect(result).toBe('2024-06-15T10:30:00+08:00')
  })
})

// ---------------------------------------------------------------------------
// formatDateForInput
// ---------------------------------------------------------------------------

describe('formatDateForInput', () => {
  it('formats date kind', () => {
    expect(formatDateForInput('2024-06-15T10:30:00', 'date')).toBe('2024-06-15')
  })

  it('formats datetime kind', () => {
    expect(formatDateForInput('2024-06-15T10:30:00', 'datetime')).toBe('2024-06-15T10:30')
  })

  it('formats time kind', () => {
    expect(formatDateForInput('14:30:00', 'time')).toBe('14:30:00')
  })

  it('returns empty string for empty value', () => {
    expect(formatDateForInput('', 'date')).toBe('')
    expect(formatDateForInput(null, 'date')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// getVarInputDisplayValue
// ---------------------------------------------------------------------------

describe('getVarInputDisplayValue', () => {
  it('returns string values as-is for text kind', () => {
    expect(getVarInputDisplayValue('hello', 'text')).toBe('hello')
  })

  it('returns number for number kind', () => {
    expect(getVarInputDisplayValue(42, 'number')).toBe(42)
  })

  it('returns string number for number kind', () => {
    expect(getVarInputDisplayValue('3.14', 'number')).toBe('3.14')
  })

  it('returns empty string for null/undefined', () => {
    expect(getVarInputDisplayValue(null, 'text')).toBe('')
    expect(getVarInputDisplayValue(undefined, 'text')).toBe('')
  })

  it('unwraps structured values', () => {
    expect(getVarInputDisplayValue({ value: 'wrapped' }, 'text')).toBe('wrapped')
  })

  it('stringifies non-string for dna kind', () => {
    expect(getVarInputDisplayValue({ seq: 'ATCG' }, 'dna')).toBe(JSON.stringify({ seq: 'ATCG' }))
  })

  it('pretty-prints structured list and object values', () => {
    expect(getVarInputDisplayValue([1, 2], 'textarea', { type: 'list[int]' })).toBe(JSON.stringify([1, 2], null, 2))
    expect(getVarInputDisplayValue({ a: 1 }, 'textarea', { type: 'dict[str, int]' })).toBe(JSON.stringify({ a: 1 }, null, 2))
  })

  it('formats scalar list values as compact JSON for helper consumers', () => {
    expect(getVarInputDisplayValue([' a ', 'b', ''], 'scalar-list', { type: 'list[str]' })).toBe(JSON.stringify(['a', 'b']))
    expect(getVarInputDisplayValue(['1', '2', ''], 'scalar-list', { type: 'list[int]' })).toBe(JSON.stringify([1, 2]))
  })

  it('formats nullable boolean values for a tri-state select', () => {
    expect(getVarInputDisplayValue(true, 'boolean-select', { type: 'bool | None' })).toBe('true')
    expect(getVarInputDisplayValue(false, 'boolean-select', { type: 'bool | None' })).toBe('false')
    expect(getVarInputDisplayValue(null, 'boolean-select', { type: 'bool | None' })).toBe('')
  })
})

// ---------------------------------------------------------------------------
// parseVarInputValue
// ---------------------------------------------------------------------------

describe('parseVarInputValue', () => {
  it('returns string for text type', () => {
    expect(parseVarInputValue('hello', 'str', 'text')).toBe('hello')
  })

  it('parses integer', () => {
    expect(parseVarInputValue('42', 'int', 'number')).toBe(42)
  })

  it('parses float', () => {
    expect(parseVarInputValue('3.14', 'float', 'number')).toBeCloseTo(3.14)
  })

  it('returns raw value for invalid number', () => {
    expect(parseVarInputValue('abc', 'int', 'number')).toBe('abc')
  })

  it('returns empty string for empty number input', () => {
    expect(parseVarInputValue('', 'int', 'number')).toBe('')
  })

  it('returns null for empty nullable number input', () => {
    expect(parseVarInputValue('', 'int | None', 'number')).toBeNull()
  })

  it('parses nullable boolean select values', () => {
    expect(parseVarInputValue('', 'bool | None', 'boolean-select')).toBeNull()
    expect(parseVarInputValue('true', 'bool | None', 'boolean-select')).toBe(true)
    expect(parseVarInputValue('false', 'bool | None', 'boolean-select')).toBe(false)
  })

  it('normalizes datetime input', () => {
    const result = parseVarInputValue('2024-06-15T10:30', undefined, 'datetime')
    expect(typeof result).toBe('string')
  })

  it('parses JSON input for structured list types', () => {
    expect(parseVarInputValue('[1, 2]', 'list[int]', 'textarea')).toEqual([1, 2])
    expect(parseVarInputValue('not json', 'list[int]', 'textarea')).toBe('not json')
  })

  it('parses scalar-list input into a clean scalar array', () => {
    expect(parseVarInputValue('["a", " b ", ""]', 'list[str]', 'scalar-list')).toEqual(['a', 'b'])
    expect(parseVarInputValue('a\nb\n', 'list[str]', 'scalar-list')).toEqual(['a', 'b'])
    expect(parseVarInputValue('["1", "2", ""]', 'list[int]', 'scalar-list')).toEqual([1, 2])
    expect(parseVarInputValue('1\n2.5\n', 'list[float]', 'scalar-list')).toEqual([1, 2.5])
    expect(parseVarInputValue('1.2', 'list[int]', 'scalar-list')).toEqual(['1.2'])
  })
})

// ---------------------------------------------------------------------------
// list type helpers
// ---------------------------------------------------------------------------

describe('list type helpers', () => {
  it('detects nullable type annotations', () => {
    expect(isNullableVarType('bool | None')).toBe(true)
    expect(isNullableVarType('Optional[bool]')).toBe(true)
    expect(isNullableVarType('bool')).toBe(false)
  })

  it('detects explicit structured types without matching unrelated names', () => {
    expect(isStructuredVarType('list[str]')).toBe(true)
    expect(isStructuredVarType('list[str] | None')).toBe(true)
    expect(isStructuredVarType('dict[str, int]')).toBe(true)
    expect(isStructuredVarType('object')).toBe(true)
    expect(isStructuredVarType('Listener')).toBe(false)
  })

  it('detects only scalar-item list types as scalar-list controls', () => {
    expect(isScalarListVarType('list[str]')).toBe(true)
    expect(isScalarListVarType('list[str] | None')).toBe(true)
    expect(isScalarListVarType('Optional[list[str]]')).toBe(true)
    expect(isScalarListVarType('typing.List[str]')).toBe(true)
    expect(isScalarListVarType('array[string]')).toBe(true)
    expect(isScalarListVarType('list[int]')).toBe(true)
    expect(isScalarListVarType('list[float]')).toBe(true)
    expect(isScalarListVarType('array[number]')).toBe(true)
    expect(isScalarListVarType('list[bool]')).toBe(false)
    expect(isScalarListVarType('list[dict[str, int]]')).toBe(false)
    expect(isScalarListVarType('list')).toBe(false)
  })

  it('resolves scalar list item types for supported scalar arrays', () => {
    expect(getScalarListItemType('list[str]')).toBe('string')
    expect(getScalarListItemType('str[]')).toBe('string')
    expect(getScalarListItemType('list[int] | None')).toBe('int')
    expect(getScalarListItemType('Optional[list[float]]')).toBe('float')
    expect(getScalarListItemType('array[number]')).toBe('float')
    expect(getScalarListItemType('list[bool]')).toBeUndefined()
    expect(getScalarListItemType('list[dict[str, int]]')).toBeUndefined()
  })

  it('normalizes scalar-list values while preserving editable draft rows', () => {
    expect(getScalarListInputItems(['a', 2, null])).toEqual(['a', '2', ''])
    expect(getScalarListInputItems('["a", "b"]')).toEqual(['a', 'b'])
    expect(getScalarListInputItems('a\nb')).toEqual(['a', 'b'])
    expect(normalizeScalarListInputItems([' a ', '', 'b'])).toEqual(['a', 'b'])
    expect(normalizeScalarListInputItems(['1', '', '2'], 'int')).toEqual([1, 2])
    expect(normalizeScalarListInputItems(['1.5', 'x'], 'float')).toEqual([1.5, 'x'])
  })
})

// ---------------------------------------------------------------------------
// calculateVarStackWidth
// ---------------------------------------------------------------------------

describe('calculateVarStackWidth', () => {
  it('returns pixel value', () => {
    const result = calculateVarStackWidth('temperature', 'text')
    expect(result).toMatch(/^\d+px$/)
  })

  it('respects minimum width for textarea', () => {
    const result = calculateVarStackWidth('x', 'textarea')
    const px = parseInt(result)
    expect(px).toBeGreaterThanOrEqual(160)
  })

  it('respects minimum width for dna', () => {
    const result = calculateVarStackWidth('x', 'dna')
    const px = parseInt(result)
    expect(px).toBeGreaterThanOrEqual(160)
  })

  it('keeps a scalar-list fallback stack width for non-DOM callers', () => {
    const result = calculateVarStackWidth('x', 'scalar-list')
    const px = parseInt(result)
    expect(px).toBeGreaterThanOrEqual(220)
    expect(px).toBeLessThan(420)
  })
})

// ---------------------------------------------------------------------------
// applyVarStackWidth
// ---------------------------------------------------------------------------

describe('applyVarStackWidth', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps scalar-list vars full width instead of measuring content width', () => {
    const wrapper = document.createElement('span')
    wrapper.className = 'aimd-rec-inline--var-stacked aimd-rec-inline--var-stacked--scalar-list'
    const control = document.createElement('span')
    control.className = 'aimd-rec-inline__scalar-list'
    wrapper.appendChild(control)
    document.body.appendChild(wrapper)

    applyVarStackWidth(control, 'scalar-list')

    expect(wrapper.style.width).toBe('100%')
    expect(wrapper.style.maxWidth).toBe('100%')
  })
})

// ---------------------------------------------------------------------------
// measureVarLabelWidth
// ---------------------------------------------------------------------------

describe('measureVarLabelWidth', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('measures visible label tokens without letting metadata popovers expand the field', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      measureText: (text: string) => ({ width: text.length * 8 }),
    } as unknown as CanvasRenderingContext2D))
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element: Element) => {
      const classList = (element as HTMLElement).classList
      const horizontalPadding = classList.contains('aimd-field__name')
        ? '16px'
        : classList.contains('aimd-field__scope--var')
          ? '14px'
          : '0px'
      return {
        fontSize: '14px',
        fontFamily: 'sans-serif',
        fontWeight: '500',
        fontStyle: 'normal',
        paddingLeft: horizontalPadding,
        paddingRight: '0px',
        borderLeftWidth: '0px',
        borderRightWidth: '0px',
        marginLeft: '0px',
        marginRight: '0px',
      } as CSSStyleDeclaration
    })

    const wrapper = document.createElement('span')
    wrapper.className = 'aimd-rec-inline--var-stacked'
    wrapper.innerHTML = `
      <span class="aimd-field__label">
        <span class="aimd-field__scope aimd-field__scope--var">var</span>
        <span class="aimd-field__name aimd-field__metadata-host">
          <span class="aimd-field__title">Sample Name</span>
          <span class="aimd-field__key">sample_name</span>
          <span class="aimd-field__metadata-popover">Human-readable label used throughout this protocol</span>
        </span>
      </span>
    `
    Object.defineProperty(wrapper.querySelector('.aimd-field__label'), 'scrollWidth', {
      configurable: true,
      get: () => 720,
    })
    Object.defineProperty(wrapper.querySelector('.aimd-field__metadata-popover'), 'scrollWidth', {
      configurable: true,
      get: () => 680,
    })
    document.body.appendChild(wrapper)

    expect(measureVarLabelWidth(wrapper)).toBeLessThan(240)
  })

  it('includes long metadata keys when sizing stacked var labels', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      measureText: (text: string) => ({ width: text.length * 8 }),
    } as unknown as CanvasRenderingContext2D))
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element: Element) => {
      const classList = (element as HTMLElement).classList
      const horizontalPadding = classList.contains('aimd-field__name')
        ? '16px'
        : classList.contains('aimd-field__scope--var')
          ? '14px'
          : '0px'
      return {
        fontSize: '14px',
        fontFamily: 'sans-serif',
        fontWeight: '500',
        fontStyle: 'normal',
        paddingLeft: horizontalPadding,
        paddingRight: '0px',
        borderLeftWidth: '0px',
        borderRightWidth: '0px',
        marginLeft: '0px',
        marginRight: '0px',
      } as CSSStyleDeclaration
    })

    const wrapper = document.createElement('span')
    wrapper.className = 'aimd-rec-inline--var-stacked'
    wrapper.innerHTML = `
      <span class="aimd-field__label">
        <span class="aimd-field__scope aimd-field__scope--var">var</span>
        <span class="aimd-field__name">
          <span class="aimd-field__title">岸带完整性评分</span>
          <span class="aimd-field__key">riparian_integrity_score</span>
        </span>
      </span>
    `
    document.body.appendChild(wrapper)

    expect(measureVarLabelWidth(wrapper)).toBeGreaterThan(220)
  })
})

// ---------------------------------------------------------------------------
// syncAutoWrapTextareaHeight
// ---------------------------------------------------------------------------

describe('syncAutoWrapTextareaHeight', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('keeps compact textareas at the single-line control height when empty', () => {
    const textarea = document.createElement('textarea')
    textarea.className = 'aimd-rec-inline__textarea--stacked-text'
    document.body.appendChild(textarea)

    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      getPropertyValue: (name: string) => (name === '--rec-var-control-height' ? '30px' : ''),
      height: '30px',
      minHeight: '0px',
      borderTopWidth: '1px',
      borderBottomWidth: '1px',
    } as CSSStyleDeclaration))

    syncAutoWrapTextareaHeight(textarea)

    expect(textarea.style.height).toBe('30px')
  })

  it('grows compact textareas as wrapped content needs more height', () => {
    const textarea = document.createElement('textarea')
    textarea.className = 'aimd-rec-inline__textarea--stacked-text'
    textarea.value = 'sample name that should wrap onto another visual line'
    document.body.appendChild(textarea)

    Object.defineProperty(textarea, 'scrollHeight', {
      configurable: true,
      get: () => 64,
    })

    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      getPropertyValue: (name: string) => (name === '--rec-var-control-height' ? '30px' : ''),
      height: '30px',
      minHeight: '0px',
      borderTopWidth: '1px',
      borderBottomWidth: '1px',
    } as CSSStyleDeclaration))

    syncAutoWrapTextareaHeight(textarea)

    expect(textarea.style.height).toBe('66px')
  })
})
