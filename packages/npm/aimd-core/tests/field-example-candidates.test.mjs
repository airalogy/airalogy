import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getAimdFieldExampleCandidates as candidates } from '../dist/utils.js'

test('field examples and defaults take precedence over type examples; ordinary defaults stay intact', () => {
  const field = Object.freeze({ id: 'sequence', type: 'typing.Optional[airalogy.types.ATCG]', examples: ['XYZ', 'GATTACA'], default: 'CC' })
  assert.deepEqual(candidates(field), ['GATTACA', 'CC', 'ATCG'])
  assert.equal(field.default, 'CC')
  assert.deepEqual(candidates({ id: 'x', type: 'bool', examples: [true], default: false }), [true, false])
  assert.equal(candidates({ id: 'x', type: 'float' })[0], 0)
  assert.equal(candidates({ id: 'x', type: 'date' })[0], '2000-01-01')
})

test('published enum schema and type registry agree, contextual types stay empty even with hints', () => {
  const field = { id: 'group', type: 'BloodType | None', examples: ['X', 'O-'] }
  assert.equal(candidates(field)[0], 'O-')
  assert.ok(!candidates(field).includes('X'))
  for (const type of ['FileIdPNG', 'ResourceRef', 'CurrentTime', 'CurrentRecordId', 'UserName', 'Observation[float]']) {
    assert.deepEqual(candidates({ id: 'x', type, examples: ['fabricated'] }), [])
  }
  assert.deepEqual(candidates({ id: 'code', type: 'PyStr' }), [])
  assert.deepEqual(candidates({ id: 'code', type: 'PyStr', examples: ['x = 3'] }), ['x = 3'])
  const input = { id: 'x', type: 'str', examples: ['fabricated'] }
  for (const property of [{ type: 'string', airalogy_type: 'FileIdPNG' }, { readOnly: true }, { $ref: 'https://invalid.test/field' }]) {
    assert.deepEqual(candidates(input, { variablesSchema: { properties: { x: property } } }), [])
  }
  assert.deepEqual(candidates({ ...input, kwargs: { collector: 'reader' } }), [])
})
