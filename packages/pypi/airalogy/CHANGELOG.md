# CHANGELOG

## 0.15.0

### Minor Changes

- 0ae5bc4: Add Collector syntax, typed Observation models, cross-language parser validation, and recorder controls for host-provided snapshot and polling data sources with authorization, cancellation, provenance, and explicit manual fallback.
- f2960ed: Add connector metadata blocks, the built-in `EntityRef` type, recorder entity-reference controls backed by host-provided resolvers, and Python/npm runtime helpers for executing `entity_source` connector descriptors.

## 0.14.1

### Patch Changes

- 19350d6: Add fenced `workflow` block parsing for `workflow.aimd` documents, including typed workflow nodes, transitions, Python assigner declarations, permission metadata, retry limits, and extracted field metadata.
- c353d3d: Add the built-in `BloodType` protocol field type for common ABO and Rh blood group values.

  Generate AIMD built-in type metadata from the Python `airalogy.types` registry, and let `@airalogy/aimd-core` and `@airalogy/aimd-recorder` use official enum metadata so named built-in types such as `BloodType` render as recorder select fields without duplicating enum definitions in npm packages.

- 48dafbc: Package official protocol examples and expose them through `airalogy.examples.protocols` by Airalogy Protocol id.

## 0.14.0

### Minor Changes

- 69922a8: Add AIMD `media` blocks and `ref_media` references for video, audio, ordinary files, and default media pin controls.

  Renderer hosts can resolve protocol-local media assets with `resolveAssetUrl()` using `context.kind` values of `media` and `media_poster`. Vue rendering now provides a compact default pin/unpin interaction for video and audio media, including single-item pinning, collapsed descriptions, and small, medium, and large pinned-size controls, while static HTML rendering exposes matching data attributes for host-controlled behavior.

## 0.13.0

### Minor Changes

- 0eb389f: Add first-class AIMD `refs` BibTeX block support across Python and npm parsers, expose structured references in extracted fields, and render numbered citation markers plus generated references lists in HTML, Vue, recorder styles, and Airalogy Reader. Citation markers now display compact non-navigating markers such as `[1]` based on refs-list order, show selectable reference popovers on hover or keyboard focus, preserve the original BibTeX key in metadata, and place generated references lists at the end of the rendered AIMD document.

  Add a renderer-level `resolveAssetUrl` hook for protocol-local figure assets, and wire the recorder's existing `resolveFile` prop into figure rendering so hosts can keep clean relative `fig` sources while displaying packaged or archived assets correctly.

  Refine rendered figure styling so images, figure titles, and legends appear as one attached framed figure block across renderer, recorder, demo, and Reader surfaces.

  Render AIMD internal reference markers with route-safe target metadata instead of bare hash hrefs, and let the demo scroll within the current AIMD container when users activate those references.

## 0.12.0

### Minor Changes

- 0355d77: Add SHA-256-backed `.aira` archive inspection and validation for the Python archive API and CLI.

  Add the browser-readable `@airalogy/aira-core` parser/validator package and a static Airalogy Reader app for opening `.aira` files locally.

  Render AIMD protocol content inside Airalogy Reader with `@airalogy/aimd-renderer`, including Record-backed field values when a `.aira` archive carries protocol records.

  Add readonly Record rendering helpers to `@airalogy/aimd-renderer` so Vue hosts can render AIMD protocols with static Record data embedded in the matching fields, including host-resolved file and image assets.

  Polish readonly Record rendering so user-facing content defaults to readable labels while keeping field identifiers in metadata for advanced views such as Airalogy Reader's optional Show field IDs toggle.

  Add a Tauri desktop wrapper for Airalogy Reader so the same local archive viewer can be packaged as installable macOS, Windows, and Linux apps.

### Patch Changes

- 0ebd143: Support `.aira` record archives with optional file references and offline blob payloads under `blobs/sha256/`.
- 00ad822: Support `.aira` protocol bundle archives containing multiple Protocol directories without Record payloads.

## 0.11.0

### Minor Changes

- 5732108: Add the generic `CodeStr` code-string type to `airalogy.types` so AIMD fields such as `{{var|script: CodeStr}}` generate valid Python models while recorder UIs can present them as plain code editors.

  Allow AIMD var-table defaults to contain multiline object-list values, expose those defaults through extracted field metadata, and initialize recorder var-table rows from those defaults without overwriting user-entered rows.

  Run auto server assigners when their dependencies become available, and mount server assigner controls inside built-in `AiralogyMarkdown` fields that support inline assigner actions.

  Add a rendered preview mode to the built-in recorder `AiralogyMarkdown` field, including Mermaid code block rendering for generated Markdown outputs.

