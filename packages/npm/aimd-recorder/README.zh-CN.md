# @airalogy/aimd-recorder

[![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-recorder?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/aimd-recorder)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/airalogy/airalogy/blob/main/LICENSE)

AIMD（Airalogy Markdown）记录 UI 组件与样式集合，包含协议内联录入组件、组合式 `AimdRecorderEditor` 与可复用题目作答控件。

内置变量控件支持 `CurrentTime`、`UserName`、`AiralogyMarkdown` 和 `DNASequence`。
`BloodType` 这类官方命名枚举类型会使用从 Python `airalogy.types` 注册表生成的元数据渲染为下拉输入。
和 `None` 组合的下拉型字段，例如 `bool | None`、`Literal[...] | None`、`BloodType | None`，会显示本地化的 `未填写` 选项，并把该选项保存为 `null`；必填下拉字段不会显示这个空值选项。
`list[str]`、`list[int]`、`list[float]` 这类标量列表变量会渲染为整行字段，支持可重复添加、可拖拽排序的逐项输入，并额外支持 JSON 数组模式，最终保存为干净的标量数组。
`EntityRef` 和 `list[EntityRef]` 变量在宿主传入 `entityResolvers` 后会渲染为实体引用控件，让 recorder 用户可以搜索和选择外部数据库或其他 Protocol 中已有的实体，而不需要把每一种实体类型都写死进 AIMD。
Collector 绑定的 `Observation[T]` 和 `list[Observation[T]]` 变量在宿主传入 `collectorProviders` 后会渲染为数据采集控件，支持单次读取、手动启停轮询、授权钩子、来源归一化、取消和显式手工回退。
`AimdRecorder` 内建默认折叠的 protocol-aware 当前 Record 搜索控件，可以搜索全部字段或某个指定字段；展开后会 sticky 保持在 recorder 顶部，高亮匹配字段，在匹配字段控件之间跳转，并在原生文本输入控件中尽量选中命中的文本片段。
`AiralogyMarkdown` 现在会在 recorder 中以横铺内嵌 AIMD/Markdown 字段呈现，可在渲染预览和源码编辑之间切换；源码编辑保留完整顶部工具栏，并继续支持切换到 `所见即所得`，而不是普通 textarea。
在 recorder/edit 模式下，`ref_var` 如果已经有记录值，会优先以只读内联内容显示该值。
`var` 和 `var_table` 标签会显示 AIMD 的 `title`，保留规范 id，并且只在 hover 或键盘 focus 时展示 `description` 与 `example`/`examples` 详情；宿主也可以通过 `fieldMeta` 在运行时覆盖这些显示字段。
前端受限的 `assigner runtime=client` 代码块会在 recorder 中本地执行，用于纯 `var` 计算。
如果需要一边改 Protocol 结构、一边继续填写字段数据，可以使用 `AimdRecorderEditor`，它会把源码编辑器和 recorder 绑定到同一份 `content` 与 `record`，并在字段 id 从当前 protocol 里消失后单独展示旧数据。

> 协议级 AIMD 语法、assigner 语义与校验规则以 Airalogy 文档为准；`@airalogy/aimd-*` 文档只描述前端 parser、renderer、recorder 如何实现这些规范。

## 安装

```bash
pnpm add @airalogy/aimd-recorder @airalogy/aimd-core
```

## 快速开始

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
血型：{{var|blood_type: BloodType | None}}
标签：{{var|sample_tags: list[str]}}
重复数：{{var|replicate_counts: list[int]}}
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

`AiralogyMarkdown` 字段会渲染一个横铺内嵌的 AIMD/Markdown 区域，可在 `预览` 和 `源码` 之间切换；预览会通过 AIMD renderer 输出 Markdown，并渲染 Mermaid 代码块。源码编辑保留完整顶部工具栏，同时支持切换到 `所见即所得`。即使它写在一行文字中间，recorder 也会把这个字段提升成下一行的块级编辑区，而不是继续当成段内小控件。

`EntityRef` 字段会使用 `entity="plasmid"`、`source="lab_plasmid_registry"` 这类 Protocol metadata 来选择 resolver。resolver map 的 key 可以是 connector id，也可以是 entity namespace。如果 Protocol 声明了 fenced `connectors` 代码块，宿主可以用 `@airalogy/aimd-core/utils` 的 `createAimdEntityResolversFromConnectors()` 生成这个 resolver map；也可以手动提供 resolver：

