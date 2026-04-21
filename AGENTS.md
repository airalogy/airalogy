# AGENTS

## Documentation Rules

### Documentation Locations

- Chinese docs: `docs/zh/`
- English docs: `docs/en/`

### Sync Requirement

- Every time you add or update a documentation file, update both Chinese and English versions in the same change.
- Keep the root `README.md` and `README.zh-CN.md` aligned when either one changes.
- Keep the maintainer release guides `RELEASING.md` and `RELEASING.zh-CN.md` aligned when either one changes.
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

- Normal feature and bug-fix work should not bump package versions or edit `CHANGELOG.md` unless the user explicitly asks for release preparation.
- `pyproject.toml` is the single source of truth for the package version; do not hardcode `__version__` elsewhere.
- Release preparation must update `pyproject.toml`, add the matching top entry in `CHANGELOG.md`, and keep the intended Git tag aligned with that version.
- When bumping the package version in `pyproject.toml`, also refresh `uv.lock` so `uv sync --locked` continues to pass.
- GitHub Actions publishes to PyPI from version tags like `v0.8.1`; prepare the release commit first, merge it, then tag the matching version on `main`.
- Do not finish an explicit release-prep change with partial metadata updates; version, changelog, and tag intent must stay aligned.
