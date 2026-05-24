# API Reference

Concise reference for the public API of each AIMD package. For full usage examples, see the individual [package docs](/en/packages/) and the [integration guide](/en/integration).

## @airalogy/aimd-core

Core AIMD parser, type definitions, syntax grammar, and utilities.

### Entry Points

| Entry | Path |
|-------|------|
| Root | `@airalogy/aimd-core` |
| Parser | `@airalogy/aimd-core/parser` |
| Syntax | `@airalogy/aimd-core/syntax` |
| Types | `@airalogy/aimd-core/types` |
| Utils | `@airalogy/aimd-core/utils` |

### Parser

```ts
import {
  remarkAimd,
  rehypeAimd,
  protectAimdInlineTemplates,
  restoreAimdInlineTemplates,
  validateClientAssignerFunctionSource,
  validateVarDefaultType,
} from "@airalogy/aimd-core/parser"
```

**`remarkAimd`** — Unified remark plugin that parses AIMD inline templates and fenced blocks (`quiz`, `fig`, `assigner`) into typed AST nodes. Attach to a `unified().use(remarkParse)` pipeline.

**`rehypeAimd`** — Rehype plugin counterpart for the HTML AST stage.

**`protectAimdInlineTemplates(content: string): ProtectedAimdInlineTemplates`** — Escapes AIMD `{{...}}` templates inside Markdown tables so GFM pipe parsing does not break them. Returns `{ content, templates }`.

**`restoreAimdInlineTemplates(content: string, templates: AimdInlineTemplateMap): string`** — Reverses protection after parsing.

**`validateClientAssignerFunctionSource(functionSource: string, id: string): void`** — Validates frontend `client_assigner` function bodies and throws when unsupported or unsafe constructs are present.

**`validateVarDefaultType(def: AimdVarDefinition): string[]`** — Returns warning strings when an AIMD var default value does not match the declared type.

### Syntax (TextMate / Shiki)

```ts
import { aimdLanguage, aimdInjection, aimdSyntaxTheme, AIMD_SCOPES } from "@airalogy/aimd-core"
```

- `aimdLanguage` — TextMate grammar for AIMD (extends Markdown).
- `aimdInjection` — Injection grammar for AIMD inline templates.
- `aimdSyntaxTheme` — Default color theme tokens.
- `AIMD_SCOPES` — List of AIMD scope identifiers.

### Utility Functions

```ts
import {
  findVarTable,
  getSubvarDef,
  getSubvarNames,
  hasSubvars,
  isVarTableField,
  mergeVarTableInfo,
  normalizeSubvars,
  toTemplateEnv,
} from "@airalogy/aimd-core"
```

| Function | Signature | Description |
|----------|-----------|-------------|
| `findVarTable` | `(fields, name) => AimdVarTableField \| undefined` | Look up a var_table by name from extracted fields. |
| `getSubvarDef` | `(table, colId) => AimdSubvar \| undefined` | Get a column definition from a var_table. |
| `getSubvarNames` | `(table) => string[]` | List column IDs of a var_table. |
| `hasSubvars` | `(table) => boolean` | Check whether a var_table has column definitions. |
| `isVarTableField` | `(field) => boolean` | Type guard for var_table fields. |
| `normalizeSubvars` | `(subvars) => AimdSubvar[]` | Normalize subvar definitions to canonical format. |
| `toTemplateEnv` | `(fields) => AimdTemplateEnv` | Build a template environment from extracted fields. |

### Quiz Grading

```ts
import {
  gradeQuizAnswer,
  gradeScaleQuizLocally,
  gradeQuizRecordAnswers,
  isScaleQuizAnswerComplete,
  resolveQuizMaxScore,
  type AimdQuizGradingConfig,
  type AimdQuizGradeResult,
  type AimdQuizGradeReport,
} from "@airalogy/aimd-core"
```

