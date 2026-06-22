# 跨包集成

本指南展示如何在同一个 Vue 3 应用中组合 `@airalogy/aimd-editor`、`@airalogy/aimd-renderer` 与 `@airalogy/aimd-recorder`，构建完整的 AIMD 编写与记录工作流。

## 安装

```bash
pnpm add @airalogy/aimd-core @airalogy/aimd-editor @airalogy/aimd-renderer @airalogy/aimd-recorder
pnpm add vue monaco-editor @vueuse/core naive-ui
```

## Vue 3 基础接入

典型集成一般分为三个阶段：**编辑**、**预览** 与 **记录**。每个阶段分别对应一个 AIMD 包。

```vue
<script setup lang="ts">
import { ref, watch } from "vue"
import { AimdEditor } from "@airalogy/aimd-editor"
import { renderToHtml, parseAndExtract } from "@airalogy/aimd-renderer"
import {
  AimdRecorder,
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
} from "@airalogy/aimd-recorder"
import "@airalogy/aimd-recorder/styles"

const content = ref(`# My Protocol

Sample Name: {{var|sample_name: str}}
Temperature: {{var|temperature: float = 25.0}}

{{step|preparation}}
Prepare the workspace.

{{step|measurement}}
Record the measurement.

{{check|safety_check}}
`)

const previewHtml = ref("")
const record = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
const activeTab = ref<"edit" | "preview" | "record">("edit")

watch(content, async (value) => {
  const { html } = await renderToHtml(value)
  previewHtml.value = html
}, { immediate: true })
</script>

<template>
  <div class="aimd-app">
    <nav>
      <button @click="activeTab = 'edit'">Edit</button>
      <button @click="activeTab = 'preview'">Preview</button>
      <button @click="activeTab = 'record'">Record</button>
    </nav>

    <AimdEditor
      v-if="activeTab === 'edit'"
      v-model="content"
    />

    <div
      v-if="activeTab === 'preview'"
      v-html="previewHtml"
    />

    <AimdRecorder
      v-if="activeTab === 'record'"
      v-model="record"
      :content="content"
      locale="zh-CN"
    />
  </div>
</template>
```

## Recorder Editor

如果宿主应用希望把 Protocol 编辑和 recorder 录入放在同一个界面里，可以直接使用 `AimdRecorderEditor`，而不是自己手动拼 `AimdEditor` + `AimdRecorder`：

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

当用户在编辑 protocol 时删除或重命名字段，editor 会把 `Recorder`、`Record Data`、脱离当前结构的旧记录值统一放在右侧 tab 工作区里，而不是继续堆在页面底部。这样即使 AIMD 很长，这些辅助面板也仍然靠近主操作区；默认情况下，左右两列还会根据浏览器剩余可用高度自动伸展，尽量撑满视口，并在各自区域内部滚动，这个同高滚动行为在 recorder 侧切到可视化编辑模式后也继续成立。如果宿主还想保留独立的结构编辑辅助面板，可以显式传 `:show-field-structure="true"`。如果宿主希望更接近真正的所见即所得流程，用户还可以在 recorder 面板里打开可视化编辑模式；右侧会切到一个 recorder-aware 的 WYSIWYG 编辑面，其中 `var`、`var_table`、`step`、`check`、`quiz` 会直接显示成 live recorder widget，能够拖到任意可落光标的位置，并且可以直接从渲染后的节点打开字段编辑弹窗。如果这个弹窗只应该保留结构化编辑控件，可以设置 `:allow-raw-field-source-editing="false"`。关闭后再切回 recorder，record 状态会继续保留。如果宿主更希望使用固定高度，也可以设置 `:fit-viewport="false"`。

## 字段提取

通过 renderer 的 `parseAndExtract` 可以拿到内容里的结构化 AIMD 字段元数据。这很适合用来构建侧边栏、校验摘要或进度跟踪。

```ts
import { parseAndExtract } from "@airalogy/aimd-renderer"

const fields = parseAndExtract(content.value)

// fields.var       — 变量 ID 列表
// fields.step      — 步骤 ID 列表
// fields.check     — 检查点 ID 列表
// fields.quiz      — 题目定义列表
// fields.var_table — 带列元数据的表格定义
// fields.fig       — figure 定义列表
```

## Quiz 自动评分

如果宿主希望在 recorder 里直接显示每道题的得分、状态和反馈，可以先用 `parseAndExtract()` 拿到 `fields.quiz`，再调用 `@airalogy/aimd-core` 导出的评分函数生成 grade report。

```ts
import { gradeQuizRecordAnswers } from "@airalogy/aimd-core"
import { parseAndExtract } from "@airalogy/aimd-renderer"

const fields = parseAndExtract(content.value)

const report = await gradeQuizRecordAnswers(
  fields.quiz,
  record.value.quiz,
  {
    provider: async ({ quiz, answer, config, max_score }) => {
      // 推荐做法：调用你自己的后端评分接口
      // 后端再根据 config.provider 选择真实模型与密钥
      const response = await fetch("/api/grade-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz, answer, config, max_score }),
      })
      return await response.json()
    },
  },
)

const quizGrades = report.quiz
```

