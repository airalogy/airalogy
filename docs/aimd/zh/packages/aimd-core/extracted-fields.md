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
- `ref_media`
- `cite`

## 使用对象结构的部分

- `var_definitions[]` 对应普通 `var` 字段，包含 `id`、`type`、`default`、`title`、`description`、`examples` 与原始 AIMD `kwargs`
- `var_table[]` 提供规范字段 `id`，以及可选的表级 `title`、`description`、`examples` 和原始 AIMD `kwargs`
- `var_table[].subvars[]` 提供规范字段 `id`，以及可选的列级 `title`、`description`、`examples`
- `client_assigner[]` 提供 `id`、`mode`、`dependent_fields`、`assigned_fields`、`function_source`，它们来自 `assigner(config, function ...)` 形式的前端代码块
- `workflow[]` 提供 fenced `workflow` 代码块中的 workflow 定义，包括 `version`、`id`、`nodes`、`assigners`、transition id、归一化后的 `from` / `to` 数组、transition `inputs`、按目标分组的 `assign`、`logic` 和 `default_initial_node`
- `quiz[]` 本来就使用 `id`
- `fig[]` 提供 fenced `fig` 代码块中的 `id`、`src`、`title`、`legend`
- `media[]` 提供 fenced `media` 代码块中的 `id`、`kind`、`src`、`mime`、`provider`、`poster`、`title`、`legend`
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
  "workflow": [
    {
      "version": "airalogy.workflow.v1",
      "id": "parameter_optimization",
      "title": "Parameter Optimization Workflow",
      "nodes": [
        {
          "id": "prep",
          "protocol": "./protocols/sample-prep/protocol.aimd",
          "title": "Sample Preparation"
        },
        {
          "id": "analysis",
          "protocol": "./protocols/analysis/protocol.aimd",
          "title": "QC Analysis"
        }
      ],
      "assigners": [
        {
          "id": "optimize_parameters",
          "runtime": "python",
          "entrypoint": "./assigners/optimize_parameters.py:assign"
        }
      ],
      "transitions": [
        {
          "id": "retry_after_qc_failure",
          "from": ["analysis"],
          "to": ["prep"],
          "when": "${analysis.check.pass_qc.checked} == false",
          "run": "optimize_parameters",
          "inputs": {
            "summary": "${analysis.var.summary}",
            "failed_metrics": "${analysis.var.failed_metrics}"
          },
          "max_iterations": 5,
          "assign": {
            "prep": {
              "var.target_temperature_c": "${retry_after_qc_failure.outputs.recommended_temperature_c}",
              "var.target_concentration_m": "${retry_after_qc_failure.outputs.recommended_concentration_m}",
              "var.retry_note": "${retry_after_qc_failure.outputs.retry_reason}"
            }
          }
        }
      ],
      "default_initial_node": "prep"
    }
  ],
  "refs": [
    {
      "id": "yang2025airalogyaiempowereduniversaldata",
      "entry_type": "misc",
      "title": "Airalogy: AI-empowered universal data digitization for research automation",
      "author": "Zijie Yang and Qiji Zhou and Fang Guo and Sijie Zhang and Yexun Xi and Jinglei Nie and Yudian Zhu and Liping Huang and Chou Wu and Yonghe Xia and Xiaoyu Ma and Yingming Pu and Panzhong Lu and Junshu Pan and Mingtao Chen and Tiannan Guo and Yanmei Dou and Hongyu Chen and Anping Zeng and Jiaxing Huang and Tian Xu and Yue Zhang",
      "year": "2025",
      "url": "https://arxiv.org/abs/2506.18586"
    }
  ],
  "media": [
    {
      "id": "lecture_video",
      "kind": "video",
      "src": "files/videos/lecture.mp4",
      "mime": "video/mp4",
      "poster": "files/videos/lecture-poster.jpg",
      "title": "Lecture Video"
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