| API | Description |
|-----|-------------|
| `gradeQuizAnswer(quiz, answer, options?)` | Grade a single quiz item. Supports exact matching for choice and `true_false`, local sum/band scoring for deterministic scales, normalized/numeric matching for blank, and rubric/provider flows for open questions. |
| `gradeScaleQuizLocally(quiz, answer)` | Locally score a deterministic `scale` quiz by summing item option points and optionally resolving a matching band/classification. |
| `gradeQuizRecordAnswers(fields.quiz, record.quiz, options?)` | Grade a whole quiz submission and return `{ quiz, summary }`, where `summary` contains total score and review counts. |
| `isScaleQuizAnswerComplete(quiz, answer)` | Check whether every `scale` item has a selected option key before attempting local score display. |
| `resolveQuizMaxScore(quiz)` | Resolve the max score for one quiz item, including fallback defaults when `score` is omitted. |
| `AimdQuizGradingConfig` | Type for `quiz.grading`, covering strategies such as `partial_credit`, `sum`, `normalized_match`, `keyword_rubric`, and `llm_rubric`, plus scale `bands` metadata. |
| `AimdQuizGradeResult` | Per-question grade result including `earned_score`, `max_score`, `status`, `feedback`, and `review_required`. |

### Schema Utilities

```ts
import {
  schemaToInputType,
  formatter,
  parser,
  validator,
  formatRawValue,
  convertToScientificString,
  isWipValue,
} from "@airalogy/aimd-core"
```

| Function | Description |
|----------|-------------|
| `schemaToInputType(type)` | Map an AIMD var type (`str`, `int`, `float`, `bool`, `date`, `file`) to an HTML input type. |
| `formatter(type, value)` | Format a value for display based on its AIMD type. |
| `parser(type, raw)` | Parse a raw string into a typed value. |
| `validator(type, value)` | Validate a value against its AIMD type. Returns validation result. |
| `formatRawValue(value)` | Format a raw value to string. |
| `isWipValue(value)` | Check if a value is a work-in-progress placeholder. |

### Domain Constants

```ts
import {
  scopeKeyRecord,
  scopeNameRecord,
  scopeColorRecord,
  getRecordDataKey,
  getSchemaKey,
} from "@airalogy/aimd-core"
```

### Key Types

```ts
// Extracted fields (output of remark-aimd)
interface ExtractedAimdFields {
  var: string[]
  var_table: AimdVarTableField[]
  client_assigner: AimdClientAssignerField[]
  quiz: AimdQuizField[]
  step: string[]
  check: string[]
  ref_step: string[]
  ref_var: string[]
  ref_fig?: string[]
  cite?: string[]
  fig?: AimdFigField[]
  step_hierarchy?: AimdStepField[]
}

// Variable definition (from parsed AST)
interface AimdVarDefinition {
  id: string
  type?: string
  default?: string | number | boolean | null
  defaultRaw?: string
  required?: boolean
  subvars?: Record<string, AimdVarDefinition>
  kwargs?: Record<string, string | number | boolean>
  warnings?: string[]
}

// Processor options (shared by renderer)
interface ProcessorOptions {
  mode?: "preview" | "edit" | "report"
  gfm?: boolean
  math?: boolean
  sanitize?: boolean
  breaks?: boolean
  quizPreview?: QuizPreviewOptions
}

// Quiz preview control
interface QuizPreviewOptions {
  showAnswers?: boolean
  showRubric?: boolean
}

// Union of all AIMD AST nodes
type AimdNode =
  | AimdVarNode
  | AimdVarTableNode
  | AimdQuizNode
  | AimdStepNode
  | AimdCheckNode
  | AimdRefNode
  | AimdCiteNode
  | AimdFigNode
```

---

## @airalogy/aimd-editor

Monaco language integration and Vue WYSIWYG editor.

### Entry Points

| Entry | Path |
|-------|------|
| Root | `@airalogy/aimd-editor` (re-exports monaco + vue) |
| Monaco | `@airalogy/aimd-editor/monaco` |
| Vue | `@airalogy/aimd-editor/vue` |

### Monaco Integration

```ts
import { language, conf, completionItemProvider } from "@airalogy/aimd-editor/monaco"
```

| Export | Type | Description |
|--------|------|-------------|
| `language` | `IMonarchLanguage` | Monarch tokenizer rules for AIMD. |
| `conf` | `LanguageConfiguration` | Language configuration (brackets, comments, auto-closing). |
| `completionItemProvider` | `CompletionItemProvider` | Auto-completion for AIMD field syntax. |

### Monaco Theme

```ts
import { aimdTheme, aimdTokenColors, createAimdExtendedTheme } from "@airalogy/aimd-editor/monaco"
```

| Export | Description |
|--------|-------------|
| `aimdTheme` | Standalone Monaco theme definition. |
| `aimdTokenColors` | Token color map for AIMD scopes. |
| `createAimdExtendedTheme(base)` | Create an AIMD theme extending `"vs"` or `"vs-dark"`. |

