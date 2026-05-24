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

Docs:

```bash
pnpm docs:home:dev
pnpm docs:home:build
pnpm docs:airalogy:build
pnpm docs:aimd:build
pnpm docs:airalogy-engine:build
```

## Compatibility Fixtures

Protocol behavior belongs in `spec/fixtures` first. If a change affects AIMD syntax, parser output,
record structure, or engine behavior, add or update a fixture and wire it into the relevant package
tests.

## Releases

- Use Changesets for publishable npm and PyPI packages.
- Run `corepack pnpm changeset:add` when a change affects a published package's external behavior.
- Do not manually edit package versions or changelogs during normal feature work.
- Python package versions are synced from their private `package.json` files into `pyproject.toml` during the release PR.
