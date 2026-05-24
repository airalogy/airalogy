# Extracted Fields

After `processor.runSync(tree, file)`, normalized field metadata is available at `file.data.aimdFields`.

## What Stays As Arrays

These scopes are still simple `string[]`, and each string is an identifier:

- `var`
- `step`
- `check`
- `ref_step`
- `ref_var`
- `ref_fig`
- `cite`

## What Uses Structured Objects

- `var_definitions[]` mirrors simple `var` fields with `id`, `type`, `default`, `title`, `description`, and raw AIMD `kwargs`
- `var_table[]` exposes canonical `id`
- `var_table[].subvars[]` exposes canonical `id`
- `client_assigner[]` exposes `id`, `mode`, `dependent_fields`, `assigned_fields`, and `function_source` extracted from `assigner(config, function ...)` client blocks
- `quiz[]` already exposes `id`
- `step_hierarchy[]` exposes `id`, `step`, `parent_id`, `prev_id`, `next_id`, `estimated_duration_ms`, `timer_mode`, `has_check`, and `has_children`

## Example

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

If you are upgrading older integrations, note that the old `name` aliases have been removed. Read [Migration](/en/packages/aimd-core/compatibility).