### Vue Editor Component

```ts
import { AimdEditor } from "@airalogy/aimd-editor"
```

**`AimdEditor`** — Vue 3 component with source (Monaco) and WYSIWYG (Milkdown) editing modes.

Props:

| Prop | Type | Description |
|------|------|-------------|
| `modelValue` | `string` | AIMD content (`v-model`). |
| `locale` | `AimdEditorLocale` | `"en-US"` or `"zh-CN"`. |
| `messages` | `AimdEditorMessagesInput` | Partial message overrides. |

**`AimdFieldDialog`** — Dialog component for inserting AIMD field syntax.

### UI Metadata Helpers

```ts
import {
  createAimdEditorMessages,
  createAimdFieldTypes,
  createMdToolbarItems,
  getDefaultAimdFields,
  buildAimdSyntax,
  getQuickAimdSyntax,
} from "@airalogy/aimd-editor"
```

| Function | Description |
|----------|-------------|
| `createAimdEditorMessages(locale)` | Build a full localized message set. |
| `createAimdFieldTypes(messages)` | Build field type definitions for toolbar UI. |
| `createMdToolbarItems(messages)` | Build Markdown toolbar item definitions. |
| `getDefaultAimdFields()` | Get default field definitions. |
| `buildAimdSyntax(fieldType, options)` | Build AIMD syntax string from structured input. |
| `getQuickAimdSyntax(fieldType)` | Get minimal AIMD syntax snippet for a field type. |

### Milkdown Plugins

```ts
import {
  aimdMilkdownPlugins,
  aimdRemarkPlugin,
  aimdFieldNode,
  aimdFieldView,
  aimdFieldInputRule,
} from "@airalogy/aimd-editor"
```

Low-level exports for custom Milkdown integrations.

### Localization

```ts
import {
  createAimdEditorMessages,
  resolveAimdEditorLocale,
  DEFAULT_AIMD_EDITOR_LOCALE,
} from "@airalogy/aimd-editor"
```

| Type | Values |
|------|--------|
| `AimdEditorLocale` | `"en-US" \| "zh-CN"` |

---

## @airalogy/aimd-renderer

HTML and Vue rendering engines for AIMD content.

### Entry Points

| Entry | Path |
|-------|------|
| Root | `@airalogy/aimd-renderer` |
| HTML | `@airalogy/aimd-renderer/html` |
| Vue | `@airalogy/aimd-renderer/vue` |
| Styles | `@airalogy/aimd-renderer/styles` (KaTeX CSS) |

### Rendering Functions

```ts
import {
  renderToHtml,
  renderToHtmlSync,
  renderToVue,
  parseAndExtract,
  createCustomElementAimdRenderer,
  createRenderer,
  createHtmlProcessor,
  defaultRenderer,
} from "@airalogy/aimd-renderer"
```

| Function | Signature | Description |
|----------|-----------|-------------|
| `renderToHtml` | `(content: string, options?: AimdRendererOptions) => Promise<{ html: string }>` | Async HTML render with auto-loaded math styles. |
| `renderToHtmlSync` | `(content: string, options?) => { html: string }` | Synchronous HTML render (no math style loading). |
| `renderToVue` | `(content: string, options?) => Promise<RenderResult>` | Render to Vue VNodes. Returns `{ nodes, fields }`. |
| `parseAndExtract` | `(content: string) => ExtractedAimdFields` | Parse content and extract field metadata without rendering. |
| `createRenderer` | `(options?) => Processor` | Create a reusable unified processor. |
| `createHtmlProcessor` | `(options?) => Processor` | Create an HTML-specific processor. |

### Renderer Options

```ts
interface AimdRendererOptions extends ProcessorOptions {
  assignerVisibility?: "hidden" | "collapsed" | "expanded"
  aimdElementRenderers?: Partial<Record<AimdFieldType, AimdHtmlNodeRenderer>>
  groupStepBodies?: boolean
  locale?: AimdRendererLocale
  messages?: AimdRendererMessagesInput
}
```

`createCustomElementAimdRenderer(tagName, mapProperties?, options?)` builds an HTML-node renderer that maps AIMD elements into host custom elements while preserving default AIMD metadata.

### Vue Renderer Utilities

```ts
import {
  renderToVNodes,
  hastToVue,
  createComponentRenderer,
  createAssetRenderer,
  createCodeBlockRenderer,
  createEmbeddedRenderer,
  createMermaidRenderer,
  createStepCardRenderer,
} from "@airalogy/aimd-renderer"
```

