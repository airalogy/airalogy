# 单文件归档打包

Airalogy 支持基于 zip 的单文件归档格式，方便通过微信、邮件、网盘或其他传输工具分享 Protocol 和 Record。

当前第 1 版统一使用一个后缀：

- `.aira`：标准 Airalogy archive 容器

具体内容类型由内部 manifest 的 `kind` 字段决定：

- `kind: "protocol"`：单个 Airalogy Protocol 归档
- `kind: "records"`：一个或多个 Airalogy Record JSON 的打包文件，也可以可选内嵌相关 Protocol 目录

这两种归档都会在内部保存一个机器可读的清单文件：`_airalogy_archive/manifest.json`。

## 为什么需要它

一个 Airalogy Protocol 通常是一个目录，里面至少有 `protocol.aimd`，还可能包含 `model.py`、`assigner.py`、`protocol.toml`、`files/` 等文件。这个目录结构很适合开发，但不适合直接作为“一个文件”发送给别人。

Airalogy archive 的目标就是在不破坏原有目录结构的前提下，把它封装成一个专门的单文件容器。

## CLI 用法

把一个 Protocol 目录打成 `.aira`：

```bash
airalogy pack ./my_protocol -o my_protocol.aira
```

把一个或多个 Record JSON 打成 `.aira`：

```bash
airalogy pack ./record.json ./record-history.json -o records.aira
```

如果希望 Record 包里同时带上相关 Protocol，可额外嵌入 Protocol 目录：

```bash
airalogy pack ./record.json -o record_bundle.aira --protocol-dir ./my_protocol
```

解包：

```bash
airalogy unpack ./my_protocol.aira -o ./extracted_protocol
airalogy unpack ./record_bundle.aira -o ./extracted_bundle
```

## Python API

```python
from airalogy.archive import (
    pack_protocol_archive,
    pack_records_archive,
    read_archive_manifest,
    unpack_archive,
)

pack_protocol_archive("my_protocol", "my_protocol.aira")
pack_records_archive(["record.json"], "records.aira", protocol_dirs=["my_protocol"])
manifest = read_archive_manifest("records.aira")
output_dir, manifest = unpack_archive("records.aira", "records_out")
```

## Protocol archive 的行为

- 归档会保留原始 Protocol 目录结构。
- `files/` 以及其他普通协议资源文件会按原样打包。
- 默认会排除 `.env` 以及 `__pycache__/`、`.pyc` 等常见缓存产物。
- 如果存在 `protocol.toml`，其元信息会写入 manifest；如果不存在，则会回退到目录名，以及在可能时回退到 `protocol.aimd` 的第一个 `# Heading`。

## Record bundle 的行为

- 输入 JSON 文件既可以是单条 record 对象，也可以是一个 record 对象列表。
- manifest 会尽量保留每条 record 的 `record_id`、`record_version`、`protocol_id`、`protocol_version` 等元信息。
- 当你传入 `--protocol-dir` 时，Airalogy 会尝试把每条 record 和对应的内嵌 Protocol 关联起来。

## 安全性与限制

- `airalogy unpack` 会进行安全解包检查，拒绝任何试图逃逸目标目录的归档条目。
- 因为 `.aira` 是统一后缀，所以消费者需要读取 `_airalogy_archive/manifest.json` 并根据 `kind` 判断里面到底是 protocol 还是 records。
- 第 1 版只打包 JSON records 和可选的 Protocol 目录。
- 第 1 版不会自动把远端 Airalogy file ID 解析成实际二进制文件内容。
