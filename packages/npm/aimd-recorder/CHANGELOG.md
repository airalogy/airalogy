# Changelog

## 1.24.1

### Patch Changes

- e9624bd: Ship the React type declarations required by the published SeqViz-backed Vue component source.

## 1.24.0

### Minor Changes

- 1a94eef: Add Pydantic JSON Schema-backed Record validation, immediate field-level feedback, exact table-cell errors, and shared validation APIs to `AimdRecorder` and `AimdRecorderEditor`.

## 1.23.0

### Minor Changes

- 0ae5bc4: Add Collector syntax, typed Observation models, cross-language parser validation, and recorder controls for host-provided snapshot and polling data sources with authorization, cancellation, provenance, and explicit manual fallback.
- f2960ed: Add connector metadata blocks, the built-in `EntityRef` type, recorder entity-reference controls backed by host-provided resolvers, and Python/npm runtime helpers for executing `entity_source` connector descriptors.

### Patch Changes

- bfc07f9: Rename the recorder search toggle to clarify that it searches the current record.
- Updated dependencies [e761b99]
- Updated dependencies [0ae5bc4]
- Updated dependencies [f2960ed]
- Updated dependencies [7ddd040]
- Updated dependencies [fbed3e6]
  - @airalogy/aimd-editor@1.11.0
  - @airalogy/aimd-core@2.14.0
  - @airalogy/aimd-renderer@2.11.0

## 1.22.0

### Minor Changes

- feb8623: Add protocol-aware record field search and filtering utilities, and expose a collapsed, sticky current-record search control in `AimdRecorder`.

### Patch Changes

- Updated dependencies [feb8623]
- Updated dependencies [53b2b6f]
  - @airalogy/aimd-core@2.13.0
  - @airalogy/aimd-renderer@2.10.0

## 1.21.0

### Minor Changes

- e6cbe13: Render `list[str]`, `list[int]`, and `list[float]` variables as full-row recorder fields with repeatable, drag-reorderable item inputs plus a JSON array mode.

### Patch Changes

- 6947d33: Keep complex Markdown tables with embedded recorder fields inside the recorder width by making the table area horizontally scrollable and constraining long variable labels inside table cells.
- 67cfd5b: Render nullable boolean variables such as `bool | None` and `Optional[bool]` as tri-state select fields instead of text inputs.
- d9bcb48: Preserve `None` semantics for nullable variable fields by storing empty nullable scalar, datetime, enum, and file values as `null`.
- 9cea118: Show a localized "Not set" option for nullable enum selects instead of a blank option label.
- 0e63459: Render long scalar list text items as full-row controls even when they wrap without explicit newline characters.
- ba4bae5: Show long variable IDs completely inside markdown tables by wrapping stacked variable titles instead of truncating them.

## 1.20.0

### Minor Changes

- c353d3d: Add the built-in `BloodType` protocol field type for common ABO and Rh blood group values.

  Generate AIMD built-in type metadata from the Python `airalogy.types` registry, and let `@airalogy/aimd-core` and `@airalogy/aimd-recorder` use official enum metadata so named built-in types such as `BloodType` render as recorder select fields without duplicating enum definitions in npm packages.

### Patch Changes

- 682ddf5: Add an optional `initialSourceCollapsed` prop to `AimdRecorderEditor` so embedded recorder surfaces can open directly on the record form while still allowing users to expand the source panel.
- Updated dependencies [19350d6]
- Updated dependencies [c353d3d]
- Updated dependencies [682ddf5]
  - @airalogy/aimd-core@2.12.0
  - @airalogy/aimd-renderer@2.9.1

## 1.19.2

### Patch Changes

