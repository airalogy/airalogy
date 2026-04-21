# Releasing

[中文版本](RELEASING.zh-CN.md)

Airalogy publishes to PyPI from GitHub Actions when a version tag like `v0.8.1` is pushed.

## Release Flow

1. Update the package version in `pyproject.toml`.
2. Add the matching top entry to `CHANGELOG.md`.
3. Refresh `uv.lock` so `uv sync --locked --all-extras --dev` continues to work.
4. Merge the release-prep change to `main`.
5. Push the matching Git tag, for example `git tag v0.8.1 && git push origin v0.8.1`.

The release workflow validates that the Git tag matches `pyproject.toml`, then builds and publishes the package to PyPI through Trusted Publishing.

A normal `git push` only pushes branch commits to the remote. It does not create a version tag, and it does not push existing local tags automatically.

This repository's release workflow listens for `v*` tag pushes, not branch pushes. To trigger a release, create the tag first and then push it explicitly, for example:

```bash
git tag v0.8.1
git push origin v0.8.1
```

## Version Updates

Use `uv version` to update `project.version` in `pyproject.toml` instead of editing the value by hand when convenient:

```bash
uv version 0.8.1
```

Or bump by SemVer component:

```bash
uv version --bump patch
uv version --bump minor
uv version --bump major
```

`src/airalogy/__init__.py` reads the installed package metadata at runtime, so there is no second hardcoded version to keep in sync.

## PyPI Setup

PyPI must trust `airalogy/airalogy` with workflow file `.github/workflows/release.yml` for publishing to succeed.

Configure this once in the PyPI project settings:

- Owner: `airalogy`
- Repository: `airalogy`
- Workflow: `.github/workflows/release.yml`

## Notes

- Normal feature work should not bump versions or edit `CHANGELOG.md` unless it is explicitly release preparation.
- Keep the intended Git tag and `CHANGELOG.md` entry aligned with the version in `pyproject.toml`.
