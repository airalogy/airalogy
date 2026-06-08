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

把 Record 引用的本地文件载荷一起打入离线包：

```bash
airalogy pack ./record.json -o record_bundle.aira --file-payload ./files.json
```

`files.json` 可以是一个对象、对象数组，或带有顶层 `files` 数组的对象：

```json
{
  "files": [
    {
      "path": "./downloads/image.png",
      "file_id": "airalogy.id.file.xxx.png",
      "source_uri": "oss://bucket/path/image.png",
      "filename": "image.png",
      "mime_type": "image/png",
      "record_id": "01234567-0123-0123-0123-0123456789ab",
      "field_path": "data.var.sample_photo"
    }
  ]
}
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

## 示例归档

仓库中提供了可直接打开的示例归档，位置是 `examples/aira/`：

- `single-protocol.aira`：一个 Protocol，不包含 Record
- `protocols-bundle.aira`：多个 Protocol，不包含 Record
- `records-with-protocol.aira`：一个内嵌 Protocol 和多条 Record
- `multi-protocol-records.aira`：多个内嵌 Protocol，以及来自多个 Protocol 的 Record
- `records-with-file.aira`：一个内嵌 Protocol、一条 Record、一个文件引用和一个离线 blob

这些文件适合用来测试 Airalogy Reader，也可以用来观察不同 `kind` 在 manifest 中的结构差异。

## 内部文件结构

`.aira` 文件本质上是一个 ZIP 归档。每个归档都必须包含 `_airalogy_archive/manifest.json`；其他文件都通过这个 manifest 来解释。

单个 Protocol 归档：

```text
example.aira
├─ _airalogy_archive/
│  └─ manifest.json
├─ protocol.aimd
├─ protocol.toml              # 可选，但推荐
├─ model.py                   # 可选
├─ assigner.py                # 可选
└─ files/                     # 可选的 Protocol 资源文件
   └─ ...
```

对于 `kind: "protocol"`，Protocol 文件直接位于归档根目录。manifest 使用 `protocol.files` 列出这些成员，并用 `protocol.file_hashes` 保存同一组相对路径对应的 SHA-256 hash。

多个 Protocol bundle：

```text
protocols.aira
├─ _airalogy_archive/
│  └─ manifest.json
└─ protocols/
   ├─ contact_note__0.1.0/
   │  ├─ protocol.aimd
   │  ├─ protocol.toml
   │  └─ ...
   └─ measurement_note__0.1.0/
      ├─ protocol.aimd
      ├─ protocol.toml
      └─ ...
```

对于 `kind: "protocols"`，`manifest.protocols[]` 中每一项对应一个 Protocol。每个 Protocol 都有自己的 `archive_root`，其 `files` 和 `file_hashes` 都相对于这个 `archive_root`。

Record bundle，也可以内嵌相关 Protocol：

```text
records.aira
├─ _airalogy_archive/
│  └─ manifest.json
├─ records/
│  ├─ 11111111-1111-4111-8111-111111111111.v1.json
│  └─ 22222222-2222-4222-8222-222222222222.v1.json
└─ protocols/                 # 只有内嵌 Protocol 时才存在
   └─ contact_note__0.1.0/
      ├─ protocol.aimd
      ├─ protocol.toml
      └─ ...
```

对于 `kind: "records"`，`manifest.records[]` 描述每一条 Record payload。`path` 字段指向 `records/` 下真正的 JSON 文件。如果归档内嵌了相关 Protocol，`manifest.protocols[]` 使用和 Protocol bundle 相同的结构，每条 Record 可以通过 `embedded_protocol_root` 指向匹配的内嵌 Protocol。

Record 文件载荷层：

有些 Record 会包含 file 类型的 `var` 字段。在云端部署中，这些字段可能指向 OSS 对象、S3 对象、文件服务 ID 或 signed URL。当 `.aira` 需要支持离线使用时，真实文件字节应该进入一个独立的 content-addressed blob 层，而不是放进 `records/`，也不应该复用 Protocol 的 `files/` 目录。

```text
records-with-files.aira
├─ _airalogy_archive/
│  └─ manifest.json
├─ records/
│  └─ record-001.v1.json
├─ protocols/
│  └─ sample_protocol__0.1.0/
│     └─ ...
└─ blobs/
   └─ sha256/
      └─ ab/
         └─ cd/
            └─ abcdef...1234
