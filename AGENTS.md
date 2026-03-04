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
