import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  collectAimdRecordFieldRefs,
  createAimdRecordViewColumns,
  filterAimdRecord,
  filterAimdRecords,
  getAimdRecordFieldValue,
  getAimdRecordViewCell,
  getAimdRecordViewCompareKey,
  getDefaultAimdRecordViewFieldKeys,
  searchAimdRecordFields,
} from '../dist/utils.js'

const fields = {
  var: ['participant', 'age'],
  var_definitions: [
    { id: 'participant', type: 'str', title: 'Participant' },
    { id: 'age', type: 'int', title: 'Age' },
  ],
  var_table: [
    {
      id: 'medications',
      scope: 'var_table',
      title: 'Medications',
      subvars: [
        { id: 'name', type: 'str', title: 'Name' },
        { id: 'dose', type: 'int', title: 'Dose' },
      ],
    },
  ],
  client_assigner: [],
  workflow: [],
  quiz: [
    { id: 'satisfaction', type: 'open', stem: 'How satisfied are you?' },
  ],
  step: ['prep'],
  check: ['ready'],
  ref_step: [],
  ref_var: [],
}

const aliceRecord = {
  var: {
    participant: 'Alice',
    age: 34,
    medications: [
      { name: 'aspirin', dose: '50' },
      { name: 'ibuprofen', dose: '25' },
    ],
  },
  step: {
    prep: {
      checked: true,
      annotation: 'heated sample',
      elapsed_ms: 1200,
      timer_started_at_ms: null,
      started_at_ms: null,
      ended_at_ms: null,
    },
  },
  check: {
    ready: {
      checked: false,
      annotation: 'waiting for confirmation',
    },
  },
  quiz: {
    satisfaction: 'good',
  },
}

test('collectAimdRecordFieldRefs includes simple fields and var_table subvars', () => {
  const refs = collectAimdRecordFieldRefs(fields)
  assert.deepEqual(refs.map(ref => ref.key), [
    'var:participant',
    'var:age',
    'var_table:medications',
    'var_table:medications:name',
    'var_table:medications:dose',
    'step:prep',
    'check:ready',
    'quiz:satisfaction',
  ])
  assert.equal(refs.find(ref => ref.key === 'var_table:medications:name')?.focusKey, 'var_table:medications:0:name')
})

test('getAimdRecordFieldValue reads var_table columns from var storage', () => {
  const value = getAimdRecordFieldValue(aliceRecord, 'var_table:medications:name')
  assert.deepEqual(value, ['aspirin', 'ibuprofen'])
})

test('searchAimdRecordFields finds matches across protocol fields', () => {
  const matches = searchAimdRecordFields(aliceRecord, 'heated', fields)
  assert.deepEqual(matches.map(match => match.field.key), ['step:prep'])

  const tableMatches = searchAimdRecordFields(aliceRecord, 'aspirin', fields)
  assert.ok(tableMatches.some(match => match.field.key === 'var_table:medications'))
  assert.ok(tableMatches.some(match => match.field.key === 'var_table:medications:name'))
})

test('filterAimdRecord supports field-specific contains, numeric comparisons, and regex', () => {
  assert.equal(filterAimdRecord(aliceRecord, fields, {
    fieldKey: 'var:participant',
    operator: 'contains',
    value: 'ali',
  }), true)
  assert.equal(filterAimdRecord(aliceRecord, fields, {
    fieldKey: 'var:age',
    operator: 'gte',
    value: 30,
  }), true)
  assert.equal(filterAimdRecord(aliceRecord, fields, {
    fieldKey: 'check:ready',
    operator: 'regex',
    value: 'confirm.*',
  }), true)
  assert.equal(filterAimdRecord(aliceRecord, fields, {
    fieldKey: 'var_table:medications:dose',
    operator: 'gt',
    value: 40,
  }), true)
})

test('filterAimdRecords returns matching records with search matches', () => {
  const records = [
    { id: 'alice', data: aliceRecord },
    {
      id: 'bob',
      data: {
        var: {
          participant: 'Bob',
          age: 28,
          medications: [{ name: 'metformin', dose: '10' }],
        },
        step: {},
        check: {},
        quiz: {},
      },
    },
  ]

  const result = filterAimdRecords(records, {
    fieldKey: 'var_table:medications:name',
    operator: 'contains',
    value: 'form',
  }, {
    fields,
    getRecordData: record => record.data,
  })

  assert.deepEqual(result.map(item => item.record.id), ['bob'])
  assert.deepEqual(result[0]?.matches.map(match => match.field.key), ['var_table:medications:name'])

  const numericResult = filterAimdRecords(records, {
    fieldKey: 'var:age',
    operator: 'gte',
    value: 30,
  }, {
    fields,
    getRecordData: record => record.data,
  })
  assert.deepEqual(numericResult.map(item => item.record.id), ['alice'])
  assert.deepEqual(numericResult[0]?.matches.map(match => match.field.key), ['var:age'])
})

test('createAimdRecordViewColumns builds compact defaults while retaining complex fields', () => {
  const columns = createAimdRecordViewColumns(fields, { maxDefaultColumns: 3 })

  assert.deepEqual(getDefaultAimdRecordViewFieldKeys(columns), [
    'var:participant',
    'var:age',
    'check:ready',
  ])
  assert.equal(columns.find(column => column.key === 'var:age')?.valueKind, 'number')
  assert.equal(columns.find(column => column.key === 'var_table:medications')?.valueKind, 'table')
  assert.equal(columns.find(column => column.key === 'step:prep')?.valueKind, 'step')
  assert.ok(columns.some(column => column.key === 'var_table:medications:name'))
})

test('getAimdRecordViewCell returns shared table and comparison metadata', () => {
  const columns = createAimdRecordViewColumns(fields)
  const medicationColumn = columns.find(column => column.key === 'var_table:medications')
  const checkColumn = columns.find(column => column.key === 'check:ready')

  assert.ok(medicationColumn)
  assert.ok(checkColumn)

  const medicationCell = getAimdRecordViewCell(aliceRecord, medicationColumn)
  assert.equal(medicationCell.count, 2)
  assert.equal(medicationCell.empty, false)

  const checkCell = getAimdRecordViewCell(aliceRecord, checkColumn)
  assert.equal(checkCell.checked, false)
  assert.equal(checkCell.annotation, 'waiting for confirmation')
  assert.equal(checkCell.empty, false)
})

test('getAimdRecordViewCompareKey compares structured values independent of key order', () => {
  assert.equal(
    getAimdRecordViewCompareKey({ checked: true, annotation: 'ready' }),
    getAimdRecordViewCompareKey({ annotation: 'ready', checked: true }),
  )
  assert.notEqual(getAimdRecordViewCompareKey(0), getAimdRecordViewCompareKey(false))
  assert.equal(getAimdRecordViewCompareKey(''), getAimdRecordViewCompareKey(null))
})
