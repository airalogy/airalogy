# `@airalogy/aira-core`

[English](./README.md) | [简体中文](./README.zh-CN.md)

Core TypeScript parser and validator for Airalogy `.aira` archives.

It opens `.aira` files in browser-compatible JavaScript, reads `_airalogy_archive/manifest.json`, lists archive members, loads JSON/text payloads, and validates manifest references, Record payload structure, Record hashes, Protocol file hashes, and offline blob hashes.

It can also create single-Protocol `.aira` archives in the browser. This is useful for editors that let users attach protocol-local assets such as `files/workflow-diagram.svg` and reference them from AIMD `fig` blocks.

Supported archive kinds are `protocol`, `protocols`, and `records`.

Example archives covering these kinds are available in `examples/aira/`.

The public manifest schema is available at `schemas/aira/manifest.v1.schema.json`; the public Record schema is available at `schemas/aira/record.v1.schema.json`.

```ts
import { openAiraArchive } from '@airalogy/aira-core'

const archive = await openAiraArchive(file)
const summary = archive.summary()
const validation = await archive.validate()
const manifest = archive.manifest
```

Read an ordinary ZIP folder bundle when you do not expect an Airalogy manifest:

```ts
import { openZipArchive } from '@airalogy/aira-core'

const zip = await openZipArchive(file)
const aimd = await zip.readText('protocol.aimd')
const image = await zip.readBytes('files/workflow-diagram.svg')
```

Create a Protocol archive with protocol-local figure files:

```ts
import { createProtocolAiraArchive } from '@airalogy/aira-core'

const bytes = await createProtocolAiraArchive({
  aimd: [
    '# Figure Protocol',
    '',
    '```fig',
    'id: workflow_diagram',
    'src: files/workflow-diagram.svg',
    'title: Workflow Diagram',
    '```',
    '',
  ].join('\n'),
  files: [
    {
      path: 'files/workflow-diagram.svg',
      data: svgFile,
    },
  ],
})
```

`.aira` archives are standard ZIP containers. The core package keeps reading independent from the full Airalogy platform, database, or execution engine.

## Export Records

`createRecordsAiraArchive` exports one or more records sharing an embedded protocol snapshot. The host supplies validated values, a stable record ID, a positive integer record version, and protocol identity. The writer validates JSON/identity consistency, not the protocol's Pydantic model, and never generates record IDs or saves drafts.

```ts
import { createRecordsAiraArchive } from '@airalogy/aira-core'

const bytes = await createRecordsAiraArchive({
  aimd: '{{var|temperature: float}}',
  protocol: { protocol_id: 'temperature-log', protocol_version: '1.0.0' },
  records: [{
    record: {
      record_id: crypto.randomUUID(),
      record_version: 1,
      data: { var: { temperature: 37.5 }, step: {}, check: {}, quiz: {} },
    },
  }],
})
```

Use top-level `files: [{ path, data }]` for protocol assets. Use each record's `files: [{ file_id, filename, mime_type, field_path, data }]` for its attachments; the value in `record.data` must reference the same `file_id`. Attachment `data` accepts a `Blob`, string, `ArrayBuffer`, or `Uint8Array`. Identical bytes share one SHA-256 blob. Without `data`, the attachment remains an external reference (`file_id` or `source_uri`), not an offline copy. Duplicate record ID/version pairs are rejected. The resulting archive includes file hashes and can be checked with `openAiraArchive(bytes).then(archive => archive.validate())`.

When repackaging a payload that already contains `record.files`, explicitly supply the sibling `files` list, including any bytes recovered from the original archive. This prevents stale blob references from being silently copied into a package that does not contain their files. An explicit empty list removes those associations.
