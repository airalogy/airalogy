# Contributing to Airalogy

This repository contains the Airalogy Python core, AIMD npm packages, Airalogy Engine packages,
runtime image files, docs, examples, and shared protocol fixtures.

## Prerequisites

- Python 3.13 and `uv`
- Node.js 24 and `pnpm` 10
- Docker, only when working on the engine sandbox image or rootfs integration tests

## Common Commands

Python core:

```bash
cd packages/pypi/airalogy
uv sync --locked --all-extras --dev
uv run pytest tests/
```

Python engine:

```bash
cd packages/pypi/airalogy-engine
uv sync --locked --dev
uv run pytest tests/ --sandbox-mode=rootfs
```

npm packages:

```bash
pnpm install
pnpm build:npm
pnpm test:aimd
pnpm test:vitest
pnpm type-check
```

## Compatibility Fixtures

Protocol behavior belongs in `spec/fixtures` first. If a change affects AIMD syntax, parser output,
record structure, or engine behavior, add or update a fixture and wire it into the relevant package
tests.

## Releases

- PyPI tags use `airalogy-vX.Y.Z` and `airalogy-engine-vX.Y.Z`.
- npm packages use Changesets from `packages/npm/*`.
