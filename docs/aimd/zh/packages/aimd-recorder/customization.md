# 自定义

当宿主需要适配 recorder 的内建行为，但又不想自己重做 AIMD 解析和 record 状态管理时，可以使用这些自定义入口。

## Type Plugins

当宿主需要的是“某个 type 的专用行为”，而不是整类字段整体替换时，使用 `typePlugins`。

type plugin 可以定义：

- 自定义初始值
- 归一化逻辑
- 显示 / 解析钩子
- 某个 AIMD type token 对应的完整自定义 recorder widget

内建的 `AiralogyMarkdown` widget 也是沿着这条 type plugin 路径实现的，所以如果宿主需要不同的工作流，仍然可以覆盖默认实现。

完整架构说明和端到端示例请参考：

- [类型插件](/zh/packages/type-plugins)

## 宿主字段适配器

当宿主应用希望用自己的组件替换或包裹 recorder 的内建字段，但仍保留 AIMD 解析和记录状态管理时，可以使用 `fieldAdapters`：

```vue
<script setup lang="ts">
import { h } from "vue"
import { AimdRecorder } from "@airalogy/aimd-recorder"
</script>

<template>
  <AimdRecorder
    :content="content"
    :model-value="record"
    :field-adapters="{
      step: ({ node, defaultVNode }) =>
        h('step-card', {
          'step-id': node.id,
          'step-number': node.step,
          title: node.title || node.id,
          level: String(node.level),
        }, () => [defaultVNode]),
    }"
  />
</template>
```

每个 adapter 都会拿到解析后的 AIMD 节点、当前字段值、完整 record 快照、内建本地化消息，以及 recorder 默认生成的 vnode。`wrapField` 会在 adapter 解析之后继续执行，因此宿主仍然可以保留统一的校验外壳或 assigner UI 包裹层。

## 标签覆盖

如果只是想微调内建文案，可以覆盖 `messages`：

```vue
<script setup lang="ts">
import { AimdRecorder } from "@airalogy/aimd-recorder"
</script>

<template>
  <AimdRecorder
    locale="zh-CN"
    :messages="{
      step: {
        annotationPlaceholder: '步骤备注',
      },
      table: {
        addRow: '新增一行',
      },
    }"
  />
</template>
```

## 兼容说明

`AimdProtocolRecorder` 仍然导出为已废弃的兼容别名，但新的使用方式建议直接写 `AimdRecorder`。
