import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { isAimdNullableType, unwrapAimdNullableType, getAimdBuiltInTypeEnumValues } from '../dist/utils.js'
import { parseVarDefinition } from '../dist/parser.js'

test('nullable types preserve quoted literals and nested generic expressions', () => {
  for (const type of ['str | None', 'None | str', 'Optional[str]', 'typing.Union[None, str]', 'typing_extensions.Optional[str]', 'Optional[Optional[str]]']) {
    assert.equal(isAimdNullableType(type), true, type)
    assert.equal(unwrapAimdNullableType(type), 'str', type)
  }
  assert.equal(unwrapAimdNullableType('Literal["A|B", "None"] | None'), 'Literal["A|B", "None"]')
  assert.equal(unwrapAimdNullableType('list[dict[str, int | None]] | None'), 'list[dict[str, int | None]]')
  assert.equal(isAimdNullableType('list[str | None]'), false)
  assert.equal(isAimdNullableType('Literal["None", "Optional[str]"]'), false)
  assert.equal(unwrapAimdNullableType('str | int | None'), 'str | int | None')
  assert.equal(unwrapAimdNullableType('Union[str, int, None]'), 'Union[str, int, None]')
  assert.equal(unwrapAimdNullableType('Optional[str] | Optional[int]'), 'Optional[str] | Optional[int]')
  assert.equal(unwrapAimdNullableType('Optional[str] | list[int]'), 'Optional[str] | list[int]')
  assert.equal(unwrapAimdNullableType('Optional[list[str]] | None'), 'list[str]')
  assert.equal(unwrapAimdNullableType(undefined), '')
})

test('shared nullable-inputs fixture retains enum values and full type annotations', () => {
  const content = readFileSync(new URL('../../../../spec/fixtures/protocols/nullable-inputs/protocol/protocol.aimd', import.meta.url), 'utf8')
  const fields = [...content.matchAll(/\{\{var\|([^}]+)\}\}/g)].map(match => parseVarDefinition(match[1]))
  assert.deepEqual(fields.map(field => field.id), ['choice', 'count_choice', 'confirmed', 'optional_flag', 'image', 'json_text'])
  assert.deepEqual(fields[0].enum, ['A|B', 'None'])
  assert.deepEqual(fields[1].enum, [1, 2])
  assert.equal(fields[0].type, 'Literal["A|B", "None"] | None')
})

test('named enum lookup unwraps only nullable single-type unions', () => {
  assert.deepEqual(getAimdBuiltInTypeEnumValues('typing.Union[None, BloodType]'), getAimdBuiltInTypeEnumValues('BloodType'))
  assert.deepEqual(getAimdBuiltInTypeEnumValues('BloodType | list[str] | None'), [])
})