这里的 `config.provider` 只是 AIMD 中写的配置名，例如 `teacher_default`。推荐让后端根据这个名字决定真实的模型、密钥和评分流程，而不是把浏览器直接绑定到某个外部模型服务。

同时请注意：后端返回给 `gradeQuizAnswer()` / `gradeQuizRecordAnswers()` 的内容必须是结构化评分结果对象，不要直接返回模型生成的一段自由文本。建议至少包含：

```json
{
  "earned_score": 4,
  "max_score": 5,
  "status": "partial",
  "method": "llm",
  "feedback": "回答基本正确，但缺少一个关键点。"
}
```

如果 provider 返回的是非结构化文本，当前实现会把该题标记为 `needs_review`，而不会尝试从自由文本中可靠提取得分。

然后把结果传给 `AimdRecorder`：

```vue
<AimdRecorder
  v-model="record"
  :content="content"
  :quiz-grades="quizGrades"
  choice-option-explanation-mode="selected"
/>
```

说明：

- `choice` 与大多数 `blank` 可以直接本地自动评分
- 可确定性 `scale` 量表也可以本地自动评分，`scaleGradeDisplayMode` 用来控制结果是隐藏、填完即显示，还是提交后再显示
- `open` 题更适合使用 rubric 或后端 provider
- 练习场景可以在每次作答变化后重新生成 `quizGrades`，实现即时反馈
- 作业场景如果希望提交后才显示选项讲解，可以传 `:submitted="isSubmitted"` 并设置 `choiceOptionExplanationMode="submitted"`
- 如果量表属于评估场景，希望提交前不暴露临时分类，可以传 `:submitted="isSubmitted"` 并设置 `scaleGradeDisplayMode="submitted"`
- 考试场景可以先不传 `quizGrades`，等交卷或老师复核后再统一传入
- 对于尚未作答、状态为 `ungraded` 的题目，recorder 默认不会显示评分面板
- 如果 choice 选项里写了 `explanation`，可以通过 `choiceOptionExplanationMode` 控制是否显示选项讲解
- `submitted` 由宿主应用自己维护，recorder 不会自动判断“是否已提交”
- 正式考试场景不要把真实模型 key 放到浏览器端

## 配置项

### Editor 配置

`AimdEditor` 支持以下 props：

```vue
<AimdEditor
  v-model="content"
  locale="zh-CN"
  :messages="customEditorMessages"
/>
```

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `modelValue` | `string` | `""` | AIMD 内容（配合 `v-model`） |
| `locale` | `"en-US" \| "zh-CN"` | 自动判断 | UI 语言 |
| `messages` | `AimdEditorMessagesInput` | 内建文案 | 覆盖部分 UI 文案 |

自定义工具栏 UI 时，可用以下工厂函数构造元数据：

```ts
import {
  createAimdEditorMessages,
  createAimdFieldTypes,
  createMdToolbarItems,
} from "@airalogy/aimd-editor"

const messages = createAimdEditorMessages("zh-CN")
const fieldTypes = createAimdFieldTypes(messages)
const toolbarItems = createMdToolbarItems(messages)
```

### Renderer 配置

```ts
import { renderToHtml } from "@airalogy/aimd-renderer"

const { html } = await renderToHtml(content, {
  locale: "zh-CN",
  assignerVisibility: "hidden",   // "hidden" | "collapsed" | "expanded"
  mode: "preview",                // "preview" | "edit" | "report"
  math: true,                     // 启用 KaTeX 数学公式
  gfm: true,                      // 启用 GFM 表格、删除线等
  groupStepBodies: true,          // 将步骤后的块级正文归并进步骤容器
  quizPreview: {
    showAnswers: false,           // 预览中是否显示答案
    showRubric: false,            // 是否显示开放题 rubric
  },
})
```

如果你需要把 AIMD 节点映射成宿主应用自己的自定义元素，请配合 `aimdElementRenderers` 和 `createCustomElementAimdRenderer()` 使用。

如果你更希望拿到 Vue vnode 而不是 HTML 字符串：

```ts
import { renderToVue } from "@airalogy/aimd-renderer"

const { nodes, fields } = await renderToVue(content, {
  locale: "zh-CN",
})
```

### Recorder 配置

```vue
<AimdRecorder
  v-model="record"
  :content="content"
  locale="zh-CN"
  current-user-name="Alice"
  choice-option-explanation-mode="selected"
  :field-meta="fieldMetaMap"
  :field-state="fieldStateMap"
  :field-adapters="fieldAdapters"
  :messages="customRecorderMessages"
/>
```

