---
layout: home
hero:
  name: AIMD
  text: 包文档
  tagline: 覆盖 AIMD 的解析、编辑、渲染与记录组件
  actions:
    - theme: brand
      text: 浏览包文档
      link: /zh/packages/
    - theme: alt
      text: 打开 Demo
      link: /demo/
      target: _self
features:
  - icon: "🧠"
    title: aimd-core
    details: 负责语法解析、AST 构建与字段提取。
  - icon: "✍️"
    title: aimd-editor
    details: 提供 AIMD 的 Monaco 与可视化编辑能力。
  - icon: "🖼️"
    title: aimd-renderer
    details: 将 AIMD 渲染为 HTML / Vue，并支持题目预览参数。
  - icon: "🧾"
    title: aimd-recorder
    details: 提供结构化记录场景的输入控件与样式。
---

## 快速开始

本地预览文档：

```bash
pnpm docs:dev
```

## 指南与参考

- [集成指南](/zh/integration)
- [API 参考](/zh/api-reference)
- [故障排查 / FAQ](/zh/troubleshooting)
