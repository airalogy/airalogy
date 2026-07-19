# @airalogy/aimd-core

[![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-core?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/aimd-core)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/airalogy/airalogy/blob/main/LICENSE)

Core parser and canonical field extraction for AIMD (Airalogy Markdown).

It also extracts frontend-only assigners from fenced `assigner runtime=client` blocks into `fields.client_assigner`.
Fenced `connectors` YAML blocks are extracted into `fields.connectors` as protocol metadata for connector-backed fields such as `EntityRef`.
Fenced `collectors` YAML blocks are extracted into `fields.collectors`; the parser validates data-source connectors, Collector ids, lifecycle step references, and `Observation[T]` field bindings without accessing a device or network.
Simple `var` ids remain available in `fields.var`; their parsed type, default, and kwargs metadata are also exposed through `fields.var_definitions`.
Display metadata such as `title`, `description`, and `example`/`examples` is extracted for `var` and `var_table` fields so renderer and recorder packages can show human-friendly labels while keeping canonical ids stable.
It also exposes `remarkCriticMarkup` for CriticMarkup-style review marks in the Markdown AST without adding those marks to extracted AIMD fields.

> Protocol-level AIMD syntax, assigner semantics, and validation rules are normative in Airalogy docs. `@airalogy/aimd-*` docs describe how the frontend parser, renderer, and recorder implement those rules.

## Install

```bash
pnpm add @airalogy/aimd-core
```

## Quick Start

```ts
import { unified } from "unified"
import remarkParse from "remark-parse"
import { remarkAimd } from "@airalogy/aimd-core/parser"

const content = '{{var|sample_name: str, title="Sample name", description="Human-readable sample label", examples=["S-001"]}}'
const processor = unified().use(remarkParse).use(remarkAimd)
const tree = processor.parse(content)
const file = { data: {} } as any
processor.runSync(tree, file)

console.log(file.data.aimdFields)
```

Example client assigner block:

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

If AIMD inline templates appear inside Markdown tables, protect them before `parse()` so GFM does not split on the template pipe:

```ts
import { protectAimdInlineTemplates, remarkAimd } from "@airalogy/aimd-core/parser"

const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
const file = { data: { aimdInlineTemplates: templates } } as any
const tree = processor.parse(protectedContent)
processor.runSync(tree, file)
```

## CriticMarkup Review Nodes

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

`remarkCriticMarkup` produces `criticAddition`, `criticDeletion`, `criticSubstitution`, `criticComment`, and `criticHighlight` nodes. It does not change AIMD field extraction.

## Choice Followups

Choice options may declare conditional structured fields under `followups`. These are parsed into `options[].followups` and support only `str`, `int`, `float`, and `bool`; `number` is intentionally not accepted.

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

Use `type: true_false` for judgment questions. The answer and default value are normalized to booleans, and omitted `options` default to `true. True` and `false. False`.

````aimd
```quiz
id: sample_kept_cold
type: true_false
stem: "The sample stayed cold during transfer."
answer: true
```
````

## Validation Helpers

```ts
import {
  parseConnectorsContent,
  parseCollectorsContent,
  parseVarDefinition,
  validateClientAssignerFunctionSource,
  validateVarDefinition,
  validateVarDefaultType,
  validateVarKwargs,
} from "@airalogy/aimd-core/parser"
```

Use `validateClientAssignerFunctionSource()` when host tooling needs to preflight fenced `assigner runtime=client` functions before saving or executing them. Use `validateVarDefaultType()` to surface warnings when an authored AIMD var default does not match its declared type. Use `validateVarKwargs()` or `validateVarDefinition()` when tooling also needs to warn about Pydantic-style numeric constraints such as `gt`, `ge`, `lt`, `le`, and `multiple_of` on non-numeric var types.

Use `parseConnectorsContent()` when tooling needs to validate the YAML body of a fenced `connectors` block before running a full remark pipeline. The parser reads metadata only; it does not fetch descriptors, call endpoints, or read environment secrets.

Use `parseCollectorsContent()` to validate and normalize one fenced `collectors` YAML body. A full `remarkAimd` parse additionally validates Collector-to-connector, lifecycle-step, and Collector-to-var references.

## Entity Connector Utilities

`@airalogy/aimd-core/utils` exports `createAimdEntityResolversFromConnectors()` for hosts that want official `connectors` metadata to drive recorder `EntityRef` pickers:

```ts
import { createAimdEntityResolversFromConnectors } from "@airalogy/aimd-core/utils"

const entityResolvers = createAimdEntityResolversFromConnectors(fields.connectors ?? [], {
  loadDescriptor: descriptor => archive.readText(descriptor),
  getSecret: name => backendSecretProxy(name),
  fetch: window.fetch.bind(window),
})
```

The helper also exposes lower-level `searchAimdEntityConnector()` and `resolveAimdEntityConnector()` functions. Hosts provide descriptor loading, `fetch`, and secret lookup so browser bundles do not read `.env` files or inline credentials.

## Record Query Utilities

`@airalogy/aimd-core/utils` exports protocol-aware record helpers such as `collectAimdRecordFieldRefs()`, `searchAimdRecordFields()`, `filterAimdRecord()`, and `filterAimdRecords()`. These helpers use parsed field metadata to search all record fields or a selected field, including `var_table` subvars stored under `record.var`, so host apps can build record search and filtering UI without reimplementing AIMD field traversal.

## Built-in Type Metadata

`@airalogy/aimd-core/utils` exports `getAimdBuiltInTypeMetadata()` and `getAimdBuiltInTypeEnumValues()`. The bundled metadata is generated from the Python `airalogy.types` registry, so official named enum types such as `BloodType` expose the same values to browser tools without duplicating Python type definitions in npm code.

## Documentation

- EN: <https://airalogy.github.io/airalogy/aimd/en/packages/aimd-core>
- 中文: <https://airalogy.github.io/airalogy/aimd/zh/packages/aimd-core>
- Parsed output and the `name` -> `id` migration notes are documented in the package docs.
- Source docs: `docs/aimd/en/packages/aimd-core/`, `docs/aimd/zh/packages/aimd-core/`

## Citation

If `@airalogy/aimd-core` is useful in your work, please cite the Airalogy paper:

```bibtex
@misc{yang2025airalogyaiempowereduniversaldata,
      title={Airalogy: AI-empowered universal data digitization for research automation},
      author={Zijie Yang and Qiji Zhou and Fang Guo and Sijie Zhang and Yexun Xi and Jinglei Nie and Yudian Zhu and Liping Huang and Chou Wu and Yonghe Xia and Xiaoyu Ma and Yingming Pu and Panzhong Lu and Junshu Pan and Mingtao Chen and Tiannan Guo and Yanmei Dou and Hongyu Chen and Anping Zeng and Jiaxing Huang and Tian Xu and Yue Zhang},
      year={2025},
      eprint={2506.18586},
      archivePrefix={arXiv},
      primaryClass={cs.AI},
      url={https://arxiv.org/abs/2506.18586},
}
```
