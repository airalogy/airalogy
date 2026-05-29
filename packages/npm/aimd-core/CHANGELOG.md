# Changelog

## 2.8.0

### Minor Changes

- e73eefa: Preserve AIMD `title`, `description`, and `example`/`examples` metadata for `var` and `var_table` fields, with default renderer and recorder labels showing titles and keeping description/example details behind hover/focus popovers.
- 5732108: Add the generic `CodeStr` code-string type to `airalogy.types` so AIMD fields such as `{{var|script: CodeStr}}` generate valid Python models while recorder UIs can present them as plain code editors.

  Allow AIMD var-table defaults to contain multiline object-list values, expose those defaults through extracted field metadata, and initialize recorder var-table rows from those defaults without overwriting user-entered rows.

  Run auto server assigners when their dependencies become available, and mount server assigner controls inside built-in `AiralogyMarkdown` fields that support inline assigner actions.

  Add a rendered preview mode to the built-in recorder `AiralogyMarkdown` field, including Mermaid code block rendering for generated Markdown outputs.

### Patch Changes

- 47532f6: Parse AIMD `Literal[...]` and `enum=[...]` var definitions into enum metadata, and render recorder `var` and `var_table` enum fields as select controls while preserving non-string option values.

## 2.7.0

### Minor Changes

- 65822de: Add `true_false.options[].followups` support, preserving plain boolean answers for ordinary true/false quizzes while using structured `{ selected, followups }` answers when followups are defined.

## 2.6.0

### Minor Changes

- 27ae467: Add `choice.options[].followups` for conditional structured fields on selected choice options, and add first-class `type: true_false` quiz support across core parsing/grading, renderer previews, and recorder inputs.
- e0e1b9f: Add AIMD numeric constraint support, source diagnostics, extracted var definition metadata, and constraint-aware client assigner dependency readiness for Pydantic-style `gt`, `ge`, `lt`, `le`, and `multiple_of` var kwargs.

## 2.5.1

### Patch Changes

- 541d008: Configure public package release metadata for automated publishing, align internal workspace dependency ranges for published packages, and add the monorepo Changesets release workflow.

All notable changes to `@airalogy/aimd-core` will be documented in this file.

Earlier historical releases were not backfilled yet. This changelog currently starts from the `2.x` release line.

## [Unreleased]

## [2.5.0] - 2026-04-14

### Added

- Added `quiz.type: scale` parsing with shared `items`, per-option `points`, `display`, optional score `bands`, and per-item `default` values for matrix-style questionnaire syntax.
- Added exported helpers `gradeScaleQuizLocally()` and `isScaleQuizAnswerComplete()` plus `scale_sum` grading metadata so host apps can locally score deterministic scales without reimplementing questionnaire logic.

### Changed

- Extended core quiz grading and max-score resolution so scale quizzes participate in the same report pipeline as choice, blank, and open questions.

## [2.4.0] - 2026-04-02

### Added

- Added first-class `quiz.grading` metadata for choice, blank, and open questions, including partial credit, normalized blank matching, rubric items, and provider-oriented LLM grading configuration.
- Added `choice.grading.option_points` so single-choice and multiple-choice items can award score directly from selected options without relying on a separate answer key.
- Added optional `choice.options[].explanation` parsing so AIMD choice items can carry per-option explanation text for downstream learning-oriented UIs.
- Added exported grading helpers `gradeQuizAnswer()`, `gradeQuizRecordAnswers()`, and `resolveQuizMaxScore()` so host apps can score AIMD quiz submissions without reimplementing quiz semantics.

## [2.3.0] - 2026-03-19

### Added

- Added first-class `step.duration` parsing with normalized `estimated_duration_ms` metadata and `step.timer` parsing with `elapsed` / `countdown` / `both` modes in parsed AIMD step nodes and extracted `step_hierarchy`.

### Changed

- Extended exported AIMD step types and template-env step metadata so downstream renderers and recorders can consume timer mode information without reading raw step kwargs.
- Normalized public step extraction metadata to snake_case, including `step_hierarchy`, `estimated_duration_ms`, `timer_mode`, `has_check`, `parent_id`, `prev_id`, `next_id`, and `has_children`.

## [2.2.0] - 2026-03-19

### Added

- Exported `validateVarDefaultType` from the parser entry so downstream tools can reuse AIMD var-default validation without reaching into internal modules.

### Changed

- Hardened `client_assigner` validation by parsing function bodies with `acorn`, closing Unicode-escape and computed-property bypasses that simple regex-only checks could miss.

## [2.1.0] - 2026-03-13

### Added

- Added extraction for fenced `assigner runtime=client` blocks, including structured `client_assigner[]` metadata with `id`, `mode`, `dependent_fields`, `assigned_fields`, and `function_source`.
- Added frontend-side assigner graph validation so duplicate assigned fields and cross-runtime cycles are rejected during AIMD parsing.
- Exported client assigner types and parser validation helpers for downstream packages that need to execute or inspect client assigners.
- Added `acorn` as a direct dependency in preparation for parser hardening around client assigner JavaScript syntax.

## [2.0.1] - 2026-03-12

### Added

- Added `AimdVarDefinition.defaultRaw` so downstream UIs can preserve authored default literals such as `25.0` while `default` remains the parsed numeric/boolean/string value.

## [2.0.0] - 2026-03-12

### Changed

- Completed the AIMD identifier cleanup as a breaking release: parsed AIMD nodes and extracted field metadata now use `id` as the only canonical identifier field.
- Removed deprecated `name` compatibility fields and step-hierarchy `parentName` / `prevName` / `nextName` aliases from parsed output and extracted field results.
- Renamed template-environment record lookup semantics to the `byId` model to match the `id`-only parsed output.
