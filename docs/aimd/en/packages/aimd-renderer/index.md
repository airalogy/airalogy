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
- `renderReadonlyRecordToVue(content, recordData, { resolveAsset })` for readonly Vue rendering with Record data and file assets embedded in matching AIMD fields.
- `parseAndExtract(content)` for canonical core field metadata extraction, including simple `var` definitions in `fields.var_definitions`.
- Default previews for `var` and `var_table` display AIMD `title`, preserve the canonical field id, and reveal `description` plus `example`/`examples` details only on hover or keyboard focus.
- `assignerVisibility` to show or hide assigner blocks in authoring/debug views.
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

## Readonly Record Rendering

```ts
import { renderReadonlyRecordToVue } from "@airalogy/aimd-renderer"

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

`resolveAsset` is the host integration point for file-backed fields. Map Record file ids, field paths, or archive manifest entries to `ReadonlyRecordAsset` objects; the renderer will show image/audio/video fields inline, render ordinary files as readonly links, and resolve Markdown image `src` values that point at Airalogy file ids. Storage-specific work, including reading `.aira` blobs and creating `blob:` URLs, should stay in the host app.

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
