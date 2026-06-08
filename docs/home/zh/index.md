---
layout: home
title: Airalogy 文档
hero:
  name: Airalogy 文档
  text: Airalogy 生态系统的统一文档入口。
  tagline: 从同一个 GitHub Pages 站点进入 Python 框架、AIMD 编写工具和协议执行引擎文档。
  actions:
    - theme: brand
      text: Airalogy Python
      link: /airalogy/zh/
    - theme: alt
      text: 打开 .aira Reader
      link: /aira-reader/
    - theme: alt
      text: AIMD npm 包
      link: /aimd/zh/
    - theme: alt
      text: Engine 文档
      link: /airalogy-engine/
features:
  - title: 代码放在 packages
    details: 已发布的 Python、npm 和 runtime 包都在 monorepo 的 packages 目录中维护。
  - title: 文档放在 docs
    details: 每个包族维护自己的 VitePress 文档站，再组装到同一个 Pages 部署。
  - title: Changesets 统一发布
    details: npm 和 PyPI 包元数据通过同一套 release workflow 管理。
---

<DocsHome locale="zh" />
