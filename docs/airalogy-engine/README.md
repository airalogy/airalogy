# airalogy-engine

[![PyPI version](https://img.shields.io/pypi/v/airalogy-engine?label=PyPI)](https://pypi.org/project/airalogy-engine/)
[![npm version](https://img.shields.io/npm/v/%40airalogy%2Fairalogy-engine?label=npm)](https://www.npmjs.com/package/@airalogy/airalogy-engine)

Airalogy protocol execution sandbox. It runs protocol packages (`parse`, `assign`,
`validate`) inside a BoxLite sandbox.

## Monorepo Layout

```text
packages/
├── pypi/airalogy-engine/        # Python package
├── npm/airalogy-engine/         # Node.js package
└── runtime/airalogy-engine-image/
    ├── Dockerfile
    └── protocol_requirements.txt

examples/airalogy-engine/        # Example protocol package
```

## Sandbox Image

Build the shared sandbox image from the runtime package:

```bash
cd packages/runtime/airalogy-engine-image
docker build -t airalogy-engine:latest .
docker save airalogy-engine:latest -o airalogy-engine-image.tar
mkdir airalogy-engine-image
tar -xf airalogy-engine-image.tar -C airalogy-engine-image
```

Pass the exported rootfs directory to either engine package.

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

Without a local rootfs, the Node.js test command runs path-validation tests
and skips sandbox integration cases so the package remains testable on
machines without BoxLite runtime support.
