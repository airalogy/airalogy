# @airalogy/aimd-renderer

`@airalogy/aimd-renderer` renders AIMD into HTML or Vue nodes and can also extract fields.

> Protocol-level AIMD syntax, assigner semantics, and validation rules are normative in Airalogy docs. These pages describe frontend rendering and extraction behavior only.

## Install

```bash
pnpm add @airalogy/aimd-renderer @airalogy/aimd-core
```

## Main Capabilities

- `renderToHtml(content)` for HTML output.
- `renderToVue(content)` for Vue vnode output.
- `renderReadonlyRecordToVue(content, recordData, { resolveAsset })` and `AimdMarkdownPreview` for readonly Vue rendering with Record data and file assets embedded in matching AIMD fields.
- `parseAndExtract(content)` for canonical core field metadata extraction, including simple `var` definitions in `fields.var_definitions` and BibTeX references in `fields.refs`.
- Default previews for `var` and `var_table` display AIMD `title`, preserve the canonical field id, and reveal `description` plus `example`/`examples` details only on hover or keyboard focus.
- Numbered citation markers with hover/focus reference details and generated end-of-document references lists for `{{cite|...}}` plus fenced `refs` blocks.
- Host-side `resolveAssetUrl` support for rendering protocol-local figure and media assets from package, archive, or app-specific URLs without rewriting AIMD source.
- Built-in AIMD prose typography when host applications place rendered output inside an `.aimd-renderer` container, including clearer heading hierarchy, list markers, and more compact body line height.
- Default Vue pin controls for `video` / `audio` media, including single-item pinning, collapsed pinned descriptions, and small / medium / large pinned-size controls; HTML output exposes matching `data-*` hooks for host-controlled behavior.
- `assignerVisibility` to show or hide assigner blocks in authoring/debug views.
- Fenced `workflow` blocks render as structured Workflow UI with nodes, transitions, workflow-level assigners, assignment mappings, and optional run-state overlays supplied by the host.
- Built-in quiz preview controls.
- Built-in locale support via `locale`.

## Example

```ts
import { renderToHtml, parseAndExtract } from "@airalogy/aimd-renderer"

const content = "{{step|sample_preparation}}"

const { html } = await renderToHtml(content)
const fields = parseAndExtract(content)

console.log(html)
console.log(fields)
```

## Citations and References

`renderToHtml` and `renderToVue` render `{{cite|ref_id}}` markers as numbered inline reference markers. The visible citation marker uses refs-list order, such as `[1]`, while hover and keyboard focus reveal the reference details without changing the page URL. Fenced `refs` blocks use BibTeX syntax, are extracted into `fields.refs` as structured entries, and are rendered at the end of the document regardless of where the `refs` block appears in source.

````aimd
This protocol follows {{cite|yang2025airalogyaiempowereduniversaldata}}.

```refs
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
````

## Protocol-Local Figure and Media Assets

`fig` and `media` blocks can keep clean relative sources such as `src: files/workflow-diagram.svg` or `src: files/videos/lecture.mp4`. Hosts that load AIMD from a package, archive, or registry can pass `resolveAssetUrl` to map that source to a displayable URL at render time. `context.kind` distinguishes `fig`, `media`, and `media_poster`.

```ts
const { html } = await renderToHtml(content, {
  resolveAssetUrl(src, context) {
    if (context.kind === "fig" && src.startsWith("files/")) {
      return exampleAssetMap[src]
    }
    if ((context.kind === "media" || context.kind === "media_poster") && src.startsWith("files/")) {
      return exampleAssetMap[src]
    }
    return null
  },
})
```

## Review Marks

`renderToHtml`, `renderToVue`, and readonly `AiralogyMarkdown` rendering support CriticMarkup-style review marks in normal Markdown text. These marks are for document review display and do not add AIMD fields to `parseAndExtract`.

| Purpose | AIMD source | Rendered element |
| --- | --- | --- |
| Addition | `{++added text++}` | `<ins class="aimd-critic aimd-critic--addition">` |
| Deletion | `{--deleted text--}` | `<del class="aimd-critic aimd-critic--deletion">` |
| Substitution | `{~~old wording~>new wording~~}` | deletion plus insertion inside `.aimd-critic--substitution` |
| Comment | `{>>review note<<}` | inline `.aimd-critic--comment` annotation |
| Highlight | `{==important text==}` | `<mark class="aimd-critic aimd-critic--highlight">` |

CriticMarkup inside inline code and fenced code blocks remains literal source text.

## Readonly Record Rendering

```ts
import { AimdMarkdownPreview, renderReadonlyRecordToVue } from "@airalogy/aimd-renderer"

