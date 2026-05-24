# Releasing

[中文版本](RELEASING.zh-CN.md)

Airalogy PyPI packages are versioned with Changesets and published by GitHub
Actions through PyPI Trusted Publishing.

## Release Flow

1. Make the feature or fix.
2. If it changes a published package's external behavior, run `corepack pnpm changeset:add`.
3. Select the affected package, such as `airalogy` or `airalogy-engine`, and the SemVer bump.
4. Merge the feature PR to `main`.
5. The Changesets workflow creates or updates a release PR.
6. The release PR updates package versions, changelogs, Python `pyproject.toml` files, and `uv.lock` files.
7. Merge the release PR to `main`.
8. `.github/workflows/release.yml` builds and publishes any PyPI package version that does not already exist on PyPI.

Version tags such as `airalogy-vX.Y.Z` are no longer the release trigger. They
may still be created after publishing if the project wants Git tags as release
markers.

## Version Metadata

Each PyPI package has a private `package.json` used only as the Changesets
version anchor:

- `packages/pypi/airalogy/package.json`
- `packages/pypi/airalogy-engine/package.json`

The publishable Python metadata remains in `pyproject.toml`. During release PR
generation, `corepack pnpm changeset:version` runs:

```bash
corepack pnpm sync:python-versions
corepack pnpm lock:python
```

That syncs the Changesets-computed versions into `pyproject.toml`, updates the
`airalogy-engine` development dependency on `airalogy`, and refreshes Python
lockfiles.

## Local Checks

Verify Python release metadata without changing files:

```bash
corepack pnpm check:python-versions
```

Regenerate synced metadata after a manual release-maintenance change:

```bash
corepack pnpm sync:python-versions
corepack pnpm lock:python
```

## PyPI Setup

PyPI must trust `airalogy/airalogy` with workflow file `.github/workflows/release.yml`
for publishing to succeed.

Configure this once for each PyPI project:

- Owner: `airalogy`
- Repository: `airalogy`
- Workflow: `.github/workflows/release.yml`

## Notes

- Normal feature work should not manually bump versions or edit changelogs.
- Do not publish PyPI packages from local machines during normal releases.
- The release workflow checks whether the target version already exists on PyPI and skips existing versions.
