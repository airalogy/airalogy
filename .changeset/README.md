# Changesets

This repo uses Changesets to manage releases for the publishable npm packages
under `packages/npm/`.

## Normal workflow

1. Make your feature or fix.
2. If it changes published behavior, run `corepack pnpm changeset:add`.
3. Select every affected publishable package and the right SemVer bump.
4. Commit the generated markdown file under `.changeset/` with the code change.

## Notes

- One feature may affect multiple packages. Prefer one multi-package changeset for that release unit.
- Do not manually bump package versions or edit package changelogs during normal feature work.
- Release PRs and package publishing are handled by GitHub Actions after changes land on `main`.
- The release script intentionally uses `pnpm publish -r` instead of `changeset publish` so pnpm rewrites `workspace:*` dependency ranges in published package manifests.
- npm publishing uses Trusted Publishing/OIDC. Keep `id-token: write` in `.github/workflows/release-npm.yml`, and configure each public package on npm to trust the `release-npm.yml` workflow filename. npm's trusted-publisher form expects the filename only, not `.github/workflows/release-npm.yml`.
