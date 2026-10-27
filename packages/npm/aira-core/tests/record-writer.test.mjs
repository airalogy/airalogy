import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRecordsAiraArchive, openAiraArchive } from '../dist/index.js'

const record = (id = 'r1') => ({ record_id: id, record_version: 1, data: { var: { temperature: 37.5, checked: false, empty: null, tags: ['A'] }, step: {}, check: {}, quiz: {} } })
const options = () => ({ aimd: '{{var|temperature: float}}', protocol: { protocol_id: 'p1', protocol_version: 'local-v1' }, records: [{ record: record() }] })

test('records writer embeds one protocol, preserves typed data, and hashes all members', async () => {
  const input = options()
  input.files = [{ path: 'model.py', data: '# custom model' }]
  const archive = await openAiraArchive(await createRecordsAiraArchive(input))
  assert.deepEqual(await archive.validate(), { ok: true, issues: [] })
  assert.equal(archive.manifest.kind, 'records')
  assert.equal(archive.manifest.records[0].embedded_protocol_root, 'protocols/protocol')
  assert.equal(await archive.readText('protocols/protocol/model.py'), '# custom model')
  const payload = await archive.readJson(archive.manifest.records[0].path)
  assert.deepEqual(payload.data, input.records[0].record.data)
  assert.equal(payload.format, 'airalogy.record')
  assert.equal(payload.metadata.protocol_version, 'local-v1')
  assert.equal(input.records[0].record.format, undefined)
})

test('record blobs are deduplicated but attachments remain associated with their records', async () => {
  const input = options()
  input.records = ['r1', 'r2'].map(id => ({ record: record(id), files: [{ file_id: `file-${id}`, filename: 'test.txt', data: 'same bytes', field_path: 'var.file' }] }))
  const archive = await openAiraArchive(await createRecordsAiraArchive(input))
  assert.equal(archive.manifest.blobs.length, 1)
  assert.equal(archive.manifest.files.length, 2)
  assert.notEqual(archive.manifest.files[0].record_path, archive.manifest.files[1].record_path)
  assert.equal(await archive.readText(archive.manifest.blobs[0].archive_path), 'same bytes')
  assert.equal((await archive.validate()).ok, true)
})

test('records writer rejects identity conflicts, unsafe paths, invalid data, and protocol mismatches', async () => {
  await assert.rejects(createRecordsAiraArchive({ ...options(), records: [] }), /at least one/)
  await assert.rejects(createRecordsAiraArchive({ ...options(), records: [{ record: record() }, { record: record() }] }), /Duplicate record/)
  await assert.rejects(createRecordsAiraArchive({ ...options(), files: [{ path: '../secret', data: '' }] }), /root|safe/)
  await assert.rejects(createRecordsAiraArchive({ ...options(), records: [{ record: { ...record(), record_version: 0 } }] }), /positive integer/)
  await assert.rejects(createRecordsAiraArchive({ ...options(), records: [{ record: { ...record(), metadata: { protocol_id: 'other' } } }] }), /does not match/)
  await assert.rejects(createRecordsAiraArchive({ ...options(), records: [{ record: { ...record(), data: { var: { value: NaN } } } }] }), /finite JSON/)
  await assert.rejects(createRecordsAiraArchive({ ...options(), records: [{ record: { ...record(), files: [{ file_id: 'f1', blob_id: 'sha256:missing' }] } }] }), /Supply files/)
})

test('external attachments are explicit references, not fabricated offline files', async () => {
  const archive = await openAiraArchive(await createRecordsAiraArchive({ ...options(),
    records: [{ record: record(), files: [{ file_id: 'external-file', source_uri: 'https://example.com/data.csv' }] }],
  }))
  assert.equal(archive.manifest.blobs.length, 0)
  assert.equal(archive.manifest.files[0].source_uri, 'https://example.com/data.csv')
  assert.equal((await archive.validate()).ok, true)
})
