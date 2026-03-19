# AGENTS

## Documentation Rules

### Documentation Locations

- Chinese docs: `docs/zh/`
- English docs: `docs/en/`

### Sync Requirement

- Every time you add or update a documentation file, update both Chinese and English versions in the same change.
- Do not leave one language side outdated.

## Dependency Management

- When adding/removing/updating dependencies, use `uv add` / `uv remove` instead of editing `pyproject.toml` manually.
- Keep `pyproject.toml` and `uv.lock` in sync in the same change.
- If you change `pyproject.toml` metadata in a way that affects the lock input, including package version bumps, regenerate `uv.lock` in the same change.
- Treat `uv sync --locked --all-extras --dev` as the CI-facing check: do not leave a change that would require `uv lock` later.

## Built-in Type Entrypoints

- `airalogy.types` is the canonical public entrypoint for built-in types.
- `airalogy.built_in_types` is deprecated and should be treated as a compatibility-only re-export layer.
- When adding a new built-in type, implement and export it from `airalogy.types` first.
- Only touch `airalogy.built_in_types` to preserve historically exported legacy names; do not add or re-export newly introduced built-in types from that deprecated namespace.

## Release Hygiene

- If a change adds user-visible features, behavior changes, or public API surface in the `airalogy` package, update the package version in both `pyproject.toml` and `src/airalogy/__init__.py` in the same change.
- When bumping the package version, add a matching entry at the top of `CHANGELOG.md` on the same date.
- When bumping the package version in `pyproject.toml`, also refresh `uv.lock` so `uv sync --locked` continues to pass.
- Do not finish a release-relevant change with code/docs updates only; version and changelog updates are part of the required change set.
