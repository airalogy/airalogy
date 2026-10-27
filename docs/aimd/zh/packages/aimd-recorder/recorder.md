# AimdRecorder

## 检查点说明

当 `checked_message` 包含类似 AIMD 的字面文本时，可视化表单和字段编辑工具会保留整个检查点。例如 `checked_message="保留字面文本 {{ref_var|wait_s}}"` 在勾选后原样显示，不解析其中的嵌套引用；参数字符串之外普通 Markdown 中的引用不受影响。编辑、移动或删除检查点时，操作对象均为完整定义。

检查点可以有简短的 `title`，例如 `{{check|safety_ready, title="防护用品检查"}}`。详细展示显示标题和较小的 ID，简洁展示保留标题并隐藏 ID。可视化设置对话框编辑标题和勾选后提示，保留已有 ID、勾选状态及备注。标题选填，检查正文与标题独立。

检查要求写在标记后，例如 `{{check|safety_ready}} 确认手套和护目镜已佩戴。`。ID 是稳定的 Record 键；后续段落是检查正文，不会自动变成标题。单独的检查点标记在没有正文时显示 ID。Recorder 及其可视化编辑控件只显示一次检查点徽标，不把预览控件当作正文，并保留真实正文及其中的输入框。

## 可视化表单编辑

步骤标记使用全宽、紧凑的步骤栏，不再作为小卡片挤在正文旁边。主信息是步骤编号和可选的 `title`，ID 作为小字号次要信息；精简显示隐藏 ID，但保留标题。没有标题时以步骤编号作为主标识。可视化控件使用整篇文档的编号，包括嵌套层级。说明文字在步骤栏下方保持可编辑，勾选框、预计时长、计时和备注操作集中排列。渲染器产生的空段落不会形成空白正文，也不会把备注按钮推到单独一行；真实正文、图片和控件仍然保留。

`AimdRecorderWysiwygSurface` 把可编辑的文档文字和真实 Recorder 控件放在同一界面。用户可以插入一个输入框，立即在框内填写，不需要切到源码或另一个面板；它不是只能配置定义的占位块。

```vue
<script setup lang="ts">
import { ref } from "vue"
import { AimdRecorderWysiwygSurface, createEmptyProtocolRecordData } from "@airalogy/aimd-recorder"
import "@airalogy/aimd-recorder/styles"

const content = ref('样本：{{var|field_1: str, title="样本名"}}')
const record = ref(createEmptyProtocolRecordData())
</script>

<template>
  <AimdRecorderWysiwygSurface
    v-model:content="content"
    v-model="record"
    field-display="compact"
    locale="zh-CN"
  />
</template>
```

“输入框”对话框在插入前自动生成稳定、唯一的 ID。用户可选择文本、整数、小数、下拉选择、是/否、日期、文本列表，名称选填。字段旁的“编辑”操作打开属性面板，ID 放在高级设置中。填写值属于 `record`，不会写成 AIMD 的默认值。修改 var ID 时，当前值复制到新键，旧键保留为脱离文档的数据以便恢复；不会迁移外部 Records 或 assigner 代码。删除字段不会擦除已保存的值。步骤设置可编辑名称和计时参数，保留已有 ID、引用、勾选状态、备注和累计时间。其他结构编辑通过 `edit-field` 交给宿主，可打开高级设置或源码编辑器；需要完整多面板工作台时仍可使用 `AimdRecorderEditor`。

`fieldDisplay="compact"` 隐藏 var 的 ID、title 等头部信息和表格技术键，同时保留填写控件和校验消息。空的原生输入框可用 title 作为占位提示，无障碍名称仍然保留。列表的逐项/JSON 切换、计算按钮和专用编辑器工具栏不会被一起隐藏。传入 `detailed` 可恢复元数据展示，不改变内容和数值。包组件默认仍为 `detailed`；AIMD Demo 默认使用全宽可视化表单，首次访问显示字段信息，之后恢复用户保存的显示偏好，并提供源码、只填写和并排视图。

可视化编辑中的输入框使用 Recorder 的真实控件，不只是字段占位符：

