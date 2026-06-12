import { prettyPrintJson } from '@airalogy/aira-core'
import { isPlainObject } from './reader-model'

export function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

export function formatRecordValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (isPlainObject(value) && 'value' in value) {
    return formatRecordValue(value.value)
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return prettyPrintJson(value)
}

export function desktopFileName(path: string): string {
  const normalized = path.replaceAll('\\', '/')
  return normalized.split('/').filter(Boolean).at(-1) || path
}

export function isTextLikePayload(path: string, fileName: string, mimeType: string): boolean {
  const mime = mimeType.toLowerCase()
  if (
    mime.startsWith('text/')
    || mime.includes('json')
    || mime.includes('xml')
    || mime.includes('csv')
    || mime.includes('yaml')
    || mime.includes('toml')
  ) {
    return true
  }
  const name = `${path} ${fileName}`.toLowerCase()
  return ['.txt', '.md', '.csv', '.tsv', '.json', '.jsonl', '.xml', '.yaml', '.yml', '.toml', '.aimd']
    .some(suffix => name.endsWith(suffix))
}

export function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}
