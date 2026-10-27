import { describe, expect, it } from 'vitest'
import { openAiraArchive, type AiralogyRecordPayload } from '@airalogy/aira-core'
import { createAimdRecorderMessages } from '../../../../packages/npm/aimd-recorder/src/locales'
import { createEditorRecordDownload, protocolFingerprint } from './editorRecordDownload'
import { createEditorProtocolDownload } from './editorProtocolDownload'

const input = () => ({
  aimd: '# Test\n\n{{var|temperature: float}} {{var|ready: bool | None}} {{var|tags: list[Literal["A", "B"]]}}',
  data: { var: { temperature: 37.5, ready: false, tags: ['B'] }, step: {}, check: {}, quiz: {} },
  protocol: { id: 'p1' }, protocolName: 'Test', files: [], recordFiles: [],
  messages: createAimdRecorderMessages('en-US').validation, now: '2026-10-27T00:00:00Z',
})

describe('editor record export boundary', () => {
  it('exports actual values without changing template defaults, with an embedded protocol snapshot', async () => {
    const options = input()
    const result = await createEditorRecordDownload(options)
    const archive = await openAiraArchive(result.bytes)
    expect((await archive.validate()).ok).toBe(true)
    expect(result.aimd).toBe(options.aimd)
    expect(result.identity.version).toBe(1)
    expect(result.protocol.version).toMatch(/^local-[a-f0-9]{64}$/)
    const record = await archive.readJson<AiralogyRecordPayload>(archive.manifest.records![0].path)
    expect(record.data).toEqual(options.data)
    const template = await createEditorProtocolDownload({ aimd: options.aimd, files: [], protocol: {}, filenameStem: 'template' })
    expect(template.kind).toBe('aimd')
    expect(template.data).not.toContain('37.5')
  })

  it('keeps IDs and versions on retry, increases revision only for changed content or values', async () => {
    const first = await createEditorRecordDownload(input())
    const second = await createEditorRecordDownload({ ...input(), protocol: first.protocol, identity: first.identity })
    expect(second.identity).toEqual(first.identity)
    const updated = input()
    updated.data.var.temperature = 38
    const third = await createEditorRecordDownload({ ...updated, protocol: second.protocol, identity: second.identity })
    expect(third.identity.id).toBe(first.identity.id)
    expect(third.identity.version).toBe(2)
    const fourth = await createEditorRecordDownload({ ...updated, aimd: `${updated.aimd}\n\nNew instructions.`, protocol: third.protocol, identity: third.identity })
    expect(fourth.protocol.version).not.toBe(third.protocol.version)
    expect(fourth.identity.version).toBe(3)
  })

  it('does not rename an unchanged imported protocol version', async () => {
    const options = input()
    const result = await createEditorRecordDownload({ ...options, protocol: { id: 'p1', version: '1.2.0', fingerprint: await protocolFingerprint(options.aimd, []) } })
    expect(result.protocol.version).toBe('1.2.0')
  })

  it('blocks invalid/missing values, non-JSON numbers, and metadata-only local files', async () => {
    const options = input()
    await expect(createEditorRecordDownload({ ...options, aimd: '  ' })).rejects.toThrow(/template/)
    await expect(createEditorRecordDownload({ ...options, data: { ...options.data, var: {} } })).rejects.toThrow()
    await expect(createEditorRecordDownload({ ...options, data: { ...options.data, var: { ...options.data.var, temperature: NaN } } })).rejects.toThrow(/finite JSON/)
    await expect(createEditorRecordDownload({ ...options, data: { ...options.data, var: { ...options.data.var, tags: ['unknown'] } } })).rejects.toThrow()
    await expect(createEditorRecordDownload({ ...options, data: { ...options.data, var: { ...options.data.var, file: { format: 'airalogy_selected_file_v1' } } } })).rejects.toThrow(/Reselect/)
  })

  it('preserves external references and imported metadata without claiming offline bytes', async () => {
    const options = input()
    const id = 'airalogy.id.file.12345678-1234-1234-1234-123456789abc.csv'
    const initial = await createEditorRecordDownload(options)
    const result = await createEditorRecordDownload({ ...options,
      data: { ...options.data, var: { ...options.data.var, file: id } },
      identity: { ...initial.identity, payload: { ...initial.identity.payload, metadata: { ...initial.identity.payload.metadata, operator: 'QA' }, data: { audit: { checked: true } } } },
      recordFiles: [{ id, name: 'external.csv', type: 'text/csv', sourceUri: 'https://example.com/external.csv' }],
    })
    expect(result.externalFileCount).toBe(1)
    const archive = await openAiraArchive(result.bytes)
    expect(archive.manifest.blobs).toEqual([])
    const payload = await archive.readJson<AiralogyRecordPayload>(archive.manifest.records![0].path)
    expect(payload.metadata?.operator).toBe('QA')
    expect(payload.data?.audit).toEqual({ checked: true })
    expect((await archive.validate()).ok).toBe(true)
  })

  it('stores file bytes separately and writes normalized figure IDs back through the result', async () => {
    const options = input()
    const id = 'airalogy.id.file.12345678-1234-1234-1234-123456789abc.txt'
    const result = await createEditorRecordDownload({ ...options,
      aimd: `${options.aimd}\n\n\`\`\`fig\nsrc: team.png\n\`\`\``,
      data: { ...options.data, var: { ...options.data.var, file: id } },
      files: [{ path: 'team.png', data: 'image-bytes' }],
      recordFiles: [{ id, name: 'test.txt', type: 'text/plain', blob: new Blob(['record-file']) }],
    })
    expect(result.aimd).toContain('id: team')
    expect(options.aimd).not.toContain('id: team')
    const archive = await openAiraArchive(result.bytes)
    expect(await archive.readText(archive.manifest.blobs![0].archive_path)).toBe('record-file')
    expect((await archive.validate()).ok).toBe(true)
  })
})
