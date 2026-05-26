# @airalogy/aimd-renderer

[![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-renderer?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/aimd-renderer)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/airalogy/airalogy/blob/main/LICENSE)

Rendering engine for AIMD (Airalogy Markdown): HTML output, Vue output, and field extraction.

Assigner blocks are hidden from normal rendered output by default. You can opt into collapsed or expanded assigner display when building authoring/debug views, while extracted field metadata remains available through `parseAndExtract`.
`parseAndExtract` returns the canonical core field structure, including simple `var` metadata in `fields.var_definitions`.
Default `var` and `var_table` previews render AIMD `title`, preserve the canonical field id for automation, and expose `description` plus `example`/`examples` details only on hover or keyboard focus.

> Protocol-level AIMD syntax, assigner semantics, and validation rules are normative in Airalogy docs. `@airalogy/aimd-*` docs describe how the frontend parser, renderer, and recorder implement those rules.

## Install

```bash
pnpm add @airalogy/aimd-renderer @airalogy/aimd-core
```

## Quick Start

```ts
import { renderToHtml, parseAndExtract } from "@airalogy/aimd-renderer"

const content = '{{var|sample_name: str, title="Sample name", description="Human-readable sample label", examples=["S-001"]}}'
const { html } = await renderToHtml(content)
const fields = parseAndExtract(content)

console.log(html)
console.log(fields)
```

## Assigner Visibility

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const { html } = await renderToHtml(content, {
  assignerVisibility: "collapsed", // "hidden" | "collapsed" | "expanded"
})
```

`assignerVisibility` defaults to `"hidden"`.

## Localization

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const content = "{{quiz|q1}}"

const { html } = await renderToHtml(content, {
  locale: "zh-CN",
})
```

## Host Custom Elements

```ts
import {
  createCustomElementAimdRenderer,
  renderToHtml,
} from "@airalogy/aimd-renderer"

const { html } = await renderToHtml("{{step|verify, 2, title='Verify Output', check=True}}", {
  groupStepBodies: true,
  aimdElementRenderers: {
    step: createCustomElementAimdRenderer("step-card", (node) => ({
      "step-id": node.id,
      "step-number": (node as any).step,
      title: (node as any).title,
      level: String((node as any).level),
      "has-check": (node as any).check ? "true" : undefined,
    }), {
      container: true,
      stripDefaultChildren: true,
    }),
  },
})
```

This is intended for host apps that already have their own preview components and need AIMD HTML output to target those custom elements directly. Enable `groupStepBodies` when step containers should absorb following block content as their body/slot.

## Reusable Step Card UI

```ts
import { createStepCardRenderer, renderToVue } from "@airalogy/aimd-renderer"

const { nodes } = await renderToVue(content, {
  groupStepBodies: true,
  aimdRenderers: {
    step: createStepCardRenderer(),
  },
})
```

Use this when you want a ready-made Vue step-card surface without first mapping AIMD nodes into your own custom elements.

Math styles are loaded automatically when calling async render APIs (`renderToHtml` / `renderToVue`) in browser environments.  
Use `@airalogy/aimd-renderer/styles` only if you want to preload styles manually.

## Documentation

- EN: <https://airalogy.github.io/airalogy/aimd/en/packages/aimd-renderer>
- 中文: <https://airalogy.github.io/airalogy/aimd/zh/packages/aimd-renderer>
- Source docs: `docs/aimd/en/packages/aimd-renderer.md`, `docs/aimd/zh/packages/aimd-renderer.md`

## Citation

If `@airalogy/aimd-renderer` is useful in your work, please cite the Airalogy paper:

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
