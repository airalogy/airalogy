export const AIRA_MANIFEST_PATH = '_airalogy_archive/manifest.json'
export const AIRA_ARCHIVE_FORMAT = 'airalogy.archive'
export const AIRALOGY_RECORD_FORMAT = 'airalogy.record'
export const AIRALOGY_RECORD_SCHEMA_VERSION = 1

export type AiraArchiveKind = 'protocol' | 'protocols' | 'records'

export interface AiraEntry {
  name: string
  compressedSize: number
  uncompressedSize: number
  compressionMethod: number
  localHeaderOffset: number
}

export interface AiraProtocolManifest {
  protocol_id?: string | null
  protocol_version?: string | null
  protocol_name?: string | null
  entrypoint?: string
  archive_root?: string
  files?: string[]
  file_hashes?: Record<string, string>
}

export interface AiraRecordManifest {
  path: string
  record_id?: string | null
  record_version?: string | number | null
  protocol_id?: string | null
  protocol_version?: string | null
  sha1?: string | null
  sha256?: string | null
  source_path?: string
  source_index?: number
  embedded_protocol_root?: string | null
}

export interface AiralogyRecordPayload {
  format?: string
  schema_version?: number
  airalogy_record_id?: string | null
  record_id?: string | null
  record_version?: number | null
  metadata?: Record<string, unknown> | null
  data?: {
    var?: Record<string, unknown>
    step?: Record<string, unknown>
    check?: Record<string, unknown>
    quiz?: Record<string, unknown>
    [key: string]: unknown
  }
  files?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export interface AiraBlobManifest {
  blob_id: string
  archive_path: string
  sha256: string
  size?: number
}

export interface AiraFileManifest {
  file_id?: string | null
  source_uri?: string | null
  blob_id?: string | null
  filename?: string | null
  mime_type?: string | null
  size?: number | null
  record_path?: string | null
  field_path?: string | null
}

export interface AiraManifest {
  format: string
  version: number
  kind: AiraArchiveKind
  created_at?: string
  protocol?: AiraProtocolManifest
  records?: AiraRecordManifest[]
  protocols?: AiraProtocolManifest[]
  blobs?: AiraBlobManifest[]
  files?: AiraFileManifest[]
  [key: string]: unknown
}

export interface AiraSummary {
  format: string
  version: number
  kind: AiraArchiveKind
  createdAt?: string
  memberCount: number
  recordCount: number
  protocolCount: number
  blobCount: number
  fileCount: number
}

export interface AiraValidationResult {
  ok: boolean
  issues: string[]
}

export type AiraArchiveEntryData = string | Blob | ArrayBuffer | ArrayBufferView

export interface CreateProtocolAiraArchiveFile {
  path: string
  data: AiraArchiveEntryData
}

export interface CreateProtocolAiraArchiveOptions {
  aimd: string
  protocol?: Pick<AiraProtocolManifest, 'protocol_id' | 'protocol_version' | 'protocol_name' | 'entrypoint'>
  files?: CreateProtocolAiraArchiveFile[]
  createdAt?: string
}

type ZipEntryInternal = AiraEntry & {
  compressedDataStart: number
}

type ZipEntryPayload = {
  name: string
  bytes: Uint8Array
}

type ZipEntryPrepared = ZipEntryPayload & {
  crc32: number
  localHeaderOffset: number
}

const textDecoder = new TextDecoder('utf-8')
const textEncoder = new TextEncoder()
const sha256Pattern = /^[0-9a-f]{64}$/
const ZIP_STORED_METHOD = 0
const ZIP_UTF8_FLAG = 0x0800
const ZIP_UINT32_MAX = 0xffffffff

function getUint16(view: DataView, offset: number): number {
  return view.getUint16(offset, true)
}

function getUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true)
}

function decodeName(bytes: Uint8Array): string {
  return textDecoder.decode(bytes)
}

function validateMemberPath(name: string): string | null {
  if (!name || name.startsWith('/')) {
    return `Archive member '${name}' uses an absolute or empty path.`
  }
  if (name.split('/').some(part => part === '..')) {
    return `Archive member '${name}' escapes the archive root.`
  }
  return null
}

