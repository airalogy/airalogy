# Airalogy Engine

[![PyPI version](https://img.shields.io/pypi/v/airalogy-engine?label=PyPI)](https://pypi.org/project/airalogy-engine/)
[![npm version](https://img.shields.io/npm/v/%40airalogy%2Fairalogy-engine?label=npm)](https://www.npmjs.com/package/@airalogy/airalogy-engine)

Airalogy Engine runs protocol packages (`parse`, `assign`, `validate`) inside a
BoxLite sandbox. The Python and Node.js packages share the same sandbox image
and protocol executor behavior.

## Packages

| Package | Source | Registry |
| --- | --- | --- |
| Python API | [`packages/pypi/airalogy-engine`](https://github.com/airalogy/airalogy/tree/main/packages/pypi/airalogy-engine) | [PyPI](https://pypi.org/project/airalogy-engine/) |
| Node.js API | [`packages/npm/airalogy-engine`](https://github.com/airalogy/airalogy/tree/main/packages/npm/airalogy-engine) | [npm](https://www.npmjs.com/package/@airalogy/airalogy-engine) |
| Sandbox image | [`packages/runtime/airalogy-engine-image`](https://github.com/airalogy/airalogy/tree/main/packages/runtime/airalogy-engine-image) | Local Docker/OCI rootfs |
| Example protocol | [`examples/airalogy-engine`](https://github.com/airalogy/airalogy/tree/main/examples/airalogy-engine) | Repository example |
| Protocol demo | [`apps/protocol-demo`](https://github.com/airalogy/airalogy/tree/main/apps/protocol-demo) | Local demo service |

## Monorepo Layout

```text
packages/
├── pypi/airalogy-engine/        # Python package
├── npm/airalogy-engine/         # Node.js package
└── runtime/airalogy-engine-image/
    ├── Dockerfile
    └── protocol_requirements.txt

examples/airalogy-engine/        # Example protocol package
examples/protocols/              # Official protocol examples
apps/protocol-demo/              # Local engine-backed demo
```

## Sandbox Image

Build the shared sandbox image from the runtime package:

```bash
pnpm build:engine-rootfs
```

This creates the default rootfs at
`packages/runtime/airalogy-engine-image/airalogy-engine-image`. Rebuild it after
runtime dependency changes with:

```bash
pnpm build:engine-rootfs:force
```

### What is an OCI rootfs?

OCI stands for Open Container Initiative. The exported rootfs is an OCI
image layout directory, which is a standard local directory format for container
images, not a traditional unpacked Linux filesystem and not a Docker-specific
format. It contains `oci-layout`, `index.json`, and `blobs/sha256/...` entries,
which BoxLite can mount as the sandbox filesystem. If the directory exists but
does not contain `oci-layout`, treat it as an incomplete build and rebuild it
with `pnpm build:engine-rootfs:force`.

Pass the exported rootfs directory to either engine package.

## Python

Install from PyPI:

```bash
pip install airalogy-engine
```

Use a local rootfs:

```python
from airalogy_engine import AiralogyEngine

engine = AiralogyEngine(rootfs_path="./airalogy-engine-image")
result = await engine.parse_protocol("./protocol")
```

## Node.js

Install from npm:

```bash
pnpm add @airalogy/airalogy-engine
```

Use a local rootfs:

```js
import { parseProtocol } from "@airalogy/airalogy-engine";

const result = await parseProtocol("./protocol", {
  rootfsPath: "./airalogy-engine-image",
});
```

## Protocol Demo

Run the local demo service from the repository root:

```bash
pnpm dev:protocol-demo:full
```

The demo loads `examples/protocols`, shows the AIMD recorder surface, and calls
the Node.js engine package for `parse`, `validate`, and `assign` operations.

## Tests

Python package:

```bash
cd packages/pypi/airalogy-engine
uv run pytest tests/ -v --sandbox-mode=rootfs \
  --rootfs-path=../../runtime/airalogy-engine-image/airalogy-engine-image
```

Node.js package:

```bash
cd packages/npm/airalogy-engine
SANDBOX_MODE=rootfs \
ROOTFS_PATH=../../runtime/airalogy-engine-image/airalogy-engine-image \
AIRALOGY_ENGINE_RUN_SANDBOX_TESTS=1 \
pnpm test
```

Without a local rootfs, the Node.js test command runs path-validation tests and
skips sandbox integration cases so the package remains testable on machines
without BoxLite runtime support.