| Function | Description |
|----------|-------------|
| `renderToVNodes(hast, options)` | Convert a HAST tree to Vue VNodes with AIMD component rendering. |
| `hastToVue(node)` | Convert a single HAST node to a Vue VNode. |
| `createComponentRenderer(renderers)` | Build a component renderer from a map of field-type handlers. |
| `createAssetRenderer(resolver)` | Build an asset (image/file) renderer. |
| `createCodeBlockRenderer(highlighter)` | Build a syntax-highlighted code block renderer (uses Shiki). |
| `createMermaidRenderer()` | Build a Mermaid diagram renderer. |
| `createStepCardRenderer(options?)` | Build a reusable Vue step-card renderer for AIMD step nodes. |

### Unified Token Renderer

```ts
import { createUnifiedTokenRenderer } from "@airalogy/aimd-renderer"

type UnifiedTokenRendererOptions = {
  locale?: AimdRendererLocale
  messages?: AimdRendererMessagesInput
  highlighter?: ShikiHighlighter
  assetResolver?: AssetResolver
}
```

### Event Injection Keys

```ts
import {
  fieldEventKey,
  protocolKey,
  draftEventKey,
  reportEventKey,
  bubbleMenuEventKey,
} from "@airalogy/aimd-renderer"
```

Vue `InjectionKey` symbols for cross-component event coordination.

### Helper Functions

```ts
import { getFinalIndent, parseFieldTag } from "@airalogy/aimd-renderer"
```

| Function | Signature | Description |
|----------|-----------|-------------|
| `getFinalIndent` | `(item: { parent?, sequence, level }) => string` | Compute the display indent string for nested steps (e.g., `"1.2.3"`). |
| `parseFieldTag` | `(template: string) => { type, name }[]` | Parse an AIMD template tag string into type/name pairs. |

### Localization

```ts
import {
  createAimdRendererMessages,
  resolveAimdRendererLocale,
  getAimdRendererQuizTypeLabel,
  DEFAULT_AIMD_RENDERER_LOCALE,
} from "@airalogy/aimd-renderer"
```

| Type | Values |
|------|--------|
| `AimdRendererLocale` | `"en-US" \| "zh-CN"` |

---

## @airalogy/aimd-recorder

Vue components for structured data input and recording.

### Entry Points

| Entry | Path |
|-------|------|
| Root | `@airalogy/aimd-recorder` |
| Components | `@airalogy/aimd-recorder/components` |
| Composables | `@airalogy/aimd-recorder/composables` |
| Styles | `@airalogy/aimd-recorder/styles` (recorder CSS) |

### Components

```ts
import {
  AimdRecorder,
  AimdRecorderEditor,
  AimdQuizRecorder,
  AimdDnaSequenceField,
} from "@airalogy/aimd-recorder"
```

| Component | Description |
|-----------|-------------|
| `AimdRecorder` | Full protocol recorder: renders AIMD content with inline input fields, can display quiz score/status/feedback through `quizGrades`, can control when choice-option explanations are revealed with `choiceOptionExplanationMode` / `submitted`, and can locally reveal deterministic `scale` results through `scaleGradeDisplayMode`. |
| `AimdRecorderEditor` | Combined protocol editor + recorder surface. Use with `v-model:content` and `v-model` when users need to restructure AIMD and keep entering data in the same view. Includes built-in field-structure editing and a recorder-side visual edit mode for recorder fields. |
| `AimdQuizRecorder` | Standalone quiz answer component for choice, `true_false`, blank, open, and scale questions, with optional grade display via `grade`, configurable timing for per-option explanations, and configurable reveal timing for deterministic scale scores/classifications. |
| `AimdDnaSequenceField` | Specialized DNA sequence input with SeqViz viewer, annotation editing, and GenBank import/export. |

### Record Data

```ts
import {
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
  type AimdStepOrCheckRecordItem,
} from "@airalogy/aimd-recorder"
```

```ts
interface AimdProtocolRecordData {
  var: Record<string, unknown>
  step: Record<string, AimdStepOrCheckRecordItem>
  check: Record<string, AimdStepOrCheckRecordItem>
  quiz: Record<string, unknown>
}

interface AimdStepOrCheckRecordItem {
  checked: boolean
  annotation: string
}

function createEmptyProtocolRecordData(): AimdProtocolRecordData
```

