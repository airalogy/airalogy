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

## Release Hygiene

- If a change adds user-visible features, behavior changes, or public API surface in the `airalogy` package, update the package version in both `pyproject.toml` and `src/airalogy/__init__.py` in the same change.
- When bumping the package version, add a matching entry at the top of `CHANGELOG.md` on the same date.
- Do not finish a release-relevant change with code/docs updates only; version and changelog updates are part of the required change set.
