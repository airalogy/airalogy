# @airalogy/aimd-editor

`@airalogy/aimd-editor` 提供 AIMD 的 Monaco 语言集成，以及源码 / 所见即所得双模式的 Vue 编辑器能力。

## 安装

```bash
pnpm add @airalogy/aimd-editor monaco-editor
```

如果通过根入口使用 Vue 编辑器 API，还需要项目本身提供 `vue`。

## 入口

- `@airalogy/aimd-editor`：完整根入口，包含 Monaco helper 和 Vue 编辑器 API。
- `@airalogy/aimd-editor/monaco`：Monaco 语言配置与主题能力。
- `@airalogy/aimd-editor/vue`：显式 Vue 子入口，适合编辑器相关按需导入。
- `@airalogy/aimd-editor/embedded`：面向宿主包的低层 source + WYSIWYG 编辑面。
- `@airalogy/aimd-editor/wysiwyg`：轻量 WYSIWYG-only 入口。

## Monaco 集成

当你只需要在 Monaco 中启用 AIMD 语法高亮、语言配置与补全时，使用 `@airalogy/aimd-editor/monaco`。

```ts
import * as monaco from "monaco-editor"
import {
  language,
  conf,
  completionItemProvider,
} from "@airalogy/aimd-editor/monaco"

monaco.languages.register({ id: "aimd" })
monaco.languages.setMonarchTokensProvider("aimd", language)
monaco.languages.setLanguageConfiguration("aimd", conf)
monaco.languages.registerCompletionItemProvider("aimd", completionItemProvider)
```

## 如何选择

- [Vue 编辑器](/zh/packages/aimd-editor/vue-editor)：使用 `AimdEditor` 获得标准 AIMD 编辑体验。
- [内嵌编辑面](/zh/packages/aimd-editor/embedded)：内嵌 `AimdWysiwygEditor`、约束字段插入范围，或注入宿主自己的 Milkdown plugin 链。

Vue 源码编辑器会报告 parser 级语义 warning，包括 AIMD var 默认值与类型不匹配，以及 Pydantic 风格数值约束 kwargs 被用在非数值类型上。

## 说明

- AIMD 协议语法关键字保持英文，例如 `type: choice`、`mode: single`。
- `AIMD_FIELD_TYPES` 和 `MD_TOOLBAR_ITEMS` 目前仍保留兼容导出，但更推荐使用 factory helper 生成本地化 UI metadata。

完整交互可参考 `aimd/demo` 中的编辑器示例页面。