- 36a5fef: Add default prose typography for rendered AIMD documents inside an `.aimd-renderer` container, including clearer heading hierarchy, visible list markers, and more compact body line height. Recorder rendered content and markdown previews now inherit those renderer prose styles instead of keeping a separate heading/list treatment.
- 4328cd2: Keep step body text, markdown fields, and variable tables constrained within the step card width.
- b5c5646: Rename the internal renderer stylesheet to `renderer.css` and the recorder stylesheet to `recorder.css` while keeping the public `@airalogy/aimd-renderer/styles` and `@airalogy/aimd-recorder/styles` imports stable.

  Make the recorder stylesheet import the renderer stylesheet and layer recorder-specific editing styles on top. Browser render helpers now load the renderer stylesheet as the canonical renderer CSS entry instead of treating it as math-only KaTeX styles.

- 4c8bfdc: Let stacked variable fields expand to fit long metadata keys, preventing long var IDs from wrapping or truncating inside recorder field headers.
- Updated dependencies [36a5fef]
- Updated dependencies [ffa32e1]
- Updated dependencies [69922a8]
- Updated dependencies [b5c5646]
  - @airalogy/aimd-renderer@2.9.0
  - @airalogy/aimd-editor@1.10.0
  - @airalogy/aimd-core@2.11.0

## 1.19.1

### Patch Changes

- 2973a29: Keep `AimdRecorderEditor` source and recorder panels contained inside the fitted workbench height so long AIMD documents scroll inside the editor instead of stretching the host page.

  Add a `fillParent` layout mode for embedding `AimdRecorderEditor` inside route-level flex workspaces and other bounded host panes.

  Also pass quiz grading, submitted state, and quiz explanation display options through the combined editor and recorder-side visual editing surface.

- 0eb389f: Add first-class AIMD `refs` BibTeX block support across Python and npm parsers, expose structured references in extracted fields, and render numbered citation markers plus generated references lists in HTML, Vue, recorder styles, and Airalogy Reader. Citation markers now display compact non-navigating markers such as `[1]` based on refs-list order, show selectable reference popovers on hover or keyboard focus, preserve the original BibTeX key in metadata, and place generated references lists at the end of the rendered AIMD document.

  Add a renderer-level `resolveAssetUrl` hook for protocol-local figure assets, and wire the recorder's existing `resolveFile` prop into figure rendering so hosts can keep clean relative `fig` sources while displaying packaged or archived assets correctly.

  Refine rendered figure styling so images, figure titles, and legends appear as one attached framed figure block across renderer, recorder, demo, and Reader surfaces.

  Render AIMD internal reference markers with route-safe target metadata instead of bare hash hrefs, and let the demo scroll within the current AIMD container when users activate those references.

- Updated dependencies [2d981a0]
- Updated dependencies [0eb389f]
  - @airalogy/aimd-core@2.10.0
  - @airalogy/aimd-renderer@2.8.0

## 1.19.0

### Minor Changes

- b1d713e: Add shared AIMD Record display utilities for field value normalization, FileId detection, file input metadata, asset kind inference, and readonly display coercion.

  Reuse the shared utilities from AIMD readonly rendering and Recorder var helpers so Record-backed document views and interactive field controls resolve file, code, markdown, DNA, boolean, and scalar values through the same semantics.

  Organize readonly Record var rendering behind an internal value-renderer registry so future field displays can be added without expanding a single conditional chain.

  Add a lightweight `@airalogy/aimd-recorder/record` entry for Record state, timer, DNA value, and display utility helpers without importing the full Recorder component surface.

### Patch Changes

- 565f785: Add CriticMarkup-style review mark parsing and rendering for Airalogy Markdown additions, deletions, substitutions, comments, and highlights.
- b8a3fbe: Keep assigner controls visible for structured `list[...]` and object-like var fields after assigners populate them, and render those values as editable JSON text instead of lossy string coercions.
- f7adb0c: Tighten card-style table row spacing, controls, and input heights for denser recorder tables.

  Show visible row numbers in both table and card var_table layouts.

  Show the running assigner state across every field in the same shared server assigner batch.

  Unify completed assigner status colors across normal and Markdown-backed fields.

  Add a reusable AIMD assigner topology graph component for package consumers.

- Updated dependencies [c1903cd]
- Updated dependencies [b1d713e]
- Updated dependencies [0355d77]
- Updated dependencies [b8a3fbe]
- Updated dependencies [565f785]
- Updated dependencies [dea7d73]
  - @airalogy/aimd-core@2.9.0
  - @airalogy/aimd-renderer@2.7.0

