export const AIMD_RECORD_DATA_SCOPES = ['var', 'var_table', 'step', 'check', 'quiz'] as const

export type AimdRecordDataScope = typeof AIMD_RECORD_DATA_SCOPES[number]

export type AimdAssetKind = 'file' | 'image' | 'audio' | 'video' | 'csv' | 'text' | 'document'

export type AimdRecordDataValue = Partial<Record<AimdRecordDataScope, Record<string, unknown>>> & {
  [key: string]: unknown
}

export interface AimdAssetLike {
  url?: string
  href?: string
  name?: string
  filename?: string
  mimeType?: string
  size?: number
  kind?: AimdAssetKind
  downloadName?: string
}

export interface AimdFileInputMetadata {
  inputType?: string
  accept?: string
  fileExtension?: unknown
}

export interface AimdFileInputConfig {
  kind: AimdAssetKind
  accept?: string
  badge: string
}

export const AIMD_FILE_BADGE_BY_KIND: Record<AimdAssetKind, string> = {
  file: 'FILE',
  image: 'IMG',
  audio: 'AUD',
  video: 'VID',
  csv: 'CSV',
  text: 'TXT',
  document: 'DOC',
}

export const AIMD_FILE_KIND_BY_EXTENSION: Record<string, AimdAssetKind> = {
  csv: 'csv',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  svg: 'image',
  webp: 'image',
  tif: 'image',
  tiff: 'image',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  aimd: 'text',
  md: 'text',
  txt: 'text',
  json: 'text',
  pdf: 'document',
  docx: 'document',
  xlsx: 'document',
  pptx: 'document',
}

