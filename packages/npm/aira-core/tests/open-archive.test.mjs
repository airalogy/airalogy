import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { AIRA_ARCHIVE_FORMAT, AIRA_MANIFEST_PATH, openAiraArchive } from '../dist/index.js'

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex')
}

function writeLocalHeader(name, payload, offset) {
  const nameBuffer = Buffer.from(name)
  const header = Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(0, 6)
  header.writeUInt16LE(0, 8)
  header.writeUInt32LE(0, 10)
  header.writeUInt32LE(0, 14)
  header.writeUInt32LE(payload.length, 18)
  header.writeUInt32LE(payload.length, 22)
  header.writeUInt16LE(nameBuffer.length, 26)
  header.writeUInt16LE(0, 28)
  return {
    offset,
    bytes: Buffer.concat([header, nameBuffer, payload]),
  }
}

function writeCentralDirectoryEntry(name, payload, localHeaderOffset) {
  const nameBuffer = Buffer.from(name)
  const header = Buffer.alloc(46)
  header.writeUInt32LE(0x02014b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(20, 6)
  header.writeUInt16LE(0, 8)
  header.writeUInt16LE(0, 10)
  header.writeUInt32LE(0, 12)
  header.writeUInt32LE(0, 16)
  header.writeUInt32LE(payload.length, 20)
  header.writeUInt32LE(payload.length, 24)
  header.writeUInt16LE(nameBuffer.length, 28)
  header.writeUInt16LE(0, 30)
  header.writeUInt16LE(0, 32)
  header.writeUInt16LE(0, 34)
  header.writeUInt16LE(0, 36)
  header.writeUInt32LE(0, 38)
  header.writeUInt32LE(localHeaderOffset, 42)
  return Buffer.concat([header, nameBuffer])
}

function createStoredZip(entries) {
  let offset = 0
  const localParts = []
  const centralParts = []

  for (const [name, payloadText] of entries) {
    const payload = Buffer.from(payloadText)
    const local = writeLocalHeader(name, payload, offset)
    localParts.push(local.bytes)
    centralParts.push(writeCentralDirectoryEntry(name, payload, local.offset))
    offset += local.bytes.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const endOfCentralDirectory = Buffer.alloc(22)
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0)
  endOfCentralDirectory.writeUInt16LE(0, 4)
  endOfCentralDirectory.writeUInt16LE(0, 6)
  endOfCentralDirectory.writeUInt16LE(entries.length, 8)
  endOfCentralDirectory.writeUInt16LE(entries.length, 10)
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12)
  endOfCentralDirectory.writeUInt32LE(offset, 16)
  endOfCentralDirectory.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory])
}

function createProtocolArchive({ expectedHash } = {}) {
  const aimd = '# Demo Protocol\n\n{{var|sample_name}}\n'
  const manifest = {
    format: AIRA_ARCHIVE_FORMAT,
    version: 1,
    kind: 'protocol',
    created_at: '2026-06-08T00:00:00+00:00',
    protocol: {
      protocol_id: 'demo_protocol',
      protocol_version: '0.1.0',
      protocol_name: 'Demo Protocol',
      entrypoint: 'protocol.aimd',
      files: ['protocol.aimd'],
      file_hashes: {
        'protocol.aimd': expectedHash ?? sha256Hex(aimd),
      },
    },
  }
  return createStoredZip([
    [AIRA_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`],
    ['protocol.aimd', aimd],
  ])
}

function createProtocolsArchive() {
  const protocolA = '# Protocol A\n\n{{var|sample_name}}\n'
  const protocolB = '# Protocol B\n\n{{var|sample_name}}\n'
  const manifest = {
    format: AIRA_ARCHIVE_FORMAT,
    version: 1,
    kind: 'protocols',
    created_at: '2026-06-08T00:00:00+00:00',
    protocols: [
      {
        protocol_id: 'protocol_a',
        protocol_version: '0.1.0',
        protocol_name: 'Protocol A',
        entrypoint: 'protocol.aimd',
        archive_root: 'protocols/protocol_a__0.1.0',
        files: ['protocol.aimd'],
        file_hashes: {
          'protocol.aimd': sha256Hex(protocolA),
        },
      },
      {
        protocol_id: 'protocol_b',
        protocol_version: '0.2.0',
        protocol_name: 'Protocol B',
        entrypoint: 'protocol.aimd',
        archive_root: 'protocols/protocol_b__0.2.0',
        files: ['protocol.aimd'],
        file_hashes: {
          'protocol.aimd': sha256Hex(protocolB),
        },
      },
    ],
  }
  return createStoredZip([
    [AIRA_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`],
    ['protocols/protocol_a__0.1.0/protocol.aimd', protocolA],
    ['protocols/protocol_b__0.2.0/protocol.aimd', protocolB],
  ])
}