### Extension Types

```ts
import type {
  AimdFieldMeta,
  AimdFieldState,
  AimdRecorderFieldAdapter,
  AimdRecorderFieldAdapterContext,
  AimdRecorderFieldAdapters,
  AimdRecorderFieldType,
  FieldEventPayload,
  TableEventPayload,
} from "@airalogy/aimd-recorder"
```

| Type | Description |
|------|-------------|
| `AimdFieldMeta` | Per-field metadata: `inputType`, `required`, `pattern`, `enumOptions`, `disabled`, `placeholder`, `assigner`. |
| `AimdFieldState` | Per-field runtime state: `loading`, `error`, `validationError`, `disabled`. |
| `AimdRecorderFieldType` | Built-in recorder field kinds: `"var"`, `"var_table"`, `"step"`, `"check"`, `"quiz"`. |
| `AimdRecorderFieldAdapterContext` | Host adapter context containing the parsed AIMD node, current value, localized messages, record snapshot, and recorder-generated default vnode. |
| `AimdRecorderFieldAdapter` | Function type for wrapping or replacing a recorder field vnode. |
| `AimdRecorderFieldAdapters` | Partial map of field-type-specific recorder adapters. |
| `FieldEventPayload` | Event payload: `{ section, fieldKey, value? }`. |
| `TableEventPayload` | Table event payload: `{ tableName, rowIndex?, columns }`. |

### DNA Sequence Types

```ts
import type {
  AimdDnaSequenceValue,
  AimdDnaSequenceAnnotation,
  AimdDnaSequenceSegment,
  AimdDnaSequenceQualifier,
} from "@airalogy/aimd-recorder"
```

### Composables — Record State

```ts
import {
  cloneRecordData,
  normalizeIncomingRecord,
  applyIncomingRecord,
  normalizeStepFields,
  normalizeCheckFields,
  normalizeQuizFields,
  normalizeVarTableFields,
  getQuizDefaultValue,
  ensureDefaultsFromFields,
  createEmptyVarTableRow,
  normalizeVarTableRows,
} from "@airalogy/aimd-recorder"
```

| Function | Description |
|----------|-------------|
| `cloneRecordData(record)` | Deep clone a record data object. |
| `normalizeIncomingRecord(record, fields)` | Normalize a record against extracted fields. |
| `applyIncomingRecord(target, incoming, fields)` | Merge incoming record data into a target. |
| `ensureDefaultsFromFields(record, fields)` | Fill missing record keys with defaults from field definitions. |

### Composables — Var Helpers

```ts
import {
  normalizeVarTypeName,
  getVarInputKind,
  parseVarInputValue,
  getVarInputDisplayValue,
  unwrapStructuredValue,
  toBooleanValue,
  toDateValue,
  formatDateTimeWithTimezone,
} from "@airalogy/aimd-recorder"
```

| Function | Description |
|----------|-------------|
| `normalizeVarTypeName(type)` | Normalize a var type string (e.g., `"String"` to `"str"`). |
| `getVarInputKind(type)` | Map a var type to an input kind: `"text"`, `"number"`, `"checkbox"`, `"date"`, `"file"`, `"markdown"`, `"dna"`, `"textarea"`. |
| `parseVarInputValue(type, raw)` | Parse a raw input string to the appropriate typed value. |
| `getVarInputDisplayValue(type, value)` | Format a typed value for input display. |

### Composables — DNA Sequence

```ts
import {
  normalizeDnaSequenceValue,
  normalizeDnaSequenceText,
  collectInvalidDnaSequenceCharacters,
  createEmptyDnaSequenceAnnotation,
  calculateDnaSequenceGcPercent,
  serializeDnaSequenceToGenBank,
  AIMD_DNA_SEQUENCE_FORMAT,
} from "@airalogy/aimd-recorder"
```

### Composables — Focus Management

```ts
import {
  captureFocusSnapshot,
  restoreFocusSnapshot,
  type FocusSnapshot,
} from "@airalogy/aimd-recorder"
```

### Localization

```ts
import {
  createAimdRecorderMessages,
  resolveAimdRecorderLocale,
  DEFAULT_AIMD_RECORDER_LOCALE,
} from "@airalogy/aimd-recorder"
```

| Type | Values |
|------|--------|
| `AimdRecorderLocale` | `"en-US" \| "zh-CN"` |
