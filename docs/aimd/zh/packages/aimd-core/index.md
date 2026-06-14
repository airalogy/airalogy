# @airalogy/aimd-core

`@airalogy/aimd-core` 提供 AIMD 的语法解析与规范化字段提取能力。

> 协议级 AIMD 语法、assigner 语义与校验规则以 Airalogy 文档为准；本页只描述 `@airalogy/aimd-core` 如何在前端解析并提取这些结构。

## 安装

```bash
pnpm add @airalogy/aimd-core
```

## 核心能力

- 解析 AIMD 模板语法与 `quiz` / `fig` 代码块。
- 解析 fenced `assigner runtime=client` 代码块并提取前端 assigner 元数据。
- 构建兼容 MDAST 的 AIMD 节点。
- 构建兼容 MDAST 的 CriticMarkup 审阅节点，包括添加、删除、替换、注释和高亮。
- 输出标准化字段结构，供 renderer/editor/recorder 复用，包括 `fields.var_definitions` 中的普通 `var` 定义。

## 示例

```ts
import { unified } from "unified"
import remarkParse from "remark-parse"
import { remarkAimd } from "@airalogy/aimd-core/parser"

const content = "{{var|sample_name: str}}"
const processor = unified().use(remarkParse).use(remarkAimd)
const tree = processor.parse(content)
const file = { data: {} } as any
processor.runSync(tree, file)

console.log(file.data.aimdFields)
```

client assigner 仍然使用同一个 `assigner` fenced block 名，只是在头部声明 runtime：

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

## Choice 后续字段

选择题选项可以在 `followups` 下声明条件触发的结构化字段。parser 会把这些字段提取为 `options[].followups`，字段类型只接受 `str`、`int`、`float`、`bool`；`number` 有意不属于 AIMD followup 类型集合。

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

判断题使用 `type: true_false`。`answer` 和 `default` 是布尔值；如果省略 `options`，默认选项为 `true. True` 和 `false. False`。自定义 `options` 时也可以在 `true` / `false` 选项下声明 `followups`。

````aimd
```quiz
id: sample_kept_cold
type: true_false
stem: "样本转移过程中是否一直保持低温？"
answer: true
```
````

## Markdown 表格

如果 AIMD 行内模板出现在 Markdown 表格单元格中，需要在 `parse()` 之前先保护模板，避免 GFM 把模板里的 `|` 当成列表格分隔符：

```ts
import { protectAimdInlineTemplates, remarkAimd } from "@airalogy/aimd-core/parser"

const { content: protectedContent, templates } = protectAimdInlineTemplates(content)
const file = { data: { aimdInlineTemplates: templates } } as any
const tree = processor.parse(protectedContent)
processor.runSync(tree, file)
```

## CriticMarkup 审阅节点

当宿主需要在 Markdown AST 中保留 CriticMarkup 风格审阅标记时，可以使用 `remarkCriticMarkup`。该 parser 会生成 `criticAddition`、`criticDeletion`、`criticSubstitution`、`criticComment`、`criticHighlight` 等自定义 MDAST 节点；它不会向 `fields` 增加条目，也不会改变 `remarkAimd` 的字段提取结果。

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

`protectCriticMarkupSubstitutions()` 应在 GFM 前执行，因为 CriticMarkup 替换语法同样使用 `~~`，否则会被 GFM 当作 strikethrough。行内代码和 fenced 代码块会保留原始文本。

## 校验辅助函数

如果你的编辑器、lint 流程或导入链路需要在 AIMD 内容进入 renderer / recorder 之前先做 parser 级校验，`@airalogy/aimd-core/parser` 还导出了两个可复用辅助函数：

```ts
import {
  parseVarDefinition,
  validateClientAssignerFunctionSource,
  validateVarDefinition,
  validateVarDefaultType,
  validateVarKwargs,
} from "@airalogy/aimd-core/parser"
```

- `validateClientAssignerFunctionSource(functionSource, id)` 会拒绝不安全或不受支持的前端 `client_assigner` 代码，例如 `eval`、`window`、`fetch`、Unicode 转义绕过，以及其他非确定性结构。
- `validateVarDefaultType(def)` 会在 AIMD var 的默认值与声明类型不匹配时返回 warning 文本。
- `validateVarKwargs(def)` 会在支持的 kwargs 被用于不兼容的 var 定义时返回 warning 文本，包括 `gt`、`ge`、`lt`、`le`、`multiple_of` 这类 Pydantic 风格数值约束被用在非数值类型上。
- `validateVarDefinition(def)` 会合并默认值校验与 kwargs 校验，并递归检查嵌套 `subvars`。

## 继续阅读

- 解析节点与字段提取结果现在只保留 `id`。如果你在升级旧接入，请先阅读[迁移说明](/zh/packages/aimd-core/compatibility)。
- [解析节点](/zh/packages/aimd-core/parsed-nodes)
- [字段提取结果](/zh/packages/aimd-core/extracted-fields)
- [迁移说明](/zh/packages/aimd-core/compatibility)
