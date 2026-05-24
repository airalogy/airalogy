# Changelog

## 2.5.0

### Minor Changes

- 27ae467: Add `choice.options[].followups` for conditional structured fields on selected choice options, and add first-class `type: true_false` quiz support across core parsing/grading, renderer previews, and recorder inputs.
- e0e1b9f: Add AIMD numeric constraint support, source diagnostics, extracted var definition metadata, and constraint-aware client assigner dependency readiness for Pydantic-style `gt`, `ge`, `lt`, `le`, and `multiple_of` var kwargs.

### Patch Changes

- Updated dependencies [27ae467]
- Updated dependencies [e0e1b9f]
  - @airalogy/aimd-core@2.6.0

## 2.4.1

### Patch Changes

- 541d008: Configure public package release metadata for automated publishing, align internal workspace dependency ranges for published packages, and add the monorepo Changesets release workflow.
- Updated dependencies [541d008]
  - @airalogy/aimd-core@2.5.1

All notable changes to `@airalogy/aimd-renderer` will be documented in this file.

## [2.4.0] - 2026-04-14

### Added

- Added built-in preview rendering for `quiz.type: scale`, including matrix/list layouts, shared option labels with point values, and optional grading-band previews.

### Changed

- Extended renderer quiz type labels and node metadata passthrough so downstream recorder/editor integrations can preserve scale titles, descriptions, display modes, and grading metadata.

## [2.3.0] - 2026-03-19

### Changed

- Preserved parsed step timing metadata through renderer node serialization, including `estimated_duration_ms` and the new `timer_mode` so host renderers and recorder integrations can build countdown-aware step UIs.
- Aligned renderer-facing extracted field metadata with the canonical snake_case AIMD schema, including `step_hierarchy`, `parent_id`, `prev_id`, and `next_id`.

## [2.2.0] - 2026-03-19

### Added

- Added `createCustomElementAimdRenderer` plus `aimdElementRenderers` / `groupStepBodies` so host applications can map AIMD nodes into their own custom HTML elements while preserving AIMD metadata.
- Added `createStepCardRenderer()` as a reusable Vue renderer for step nodes with grouped body content, title/subtitle presentation, and result/check badges.

### Changed

- Preserved parsed step kwargs such as `title`, `subtitle`, `checked_message`, and `result` through renderer-side node metadata so host renderers can build richer custom step UIs.

## [2.1.0] - 2026-03-13

### Changed

- Aligned renderer-side extracted field fallbacks with the new `client_assigner` metadata shape so `parseAndExtract` and render helpers always expose a complete `ExtractedAimdFields` object when client assigners are present.
- Updated renderer package examples and docs to reflect that `assigner runtime=client` blocks are treated as hidden metadata rather than visible rendered code blocks.
- Changed renderer defaults so `assigner` code blocks are hidden from normal rendered output, regardless of whether they run on the server or client runtime.
- Added `assignerVisibility: "hidden" | "collapsed" | "expanded"` to HTML/Vue renderer APIs and unified token renderer options so authoring or debug views can reveal assigner code on demand.
- Localized visible assigner summaries for built-in English and Chinese renderer copy, shortened the client-facing wording, styled collapsed previews with a lower-contrast presentation, and added built-in JS/Python syntax highlighting when visible assigners are rendered.

## [2.0.2] - 2026-03-12

### Changed

- Distinguish single-choice and multiple-choice quiz labels in renderer output. Choice quizzes now render as `Single choice` / `Multiple choice` in English and `单选` / `多选` in Chinese when `mode` is available.
- Exported the renderer-side quiz type label helper so downstream packages such as `@airalogy/aimd-recorder` can share the same single-choice vs multiple-choice label logic.

## [2.0.1] - 2026-03-12

### Changed

- In Vue/edit rendering, `ref_var` now prefers the current recorded variable value as a readonly inline reference when `context.value.var[refTarget]` is available, while keeping the raw var id in metadata (`title` / `data-aimd-ref`).
- Refined default `ref_step` rendering to reuse step-like field styling instead of the generic reference blockquote look, making inline step references visually closer to normal step labels.

### Fixed

- Fixed Vue/edit `ref_step` rendering so step references keep their localized step sequence (`Step 1`, `Step 1.1`, etc.) instead of incorrectly falling back to the raw step id in recorder-driven rendering.

## [2.0.0] - 2026-03-12

### Changed

- Unified the renderer-side AIMD identifier cleanup into a single breaking release: parsed/extracted metadata now uses `id` as the only identifier field.
- Removed deprecated AIMD `name` compatibility fields from renderer-facing node metadata and extracted field objects.
- Removed deprecated `data-aimd-name` output. Consumers should use `data-aimd-id`.

## [1.4.1] - 2026-03-12

### Changed

- Fixed inline AIMD fields inside Markdown tables so `{{var|...}}` works directly without requiring the Markdown escape form `{{var\|...}}`.

## [1.4.0] - 2026-03-12

### Added

- Added built-in runtime locale support for renderer output via `locale` (`en-US` / `zh-CN`) across HTML, Vue, and unified renderer APIs.
- Added `messages` overrides plus exported locale helpers (`createAimdRendererMessages`, `resolveAimdRendererLocale`) for custom copy control.

## [1.3.0] - 2026-03-05

### Changed

- Enabled browser-side automatic KaTeX stylesheet loading when calling async render APIs (`renderToHtml`, `renderToVue`), so math rendering works out of the box without extra style wiring in typical usage.

### Added

- Added public style entry `@airalogy/aimd-renderer/styles` for manual style preloading/custom loading flows.
- Added `katex` as a direct dependency to guarantee stylesheet availability for consumers.
