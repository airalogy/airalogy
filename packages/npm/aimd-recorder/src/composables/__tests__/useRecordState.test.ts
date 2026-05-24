import { describe, expect, it } from 'vitest'

import {
  cloneRecordData,
  normalizeCheckLike,
  getRecordDataSignature,
  normalizeStepLike,
  normalizeIncomingRecord,
  replaceSection,
  applyNormalizedRecord,
  applyIncomingRecord,
  normalizeStepFields,
  normalizeCheckFields,
  normalizeQuizFields,
  normalizeVarTableFields,
  getQuizDefaultValue,
  ensureDefaultsFromFields,
  createEmptyVarTableRow,
  normalizeVarTableRows,
  parsePastedVarTableText,
  applyPastedVarTableGrid,
} from '../useRecordState'
import { createEmptyProtocolRecordData } from '../../types'
import { createEmptyCheckRecordItem, createEmptyStepRecordItem } from '../useStepTimers'

// ---------------------------------------------------------------------------
// cloneRecordData
// ---------------------------------------------------------------------------

describe('cloneRecordData', () => {
  it('produces a deep copy', () => {
    const original = createEmptyProtocolRecordData()
    original.var.temperature = 36.5
    original.step.step1 = { ...createEmptyStepRecordItem(), checked: true, annotation: 'done' }
    const cloned = cloneRecordData(original)

    expect(cloned).toEqual(original)
    expect(cloned).not.toBe(original)
    expect(cloned.var).not.toBe(original.var)
    expect(cloned.step).not.toBe(original.step)
  })

  it('deep-clones nested objects', () => {
    const original = createEmptyProtocolRecordData()
    original.var.data = { nested: [1, 2, 3] }
    const cloned = cloneRecordData(original)

    ;(cloned.var.data as any).nested.push(4)
    expect((original.var.data as any).nested).toEqual([1, 2, 3])
  })
})

describe('getRecordDataSignature', () => {
  it('returns the same signature for semantically equal records with different key order', () => {
    const left = {
      var: {
        summary: { blocks: [{ text: 'A', id: 2 }, { id: 1, text: 'B' }] },
        temperature: 25,
      },
      step: {
        s1: { annotation: 'done', checked: true },
      },
    } as unknown as Partial<ReturnType<typeof createEmptyProtocolRecordData>>

    const right = {
      step: {
        s1: { checked: true, annotation: 'done' },
      },
      var: {
        temperature: 25,
        summary: { blocks: [{ id: 2, text: 'A' }, { text: 'B', id: 1 }] },
      },
    } as unknown as Partial<ReturnType<typeof createEmptyProtocolRecordData>>

    expect(getRecordDataSignature(left)).toBe(getRecordDataSignature(right))
  })

  it('returns a different signature when record content changes', () => {
    const left = { var: { summary: 'alpha' } }
    const right = { var: { summary: 'beta' } }

    expect(getRecordDataSignature(left)).not.toBe(getRecordDataSignature(right))
  })
})

// ---------------------------------------------------------------------------
// normalizeStepLike
// ---------------------------------------------------------------------------

describe('normalizeStepLike', () => {
  it('returns default for null', () => {
    expect(normalizeStepLike(null)).toEqual(createEmptyStepRecordItem())
  })

  it('returns default for undefined', () => {
    expect(normalizeStepLike(undefined)).toEqual(createEmptyStepRecordItem())
  })

  it('returns default for arrays', () => {
    expect(normalizeStepLike([1, 2])).toEqual(createEmptyStepRecordItem())
  })

  it('returns default for primitives', () => {
    expect(normalizeStepLike('hello')).toEqual(createEmptyStepRecordItem())
    expect(normalizeStepLike(42)).toEqual(createEmptyStepRecordItem())
  })

  it('normalizes valid object', () => {
    expect(normalizeStepLike({ checked: true, annotation: 'note' }))
      .toEqual({ ...createEmptyStepRecordItem(), checked: true, annotation: 'note' })
  })

  it('coerces checked to boolean', () => {
    expect(normalizeStepLike({ checked: 1, annotation: '' }))
      .toEqual({ ...createEmptyStepRecordItem(), checked: true, annotation: '' })
    expect(normalizeStepLike({ checked: 0, annotation: '' }))
      .toEqual(createEmptyStepRecordItem())
  })

  it('replaces non-string annotation with empty string', () => {
    expect(normalizeStepLike({ checked: false, annotation: 123 }))
      .toEqual(createEmptyStepRecordItem())
  })

  it('normalizes timer fields when present', () => {
    expect(normalizeStepLike({
      checked: true,
      annotation: 'timed',
      elapsed_ms: '2500',
      timer_started_at_ms: 5000,
      started_at_ms: 4000,
      ended_at_ms: null,
    })).toEqual({
      checked: true,
      annotation: 'timed',
      elapsed_ms: 2500,
      timer_started_at_ms: 5000,
      started_at_ms: 4000,
      ended_at_ms: null,
    })
  })
})

