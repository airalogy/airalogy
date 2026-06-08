# `@airalogy/aira-core`

Core TypeScript parser and validator for Airalogy `.aira` archives.

It opens `.aira` files in browser-compatible JavaScript, reads `_airalogy_archive/manifest.json`, lists archive members, loads JSON/text payloads, and validates manifest references, Record hashes, Protocol file hashes, and offline blob hashes.

Supported archive kinds are `protocol`, `protocols`, and `records`.

Example archives covering these kinds are available in `examples/aira/`.

The public manifest schema is available at `schemas/aira/manifest.v1.schema.json`.

```ts
import { openAiraArchive } from '@airalogy/aira-core'

const archive = await openAiraArchive(file)
const summary = archive.summary()
const validation = await archive.validate()
const manifest = archive.manifest
```

`.aira` archives are standard ZIP containers. The core package keeps reading independent from the full Airalogy platform, database, or execution engine.
