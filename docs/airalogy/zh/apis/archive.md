# `.aira` 单文件归档与 Reader

Airalogy 支持基于 zip 的单文件归档格式，方便通过微信、邮件、网盘或其他传输工具分享 Protocol 和 Record。

当前第 1 版统一使用一个后缀：

- `.aira`：标准 Airalogy archive 容器

具体内容类型由内部 manifest 的 `kind` 字段决定：

- `kind: "protocol"`：单个 Airalogy Protocol 归档
- `kind: "protocols"`：多个 Airalogy Protocol 目录组成的 bundle，不包含 Record
- `kind: "records"`：一个或多个 Airalogy Record JSON 的打包文件，也可以可选内嵌相关 Protocol 目录

所有归档都会在内部保存一个机器可读的清单文件：`_airalogy_archive/manifest.json`。

## 为什么需要它

一个 Airalogy Protocol 通常是一个目录，里面至少有 `protocol.aimd`，还可能包含 `model.py`、`assigner.py`、`protocol.toml`、`files/` 等文件。这个目录结构很适合开发，但不适合直接作为“一个文件”发送给别人。

Airalogy archive 的目标就是在不破坏原有目录结构的前提下，把它封装成一个专门的单文件容器。`.aira` 因此成为 Airalogy Protocol 和 Airalogy Record 的可携带文件表面：任意电脑都可以打开、查看、校验，并在未来把它路由到兼容 Airalogy 的软件与工具中。

## CLI 用法

把一个 Protocol 目录打成 `.aira`：

```bash
airalogy pack ./my_protocol -o my_protocol.aira
```

把多个 Protocol 目录打成一个不含 Record 的 `.aira`：

```bash
airalogy pack ./protocol_a ./protocol_b -o protocols.aira
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

不解包直接查看或校验：

```bash
airalogy inspect ./record_bundle.aira
airalogy inspect ./record_bundle.aira --json
airalogy validate ./record_bundle.aira
airalogy validate ./record_bundle.aira --json
```

## Airalogy Reader

仓库中提供了浏览器版 Reader 应用：`apps/aira-reader`。它可以在本地打开 `.aira` 文件，显示 manifest、protocol、record、归档成员和校验问题，并且不会把文件内容上传到服务器。

```bash
pnpm dev:aira-reader
pnpm build:aira-reader
```

GitHub Pages workflow 会把 Reader 发布为静态应用：`https://airalogy.github.io/airalogy/aira-reader/`。

## Python API

```python
from airalogy.archive import (
    inspect_archive,
    pack_protocol_archive,
    pack_protocols_archive,
    pack_records_archive,
    read_archive_manifest,
    validate_archive,
    unpack_archive,
)

pack_protocol_archive("my_protocol", "my_protocol.aira")
pack_protocols_archive(["protocol_a", "protocol_b"], "protocols.aira")
pack_records_archive(["record.json"], "records.aira", protocol_dirs=["my_protocol"])
manifest = read_archive_manifest("records.aira")
summary = inspect_archive("records.aira")
ok, issues = validate_archive("records.aira")
output_dir, manifest = unpack_archive("records.aira", "records_out")
```

## Protocol archive 的行为

- 打包前会校验 `protocol.aimd`；如果旁边存在 `model.py`，也会检查 `model.py::VarModel` 是否只定义 AIMD 中存在的变量字段，以及同名字段是否存在显式类型冲突。
- 归档会保留原始 Protocol 目录结构。
- `files/` 以及其他普通协议资源文件会按原样打包。
- 新生成的归档会在 manifest 中记录 Protocol 文件的 SHA-256 hash，方便 Reader 检测文件是否被篡改。
- 默认会排除 `.env` 以及 `__pycache__/`、`.pyc` 等常见缓存产物。
- 如果存在 `protocol.toml`，其元信息会写入 manifest；如果不存在，则会回退到目录名，以及在可能时回退到 `protocol.aimd` 的第一个 `# Heading`。

## Protocol bundle 的行为

- `kind: "protocols"` 归档包含多个 Protocol 目录，并且不包含 Record payload。
- 每个 Protocol 都会存放在独立的 `archive_root` 下，例如 `protocols/my_protocol__0.1.0/`。
- 这适合分享 protocol pack、组织级模板包，或一组还没有采集 Record 的数据标准。

## Record bundle 的行为

- 输入 JSON 文件既可以是单条 record 对象，也可以是一个 record 对象列表。
- manifest 会尽量保留每条 record 的 `record_id`、`record_version`、`protocol_id`、`protocol_version` 等元信息。
- 新生成的归档会为每条打包后的 Record JSON 写入 SHA-256 hash。
- 当你传入 `--protocol-dir` 时，Airalogy 会先校验该 Protocol，再尝试把每条 record 和对应的内嵌 Protocol 关联起来。

## 安全性与限制

- `airalogy unpack` 会进行安全解包检查，拒绝任何试图逃逸目标目录的归档条目。
- `airalogy validate` 和 Airalogy Reader 会检查 manifest、成员路径、Record JSON、Protocol 文件引用，以及存在时的 SHA-256 hash。
- 因为 `.aira` 是统一后缀，所以消费者需要读取 `_airalogy_archive/manifest.json` 并根据 `kind` 判断里面到底是单 Protocol、Protocol bundle，还是 Record 包。
- 第 1 版只打包 Protocol 目录、JSON records 和可选的内嵌 Protocol 目录。
- 第 1 版不会自动把远端 Airalogy file ID 解析成实际二进制文件内容。
