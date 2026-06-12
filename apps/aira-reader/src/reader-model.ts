import type {
  AiralogyRecordPayload,
  AiraManifest,
  AiraProtocolManifest,
  AiraRecordManifest,
} from '@airalogy/aira-core'

export type ProtocolEntry = {
  protocol: AiraProtocolManifest
  root: string
  path: string
  label: string
}

export type DocumentView = {
  id: string
  kind: 'protocol' | 'record'
  label: string
  subtitle: string
  protocol?: AiraProtocolManifest
  protocolPath: string
  protocolContent: string
  record?: AiraRecordManifest
  recordPayload?: AiralogyRecordPayload | null
  loadError?: string
}

export type RecordSection = {
  key: string
  label: string
  entries: Array<{ key: string, value: unknown }>
}

export type ReadableAiraArchive = {
  manifest: AiraManifest
  readText(path: string): Promise<string>
  readJson<T>(path: string): Promise<T>
}

export const RECORD_SECTION_LABELS: Record<string, string> = {
  var: 'Variables',
  var_table: 'Tables',
  step: 'Steps',
  check: 'Checks',
  quiz: 'Quiz',
}

export function normalizeRecordString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function buildRecordSections(data: AiralogyRecordPayload['data'] | undefined): RecordSection[] {
  if (!isPlainObject(data)) {
    return []
  }
  return Object.entries(RECORD_SECTION_LABELS)
    .map(([key, label]) => {
      const section = data[key]
      const entries = isPlainObject(section)
        ? Object.entries(section).map(([entryKey, value]) => ({ key: entryKey, value }))
        : []
      return { key, label, entries }
    })
    .filter(section => section.entries.length > 0)
}

export function normalizeArchiveRoot(root: string | null | undefined): string {
  return root?.replace(/^\/+|\/+$/g, '') ?? ''
}

export function joinArchivePath(root: string, path: string): string {
  const normalizedPath = path.replace(/^\/+/g, '')
  return root ? `${root}/${normalizedPath}` : normalizedPath
}

export function protocolLabel(protocol: AiraProtocolManifest | undefined, fallback = 'Protocol'): string {
  return protocol?.protocol_name || protocol?.protocol_id || fallback
}

export function recordLabel(record: AiraRecordManifest, payload: AiralogyRecordPayload | null | undefined): string {
  return payload?.record_id || record.record_id || record.path
}

export function collectProtocolEntries(source: AiraManifest): ProtocolEntry[] {
  if (source.kind === 'protocol') {
    if (!source.protocol) {
      return []
    }
    const entrypoint = source.protocol.entrypoint || 'protocol.aimd'
    return [{
      protocol: source.protocol,
      root: '',
      path: entrypoint,
      label: protocolLabel(source.protocol),
    }]
  }
  const protocols: AiraProtocolManifest[] = Array.isArray(source.protocols) ? source.protocols : []
  return protocols.map((protocol, index) => {
    const root = normalizeArchiveRoot(protocol.archive_root)
    const entrypoint = protocol.entrypoint || 'protocol.aimd'
    return {
      protocol,
      root,
      path: joinArchivePath(root, entrypoint),
      label: protocolLabel(protocol, `Protocol ${index + 1}`),
    }
  })
}

export function findProtocolForRecord(record: AiraRecordManifest, entries: ProtocolEntry[]): ProtocolEntry | null {
  const embeddedRoot = normalizeArchiveRoot(record.embedded_protocol_root)
  if (embeddedRoot) {
    const match = entries.find(entry => entry.root === embeddedRoot)
    if (match) {
      return match
    }
  }
  return entries.find(entry =>
    entry.protocol.protocol_id === record.protocol_id
    && entry.protocol.protocol_version === record.protocol_version,
  ) ?? entries.find(entry => entry.protocol.protocol_id === record.protocol_id) ?? null
}

export async function loadProtocolContent(
  opened: Pick<ReadableAiraArchive, 'readText'>,
  entry: ProtocolEntry | null,
): Promise<{ content: string, error?: string }> {
  if (!entry) {
    return { content: '', error: 'This record does not reference a protocol included in the archive.' }
  }
  try {
    return { content: await opened.readText(entry.path) }
  }
  catch (error) {
    return {
      content: '',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function loadRecordPayload(
  opened: Pick<ReadableAiraArchive, 'readJson'>,
  record: AiraRecordManifest,
): Promise<{ payload: AiralogyRecordPayload | null, error?: string }> {
  try {
    return { payload: await opened.readJson<AiralogyRecordPayload>(record.path) }
  }
  catch (error) {
    return {
      payload: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function buildDocumentViews(opened: ReadableAiraArchive): Promise<DocumentView[]> {
  const protocolEntries = collectProtocolEntries(opened.manifest)
  const views: DocumentView[] = []

  if (opened.manifest.kind === 'records') {
    const records = Array.isArray(opened.manifest.records) ? opened.manifest.records : []
    for (const record of records) {
      const protocolEntry = findProtocolForRecord(record, protocolEntries)
      const payloadResult = await loadRecordPayload(opened, record)
      const protocolResult = await loadProtocolContent(opened, protocolEntry)
      const label = recordLabel(record, payloadResult.payload)
      views.push({
        id: `record:${record.path}`,
        kind: 'record',
        label,
        subtitle: `${protocolEntry?.label || record.protocol_id || 'Protocol'} · Record`,
        protocol: protocolEntry?.protocol,
        protocolPath: protocolEntry?.path ?? '',
        protocolContent: protocolResult.content,
        record,
        recordPayload: payloadResult.payload,
        loadError: payloadResult.error || protocolResult.error,
      })
    }
    return views
  }

  for (const [index, protocolEntry] of protocolEntries.entries()) {
    const protocolResult = await loadProtocolContent(opened, protocolEntry)
    views.push({
      id: `protocol:${protocolEntry.path || index}`,
      kind: 'protocol',
      label: protocolEntry.label,
      subtitle: 'Protocol',
      protocol: protocolEntry.protocol,
      protocolPath: protocolEntry.path,
      protocolContent: protocolResult.content,
      loadError: protocolResult.error,
    })
  }

  return views
}
