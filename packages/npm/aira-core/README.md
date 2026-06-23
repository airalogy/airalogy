# `@airalogy/aira-core`

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