const { nodes } = await renderReadonlyRecordToVue(protocolContent, {
  data: {
    var: {
      sample_id: { value: "S-001" },
      site_photo: "airalogy.id.file.site-photo.png",
    },
    check: { prepared: { checked: true } },
  },
}, {
  resolveAsset: ({ fileId, fieldPath }) => assets.get(fileId ?? "") ?? assets.get(fieldPath) ?? null,
})
```

Use this when a viewer needs to show a completed protocol as a static document rather than as an editable recorder. The helper accepts either a Record payload wrapper with `data` or the `data` object itself, then renders the protocol in a readonly field context.

Vue hosts can render the same path through the ready-made component:

```vue
<script setup lang="ts">
import { AimdMarkdownPreview } from "@airalogy/aimd-renderer/vue"
</script>

<template>
  <AimdMarkdownPreview
    :content="protocolContent"
    :readonly-record-data="record"
    :resolve-asset="resolveAsset"
  />
</template>
```

The component loads the canonical renderer styles itself. Use `resolveUrl` for an asynchronous host resolver for relative rendered `src`, `poster`, and `href` values, and pass a host Mermaid component through `mermaidComponent` when Mermaid fences need interactive rendering. Its exposed instance includes `env`, `fields`, `rootElement`, and `reload` for host integrations that need parsed field metadata or selection UI.

`resolveAsset` is the host integration point for file-backed fields. Map Record file ids, field paths, or archive manifest entries to `ReadonlyRecordAsset` objects; the renderer will show image/audio/video fields inline, render ordinary files as readonly links, and resolve Markdown image `src` values that point at Airalogy file ids. Storage-specific work, including reading `.aira` blobs and creating `blob:` URLs, should stay in the host app.

Readonly `AiralogyMarkdown` values are rendered through the AIMD Vue renderer, so headings, lists, nested AIMD preview tokens, and resolved Markdown image assets appear as document content instead of raw Markdown source.

## Multi-Record Views

The Vue entry point exports `AimdRecordTable`, `AimdRecordCompare`, and `AimdRecordReport` for reusable Record table, comparison, and complete-report experiences. The table and comparison views share the `aimd-core` Record column model, so hosts do not need to recreate AIMD field traversal or compact value rendering. `AimdRecordTable` shows host-provided metadata columns by default and includes them in its column picker; bind `v-model:metadata-column-keys` when the host should retain that selection.

Every Protocol field name in the table and comparison views exposes an accessible details card on pointer hover or keyboard focus. It shows the field title, canonical id, type, description, examples, and enumerated options whenever those values are defined. The card is rendered at viewport level so it remains visible inside horizontally scrolling tables.

```vue
<script setup lang="ts">
import { AimdRecordCompare, AimdRecordTable } from "@airalogy/aimd-renderer/vue"
</script>

<template>
  <AimdRecordTable
    v-model:selected-record-keys="selectedKeys"
    v-model:metadata-column-keys="visibleMetadataColumnKeys"
    :aimd="protocolContent"
    :records="records"
  />
  <AimdRecordCompare :aimd="protocolContent" :records="selectedRecords" />
</template>
```

## Assigner Visibility

All `assigner` code blocks are hidden from normal rendered output by default, but they still participate in parsing and extraction upstream.

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const { html } = await renderToHtml(content, {
  assignerVisibility: "expanded",
})
```

Supported values:

- `"hidden"`: default, do not render assigner blocks.
- `"collapsed"`: render assigners inside collapsed `<details>` blocks with localized summaries.
- `"expanded"`: render assigners as visible code blocks. Server assigners use `python`; client assigners use `javascript`.

## Workflow UI

Fenced `workflow` blocks are extracted through `@airalogy/aimd-core` and rendered as a structured panel instead of raw YAML code. The panel shows nodes, transitions, conditions, workflow-level assigners, transition inputs, target `assign` mappings, retry limits, and optional logic notes.

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const { html } = await renderToHtml(workflowAimd, {
  workflowRuns: {
    parameter_optimization: {
      records: {
        prep: { data: { var: { sample_id: "S-001" } } },
        analysis: { data: { check: { pass_qc: { checked: false } } } },
      },
      node_iterations: { prep: 2 },
      executed_transitions: [{ id: "retry_after_qc_failure" }],
      transition_outputs: {
        retry_after_qc_failure: {
          recommended_temperature_c: 37,
          retry_reason: "QC signal below threshold",
        },
      },
    },
  },
})
```

The renderer does not execute workflow assigners. Hosts can run `@airalogy/airalogy-engine` or another backend runtime, then pass returned `records`, `transition_outputs`, `executed_transitions`, `skipped_transitions`, `attempts`, and `node_iterations` into `workflowRuns[workflow.id]`.

## Localization

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const content = "{{step|sample_preparation}}"

const { html } = await renderToHtml(content, {
  locale: "zh-CN",
})
```

Use `messages` only when you need to customize renderer labels such as `Step`, `Answer:`, or figure captions:

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const { html } = await renderToHtml("{{quiz|q1}}", {
  locale: "zh-CN",
  messages: {
    step: {
      reference: step => `Step ${step}`,
    },
    quiz: {
      answer: value => `参考答案：${value}`,
    },
  },
})
```

## Related

- [Host Integration](/en/packages/aimd-renderer/host-integration)
