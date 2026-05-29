# Type Plugins

`aimd` 现在在 AIMD 原本自由输入的类型语法之上，补了一层显式的 type plugin 机制。

这件事的价值在于：AIMD 源码本来就允许写任意类型名，但 recorder/editor 的交互过去主要还是围绕一组硬编码内置类型。现在这些能力被抽成了正式扩展点。

## 职责划分

- `airalogy` 负责类型 token 的后端 canonical contract。
- `aimd` 负责这个类型在前端如何被发现、推荐、初始化、归一化和渲染。

两边应该复用同一个公开类型名。

## Recorder 接入

`AimdRecorder` 现在支持 `typePlugins`。

单个插件可以定义：

- `inputKind`
- `getInitialValue`
- `normalizeValue`
- `getDisplayValue`
- `parseInputValue`
- `renderField`

这意味着宿主应用可以只为某一个类型增加专用 widget，而不必整体替换整个 recorder。

内建的 `AiralogyMarkdown` recorder 字段现在就是沿用这条机制实现的：官方插件会渲染一个横铺内嵌、支持 `预览` / `源码` 的 AIMD/Markdown 字段，预览会渲染 Mermaid 代码块；如果字段写在一行文字中间，recorder 会先把它提升成块级编辑区。宿主应用如果需要不同的编辑界面，仍然可以覆盖它。

```vue
<script setup lang="ts">
import { h } from "vue"
import { AimdRecorder, type AimdTypePlugin } from "@airalogy/aimd-recorder"

const microscopeCapturePlugin: AimdTypePlugin = {
  type: "MicroscopeCapture",
  inputKind: "text",
  getInitialValue: () => ({ exposure_ms: 0, channel: "brightfield" }),
  renderField: ({ value, emitChange }) =>
    h("microscope-capture-field", {
      modelValue: value,
      "onUpdate:modelValue": emitChange,
    }),
}
</script>

<template>
  <AimdRecorder
    :content="content"
    :model-value="record"
    :type-plugins="[microscopeCapturePlugin]"
  />
</template>
```

## Editor 接入

`AimdEditor` 和编辑器里的 AIMD 字段插入弹窗 `AimdFieldDialog` 现在支持 `varTypePlugins`。

这里的 `AIMD Field` 是统称，包含 `var`、`var_table`、`quiz`、`step`、`check` 和 `ref_*` 等可插入 AIMD 单元。

它不会改变 AIMD 语法规则，只会扩展插入面板中的类型预设卡片，让自定义类型更容易被作者发现。

```vue
<script setup lang="ts">
import { AimdEditor, type AimdVarTypePresetOption } from "@airalogy/aimd-editor"

const varTypePlugins: AimdVarTypePresetOption[] = [
  {
    key: "microscopeCapture",
    value: "MicroscopeCapture",
    label: "MicroscopeCapture",
    desc: "带有专用 recorder widget 的结构化显微镜采集数据",
  },
]
</script>

<template>
  <AimdEditor v-model="content" :var-type-plugins="varTypePlugins" />
</template>
```

## 为什么这样做

这套设计的目标是“可扩展，但不失去可理解性”。

- 协议作者仍然只需要写普通 AIMD。
- 宿主应用可以按需逐步增加 type-specific UX。
- Airalogy 官方类型本质上也是 first-party plugins，只是文档和兼容性承诺更强。
- 如果第三方设计足够成熟，未来官方吸纳时也不需要重新设计扩展链路。

## 相关文档

- [`airalogy` type plugins](https://airalogy.github.io/airalogy/airalogy/zh/apis/type-plugins)
- [`@airalogy/aimd-recorder`](/zh/packages/aimd-recorder/)
- [`@airalogy/aimd-editor`](/zh/packages/aimd-editor/)
