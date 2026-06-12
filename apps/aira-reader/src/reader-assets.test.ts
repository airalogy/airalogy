import { describe, expect, it } from 'vitest'

import type { ReadonlyRecordAsset, ReadonlyRecordAssetResolveContext } from '@airalogy/aimd-renderer'
import {
  assetKeysForFileRef,
  createRecordAssetResolver,
  fieldIdFromPath,
  normalizePayloadFileRef,
  readRecordAssetValueKey,
  registerRecordAsset,
} from './reader-assets'

function createContext(
  partial: Partial<ReadonlyRecordAssetResolveContext>,
): ReadonlyRecordAssetResolveContext {
  return {
    fieldId: 'image_ids',
    fieldPath: 'data.var.image_ids',
    scope: 'var',
    node: {} as ReadonlyRecordAssetResolveContext['node'],
    value: undefined,
    normalizedValue: undefined,
    recordValue: {} as ReadonlyRecordAssetResolveContext['recordValue'],
    ...partial,
  }
}

describe('reader-assets', () => {
  it('normalizes payload file refs from record payload spelling variants', () => {
    expect(normalizePayloadFileRef({
      fileId: 'file-1',
      sourceUri: 'https://example.test/image.png',
      blobId: 'sha256:abc',
      fileName: 'image.png',
      mimeType: 'image/png',
      recordPath: 'records/r1.json',
      fieldPath: 'data.var.image_ids',
      recordId: 'r1',
      size: 42,
      path: 'local/image.png',
    })).toMatchObject({
      file_id: 'file-1',
      source_uri: 'https://example.test/image.png',
      blob_id: 'sha256:abc',
      filename: 'image.png',
      mime_type: 'image/png',
      record_path: 'records/r1.json',
      field_path: 'data.var.image_ids',
      record_id: 'r1',
      size: 42,
      path: 'local/image.png',
    })
  })

  it('derives stable lookup keys from field paths and file refs', () => {
    expect(fieldIdFromPath('data.var.image_ids')).toBe('image_ids')
    expect(fieldIdFromPath('metadata.files.image_ids')).toBeUndefined()
    expect(assetKeysForFileRef({
      file_id: 'file-1',
      blob_id: 'sha256:abc',
      source_uri: 'https://example.test/image.png',
      field_path: 'data.var.image_ids',
    })).toEqual([
      'file-1',
      'sha256:abc',
      'https://example.test/image.png',
      'data.var.image_ids',
      'image_ids',
    ])
  })

  it('registers the first asset for each key', () => {
    const first: ReadonlyRecordAsset = { href: 'first.png' }
    const second: ReadonlyRecordAsset = { href: 'second.png' }
    const assets = new Map<string, ReadonlyRecordAsset>()

    registerRecordAsset(assets, { file_id: 'file-1', field_path: 'data.var.image_ids' }, first)
    registerRecordAsset(assets, { file_id: 'file-1', field_path: 'data.var.other_image' }, second)

    expect(assets.get('file-1')).toBe(first)
    expect(assets.get('other_image')).toBe(second)
  })

  it('reads asset keys from scalar and structured record values', () => {
    expect(readRecordAssetValueKey('file-1')).toBe('file-1')
    expect(readRecordAssetValueKey({ blobId: 'sha256:abc' })).toBe('sha256:abc')
    expect(readRecordAssetValueKey({ source_uri: 'https://example.test/image.png' })).toBe('https://example.test/image.png')
    expect(readRecordAssetValueKey({})).toBeUndefined()
  })

  it('resolves assets from renderer context fallbacks', () => {
    const byFileId: ReadonlyRecordAsset = { href: 'file-id.png' }
    const byValue: ReadonlyRecordAsset = { href: 'value.png' }
    const byFieldPath: ReadonlyRecordAsset = { href: 'field-path.png' }
    const byScopedField: ReadonlyRecordAsset = { href: 'scoped-field.png' }
    const byFieldId: ReadonlyRecordAsset = { href: 'field-id.png' }
    const resolver = createRecordAssetResolver(new Map([
      ['file-1', byFileId],
      ['value-file', byValue],
      ['data.var.context_path', byFieldPath],
      ['data.var.image_ids', byScopedField],
      ['image_ids', byFieldId],
    ]))

    expect(resolver(createContext({ fileId: 'file-1' }))).toBe(byFileId)
    expect(resolver(createContext({ normalizedValue: { file_id: 'value-file' } }))).toBe(byValue)
    expect(resolver(createContext({ fieldPath: 'data.var.context_path' }))).toBe(byFieldPath)
    expect(resolver(createContext({ fieldPath: 'data.var.missing', normalizedValue: null }))).toBe(byScopedField)
    expect(resolver(createContext({ fieldPath: 'data.var.missing', scope: 'missing', normalizedValue: null }))).toBe(byFieldId)
  })
})
