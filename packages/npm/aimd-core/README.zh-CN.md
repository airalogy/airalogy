# @airalogy/aimd-core

[![npm version](https://img.shields.io/npm/v/%40airalogy%2Faimd-core?logo=npm&color=cb3837)](https://www.npmjs.com/package/@airalogy/aimd-core)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](https://github.com/airalogy/airalogy/blob/main/LICENSE)

AIMD（Airalogy Markdown）的核心解析器与规范化字段提取能力。

它也会把 fenced `assigner runtime=client` 代码块提取为 `fields.client_assigner` 前端元数据。
Fenced `connectors` YAML 代码块会被提取到 `fields.connectors`，作为 `EntityRef` 这类 connector-backed 字段的 Protocol metadata。
Fenced `collectors` YAML 代码块会被提取到 `fields.collectors`；parser 会校验 data-source connector、Collector id、生命周期 step 引用和 `Observation[T]` 字段绑定，但不会访问设备或网络。
普通 `var` 的 id 仍然保留在 `fields.var`；其解析出的类型、默认值和 kwargs 元数据也会通过 `fields.var_definitions` 暴露。
`title`、`description`、`example`/`examples` 这类显示元数据会被提取到 `var` 和 `var_table` 字段结构里，renderer 与 recorder 可以显示更友好的标签，同时保留稳定的规范 id。
它也暴露 `remarkCriticMarkup`，用于把 CriticMarkup 风格审阅标记解析进 Markdown AST，但不会把这些审阅标记加入 AIMD 字段提取结果。

> 协议级 AIMD 语法、assigner 语义与校验规则以 Airalogy 文档为准；`@airalogy/aimd-*` 文档只描述前端 parser、renderer、recorder 如何实现这些规范。

## 安装

```bash
pnpm add @airalogy/aimd-core
```

## 快速开始

```ts
import { unified } from "unified"
import remarkParse from "remark-parse"
import { remarkAimd } from "@airalogy/aimd-core/parser"

const content = '{{var|sample_name: str, title="样本名", description="样本的人类可读标签", examples=["S-001"]}}'
const processor = unified().use(remarkParse).use(remarkAimd)
const tree = processor.parse(content)
const file = { data: {} } as any
processor.runSync(tree, file)

console.log(file.data.aimdFields)
```

示例 client assigner：

````aimd
```assigner runtime=client
assigner(
  {
    mode: "auto",
    dependent_fields: ["a", "b"],
    assigned_fields: ["total"],
  },
  function calculate_total({ a, b }) {
    return {
      total: a + b,
    };
  }
);
```
````

如果 AIMD 行内模板出现在 Markdown 表格单元格中，需要在 `parse()` 之前先保护模板，避免 GFM 把模板里的 `|` 当成列表格分隔符：

```ts
import { protectAimdInlineTemplates, remarkAimd } from "@airalogy/aimd-core/parser"

const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
const file = { data: { aimdInlineTemplates: templates } } as any
const tree = processor.parse(protectedContent)
processor.runSync(tree, file)
```

## CriticMarkup 审阅节点

```ts
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import {
  CRITIC_MARKUP_SUBSTITUTIONS_DATA_KEY,
  protectCriticMarkupSubstitutions,
  remarkCriticMarkup,
} from "@airalogy/aimd-core/parser"

const { content: protectedContent, substitutions } = protectCriticMarkupSubstitutions(
  "替换 {~~旧表述~>新表述~~}，并标记 {==重点文字==}。",
)
const file = { data: { [CRITIC_MARKUP_SUBSTITUTIONS_DATA_KEY]: substitutions } } as any
const processor = unified().use(remarkParse).use(remarkGfm).use(remarkCriticMarkup)
const tree = processor.parse(protectedContent)
processor.runSync(tree, file)
```

`remarkCriticMarkup` 会生成 `criticAddition`、`criticDeletion`、`criticSubstitution`、`criticComment` 和 `criticHighlight` 节点。它不会改变 AIMD 字段提取结果。

## Choice 后续字段

选择题选项可以在 `followups` 下声明条件触发的结构化字段。解析结果会保存在 `options[].followups`，字段类型只支持 `str`、`int`、`float`、`bool`；这里有意不接受 `number`。

````aimd
```quiz
id: sample_storage
type: choice
mode: single
stem: "样本当前如何保存？"
options:
  - key: A
    text: "冷藏保存"
    followups:
      - key: temperature_c
        type: float
        title: "温度"
        unit: "°C"
      - key: duration_hours
        type: float
        title: "时长"
        unit: "小时"
  - key: B
    text: "冷冻保存"
  - key: C
    text: "常温放置"
```
````

## 判断题

判断题使用 `type: true_false`。`answer` 和 `default` 会被规范化为布尔值；如果省略 `options`，默认选项为 `true. True` 和 `false. False`。

````aimd
```quiz
id: sample_kept_cold
type: true_false
stem: "样本转移过程中是否一直保持低温？"
answer: true
```
````

## 校验辅助函数

```ts
import {
  parseConnectorsContent,
  parseCollectorsContent,
  parseVarDefinition,
  validateClientAssignerFunctionSource,
  validateVarDefinition,
  validateVarDefaultType,
  validateVarKwargs,
} from "@airalogy/aimd-core/parser"
```

如果宿主工具需要在保存或执行前预检 fenced `assigner runtime=client` 函数，可使用 `validateClientAssignerFunctionSource()`。如果你想在作者填写 AIMD var 默认值时提示类型不匹配警告，可使用 `validateVarDefaultType()`。如果工具还需要提示 `gt`、`ge`、`lt`、`le`、`multiple_of` 这类 Pydantic 风格数值约束被用在非数值类型上，可使用 `validateVarKwargs()` 或 `validateVarDefinition()`。

如果工具需要在完整 remark pipeline 之外单独校验 fenced `connectors` 代码块的 YAML body，可以使用 `parseConnectorsContent()`。该 parser 只读取 metadata，不会拉取 descriptor、不调用 endpoint，也不会读取环境 secret。

使用 `parseCollectorsContent()` 可以单独校验和归一化 fenced `collectors` YAML body。完整 `remarkAimd` 解析还会额外校验 Collector 与 connector、生命周期 step 以及 Collector 与 var 的引用关系。

## Entity Connector 工具

`@airalogy/aimd-core/utils` 导出 `createAimdEntityResolversFromConnectors()`，供宿主把官方 `connectors` metadata 转成 recorder `EntityRef` 选择控件可直接使用的 resolver：

```ts
import { createAimdEntityResolversFromConnectors } from "@airalogy/aimd-core/utils"

const entityResolvers = createAimdEntityResolversFromConnectors(fields.connectors ?? [], {
  loadDescriptor: descriptor => archive.readText(descriptor),
  getSecret: name => backendSecretProxy(name),
  fetch: window.fetch.bind(window),
})
```

底层也暴露 `searchAimdEntityConnector()` 和 `resolveAimdEntityConnector()`。descriptor 加载、`fetch` 和 secret 读取都由宿主提供，因此浏览器 bundle 不会直接读取 `.env` 文件，也不会内联凭据。

## Record 查询工具

`@airalogy/aimd-core/utils` 导出 `collectAimdRecordFieldRefs()`、`searchAimdRecordFields()`、`filterAimdRecord()`、`filterAimdRecords()` 等 protocol-aware record 辅助函数。这些函数使用解析后的字段元数据搜索全部字段或指定字段，也支持存放在 `record.var` 下的 `var_table` subvar，因此宿主应用可以构建 Record 搜索和筛选 UI，而不需要重新实现 AIMD 字段遍历逻辑。

## 内置类型元数据

`@airalogy/aimd-core/utils` 导出 `getAimdBuiltInTypeMetadata()` 和 `getAimdBuiltInTypeEnumValues()`。随包发布的元数据由 Python `airalogy.types` 注册表生成，因此 `BloodType` 这类官方命名枚举类型可以在浏览器工具中复用同一组取值，不需要在 npm 代码里重新维护 Python 类型定义。

## 文档

- EN: <https://airalogy.github.io/airalogy/aimd/en/packages/aimd-core>
- 中文: <https://airalogy.github.io/airalogy/aimd/zh/packages/aimd-core>
- 解析结果结构与 `name` -> `id` 迁移说明见包文档。
- 文档源码：`docs/aimd/en/packages/aimd-core/`、`docs/aimd/zh/packages/aimd-core/`
