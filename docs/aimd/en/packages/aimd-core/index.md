# @airalogy/aimd-core

`@airalogy/aimd-core` provides AIMD syntax parsing and canonical field extraction.

> Protocol-level AIMD syntax, assigner semantics, and validation rules are normative in Airalogy docs. This page only describes how `@airalogy/aimd-core` parses and extracts those structures on the frontend.

## Install

```bash
pnpm add @airalogy/aimd-core
```

## Main Capabilities

- Parse AIMD templates and fenced `quiz` / `fig` / `media` blocks.
- Parse fenced `assigner runtime=client` blocks into frontend assigner metadata.
- Build MDAST-compatible AIMD nodes.
- Build MDAST-compatible CriticMarkup review nodes for additions, deletions, substitutions, comments, and highlights.
- Extract normalized field metadata for downstream renderer/editor/recorder, including simple `var` definitions in `fields.var_definitions`.
- Convert parsed `connectors` metadata into host-backed `EntityRef` resolver maps for recorder UIs.
- Extract and cross-validate `collectors` metadata, data-source connector references, lifecycle steps, and `Observation[T]` field bindings.

## Example

```ts
import { unified } from "unified"
import remarkParse from "remark-parse"
import { remarkAimd } from "@airalogy/aimd-core/parser"

const content = "{{var|sample_name: str}}"
const processor = unified().use(remarkParse).use(remarkAimd)
const tree = processor.parse(content)
const file = { data: {} } as any
processor.runSync(tree, file)

console.log(file.data.aimdFields)
```

Client assigner blocks use the same `assigner` fence name and declare the runtime in the header:

````aimd
```assigner runtime=client
assigner(
  {
    mode: "auto",
    dependent_fields: ["a", "b"],
    assigned_fields: ["total"],
  },
  function calculate_total({ a, b }) {
    return {
      total: a + b,
    };
  }
);
```
````

## Choice Followups

Choice options may declare conditional structured fields under `followups`. The parser extracts these fields as `options[].followups` and accepts only `str`, `int`, `float`, and `bool`; `number` is intentionally not part of the AIMD followup type set.

````aimd
```quiz
id: sample_storage
type: choice
mode: single
stem: "How is the sample currently stored?"
options:
  - key: A
    text: "Refrigerated"
    followups:
      - key: temperature_c
        type: float
        title: "Temperature"
        unit: "°C"
      - key: duration_hours
        type: float
        title: "Duration"
        unit: "h"
  - key: B
    text: "Frozen"
  - key: C
    text: "Room temperature"
```
````

## True/False Quizzes

Use `type: true_false` for judgment questions. `answer` and `default` are booleans, and omitted `options` default to `true. True` and `false. False`. Custom `true` / `false` options may also declare `followups`.

````aimd
```quiz
id: sample_kept_cold
type: true_false
stem: "The sample stayed cold during transfer."
answer: true
```
````

## Markdown Tables

If AIMD inline templates appear inside Markdown tables, protect them before `parse()` so GFM does not split on the template pipe:

```ts
import { protectAimdInlineTemplates, remarkAimd } from "@airalogy/aimd-core/parser"

const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
const file = { data: { aimdInlineTemplates: templates } } as any
const tree = processor.parse(protectedContent)
processor.runSync(tree, file)
```

## CriticMarkup Review Nodes

Use `remarkCriticMarkup` when a host needs CriticMarkup-style review marks in the Markdown AST. This parser produces custom MDAST nodes such as `criticAddition`, `criticDeletion`, `criticSubstitution`, `criticComment`, and `criticHighlight`; it does not add entries to `fields` or change `remarkAimd` field extraction.

```ts
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import {
  CRITIC_MARKUP_SUBSTITUTIONS_DATA_KEY,
  protectCriticMarkupSubstitutions,
  remarkCriticMarkup,
} from "@airalogy/aimd-core/parser"

const { content: protectedContent, substitutions } = protectCriticMarkupSubstitutions(
  "Replace {~~old wording~>new wording~~} and mark {==important text==}.",
)
const file = { data: { [CRITIC_MARKUP_SUBSTITUTIONS_DATA_KEY]: substitutions } } as any
const processor = unified().use(remarkParse).use(remarkGfm).use(remarkCriticMarkup)
const tree = processor.parse(protectedContent)
processor.runSync(tree, file)
```

`protectCriticMarkupSubstitutions()` should run before GFM because CriticMarkup substitutions also use `~~`, which would otherwise be interpreted as strikethrough. Inline code and fenced code blocks remain literal source text.

## Validation Helpers

If your editor, linter, or import pipeline needs parser-level validation before AIMD content reaches the renderer or recorder, `@airalogy/aimd-core/parser` also exports reusable helpers:

```ts
import {
  parseMediaContent,
  parseVarDefinition,
  validateClientAssignerFunctionSource,
  validateMediaDefinition,
  validateVarDefinition,
  validateVarDefaultType,
  validateVarKwargs,
} from "@airalogy/aimd-core/parser"
```

- `validateClientAssignerFunctionSource(functionSource, id)` rejects unsafe or unsupported frontend `client_assigner` code such as `eval`, `window`, `fetch`, Unicode-escape bypasses, and other non-deterministic constructs.
- `parseMediaContent(content)` parses key-value content from a fenced `media` block and preserves the raw `kind`.
- `validateMediaDefinition(media)` reports non-`video`/`audio`/`file` `kind` values as standard errors; static images should use `fig`.
- `validateVarDefaultType(def)` returns warning strings when an AIMD var default does not match its declared type.
- `validateVarKwargs(def)` returns warning strings when supported kwargs are applied to incompatible var definitions, including Pydantic-style numeric constraints (`gt`, `ge`, `lt`, `le`, `multiple_of`) on non-numeric var types.
- `validateVarDefinition(def)` combines default-value checks and kwargs checks, including nested `subvars`.

## Built-in Type Metadata

`@airalogy/aimd-core/utils` exports `getAimdBuiltInTypeMetadata()` and `getAimdBuiltInTypeEnumValues()`. The metadata is generated from the Python `airalogy.types` registry, so official named enum types such as `BloodType` expose the same values to browser tools without duplicating Python type definitions in npm code.

## Entity Connector Utilities

`@airalogy/aimd-core/utils` also exports `createAimdEntityResolversFromConnectors()`, `searchAimdEntityConnector()`, and `resolveAimdEntityConnector()` for hosts that want parsed `connectors` metadata to power `EntityRef` recorder controls. The host still supplies `loadDescriptor`, `fetch`, and `getSecret`, so parser-only usage remains offline and browser bundles do not read `.env` secrets directly.

`@airalogy/aimd-core/parser` exports `parseCollectorsContent()` for standalone Collector YAML validation. A full AIMD parse stores registries in `fields.collectors` and rejects unknown or incompatible connector, step, and field bindings; it never contacts the declared data source.

## Further Reading

- Parsed nodes and extracted fields now use `id` only. If you are upgrading older integrations, read [Migration](/en/packages/aimd-core/compatibility) first.
- [Parsed Nodes](/en/packages/aimd-core/parsed-nodes)
- [Extracted Fields](/en/packages/aimd-core/extracted-fields)
- [Migration](/en/packages/aimd-core/compatibility)
