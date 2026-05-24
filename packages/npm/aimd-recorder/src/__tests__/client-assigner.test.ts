import { describe, expect, it } from 'vitest'

import { applyClientAssigners } from '../client-assigner'
import type { AimdClientAssignerField } from '@airalogy/aimd-core/types'

function makeAssigner(overrides: Partial<AimdClientAssignerField> & { id: string }): AimdClientAssignerField {
  return {
    runtime: 'client',
    mode: 'auto',
    function_source: 'function assign(fields) { return {}; }',
    dependent_fields: [],
    assigned_fields: [],
    ...overrides,
  } as AimdClientAssignerField
}

// ---------------------------------------------------------------------------
// Basic compilation & execution
// ---------------------------------------------------------------------------

describe('client-assigner: compilation', () => {
  it('compiles and executes a simple assigner', () => {
    const assigners = [makeAssigner({
      id: 'sum',
      function_source: 'function assign(fields) { return { total: fields.a + fields.b }; }',
      dependent_fields: ['a', 'b'],
      assigned_fields: ['total'],
    })]

    const values: Record<string, unknown> = { a: 10, b: 20, total: 0 }
    const result = applyClientAssigners(assigners, values)

    expect(result.changed).toBe(true)
    expect(result.changedFields).toContain('total')
    expect(values.total).toBe(30)
  })

  it('handles local variables in function body', () => {
    const assigners = [makeAssigner({
      id: 'calc',
      function_source: 'function assign(fields) { var x = fields.a * 2; return { result: x }; }',
      dependent_fields: ['a'],
      assigned_fields: ['result'],
    })]

    const values: Record<string, unknown> = { a: 5, result: 0 }
    applyClientAssigners(assigners, values)
    expect(values.result).toBe(10)
  })

  it('reports no change when values are identical', () => {
    const assigners = [makeAssigner({
      id: 'noop',
      function_source: 'function assign(fields) { return { x: fields.x }; }',
      dependent_fields: ['x'],
      assigned_fields: ['x'],
    })]

    const values: Record<string, unknown> = { x: 42 }
    const result = applyClientAssigners(assigners, values)
    expect(result.changed).toBe(false)
  })

  it('returns empty result for no assigners', () => {
    const result = applyClientAssigners([], {})
    expect(result.changed).toBe(false)
    expect(result.changedFields).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Execution modes
// ---------------------------------------------------------------------------

describe('client-assigner: modes', () => {
  it('skips manual mode without explicit trigger', () => {
    const assigners = [makeAssigner({
      id: 'manual_calc',
      mode: 'manual',
      function_source: 'function assign(fields) { return { y: 999 }; }',
      dependent_fields: ['x'],
      assigned_fields: ['y'],
    })]

    const values: Record<string, unknown> = { x: 1, y: 0 }
    applyClientAssigners(assigners, values)
    expect(values.y).toBe(0)
  })

  it('runs manual mode with explicit trigger', () => {
    const assigners = [makeAssigner({
      id: 'manual_calc',
      mode: 'manual',
      function_source: 'function assign(fields) { return { y: 999 }; }',
      dependent_fields: ['x'],
      assigned_fields: ['y'],
    })]

    const values: Record<string, unknown> = { x: 1, y: 0 }
    applyClientAssigners(assigners, values, { triggerIds: ['manual_calc'] })
    expect(values.y).toBe(999)
  })

  it('auto_first runs only when assigned fields are empty', () => {
    const assigners = [makeAssigner({
      id: 'init',
      mode: 'auto_first',
      function_source: 'function assign(fields) { return { y: fields.x * 2 }; }',
      dependent_fields: ['x'],
      assigned_fields: ['y'],
    })]

    // y is empty → should run
    const values1: Record<string, unknown> = { x: 5, y: '' }
    applyClientAssigners(assigners, values1)
    expect(values1.y).toBe(10)

    // y is already set → should NOT run
    const values2: Record<string, unknown> = { x: 5, y: 10 }
    applyClientAssigners(assigners, values2)
    expect(values2.y).toBe(10)
  })

  it('auto_force always runs', () => {
    const assigners = [makeAssigner({
      id: 'force',
      mode: 'auto',
      function_source: 'function assign(fields) { return { y: fields.x + 1 }; }',
      dependent_fields: ['x'],
      assigned_fields: ['y'],
    })]

    const values: Record<string, unknown> = { x: 5, y: 100 }
    applyClientAssigners(assigners, values)
    expect(values.y).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// Dependency ordering
// ---------------------------------------------------------------------------

describe('client-assigner: dependency ordering', () => {
  it('executes assigners in dependency order', () => {
    const assigners = [
      makeAssigner({
        id: 'second',
        function_source: 'function assign(fields) { return { c: fields.b + 1 }; }',
        dependent_fields: ['b'],
        assigned_fields: ['c'],
      }),
      makeAssigner({
        id: 'first',
        function_source: 'function assign(fields) { return { b: fields.a + 1 }; }',
        dependent_fields: ['a'],
        assigned_fields: ['b'],
      }),
    ]

    const values: Record<string, unknown> = { a: 1, b: 0, c: 0 }
    applyClientAssigners(assigners, values)
    expect(values.b).toBe(2)
    expect(values.c).toBe(3)
  })

  it('skips assigners with unready dependencies', () => {
    const assigners = [makeAssigner({
      id: 'calc',
      function_source: 'function assign(fields) { return { y: fields.x + 1 }; }',
      dependent_fields: ['x'],
      assigned_fields: ['y'],
    })]

    const values: Record<string, unknown> = { x: '', y: 0 }
    const result = applyClientAssigners(assigners, values)
    expect(result.changed).toBe(false)
    expect(values.y).toBe(0)
  })

  it('skips assigners when a numeric dependency violates field constraints', () => {
    const assigners = [makeAssigner({
      id: 'bmi',
      function_source: 'function assign(fields) { var h = Number(fields.height_cm) / 100; return { bmi: Math.round((Number(fields.weight_kg) / (h * h)) * 10) / 10 }; }',
      dependent_fields: ['height_cm', 'weight_kg'],
      assigned_fields: ['bmi'],
    })]

    const values: Record<string, unknown> = { height_cm: -170, weight_kg: 70, bmi: '' }
    const result = applyClientAssigners(assigners, values, {
      fieldDefinitions: {
        height_cm: { type: 'float', kwargs: { gt: 0 } },
        weight_kg: { type: 'float', kwargs: { gt: 0 } },
      },
    })

    expect(result.changed).toBe(false)
    expect(values.bmi).toBe('')
  })

  it('runs assigners when constrained numeric dependencies are valid', () => {
    const assigners = [makeAssigner({
      id: 'bmi',
      function_source: 'function assign(fields) { var h = Number(fields.height_cm) / 100; return { bmi: Math.round((Number(fields.weight_kg) / (h * h)) * 10) / 10 }; }',
      dependent_fields: ['height_cm', 'weight_kg'],
      assigned_fields: ['bmi'],
    })]

    const values: Record<string, unknown> = { height_cm: 170, weight_kg: 70, bmi: '' }
    const result = applyClientAssigners(assigners, values, {
      fieldDefinitions: {
        height_cm: { type: 'float', kwargs: { gt: 0 } },
        weight_kg: { type: 'float', kwargs: { gt: 0 } },
      },
    })

    expect(result.changed).toBe(true)
    expect(values.bmi).toBe(24.2)
  })

  it('skips assigners when a numeric dependency is not finite', () => {
    const assigners = [makeAssigner({
      id: 'calc',
      function_source: 'function assign(fields) { return { y: Number(fields.x) + 1 }; }',
      dependent_fields: ['x'],
      assigned_fields: ['y'],
    })]

    const values: Record<string, unknown> = { x: 'abc', y: 0 }
    const result = applyClientAssigners(assigners, values, {
      fieldDefinitions: {
        x: { type: 'float' },
      },
    })

    expect(result.changed).toBe(false)
    expect(values.y).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('client-assigner: error handling', () => {
  it('throws if assigner returns non-object', () => {
    const assigners = [makeAssigner({
      id: 'bad',
      function_source: 'function assign(fields) { return 42; }',
      dependent_fields: [],
      assigned_fields: ['x'],
    })]

    const values: Record<string, unknown> = { x: 0 }
    expect(() => applyClientAssigners(assigners, values)).toThrow('must return an object')
  })

  it('throws if missing assigned fields', () => {
    const assigners = [makeAssigner({
      id: 'bad',
      function_source: 'function assign(fields) { return {}; }',
      dependent_fields: [],
      assigned_fields: ['x'],
    })]

    const values: Record<string, unknown> = { x: 0 }
    expect(() => applyClientAssigners(assigners, values)).toThrow('missing assigned fields')
  })

  it('throws if extra fields returned', () => {
    const assigners = [makeAssigner({
      id: 'bad',
      function_source: 'function assign(fields) { return { x: 1, extra: 2 }; }',
      dependent_fields: [],
      assigned_fields: ['x'],
    })]

    const values: Record<string, unknown> = { x: 0 }
    expect(() => applyClientAssigners(assigners, values)).toThrow('not declared in assigned_fields')
  })
})

// ---------------------------------------------------------------------------
// Sandbox & security
// ---------------------------------------------------------------------------

describe('client-assigner: sandbox escape prevention', () => {
  it('rejects function source referencing window', () => {
    const assigners = [makeAssigner({
      id: 'escape_win',
      function_source: 'function assign(fields) { return { x: typeof window }; }',
      dependent_fields: [],
      assigned_fields: ['x'],
    })]

    const values: Record<string, unknown> = { x: '' }
    expect(() => applyClientAssigners(assigners, values)).toThrow()
  })

  it('rejects function source referencing document', () => {
    const assigners = [makeAssigner({
      id: 'escape_doc',
      function_source: 'function assign(fields) { return { x: typeof document }; }',
      dependent_fields: [],
      assigned_fields: ['x'],
    })]

    const values: Record<string, unknown> = { x: '' }
    expect(() => applyClientAssigners(assigners, values)).toThrow()
  })

  it('rejects function source referencing globalThis', () => {
    const assigners = [makeAssigner({
      id: 'escape_gt',
      function_source: 'function assign(fields) { return { x: typeof globalThis }; }',
      dependent_fields: [],
      assigned_fields: ['x'],
    })]

    const values: Record<string, unknown> = { x: '' }
    expect(() => applyClientAssigners(assigners, values)).toThrow()
  })

  it('rejects function source referencing fetch', () => {
    const assigners = [makeAssigner({
      id: 'escape_fetch',
      function_source: 'function assign(fields) { return { x: typeof fetch }; }',
      dependent_fields: [],
      assigned_fields: ['x'],
    })]

    const values: Record<string, unknown> = { x: '' }
    expect(() => applyClientAssigners(assigners, values)).toThrow()
  })

  it('has access to safe Math', () => {
    const assigners = [makeAssigner({
      id: 'math_test',
      function_source: 'function assign(fields) { return { x: Math.round(3.7) }; }',
      dependent_fields: [],
      assigned_fields: ['x'],
    })]

    const values: Record<string, unknown> = { x: 0 }
    applyClientAssigners(assigners, values)
    expect(values.x).toBe(4)
  })

  it('has access to safe JSON', () => {
    const assigners = [makeAssigner({
      id: 'json_test',
      function_source: 'function assign(fields) { return { x: JSON.parse(JSON.stringify({a:1})) }; }',
      dependent_fields: [],
      assigned_fields: ['x'],
    })]

    const values: Record<string, unknown> = { x: null }
    applyClientAssigners(assigners, values)
    expect(values.x).toEqual({ a: 1 })
  })

  it('has access to safe Object methods', () => {
    const assigners = [makeAssigner({
      id: 'obj_test',
      function_source: 'function assign(fields) { return { x: Object.keys(fields).length }; }',
      dependent_fields: ['a', 'b'],
      assigned_fields: ['x'],
    })]

    const values: Record<string, unknown> = { a: 1, b: 2, x: 0 }
    applyClientAssigners(assigners, values)
    expect(values.x).toBe(2)
  })

  it('has access to safe Array.isArray', () => {
    const assigners = [makeAssigner({
      id: 'arr_test',
      function_source: 'function assign(fields) { return { x: Array.isArray(fields.data) }; }',
      dependent_fields: ['data'],
      assigned_fields: ['x'],
    })]

    const values: Record<string, unknown> = { data: [1, 2], x: false }
    applyClientAssigners(assigners, values)
    expect(values.x).toBe(true)
  })

  it('clones dependent field values (no mutation leak)', () => {
    const assigners = [makeAssigner({
      id: 'mutate_test',
      function_source: 'function assign(fields) { fields.data.push(99); return { x: fields.data.length }; }',
      dependent_fields: ['data'],
      assigned_fields: ['x'],
    })]

    const originalData = [1, 2, 3]
    const values: Record<string, unknown> = { data: originalData, x: 0 }
    applyClientAssigners(assigners, values)
    expect(originalData).toEqual([1, 2, 3])
  })
})