function normalizeArchiveMemberPath(path: string, label: string): string {
  const normalized = path
    .replace(/\\/g, '/')
    .split('/')
    .filter(part => part && part !== '.')
    .join('/')
  const issue = validateMemberPath(normalized)
  if (issue || path.startsWith('/') || path.replace(/\\/g, '/').split('/').some(part => part === '..')) {
    throw new Error(issue ?? `${label} '${path}' is not a safe relative archive path.`)
  }
  if (normalized === AIRA_MANIFEST_PATH || normalized.startsWith('_airalogy_archive/')) {
    throw new Error(`${label} '${path}' conflicts with Airalogy archive metadata.`)
  }
  return normalized
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validateRecordPayload(record: unknown, label: string): string[] {
  const issues: string[] = []
  if (!isPlainObject(record)) {
    return [`${label} must be a JSON object.`]
  }

  if (record.format !== undefined && record.format !== AIRALOGY_RECORD_FORMAT) {
    issues.push(`${label} format must be '${AIRALOGY_RECORD_FORMAT}' when present.`)
  }
  if (
    record.schema_version !== undefined
    && record.schema_version !== AIRALOGY_RECORD_SCHEMA_VERSION
  ) {
    issues.push(`${label} schema_version must be ${AIRALOGY_RECORD_SCHEMA_VERSION} when present.`)
  }
  if (
    record.record_id !== undefined
    && record.record_id !== null
    && (typeof record.record_id !== 'string' || record.record_id.length === 0)
  ) {
    issues.push(`${label} record_id must be a non-empty string when present.`)
  }
  if (
    record.airalogy_record_id !== undefined
    && record.airalogy_record_id !== null
    && (typeof record.airalogy_record_id !== 'string' || record.airalogy_record_id.length === 0)
  ) {
    issues.push(`${label} airalogy_record_id must be a non-empty string when present.`)
  }
  const recordVersion = record.record_version
  if (
    recordVersion !== undefined
    && recordVersion !== null
    && (typeof recordVersion !== 'number' || !Number.isInteger(recordVersion) || recordVersion < 1)
  ) {
    issues.push(`${label} record_version must be a positive integer when present.`)
  }
  if (
    record.metadata !== undefined
    && record.metadata !== null
    && !isPlainObject(record.metadata)
  ) {
    issues.push(`${label} metadata must be an object when present.`)
  }

  if (!isPlainObject(record.data)) {
    issues.push(`${label} data must be an object.`)
    return issues
  }
  if (!isPlainObject(record.data.var)) {
    issues.push(`${label} data.var must be an object.`)
  }
  for (const section of ['step', 'check', 'quiz']) {
    const value = record.data[section]
    if (value !== undefined && value !== null && !isPlainObject(value)) {
      issues.push(`${label} data.${section} must be an object when present.`)
    }
  }

  if (record.files !== undefined) {
    if (!Array.isArray(record.files)) {
      issues.push(`${label} files must be a list when present.`)
    }
    else {
      for (const [index, fileRef] of record.files.entries()) {
        if (!isPlainObject(fileRef)) {
          issues.push(`${label} files[${index + 1}] must be an object.`)
          continue
        }
        if (!['file_id', 'source_uri', 'blob_id'].some(key => typeof fileRef[key] === 'string' && fileRef[key])) {
          issues.push(`${label} files[${index + 1}] must include file_id, source_uri, or blob_id.`)
        }
      }
    }
  }
  return issues
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const minOffset = Math.max(0, bytes.length - 0xffff - 22)
  for (let offset = bytes.length - 22; offset >= minOffset; offset -= 1) {
    if (
      bytes[offset] === 0x50
      && bytes[offset + 1] === 0x4b
      && bytes[offset + 2] === 0x05
      && bytes[offset + 3] === 0x06
    ) {
      return offset
    }
  }
  throw new Error('Archive is not a valid zip file: EOCD not found.')
}

function parseZipEntries(bytes: Uint8Array): ZipEntryInternal[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocdOffset = findEndOfCentralDirectory(bytes)
  const entryCount = getUint16(view, eocdOffset + 10)
  const centralDirectoryOffset = getUint32(view, eocdOffset + 16)
  const entries: ZipEntryInternal[] = []
  let offset = centralDirectoryOffset

  for (let index = 0; index < entryCount; index += 1) {
    if (getUint32(view, offset) !== 0x02014b50) {
      throw new Error(`Archive central directory is invalid at offset ${offset}.`)
    }
    const compressionMethod = getUint16(view, offset + 10)
    const compressedSize = getUint32(view, offset + 20)
    const uncompressedSize = getUint32(view, offset + 24)
    const fileNameLength = getUint16(view, offset + 28)
    const extraLength = getUint16(view, offset + 30)
    const commentLength = getUint16(view, offset + 32)
    const localHeaderOffset = getUint32(view, offset + 42)
    const fileNameStart = offset + 46
    const name = decodeName(bytes.slice(fileNameStart, fileNameStart + fileNameLength))

    if (getUint32(view, localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Archive local header is invalid for '${name}'.`)
    }
    const localNameLength = getUint16(view, localHeaderOffset + 26)
    const localExtraLength = getUint16(view, localHeaderOffset + 28)
    const compressedDataStart = localHeaderOffset + 30 + localNameLength + localExtraLength

    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      compressedDataStart,
    })

    offset = fileNameStart + fileNameLength + extraLength + commentLength
  }

  return entries.filter(entry => !entry.name.endsWith('/'))
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const DecompressionStreamClass = globalThis.DecompressionStream
  if (!DecompressionStreamClass) {
    throw new Error('This browser does not support DecompressionStream.')
  }

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStreamClass('deflate-raw'))
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')
}

function makeCrc32Table(): Uint32Array {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
}

const crc32Table = makeCrc32Table()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const output = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.byteLength
  }
  return output
}

function dateToDosTimeAndDate(date: Date): { time: number; date: number } {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()))
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = Math.floor(date.getSeconds() / 2)
  return {
    time: (hours << 11) | (minutes << 5) | seconds,
    date: ((year - 1980) << 9) | (month << 5) | day,
  }
}

function assertZipUint32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > ZIP_UINT32_MAX) {
    throw new Error(`${label} exceeds the ZIP32 size limit.`)
  }
}

function writeZipLocalHeader(entry: ZipEntryPrepared, dos: { time: number; date: number }): Uint8Array {
  const nameBytes = textEncoder.encode(entry.name)
  assertZipUint32(entry.bytes.byteLength, `Archive member '${entry.name}'`)
  const header = new Uint8Array(30 + nameBytes.byteLength)
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength)
  view.setUint32(0, 0x04034b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, ZIP_UTF8_FLAG, true)
  view.setUint16(8, ZIP_STORED_METHOD, true)
  view.setUint16(10, dos.time, true)
  view.setUint16(12, dos.date, true)
  view.setUint32(14, entry.crc32, true)
  view.setUint32(18, entry.bytes.byteLength, true)
  view.setUint32(22, entry.bytes.byteLength, true)
  view.setUint16(26, nameBytes.byteLength, true)
  view.setUint16(28, 0, true)
  header.set(nameBytes, 30)
  return header
}

function writeZipCentralDirectoryEntry(entry: ZipEntryPrepared, dos: { time: number; date: number }): Uint8Array {
  const nameBytes = textEncoder.encode(entry.name)
  const header = new Uint8Array(46 + nameBytes.byteLength)
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength)
  view.setUint32(0, 0x02014b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 20, true)
  view.setUint16(8, ZIP_UTF8_FLAG, true)
  view.setUint16(10, ZIP_STORED_METHOD, true)
  view.setUint16(12, dos.time, true)
  view.setUint16(14, dos.date, true)
  view.setUint32(16, entry.crc32, true)
  view.setUint32(20, entry.bytes.byteLength, true)
  view.setUint32(24, entry.bytes.byteLength, true)
  view.setUint16(28, nameBytes.byteLength, true)
  view.setUint16(30, 0, true)
  view.setUint16(32, 0, true)
  view.setUint16(34, 0, true)
  view.setUint16(36, 0, true)
  view.setUint32(38, 0, true)
  view.setUint32(42, entry.localHeaderOffset, true)
  header.set(nameBytes, 46)
  return header
}

function writeZipEndOfCentralDirectory(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number): Uint8Array {
  assertZipUint32(entryCount, 'Archive entry count')
  assertZipUint32(centralDirectorySize, 'Central directory')
  assertZipUint32(centralDirectoryOffset, 'Central directory offset')
  if (entryCount > 0xffff) {
    throw new Error('Archive entry count exceeds the ZIP32 entry limit.')
  }
  const end = new Uint8Array(22)
  const view = new DataView(end.buffer)
  view.setUint32(0, 0x06054b50, true)
  view.setUint16(4, 0, true)
  view.setUint16(6, 0, true)
  view.setUint16(8, entryCount, true)
  view.setUint16(10, entryCount, true)
  view.setUint32(12, centralDirectorySize, true)
  view.setUint32(16, centralDirectoryOffset, true)
  view.setUint16(20, 0, true)
  return end
}

function createStoredZip(entries: ZipEntryPayload[], date = new Date()): Uint8Array {
  const dos = dateToDosTimeAndDate(date)
  const preparedEntries: ZipEntryPrepared[] = []
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const prepared: ZipEntryPrepared = {
      ...entry,
      crc32: crc32(entry.bytes),
      localHeaderOffset: offset,
    }
    const localHeader = writeZipLocalHeader(prepared, dos)
    localParts.push(localHeader, prepared.bytes)
    offset += localHeader.byteLength + prepared.bytes.byteLength
    assertZipUint32(offset, 'Archive size')
    preparedEntries.push(prepared)
  }

  const centralDirectoryOffset = offset
  for (const entry of preparedEntries) {
    const central = writeZipCentralDirectoryEntry(entry, dos)
    centralParts.push(central)
    offset += central.byteLength
    assertZipUint32(offset, 'Archive size')
  }

  const centralDirectorySize = offset - centralDirectoryOffset
  return concatBytes([
    ...localParts,
    ...centralParts,
    writeZipEndOfCentralDirectory(preparedEntries.length, centralDirectorySize, centralDirectoryOffset),
  ])
}

async function toArchiveBytes(data: AiraArchiveEntryData): Promise<Uint8Array> {
  if (typeof data === 'string') {
    return textEncoder.encode(data)
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return new Uint8Array(await data.arrayBuffer())
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data)
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  }
  throw new Error('Archive entry data must be a string, Blob, ArrayBuffer, or ArrayBufferView.')
}

function inferProtocolNameFromAimd(aimd: string): string | null {
  for (const line of aimd.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('# ')) {
      return trimmed.slice(2).trim() || null
    }
  }
  return null
}

export async function createProtocolAiraArchive(options: CreateProtocolAiraArchiveOptions): Promise<Uint8Array> {
  const entrypoint = normalizeArchiveMemberPath(options.protocol?.entrypoint ?? 'protocol.aimd', 'Protocol entrypoint')
  const entries = new Map<string, Uint8Array>()
  entries.set(entrypoint, textEncoder.encode(options.aimd))

  for (const file of options.files ?? []) {
    const path = normalizeArchiveMemberPath(file.path, 'Protocol file')
    if (path === entrypoint || entries.has(path)) {
      throw new Error(`Protocol archive contains duplicate file path '${path}'.`)
    }
    entries.set(path, await toArchiveBytes(file.data))
  }

  const fileNames = Array.from(entries.keys())
  const fileHashes: Record<string, string> = {}
  for (const [path, bytes] of entries) {
    fileHashes[path] = await sha256Hex(bytes)
  }

  const manifest: AiraManifest = {
    format: AIRA_ARCHIVE_FORMAT,
    version: 1,
    kind: 'protocol',
    created_at: options.createdAt ?? new Date().toISOString(),
    protocol: {
      protocol_id: options.protocol?.protocol_id ?? null,
      protocol_version: options.protocol?.protocol_version ?? null,
      protocol_name: options.protocol?.protocol_name ?? inferProtocolNameFromAimd(options.aimd) ?? null,
      entrypoint,
      files: fileNames,
      file_hashes: fileHashes,
    },
  }

  const archiveEntries: ZipEntryPayload[] = [
    {
      name: AIRA_MANIFEST_PATH,
      bytes: textEncoder.encode(`${JSON.stringify(manifest, null, 2)}\n`),
    },
    ...fileNames.map(name => ({ name, bytes: entries.get(name)! })),
  ]
  return createStoredZip(archiveEntries)
}

export class AiraArchive {
  readonly bytes: Uint8Array
  readonly entries: AiraEntry[]
  readonly manifest: AiraManifest

  private readonly entryMap: Map<string, ZipEntryInternal>

  private constructor(bytes: Uint8Array, entries: ZipEntryInternal[], manifest: AiraManifest) {
    this.bytes = bytes
    this.entries = entries.map(({ compressedDataStart: _compressedDataStart, ...entry }) => entry)
    this.entryMap = new Map(entries.map(entry => [entry.name, entry]))
    this.manifest = manifest
  }

  static async open(input: ArrayBuffer | Blob | Uint8Array): Promise<AiraArchive> {
    const bytes = input instanceof Uint8Array
      ? input
      : input instanceof Blob
        ? new Uint8Array(await input.arrayBuffer())
        : new Uint8Array(input)
    const entries = parseZipEntries(bytes)
    const manifestEntry = entries.find(entry => entry.name === AIRA_MANIFEST_PATH)
    if (!manifestEntry) {
      throw new Error(`Archive does not contain '${AIRA_MANIFEST_PATH}'.`)
    }
    const archive = new AiraArchive(bytes, entries, {
      format: AIRA_ARCHIVE_FORMAT,
      version: 0,
      kind: 'records',
    })
    const manifest = await archive.readJson<AiraManifest>(AIRA_MANIFEST_PATH)
    if (manifest.format !== AIRA_ARCHIVE_FORMAT) {
      throw new Error(`Unsupported archive format '${String(manifest.format)}'.`)
    }
    if (manifest.kind !== 'protocol' && manifest.kind !== 'protocols' && manifest.kind !== 'records') {
      throw new Error(`Unsupported archive kind '${String(manifest.kind)}'.`)
    }
    return new AiraArchive(bytes, entries, manifest)
  }

  has(path: string): boolean {
    return this.entryMap.has(path)
  }

  summary(): AiraSummary {
    const records = Array.isArray(this.manifest.records) ? this.manifest.records.length : 0
    const protocols = this.manifest.kind === 'protocol'
      ? 1
      : Array.isArray(this.manifest.protocols) ? this.manifest.protocols.length : 0
    const blobs = Array.isArray(this.manifest.blobs) ? this.manifest.blobs.length : 0
    const files = Array.isArray(this.manifest.files) ? this.manifest.files.length : 0
    return {
      format: this.manifest.format,
      version: this.manifest.version,
      kind: this.manifest.kind,
      createdAt: this.manifest.created_at,
      memberCount: this.entries.length,
      recordCount: records,
      protocolCount: protocols,
      blobCount: blobs,
      fileCount: files,
    }
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const entry = this.entryMap.get(path)
    if (!entry) {
      throw new Error(`Archive member '${path}' not found.`)
    }
    const compressed = this.bytes.slice(
      entry.compressedDataStart,
      entry.compressedDataStart + entry.compressedSize,
    )
    if (entry.compressionMethod === 0) {
      return compressed
    }
    if (entry.compressionMethod === 8) {
      return inflateRaw(compressed)
    }
    throw new Error(`Archive member '${path}' uses unsupported compression method ${entry.compressionMethod}.`)
  }

  async readText(path: string): Promise<string> {
    return textDecoder.decode(await this.readBytes(path))
  }

  async readJson<T = unknown>(path: string): Promise<T> {
    return JSON.parse(await this.readText(path)) as T
  }

  async validate(): Promise<AiraValidationResult> {
    const issues: string[] = []
    const entryNames = new Set(this.entries.map(entry => entry.name))
    for (const entry of this.entries) {
      const issue = validateMemberPath(entry.name)
      if (issue) {
        issues.push(issue)
      }
    }
    if (!entryNames.has(AIRA_MANIFEST_PATH)) {
      issues.push(`Archive is missing '${AIRA_MANIFEST_PATH}'.`)
    }
    if (this.manifest.format !== AIRA_ARCHIVE_FORMAT) {
      issues.push(`Unsupported archive format '${String(this.manifest.format)}'.`)
    }
    if (this.manifest.version !== 1) {
      issues.push(`Unsupported archive version '${String(this.manifest.version)}'.`)
    }

    if (this.manifest.kind === 'protocol') {
      await this.validateProtocol(this.manifest.protocol, '', issues)
    }
    else if (this.manifest.kind === 'protocols') {
      await this.validateProtocolList(this.manifest.protocols, issues, true)
    }
    else if (this.manifest.kind === 'records') {
      await this.validateRecords(issues)
    }
    else {
      issues.push(`Unsupported archive kind '${String(this.manifest.kind)}'.`)
    }

    return { ok: issues.length === 0, issues }
  }

  private async validateProtocol(protocol: AiraProtocolManifest | undefined, prefix: string, issues: string[]): Promise<void> {
    if (!protocol || typeof protocol !== 'object') {
      issues.push('Protocol manifest entry must be an object.')
      return
    }
    const entrypoint = protocol.entrypoint || 'protocol.aimd'
    const entrypointPath = `${prefix}${entrypoint}`
    if (!this.has(entrypointPath)) {
      issues.push(`Protocol entrypoint '${entrypointPath}' is missing.`)
    }
    const files = Array.isArray(protocol.files) ? protocol.files : []
    const fileHashes = protocol.file_hashes && typeof protocol.file_hashes === 'object'
      ? protocol.file_hashes
      : {}
    for (const file of files) {
      const path = `${prefix}${file}`
      const pathIssue = validateMemberPath(path)
      if (pathIssue) {
        issues.push(pathIssue)
        continue
      }
      if (!this.has(path)) {
        issues.push(`Protocol file '${path}' is missing.`)
        continue
      }
      const expectedHash = fileHashes[file]
      if (expectedHash) {
        const actualHash = await sha256Hex(await this.readBytes(path))
        if (actualHash !== expectedHash) {
          issues.push(`Protocol file '${path}' sha256 mismatch: expected ${expectedHash}, got ${actualHash}.`)
        }
      }
    }
  }

  private async validateProtocolList(
    protocols: AiraProtocolManifest[] | undefined,
    issues: string[],
    requireNonEmpty = false,
  ): Promise<Set<string>> {
    const protocolRoots = new Set<string>()
    if (!Array.isArray(protocols)) {
      issues.push('Protocols manifest field must be a list.')
      return protocolRoots
    }
    if (requireNonEmpty && protocols.length === 0) {
      issues.push('Protocols manifest field must include at least one protocol.')
    }
    for (const [index, protocol] of protocols.entries()) {
      if (!protocol || typeof protocol !== 'object') {
        issues.push(`Protocol manifest entry #${index + 1} must be an object.`)
        continue
      }
      if (!protocol.archive_root) {
        issues.push(`Protocol manifest entry #${index + 1} is missing archive_root.`)
        continue
      }
      if (protocolRoots.has(protocol.archive_root)) {
        issues.push(`Protocol manifest entry #${index + 1} uses duplicate archive_root '${protocol.archive_root}'.`)
        continue
      }
      protocolRoots.add(protocol.archive_root)
      await this.validateProtocol(protocol, `${protocol.archive_root.replace(/\/+$/, '')}/`, issues)
    }
    return protocolRoots
  }

  private async validateRecords(issues: string[]): Promise<void> {
    const records = Array.isArray(this.manifest.records) ? this.manifest.records : []
    const protocolRoots = await this.validateProtocolList(this.manifest.protocols, issues)
    const recordPaths = new Set<string>()

    for (const [index, record] of records.entries()) {
      if (!record || typeof record !== 'object') {
        issues.push(`Record manifest entry #${index + 1} must be an object.`)
        continue
      }
      const path = record.path
      if (!path) {
        issues.push(`Record manifest entry #${index + 1} is missing a path.`)
        continue
      }
      const pathIssue = validateMemberPath(path)
      if (pathIssue) {
        issues.push(pathIssue)
        continue
      }
      if (!this.has(path)) {
        issues.push(`Record file '${path}' is missing.`)
        continue
      }
      recordPaths.add(path)
      let raw: Uint8Array
      let parsedRecord: unknown
      try {
        raw = await this.readBytes(path)
        parsedRecord = JSON.parse(textDecoder.decode(raw))
      }
      catch {
        issues.push(`Record file '${path}' is not valid UTF-8 JSON.`)
        continue
      }
      issues.push(...validateRecordPayload(parsedRecord, `Record file '${path}'`))
      if (record.sha256) {
        const actualHash = await sha256Hex(raw)
        if (actualHash !== record.sha256) {
          issues.push(`Record file '${path}' sha256 mismatch: expected ${record.sha256}, got ${actualHash}.`)
        }
      }
      if (record.embedded_protocol_root && !protocolRoots.has(record.embedded_protocol_root)) {
        issues.push(`Record file '${path}' references missing embedded protocol root '${record.embedded_protocol_root}'.`)
      }
    }
    const blobIds = await this.validateBlobs(issues)
    this.validateFileReferences(issues, blobIds, recordPaths)
  }

  private async validateBlobs(issues: string[]): Promise<Set<string>> {
    const blobIds = new Set<string>()
    const blobs = this.manifest.blobs
    if (blobs === undefined) {
      return blobIds
    }
    if (!Array.isArray(blobs)) {
      issues.push('Blobs manifest field must be a list.')
      return blobIds
    }

    const archivePaths = new Set<string>()
    for (const [index, blob] of blobs.entries()) {
      if (!blob || typeof blob !== 'object') {
        issues.push(`Blob manifest entry #${index + 1} must be an object.`)
        continue
      }
      const blobId = blob.blob_id
      const archivePath = blob.archive_path
      const expectedHash = blob.sha256

      if (!blobId) {
        issues.push(`Blob manifest entry #${index + 1} is missing blob_id.`)
        continue
      }
      if (blobIds.has(blobId)) {
        issues.push(`Blob manifest entry #${index + 1} uses duplicate blob_id '${blobId}'.`)
        continue
      }
      blobIds.add(blobId)

      if (!expectedHash || !sha256Pattern.test(expectedHash)) {
        issues.push(`Blob '${blobId}' must include a valid sha256 hash.`)
        continue
      }
      const expectedBlobId = `sha256:${expectedHash}`
      if (blobId !== expectedBlobId) {
        issues.push(`Blob '${blobId}' does not match sha256-derived id '${expectedBlobId}'.`)
      }
      if (!archivePath) {
        issues.push(`Blob '${blobId}' is missing archive_path.`)
        continue
      }
      const pathIssue = validateMemberPath(archivePath)
      if (pathIssue) {
        issues.push(pathIssue)
        continue
      }
      if (!archivePath.startsWith('blobs/sha256/')) {
        issues.push(`Blob '${blobId}' archive_path must be under 'blobs/sha256/'.`)
      }
      if (archivePaths.has(archivePath)) {
        issues.push(`Blob '${blobId}' uses duplicate archive_path '${archivePath}'.`)
        continue
      }
      archivePaths.add(archivePath)
      if (!this.has(archivePath)) {
        issues.push(`Blob file '${archivePath}' is missing.`)
        continue
      }
      const raw = await this.readBytes(archivePath)
      const actualHash = await sha256Hex(raw)
      if (actualHash !== expectedHash) {
        issues.push(`Blob file '${archivePath}' sha256 mismatch: expected ${expectedHash}, got ${actualHash}.`)
      }
      if (typeof blob.size === 'number' && blob.size !== raw.byteLength) {
        issues.push(`Blob file '${archivePath}' size mismatch: expected ${blob.size}, got ${raw.byteLength}.`)
      }
      else if (blob.size !== undefined && typeof blob.size !== 'number') {
        issues.push(`Blob '${blobId}' size must be a number when present.`)
      }
    }
    return blobIds
  }

  private validateFileReferences(issues: string[], blobIds: Set<string>, recordPaths: Set<string>): void {
    const files = this.manifest.files
    if (files === undefined) {
      return
    }
    if (!Array.isArray(files)) {
      issues.push('Files manifest field must be a list.')
      return
    }

    for (const [index, fileRef] of files.entries()) {
      if (!fileRef || typeof fileRef !== 'object') {
        issues.push(`File manifest entry #${index + 1} must be an object.`)
        continue
      }
      if (!fileRef.file_id && !fileRef.source_uri && !fileRef.blob_id) {
        issues.push(`File manifest entry #${index + 1} must include file_id, source_uri, or blob_id.`)
      }
      if (fileRef.blob_id && !blobIds.has(fileRef.blob_id)) {
        issues.push(`File manifest entry #${index + 1} references missing blob_id '${fileRef.blob_id}'.`)
      }
      if (fileRef.record_path && !recordPaths.has(fileRef.record_path)) {
        issues.push(`File manifest entry #${index + 1} references missing record_path '${fileRef.record_path}'.`)
      }
      if (fileRef.field_path !== undefined && typeof fileRef.field_path !== 'string') {
        issues.push(`File manifest entry #${index + 1} field_path must be a string.`)
      }
    }
  }
}

export async function openAiraArchive(input: ArrayBuffer | Blob | Uint8Array): Promise<AiraArchive> {
  return AiraArchive.open(input)
}

export async function readAiraArchiveSummary(input: ArrayBuffer | Blob | Uint8Array): Promise<AiraSummary> {
  return (await AiraArchive.open(input)).summary()
}

export function prettyPrintJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function encodeUtf8(value: string): Uint8Array {
  return textEncoder.encode(value)
}