### Patch Changes

- 5f318e1: Refine recorder var-field presentation by normalizing value typography across text, numeric, date/time, and select controls, clipping plain stacked-field corners consistently, and keeping table-cell input text upright.

  Add built-in file-like var controls for CSV, image, audio, video, and document types, including native file pickers, accept-type inference, serializable local file metadata, reusable file-card previews, and `uploadFile`/`resolveFileInfo` hooks so host apps can return Airalogy file IDs while the recorder renders filenames, sizes, download links, image previews, and compact CSV previews.

  Allow the Python `Airalogy` client to be configured with an explicit `base_url` while preserving environment-variable defaults, so local demos and self-hosted Airalogy-compatible services can use the same file APIs as hosted Airalogy. `AIRALOGY_BASE_URL` is the preferred environment variable; `AIRALOGY_ENDPOINT` remains supported as a deprecated fallback.

  Add a local file bridge for sandboxed engine runs so assigners can read uploaded Airalogy file IDs and write generated file outputs without requiring the sandbox to reach the host demo server over HTTP.

  Move generic assigner UI orchestration into `@airalogy/aimd-recorder` through a `serverAssigners` metadata prop and `runServerAssigner` hook, letting host apps provide only the execution transport while the recorder handles dependency filtering, loading/error state, and `assigned_fields` record updates.

  Surface server assigner business failures returned as `success: false` / `error_message` through the shared recorder assigner state, so built-in plugin fields such as `AiralogyMarkdown` show the same inline error UI as regular var fields.

  Limit engine assigner validation to each assigner's declared `dependent_fields`, so unrelated empty output fields in a record do not fail Pydantic validation before the selected assigner runs.

  Validate local engine rootfs directories as OCI layouts and export the generated rootfs with Docker Buildx OCI output, preventing incomplete rootfs directories from being treated as runnable sandboxes. The local rootfs build now installs the workspace `airalogy` Python package and includes that source in the rootfs fingerprint.

## 0.10.0 (20260507)

### Features

- Add `true_false.options[].followups` syntax, with structured `{ selected, followups }` answers only when followups are present while preserving plain boolean answers for ordinary judgment questions.
- Add `airalogy.ingest.import_records()` for importing CSV, TSV, JSON, and JSON Lines rows into protocol-scoped Airalogy Record JSON with Pydantic variable validation, quiz answer validation, step/check validation, record id generation, protocol metadata, and deterministic `metadata.sha1`.
- Add the `airalogy import-records` / `airalogy ir` CLI for batch Record import workflows.
- Add AIMD/model compatibility checks so `model.py::VarModel` may strengthen or override AIMD-declared variables, AIMD-only variables are retained, but model-only variable fields and explicit same-field scalar type conflicts fail validation.
- Validate AIMD/model compatibility during `airalogy check`, batch import, protocol archive packaging, and record bundle protocol embedding.

### Documentation

- Document true/false followup syntax and recorder answer shape.
- Add English and Chinese batch import API docs and sidebar entries.
- Document AIMD/model aggregation and override semantics, including the rule that `data.var` field identity remains AIMD-defined.
- Document protocol validation during archive packaging.

## 0.9.0 (20260423)

### Features

- Add `choice.options[].followups` syntax for option-conditioned structured fields, with parsed field metadata, record validation, and grading support that reads the selected option from structured answers.
- Add `quiz.type: true_false` for judgment questions, including boolean answer/default normalization, default true/false options, record validation, and local grading support.

### Documentation

- Document choice followup syntax and the corresponding structured `data.quiz` answer shape.
- Document true/false quiz syntax and boolean `data.quiz` answer storage.

### Changed

- Refactor the AIMD parser implementation from a single large module into a `airalogy.markdown.parser` package while preserving public parser imports.

## 0.8.0 (20260414)

### Features

- Add `quiz.type: scale` to AIMD syntax, including shared `items`, per-option numeric `points`, `display` hints, deterministic `sum` grading, and optional score `bands` for questionnaire-style instruments.
- Add record validation and grading support for scale answers stored as `item_key -> option_key` mappings, including local score calculation and band/classification results.

### Documentation

- Document scale-style quiz syntax, the corresponding `data.quiz` answer shape, and the separation between raw questionnaire answers and derived grade reports.

