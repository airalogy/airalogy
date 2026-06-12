import { describe, expect, it } from 'vitest'

import type { AiraManifest, AiralogyRecordPayload } from '@airalogy/aira-core'
import {
  buildDocumentViews,
  buildRecordSections,
  collectProtocolEntries,
  findProtocolForRecord,
  type ReadableAiraArchive,
} from './reader-model'

function createArchive(
  manifest: AiraManifest,
  options: {
    text?: Record<string, string>
    json?: Record<string, unknown>
  } = {},
): ReadableAiraArchive {
  return {
    manifest,
    async readText(path: string) {
      if (!(path in (options.text ?? {}))) {
        throw new Error(`Missing text member: ${path}`)
      }
      return options.text![path]
    },
    async readJson<T>(path: string) {
      if (!(path in (options.json ?? {}))) {
        throw new Error(`Missing JSON member: ${path}`)
      }
      return options.json![path] as T
    },
  }
}

describe('reader-model', () => {
  it('normalizes protocol roots and default entrypoints', () => {
    const entries = collectProtocolEntries({
      format: 'airalogy.archive',
      version: 1,
      kind: 'protocols',
      protocols: [
        {
          protocol_id: 'alpha',
          protocol_name: 'Alpha',
          archive_root: '/protocols/alpha/',
          entrypoint: '/main.aimd',
        },
        {
          protocol_id: 'beta',
          archive_root: 'protocols/beta',
        },
      ],
    })

    expect(entries.map(entry => ({
      root: entry.root,
      path: entry.path,
      label: entry.label,
    }))).toEqual([
      {
        root: 'protocols/alpha',
        path: 'protocols/alpha/main.aimd',
        label: 'Alpha',
      },
      {
        root: 'protocols/beta',
        path: 'protocols/beta/protocol.aimd',
        label: 'beta',
      },
    ])
  })

  it('prefers an embedded protocol root when matching records', () => {
    const entries = collectProtocolEntries({
      format: 'airalogy.archive',
      version: 1,
      kind: 'records',
      protocols: [
        {
          protocol_id: 'shared',
          protocol_version: '1',
          protocol_name: 'Shared v1',
          archive_root: 'protocols/shared-v1',
        },
        {
          protocol_id: 'shared',
          protocol_version: '2',
          protocol_name: 'Shared v2',
          archive_root: 'protocols/shared-v2',
        },
      ],
    })

    const match = findProtocolForRecord({
      path: 'records/one.json',
      protocol_id: 'shared',
      protocol_version: '1',
      embedded_protocol_root: '/protocols/shared-v2/',
    }, entries)

    expect(match?.label).toBe('Shared v2')
  })

  it('builds record-backed document views with payload data', async () => {
    const payload: AiralogyRecordPayload = {
      format: 'airalogy.record',
      schema_version: 1,
      record_id: 'payload-record',
      data: {
        var: {
          subject: 'Ada',
        },
      },
    }
    const archive = createArchive({
      format: 'airalogy.archive',
      version: 1,
      kind: 'records',
      protocols: [{
        protocol_id: 'demo',
        protocol_version: '1',
        protocol_name: 'Demo Protocol',
        archive_root: 'protocols/demo',
        entrypoint: 'protocol.aimd',
      }],
      records: [{
        path: 'records/r1.json',
        record_id: 'manifest-record',
        protocol_id: 'demo',
        protocol_version: '1',
      }],
    }, {
      text: {
        'protocols/demo/protocol.aimd': '# Demo\n\nSubject: {{var:subject}}',
      },
      json: {
        'records/r1.json': payload,
      },
    })

    const views = await buildDocumentViews(archive)

    expect(views).toHaveLength(1)
    expect(views[0]).toMatchObject({
      id: 'record:records/r1.json',
      kind: 'record',
      label: 'payload-record',
      subtitle: 'Demo Protocol · Record',
      protocolPath: 'protocols/demo/protocol.aimd',
      protocolContent: '# Demo\n\nSubject: {{var:subject}}',
      recordPayload: payload,
    })
  })

  it('keeps missing protocol errors visible on record-backed views', async () => {
    const archive = createArchive({
      format: 'airalogy.archive',
      version: 1,
      kind: 'records',
      records: [{
        path: 'records/r1.json',
        record_id: 'manifest-record',
        protocol_id: 'missing',
        protocol_version: '1',
      }],
    }, {
      json: {
        'records/r1.json': {
          record_id: 'payload-record',
          data: {},
        },
      },
    })

    const views = await buildDocumentViews(archive)

    expect(views[0]).toMatchObject({
      label: 'payload-record',
      protocolPath: '',
      protocolContent: '',
      loadError: 'This record does not reference a protocol included in the archive.',
    })
  })

  it('summarizes known record data sections in display order', () => {
    expect(buildRecordSections({
      step: {
        review: { checked: true },
      },
      var: {
        subject: 'Ada',
      },
      extra: {
        hidden: 'not shown',
      },
    }).map(section => ({
      key: section.key,
      entries: section.entries.map(entry => entry.key),
    }))).toEqual([
      {
        key: 'var',
        entries: ['subject'],
      },
      {
        key: 'step',
        entries: ['review'],
      },
    ])
  })
})