```

blob 路径采用内容寻址，并且可以按 hash 前缀分片。消费者应该以 manifest 为准，不应该只从路径推断文件元信息。

推荐的文件载荷 manifest 结构：

```json
{
  "blobs": [
    {
      "blob_id": "sha256:abcdef...1234",
      "archive_path": "blobs/sha256/ab/cd/abcdef...1234",
      "sha256": "abcdef...1234",
      "size": 123456
    }
  ],
  "files": [
    {
      "file_id": "airalogy.file.xxx",
      "source_uri": "oss://bucket/path/image.png",
      "blob_id": "sha256:abcdef...1234",
      "filename": "image.png",
      "mime_type": "image/png",
      "record_path": "records/record-001.v1.json",
      "field_path": "data.var.sample_photo"
    }
  ]
}
```

这里把真实字节和语义文件引用拆开。Record 可以保留原始云端引用，而归档可以选择性携带真实文件字节用于离线使用。多个 Record 也可以指向同一个 blob，避免重复保存。

Protocol `files/` 和 archive `blobs/` 的含义不同：

- Protocol `files/`：Protocol 定义所需的资源文件。
- Archive `blobs/`：Record 数据或外部来源对象引用的真实载荷字节。

归档格式至少应该支持两种导出模式：

- `reference-only`：只保留 file ID 和 source URI，不打包真实字节。
- `offline-bundle`：保留来源引用，同时把经过校验的真实文件放入 `blobs/`。

重要 manifest 字段：

- `format`：当前为 `airalogy.archive`
- `version`：归档格式版本，当前为 `1`
- `kind`：`protocol`、`protocols` 或 `records`
- `created_at`：归档创建时间
- `protocol`：`kind: "protocol"` 使用的单 Protocol 元数据
- `protocols`：`kind: "protocols"` 和 `kind: "records"` 使用的 Protocol bundle 或内嵌 Protocol 元数据
- `records`：`kind: "records"` 使用的 Record payload 元数据
- `blobs`：可选，归档内部保存的真实文件载荷
- `files`：可选，连接 Record 字段、来源 URI 和 blob 的语义文件引用

## Python API

```python
from airalogy.archive import (
    inspect_archive,
    load_file_payload_specs,
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
pack_records_archive(
    ["record.json"],
    "records_with_files.aira",
    file_payloads=load_file_payload_specs("files.json"),
)
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
- 当你传入 file payload spec 时，Airalogy 会把本地文件字节写入 `blobs/sha256/`，按 SHA-256 自动去重，并把语义文件引用写入 `manifest.files[]`。
- 如果 file payload spec 没有提供本地 `path`、`local_path` 或 `file_path`，则只会作为 reference-only 文件引用写入 `manifest.files[]`。

## 安全性与限制

- `airalogy unpack` 会进行安全解包检查，拒绝任何试图逃逸目标目录的归档条目。
- `airalogy validate` 和 Airalogy Reader 会检查 manifest、成员路径、Record JSON、Protocol 文件引用，以及存在时的 SHA-256 hash。
- 因为 `.aira` 是统一后缀，所以消费者需要读取 `_airalogy_archive/manifest.json` 并根据 `kind` 判断里面到底是单 Protocol、Protocol bundle，还是 Record 包。
- 第 1 版支持打包 Protocol 目录、JSON records、可选的内嵌 Protocol 目录，以及 `blobs/` 下的可选本地文件载荷。
- 第 1 版不会自动下载远端 Airalogy file ID 或 OSS 对象。导出器应先下载真实字节，再通过 `--file-payload` 或 `file_payloads` 传入本地路径。
