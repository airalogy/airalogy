# @airalogy/aimd-renderer

[![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-renderer?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/aimd-renderer)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/airalogy/airalogy/blob/main/LICENSE)

AIMD（Airalogy Markdown）渲染引擎：支持 HTML 渲染、Vue 渲染与字段提取。

默认情况下，assigner 代码块不会出现在普通渲染输出中。只有在作者视图或调试视图中显式开启时，才会以折叠或展开形式显示；`parseAndExtract` 仍会保留相关字段元数据。
`parseAndExtract` 返回 core 的规范字段结构，其中也包括 `fields.var_definitions` 里的普通 `var` 元数据。
默认的 `var` 和 `var_table` 预览会渲染 AIMD 的 `title`，保留用于自动化的规范字段 id，并且只在 hover 或键盘 focus 时展示 `description` 与 `example`/`examples` 详情。

> 协议级 AIMD 语法、assigner 语义与校验规则以 Airalogy 文档为准；`@airalogy/aimd-*` 文档只描述前端 parser、renderer、recorder 如何实现这些规范。

## 安装

```bash
pnpm add @airalogy/aimd-renderer @airalogy/aimd-core
```

## 快速开始

```ts
import { renderToHtml, parseAndExtract } from "@airalogy/aimd-renderer"

const content = '{{var|sample_name: str, title="样本名", description="样本的人类可读标签", examples=["S-001"]}}'
const { html } = await renderToHtml(content)
const fields = parseAndExtract(content)

console.log(html)
console.log(fields)
```

## Workflow UI

fenced `workflow` 代码块会渲染为结构化 Workflow UI 面板，而不是显示原始 YAML。renderer 会展示 nodes、transitions、workflow 级 assigners、transition inputs、目标 `assign` 映射、重试限制，并可叠加宿主传入的运行状态。

```ts
const { html } = await renderToHtml(workflowAimd, {
  workflowRuns: {
    parameter_optimization: {
      records: {
        prep: { data: { var: { sample_id: "S-001" } } },
      },
      node_iterations: { prep: 2 },
      executed_transitions: [{ id: "retry_after_qc_failure" }],
      transition_outputs: {
        retry_after_qc_failure: {
          retry_reason: "QC signal below threshold",
        },
      },
    },
  },
})
```

renderer 不执行 workflow assigner。宿主可以调用 `@airalogy/airalogy-engine` 或其他后端 runtime，再把返回的 `records`、`transition_outputs`、`executed_transitions`、`skipped_transitions`、`attempts` 和 `node_iterations` 传给 `workflowRuns[workflow.id]`。

## 审阅标记

Renderer 输出支持普通 Markdown 文本中的 CriticMarkup 风格审阅标记：

| 用途 | AIMD 源码 |
| --- | --- |
| 添加 | `{++新增文字++}` |
| 删除 | `{--删除文字--}` |
| 替换 | `{~~旧表述~>新表述~~}` |
| 注释 | `{>>审阅备注<<}` |
| 高亮 | `{==重点文字==}` |

这些标记会通过 `renderToHtml`、`renderToVue` 和只读 `AiralogyMarkdown` 字段渲染出来。行内代码和 fenced 代码块会保留原始文本。

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

## 只读 Record 渲染

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

当宿主应用需要把已完成的 AIMD Protocol 展示为静态文档时，可以使用这个 helper。它既接受带 `data` 的 Record payload，也接受 `data` 对象本身，然后在只读字段上下文中渲染协议内容。

Vue 宿主可以直接使用现成的 `AimdMarkdownPreview` 组件，而不是在本地维护 AIMD-aware Markdown preview：

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

该组件会自行加载规范 renderer 样式。宿主若需要异步解析渲染结果中的相对 `src`、`poster` 与 `href`，可传入 `resolveUrl`；若 Mermaid fenced code 需要交互式渲染，可通过 `mermaidComponent` 注入宿主 Mermaid 组件。组件实例会暴露 `env`、`fields`、`rootElement` 与 `reload`，供宿主读取字段元数据或挂接文本选择 UI。

`resolveAsset` 由宿主应用负责把 Record 文件 id、字段路径或 archive manifest 条目映射成 `ReadonlyRecordAsset`。renderer 会基于这个映射把图片、音频、视频字段内嵌渲染，把普通文件渲染为只读链接，并解析指向 Airalogy file id 的 Markdown 图片 `src`。`.aira` 读取、`blob:` URL 创建、对象存储签名 URL 等存储细节应留在宿主应用中，renderer 只接收可显示的 URL。

只读 `AiralogyMarkdown` 值会通过 AIMD Vue renderer 渲染，因此标题、列表、嵌套 AIMD 预览 token，以及已解析的 Markdown 图片资源都会作为文档内容显示，而不是显示原始 Markdown 文本。

在浏览器环境中调用异步渲染 API（`renderToHtml` / `renderToVue`）时，会自动加载 renderer 样式。只有在你希望手动预加载或控制 renderer stylesheet 时，才需要引入 `@airalogy/aimd-renderer/styles`。

## 文档

- EN: <https://airalogy.github.io/airalogy/aimd/en/packages/aimd-renderer>
- 中文: <https://airalogy.github.io/airalogy/aimd/zh/packages/aimd-renderer>
- 文档源码：`docs/aimd/en/packages/aimd-renderer.md`、`docs/aimd/zh/packages/aimd-renderer.md`
