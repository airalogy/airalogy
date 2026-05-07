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

- `--input-format csv|tsv|json|jsonl`
- `--output-format json|jsonl`
- `--allow-extra-var-fields`
- `--require-complete-quiz`
- `--no-template-defaults`
- `--no-record-ids`
- `--skip-model-sync-check`

默认情况下，CLI 会生成 `record_id`，把 `record_version` 设为 `1`，检查 `protocol.aimd` 和 `model.py::VarModel` 是否兼容，按 Protocol 补上确定性的 step/check 默认值，计算 `metadata.sha1`，并且在任意行校验失败时终止导入。
