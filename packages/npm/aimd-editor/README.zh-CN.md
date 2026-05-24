# @airalogy/aimd-editor

[![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-editor?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/aimd-editor)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/airalogy/airalogy/blob/main/LICENSE)

面向 AIMD（Airalogy Markdown）的编辑工具包（Monaco + Vue，可视化/源码双模式）。

## 安装

```bash
pnpm add @airalogy/aimd-editor monaco-editor
```

## 快速开始

```ts
import * as monaco from "monaco-editor"
import { language, conf, completionItemProvider } from "@airalogy/aimd-editor/monaco"

monaco.languages.register({ id: "aimd" })
monaco.languages.setMonarchTokensProvider("aimd", language)
monaco.languages.setLanguageConfiguration("aimd", conf)
monaco.languages.registerCompletionItemProvider("aimd", completionItemProvider)
```

## Vue 编辑器 i18n

```vue
<script setup lang="ts">
import { AimdEditor } from "@airalogy/aimd-editor"
</script>

<template>
  <AimdEditor locale="zh-CN" />
</template>
```

也可以通过 `messages` 覆盖内建文案。

Vue 源码编辑器会显示 parser 级语义 warning，包括 AIMD var 默认值与类型不匹配，以及数值约束 kwargs 被用在非数值类型上。

如果要做更底层的嵌入式集成，`AimdWysiwygEditor` 现在支持注入自定义 Milkdown plugin 链，`AimdFieldDialog` 也支持通过 `allowedTypes` 限定可插入的 AIMD 字段类型。

## 文档

- EN: <https://airalogy.github.io/airalogy/aimd/en/packages/aimd-editor>
- 中文: <https://airalogy.github.io/airalogy/aimd/zh/packages/aimd-editor>
- 文档源码：`docs/aimd/en/packages/aimd-editor.md`、`docs/aimd/zh/packages/aimd-editor.md`
