# Changelog

## 1.11.0

### Minor Changes

- 0ae5bc4: Add Collector syntax, typed Observation models, cross-language parser validation, and recorder controls for host-provided snapshot and polling data sources with authorization, cancellation, provenance, and explicit manual fallback.
- f2960ed: Add connector metadata blocks, the built-in `EntityRef` type, recorder entity-reference controls backed by host-provided resolvers, and Python/npm runtime helpers for executing `entity_source` connector descriptors.

### Patch Changes

- e761b99: Wrap the editor toolbar actions instead of hiding later buttons behind a horizontal scrollbar.
- Updated dependencies [0ae5bc4]
- Updated dependencies [f2960ed]
- Updated dependencies [7ddd040]
- Updated dependencies [fbed3e6]
  - @airalogy/aimd-core@2.14.0
  - @airalogy/aimd-renderer@2.11.0

## 1.10.0

### Minor Changes

- 69922a8: Add AIMD `media` blocks and `ref_media` references for video, audio, ordinary files, and default media pin controls.

  Renderer hosts can resolve protocol-local media assets with `resolveAssetUrl()` using `context.kind` values of `media` and `media_poster`. Vue rendering now provides a compact default pin/unpin interaction for video and audio media, including single-item pinning, collapsed descriptions, and small, medium, and large pinned-size controls, while static HTML rendering exposes matching data attributes for host-controlled behavior.

### Patch Changes

- ffa32e1: Allow source and WYSIWYG editor modes to flex-fill taller host panels while preserving their configured minimum height.
- Updated dependencies [36a5fef]
- Updated dependencies [69922a8]
- Updated dependencies [b5c5646]
  - @airalogy/aimd-renderer@2.9.0
  - @airalogy/aimd-core@2.11.0

## 1.9.1

### Patch Changes

- c8b8066: Add a browser-compatible protocol `.aira` archive writer for AIMD files with protocol-local assets such as `files/workflow-diagram.svg`.

  Allow AIMD editor hosts to override the image toolbar action and receive the image button position so applications can offer URL figures, local uploads, or archive-aware image insertion flows from an anchored popover.

  Include AIMD field, reference, quiz, refs block, and full-width variable-table preview styles in the renderer stylesheet so static previews that import `@airalogy/aimd-renderer/styles` render AIMD tokens correctly without depending on recorder styles.

- Updated dependencies [c8b8066]
  - @airalogy/aimd-renderer@2.8.1

## 1.9.0

### Minor Changes

- 735776f: feat: improve quiz field editing

  - Auto-generate quiz IDs based on type and check existing IDs to avoid duplicates
  - Reset stem and all type-specific fields when changing quiz type
  - Change default blank answer from '21%' to empty string
  - Choice options default to empty text
  - Move 'Correct Answer' column to last position
  - Add leading newline when inserting at non-line-start position

## 1.8.0

### Minor Changes

- e0e1b9f: Add AIMD numeric constraint support, source diagnostics, extracted var definition metadata, and constraint-aware client assigner dependency readiness for Pydantic-style `gt`, `ge`, `lt`, `le`, and `multiple_of` var kwargs.

### Patch Changes

- Updated dependencies [27ae467]
- Updated dependencies [e0e1b9f]
  - @airalogy/aimd-core@2.6.0
  - @airalogy/aimd-renderer@2.5.0

## 1.7.1

### Patch Changes

- 541d008: Configure public package release metadata for automated publishing, align internal workspace dependency ranges for published packages, and add the monorepo Changesets release workflow.
- Updated dependencies [541d008]
  - @airalogy/aimd-core@2.5.1
  - @airalogy/aimd-renderer@2.4.1

All notable changes to `@airalogy/aimd-editor` will be documented in this file.

## [Unreleased]

## [1.7.0] - 2026-03-26

### Added

- Added low-level `AimdWysiwygEditor` support for injected Milkdown plugin chains so host packages can swap the default AIMD node views for richer embedded experiences.
- Added `allowedTypes` on `AimdFieldDialog` so host packages can constrain the insertion UI to a focused subset of AIMD field kinds.

### Changed

- AIMD syntax inserted into WYSIWYG now reparses immediately, so host-defined Milkdown node views can hydrate custom AIMD widgets right after toolbar/dialog insertion instead of waiting for a later full-document round trip.

### Fixed

