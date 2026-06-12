# AGENTS

## Scope

- `packages/npm/aimd-*` are publishable AIMD packages (`@airalogy/aimd-*`).

## Documentation Layout

- Package READMEs live in `packages/npm/<package-name>/README.md` and `packages/npm/<package-name>/README.zh-CN.md`.
- Docs site source lives in `docs/aimd/`.
- English package docs live in `docs/aimd/en/packages/<package-name>/`.
- Chinese package docs live in `docs/aimd/zh/packages/<package-name>/`.
- AIMD docs site config lives in `docs/aimd/.vitepress/config.mjs`.

## Documentation Expectations For AI Agents

- When changing public package API, user-facing behavior, onboarding flow, or examples, update the relevant package README and matching docs pages under `docs/aimd/en/` and `docs/aimd/zh/`.
- Keep English and Chinese docs aligned in scope unless the user explicitly asks otherwise.
- Keep package README concise and onboarding-focused; put fuller explanations and API usage in `docs/`.

## Implementation Completion Checklist For AI Agents

- For any feature, bug fix, or user-visible refinement in `packages/npm/*`, finish by checking whether the change needs tests, docs/demo updates, and release metadata.
- Add or update focused tests for parser behavior, recorder/editor UI behavior, or regression coverage when the change affects those areas.
- If the change affects published package behavior, add a Changesets entry; do not manually edit package `CHANGELOG.md` files during normal feature work.
- If no Changesets entry is needed, be ready to state why in the final response.
- In the final response, summarize the affected packages and the verification commands that were run.

## Demo Example Expectations

- `examples/aimd/aimd-syntax-tour/protocol.aimd` is the canonical interactive syntax tour used across AIMD demos.
- When adding a new built-in var type, recorder widget, or other user-visible field experience, add a minimal example to `examples/aimd/aimd-syntax-tour/protocol.aimd` unless the user explicitly asks not to.
- Prefer one clear example per built-in type in the syntax tour so users can discover it directly from the demo UI.

## Vue Rendering Stability

- Do not use unstable dynamic component factories in templates such as `:is="() => nodes"` for recorder/editor output. They can force unnecessary unmount/remount cycles and cause focus or scroll jumps while typing.
- When syncing `v-model` state back into local reactive state, short-circuit echo updates if the semantic content has not changed. Avoid rebuilding recorder/editor subtrees for no-op parent round-trips.

## Release Workflow For AI Agents

- `packages/npm/*` are versioned independently. Do not force all publishable packages to share the same version unless the user explicitly asks for a lockstep release strategy.
- This repo uses a Changesets-based release workflow for publishable packages.
- During normal feature work, do **not** manually bump package versions or edit package `CHANGELOG.md` files.
- When a change affects published behavior, capture release intent for every affected publishable package in a single multi-package changeset.
- A single feature or PR may touch multiple publishable packages; that is normal and should usually be represented as one changeset covering all affected packages.
- Use `corepack pnpm changeset:add` to create release metadata when needed.
- Only edit package versions or package changelogs directly when the user explicitly asks for release preparation or release metadata cleanup.
- Use SemVer when deciding release impact:
  - `major`: breaking API or behavior changes.
  - `minor`: backward-compatible feature additions.
  - `patch`: backward-compatible bug fixes.
- Treat these as release-worthy by default:
  - Public API or type export changes.
  - Runtime behavior changes users can observe.
  - Parser or renderer output changes.
  - Build output that downstream users consume.
- These changes usually do not need release metadata:
  - Internal refactor with no external behavior change.
  - Tests only.
  - Docs only.
  - CI, tooling, or config changes not affecting package runtime or API.
