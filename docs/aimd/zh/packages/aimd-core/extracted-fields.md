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

- `var_definitions[]` 对应普通 `var` 字段，包含 `id`、`type`、`default`、`title`、`description` 与原始 AIMD `kwargs`
- `var_table[]` 提供规范字段 `id`
- `var_table[].subvars[]` 提供规范字段 `id`
- `client_assigner[]` 提供 `id`、`mode`、`dependent_fields`、`assigned_fields`、`function_source`，它们来自 `assigner(config, function ...)` 形式的前端代码块
- `quiz[]` 本来就使用 `id`
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
      "kwargs": {
        "title": "Temperature",
        "gt": 0
      }
    }
  ],
  "var_table": [
    {
      "id": "samples",
      "scope": "var_table",
      "subvars": [
        { "id": "sample_id" },
        { "id": "concentration" }
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
