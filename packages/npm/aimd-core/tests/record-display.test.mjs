import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  AIMD_FILE_REFERENCE_VALUE_KEYS,
  getAimdAssetMediaSource,
  getAimdFileDisplayName,
  getAimdFileExtensionFromTypeName,
  getAimdFileInputConfig,
  getAimdFileKindFromExtension,
  getAimdFileValueId,
  inferAimdAssetKind,
  isAimdAiralogyFileId,
  normalizeAimdRecordDataValue,
  normalizeAimdTypeName,
  stringifyAimdDisplayValue,
  toAimdBooleanValue,
  unwrapAimdStructuredValue,
} from '../dist/index.js'

test('normalizes AIMD type names and structured record values', () => {
  assert.equal(normalizeAimdTypeName(' File-ID PNG '), 'fileidpng')
  assert.equal(normalizeAimdTypeName(undefined), 'str')
  assert.equal(unwrapAimdStructuredValue({ value: 42, status: 'ok' }), 42)
  assert.equal(stringifyAimdDisplayValue({ value: ['A', 'B'] }), 'A, B')
})

test('normalizes Record payloads with nested data', () => {
  const normalized = normalizeAimdRecordDataValue({
    metadata: { protocol_id: 'demo' },
    data: {
      var: { sample_id: 'S-001' },
      check: { qc: { checked: true } },
    },
  })

  assert.deepEqual(normalized.var, { sample_id: 'S-001' })
  assert.deepEqual(normalized.check, { qc: { checked: true } })
  assert.deepEqual(normalized.quiz, {})
})

test('resolves file values and display names consistently', () => {
  const selected = {
    value: {
      blob_id: 'blob-1',
      fileName: 'site-photo.png',
    },
  }

  assert.equal(getAimdFileValueId(selected), undefined)
  assert.equal(getAimdFileValueId(selected, AIMD_FILE_REFERENCE_VALUE_KEYS), 'blob-1')
  assert.equal(getAimdFileDisplayName(selected), 'site-photo.png')
  assert.equal(isAimdAiralogyFileId('airalogy.id.file.abc_123'), true)
  assert.equal(getAimdFileDisplayName('airalogy.id.file.abc_123', undefined, { hideAiralogyFileIds: true }), '')
})

test('infers asset kinds and file input config from shared rules', () => {
  assert.deepEqual(getAimdFileInputConfig('FileIdPNG'), {
    kind: 'image',
    accept: '.png,image/png',
    badge: 'IMG',
  })
  assert.equal(getAimdFileExtensionFromTypeName('FileIdMOV'), 'mov')
  assert.deepEqual(getAimdFileInputConfig('FileIdMOV'), {
    kind: 'video',
    accept: '.mov,video/quicktime',
    badge: 'VID',
  })
  assert.deepEqual(getAimdFileInputConfig('FileIdWAV'), {
    kind: 'audio',
    accept: '.wav,audio/wav',
    badge: 'AUD',
  })
  assert.equal(getAimdFileKindFromExtension('.MOV'), 'video')
  assert.deepEqual(getAimdFileInputConfig('str', { fileExtension: 'csv' }), {
    kind: 'csv',
    accept: '.csv,text/csv',
    badge: 'CSV',
  })
  assert.equal(inferAimdAssetKind({ mimeType: 'image/svg+xml' }, undefined, 'str'), 'image')
  assert.equal(inferAimdAssetKind(undefined, 'airalogy.id.file.movie.mov', 'FileIdMOV'), 'video')
  assert.equal(inferAimdAssetKind(undefined, { value: 'report.pdf' }, 'str'), 'document')
})

test('coerces boolean values and media URLs for readonly rendering', () => {
  assert.equal(toAimdBooleanValue('off'), false)
  assert.equal(toAimdBooleanValue('yes'), true)
  assert.equal(getAimdAssetMediaSource({ href: 'https://example.test/file.png' }), 'https://example.test/file.png')
  assert.equal(getAimdAssetMediaSource({ href: 'airalogy.id.file.abc' }), undefined)
})
