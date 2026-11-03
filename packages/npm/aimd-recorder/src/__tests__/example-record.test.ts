import { parseAndExtract } from '@airalogy/aimd-renderer'
import { describe, expect, it } from 'vitest'
import { createEmptyProtocolRecordData, createExampleRecord } from '../record'

describe('createExampleRecord', () => {
  it('validates field examples before falling back, preserves false and zero and skips references', () => {
    const fields = parseAndExtract('{{var|temp: float, ge=20, le=40, examples=[-1, 37]}} {{var|count: int}} {{var|enabled: bool}} {{var|seq: ATCG}} {{var|scan: FileIdPNG}} {{var|total: int}}')
    fields.client_assigner = parseAndExtract(`
\`\`\`assigner runtime=client
assigner({ mode: "auto", dependent_fields: ["count"], assigned_fields: ["total"] }, function calculate({ count }) { return { total: count + 1 }; });
\`\`\``).client_assigner
    expect(fields.client_assigner).toHaveLength(1)
    const before = JSON.stringify(fields)
    const result = createExampleRecord(fields)
    expect(result.record.var).toEqual({ temp: 37, count: 0, enabled: false, seq: 'ATCG' })
    expect(result.skipped).toEqual(['scan', 'total'])
    result.record.var.temp = 99
    expect(createExampleRecord(fields, { assignedFields: ['temp'] }).record.var.temp).toBeUndefined()
    expect(createExampleRecord(fields).record.var.temp).toBe(37)
    expect(JSON.stringify(fields)).toBe(before)
    expect(createEmptyProtocolRecordData().var).toEqual({})
  })

  it('honors published schema, nullable enums, and impossible constraints', () => {
    const fields = parseAndExtract('{{var|n: int}} {{var|group}} {{var|tag: str}} {{var|text: str}}')
    const result = createExampleRecord(fields, { locale: 'zh-CN', schema: { research_variable: {
      type: 'object',
      properties: {
        n: { type: 'integer', minimum: 9, maximum: 14, multipleOf: 4 },
        group: { anyOf: [{ $ref: '#/$defs/Group' }, { type: 'null' }] },
        tag: { type: 'string', pattern: '^S-[0-9]+$' },
      },
      $defs: { Group: { type: 'string', enum: ['A', 'B'] } },
    } } })
    expect(result.record.var).toEqual({ n: 12, group: 'A', text: '示例' })
    expect(result.skipped).toEqual(['tag'])
  })
  it('rechecks earlier choices when another candidate changes a conditional requirement', () => {
    const fields = parseAndExtract('{{var|n: int, examples=[1, 2]}} {{var|tag: str, examples=["A", "B"]}}')
    const { record } = createExampleRecord(fields, { schema: { vars: {
      type: 'object',
      properties: { n: { type: 'integer', minimum: 2 }, tag: { type: 'string' } },
      if: { properties: { n: { const: 2 } } },
      then: { properties: { tag: { const: 'B' } } },
    } } })
    expect(record.var).toEqual({ n: 2, tag: 'B' })
  })

  it('does not return unchecked values when the supplied variables schema cannot compile', () => {
    const fields = parseAndExtract('{{var|n: int}}')
    expect(() => createExampleRecord(fields, { schema: { vars: {
      type: 'object', properties: { n: { type: 'integer', minimum: 'invalid' } },
    } } })).toThrow()
  })

})