| Prop | 类型 | 说明 |
|------|------|------|
| `modelValue` | `AimdProtocolRecordData` | 记录数据（配合 `v-model`） |
| `content` | `string` | AIMD 源内容 |
| `locale` | `"en-US" \| "zh-CN"` | UI 语言 |
| `currentUserName` | `string` | 自动填充 `UserName` 类型变量 |
| `quizGrades` | `Record<string, AimdQuizGradeResult>` | 题目评分结果映射；传入后会在题目下方显示得分、状态与反馈 |
| `submitted` | `boolean` | 标记当前作答是否已提交；可与 `choiceOptionExplanationMode="submitted"` 配合，在提交后再显示选项讲解 |
| `choiceOptionExplanationMode` | `"hidden" \| "selected" \| "submitted" \| "graded"` | 控制选择题选项 `explanation` 的显示时机：隐藏、选中即显示、提交后显示、或仅在题目已有评分结果后显示 |
| `scaleGradeDisplayMode` | `"hidden" \| "completed" \| "submitted" \| "graded"` | 控制可确定性 `scale` 量表在 recorder 侧本地评分的显示时机；评估场景通常建议用 `submitted`，避免提交前暴露临时得分或分组 |
| `fieldMeta` | `Record<string, AimdFieldMeta>` | 每字段元数据覆盖 |
| `fieldState` | `Record<string, AimdFieldState>` | 每字段运行时状态 |
| `fieldAdapters` | `AimdRecorderFieldAdapters` | 用宿主组件替换或包裹内建字段 UI |
| `messages` | `AimdRecorderMessagesInput` | 覆盖部分 recorder 文案 |

记录数据结构：

```ts
interface AimdProtocolRecordData {
  var: Record<string, unknown>
  step: Record<string, AimdStepOrCheckRecordItem>
  check: Record<string, AimdStepOrCheckRecordItem>
  quiz: Record<string, unknown>
}
```

## 跨包事件处理

### Recorder 字段事件

用户在 recorder 中操作字段时会触发事件。通常用 `v-model` 监听，或者直接 watch 整个 record：

```vue
<script setup lang="ts">
import { watch } from "vue"

watch(record, (newRecord) => {
  console.log("Variables:", newRecord.var)
  console.log("Steps:", newRecord.step)
  console.log("Checks:", newRecord.check)
  console.log("Quizzes:", newRecord.quiz)
}, { deep: true })
</script>
```

### Vue 注入 Key

renderer 暴露了一组 Vue injection key，用于嵌套组件间的事件协作：

```ts
import {
  fieldEventKey,
  protocolKey,
  draftEventKey,
  reportEventKey,
  bubbleMenuEventKey,
} from "@airalogy/aimd-renderer"
```

它们都是 `InjectionKey`，可配合 Vue 的 `provide` / `inject` 传递事件通道。

### Client Assigners

client assigner 会执行 JavaScript 函数，用于计算派生字段值。它们写在 AIMD 内容中，并由 recorder 执行。

```aimd
Water: {{var|water_ml: float}}
Lemon: {{var|lemon_ml: float}}
Total: {{var|total_ml: float}}

```assigner runtime=client
assigner(
  {
    mode: "auto",
    dependent_fields: ["water_ml", "lemon_ml"],
    assigned_fields: ["total_ml"],
  },
  function calculate_total({ water_ml, lemon_ml }) {
    return { total_ml: water_ml + lemon_ml };
  }
);
```

对于 `mode: "manual"` 的 assigner，需要显式触发：

```ts
const recorderRef = ref<InstanceType<typeof AimdRecorder>>()

recorderRef.value?.runClientAssigner("calculate_total")
recorderRef.value?.runManualClientAssigners()
```

## 共享本地化

三个包都支持 `en-US` 与 `zh-CN`。将同一个 locale 传给各组件，可以保证整体 UI 一致：

```vue
<AimdEditor locale="zh-CN" />

<AimdRecorder locale="zh-CN" />
```

```ts
const { html } = await renderToHtml(content, { locale: "zh-CN" })
```

每个包都提供自己的消息工厂函数，可用于更细粒度地覆盖文案：

```ts
import { createAimdEditorMessages } from "@airalogy/aimd-editor"
import { createAimdRendererMessages } from "@airalogy/aimd-renderer"
import { createAimdRecorderMessages } from "@airalogy/aimd-recorder"
```

## 数学公式与样式

在浏览器环境中调用异步 `renderToHtml` 或 `renderToVue` 时，renderer 会自动加载 renderer stylesheet。这个样式表包含数学公式所需的 KaTeX 基础样式，也包含 AIMD renderer UI 样式。若你在 SSR 或需要手动控制加载时机，可显式引入：

```ts
import "@airalogy/aimd-renderer/styles"
```

recorder 也有自己的样式入口：

```ts
import "@airalogy/aimd-recorder/styles"
```

## 完整示例

仓库里的 `apps/aimd-demo/` 目录提供了一个完整接入示例，串起了这四个包的路由、实时预览和记录流程。本地运行：

```bash
pnpm dev:demo
```
