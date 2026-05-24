# 解析节点

`remarkAimd` 会把 AIMD 行内模板和代码块解析为 `type: "aimd"` 的 MDAST 节点。

## 基础结构

```ts
interface BaseNode {
  type: "aimd"
  fieldType: AimdFieldType
  id: string
  scope: AimdScope
  raw: string
}
```

解析后的 AIMD 节点现在只保留 `id` 作为标识字段。

## 示例

源码：

```aimd
{{var|sample_name: str}}
{{step|sample_preparation}}
```

解析结果片段：

```ts
{
  type: "aimd",
  fieldType: "var",
  id: "sample_name",
  scope: "var",
  raw: "{{var|sample_name: str}}",
  definition: { id: "sample_name", type: "str" },
}

{
  type: "aimd",
  fieldType: "step",
  id: "sample_preparation",
  scope: "step",
  raw: "{{step|sample_preparation}}",
  level: 1,
  sequence: 0,
  step: "1",
}
```

## 说明

- `var`、`step`、`check`、`ref_*` 的标识符都来自 AIMD 源码中的 id。
- `quiz` 和 `fig` 语法本身就有显式 `id`，解析结果同样直接保留。
- 渲染器输出现在只使用 `data-aimd-id` 作为主元数据。