function createRecordsArchiveWithBlob({ expectedHash } = {}) {
  const record = `${JSON.stringify({
    record_id: 'record-with-file',
    metadata: {
      protocol_id: 'file_protocol',
      protocol_version: '0.1.0',
    },
    data: {
      var: {
        sample_file: 'airalogy.id.file.11111111-1111-4111-8111-111111111111.txt',
      },
    },
  }, null, 2)}\n`
  const recordHash = sha256Hex(record)
  const blobPayload = Buffer.from('offline payload')
  const blobHash = sha256Hex(blobPayload)
  const blobPath = `blobs/sha256/${blobHash.slice(0, 2)}/${blobHash.slice(2, 4)}/${blobHash}`
  const manifest = {
    format: AIRA_ARCHIVE_FORMAT,
    version: 1,
    kind: 'records',
    created_at: '2026-06-08T00:00:00+00:00',
    records: [
      {
        path: 'records/record-with-file.v1.json',
        record_id: 'record-with-file',
        record_version: 1,
        protocol_id: 'file_protocol',
        protocol_version: '0.1.0',
        sha256: recordHash,
      },
    ],
    protocols: [],
    blobs: [
      {
        blob_id: `sha256:${expectedHash ?? blobHash}`,
        archive_path: blobPath,
        sha256: expectedHash ?? blobHash,
        size: blobPayload.length,
      },
    ],
    files: [
      {
        file_id: 'airalogy.id.file.11111111-1111-4111-8111-111111111111.txt',
        source_uri: 'oss://airalogy-demo/payload.txt',
        blob_id: `sha256:${expectedHash ?? blobHash}`,
        filename: 'payload.txt',
        mime_type: 'text/plain',
        record_path: 'records/record-with-file.v1.json',
        field_path: 'data.var.sample_file',
      },
    ],
  }
  return createStoredZip([
    [AIRA_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`],
    ['records/record-with-file.v1.json', record],
    [blobPath, blobPayload],
  ])
}

test('opens and validates a protocol .aira archive', async () => {
  const archive = await openAiraArchive(createProtocolArchive())

  assert.deepEqual(archive.summary(), {
    format: AIRA_ARCHIVE_FORMAT,
    version: 1,
    kind: 'protocol',
    createdAt: '2026-06-08T00:00:00+00:00',
    memberCount: 2,
    recordCount: 0,
    protocolCount: 1,
    blobCount: 0,
    fileCount: 0,
  })
  assert.equal(await archive.readText('protocol.aimd'), '# Demo Protocol\n\n{{var|sample_name}}\n')
  assert.deepEqual(await archive.validate(), { ok: true, issues: [] })
})

test('opens and validates a protocols .aira archive', async () => {
  const archive = await openAiraArchive(createProtocolsArchive())

  assert.deepEqual(archive.summary(), {
    format: AIRA_ARCHIVE_FORMAT,
    version: 1,
    kind: 'protocols',
    createdAt: '2026-06-08T00:00:00+00:00',
    memberCount: 3,
    recordCount: 0,
    protocolCount: 2,
    blobCount: 0,
    fileCount: 0,
  })
  assert.deepEqual(await archive.validate(), { ok: true, issues: [] })
})

test('opens and validates a records .aira archive with offline blobs', async () => {
  const archive = await openAiraArchive(createRecordsArchiveWithBlob())

  assert.deepEqual(archive.summary(), {
    format: AIRA_ARCHIVE_FORMAT,
    version: 1,
    kind: 'records',
    createdAt: '2026-06-08T00:00:00+00:00',
    memberCount: 3,
    recordCount: 1,
    protocolCount: 0,
    blobCount: 1,
    fileCount: 1,
  })
  assert.deepEqual(await archive.validate(), { ok: true, issues: [] })
})

test('reports protocol file hash mismatches', async () => {
  const archive = await openAiraArchive(createProtocolArchive({ expectedHash: 'bad-hash' }))
  const validation = await archive.validate()

  assert.equal(validation.ok, false)
  assert.match(validation.issues.join('\n'), /sha256 mismatch/)
})

test('reports blob file hash mismatches', async () => {
  const archive = await openAiraArchive(createRecordsArchiveWithBlob({ expectedHash: `${'0'.repeat(64)}` }))
  const validation = await archive.validate()

  assert.equal(validation.ok, false)
  assert.match(validation.issues.join('\n'), /Blob file .* sha256 mismatch/)
})

const exampleArchives = [
  ['single-protocol.aira', { kind: 'protocol', recordCount: 0, protocolCount: 1 }],
  ['protocols-bundle.aira', { kind: 'protocols', recordCount: 0, protocolCount: 2 }],
  ['records-with-protocol.aira', { kind: 'records', recordCount: 2, protocolCount: 1 }],
  ['multi-protocol-records.aira', { kind: 'records', recordCount: 2, protocolCount: 2 }],
  ['records-with-file.aira', { kind: 'records', recordCount: 1, protocolCount: 1, blobCount: 1, fileCount: 1 }],
]

for (const [fileName, expected] of exampleArchives) {
  test(`opens repository example ${fileName}`, async () => {
    const archivePath = new URL(`../../../../examples/aira/${fileName}`, import.meta.url)
    const archive = await openAiraArchive(await readFile(archivePath))
    const summary = archive.summary()

    assert.equal(summary.kind, expected.kind)
    assert.equal(summary.recordCount, expected.recordCount)
    assert.equal(summary.protocolCount, expected.protocolCount)
    assert.equal(summary.blobCount, expected.blobCount ?? 0)
    assert.equal(summary.fileCount, expected.fileCount ?? 0)
    assert.deepEqual(await archive.validate(), { ok: true, issues: [] })
  })
}
