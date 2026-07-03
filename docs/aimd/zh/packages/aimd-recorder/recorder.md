# AimdRecorder

当你希望把 AIMD 输入控件直接渲染在协议正文流里时，使用 `AimdRecorder`。

## 示例

```vue
<script setup lang="ts">
import { ref } from "vue"
import {
  AimdRecorder,
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
} from "@airalogy/aimd-recorder"
import "@airalogy/aimd-recorder/styles"

const content = ref(`# Protocol

样本名：{{var|sample_name: str, title="样本名", description="样本的人类可读标签", examples=["S-001"]}}
记录者：{{var|operator: UserName}}
记录时间：{{var|current_time: CurrentTime}}
温度设置：{{var|temperature: float = 25.0, title="温度 (C)", description="环境温度，单位为摄氏度", examples=[25.0, 37.0]}}
实验摘要：{{var|summary: AiralogyMarkdown}}
质粒：{{var|plasmid: DNASequence}}`)
const record = ref<AimdProtocolRecordData>(createEmptyProtocolRecordData())
</script>

<template>
  <AimdRecorder
    v-model="record"
    :content="content"
    locale="zh-CN"
    current-user-name="张三"
  />
</template>
```

`record` 数据结构：

```json
{
  "var": {},
  "step": {},
  "check": {},
  "quiz": {}
}
```

## 内建 Recorder 行为

- `CurrentTime` 和 `UserName` 可以从运行时上下文自动填值。
- `AiralogyMarkdown` 会渲染为横铺的 AIMD/Markdown 字段，支持 `预览` 与 `源码` 切换；预览会通过 AIMD renderer 输出 Markdown 并渲染 Mermaid 代码块，源码编辑仍保留切换到 `所见即所得` 的能力。
- `DNASequence` 会渲染专用序列控件，支持交互式模式、原始结构模式、文件导入导出、拓扑切换、feature 编辑，以及基于 `SeqViz` 的可视化。
- `ref_var` 如果已有记录值，会优先以内联只读内容显示当前值。
- `var` 和 `var_table` 标签会显示 AIMD 里的 `title`，设置标题时仍显示规范 id，并且只在 hover 或键盘 focus 时展示 `description` 与 `example`/`examples` 详情。没有显式 placeholder 覆盖时，第一个标量示例会作为默认占位文案。
- `bool | None`、`Literal[...] | None`、`BloodType | None` 这类带 `None` 的下拉型字段会显示本地化的 `未填写` 选项，并把该选项保存为 `null`。必填下拉字段不会显示空值选项，用户仍然需要选择真实枚举值。
- `list[str]`、`list[int]`、`list[float]` 以及等价的可选标量列表变量会渲染为整行字段，支持可重复添加、可拖拽排序的逐项输入，并额外支持 JSON 数组模式，最终保存为标量数组，而不是只能使用通用结构化 textarea。
- `choice`、`true_false`、`blank`、`open`、`scale` 五类 quiz 都有内建 recorder 输入。
- 数值 `var` 输入会识别 `gt`、`ge`、`lt`、`le`、`multiple_of` 这类 Pydantic 风格约束；这些约束只对 `int`、`integer`、`float`、`number` 类型生效。
- client assigner 会用同一组数值约束判断依赖是否就绪；依赖字段违反声明边界时会跳过执行。

## Client Assigner

前端受限的 client assigner 会在 recorder 中本地执行。

````aimd
Water: {{var|water_volume_ml: float}}
Lemon: {{var|lemon_juice_ml: float}}
Total: {{var|total_liquid_ml: float}}

```assigner runtime=client
assigner(
  {
    mode: "auto",
    dependent_fields: ["water_volume_ml", "lemon_juice_ml"],
    assigned_fields: ["total_liquid_ml"],
  },
  function calculate_total_liquid_ml({ water_volume_ml, lemon_juice_ml }) {
    return {
      total_liquid_ml: Math.round((water_volume_ml + lemon_juice_ml) * 100) / 100,
    };
  }
);
```
````