## 1.18.0

### Minor Changes

- e73eefa: Preserve AIMD `title`, `description`, and `example`/`examples` metadata for `var` and `var_table` fields, with default renderer and recorder labels showing titles and keeping description/example details behind hover/focus popovers.
- 5732108: Add the generic `CodeStr` code-string type to `airalogy.types` so AIMD fields such as `{{var|script: CodeStr}}` generate valid Python models while recorder UIs can present them as plain code editors.

  Allow AIMD var-table defaults to contain multiline object-list values, expose those defaults through extracted field metadata, and initialize recorder var-table rows from those defaults without overwriting user-entered rows.

  Run auto server assigners when their dependencies become available, and mount server assigner controls inside built-in `AiralogyMarkdown` fields that support inline assigner actions.

  Add a rendered preview mode to the built-in recorder `AiralogyMarkdown` field, including Mermaid code block rendering for generated Markdown outputs.

- 5f318e1: Refine recorder var-field presentation by normalizing value typography across text, numeric, date/time, and select controls, clipping plain stacked-field corners consistently, and keeping table-cell input text upright.

  Add built-in file-like var controls for CSV, image, audio, video, and document types, including native file pickers, accept-type inference, serializable local file metadata, reusable file-card previews, and `uploadFile`/`resolveFileInfo` hooks so host apps can return Airalogy file IDs while the recorder renders filenames, sizes, download links, image previews, and compact CSV previews.

  Allow the Python `Airalogy` client to be configured with an explicit `base_url` while preserving environment-variable defaults, so local demos and self-hosted Airalogy-compatible services can use the same file APIs as hosted Airalogy. `AIRALOGY_BASE_URL` is the preferred environment variable; `AIRALOGY_ENDPOINT` remains supported as a deprecated fallback.

  Add a local file bridge for sandboxed engine runs so assigners can read uploaded Airalogy file IDs and write generated file outputs without requiring the sandbox to reach the host demo server over HTTP.

  Move generic assigner UI orchestration into `@airalogy/aimd-recorder` through a `serverAssigners` metadata prop and `runServerAssigner` hook, letting host apps provide only the execution transport while the recorder handles dependency filtering, loading/error state, and `assigned_fields` record updates.

  Surface server assigner business failures returned as `success: false` / `error_message` through the shared recorder assigner state, so built-in plugin fields such as `AiralogyMarkdown` show the same inline error UI as regular var fields.

  Limit engine assigner validation to each assigner's declared `dependent_fields`, so unrelated empty output fields in a record do not fail Pydantic validation before the selected assigner runs.

  Validate local engine rootfs directories as OCI layouts and export the generated rootfs with Docker Buildx OCI output, preventing incomplete rootfs directories from being treated as runnable sandboxes. The local rootfs build now installs the workspace `airalogy` Python package and includes that source in the rootfs fingerprint.

### Patch Changes

- 47532f6: Parse AIMD `Literal[...]` and `enum=[...]` var definitions into enum metadata, and render recorder `var` and `var_table` enum fields as select controls while preserving non-string option values.
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
- Updated dependencies [ede7afd]
  - @airalogy/aimd-core@2.8.0
  - @airalogy/aimd-renderer@2.6.0

## 1.17.0

### Minor Changes

- 808ab4a: Improve check field recording cards with pass/open visual states, remove the duplicate read-only checkbox from bare checks, and reuse the AIMD note editor for check annotations.
- 65822de: Add `true_false.options[].followups` support, preserving plain boolean answers for ordinary true/false quizzes while using structured `{ selected, followups }` answers when followups are defined.

### Patch Changes

- Updated dependencies [65822de]
  - @airalogy/aimd-core@2.7.0

## 1.16.0

### Minor Changes

