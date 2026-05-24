import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  normalizeVarTypeName,
  getVarInputKind,
  unwrapStructuredValue,
  toBooleanValue,
  toDateValue,
  formatDateTimeWithTimezone,
  normalizeDateTimeValueWithTimezone,
  formatDateForInput,
  getVarInputDisplayValue,
  parseVarInputValue,
  getNumericConstraintViolation,
  getNumericFieldConstraints,
  getNumericInputAttributes,
  calculateVarStackWidth,
  syncAutoWrapTextareaHeight,
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

  it('normalizes datetime input', () => {
    const result = parseVarInputValue('2024-06-15T10:30', undefined, 'datetime')
    expect(typeof result).toBe('string')
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
