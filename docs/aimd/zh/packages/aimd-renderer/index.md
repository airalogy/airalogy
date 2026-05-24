# @airalogy/aimd-renderer

`@airalogy/aimd-renderer` 用于将 AIMD 渲染为 HTML / Vue，同时支持字段提取。

> 协议级 AIMD 语法、assigner 语义与校验规则以 Airalogy 文档为准；这些页面只描述前端渲染和提取行为。

## 安装

```bash
pnpm add @airalogy/aimd-renderer @airalogy/aimd-core
```

## 核心能力

- `renderToHtml(content)`：输出 HTML。
- `renderToVue(content)`：输出 Vue vnode。
- `parseAndExtract(content)`：提取 core 规范字段结构，包括 `fields.var_definitions` 中的普通 `var` 定义。
- `assignerVisibility`：用于作者视图或调试视图下切换 assigner 的可见性。
- 内建 quiz 预览控制。
- 支持通过 `locale` 切换渲染标签语言。

## 示例

```ts
import { renderToHtml, parseAndExtract } from "@airalogy/aimd-renderer"

const content = "{{step|sample_preparation}}"

const { html } = await renderToHtml(content)
const fields = parseAndExtract(content)

console.log(html)
console.log(fields)
```

## Assigner 可见性

所有 `assigner` 代码块默认都不会出现在普通渲染输出中，但仍会在上游解析 / 提取阶段参与处理。

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const { html } = await renderToHtml(content, {
  assignerVisibility: "expanded",
})
```

支持的值：

- `"hidden"`：默认值，不渲染 assigner 代码块。
- `"collapsed"`：把 assigner 渲染为默认折叠的 `<details>`，并显示本地化摘要标题。
- `"expanded"`：直接把 assigner 渲染成可见代码块；server assigner 按 `python`，client assigner 按 `javascript` 显示。

## 本地化

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const content = "{{step|sample_preparation}}"

const { html } = await renderToHtml(content, {
  locale: "zh-CN",
})
```

只有在你需要自定义“步骤”“答案”“图注”这类渲染标签时，才需要覆盖 `messages`：

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const { html } = await renderToHtml("{{quiz|q1}}", {
  locale: "zh-CN",
  messages: {
    step: {
      reference: step => `步骤${step}`,
    },
    quiz: {
      answer: value => `参考答案：${value}`,
    },
  },
})
```

## 相关页面

- [宿主集成](/zh/packages/aimd-renderer/host-integration)