export const AIMD_MIME_BY_EXTENSION: Record<string, string> = {
  csv: 'text/csv',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  md: 'text/markdown',
  txt: 'text/plain',
  aimd: 'text/plain',
  json: 'application/json',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export const AIMD_FILE_INPUT_CONFIG_BY_TYPE: Record<string, AimdFileInputConfig> = {
  file: { kind: 'file', badge: 'FILE' },
  upload: { kind: 'file', badge: 'FILE' },
  csv: { kind: 'csv', accept: '.csv,text/csv', badge: 'CSV' },
  fileidcsv: { kind: 'csv', accept: '.csv,text/csv', badge: 'CSV' },
  image: { kind: 'image', accept: 'image/*', badge: 'IMG' },
  fileidpng: { kind: 'image', accept: '.png,image/png', badge: 'IMG' },
  fileidjpg: { kind: 'image', accept: '.jpg,.jpeg,image/jpeg', badge: 'IMG' },
  fileidjpeg: { kind: 'image', accept: '.jpg,.jpeg,image/jpeg', badge: 'IMG' },
  fileidsvg: { kind: 'image', accept: '.svg,image/svg+xml', badge: 'IMG' },
  fileidwebp: { kind: 'image', accept: '.webp,image/webp', badge: 'IMG' },
  fileidtiff: { kind: 'image', accept: '.tif,.tiff,image/tiff', badge: 'IMG' },
  audio: { kind: 'audio', accept: 'audio/*', badge: 'AUD' },
  fileidmp3: { kind: 'audio', accept: '.mp3,audio/mpeg', badge: 'AUD' },
  video: { kind: 'video', accept: 'video/*', badge: 'VID' },
  fileidmp4: { kind: 'video', accept: '.mp4,video/mp4', badge: 'VID' },
  fileidaimd: { kind: 'text', accept: '.aimd,text/plain', badge: 'AIMD' },
  fileidmd: { kind: 'text', accept: '.md,text/markdown,text/plain', badge: 'MD' },
  fileidtxt: { kind: 'text', accept: '.txt,text/plain', badge: 'TXT' },
  fileidjson: { kind: 'text', accept: '.json,application/json', badge: 'JSON' },
  fileiddocx: { kind: 'document', accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document', badge: 'DOC' },
  fileidxlsx: { kind: 'document', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', badge: 'XLS' },
  fileidpptx: { kind: 'document', accept: '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation', badge: 'PPT' },
  fileidpdf: { kind: 'document', accept: '.pdf,application/pdf', badge: 'PDF' },
}

export const AIMD_AIRALOGY_FILE_ID_RE = /^airalogy\.id\.file\.[^\s]+$/i

export const AIMD_FILE_ID_VALUE_KEYS = ['id', 'file_id', 'fileId', 'src'] as const
export const AIMD_FILE_REFERENCE_VALUE_KEYS = ['id', 'file_id', 'fileId', 'blob_id', 'blobId', 'src', 'url', 'href'] as const

export function isAimdPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeAimdTypeName(value: unknown, fallback = 'str'): string {
  if (typeof value !== 'string') {
    return fallback
  }
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  return normalized || fallback
}

export function normalizeAimdOptionalTypeName(value: unknown): string {
  return normalizeAimdTypeName(value, '')
}

export function normalizeAimdString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function getAimdStringFromRecord(
  record: Record<string, unknown> | undefined,
  keys: readonly string[],
): string | undefined {
  if (!record) {
    return undefined
  }
  for (const key of keys) {
    const value = normalizeAimdString(record[key])
    if (value) {
      return value
    }
  }
  return undefined
}

export function resolveAimdRecordData(value: unknown): unknown {
  if (isAimdPlainRecord(value) && isAimdPlainRecord(value.data)) {
    return value.data
  }
  return value
}

export function unwrapAimdStructuredValue(value: unknown): unknown {
  if (isAimdPlainRecord(value) && 'value' in value) {
    return value.value
  }
  return value
}

export function normalizeAimdRecordDataValue(recordData: unknown): AimdRecordDataValue {
  const source = resolveAimdRecordData(recordData)
  const normalized: AimdRecordDataValue = {}
  if (!isAimdPlainRecord(source)) {
    return normalized
  }

  for (const scope of AIMD_RECORD_DATA_SCOPES) {
    const scopeValue = source[scope]
    normalized[scope] = isAimdPlainRecord(scopeValue) ? { ...scopeValue } : {}
  }

  return normalized
}

export function getAimdDisplayValue(value: unknown): unknown {
  return unwrapAimdStructuredValue(value)
}

function stringifyAimdDecimalLikeValue(value: unknown): string | undefined {
  if (!isAimdPlainRecord(value)) {
    return undefined
  }

  const toNumber = value.toNumber
  const toString = value.toString
  if (typeof toNumber !== 'function' || typeof toString !== 'function') {
    return undefined
  }

  try {
    const numericValue = toNumber.call(value)
    const displayValue = toString.call(value).trim()
    if (
      typeof numericValue === 'number'
      && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(displayValue)
    ) {
      return displayValue
    }
  }
  catch {
    return undefined
  }

  return undefined
}

export function stringifyAimdDisplayValue(value: unknown): string {
  const normalized = getAimdDisplayValue(value)
  if (normalized === null || normalized === undefined) {
    return ''
  }
  if (typeof normalized === 'string') {
    return normalized
  }
  if (typeof normalized === 'number' || typeof normalized === 'boolean') {
    return String(normalized)
  }
  if (Array.isArray(normalized)) {
    return normalized.map(item => stringifyAimdDisplayValue(item)).filter(Boolean).join(', ')
  }
  const decimalLikeValue = stringifyAimdDecimalLikeValue(normalized)
  if (decimalLikeValue !== undefined) {
    return decimalLikeValue
  }
  try {
    return JSON.stringify(normalized, null, 2)
  }
  catch {
    return String(normalized)
  }
}

export function toAimdBooleanValue(value: unknown): boolean {
  const normalized = getAimdDisplayValue(value)
  if (typeof normalized === 'boolean') return normalized
  if (typeof normalized === 'number') return normalized !== 0
  if (typeof normalized === 'string') {
    const text = normalized.trim().toLowerCase()
    if (text === '' || text === 'false' || text === '0' || text === 'no' || text === 'off') {
      return false
    }
    if (text === 'true' || text === '1' || text === 'yes' || text === 'on') {
      return true
    }
  }
  return Boolean(normalized)
}

export function normalizeAimdFileExtension(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim().toLowerCase()
  if (!trimmed || trimmed === '*') {
    return undefined
  }
  return trimmed.replace(/^\./, '')
}

export function getAimdConfiguredFileExtension(
  kwargs?: Record<string, unknown>,
  fieldMeta?: AimdFileInputMetadata,
): string | undefined {
  const metaExtension = normalizeAimdFileExtension(fieldMeta?.fileExtension)
  if (metaExtension) {
    return metaExtension
  }
  return normalizeAimdFileExtension(kwargs?.file_extension)
    ?? normalizeAimdFileExtension(kwargs?.fileExtension)
    ?? normalizeAimdFileExtension(kwargs?.extension)
}

export function getAimdFileExtension(value: unknown): string | undefined {
  const text = normalizeAimdString(value)
  if (!text) {
    return undefined
  }
  const withoutQuery = text.split(/[?#]/, 1)[0] ?? text
  const match = withoutQuery.match(/\.([A-Za-z0-9]+)$/)
  return normalizeAimdFileExtension(match?.[1])
}

export function getAimdAcceptFromExtension(extension: string): string {
  const ext = extension.replace(/^\./, '').toLowerCase()
  const mime = AIMD_MIME_BY_EXTENSION[ext]
  return mime ? `.${ext},${mime}` : `.${ext}`
}

export function getAimdFileKindFromExtension(extension: string | undefined): AimdAssetKind | undefined {
  const normalized = normalizeAimdFileExtension(extension)
  return normalized ? AIMD_FILE_KIND_BY_EXTENSION[normalized] : undefined
}

export function getAimdFileExtensionFromTypeName(type: unknown): string | undefined {
  const normalized = normalizeAimdOptionalTypeName(type)
  if (!normalized.startsWith('fileid') || normalized.length <= 'fileid'.length) {
    return undefined
  }

  const extension = normalizeAimdFileExtension(normalized.slice('fileid'.length))
  if (!extension) {
    return undefined
  }

  return AIMD_FILE_KIND_BY_EXTENSION[extension] || AIMD_MIME_BY_EXTENSION[extension]
    ? extension
    : undefined
}

export function getAimdFileKindFromMimeType(mimeType: string | undefined): AimdAssetKind | undefined {
  if (!mimeType) {
    return undefined
  }
  const mime = mimeType.toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  if (mime.includes('csv')) return 'csv'
  if (mime.startsWith('text/') || mime.includes('json') || mime.includes('markdown')) return 'text'
  if (mime.includes('pdf') || mime.includes('word') || mime.includes('spreadsheet') || mime.includes('presentation')) return 'document'
  return undefined
}

export function getAimdFileKindFromType(
  type: unknown,
  kwargs?: Record<string, unknown>,
  fieldMeta?: AimdFileInputMetadata,
): AimdAssetKind | undefined {
  const normalizedInputType = normalizeAimdOptionalTypeName(fieldMeta?.inputType ?? kwargs?.input_type ?? kwargs?.inputType)
  const normalizedType = normalizeAimdOptionalTypeName(type)
  const normalized = normalizedInputType || normalizedType
  if (!normalized) {
    return undefined
  }
  if (normalized === 'image' || normalized.startsWith('fileidpng') || normalized.startsWith('fileidjpg') || normalized.startsWith('fileidjpeg') || normalized.startsWith('fileidsvg') || normalized.startsWith('fileidwebp') || normalized.startsWith('fileidtiff')) {
    return 'image'
  }
  if (normalized === 'audio' || normalized.startsWith('fileidmp3')) {
    return 'audio'
  }
  if (normalized === 'video' || normalized.startsWith('fileidmp4')) {
    return 'video'
  }
  if (normalized === 'csv' || normalized.startsWith('fileidcsv')) {
    return 'csv'
  }
  if (normalized.startsWith('fileidmd') || normalized.startsWith('fileidtxt') || normalized.startsWith('fileidjson') || normalized.startsWith('fileidaimd')) {
    return 'text'
  }
  if (normalized.startsWith('fileidpdf') || normalized.startsWith('fileiddocx') || normalized.startsWith('fileidxlsx') || normalized.startsWith('fileidpptx')) {
    return 'document'
  }
  const typeExtension = getAimdFileExtensionFromTypeName(normalized)
  const typeExtensionKind = getAimdFileKindFromExtension(typeExtension)
  if (typeExtensionKind) {
    return typeExtensionKind
  }
  if (normalized === 'file' || normalized === 'upload' || normalized.startsWith('fileid')) {
    return 'file'
  }
  return getAimdFileKindFromExtension(getAimdConfiguredFileExtension(kwargs, fieldMeta))
}

export function isKnownAimdFileTypeName(normalized: string | undefined): boolean {
  if (!normalized) {
    return false
  }
  return Boolean(AIMD_FILE_INPUT_CONFIG_BY_TYPE[normalized])
    || normalized.startsWith('fileid')
}

export function getAimdFileInputConfig(
  type: string | undefined,
  kwargs?: Record<string, unknown>,
  fieldMeta?: AimdFileInputMetadata,
): AimdFileInputConfig {
  const normalizedInputType = normalizeAimdOptionalTypeName(fieldMeta?.inputType)
  const normalized = isKnownAimdFileTypeName(normalizedInputType)
    ? normalizedInputType
    : normalizeAimdTypeName(type)
  const configuredExtension = getAimdConfiguredFileExtension(kwargs, fieldMeta)
  const configuredAccept = normalizeAimdString(fieldMeta?.accept)
    ?? getAimdStringFromRecord(kwargs, ['accept', 'file_accept', 'fileAccept'])
  const base = AIMD_FILE_INPUT_CONFIG_BY_TYPE[normalized]
  const typeExtension = getAimdFileExtensionFromTypeName(normalized)

  if (configuredExtension) {
    const kind = getAimdFileKindFromExtension(configuredExtension) ?? 'file'
    return {
      kind,
      accept: configuredAccept ?? getAimdAcceptFromExtension(configuredExtension),
      badge: base?.badge ?? AIMD_FILE_BADGE_BY_KIND[kind],
    }
  }

  if (base) {
    return {
      ...base,
      accept: configuredAccept ?? base.accept,
    }
  }

  if (typeExtension) {
    const kind = getAimdFileKindFromExtension(typeExtension) ?? 'file'
    return {
      kind,
      accept: configuredAccept ?? getAimdAcceptFromExtension(typeExtension),
      badge: AIMD_FILE_BADGE_BY_KIND[kind],
    }
  }

  return {
    kind: 'file',
    accept: configuredAccept,
    badge: AIMD_FILE_BADGE_BY_KIND.file,
  }
}

export function isAimdFileLikeType(
  type: string | undefined,
  kwargs?: Record<string, unknown>,
  fieldMeta?: AimdFileInputMetadata,
): boolean {
  const normalized = normalizeAimdTypeName(type)
  const normalizedInputType = normalizeAimdOptionalTypeName(fieldMeta?.inputType)
  return isKnownAimdFileTypeName(normalized)
    || isKnownAimdFileTypeName(normalizedInputType)
    || Boolean(getAimdConfiguredFileExtension(kwargs, fieldMeta))
    || Boolean(normalizeAimdString(fieldMeta?.accept))
}

export function getAimdFileValueId(
  value: unknown,
  keys: readonly string[] = AIMD_FILE_ID_VALUE_KEYS,
): string | undefined {
  const normalized = unwrapAimdStructuredValue(value)
  if (typeof normalized === 'string') {
    return normalized.trim() || undefined
  }
  if (!isAimdPlainRecord(normalized)) {
    return undefined
  }
  return getAimdStringFromRecord(normalized, keys)
}

export function isAimdAiralogyFileId(value: unknown): value is string {
  return typeof value === 'string' && AIMD_AIRALOGY_FILE_ID_RE.test(value)
}

export function getAimdFileDisplayName(
  value: unknown,
  asset?: AimdAssetLike | null,
  options: { hideAiralogyFileIds?: boolean, keys?: readonly string[] } = {},
): string {
  const assetName = normalizeAimdString(asset?.name ?? asset?.filename ?? asset?.downloadName)
  if (assetName) {
    return assetName
  }
  const normalized = unwrapAimdStructuredValue(value)
  if (typeof normalized === 'string') {
    if (options.hideAiralogyFileIds && isAimdAiralogyFileId(normalized)) {
      return ''
    }
    return normalized
  }
  if (!isAimdPlainRecord(normalized)) {
    return ''
  }
  return getAimdStringFromRecord(normalized, options.keys ?? [
    'name',
    'fileName',
    'file_name',
    'filename',
    'originalName',
    'original_name',
    'id',
    'file_id',
    'blob_id',
    'src',
    'url',
  ]) ?? ''
}

export function inferAimdAssetKind(
  asset: AimdAssetLike | null | undefined,
  value: unknown,
  type: unknown,
  kwargs?: Record<string, unknown>,
  fieldMeta?: AimdFileInputMetadata,
): AimdAssetKind {
  return asset?.kind
    ?? getAimdFileKindFromMimeType(asset?.mimeType)
    ?? getAimdFileKindFromType(type, kwargs, fieldMeta)
    ?? getAimdFileKindFromExtension(getAimdFileExtension(asset?.filename ?? asset?.name ?? asset?.downloadName))
    ?? getAimdFileKindFromExtension(getAimdFileExtension(getAimdFileValueId(value, AIMD_FILE_REFERENCE_VALUE_KEYS)))
    ?? 'file'
}

export function isAimdEmbeddableAssetUrl(value: string | undefined): boolean {
  return Boolean(value && /^(blob:|data:|https?:|file:|\/|\.\/|\.\.\/)/i.test(value))
}

export function getAimdAssetMediaSource(asset: AimdAssetLike | null | undefined): string | undefined {
  if (asset?.url) {
    return asset.url
  }
  return isAimdEmbeddableAssetUrl(asset?.href) ? asset?.href : undefined
}

export function isAimdMarkdownType(type: unknown, kwargs?: Record<string, unknown>, fieldMeta?: AimdFileInputMetadata): boolean {
  const normalized = normalizeAimdOptionalTypeName(fieldMeta?.inputType ?? kwargs?.input_type ?? kwargs?.inputType) || normalizeAimdOptionalTypeName(type)
  return normalized === 'md' || normalized === 'markdown' || normalized === 'airalogymarkdown'
}

export function isAimdCodeType(type: unknown, kwargs?: Record<string, unknown>, fieldMeta?: AimdFileInputMetadata): boolean {
  const normalized = normalizeAimdOptionalTypeName(fieldMeta?.inputType ?? kwargs?.input_type ?? kwargs?.inputType) || normalizeAimdOptionalTypeName(type)
  return normalized === 'code' || normalized === 'codestr' || normalized === 'pystr' || normalized === 'pythoncode' || normalized === 'javascriptcode'
}

export function isAimdDnaType(type: unknown, kwargs?: Record<string, unknown>, fieldMeta?: AimdFileInputMetadata): boolean {
  const normalized = normalizeAimdOptionalTypeName(fieldMeta?.inputType ?? kwargs?.input_type ?? kwargs?.inputType) || normalizeAimdOptionalTypeName(type)
  return normalized === 'dna' || normalized === 'dnasequence'
}

export function isAimdBooleanType(type: unknown, kwargs?: Record<string, unknown>, fieldMeta?: AimdFileInputMetadata): boolean {
  const normalized = normalizeAimdOptionalTypeName(fieldMeta?.inputType ?? kwargs?.input_type ?? kwargs?.inputType) || normalizeAimdOptionalTypeName(type)
  return normalized === 'bool' || normalized === 'boolean' || normalized === 'checkbox'
}
