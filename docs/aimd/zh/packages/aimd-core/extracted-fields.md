# 字段提取结果

执行 `processor.runSync(tree, file)` 之后，标准化字段元数据会写入 `file.data.aimdFields`。

## 保持为数组的部分

下面这些 scope 仍然是 `string[]`，数组里的每一项都是 id：

- `var`
- `step`
- `check`
- `ref_step`
- `ref_var`
- `ref_fig`
- `cite`

## 使用对象结构的部分

- `var_definitions[]` 对应普通 `var` 字段，包含 `id`、`type`、`default`、`title`、`description`、`examples` 与原始 AIMD `kwargs`
- `var_table[]` 提供规范字段 `id`，以及可选的表级 `title`、`description`、`examples` 和原始 AIMD `kwargs`
- `var_table[].subvars[]` 提供规范字段 `id`，以及可选的列级 `title`、`description`、`examples`
- `client_assigner[]` 提供 `id`、`mode`、`dependent_fields`、`assigned_fields`、`function_source`，它们来自 `assigner(config, function ...)` 形式的前端代码块
- `quiz[]` 本来就使用 `id`
- `fig[]` 提供 fenced `fig` 代码块中的 `id`、`src`、`title`、`legend`
- `refs[]` 提供 fenced `refs` 代码块中的 BibTeX 条目，包含 `id`、`entry_type`、`raw`、标准化 `fields`，以及 `title`、`author`、`year`、`doi`、`url` 等展示字段
- `step_hierarchy[]` 提供 `id`、`step`、`parent_id`、`prev_id`、`next_id`、`estimated_duration_ms`、`timer_mode`、`has_check`、`has_children`

## 示例

```json
{
  "var": ["temperature"],
  "var_definitions": [
    {
      "id": "temperature",
      "type": "float",
      "default": 36.5,
      "title": "Temperature",
      "description": "Ambient temperature in Celsius",
      "examples": [25.0, 37.0],
      "kwargs": {
        "title": "Temperature",
        "description": "Ambient temperature in Celsius",
        "examples": [25.0, 37.0],
        "gt": 0
      }
    }
  ],
  "var_table": [
    {
      "id": "samples",
      "scope": "var_table",
      "title": "Samples",
      "description": "Measured sample rows",
      "examples": ["S-001 row"],
      "subvars": [
        {
          "id": "sample_id",
          "title": "Sample ID",
          "description": "Tube identifier",
          "examples": ["S-001"]
        },
        {
          "id": "concentration",
          "title": "Concentration",
          "examples": [1.0]
        }
      ]
    }
  ],
  "client_assigner": [
    {
      "id": "calculate_total",
      "runtime": "client",
      "mode": "auto",
      "dependent_fields": ["a", "b"],
      "assigned_fields": ["total"],
      "function_source": "function calculate_total({ a, b }) { return { total: a + b }; }"
    }
  ],
  "refs": [
    {
      "id": "yang2025airalogy",
      "entry_type": "article",
      "title": "Airalogy: Universal Research Automation",
      "author": "Yang, Zijie",
      "year": "2025",
      "doi": "10.1234/airalogy.2025"
    }
  ],
  "step_hierarchy": [
    {
      "id": "sample_preparation",
      "level": 1,
      "sequence": 0,
      "step": "1",
      "next_id": "data_analysis"
    }
  ]
}
```

如果你在升级旧接入，需要注意旧的 `name` 别名已经移除。详见[迁移说明](/zh/packages/aimd-core/compatibility)。