- 735776f: feat: improve quiz field editing

  - Auto-generate quiz IDs based on type and check existing IDs to avoid duplicates
  - Reset stem and all type-specific fields when changing quiz type
  - Change default blank answer from '21%' to empty string
  - Choice options default to empty text
  - Move 'Correct Answer' column to last position
  - Add leading newline when inserting at non-line-start position

### Patch Changes

- Updated dependencies [735776f]
  - @airalogy/aimd-editor@1.9.0

## 1.15.0

### Minor Changes

- 27ae467: Add `choice.options[].followups` for conditional structured fields on selected choice options, and add first-class `type: true_false` quiz support across core parsing/grading, renderer previews, and recorder inputs.
- e0e1b9f: Add AIMD numeric constraint support, source diagnostics, extracted var definition metadata, and constraint-aware client assigner dependency readiness for Pydantic-style `gt`, `ge`, `lt`, `le`, and `multiple_of` var kwargs.

### Patch Changes

- Updated dependencies [27ae467]
- Updated dependencies [e0e1b9f]
  - @airalogy/aimd-core@2.6.0
  - @airalogy/aimd-renderer@2.5.0
  - @airalogy/aimd-editor@1.8.0

## 1.14.1

### Patch Changes

- 541d008: Configure public package release metadata for automated publishing, align internal workspace dependency ranges for published packages, and add the monorepo Changesets release workflow.
- Updated dependencies [541d008]
  - @airalogy/aimd-core@2.5.1
  - @airalogy/aimd-editor@1.7.1
  - @airalogy/aimd-renderer@2.4.1

All notable changes to `@airalogy/aimd-recorder` will be documented in this file.

## [Unreleased]

## [1.14.0] - 2026-04-14

### Added

- Added built-in recorder UI for `quiz.type: scale`, with matrix/list layouts, shared option sets, local deterministic scoring, and band/classification display.
- Added `scaleGradeDisplayMode` on `AimdRecorder` and `AimdQuizRecorder` so host apps can choose whether scale scores/classifications stay hidden, appear after completion, or appear only after submission.

### Changed

- Extended recorder record-state defaults and field-editing snippets so `scale` quizzes round-trip through recorder/editor flows using `item_key -> option_key` answer maps.

## [1.13.0] - 2026-04-02

### Added

- Added `quizGrades` on `AimdRecorder` and `grade` on `AimdQuizRecorder` so host apps can render quiz score, status, review flags, and feedback directly under quiz widgets.
- Added `choiceOptionExplanationMode` on `AimdRecorder` and `AimdQuizRecorder` so hosts can optionally reveal per-option `explanation` text for selected choice answers immediately, only after submission, or only after grading.
- Added `submitted` on `AimdRecorder` and `AimdQuizRecorder` so host apps can explicitly control post-submit explanation reveal flows without tying them to grading timing.

### Changed

- Styled quiz grading panels with status-specific color cues so `correct`, `incorrect`, `partial`, `needs_review`, and `error` states are visually distinct at a glance.

## [1.12.0] - 2026-03-26

### Added

- Added `AimdRecorderEditor`, a combined protocol editor + recorder surface that binds AIMD source editing and recorder entry to the same `content` / `record` state.
- Added detached-record visibility in `AimdRecorderEditor` so hosts can surface values whose field ids are no longer present after protocol restructuring, renaming, or field removal.
- Added recorder-side field structure editing in `AimdRecorderEditor`, including kind switching, id editing, inline `var` value-type editing, add/delete actions, and source-fragment reordering.
- Added a recorder-aware WYSIWYG mode in `AimdRecorderEditor`, so users can place the caret anywhere, keep writing normal Markdown, and see `var`, `var_table`, `step`, `check`, and `quiz` fields rendered as their real recorder widgets while filling the same live `record`.
- Added in-place recorder-widget controls so fields can be edited or deleted directly from the rendered WYSIWYG surface instead of relying only on a separate structure panel.
- Added `allowRawFieldSourceEditing` so hosts can disable raw AIMD snippet editing inside the recorder-side field dialog while still allowing structured kind/id/value-type edits.
- Added viewport-fitting layout behavior, including `fitViewport` and `viewportOffset`, so editor and recorder columns can expand to the remaining browser height by default while still allowing fixed-height layouts.

