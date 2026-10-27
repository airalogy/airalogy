import { createRecordsAiraArchive, type AiralogyRecordPayload, type CreateProtocolAiraArchiveFile, type CreateRecordsAiraArchiveFile } from '@airalogy/aira-core'
import { prepareAimdForFormalOutput } from '@airalogy/aimd-editor/authoring'
import { isAimdNullableType } from '@airalogy/aimd-core/utils'
import { parseAndExtract } from '@airalogy/aimd-renderer'
import { validateAimdRecord, type ValidateAimdRecordOptions } from '@airalogy/aimd-recorder/record'
import type { AimdProtocolRecordData } from '@airalogy/aimd-recorder'

export interface EditorProtocolIdentity {
  id: string
  version?: string | null
  fingerprint?: string
}

export interface EditorRecordIdentity {
  id: string
  version: number
  signature?: string
  payload?: AiralogyRecordPayload
}

export interface EditorRecordFile {
  id: string
  name: string
  type: string
  fieldPath?: string
  blob?: Blob
  sourceUri?: string
}

/** Stable JSON for snapshots; undefined object properties represent untouched inputs. */
export function stableRecordJson(value: unknown): string {
  const ancestors = new Set<object>()
  function normalize(item: unknown): unknown {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item
    if (typeof item === 'number' && Number.isFinite(item)) return item
    if (typeof item !== 'object' || ancestors.has(item)
      || (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null)) {
      throw new Error('Only finite JSON values can be saved in a record.')
    }
    ancestors.add(item)
    const result = Array.isArray(item) ? item.map(normalize) : Object.fromEntries(Object.keys(item).sort()
      .filter(key => (item as Record<string, unknown>)[key] !== undefined)
      .map(key => [key, normalize((item as Record<string, unknown>)[key])]))
    ancestors.delete(item)
    return result
  }
  return JSON.stringify(normalize(value))
}

async function digest(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function protocolFingerprint(aimd: string, files: CreateProtocolAiraArchiveFile[]): Promise<string> {
  const hashes: Array<[string, string]> = []
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const data = file.data
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data)
      : data instanceof Blob ? new Uint8Array(await data.arrayBuffer())
        : data instanceof ArrayBuffer ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    hashes.push([file.path, await digest(bytes)])
  }
  return digest(new TextEncoder().encode(stableRecordJson({ aimd, files: hashes })))
}

export function recordSignature(data: AimdProtocolRecordData, fingerprint: string): string {
  return stableRecordJson({ data, protocol: fingerprint })
}

export async function prepareEditorProtocolSnapshot(aimd: string, files: CreateProtocolAiraArchiveFile[], identity: EditorProtocolIdentity) {
  if (!aimd.trim()) throw new Error('A protocol template is required.')
  const formalized = prepareAimdForFormalOutput(aimd)
  const fingerprint = await protocolFingerprint(formalized.content, files)
  const protocol: EditorProtocolIdentity = {
    id: identity.id,
    version: identity.fingerprint === fingerprint && identity.version ? identity.version : `local-${fingerprint}`,
    fingerprint,
  }
  return { formalized, protocol }
}

export async function createEditorRecordDownload(options: {
  aimd: string
  data: AimdProtocolRecordData
  protocol: EditorProtocolIdentity
  protocolName: string
  files: CreateProtocolAiraArchiveFile[]
  recordFiles: EditorRecordFile[]
  identity?: EditorRecordIdentity | null
  messages: ValidateAimdRecordOptions['messages']
  now?: string
}) {
  const { formalized, protocol } = await prepareEditorProtocolSnapshot(options.aimd, options.files, options.protocol)
  const fields = parseAndExtract(formalized.content)
  const data = JSON.parse(stableRecordJson(options.data)) as AimdProtocolRecordData
  for (const field of fields.var_definitions ?? []) {
    if (data.var[field.id] !== undefined) continue
    if (Object.prototype.hasOwnProperty.call(field, 'default')) data.var[field.id] = field.default
    else if (isAimdNullableType(field.type)) data.var[field.id] = null
  }
  const validation = validateAimdRecord(fields, data, { messages: options.messages })
  if (!validation.valid) throw new Error(validation.issues.map(issue => issue.message).join('\n'))
  const signature = recordSignature(data, protocol.fingerprint!)
  const previous = options.identity
  const changed = previous?.signature !== signature
  const id = previous?.id ?? crypto.randomUUID()
  const version = previous ? previous.version + (changed ? 1 : 0) : 1
  const now = options.now ?? new Date().toISOString()
  const payload: AiralogyRecordPayload = {
    ...previous?.payload,
    format: 'airalogy.record', schema_version: 1, record_id: id, record_version: version,
    metadata: { ...previous?.payload?.metadata, protocol_id: protocol.id, protocol_version: protocol.version,
      created_at: previous?.payload?.metadata?.created_at ?? now,
      updated_at: changed ? now : previous?.payload?.metadata?.updated_at ?? now },
    data: { ...previous?.payload?.data, ...data },
  }
  const referenced = new Set<string>()
  function collect(value: unknown) {
    if (typeof value === 'string') referenced.add(value)
    else if (value && typeof value === 'object') {
      if ((value as { format?: string }).format === 'airalogy_selected_file_v1') {
        throw new Error('Reselect the attachment to include its file contents in the record.')
      }
      for (const child of Object.values(value)) collect(child)
    }
  }
  collect(payload.data)
  const attachments: CreateRecordsAiraArchiveFile[] = options.recordFiles.filter(file => referenced.has(file.id)).map(file => ({
    file_id: file.id, filename: file.name, mime_type: file.type,
    ...(file.fieldPath ? { field_path: file.fieldPath } : {}),
    ...(file.sourceUri ? { source_uri: file.sourceUri } : {}),
    ...(file.blob ? { data: file.blob } : {}),
  }))
  for (const ref of referenced) {
    if (ref.startsWith('airalogy.id.file.') && !attachments.some(file => file.file_id === ref)) {
      attachments.push({ file_id: ref })
    }
  }
  const bytes = await createRecordsAiraArchive({ aimd: formalized.content,
    protocol: { protocol_id: protocol.id, protocol_version: protocol.version, protocol_name: options.protocolName },
    files: options.files, records: [{ record: payload, files: attachments }], createdAt: now })
  return { bytes, aimd: formalized.content, data, protocol,
    identity: { id, version, signature, payload } satisfies EditorRecordIdentity,
    generatedFigureIds: formalized.generated.map(figure => figure.id),
    externalFileCount: attachments.filter(file => file.data === undefined).length,
    filename: `record-${id.replace(/[^A-Za-z0-9._-]/g, '_')}-v${version}.aira` }
}
