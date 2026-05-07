# 批量导入 Record

`airalogy.ingest` 可以把按行组织的数据导入为任意 Protocol 对应的 Airalogy Record JSON。

导入器会读取 Protocol 的 `protocol.aimd`。如果存在 `model.py::VarModel`，会用它覆写 AIMD 生成模型中的同名字段，并保留只在 AIMD 中定义的字段；否则会直接使用 AIMD 文件动态生成的 `VarModel`。每一行输入都会变成一条 Record。变量数据由 Pydantic 校验；quiz 答案会按 Protocol 中的 quiz 定义校验；step 和 check 数据会按 Protocol 中的 ID 校验。

## Python API

```python
from airalogy.ingest import import_records

result = import_records(
    protocol_dir="./my_protocol",
    input_path="./records.csv",
    output_path="./records.jsonl",
)

if not result.ok:
    for error in result.errors:
        print(error)
```

## VarModel 聚合与冲突检查

如果一个 Protocol 目录同时包含 `protocol.aimd` 和 `model.py`，导入器会先从 AIMD 生成基础 `VarModel`，再用 `model.py::VarModel` 覆写同名字段。AIMD 中存在而 `model.py` 没有定义的字段会保留 AIMD 生成的类型。`model.py::VarModel` 不能定义 AIMD 中不存在的变量字段。

默认兼容性检查会在下列情况失败：

- `model.py::VarModel` 定义了 AIMD 中不存在的字段
- 同一个字段在 AIMD 中显式声明为简单标量类型（`str`、`int`、`float` 或 `bool`），但 `model.py::VarModel` 中的注解与之冲突

只有在你明确需要跳过这个兼容性检查时，才使用 `validate_model_sync=False`：

```python
result = import_records(
    protocol_dir="./my_protocol",
    input_path="./records.csv",
    validate_model_sync=False,
)
```

支持的输入格式：

- CSV：`.csv`
- TSV：`.tsv`
- JSON Lines：`.jsonl`
- JSON：单个行对象、行对象列表，或 `{"records": [...]}`

支持的输出格式：

- JSON 数组：`.json`
- JSON Lines：`.jsonl`

## 列映射

没有前缀的列会导入到 `data.var`：

```csv
sample_id,temperature_c
S1,37.5
```

上面的输入会变成：

```json
{
  "data": {
    "var": {
      "sample_id": "S1",
      "temperature_c": 37.5
    }
  }
}
```

非变量区使用前缀：

```csv
sample_id,quiz.quiz_choice_1,step.prepare.checked,check.qc.annotation,metadata.operator
S1,A,true,reviewed,alice
```

因为默认会补齐 step/check 模板字段，所以上面的输入会产生下面这样的核心 Record 片段。其中 CSV 未提供的 `step.prepare.annotation` 和 `check.qc.checked` 会分别补为 `""` 和 `false`。这里省略了自动生成的 `record_id`、`record_version`、`metadata.sha1`，以及可能来自 `protocol.toml` 的协议元信息：

```json
{
  "metadata": {
    "operator": "alice"
  },
  "data": {
    "var": {
      "sample_id": "S1"
    },
    "quiz": {
      "quiz_choice_1": "A"
    },
    "step": {
      "prepare": {
        "annotation": "",
        "checked": true
      }
    },
    "check": {
      "qc": {
        "annotation": "reviewed",
        "checked": false
      }
    }
  }
}
```

支持的前缀路径：

- `var.<field_id>`
- `quiz.<quiz_id>`
- `step.<step_id>.checked`
- `step.<step_id>.annotation`
- `check.<check_id>.checked`
- `check.<check_id>.annotation`
- `metadata.<field_name>`
- `record_id`
- `record_version`
- `airalogy_record_id`

列表或对象值可以作为某一列的值写成 JSON，例如 `[{"name": "Alice"}]`。

## CLI

```bash
airalogy import-records ./my_protocol -i records.csv -o records.jsonl
```

常用选项：

- `--input-format csv|tsv|json|jsonl`：显式指定输入格式。默认 `auto` 会根据输入文件后缀推断。
- `--output-format json|jsonl`：显式指定输出格式。默认 `auto` 会根据输出文件后缀推断。
- `--allow-extra-var-fields`：允许输入中出现 Protocol 未声明的变量字段，并把这些字段保留到 `data.var`。默认会把这类字段视为错误。由于额外字段不会经过 `VarModel` 校验，常规导入不建议开启。
- `--require-complete-quiz`：要求 Protocol 中定义的每个 quiz 都必须在输入数据中有答案。默认允许 quiz 答案缺失。
- `--no-template-defaults`：不要自动补齐 step/check 的模板默认值。默认会按 Protocol 给 step/check 补上确定性的 `annotation` 和 `checked` 字段。
- `--no-record-ids`：不要自动生成 `record_id`。如果输入数据中显式提供了 `record_id` 列，仍会使用该值。
- `--skip-model-sync-check`：跳过 `protocol.aimd` 和 `model.py::VarModel` 的兼容性检查。默认会拒绝 model-only 变量字段和同名显式类型冲突；只应在迁移或调试时使用。

默认情况下，CLI 会生成 `record_id`，把 `record_version` 设为 `1`，检查 `protocol.aimd` 和 `model.py::VarModel` 是否兼容，按 Protocol 补上确定性的 step/check 默认值，计算 `metadata.sha1`，并且在任意行校验失败时终止导入。
