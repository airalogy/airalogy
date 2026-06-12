import type { AiraFileManifest } from '@airalogy/aira-core'
import type { ReadonlyRecordAsset, ReadonlyRecordAssetResolveContext } from '@airalogy/aimd-renderer'
import { isPlainObject, normalizeRecordString } from './reader-model'

export type RecordFileReference = AiraFileManifest & {
  record_id?: string | null
  path?: string | null
}

export type RecordAssetResolver = (context: ReadonlyRecordAssetResolveContext) => ReadonlyRecordAsset | null

function getFileRefString(fileRef: Record<string, unknown>, key: string): string | undefined {
  return normalizeRecordString(fileRef[key])
}

function getFileRefNumber(fileRef: Record<string, unknown>, key: string): number | undefined {
  const value = fileRef[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function normalizePayloadFileRef(value: unknown): RecordFileReference | null {
  if (!isPlainObject(value)) {
    return null
  }
  return {
    file_id: getFileRefString(value, 'file_id') ?? getFileRefString(value, 'fileId') ?? null,
    source_uri: getFileRefString(value, 'source_uri') ?? getFileRefString(value, 'sourceUri') ?? null,
    blob_id: getFileRefString(value, 'blob_id') ?? getFileRefString(value, 'blobId') ?? null,
    filename: getFileRefString(value, 'filename') ?? getFileRefString(value, 'file_name') ?? getFileRefString(value, 'fileName') ?? null,
    mime_type: getFileRefString(value, 'mime_type') ?? getFileRefString(value, 'mimeType') ?? null,
    size: getFileRefNumber(value, 'size') ?? null,
    record_path: getFileRefString(value, 'record_path') ?? getFileRefString(value, 'recordPath') ?? null,
    field_path: getFileRefString(value, 'field_path') ?? getFileRefString(value, 'fieldPath') ?? null,
    record_id: getFileRefString(value, 'record_id') ?? getFileRefString(value, 'recordId') ?? null,
    path: getFileRefString(value, 'path') ?? null,
  }
}

export function fieldIdFromPath(fieldPath: string | null | undefined): string | undefined {
  const normalized = normalizeRecordString(fieldPath)
  if (!normalized) {
    return undefined
  }
  const parts = normalized.split('.').filter(Boolean)
  return parts.length >= 3 && parts[0] === 'data' ? parts.at(-1) : undefined
}

export function assetKeysForFileRef(fileRef: RecordFileReference): string[] {
  return [
    fileRef.file_id,
    fileRef.blob_id,
    fileRef.source_uri,
    fileRef.field_path,
    fieldIdFromPath(fileRef.field_path),
  ]
    .map(value => normalizeRecordString(value))
    .filter((value): value is string => Boolean(value))
}

export function registerRecordAsset(
  assets: Map<string, ReadonlyRecordAsset>,
  fileRef: RecordFileReference,
  asset: ReadonlyRecordAsset,
): void {
  for (const key of assetKeysForFileRef(fileRef)) {
    if (!assets.has(key)) {
      assets.set(key, asset)
    }
  }
}

export function readRecordAssetValueKey(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return normalizeRecordString(value)
  }
  if (!isPlainObject(value)) {
    return undefined
  }
  return [
    value.file_id,
    value.fileId,
    value.blob_id,
    value.blobId,
    value.source_uri,
    value.sourceUri,
    value.id,
    value.src,
    value.url,
    value.href,
  ]
    .map(item => normalizeRecordString(item))
    .find(Boolean)
}

export function createRecordAssetResolver(
  assets: Map<string, ReadonlyRecordAsset>,
): RecordAssetResolver {
  return (context) => {
    const candidates = [
      context.fileId,
      readRecordAssetValueKey(context.normalizedValue),
      readRecordAssetValueKey(context.value),
      context.fieldPath,
      `data.${context.scope}.${context.fieldId}`,
      context.fieldId,
    ]
      .map(value => normalizeRecordString(value))
      .filter((value): value is string => Boolean(value))

    for (const key of candidates) {
      const asset = assets.get(key)
      if (asset) {
        return asset
      }
    }
    return null
  }
}