## 0.7.0 (20260402)

### Features

- Add first-class `quiz.grading` syntax for AIMD quiz blocks, covering partial-credit choice grading, normalized/numeric blank grading, rubric-based open-question grading, and provider-oriented LLM grading metadata.
- Add `choice.grading.option_points` so choice questions can score directly from selected options, including partial-credit single-choice and multi-select penalty schemes.
- Add optional `choice.options[].explanation` syntax so individual choice options can carry learner-facing explanations without affecting grading.
- Add `airalogy.record` grading helpers for single quiz items and full quiz submissions, returning structured grade reports with total score, per-question status, and review-required flags.

### Documentation

- Document quiz auto-grading workflows, recommended provider usage, and the separation between raw answers in `data.quiz` and external grade reports.

## 0.6.0 (20260401)

### Features

- Add zip-based single-file Airalogy archives under the unified `.aira` suffix, with the concrete payload type stored in `_airalogy_archive/manifest.json` via `kind` such as `protocol` or `records`.
- Add `airalogy pack` and `airalogy unpack` CLI commands, including optional protocol embedding for record bundles and safe extraction checks that reject path traversal entries.
- Exclude `.env` plus common cache artifacts from packed protocol archives by default so protocol sharing does not accidentally leak local secrets.

### Documentation

- Document the new archive packaging workflow in the README and add dedicated English and Chinese API docs for the unified `.aira` format.

## 0.5.0 (20260319)

### Features

- Add `step.duration` parsing to Airalogy AIMD step syntax, preserving the authored duration string while normalizing it to `estimated_duration_ms` for downstream estimation and UI use.
- Add optional `step.timer` parsing with `elapsed`, `countdown`, and `both` modes so AIMD protocols can declare countdown-oriented step timing behavior without introducing a second time field.

### Documentation

- Update English and Chinese AIMD step syntax docs and README examples to document `duration` plus `timer`-based countdown semantics.

### Changed

- Keep Airalogy's Python-side AIMD step metadata in canonical snake_case and align the companion JS/TS AIMD packages to the same public field names such as `step_hierarchy`, `estimated_duration_ms`, and `timer_mode`.

## 0.4.0 (20260319)

### Features

- Add an explicit `airalogy.types.registry` API so official and third-party AIMD types can be registered through stable descriptors instead of patching `airalogy.types.__all__`.
- Teach `generate_model()` to resolve imports from the type registry, allowing registered external types to generate imports from their own Python modules.

### Documentation

- Add dedicated English and Chinese docs for the new pluggable type architecture and clarify that official built-ins are first-party entries in the same registry.

## 0.3.0 (20260317)

### Features

- Upgrade `DNASequence` to Airalogy's GenBank-aligned editable canonical model with multi-segment feature locations, per-segment partial boundary flags, qualifier rows, and backward-compatible migration from the earlier single-range annotation payload.
- Keep `DNASequence` as the single top-level public DNA built-in type, while the nested helper classes remain available from `airalogy.types.dna` for lower-level construction and tests.
- Add an optional top-level `name` field to `DNASequence` so structured DNA records can store a human-readable plasmid or sequence name alongside sequence text, topology, and annotations.

### Documentation

- Clarify that `DNASequence` is Airalogy's editable canonical DNA model rather than a verbatim GenBank flatfile mirror, and document the `segments` / `qualifiers` payload shape in both English and Chinese docs.
- Update the English and Chinese DNA type docs to show the optional `DNASequence.name` field in the canonical JSON payload.

## 0.2.0 (20260313)

### Features

- Add `assigner runtime=client` syntax in AIMD and treat client assigners as first-class protocol metadata.
- Define client assigners as restricted JavaScript `assigner(config, function ...)` blocks, with the function name becoming the assigner id.
- Add cross-runtime assigner graph validation for duplicate assigned fields and circular dependencies.
- Validate combined assigner graphs from AIMD plus sibling `assigner.py` during `validate_aimd` / `airalogy check`.
- Validate AIMD inline assigner graphs before `load_inline_assigners()` executes Python blocks.
- Add structured built-in DNA type `DNASequence` for editable sequence payloads with topology and annotations, alongside the existing raw `ATCG` and `FileIdDNA` types.

### Documentation

- Add Chinese and English docs for client-runtime assigners and clarify that AIMD frontend docs are implementation-facing while Airalogy docs remain normative.

## 0.1.0 (20260304)

### Features

