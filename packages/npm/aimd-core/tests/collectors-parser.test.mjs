import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseCollectorsContent } from '../dist/parser.js'

test('parseCollectorsContent normalizes snapshot defaults', () => {
  const parsed = parseCollectorsContent(`
room_temperature:
  connector: lab_sensor_gateway
  channel: room.temperature
`)

  assert.deepEqual(parsed.collectors.room_temperature, {
    id: 'room_temperature',
    connector: 'lab_sensor_gateway',
    channel: 'room.temperature',
    mode: 'snapshot',
    lifecycle: {
      start: 'manual',
      stop: 'manual',
    },
    manual_fallback: false,
  })
})

test('parseCollectorsContent parses polling and step lifecycle metadata', () => {
  const parsed = parseCollectorsContent(`
incubator_temperature:
  connector: lab_sensor_gateway
  mode: polling
  interval: 2.5s
  manual_fallback: true
  lifecycle:
    start:
      event: step_start
      step: incubation
    stop:
      event: step_complete
      step: incubation
`)

  assert.deepEqual(parsed.collectors.incubator_temperature, {
    id: 'incubator_temperature',
    connector: 'lab_sensor_gateway',
    mode: 'polling',
    interval: '2.5s',
    interval_ms: 2500,
    manual_fallback: true,
    lifecycle: {
      start: { event: 'step_start', step: 'incubation' },
      stop: { event: 'step_complete', step: 'incubation' },
    },
  })
})

test('parseCollectorsContent rejects polling without an interval', () => {
  assert.throws(() => parseCollectorsContent(`
temperature:
  connector: sensor
  mode: polling
`), /interval is required for polling mode/)
})

test('parseCollectorsContent rejects interval outside polling mode', () => {
  assert.throws(() => parseCollectorsContent(`
temperature:
  connector: sensor
  mode: snapshot
  interval: 5s
`), /interval is only valid for polling mode/)
})

test('parseCollectorsContent rejects duplicate collector ids', () => {
  assert.throws(() => parseCollectorsContent(`
temperature:
  connector: first
temperature:
  connector: second
`), /Map keys must be unique|duplicate key/i)
})

test('parseCollectorsContent rejects mismatched lifecycle events', () => {
  assert.throws(() => parseCollectorsContent(`
temperature:
  connector: sensor
  lifecycle:
    start:
      event: step_complete
      step: measurement
`), /lifecycle.start.event must be step_start/)
})
