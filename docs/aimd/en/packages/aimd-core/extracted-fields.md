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
- `ref_media`
- `cite`

## What Uses Structured Objects

- `var_definitions[]` mirrors simple `var` fields with `id`, `type`, `default`, `title`, `description`, `examples`, and raw AIMD `kwargs`
- `var_table[]` exposes canonical `id` plus optional table-level `title`, `description`, `examples`, and raw AIMD `kwargs`
- `var_table[].subvars[]` exposes canonical `id` plus optional column-level `title`, `description`, and `examples`
- `client_assigner[]` exposes `id`, `mode`, `dependent_fields`, `assigned_fields`, and `function_source` extracted from `assigner(config, function ...)` client blocks
- `connectors[]` exposes connector registries from fenced `connectors` blocks, including `version`, connector ids, `kind`, `entity`, `descriptor`, `search`, `resolve`, and non-secret auth metadata such as `token_env`
- `workflow[]` exposes workflow definitions from fenced `workflow` blocks, including `version`, `id`, `nodes`, `assigners`, transition ids, normalized `from` / `to` arrays, transition `inputs`, grouped target `assign`, `logic`, and `default_initial_node`
- `quiz[]` already exposes `id`
- `fig[]` exposes `id`, `src`, `title`, and `legend` from fenced `fig` blocks
- `media[]` exposes `id`, `kind`, `src`, `mime`, `provider`, `poster`, `title`, and `legend` from fenced `media` blocks
- `refs[]` exposes BibTeX entries from fenced `refs` blocks with `id`, `entry_type`, `raw`, normalized `fields`, and display fields such as `title`, `author`, `year`, `doi`, and `url`
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

If you are upgrading older integrations, note that the old `name` aliases have been removed. Read [Migration](/en/packages/aimd-core/compatibility).