- Add `quiz` code block syntax for `choice` / `blank` / `open` item types.
- Add quiz parsing, validation, and metadata extraction (including YAML-based quiz block parsing).
- Add `QuizNode` and include quiz templates in parser outputs.
- Keep quiz parsing/validation in parser layer; `generate_model` now only emits `VarModel`.
- Add quiz syntax docs and record data structure docs in both Chinese and English.

### Breaking

- Replace exported helper `extract_vars` with `parse_aimd`.
- Change parse result shape from legacy top-level keys to `templates`-scoped keys.
- Stop generating standalone `QuizModel` in `generate_model`.

### Dependencies

- Add `pyyaml==6.0.3` as a runtime dependency for quiz YAML parsing.

## 0.0.14 (20260107)

### Features

- Add inline assigner support with `{{assigner}}` syntax in AIMD files
- Add CLI command `airalogy extract-assigners` for extracting inline assigners to Python files
- Add dependency graph validation and cycle detection for assigners
- Add Mermaid visualization for assigner dependency graphs via `generate_mermaid_graph()`
- Add caching for AIMD parse results in `AimdParser`

## 0.0.13 (20251224)

### Features

- Add unified document conversion API `airalogy.convert.to_markdown` with MarkItDown backend support.

## 0.0.12 (20251223)

### Features

- Add new code-string types: `JsonStr`, `TomlStr`, `YamlStr`.
- Add support for Python standard library types in `ModelGenerator`, including `datetime`, `date`, `time`, `timedelta`, `Decimal`, `UUID`, `Path`, `PurePath`, `IPv4Address`, and `IPv6Address`.

### Fixes

- AIMD var defined in code blocks will not be parsed

## 0.0.11 (20251217)

### Features

- Add new Assigner Modes: `auto_readonly` and `manual_readonly`, allowing assigned fields to be locked in the UI after assignment.

### Breaking

- Remove Assigner mode `auto_force`; `auto` is now defined as auto-trigger on dependency change with force overwrite.

## 0.0.10 (20251202)

### Features

- Rename `airalogy.aimd` module to `airalogy.markdown` for better clarity
- Add `get_airalogy_image_ids` API for `airalogy.markdown`

## 0.0.9 (20251120)

### Features

- Add Typed AIMD variable syntax support
- Add command-line interface (CLI) with syntax checking and model generation commands
- Add Chinese demographic enum types for enhanced data modeling
- Support standalone assigner functions with simplified decorator syntax

### Documentation

- Add typed AIMD variable syntax documentation
- Simplify Assigner syntax documentation by removing class-based definitions

### Development

- New parser implementation

## 0.0.8 (20251029)

### Features

- Add `CurrentProtocolId` and `CurrentRecordId` types

### Development

- Migrate from pdm to uv
- Update minimum Python version requirement to 3.13
- Add GitHub workflow for CI
- Add build status badge

### Dependencies

- Update pydantic dependency from 2.11.5 to 2.12.3

### Fixes

- Fix description

## 0.0.7 (20250827)

- Fix: Removed the `CurrentTime` pattern that was causing pydantic to fail validation.

## 0.0.6 (20250821)

- Enhancement: Add support for dumping `airalogy.types` pattern to JSON schema.

## 0.0.5 (20250804)

### 1. Refactoring

Marked the `airalogy.built_in_types` module as deprecated. Future built-in types will be uniformly defined in the `airalogy.types` module. All types defined in this module now support `pydantic.BaseModel` validation and provide corresponding JSON Schema generation with `airalogy_type` attributes.

### 2. New Type Support

```py
from airalogy.types import (
    SnakeStr,
    VersionStr,
    ProtocolId,
    RecordId,
    ATCG,
    FileIdDna,
)
```

- `SnakeStr`: Validates strings to conform to Python's snake_case naming convention.
- `VersionStr`: Validates strings to conform to Semantic Versioning (SemVer) specification.
- `ProtocolId`: Validates strings to conform to Airalogy Protocol ID specification.
- `RecordId`: Validates strings to conform to Airalogy Record ID specification.
- `ATCG`: Validates DNA sequence strings and provides complementary sequence functionality.
- `FileIdDna`: Supports uploading SnapGene DNA files (with `.dna` file extension).

## 0.0.4 (20250711)

- Added `airalogy.iso` module for converting common Python complex data types to ISO format strings.
- Added `timedelta_to_iso` function for converting `timedelta` objects to ISO 8601 format strings.
