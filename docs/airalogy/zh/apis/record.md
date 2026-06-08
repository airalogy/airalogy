# Airalogy Record v1

Airalogy Record 是基于 Protocol 记录、校验或生成的一条标准数据对象。`.aira` 是容器，Record 是容器中最重要的标准数据单元。

Record v1 的公共 JSON Schema 位于：

```text
schemas/aira/record.v1.schema.json
```

## 核心结构

```json
{
  "format": "airalogy.record",
  "schema_version": 1,
  "record_id": "11111111-1111-4111-8111-111111111111",
  "record_version": 1,
  "metadata": {
    "protocol_id": "sample_protocol",
    "protocol_version": "0.1.0"
  },
  "data": {
    "var": {},
    "step": {},
    "check": {},
    "quiz": {}
  }
}
```

`format` 和 `schema_version` 建议写入所有新 Record。为了兼容历史数据，当前校验器允许旧 Record 不包含这两个字段；如果存在，则必须分别为 `airalogy.record` 和 `1`。

## CLI 用法

查看 Record 文件：

```bash
airalogy record inspect ./record.json
airalogy record inspect ./record.json --json
```

校验 Record 基础结构：

```bash
airalogy record validate ./record.json
```

结合 Protocol 校验 `data.var` 和 `data.quiz`：

```bash
airalogy record validate ./record.json --protocol-dir ./my_protocol
```

如果一个 Record 文件包含来自多个 Protocol 的记录，可以多次传入 `--protocol-dir`，Airalogy 会根据 `metadata.protocol_id` 和 `metadata.protocol_version` 自动匹配：

```bash
airalogy record validate ./records.json \
  --protocol-dir ./protocol_a \
  --protocol-dir ./protocol_b
```

可选参数：

- `--protocol-dir`：用于 Protocol 级别校验的 Protocol 目录，可重复传入。
- `--allow-extra-var-fields`：允许 `data.var` 中存在 Protocol 未声明的字段。
- `--require-complete-quiz`：要求 Protocol 中每一道 quiz 都有答案。
- `--skip-model-sync-check`：跳过 `protocol.aimd` 与 `model.py::VarModel` 的同步检查。

## 与 `.aira` 的关系

当 `airalogy pack` 打包 Record JSON 时，会先执行 Record 结构校验。如果同时传入 `--protocol-dir`，会进一步用匹配的 Protocol 校验 Record 的 `data.var`。

`.aira` archive validation 和 Airalogy Reader 也会检查 Record payload 是否满足基础结构要求，例如：

- Record payload 必须是 JSON object。
- `record_version` 如果存在，必须是正整数。
- `data` 必须是 object。
- `data.var` 必须是 object。
- `data.step`、`data.check`、`data.quiz` 如果存在，也必须是 object。

Protocol 级别的深度校验目前由 Python CLI 执行，因为它需要读取 `protocol.aimd`、可选 `model.py` 和 quiz 模板定义。