如果使用 `mode: "manual"`，`AimdRecorder` 会通过组件 ref 暴露显式触发方法：

```ts
recorderRef.value?.runClientAssigner("calculate_total_liquid_ml")
recorderRef.value?.runManualClientAssigners()
```

## 语言与单独 Quiz 组件

`AimdRecorder` 和 `AimdQuizRecorder` 都支持通过 `locale` 切换内建标签：

```vue
<AimdRecorder locale="zh-CN" />
<AimdQuizRecorder :quiz="quiz" locale="zh-CN" />
```

单独题目控件用法：

```vue
<script setup lang="ts">
import { ref } from "vue"
import { AimdQuizRecorder } from "@airalogy/aimd-recorder"
import "@airalogy/aimd-recorder/styles"

const answer = ref("")
const quiz = {
  id: "quiz_single_1",
  type: "choice",
  mode: "single",
  stem: "请选择一个选项",
  options: [
    { key: "A", text: "选项 A" },
    { key: "B", text: "选项 B" },
  ],
}
</script>

<template>
  <AimdQuizRecorder v-model="answer" :quiz="quiz" />
</template>
```

如果某个 `choice` 或 `true_false` 选项定义了 `followups`，recorder 只会在该选项被选中后显示这些补充输入。这类题目的答案值结构为 `{ selected, followups }`；普通 choice 题继续使用原来的字符串或字符串数组格式，普通 true/false 题继续使用布尔值。

## 显示评分结果

如果宿主已经在别处完成了评分，可以把结果回传给 `AimdRecorder` 或 `AimdQuizRecorder` 直接展示。对于可确定性自动评分的 `scale` 量表，recorder 也可以直接在前端计算总分和分组。

整份 recorder：

```vue
<AimdRecorder
  v-model="record"
  :content="content"
  :quiz-grades="quizGrades"
  choice-option-explanation-mode="selected"
  scale-grade-display-mode="submitted"
/>
```

单题组件：

```vue
<AimdQuizRecorder
  v-model="answer"
  :quiz="quiz"
  choice-option-explanation-mode="graded"
  :grade="{
    quiz_id: 'quiz_single_1',
    earned_score: 4,
    max_score: 5,
    status: 'partial',
    method: 'keyword_rubric',
    feedback: '答案方向正确，但还缺少一个要点。',
    review_required: true,
  }"
/>
```

推荐做法：

- `choice` 与常规 `blank` 可以直接本地自动评分
- `open` 题或高开放性 `blank` 建议由后端 provider 评分
- 练习题可以实时传入 `quizGrades`，让学生立即看到状态、得分和反馈
- 可确定性 `scale` 量表可以本地自动评分，再用 `scaleGradeDisplayMode` 控制是填完即显示，还是提交后才显示
- 如果 `choice` 选项里定义了 `explanation`，可以用 `choiceOptionExplanationMode="selected"` 在选中后立即显示讲解
- 如果希望学生提交后再显示选项讲解，可以配合 `:submitted="isSubmitted"` 和 `choiceOptionExplanationMode="submitted"`
- 如果希望 `scale` 的总分和分组只在提交后出现，可以配合 `:submitted="isSubmitted"` 和 `scaleGradeDisplayMode="submitted"`
- 如果希望等评分完成后再显示选项讲解，可以使用 `choiceOptionExplanationMode="graded"`
- 考试题可以先不传 `quizGrades`，等统一评分后再展示结果
- 尚未作答且状态为 `ungraded` 的题目，默认不会显示评分面板
- 正式考试不要把真实模型密钥传给前端

作业或提交后讲解示例：

```vue
<AimdRecorder
  v-model="record"
  :content="content"
  :submitted="isSubmitted"
  choice-option-explanation-mode="submitted"
/>
```

其中 `submitted` 由宿主应用控制。`AimdRecorder` 本身不会自动判断“是否已提交”，也不内建交卷按钮。