| 字段类型 | 填写控件 |
| --- | --- |
| `str`、`int`、`float` | 文本、整数、小数输入 |
| `Literal[...]`、官方命名枚举、`enum` 选项 | 下拉框，保留选项的原始值类型 |
| `list[Literal[...]]`、官方命名枚举列表 | 复选框组，保存选项数组 |
| `bool` | 复选框，并显示“是／否” |
| `bool \| None` | “未填写／是／否”下拉框 |
| `date`、`time`、`datetime`、`CurrentTime` | 对应的日期或时间控件 |
| `list[str]`、`list[int]`、`list[float]` | 逐项填写和 JSON 模式 |
| 其他结构化列表、字典 | JSON 输入 |
| `FileId*` | 文件选择及已有文件展示 |
| `JsonStr` 等代码字符串、`AiralogyMarkdown`、`DNASequence` | 对应的专用编辑器 |
| `EntityRef`、`ResourceRef` | 关联数据选择控件，数据源由宿主提供 |

`T | None`、`Optional[T]`、`Union[T, None]` 保留 `T` 的控件类型；原生可空输入和选择框清空后写入 `null`。未知类型继续使用默认输入或宿主提供的 `typePlugins`，不会因为隐藏元数据而自动变成另一种数据类型。前端交互校验不能代替 Python/Pydantic 的最终校验。

多选示例：`{{var|analyses: list[Literal["测序", "显微镜观察"]] | None}}`。选中多项保存为 `["测序", "显微镜观察"]`；逐一取消所有选项得到 `[]`，点击“未填写”恢复 `null`。前端会校验每个选项是否合法，仍由 Python/Pydantic 完成最终校验。`AimdRecorderWysiwygSurface` 和独立 `AimdRecorder` 使用相同控件。

独立可视化宿主可调用 `insertText(text)` 在光标位置插入文本。`showModeSwitch` 显示源码/可视化切换并发出 `switch-mode`；`imageToolbarAction="custom"` 发出 `request-image`。`readonly` 同时禁用定义编辑和数值录入。校验及 provider 属性沿用 Recorder 的契约，每个内嵌字段不会重复显示“搜索当前记录”。

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

