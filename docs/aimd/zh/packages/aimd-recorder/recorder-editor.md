# AimdRecorderEditor

当用户需要一边修改 AIMD Protocol 结构、一边继续填写 recorder 数据时，使用 `AimdRecorderEditor`。

## 示例

```vue
<script setup lang="ts">
import { ref } from "vue"
import {
  AimdRecorderEditor,
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
} from "@airalogy/aimd-recorder"

const content = ref(`# Protocol

样本名：{{var|sample_name: str}}
温度：{{var|temperature: float}}
`)
const record = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
</script>

<template>
  <AimdRecorderEditor
    v-model="record"
    v-model:content="content"
    locale="zh-CN"
    :show-record-data="true"
    :allow-raw-field-source-editing="false"
  />
</template>
```

## 工作区行为

`AimdRecorderEditor` 会把源码编辑器、recorder 和 record 数据绑定到同一份 `content` / `record` 状态上。

默认还会：

- 把 `Recorder`、`Record Data` 和脱离当前 protocol 的旧数据都收在主工作流附近，而不是被长文档推到底部
- 根据剩余视口高度自动拉伸左右两列
- 让左右两侧都在各自面板内部滚动，保持视觉对齐

如果宿主想退回固定高度模式，可以设置 `:fit-viewport="false"`，继续通过 `editorMinHeight` / `recorderMinHeight` 控制高度。

如果仍然想保留额外的结构辅助面板，可以显式传 `:show-field-structure="true"`。

## Recorder-Aware WYSIWYG 模式

recorder 侧还可以切换到 recorder-aware 的 WYSIWYG AIMD 编辑模式，面向不理解 AIMD 源码的用户。

在这个模式下：

- `var`、`var_table`、`step`、`check`、`quiz` 会直接显示成真实 recorder widget，而不是普通 chip
- 用户可以在任意可落光标位置继续写标题、列表和普通 Markdown
- 渲染后的 field 可以拖到任意合法的光标位置
- 拖拽时会显示明确的落点提示，方便精确放置
- 每个 field 自身带有 hover / focus 工具条，直接提供编辑、删除、拖动

如果宿主不希望用户在 recorder 侧直接修改 raw AIMD，可以设置 `:allow-raw-field-source-editing="false"`，让字段弹窗只保留结构化编辑控件。

当当前 protocol 里已经没有某个历史字段 id 时，editor 还可以把这些脱离当前结构的旧数据放进独立视图，方便用户迁移值。
