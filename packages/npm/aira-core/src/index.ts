export const AIRA_MANIFEST_PATH = '_airalogy_archive/manifest.json'
export const AIRA_ARCHIVE_FORMAT = 'airalogy.archive'

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

export interface AiraManifest {
  format: string
  version: number
  kind: AiraArchiveKind
  created_at?: string
  protocol?: AiraProtocolManifest
  records?: AiraRecordManifest[]
  protocols?: AiraProtocolManifest[]
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
}

export interface AiraValidationResult {
  ok: boolean
  issues: string[]
}

type ZipEntryInternal = AiraEntry & {
  compressedDataStart: number
}

const textDecoder = new TextDecoder('utf-8')
const textEncoder = new TextEncoder()

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
    return {
      format: this.manifest.format,
      version: this.manifest.version,
      kind: this.manifest.kind,
      createdAt: this.manifest.created_at,
      memberCount: this.entries.length,
      recordCount: records,
      protocolCount: protocols,
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
      let raw: Uint8Array
      try {
        raw = await this.readBytes(path)
        JSON.parse(textDecoder.decode(raw))
      }
      catch {
        issues.push(`Record file '${path}' is not valid UTF-8 JSON.`)
        continue
      }
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
