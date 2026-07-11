# Changelog

## 2.10.0

### Minor Changes

- 53b2b6f: Add a shared `AimdMarkdownPreview` Vue component for AIMD Markdown previews and readonly Record reports, including canonical renderer styles, template environment exposure, Mermaid integration, asynchronous rendered URL resolution, and a default-node fallback for host field adapters.

### Patch Changes

- Updated dependencies [feb8623]
  - @airalogy/aimd-core@2.13.0

## 2.9.1

### Patch Changes

- 682ddf5: Render fenced AIMD `workflow` blocks as structured Workflow UI panels with nodes, transitions, assigners, assignment mappings, and optional host-supplied run-state overlays.
- Updated dependencies [19350d6]
- Updated dependencies [c353d3d]
  - @airalogy/aimd-core@2.12.0

## 2.9.0

### Minor Changes

- 69922a8: Add AIMD `media` blocks and `ref_media` references for video, audio, ordinary files, and default media pin controls.

  Renderer hosts can resolve protocol-local media assets with `resolveAssetUrl()` using `context.kind` values of `media` and `media_poster`. Vue rendering now provides a compact default pin/unpin interaction for video and audio media, including single-item pinning, collapsed descriptions, and small, medium, and large pinned-size controls, while static HTML rendering exposes matching data attributes for host-controlled behavior.

### Patch Changes

- 36a5fef: Add default prose typography for rendered AIMD documents inside an `.aimd-renderer` container, including clearer heading hierarchy, visible list markers, and more compact body line height. Recorder rendered content and markdown previews now inherit those renderer prose styles instead of keeping a separate heading/list treatment.
- b5c5646: Rename the internal renderer stylesheet to `renderer.css` and the recorder stylesheet to `recorder.css` while keeping the public `@airalogy/aimd-renderer/styles` and `@airalogy/aimd-recorder/styles` imports stable.

  Make the recorder stylesheet import the renderer stylesheet and layer recorder-specific editing styles on top. Browser render helpers now load the renderer stylesheet as the canonical renderer CSS entry instead of treating it as math-only KaTeX styles.

- Updated dependencies [69922a8]
  - @airalogy/aimd-core@2.11.0

## 2.8.1

### Patch Changes

- c8b8066: Add a browser-compatible protocol `.aira` archive writer for AIMD files with protocol-local assets such as `files/workflow-diagram.svg`.

  Allow AIMD editor hosts to override the image toolbar action and receive the image button position so applications can offer URL figures, local uploads, or archive-aware image insertion flows from an anchored popover.

  Include AIMD field, reference, quiz, refs block, and full-width variable-table preview styles in the renderer stylesheet so static previews that import `@airalogy/aimd-renderer/styles` render AIMD tokens correctly without depending on recorder styles.

## 2.8.0

### Minor Changes

- 0eb389f: Add first-class AIMD `refs` BibTeX block support across Python and npm parsers, expose structured references in extracted fields, and render numbered citation markers plus generated references lists in HTML, Vue, recorder styles, and Airalogy Reader. Citation markers now display compact non-navigating markers such as `[1]` based on refs-list order, show selectable reference popovers on hover or keyboard focus, preserve the original BibTeX key in metadata, and place generated references lists at the end of the rendered AIMD document.

  Add a renderer-level `resolveAssetUrl` hook for protocol-local figure assets, and wire the recorder's existing `resolveFile` prop into figure rendering so hosts can keep clean relative `fig` sources while displaying packaged or archived assets correctly.

  Refine rendered figure styling so images, figure titles, and legends appear as one attached framed figure block across renderer, recorder, demo, and Reader surfaces.

  Render AIMD internal reference markers with route-safe target metadata instead of bare hash hrefs, and let the demo scroll within the current AIMD container when users activate those references.

### Patch Changes

- Updated dependencies [2d981a0]
- Updated dependencies [0eb389f]
  - @airalogy/aimd-core@2.10.0

## 2.7.0

### Minor Changes

- 0355d77: Add SHA-256-backed `.aira` archive inspection and validation for the Python archive API and CLI.

  Add the browser-readable `@airalogy/aira-core` parser/validator package and a static Airalogy Reader app for opening `.aira` files locally.

  Render AIMD protocol content inside Airalogy Reader with `@airalogy/aimd-renderer`, including Record-backed field values when a `.aira` archive carries protocol records.

  Add readonly Record rendering helpers to `@airalogy/aimd-renderer` so Vue hosts can render AIMD protocols with static Record data embedded in the matching fields, including host-resolved file and image assets.

  Polish readonly Record rendering so user-facing content defaults to readable labels while keeping field identifiers in metadata for advanced views such as Airalogy Reader's optional Show field IDs toggle.

  Add a Tauri desktop wrapper for Airalogy Reader so the same local archive viewer can be packaged as installable macOS, Windows, and Linux apps.

- 565f785: Add CriticMarkup-style review mark parsing and rendering for Airalogy Markdown additions, deletions, substitutions, comments, and highlights.

### Patch Changes

- b1d713e: Add shared AIMD Record display utilities for field value normalization, FileId detection, file input metadata, asset kind inference, and readonly display coercion.

  Reuse the shared utilities from AIMD readonly rendering and Recorder var helpers so Record-backed document views and interactive field controls resolve file, code, markdown, DNA, boolean, and scalar values through the same semantics.

  Organize readonly Record var rendering behind an internal value-renderer registry so future field displays can be added without expanding a single conditional chain.

  Add a lightweight `@airalogy/aimd-recorder/record` entry for Record state, timer, DNA value, and display utility helpers without importing the full Recorder component surface.

- dea7d73: Render readonly `AiralogyMarkdown` record values through the AIMD Vue renderer so completed records display Markdown structure, nested AIMD preview tokens, and resolved Markdown image assets instead of raw Markdown text.
- Updated dependencies [c1903cd]
- Updated dependencies [b1d713e]
- Updated dependencies [b8a3fbe]
- Updated dependencies [565f785]
  - @airalogy/aimd-core@2.9.0

## 2.6.0

### Minor Changes

- e73eefa: Preserve AIMD `title`, `description`, and `example`/`examples` metadata for `var` and `var_table` fields, with default renderer and recorder labels showing titles and keeping description/example details behind hover/focus popovers.

### Patch Changes

- ede7afd: Render markdown code blocks with reusable Shiki-backed Vue code block rendering, including line numbers and soft wrapping that keeps wrapped lines aligned with the code column.

  Allow the recorder workbench source and recording panels to be resized, and let users collapse the source panel when they need more room for the recorder.

  Make block recorder fields such as AiralogyMarkdown, step, and check cards fill the available recorder panel width.

  Make CodeStr, PyStr, and AiralogyMarkdown recorder editors start at a compact one-line height and grow with their content.

  Show manual Assigner controls on every field declared in a shared server assigner's assigned_fields list.

  Place var table Assigner controls in the table header so assigned table fields keep their full-width card layout.

  Place CodeStr and PyStr Assigner controls in the field header instead of an external side button.

  Use the shared compact Monaco auto-height behavior for note, markdown, and code editors.

  Keep step notes after the step body and use one note entry point: body-end for steps with body content, header for bodyless steps.

  Add a preview/source switch to step note editors and keep internal mode changes from being treated as field blur.

  Make step note and timer toggle buttons more compact so dense protocols use less space.

- Updated dependencies [e73eefa]
- Updated dependencies [5732108]
- Updated dependencies [47532f6]
  - @airalogy/aimd-core@2.8.0

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
