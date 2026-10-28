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

That syncs the Changesets-computed versions into `pyproject.toml`, aligns both runtime and development dependencies on `airalogy`, and refreshes Python lockfiles. It also synchronizes the Engine image `VERSION` and the default image tags used by the Python client, Node client, tests, and Protocol Demo. Normal feature work must not update these versions manually.

The private Python Engine version anchor declares its core dependency so Changesets includes it when a core minor release changes the supported version series. When a core release changes the default image, include a patch changeset for both `airalogy-engine` and `@airalogy/airalogy-engine`, including for core patch releases: Changesets cannot infer a Node client release from an image string in source code.

Image publication remains a separate operation through `.github/workflows/release-engine-image.yml`. Before publishing engine clients that default to a new image tag, ensure the matching image has been published and verified. Synchronizing a version or merging a release PR does not itself publish that image.

Publish and verify the image from the final release PR commit before merging that PR. The package workflows then publish Python Core before Python Engine, and npm runtime dependencies before their consumers. Already-published package versions are skipped when retrying a partially completed release; registry errors must stop the release rather than be interpreted as missing versions.

## Local Checks

Verify Python release metadata without changing files:

```bash
corepack pnpm check:python-versions
corepack pnpm check:engine-image-release
corepack pnpm test:release
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