Recorder 输出填写值，但不自行创建持久化记录、分配记录 ID/版本或写入浏览器存储，这些由宿主负责。[在线 Demo 的保存流程](../../demo#保存模板与记录)提供可恢复的填写草稿，并通过 `@airalogy/aira-core` 区分模板导出与 Record `.aira` 导出。填写值不会写入 AIMD 默认值。

- `CurrentTime` 和 `UserName` 可以从运行时上下文自动填值。
- `AiralogyMarkdown` 会渲染为横铺的 AIMD/Markdown 字段，支持 `预览` 与 `源码` 切换；预览会通过 AIMD renderer 输出 Markdown 并渲染 Mermaid 代码块，源码编辑仍保留切换到 `所见即所得` 的能力。
- `DNASequence` 会渲染专用序列控件，支持交互式模式、原始结构模式、文件导入导出、拓扑切换、feature 编辑，以及基于 `SeqViz` 的可视化。
- `EntityRef` 和 `list[EntityRef]` 会在宿主传入 `entityResolvers` 后渲染为实体引用控件；resolver key 可以匹配 AIMD `source` connector id，也可以匹配 `entity` namespace。宿主可以使用 `@airalogy/aimd-core/utils` 的 `createAimdEntityResolversFromConnectors()` 从解析出的 `connectors` metadata 生成这些 resolver。
- Collector 绑定的 `Observation[T]` 和 `list[Observation[T]]` 字段会在宿主传入 `collectorProviders` 后渲染为数据采集控件，支持单次读取、手动轮询控制、授权、取消、来源记录和显式手工回退。
- `ref_var` 如果已有记录值，会优先以内联只读内容显示当前值。
- `var` 和 `var_table` 标签会显示 AIMD 里的 `title`，设置标题时仍显示规范 id，并且只在 hover 或键盘 focus 时展示 `description` 与 `example`/`examples` 详情。没有显式 placeholder 覆盖时，第一个标量示例会作为默认占位文案。
- `bool | None`、`Literal[...] | None`、`BloodType | None` 这类带 `None` 的下拉型字段会显示本地化的 `未填写` 选项，并把该选项保存为 `null`。必填下拉字段不会显示空值选项，用户仍然需要选择真实枚举值。
- `list[str]`、`list[int]`、`list[float]` 以及等价的可选标量列表变量会渲染为整行字段，支持可重复添加、可拖拽排序的逐项输入，并额外支持 JSON 数组模式，最终保存为标量数组，而不是只能使用通用结构化 textarea。
- `AimdRecorder` 内建默认折叠的 protocol-aware 当前 Record 搜索控件，可以搜索全部字段或某个指定字段；展开后会 sticky 保持在 recorder 顶部，高亮匹配字段控件，在匹配项之间跳转，并在原生文本输入控件中尽量选中命中的文本片段。
- `choice`、`true_false`、`blank`、`open`、`scale` 五类 quiz 都有内建 recorder 输入。
- 数值 `var` 输入会识别 `gt`、`ge`、`lt`、`le`、`multiple_of` 这类 Pydantic 风格约束；这些约束只对 `int`、`integer`、`float`、`number` 类型生效。
- client assigner 会用同一组数值约束判断依赖是否就绪；依赖字段违反声明边界时会跳过执行。

## Record 校验

使用 Protocol 解析返回的 Pydantic JSON Schema 作为前后端共享契约，宿主需要在提交前拦截时，再通过组件 ref 调用：

```vue
<AimdRecorder
  ref="recorderRef"
  v-model="record"
  :content="content"
  :validation-schema="parseResult.data?.json_schema"
/>
```

```ts
const result = await recorderRef.value?.validate()
if (!result?.valid) return
```

Schema 契约同时接受 engine 键（`vars`、`steps`、`checks`）和兼容用的 platform 别名（`research_variable`、`research_step`、`research_check`），覆盖必填、类型、格式、pattern、枚举、数值边界、数组、对象及内建类型约束，也会先归一化上传文件等结构化值。Schema 标记为 required 且不可为空的 Recorder 输入即使已存在于内存 Record，空字符串和空数组仍会判为未填；可为空的属性接受 `null`，也不显示必填标记。没有 Schema 时，Recorder 回退到 AIMD 声明：自动把没有默认值的字段视为必填，但类型包含 `None` 或使用 `Optional[...]` 的字段除外；AIMD 或 `fieldMeta` 中显式的 `required` 设置仍会生效。

Recorder 默认只在当前字段 `change` 或 `blur` 时重新校验，不会清除其他字段的错误；可通过 `validationTriggers` 调整。表格错误使用 `var_table:samples:0:concentration` 这样的精确行列 key 记录、展示和聚焦。

`AimdRecorder` 和 `AimdRecorderEditor` 都暴露 `validate()`、`validateField(fieldKey)`、`clearValidation(fieldKey?)` 和 `focusFirstInvalidField()`。校验结果包含 `issues` 和 `fieldState`。前端提交拦截通过后，仍应执行服务端 Pydantic 权威校验；服务端错误可通过已有 `fieldState` 属性回填。

## Collector Provider

Collector 声明来自 Protocol，真实设备和网络访问由宿主通过 connector id 注入 provider map 来控制：

```ts
const collectorProviders = {
  lab_sensor_gateway: {
    async read({ collector, signal }) {
      const response = await fetch(`/api/sensors/${collector.channel}`, { signal })
      return response.json()
    },
  },
}
```

```vue
<AimdRecorder
  v-model="record"
  :content="content"
  :collector-providers="collectorProviders"
  :request-collector-permission="requestCollectorPermission"
  :collector-record-key="recordId"
  collector-actor-id="user-123"
/>
```

Provider 可以返回裸值或 observation envelope。Recorder 在写入 Record 前会补全 `received_at` 和可信 `source` metadata。授权回调可以返回 `false`、`true`/`"once"` 或 `"record"`；当 Record key 或 Protocol 内容改变时，Record 范围授权会被清除。规范详见 [Collector 语法与运行时](https://airalogy.github.io/airalogy/zh/syntax/collectors)。

当前浏览器运行时支持 `snapshot` 和手动启停的 `polling`。`stream`、自动 record/step 生命周期与文件化 `ObservationSeriesRef[T]` 采集可以解析，但当前不执行。

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
