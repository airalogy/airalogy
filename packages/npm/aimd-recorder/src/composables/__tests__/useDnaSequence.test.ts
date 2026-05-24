import { describe, expect, it } from 'vitest'

import {
  AIMD_DNA_SEQUENCE_FORMAT,
  normalizeDnaSequenceText,
  collectInvalidDnaSequenceCharacters,
  createEmptyDnaSequenceAnnotation,
  createEmptyDnaSequenceQualifier,
  createEmptyDnaSequenceSegment,
  getNextDnaSequenceAnnotationId,
  normalizeDnaSequenceAnnotation,
  normalizeDnaSequenceQualifier,
  normalizeDnaSequenceSegment,
  normalizeDnaSequenceValue,
  calculateDnaSequenceGcPercent,
  getDnaSequenceSegmentIssue,
  serializeDnaSequenceToGenBank,
} from '../useDnaSequence'

// ---------------------------------------------------------------------------
// normalizeDnaSequenceText
// ---------------------------------------------------------------------------

describe('normalizeDnaSequenceText', () => {
  it('uppercases the sequence', () => {
    expect(normalizeDnaSequenceText('atcg')).toBe('ATCG')
  })

  it('removes whitespace', () => {
    expect(normalizeDnaSequenceText('AT CG\nTT')).toBe('ATCGTT')
  })

  it('returns empty string for non-string', () => {
    expect(normalizeDnaSequenceText(null)).toBe('')
    expect(normalizeDnaSequenceText(42)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// collectInvalidDnaSequenceCharacters
// ---------------------------------------------------------------------------

describe('collectInvalidDnaSequenceCharacters', () => {
  it('returns empty for valid DNA', () => {
    expect(collectInvalidDnaSequenceCharacters('ATCG')).toEqual([])
  })

  it('detects invalid characters', () => {
    const invalid = collectInvalidDnaSequenceCharacters('ATXCGZ')
    expect(invalid).toContain('X')
    expect(invalid).toContain('Z')
  })

  it('accepts IUPAC ambiguity codes', () => {
    expect(collectInvalidDnaSequenceCharacters('RYSWKMBDHVN')).toEqual([])
  })

  it('is case-insensitive', () => {
    expect(collectInvalidDnaSequenceCharacters('atcg')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// createEmpty* helpers
// ---------------------------------------------------------------------------

describe('createEmptyDnaSequenceSegment', () => {
  it('creates default segment', () => {
    const segment = createEmptyDnaSequenceSegment()
    expect(segment).toEqual({
      start: 1,
      end: 1,
      partial_start: false,
      partial_end: false,
    })
  })
})

describe('createEmptyDnaSequenceQualifier', () => {
  it('creates qualifier with default key', () => {
    expect(createEmptyDnaSequenceQualifier()).toEqual({ key: 'note', value: '' })
  })

  it('creates qualifier with custom key', () => {
    expect(createEmptyDnaSequenceQualifier('label')).toEqual({ key: 'label', value: '' })
  })
})

describe('createEmptyDnaSequenceAnnotation', () => {
  it('creates default annotation', () => {
    const ann = createEmptyDnaSequenceAnnotation()
    expect(ann.id).toBe('ann_1')
    expect(ann.name).toBe('Feature')
    expect(ann.type).toBe('misc_feature')
    expect(ann.strand).toBe(1)
    expect(ann.segments).toHaveLength(1)
    expect(ann.qualifiers).toEqual([])
  })

  it('accepts custom id', () => {
    expect(createEmptyDnaSequenceAnnotation('custom_id').id).toBe('custom_id')
  })
})

// ---------------------------------------------------------------------------
// getNextDnaSequenceAnnotationId
// ---------------------------------------------------------------------------

describe('getNextDnaSequenceAnnotationId', () => {
  it('returns ann_1 for empty list', () => {
    expect(getNextDnaSequenceAnnotationId([])).toBe('ann_1')
  })

  it('skips used IDs', () => {
    const annotations = [
      createEmptyDnaSequenceAnnotation('ann_1'),
      createEmptyDnaSequenceAnnotation('ann_2'),
    ]
    expect(getNextDnaSequenceAnnotationId(annotations)).toBe('ann_3')
  })

  it('fills gaps', () => {
    const annotations = [
      createEmptyDnaSequenceAnnotation('ann_1'),
      createEmptyDnaSequenceAnnotation('ann_3'),
    ]
    expect(getNextDnaSequenceAnnotationId(annotations)).toBe('ann_2')
  })
})

// ---------------------------------------------------------------------------
// normalizeDnaSequenceSegment
// ---------------------------------------------------------------------------

describe('normalizeDnaSequenceSegment', () => {
  it('returns default for null', () => {
    expect(normalizeDnaSequenceSegment(null)).toEqual(createEmptyDnaSequenceSegment())
  })

  it('normalizes valid segment', () => {
    expect(normalizeDnaSequenceSegment({ start: 10, end: 50 })).toEqual({
      start: 10,
      end: 50,
      partial_start: false,
      partial_end: false,
    })
  })

  it('handles partial flags', () => {
    const segment = normalizeDnaSequenceSegment({
      start: 1, end: 100, partial_start: true, partial_end: 'true',
    })
    expect(segment.partial_start).toBe(true)
    expect(segment.partial_end).toBe(true)
  })

  it('parses string numbers', () => {
    const segment = normalizeDnaSequenceSegment({ start: '5', end: '20' })
    expect(segment.start).toBe(5)
    expect(segment.end).toBe(20)
  })

  it('uses fallback for invalid numbers', () => {
    const segment = normalizeDnaSequenceSegment({ start: 'abc', end: -5 })
    expect(segment.start).toBe(1)
    expect(segment.end).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// normalizeDnaSequenceQualifier
// ---------------------------------------------------------------------------

describe('normalizeDnaSequenceQualifier', () => {
  it('returns default for null', () => {
    expect(normalizeDnaSequenceQualifier(null)).toEqual({ key: 'note', value: '' })
  })

  it('normalizes valid qualifier', () => {
    expect(normalizeDnaSequenceQualifier({ key: 'label', value: 'promoter' }))
      .toEqual({ key: 'label', value: 'promoter' })
  })

  it('uses fallback key for empty key', () => {
    expect(normalizeDnaSequenceQualifier({ key: '', value: 'test' }).key).toBe('note')
  })

  it('converts non-string value to string', () => {
    expect(normalizeDnaSequenceQualifier({ key: 'note', value: 42 }).value).toBe('42')
  })

  it('uses different default key for non-first qualifier', () => {
    expect(normalizeDnaSequenceQualifier(null, 1).key).toBe('qualifier')
  })
})

// ---------------------------------------------------------------------------
// normalizeDnaSequenceAnnotation
// ---------------------------------------------------------------------------

describe('normalizeDnaSequenceAnnotation', () => {
  it('returns default for null', () => {
    const ann = normalizeDnaSequenceAnnotation(null)
    expect(ann.id).toBe('ann_1')
    expect(ann.name).toBe('Feature')
  })

  it('normalizes valid annotation', () => {
    const ann = normalizeDnaSequenceAnnotation({
      id: 'my_ann',
      name: 'Promoter',
      type: 'promoter',
      strand: -1,
      color: '#ff0000',
      segments: [{ start: 10, end: 50 }],
    })
    expect(ann.id).toBe('my_ann')
    expect(ann.name).toBe('Promoter')
    expect(ann.type).toBe('promoter')
    expect(ann.strand).toBe(-1)
    expect(ann.segments).toHaveLength(1)
    expect(ann.segments[0].start).toBe(10)
  })

  it('uses index-based default id', () => {
    const ann = normalizeDnaSequenceAnnotation(null, 3)
    expect(ann.id).toBe('ann_4')
  })

  it('handles legacy start/end format', () => {
    const ann = normalizeDnaSequenceAnnotation({
      id: 'a1', name: 'F', type: 'misc', strand: 1,
      start: 5, end: 20,
    })
    expect(ann.segments).toHaveLength(1)
    expect(ann.segments[0].start).toBe(5)
    expect(ann.segments[0].end).toBe(20)
  })

  it('handles qualifiers with legacy note', () => {
    const ann = normalizeDnaSequenceAnnotation({
      id: 'a1', name: 'F', type: 'misc', strand: 1,
      note: 'test note',
    })
    expect(ann.qualifiers).toContainEqual({ key: 'note', value: 'test note' })
  })
})

// ---------------------------------------------------------------------------
// normalizeDnaSequenceValue
// ---------------------------------------------------------------------------

describe('normalizeDnaSequenceValue', () => {
  it('normalizes string to sequence-only value', () => {
    const val = normalizeDnaSequenceValue('atcg')
    expect(val.format).toBe(AIMD_DNA_SEQUENCE_FORMAT)
    expect(val.sequence).toBe('ATCG')
    expect(val.name).toBe('')
    expect(val.topology).toBe('linear')
    expect(val.annotations).toEqual([])
  })

  it('normalizes null to empty value', () => {
    const val = normalizeDnaSequenceValue(null)
    expect(val.sequence).toBe('')
  })

  it('normalizes object with circular topology', () => {
    const val = normalizeDnaSequenceValue({
      name: 'pUC19',
      sequence: 'ATCGATCG',
      topology: 'circular',
      annotations: [],
    })
    expect(val.name).toBe('pUC19')
    expect(val.topology).toBe('circular')
    expect(val.sequence).toBe('ATCGATCG')
  })

  it('defaults topology to linear', () => {
    const val = normalizeDnaSequenceValue({ sequence: 'A' })
    expect(val.topology).toBe('linear')
  })

  it('normalizes annotations', () => {
    const val = normalizeDnaSequenceValue({
      sequence: 'ATCGATCG',
      annotations: [{ id: 'a1', name: 'F', type: 'CDS', strand: 1, segments: [{ start: 1, end: 8 }] }],
    })
    expect(val.annotations).toHaveLength(1)
    expect(val.annotations[0].type).toBe('CDS')
  })
})

// ---------------------------------------------------------------------------
// calculateDnaSequenceGcPercent
// ---------------------------------------------------------------------------

describe('calculateDnaSequenceGcPercent', () => {
  it('returns null for empty sequence', () => {
    expect(calculateDnaSequenceGcPercent('')).toBe(null)
  })

  it('returns null for non-canonical bases only', () => {
    expect(calculateDnaSequenceGcPercent('RRRR')).toBe(null)
  })

  it('calculates correct GC%', () => {
    expect(calculateDnaSequenceGcPercent('GCGC')).toBe(100)
    expect(calculateDnaSequenceGcPercent('ATAT')).toBe(0)
    expect(calculateDnaSequenceGcPercent('ATCG')).toBe(50)
  })

  it('handles mixed case', () => {
    expect(calculateDnaSequenceGcPercent('atcg')).toBe(50)
  })

  it('ignores ambiguity codes', () => {
    expect(calculateDnaSequenceGcPercent('GCGCRR')).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// getDnaSequenceSegmentIssue
// ---------------------------------------------------------------------------

describe('getDnaSequenceSegmentIssue', () => {
  it('returns null for valid segment', () => {
    expect(getDnaSequenceSegmentIssue({ start: 1, end: 100 }, 200)).toBe(null)
  })

  it('detects reversed range', () => {
    expect(getDnaSequenceSegmentIssue({ start: 50, end: 10 }, 100)).toBe('range')
  })

  it('detects requires_sequence', () => {
    expect(getDnaSequenceSegmentIssue({ start: 1, end: 10 }, 0)).toBe('requires_sequence')
  })

  it('detects out_of_bounds', () => {
    expect(getDnaSequenceSegmentIssue({ start: 1, end: 200 }, 100)).toBe('out_of_bounds')
  })
})

// ---------------------------------------------------------------------------
// serializeDnaSequenceToGenBank
// ---------------------------------------------------------------------------

describe('serializeDnaSequenceToGenBank', () => {
  const fixedDate = new Date('2024-06-15')

  it('generates valid GenBank format', () => {
    const value = normalizeDnaSequenceValue({
      name: 'Test Plasmid',
      sequence: 'ATCGATCGATCG',
      topology: 'linear',
      annotations: [],
    })

    const result = serializeDnaSequenceToGenBank(value, { date: fixedDate })
    expect(result).toContain('LOCUS')
    expect(result).toContain('Test_Plasmid')
    expect(result).toMatch(/\s+12\s*bp/)
    expect(result).toContain('linear')
    expect(result).toContain('ORIGIN')
    expect(result).toContain('atcgatcgat cg')
    expect(result).toContain('//')
  })

  it('formats circular topology', () => {
    const value = normalizeDnaSequenceValue({
      name: 'pUC19',
      sequence: 'ATCG',
      topology: 'circular',
    })

    const result = serializeDnaSequenceToGenBank(value, { date: fixedDate })
    expect(result).toContain('circular')
  })

  it('includes annotations with features', () => {
    const value = normalizeDnaSequenceValue({
      name: 'Test',
      sequence: 'ATCGATCGATCG',
      annotations: [{
        id: 'a1', name: 'Promoter', type: 'promoter', strand: 1,
        segments: [{ start: 1, end: 6 }],
        qualifiers: [{ key: 'note', value: 'test promoter' }],
      }],
    })

    const result = serializeDnaSequenceToGenBank(value, { date: fixedDate })
    expect(result).toContain('FEATURES')
    expect(result).toContain('promoter')
    expect(result).toContain('1..6')
    expect(result).toContain('/label="Promoter"')
    expect(result).toContain('/note="test promoter"')
  })

  it('formats complement strand', () => {
    const value = normalizeDnaSequenceValue({
      name: 'Test',
      sequence: 'ATCGATCGATCG',
      annotations: [{
        id: 'a1', name: 'Rev', type: 'CDS', strand: -1,
        segments: [{ start: 1, end: 6 }],
      }],
    })

    const result = serializeDnaSequenceToGenBank(value, { date: fixedDate })
    expect(result).toContain('complement(1..6)')
  })

  it('formats join for multi-segment annotations', () => {
    const value = normalizeDnaSequenceValue({
      name: 'Test',
      sequence: 'ATCGATCGATCGATCG',
      annotations: [{
        id: 'a1', name: 'Split', type: 'CDS', strand: 1,
        segments: [{ start: 1, end: 4 }, { start: 8, end: 12 }],
      }],
    })

    const result = serializeDnaSequenceToGenBank(value, { date: fixedDate })
    expect(result).toContain('join(1..4,8..12)')
  })

  it('formats partial locations', () => {
    const value = normalizeDnaSequenceValue({
      name: 'Test',
      sequence: 'ATCGATCG',
      annotations: [{
        id: 'a1', name: 'Partial', type: 'CDS', strand: 1,
        segments: [{ start: 1, end: 8, partial_start: true, partial_end: true }],
      }],
    })

    const result = serializeDnaSequenceToGenBank(value, { date: fixedDate })
    expect(result).toContain('<1..>8')
  })

  it('wraps sequence in 60-char lines with 10-char groups', () => {
    const seq = 'A'.repeat(120)
    const value = normalizeDnaSequenceValue({ name: 'Test', sequence: seq })
    const result = serializeDnaSequenceToGenBank(value, { date: fixedDate })

    const originIndex = result.indexOf('ORIGIN')
    const originSection = result.slice(originIndex)
    const lines = originSection.split('\n').filter(l => l.match(/^\s+\d+/))

    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/^\s+1\s/)
    expect(lines[1]).toMatch(/^\s+61\s/)
  })

  it('uses default name when none provided', () => {
    const value = normalizeDnaSequenceValue({ sequence: 'ATCG' })
    const result = serializeDnaSequenceToGenBank(value, { date: fixedDate })
    expect(result).toContain('DNA_SEQUENCE')
  })

  it('formats date correctly', () => {
    const value = normalizeDnaSequenceValue({ sequence: 'ATCG' })
    const result = serializeDnaSequenceToGenBank(value, { date: fixedDate })
    expect(result).toContain('15-JUN-2024')
  })
})
