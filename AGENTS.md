# Repository Guidelines

This repository is the Airalogy monorepo. Keep package boundaries explicit and avoid mixing
repository migration work with API or parser behavior changes.

## Layout

- `packages/pypi/airalogy`: Python protocol core.
- `packages/pypi/airalogy-engine`: Python engine package.
- `packages/npm/*`: npm packages.
- `packages/runtime/airalogy-engine-image`: sandbox image files.
- `apps/aimd-demo`: AIMD browser demo app.
- `docs/aimd`: AIMD package documentation site.
- `spec/fixtures`: shared compatibility fixtures.

## Validation

- Airalogy core: `uv --directory packages/pypi/airalogy run pytest tests/`
- Airalogy engine Python: `uv --directory packages/pypi/airalogy-engine run pytest tests/ --sandbox-mode=rootfs`
- npm packages: `pnpm build:npm`, `pnpm test:aimd`, `pnpm type-check`

When adding or changing AIMD syntax, add or update a fixture in `spec/fixtures` and wire it into
both Python and npm parser tests where practical.
