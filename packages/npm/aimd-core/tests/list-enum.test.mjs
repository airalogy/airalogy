import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parseVarDefinition, parseVarListEnumValues, parseVarEnumValues } from '../dist/parser.js'

test('list item enums do not become scalar enum metadata', () => {
  for (const type of ['list[Literal["A", "B"]]', 'typing.List[Literal["A", "B"]] | None', 'Optional[list[Literal["A", "B"]]]']) {
    assert.deepEqual(parseVarListEnumValues(type), ['A', 'B'])
    assert.deepEqual(parseVarEnumValues(type), [])
  }
  assert.deepEqual(parseVarListEnumValues('list[Literal[1, True, None]]'), [1, true, null])
  assert.deepEqual(parseVarListEnumValues('list[BloodType]'), parseVarEnumValues('BloodType'))
  assert.deepEqual(parseVarListEnumValues('list[Literal["A"]] | list[Literal["B"]]'), [])
  assert.deepEqual(parseVarListEnumValues('list[list[Literal["A"]]]'), [])
})

test('shared choice input fixture keeps arrays distinct from single choices', () => {
  const content = readFileSync(new URL('../../../../spec/fixtures/protocols/input-choices/protocol/protocol.aimd', import.meta.url), 'utf8')
  const fields = [...content.matchAll(/\{\{var\|([^}]+)\}\}/g)].map(match => parseVarDefinition(match[1]))
  assert.deepEqual(fields[0].enum, ['Ready', 'Done'])
  assert.equal(fields[1].enum, undefined)
  assert.deepEqual(parseVarListEnumValues(fields[1].type), ['A', 'B', 'C'])
  assert.deepEqual(parseVarListEnumValues(fields[2].type), [1, 2, 3])
})
