# @airalogy/aimd-renderer

[![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-renderer?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/aimd-renderer)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/airalogy/airalogy/blob/main/LICENSE)

AIMD（Airalogy Markdown）渲染引擎：支持 HTML 渲染、Vue 渲染与字段提取。

默认情况下，assigner 代码块不会出现在普通渲染输出中。只有在作者视图或调试视图中显式开启时，才会以折叠或展开形式显示；`parseAndExtract` 仍会保留相关字段元数据。
`parseAndExtract` 返回 core 的规范字段结构，其中也包括 `fields.var_definitions` 里的普通 `var` 元数据。

> 协议级 AIMD 语法、assigner 语义与校验规则以 Airalogy 文档为准；`@airalogy/aimd-*` 文档只描述前端 parser、renderer、recorder 如何实现这些规范。

## 安装

```bash
pnpm add @airalogy/aimd-renderer @airalogy/aimd-core
```

## 快速开始

```ts
import { renderToHtml, parseAndExtract } from "@airalogy/aimd-renderer"

const content = "{{step|sample_preparation}}"
const { html } = await renderToHtml(content)
const fields = parseAndExtract(content)

console.log(html)
console.log(fields)
```

## Assigner 可见性

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const { html } = await renderToHtml(content, {
  assignerVisibility: "collapsed", // "hidden" | "collapsed" | "expanded"
})
```

`assignerVisibility` 默认值是 `"hidden"`。

## 本地化

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const content = "{{quiz|q1}}"

const { html } = await renderToHtml(content, {
  locale: "zh-CN",
})
```

## 宿主自定义元素

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

当宿主应用已经有自己的预览组件时，可以用这种方式把 AIMD HTML 输出直接映射到自定义元素。若希望步骤节点把后续块级正文一起吸收到 body / slot 中，请启用 `groupStepBodies`。

## 可复用 Step Card UI

```ts
import { createStepCardRenderer, renderToVue } from "@airalogy/aimd-renderer"

const { nodes } = await renderToVue(content, {
  groupStepBodies: true,
  aimdRenderers: {
    step: createStepCardRenderer(),
  },
})
```

当你想直接得到现成的 Vue 步骤卡片渲染，而不是先把 AIMD 节点映射到自定义元素时，可以使用这组 API。

在浏览器环境中调用异步渲染 API（`renderToHtml` / `renderToVue`）时，会自动加载公式样式。  
只有在你希望手动预加载样式时，才需要引入 `@airalogy/aimd-renderer/styles`。

## 文档

- EN: <https://airalogy.github.io/airalogy/aimd/en/packages/aimd-renderer>
- 中文: <https://airalogy.github.io/airalogy/aimd/zh/packages/aimd-renderer>
- 文档源码：`docs/aimd/en/packages/aimd-renderer.md`、`docs/aimd/zh/packages/aimd-renderer.md`