describe('normalizeCheckLike', () => {
  it('normalizes check items without timer fields', () => {
    expect(normalizeCheckLike({ checked: 1, annotation: 'ok', elapsed_ms: 500 }))
      .toEqual({ checked: true, annotation: 'ok' })
  })

  it('falls back to the empty check record shape', () => {
    expect(normalizeCheckLike(null)).toEqual(createEmptyCheckRecordItem())
  })
})

// ---------------------------------------------------------------------------
// normalizeIncomingRecord
// ---------------------------------------------------------------------------

describe('normalizeIncomingRecord', () => {
  it('returns empty record for undefined', () => {
    const result = normalizeIncomingRecord(undefined)
    expect(result).toEqual(createEmptyProtocolRecordData())
  })

  it('returns empty record for null', () => {
    const result = normalizeIncomingRecord(null as any)
    expect(result).toEqual(createEmptyProtocolRecordData())
  })

  it('preserves valid var data', () => {
    const result = normalizeIncomingRecord({ var: { x: 42 } })
    expect(result.var.x).toBe(42)
  })

  it('normalizes step items', () => {
    const result = normalizeIncomingRecord({
      step: { s1: { checked: true, annotation: 'ok' } as any },
    })
    expect(result.step.s1).toEqual({ ...createEmptyStepRecordItem(), checked: true, annotation: 'ok' })
  })

  it('normalizes check items', () => {
    const result = normalizeIncomingRecord({
      check: { c1: { checked: false, annotation: '' } as any },
    })
    expect(result.check.c1).toEqual(createEmptyCheckRecordItem())
  })

  it('preserves quiz data', () => {
    const result = normalizeIncomingRecord({ quiz: { q1: 'answer' } })
    expect(result.quiz.q1).toBe('answer')
  })

  it('ignores non-object var', () => {
    const result = normalizeIncomingRecord({ var: 'bad' as any })
    expect(result.var).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// replaceSection
// ---------------------------------------------------------------------------

describe('replaceSection', () => {
  it('replaces all keys in target with source keys', () => {
    const target: Record<string, unknown> = { a: 1, b: 2 }
    replaceSection(target, { c: 3 })
    expect(target).toEqual({ c: 3 })
  })

  it('removes keys not in source', () => {
    const target: Record<string, unknown> = { a: 1 }
    replaceSection(target, {})
    expect(Object.keys(target)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// applyNormalizedRecord / applyIncomingRecord
// ---------------------------------------------------------------------------

describe('applyNormalizedRecord', () => {
  it('replaces all sections', () => {
    const local = createEmptyProtocolRecordData()
    local.var.old = 'value'

    const normalized = createEmptyProtocolRecordData()
    normalized.var.new_var = 'new'
    normalized.step.s1 = { ...createEmptyStepRecordItem(), checked: true }

    applyNormalizedRecord(local, normalized)
    expect(local.var).toEqual({ new_var: 'new' })
    expect(local.step).toEqual({ s1: { ...createEmptyStepRecordItem(), checked: true } })
  })
})

describe('applyIncomingRecord', () => {
  it('normalizes and applies', () => {
    const local = createEmptyProtocolRecordData()
    applyIncomingRecord(local, { var: { temp: 36 } })
    expect(local.var.temp).toBe(36)
  })
})

// ---------------------------------------------------------------------------
// normalizeStepFields
// ---------------------------------------------------------------------------

describe('normalizeStepFields', () => {
  it('returns empty array for non-array input', () => {
    expect(normalizeStepFields(null)).toEqual([])
    expect(normalizeStepFields('string')).toEqual([])
    expect(normalizeStepFields(42)).toEqual([])
  })

  it('converts strings to objects', () => {
    expect(normalizeStepFields(['step1', 'step2'])).toEqual([
      { name: 'step1' },
      { name: 'step2' },
    ])
  })

  it('trims string names', () => {
    expect(normalizeStepFields(['  spaced  '])).toEqual([{ name: 'spaced' }])
  })

  it('accepts objects with name property', () => {
    expect(normalizeStepFields([{ name: 'obj_step' }])).toEqual([
      { name: 'obj_step' },
    ])
  })

  it('filters out empty strings', () => {
    expect(normalizeStepFields(['', '  ', 'valid'])).toEqual([{ name: 'valid' }])
  })

  it('filters out invalid items', () => {
    expect(normalizeStepFields([null, undefined, 42, 'valid'])).toEqual([
      { name: 'valid' },
    ])
  })
})

// ---------------------------------------------------------------------------
// normalizeCheckFields
// ---------------------------------------------------------------------------

describe('normalizeCheckFields', () => {
  it('returns empty array for non-array', () => {
    expect(normalizeCheckFields(undefined)).toEqual([])
  })

  it('converts strings to name+label', () => {
    expect(normalizeCheckFields(['check1'])).toEqual([
      { name: 'check1', label: 'check1' },
    ])
  })

  it('accepts objects with name and optional label', () => {
    expect(normalizeCheckFields([{ name: 'c1', label: 'Check 1' }])).toEqual([
      { name: 'c1', label: 'Check 1' },
    ])
  })

  it('omits label when not a string', () => {
    expect(normalizeCheckFields([{ name: 'c1', label: 123 }])).toEqual([
      { name: 'c1', label: undefined },
    ])
  })
})

// ---------------------------------------------------------------------------
// normalizeQuizFields
// ---------------------------------------------------------------------------

describe('normalizeQuizFields', () => {
  it('returns empty for non-array', () => {
    expect(normalizeQuizFields(null)).toEqual([])
  })

  it('filters valid quiz fields', () => {
    const valid = { id: 'q1', type: 'choice', stem: 'What?' }
    const invalid = { id: 'q2' }
    expect(normalizeQuizFields([valid, invalid, null])).toEqual([valid])
  })
})

// ---------------------------------------------------------------------------
// normalizeVarTableFields
// ---------------------------------------------------------------------------

describe('normalizeVarTableFields', () => {
  it('returns empty for non-array', () => {
    expect(normalizeVarTableFields({})).toEqual([])
  })

  it('filters valid var_table fields', () => {
    const valid = { id: 'vt1', subvars: [{ id: 'col1' }] }
    const invalid = { id: 'vt2' }
    expect(normalizeVarTableFields([valid, invalid])).toEqual([valid])
  })
})

// ---------------------------------------------------------------------------
// getQuizDefaultValue
// ---------------------------------------------------------------------------

describe('getQuizDefaultValue', () => {
  it('returns empty string for choice quiz without default', () => {
    const quiz = { id: 'q1', type: 'choice', stem: 'Q?', options: [{ key: 'a', label: 'A' }] }
    expect(getQuizDefaultValue(quiz as any)).toBe('')
  })

  it('returns valid choice default', () => {
    const quiz = {
      id: 'q1', type: 'choice', stem: 'Q?',
      options: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
      default: 'a',
    }
    expect(getQuizDefaultValue(quiz as any)).toBe('a')
  })

  it('rejects invalid choice default', () => {
    const quiz = {
      id: 'q1', type: 'choice', stem: 'Q?',
      options: [{ key: 'a', label: 'A' }],
      default: 'invalid',
    }
    expect(getQuizDefaultValue(quiz as any)).toBe('')
  })

  it('handles multiple choice mode', () => {
    const quiz = {
      id: 'q1', type: 'choice', stem: 'Q?', mode: 'multiple',
      options: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
      default: ['a', 'b'],
    }
    expect(getQuizDefaultValue(quiz as any)).toEqual(['a', 'b'])
  })

  it('filters invalid items in multiple choice default', () => {
    const quiz = {
      id: 'q1', type: 'choice', stem: 'Q?', mode: 'multiple',
      options: [{ key: 'a', label: 'A' }],
      default: ['a', 'invalid', 123],
    }
    expect(getQuizDefaultValue(quiz as any)).toEqual(['a'])
  })

  it('returns empty array for multiple choice without default', () => {
    const quiz = {
      id: 'q1', type: 'choice', stem: 'Q?', mode: 'multiple',
      options: [{ key: 'a', label: 'A' }],
    }
    expect(getQuizDefaultValue(quiz as any)).toEqual([])
  })

  it('returns structured defaults for choice quiz with followups', () => {
    const quiz = {
      id: 'q1', type: 'choice', stem: 'Q?',
      options: [
        {
          key: 'yes',
          text: 'Yes',
          followups: [
            { key: 'years', type: 'int', required: true, default: 5 },
            { key: 'unit', type: 'str', required: false },
          ],
        },
        { key: 'no', text: 'No' },
      ],
      default: 'yes',
    }
    expect(getQuizDefaultValue(quiz as any)).toEqual({
      selected: 'yes',
      followups: {
        yes: {
          years: 5,
        },
      },
    })
  })

  it('returns nullable boolean default for true/false quiz', () => {
    expect(getQuizDefaultValue({
      id: 'q1',
      type: 'true_false',
      stem: 'Q?',
    } as any)).toBeNull()

    expect(getQuizDefaultValue({
      id: 'q2',
      type: 'true_false',
      stem: 'Q?',
      default: false,
    } as any)).toBe(false)
  })

  it('returns structured defaults for true/false quiz with followups', () => {
    const quiz = {
      id: 'q1',
      type: 'true_false',
      stem: 'Q?',
      options: [
        {
          key: 'true',
          text: 'Yes',
          followups: [
            { key: 'color', type: 'str', required: true, default: 'white' },
          ],
        },
        { key: 'false', text: 'No' },
      ],
      default: true,
    }

    expect(getQuizDefaultValue(quiz as any)).toEqual({
      selected: true,
      followups: {
        true: {
          color: 'white',
        },
      },
    })
  })

  it('returns blank map for blank quiz', () => {
    const quiz = {
      id: 'q1', type: 'blank', stem: 'Fill ____',
      blanks: [{ key: 'b1' }, { key: 'b2' }],
    }
    expect(getQuizDefaultValue(quiz as any)).toEqual({ b1: '', b2: '' })
  })

  it('uses object default for blank quiz', () => {
    const quiz = {
      id: 'q1', type: 'blank', stem: 'Fill ____',
      blanks: [{ key: 'b1' }],
      default: { b1: 'answer' },
    }
    expect(getQuizDefaultValue(quiz as any)).toEqual({ b1: 'answer' })
  })

  it('uses string default for single-blank quiz', () => {
    const quiz = {
      id: 'q1', type: 'blank', stem: 'Fill ____',
      blanks: [{ key: 'b1' }],
      default: 'answer',
    }
    expect(getQuizDefaultValue(quiz as any)).toEqual({ b1: 'answer' })
  })

  it('returns string default for open quiz', () => {
    const quiz = { id: 'q1', type: 'open', stem: 'Describe', default: 'my answer' }
    expect(getQuizDefaultValue(quiz as any)).toBe('my answer')
  })

  it('returns empty string for open quiz without default', () => {
    const quiz = { id: 'q1', type: 'open', stem: 'Describe' }
    expect(getQuizDefaultValue(quiz as any)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// createEmptyVarTableRow / normalizeVarTableRows
// ---------------------------------------------------------------------------

describe('createEmptyVarTableRow', () => {
  it('creates row with empty string values', () => {
    expect(createEmptyVarTableRow(['a', 'b'])).toEqual({ a: '', b: '' })
  })
})

describe('normalizeVarTableRows', () => {
  it('returns one empty row for non-array input', () => {
    const rows = normalizeVarTableRows(null, ['x', 'y'])
    expect(rows).toEqual([{ x: '', y: '' }])
  })

  it('returns one empty row for empty array', () => {
    const rows = normalizeVarTableRows([], ['x'])
    expect(rows).toEqual([{ x: '' }])
  })

  it('normalizes existing rows to columns', () => {
    const rows = normalizeVarTableRows([{ x: 'val', extra: 'ignored' }], ['x', 'y'])
    expect(rows).toEqual([{ x: 'val', y: '' }])
  })

  it('converts non-string values to strings', () => {
    const rows = normalizeVarTableRows([{ x: 42 }], ['x'])
    expect(rows).toEqual([{ x: '42' }])
  })

  it('handles null/undefined values', () => {
    const rows = normalizeVarTableRows([{ x: null }], ['x'])
    expect(rows).toEqual([{ x: '' }])
  })

  it('replaces invalid row items with empty rows', () => {
    const rows = normalizeVarTableRows([null, 'bad', { x: 'ok' }], ['x'])
    expect(rows).toEqual([{ x: '' }, { x: '' }, { x: 'ok' }])
  })
})

describe('parsePastedVarTableText', () => {
  it('parses spreadsheet-style tabular text', () => {
    expect(parsePastedVarTableText('A\tB\r\n1\t2\r\n')).toEqual([
      ['A', 'B'],
      ['1', '2'],
    ])
  })

  it('keeps single-column multiline text as one column per row', () => {
    expect(parsePastedVarTableText('alpha\nbeta')).toEqual([
      ['alpha'],
      ['beta'],
    ])
  })
})

describe('applyPastedVarTableGrid', () => {
  it('applies pasted cells from the current cell and appends rows as needed', () => {
    const rows = [{ sample: 'S1', value: '' }]
    const result = applyPastedVarTableGrid(
      rows,
      ['sample', 'value'],
      0,
      1,
      [['10'], ['20']],
    )

    expect(rows).toEqual([
      { sample: 'S1', value: '10' },
      { sample: '', value: '20' },
    ])
    expect(result).toEqual({
      rowsAdded: 1,
      changedCells: [
        { rowIndex: 0, column: 'value', value: '10' },
        { rowIndex: 1, column: 'value', value: '20' },
      ],
    })
  })

  it('skips disabled columns and ignores cells outside the table width', () => {
    const rows = [{ a: '', b: '', c: '' }]
    const result = applyPastedVarTableGrid(
      rows,
      ['a', 'b', 'c'],
      0,
      0,
      [['x', 'y', 'z', 'overflow']],
      { disabledColumns: ['b'] },
    )

    expect(rows).toEqual([{ a: 'x', b: '', c: 'z' }])
    expect(result).toEqual({
      rowsAdded: 0,
      changedCells: [
        { rowIndex: 0, column: 'a', value: 'x' },
        { rowIndex: 0, column: 'c', value: 'z' },
      ],
    })
  })
})

// ---------------------------------------------------------------------------
// ensureDefaultsFromFields
// ---------------------------------------------------------------------------

describe('ensureDefaultsFromFields', () => {
  it('adds missing step defaults', () => {
    const record = createEmptyProtocolRecordData()
    const fields = { step: [{ name: 's1' }], check: [], quiz: [], var: [], var_table: [], subvar: [], assigner: [], ref: [], fig: [], cite: [] }
    const changed = ensureDefaultsFromFields(record, fields as any)
    expect(changed).toBe(true)
    expect(record.step.s1).toEqual(createEmptyStepRecordItem())
  })

  it('does not overwrite existing step', () => {
    const record = createEmptyProtocolRecordData()
    record.step.s1 = { ...createEmptyStepRecordItem(), checked: true, annotation: 'existing', elapsed_ms: 1500 }
    const fields = { step: [{ name: 's1' }], check: [], quiz: [], var: [], var_table: [], subvar: [], assigner: [], ref: [], fig: [], cite: [] }
    const changed = ensureDefaultsFromFields(record, fields as any)
    expect(changed).toBe(false)
    expect(record.step.s1.annotation).toBe('existing')
    expect(record.step.s1.elapsed_ms).toBe(1500)
  })

  it('adds missing check defaults', () => {
    const record = createEmptyProtocolRecordData()
    const fields = { step: [], check: [{ name: 'c1' }], quiz: [], var: [], var_table: [], subvar: [], assigner: [], ref: [], fig: [], cite: [] }
    const changed = ensureDefaultsFromFields(record, fields as any)
    expect(changed).toBe(true)
    expect(record.check.c1).toEqual(createEmptyCheckRecordItem())
  })

  it('adds missing quiz defaults', () => {
    const record = createEmptyProtocolRecordData()
    const fields = {
      step: [], check: [], var: [], var_table: [], subvar: [], assigner: [], ref: [], fig: [], cite: [],
      quiz: [{ id: 'q1', type: 'open', stem: 'Q?' }],
    }
    const changed = ensureDefaultsFromFields(record, fields as any)
    expect(changed).toBe(true)
    expect(record.quiz.q1).toBe('')
  })

  it('returns false when nothing changes', () => {
    const record = createEmptyProtocolRecordData()
    const fields = { step: [], check: [], quiz: [], var: [], var_table: [], subvar: [], assigner: [], ref: [], fig: [], cite: [] }
    expect(ensureDefaultsFromFields(record, fields as any)).toBe(false)
  })
})