- Fixed WYSIWYG content syncing so protected AIMD inline-template tokens are restored before being emitted back to host state, and obviously corrupted Milkdown DOM snapshots are ignored instead of being written into the markdown model.
- Fixed AIMD WYSIWYG markdown serialization so inline AIMD fields round-trip as markdown text instead of mdast html nodes, preventing protected inline-template tokens from resurfacing as literal `<p>...AIMDINLINETEMPLATE...` output during editor sync.
- Hardened WYSIWYG content normalization so HTML-wrapped protected AIMD tokens are rejected as corrupted editor output instead of being written back into host markdown state.
- Fixed WYSIWYG-to-source markdown normalization so AIMD inline templates no longer keep stray Markdown escape characters like `\_` in field ids after switching editor modes, and added a dedicated regression test for that round-trip.
- Fixed source/WYSIWYG sync echo behavior so `syncFromProp(...)` updates no longer re-emit stale intermediate markdown back to host state; this prevents rapid typing from flickering between partial and newer content when a host keeps both AIMD source and a live WYSIWYG surface mounted at the same time.
- Fixed delayed Milkdown `markdownUpdated` callbacks after programmatic `replaceAll(...)` syncs by suppressing tracked sync-target echoes, preventing controlled split-view hosts such as `AimdRecorderEditor` from getting stuck oscillating between older and newer markdown states after fast typing.
- Fixed delayed Milkdown `markdownUpdated` callbacks after programmatic content sync by adding a short suppression window on top of tracked sync-target filtering, preventing split-view hosts from oscillating between older and newer markdown states when source typing and a live WYSIWYG surface are mounted together.
- Fixed controlled WYSIWYG sync comparisons so protected AIMD inline-template placeholders and restored AIMD markdown now normalize to the same comparable content before programmatic sync guards and external-prop equality checks run, preventing right-side recorder/editor typing from repeatedly `replaceAll(...)`-resetting the caret to the end of the document.

## [1.6.0] - 2026-03-19

### Added

- Added built-in insertion-dialog var type presets for Airalogy code-string types (`CodeStr`, `PyStr`, `JsStr`, `TsStr`, `JsonStr`, `TomlStr`, `YamlStr`) so the editor can surface the same code-oriented types that the recorder now renders with dedicated code editors.

## [1.5.0] - 2026-03-19

### Added

- Exported lightweight `@airalogy/aimd-editor/wysiwyg` and `@airalogy/aimd-editor/embedded` entries so host packages can embed WYSIWYG-only or source/WYSIWYG field editors without routing everything through the full `AimdEditor`.

### Changed

- Added host-facing support for unmounting inactive source / WYSIWYG panes in embedded editor scenarios, reducing hidden-editor focus and scroll interference inside recorder-style integrations.

## [1.4.0] - 2026-03-19

### Added

- Added `varTypePlugins` on `AimdEditor` / `AimdFieldDialog` so host applications can surface custom type presets in the insertion dialog without changing AIMD syntax itself.
- Exported `createAimdVarTypePresets(...)` and the typed preset shape for reusable custom type suggestion UIs.

## [1.3.0] - 2026-03-17

### Added

- Added explained interactive `var` type presets for recorder-supported types such as `date`, `datetime`, `time`, `CurrentTime`, `UserName`, `AiralogyMarkdown`, and `DNASequence`, so users can discover field behaviors directly from the insertion dialog.

### Changed

- Replaced the closed interactive `var` type dropdown with a freeform input plus an explained preset grid, so first-time users can choose the right type without already knowing AIMD type names.

## [1.2.3] - 2026-03-13

### Fixed

- Fixed Monaco source-mode highlighting for fenced `quiz` blocks so ````quiz` content now embeds YAML tokenization instead of falling back to plain AIMD/markdown styling.
- Fixed Monaco source-mode highlighting for fenced `assigner` blocks so `assigner runtime=client` now embeds JavaScript tokenization and default `assigner` blocks embed Python tokenization instead of falling back to plain AIMD/markdown styling.

## [1.2.1] - 2026-03-12

### Fixed

- Fixed WYSIWYG parsing/round-tripping for AIMD inline templates inside Markdown tables, so `{{var|...}}` now works without breaking table cells when switching between source and WYSIWYG modes.

## [1.1.1] - 2026-03-05

### Fixed

- Fixed AIMD inline type highlighting so `UpperCamelCase` types (for example `UserName`, `CurrentTime`, `AiralogyMarkdown`) are consistently tokenized as `type.aimd` instead of being split into mixed colors.
- Replaced case-insensitive identifier matching with explicit `[A-Za-z_]` matching to avoid Monaco regex edge cases where leading uppercase letters were not tokenized correctly.