```vue
<script setup lang="ts">
const content = '来源质粒：{{var|parent_plasmid: EntityRef | None, entity="plasmid", source="lab_plasmid_registry"}}'

const entityResolvers = {
  lab_plasmid_registry: {
    async search(query) {
      return [
        {
          entity: "plasmid",
          source: "lab_plasmid_registry",
          id: "pUC19",
          label: "pUC19 cloning vector",
        },
      ].filter(item => item.id.toLowerCase().includes(query.toLowerCase()) || item.label.toLowerCase().includes(query.toLowerCase()))
    },
  },
}
</script>

<template>
  <AimdRecorder
    v-model="record"
    :content="content"
    :entity-resolvers="entityResolvers"
  />
</template>
```

选择结果会保存为 `{ entity, source, id, label? }` 这样的对象；`list[EntityRef]` 会保存为这些对象组成的数组。`id` 是稳定关联键，`label` 是可选显示缓存，缺失时 recorder 会回退显示 `id`。recorder 不会自己去拉取 AIMD `connectors` descriptor，因此即使使用 `aimd-core` connector helper，网络访问和认证仍由宿主应用控制。

Collector provider 使用同样的宿主绑定边界。Protocol 声明 `kind: data_source` connector、`collectors` 代码块和 `Observation[T]` 字段，宿主按 connector id 注入 provider：

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

Provider 可以返回裸值，也可以返回 `{ value, observed_at?, unit?, quality?, sequence?, metadata?, device_id? }`。Recorder 会补全 `received_at` 和可信 `source` metadata，再写入归一化的 `Observation`。授权钩子可返回 `false`、`true`/`"once"` 或 `"record"`；当 `collectorRecordKey` 或 Protocol 内容改变时，当前 Record 授权会被清除。当前运行时支持 `snapshot` 和手动启停的 `polling`；`stream`、自动生命周期和文件化序列属于后续阶段。

数值 `var` 输入会识别 `gt`、`ge`、`lt`、`le`、`multiple_of` 这类 Pydantic 风格约束；这些约束只对 `int`、`integer`、`float`、`number` 类型生效。
client assigner 也会用这些约束判断依赖是否就绪，因此依赖的数值字段违反声明边界时，assigner 不会执行。

`DNASequence` 字段会渲染一个专用 DNA 编辑器，支持：

- 默认以 `交互式` 模式进行可视化编辑
- 单独提供 `原始结构` 模式处理序列原文和结构化精修
- 可选的顶层序列名称字段，可用于质粒或构建体命名
- 共享工具栏可导入 FASTA / GenBank 序列文件，并将当前值导出为 GenBank `.gbk` 文件
- 交互式空状态下可直接粘贴 DNA 文本
- IUPAC DNA 序列输入
- 拓扑切换（`linear` / `circular`）
- GenBank 对齐子集风格的特征编辑
- 多段位置片段（segments）与每段的 partial 标记
- `gene`、`product`、`label`、`note` 等限定词行编辑

通过 `locale` 可以切换 recorder 内建标签（`en-US` / `zh-CN`）。
`AimdProtocolRecorder` 仍保留为已废弃的兼容别名，但新的代码建议直接使用 `AimdRecorder`。

## Assigner 拓扑图

使用 `AimdAssignerGraph` 可以直接渲染协议中的 `assigner_graph` 数据，不需要绑定宿主应用自己的 store 或 UI 框架。

```vue
<script setup lang="ts">
import { AimdAssignerGraph } from "@airalogy/aimd-recorder"
import "@airalogy/aimd-recorder/styles"

const assignerGraph = {
  nodes: [
    { name: "seconds", type: "dependent_field" },
    { name: "calculate_duration", type: "assigner" },
    { name: "duration", type: "assigned_field" },
  ],
  edges: [
    ["seconds", "calculate_duration"],
    ["calculate_duration", "duration"],
  ],
}
</script>

<template>
  <AimdAssignerGraph
    :assigner-graph="assignerGraph"
    :node-schema-map="{ duration: { title: '时长' } }"
    height="520px"
  />
</template>
```

## Recorder Editor

当用户需要在同一个界面里同时修改 AIMD Protocol 结构并继续填写 recorder 数据时，使用 `AimdRecorderEditor`。

