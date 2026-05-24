# 内嵌编辑面

当宿主包需要更低层的 AIMD 编辑 building block，而不是整套 `AimdEditor` 时，可以使用内嵌入口。

## WYSIWYG 编辑面

`AimdWysiwygEditor` 可以从 `@airalogy/aimd-editor/wysiwyg` 获取，也可以从 `@airalogy/aimd-editor/embedded` 获取。

它支持：

- 受控 `content`
- `readonly` 和 `active` 宿主控制
- 通过 `milkdownPlugins` 注入自定义 Milkdown plugin 链

因此它很适合像 `@airalogy/aimd-recorder` 这样的宿主包，在那里 AIMD 字段可能需要宿主自定义 node view。

## 聚焦字段插入

`AimdFieldDialog` 支持 `allowedTypes`，因此宿主可以把 AIMD 插入 UI 限制在一小组字段类型上，而不是始终展示完整 AIMD 字段列表。

这很适合 recorder 侧编辑，只开放 `var`、`var_table`、`step`、`check`、`quiz` 这些字段。

## UI Metadata Helper

如果你要自己封装 AIMD 工具栏或插入面板，推荐使用根入口导出的 typed helper：

```ts
import {
  createAimdEditorMessages,
  createAimdFieldTypes,
  createMdToolbarItems,
  createAimdVarTypePresets,
} from "@airalogy/aimd-editor"

const messages = createAimdEditorMessages("zh-CN")
const fieldTypes = createAimdFieldTypes(messages)
const toolbarItems = createMdToolbarItems(messages)
const varTypePresets = createAimdVarTypePresets()
```

`createAimdVarTypePresets(...)` 用来生成 `var` 插入面板里那组类型预设卡片的数据，再通过 `AimdEditor` 的 `varTypePlugins` 传入宿主定义的预设。

## 相关页面

- [Vue 编辑器](/zh/packages/aimd-editor/vue-editor)
- [类型插件](/zh/packages/type-plugins)
