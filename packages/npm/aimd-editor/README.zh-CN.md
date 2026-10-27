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

## 图片编辑与正式输出

可复用的 authoring 入口会保持草稿编辑宽松，同时使显式保存和导出操作保持严格。`prepareAimdForFormalOutput()` 会为已闭合且已有 `src` 的 `fig` 块生成缺失的 ID，保留已有 ID，拒绝重复 ID 或缺失图片源，并返回必须在下载 `.aimd` 或打包 `.aira` 前写回编辑器的 AIMD 源文本。当 `generated` 非空时，宿主应给出非阻塞提示，明确说明 ID 已生成并写入源文本。

```ts
import { prepareAimdForFormalOutput } from "@airalogy/aimd-editor/authoring"

const prepared = prepareAimdForFormalOutput(source)
source = prepared.content
```

不要在自动草稿保存中调用这个规范化函数。`AimdSourceEditor` 会单独诊断已闭合且缺失 ID 的图片，并提供生成 ID 的快速修复，不会改写未完成的输入。

## 输入框编辑

工具栏提供“文本、整数、小数、单选、多选、是／否”快捷入口，“更多输入框”收纳日期、时间、日期时间、文本列表、附件及其他类型。点击后直接打开对应类型的配置；单选和多选只需逐行填写选项，不必写类型语法。插入时自动生成唯一的 `field_1`、`field_2` 等 ID 并写入 AIMD；移动字段不会重新编号。名称选填，高级设置中可修改 ID、自定义类型和默认值，非法或重复的 ID 会被阻止。

设置 `mode="wysiwyg" field-display="compact"` 可隐藏可视化占位块中的技术语法，点击占位块可修改属性。组件默认仍为源码模式和详细显示。如果需要在同一文档里编辑说明文字并直接填写数据，使用 `@airalogy/aimd-recorder` 的 `AimdRecorderWysiwygSurface`；`AimdEditor` 只编辑定义，不填写 Record 值。

宿主可从 `@airalogy/aimd-editor/authoring` 复用 `collectAimdFieldIds`、`createAimdFieldId`、`updateAimdInputField`，从 `@airalogy/aimd-editor/vue` 复用 `AimdInputFieldDialog`。

输入框配置对话框始终在当前视口居中，不受宿主全局边距重置影响；窄屏下保留边距，内容过高时在对话框内部滚动。

多行 `var_table` 声明在可视化模式中保持为结构化字段，切换模式和保存时保留子列的 ID、标题、类型及约束，不会把 `var(...)` 定义文本显示为列名。

## 步骤编辑

“步骤”操作打开 `AimdStepFieldDialog`：名称选填，ID 自动生成，高级设置提供层级与计时参数。编辑名称时已有 ID 保持只读。可复用的 `updateAimdStepField` 编辑辅助函数保留其他参数和稳定身份。`{{step|mix, title="混匀样品", check=True}}` 的操作说明仍写在普通 Markdown 正文中，而非标题里。填写值和计时状态由 Recorder 管理。

## 检查点与高级输入框

引号内类似 AIMD 的文字，例如 `checked_message="保留字面文本 {{ref_var|wait_s}}"`，在可视化模式和保存后重新打开时仍属于外层字段，不会被截断。只有普通正文中的引用会成为独立引用节点。

“检查点”操作也支持选填名称、自动生成稳定 ID，并保持已有 ID 只读。`AimdStepFieldDialog` 可传入 `fieldType="check"`；`updateAimdCheckField` 在编辑标题和勾选后提示时保留 ID。检查正文仍写在 Markdown 中，已填数据由 Recorder 管理。

“高级 / 自定义”列出从 Python 注册表生成的全部内置类型及宿主 `varTypePlugins`，下方保留可自由编辑的类型表达式。选择已有类型时保留可空设置，仍可输入 `list[MyType] | None` 等表达式。列出自定义类型并不等于安装其 Python 定义或 Recorder 控件。

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

Vue 源码编辑器会显示 parser 级语义 warning，包括 AIMD var 默认值与类型不匹配，以及数值约束 kwargs 被用在非数值类型上。它还会报告图片 ID 缺失、ID 重复和图片源缺失问题。

如果要做更底层的嵌入式集成，`AimdWysiwygEditor` 现在支持注入自定义 Milkdown plugin 链，`AimdFieldDialog` 也支持通过 `allowedTypes` 限定可插入的 AIMD 字段类型。

## 文档

- EN: <https://airalogy.github.io/airalogy/aimd/en/packages/aimd-editor>
- 中文: <https://airalogy.github.io/airalogy/aimd/zh/packages/aimd-editor>
- 文档源码：`docs/aimd/en/packages/aimd-editor.md`、`docs/aimd/zh/packages/aimd-editor.md`