```vue
<script setup lang="ts">
import { ref } from "vue"
import {
  AimdRecorderEditor,
  createEmptyProtocolRecordData,
  type AimdProtocolRecordData,
} from "@airalogy/aimd-recorder"
import "@airalogy/aimd-recorder/styles"

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

这个 editor 会在 AIMD 源码变化时继续保留 recorder 状态，并把 `Recorder`、`Record Data`、`脱离当前 Protocol 的旧数据` 收到右侧同一组 tab 里，避免 AIMD 很长时这些面板被挤到页面底部。默认情况下，左右两列会根据 editor 在当前页面里的位置和浏览器可用高度自动伸展，尽量撑满视口，并在各自面板内部滚动，避免左右两列高度失衡；这个同高滚动行为也会覆盖 recorder 侧的可视化编辑模式。如果宿主仍然希望保留独立的 `Field 结构编辑` 辅助面板，可以显式传 `:show-field-structure="true"`。同时用户可以直接：

- 切换 field kind
- 修改 field id
- 修改内联 `var` 的值类型
- 新增或删除 field
- 通过拖拽调整 field 源码片段顺序

如果字段被改名或删除，脱离当前 protocol 的旧值会在右侧 `脱离当前 Protocol 的旧数据` tab 里单独显示出来，用户可以再把它们搬到新建 field 里，而不是只能去翻外部 JSON。

对于不理解源码的用户，这个 editor 现在还提供了一个 recorder-aware 的 WYSIWYG 编辑模式。打开 recorder 面板标题栏里的切换后，右侧会直接切到一个可落光标的 AIMD 编辑器，其中 `var`、`var_table`、`step`、`check`、`quiz` 会直接显示成真实的 recorder widget，而不是普通小 chip。用户可以一边继续写标题、列表和普通 Markdown，一边拖动这些渲染后的 field 到任意可落光标的位置；拖动过程中还会出现明确的落点提示，方便更精确地放置。也可以直接通过贴在 field 本体上的 hover / focus 工具条完成编辑、删除和拖动，不需要跳出当前 widget。如果宿主不希望用户在 recorder 侧继续改 raw AIMD，可以设置 `:allow-raw-field-source-editing="false"`，这样字段弹窗里只保留结构化控件。关闭切换后再回到正常 recorder 录入，已有 record 数据会继续保留。

如果宿主不希望跟随浏览器高度自动伸展，可以显式关闭：

```vue
<AimdRecorderEditor
  :fit-viewport="false"
  :editor-min-height="640"
  :recorder-min-height="640"
/>
```

如果宿主应用本身已经控制了可用高度，比如路由级 flex 工作区或左右分栏页面，可以把组件放进一个有界父容器，并同时设置 `:fill-parent="true"` 和 `:fit-viewport="false"`。这种模式下 `AimdRecorderEditor` 会填满父容器，而不是重新测量浏览器视口；源码编辑器和 recorder 侧都会在自己的面板内部滚动。

```vue
<section class="workspace-pane">
  <AimdRecorderEditor
    v-model="record"
    v-model:content="content"
    :fill-parent="true"
    :fit-viewport="false"
  />
</section>
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

client assigner 示例：

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

如果使用 `mode: "manual"`，组件会通过 Vue ref 暴露显式触发方法：

```ts
recorderRef.value?.runClientAssigner("calculate_total_liquid_ml")
recorderRef.value?.runManualClientAssigners()
```

## 宿主字段适配器

```ts
import { h } from "vue"

const fieldAdapters = {
  step: ({ node, defaultVNode }) =>
    h("step-card", {
      "step-id": node.id,
      "step-number": node.step,
      title: node.title || node.id,
      level: String(node.level),
    }, () => [defaultVNode]),
}
```

当宿主应用需要替换或包裹内建字段 UI，但仍希望继续复用 AIMD 解析和 recorder record-state 管理时，可以把 `fieldAdapters` 传给 `AimdRecorder`。

如果宿主应用需要的是某个具体类型的行为扩展，而不是整体替换某类字段 UI，则应该使用 `typePlugins`。type plugin 可以为单个 AIMD 类型定义初始值、归一化、显示/解析钩子，甚至完整的专用 widget。

内建的 `AiralogyMarkdown` 字段也是沿用这条扩展路径实现的，因此宿主应用如果需要不同的预览/源码工作流，仍然可以覆盖它。

参见：

- `docs/aimd/zh/packages/type-plugins.md`

### 仅题目控件

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
  <AimdQuizRecorder v-model="answer" :quiz="quiz" locale="zh-CN" />
</template>
```

如果某个 choice 选项定义了 `followups`，recorder 会在该选项被选中后显示这些补充输入。对于这类题目，`v-model` 使用 `{ selected, followups }`；没有 followups 的 choice 题仍保持原来的字符串或字符串数组答案格式。

`AimdQuizRecorder` 也支持 `scale` 量表题。对于可确定性自动评分的量表，既可以继续传外部 `grade`，也可以通过 `scaleGradeDisplayMode="completed"` 或 `scaleGradeDisplayMode="submitted"` 控制本地总分和分组结果何时显示。

## 文档

- EN: <https://airalogy.github.io/airalogy/aimd/en/packages/aimd-recorder>
- 中文: <https://airalogy.github.io/airalogy/aimd/zh/packages/aimd-recorder>
- 文档源码：`docs/aimd/en/packages/aimd-recorder.md`、`docs/aimd/zh/packages/aimd-recorder.md`