### Changed

- Renamed the unpublished combined protocol-authoring surface from `AimdRecorderWorkbench` to `AimdRecorderEditor` before release, without keeping a compatibility alias for the unpublished old export.
- Reworked the right-side workflow into a tabbed recorder/editor workspace so `Recorder`, `Record Data`, detached-data inspection, and optional structure editing stay near the main workflow instead of being pushed below long AIMD documents.
- Made the separate `Field Structure` helper tab opt-in (`showFieldStructure` defaults to `false`) so the main workflow stays focused on source editing, recorder entry, and the caret-based WYSIWYG authoring mode.
- Reworked recorder-side WYSIWYG insertion and dragging to follow Milkdown/ProseMirror document positions so field widgets can be moved to arbitrary caret-valid locations inside the rendered AIMD flow instead of only reordering source fragments in a side list.
- Reworked recorder-aware WYSIWYG field controls into contextual field-attached hover/focus toolbars so edit, delete, and drag actions stay close to each rendered widget without polluting normal recorder mode.
- Added a visible recorder-side WYSIWYG drop indicator during drag operations so users can place rendered field widgets more precisely.

### Fixed

- Fixed `AimdRecorderEditor` source-side typing stability by buffering AIMD content locally and ignoring stale parent echo updates, so rapid typing in the left source editor no longer snaps the cursor back to the start or causes visible flicker.
- Fixed split source + recorder-aware visual editing so the right-side WYSIWYG now batches incoming source updates instead of rebuilding the Milkdown surface on every keystroke, reducing left/right flicker while typing in the source editor with visual mode enabled.
- Fixed split source + recorder-aware visual editing feedback loops by treating the currently focused content surface as authoritative and ignoring stale recorder-side visual echoes of recent source drafts, preventing left/right oscillation between older and newer markdown states after fast source typing.
- Fixed right-side recorder/editor panels so long content stays inside a fixed-height internal scroll area instead of expanding the entire layout.
- Fixed viewport-fitting layout so the recorder-side visual edit workflow keeps the left and right columns balanced, with the WYSIWYG editor sized to the remaining panel height instead of stretching past its scroll area.
- Fixed recorder-aware WYSIWYG inline field rendering so recorder-editable AIMD nodes now mount their real recorder inputs/widgets instead of falling back to the generic AIMD chip view.
- Fixed recorder-aware WYSIWYG syncing so opening visual edit mode no longer leaks protected AIMD placeholder tokens or accidental Milkdown editor DOM markup back into the shared AIMD content.
- Fixed recorder-aware WYSIWYG parsing by layering recorder widget plugins on top of the base AIMD Milkdown plugin chain with recorder-specific mdast node types, so inline recorder fields no longer regress into protected placeholder tokens when visual edit mode opens.
- Fixed recorder-aware WYSIWYG serialization so inline recorder fields round-trip as markdown text and quiz widgets round-trip as real ` ```quiz ` code blocks, preventing visual edit mode from regressing into literal `<p>...AIMDINLINETEMPLATE...` output on reopen.

## [1.11.0] - 2026-03-19

### Added

- Added built-in step timing support driven by AIMD `duration`, including protocol-level estimated duration summaries, per-step elapsed timers, and persisted recorder-side timing fields (`elapsed_ms`, `timer_started_at_ms`, `started_at_ms`, `ended_at_ms`).
- Added countdown-aware step timer modes from AIMD `timer="elapsed|countdown|both"`, including remaining-time display, overtime display after zero, and warning styling as the countdown approaches completion.
- Added an embedded AiralogyMarkdown editor for step annotations so step notes can store longer formatted markdown content instead of being limited to a single-line plain-text input.
- Added `stepDetailDisplay: "auto" | "always"` on `AimdRecorder` so hosts can keep step timer and note details progressively disclosed by default or force them permanently expanded.

### Changed

- Reworked built-in step rendering into a compact primary row plus on-demand detail area so empty notes and unused timer controls no longer occupy space by default, while existing notes and active timers stay visible.
- Normalized recorder-facing AIMD step metadata and persisted step-timer state to snake_case so recorder JSON matches the rest of the AIMD / Airalogy data model.

## [1.10.0] - 2026-03-19

### Added

- Added built-in recorder support for Airalogy code-string types (`CodeStr`, `PyStr`, `JsStr`, `TsStr`, `JsonStr`, `TomlStr`, `YamlStr`), rendering them in a Monaco-based code editor with language-appropriate highlighting where available.
- Added `fieldMeta.codeLanguage` plus code-aware `fieldMeta.inputType` overrides so host apps can force a recorder var field into a code editor and choose the Monaco language explicitly for custom string types.

### Fixed

- Refined compact recorder var input sizing so `str` fields behave like autosizing inline text inputs that expand horizontally, then wrap and grow in height at the available width limit, while `number` fields now also resize with typed content without switching to multiline editing.

## [1.9.0] - 2026-03-19

### Changed

- Replaced the built-in `AiralogyMarkdown` recorder textarea with a full-width embedded AIMD/Markdown editor that opens in `Source` mode by default, still supports switching to `WYSIWYG`, and lifts inline occurrences into their own block row while keeping the same type token and plugin override path.

### Fixed

- Stabilized recorder subtree rendering during input updates so inline fields no longer flash, lose typed characters, or jump scroll position when parent `v-model` state echoes back into the recorder.

## [1.8.0] - 2026-03-19

### Added

- Added `typePlugins` on `AimdRecorder` so host applications can attach per-type initialization, normalization, display/parsing hooks, and dedicated widgets for custom AIMD var types.
- Exported recorder-side type plugin helpers and types so custom recorder integrations can share a stable typed contract.

### Changed

- Migrated built-in `CurrentTime`, `UserName`, `AiralogyMarkdown`, and `DNASequence` recorder behavior onto the same type-plugin path used by custom types.

## [1.7.0] - 2026-03-19

### Added

- Added `fieldAdapters` on `AimdRecorder` so host applications can replace or wrap built-in `var`, `var_table`, `step`, `check`, and `quiz` field UIs while keeping AIMD parsing and record-state management in the recorder.
- Exported recorder-side adapter types (`AimdRecorderFieldAdapter*`) for typed host integrations that need access to the parsed node, current value, localized messages, and default recorder vnode.

## [1.6.0] - 2026-03-17

### Added

- Added a built-in `DNASequence` recorder widget for AIMD `var` fields, including editable sequence text, `linear` / `circular` topology, and GenBank-aligned subset editing for feature segments and qualifier rows.
- Added a viewer-first `DNASequence` recorder experience powered by `SeqViz`, including inline linear/circular sequence visualization, drag-to-select range creation, and click-to-focus feature selection.
- Added one-click GenBank export for `DNASequence` fields, downloading the current structured value as a `.gbk` file with sequence, topology, feature locations, and qualifier rows.
- Added an optional top-level `name` field to the `DNASequence` recorder so users can label a plasmid or construct independently from per-feature annotation names.

### Changed

- Kept the recorder-side `DNASequence` canonical payload at `airalogy_dna_v1`, while expanding the structure to support multi-segment locations, per-segment partial flags, and qualifier rows.
- Shifted the default editor from a pure form to a visual sequence workflow plus an advanced details editor for multi-segment locations, per-segment partial flags, and qualifier rows.
- Split the built-in `DNASequence` recorder into two explicit modes: a default interactive mode centered on the visual viewer and a raw structure mode for sequence text, multi-segment coordinates, and qualifier editing.
- Reduced the default DNA editor surface area so common viewer-based operations no longer compete visually with the full structured editor in the same screen.
- Reworked the interactive empty state so users can start by pasting DNA text or importing sequence-oriented FASTA / GenBank files instead of being redirected to the raw structure editor.
- Moved `DNASequence` file import into the shared top toolbar so both `Interactive` and `Raw structure` modes expose the same import/export actions.
- Defined file import and interactive sequence onboarding as replacement actions: importing or pasting a new sequence now clears existing annotations that are not reconstructed from the imported text.
- Imported FASTA / GenBank content now populates the sequence name when a header or locus name is available, and GenBank export/download filenames prefer the top-level `DNASequence.name` over the AIMD var id.

## [1.5.1] - 2026-03-13

### Added

- Added local execution support for fenced `assigner runtime=client` blocks, including `auto`, `auto_first`, and explicit `manual` triggering semantics.
- Added exposed component methods `runClientAssigner(id)` and `runManualClientAssigners()` on `AimdRecorder` for manual client assigner execution.
- Added localized recorder copy for quiz answer and rubric labels so open-question metadata stays aligned with renderer output.

### Changed

- Recorder field updates now re-run extracted client assigners and write resulting values back into `record.var` in dependency order.

### Fixed

- Fixed async inline rebuild races in `AimdRecorder` so `auto` client assigners reliably refresh downstream field displays after dependent input changes.
- Fixed client assigner execution in `AimdRecorder` by removing an invalid strict-mode `eval` shadow from the runtime compiler. `assigner runtime=client` auto assignments such as `Math.round(...)` now execute instead of silently failing with a syntax error.

## [1.4.4] - 2026-03-12

### Changed

- Aligned recorder quiz type labels with renderer output so `choice` quizzes distinguish `single` / `multiple` mode as `Single choice` / `Multiple choice` in English and `单选` / `多选` in Chinese.
- Reused the renderer-side quiz label helper in recorder locales to avoid maintaining the single-vs-multiple choice labeling logic twice.

## [1.4.3] - 2026-03-12

### Fixed

- Fixed decimal var input handling in `AimdRecorder` so `float`/`number` fields can enter values like `1.1` without the controlled input immediately collapsing the decimal point mid-typing.
- Preserved authored float default literals like `25.0` for the initial recorder display, so decimal defaults no longer collapse to `25` before the user edits the field.

## [1.4.2] - 2026-03-12

### Changed

- `AimdRecorder` now passes the live record into renderer edit context so inline `ref_var` references show the current var value as readonly content when available, instead of always showing the raw var id.
- Updated `ref_step` presentation styles so inline step references reuse the same step-like visual language instead of the generic reference blockquote styling.
- Aligned `ref_var` presentation with normal var styling by removing the generic reference block shell and faded state.
- Unified inline check label typography with var/step identifiers by raising `check` id/label weight to match the other AIMD field tags.
- Aligned recorder-mode `ref_var` colors with the recorder's actual var field palette so referenced variable values use the same blue treatment as normal var inputs.

### Fixed

- Synced with the renderer-side `ref_step` fix so recorder-mode step references keep localized step numbers instead of regressing to raw step ids.

## [1.4.0] - 2026-03-12

### Added

- Added built-in runtime locale support for recorder UI via `locale` (`en-US` / `zh-CN`) on both `AimdRecorder` and `AimdQuizRecorder`.
- Added `messages` overrides plus exported locale helpers (`createAimdRecorderMessages`, `resolveAimdRecorderLocale`) for customizing recorder labels without forking the components.

## [1.2.0] - 2026-03-05

### Changed

- Unified var header semantics to use `.aimd-field__id` for var id display and measurement, while preserving the previous visual style.
- Reworked stacked var width sizing to be content-driven (label/input measurement), with tuned date/time compensation and reduced unnecessary default min-width for single-line controls.
- Improved plain `str/text` var input behavior: long text now wraps instead of horizontal scrolling, auto-resizes by content, and keeps compact single-line alignment with other controls (`30px` baseline) plus better multiline readability.
- Fixed height conflicts caused by generic textarea min-height rules (`82px`/`78px`) so compact `str/text` fields no longer get unintentionally stretched.
- Normalized datetime-like var values to include timezone offset on both initial hydration and user re-selection.
- Renamed implementation file from `AimdProtocolRecorder.vue` to `AimdRecorder.vue`; `AimdProtocolRecorder` is kept as a deprecated export alias for compatibility.
