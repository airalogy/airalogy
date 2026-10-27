# `@airalogy/aira-core`

[English](./README.md) | [简体中文](./README.zh-CN.md)

用于读取、创建和校验 Airalogy `.aira` 包的 TypeScript 核心库，可在浏览器中运行，不依赖完整的 Airalogy 平台、数据库或执行引擎。

支持 `protocol`、`protocols` 和 `records` 三类归档。读取时检查 `_airalogy_archive/manifest.json` 中的引用、Record 结构，以及 Record、Protocol 文件和离线附件的哈希。仓库中的 `examples/aira/` 提供示例包，`schemas/aira/manifest.v1.schema.json` 和 `schemas/aira/record.v1.schema.json` 定义公开格式。

## 读取归档

```ts
import { openAiraArchive } from '@airalogy/aira-core'

const archive = await openAiraArchive(file)
const summary = archive.summary()
const validation = await archive.validate()
const manifest = archive.manifest
```

普通 ZIP 文件夹包不包含 Airalogy manifest，可以单独读取：

```ts
import { openZipArchive } from '@airalogy/aira-core'

const zip = await openZipArchive(file)
const aimd = await zip.readText('protocol.aimd')
const image = await zip.readBytes('files/workflow-diagram.svg')
```

## 导出模板

`createProtocolAiraArchive` 创建单个 Protocol 的归档，并支持将图片等模板资源一并打包。

```ts
import { createProtocolAiraArchive } from '@airalogy/aira-core'

const bytes = await createProtocolAiraArchive({
  aimd: [
    '# Figure Protocol',
    '',
    '```fig',
    'id: workflow_diagram',
    'src: files/workflow-diagram.svg',
    'title: Workflow Diagram',
    '```',
    '',
  ].join('\n'),
  files: [{ path: 'files/workflow-diagram.svg', data: svgFile }],
})
```

## 导出记录

`createRecordsAiraArchive` 导出共享一个内嵌 Protocol 快照的一条或多条记录。宿主负责提供已经校验的值、稳定的记录 ID、正整数记录版本和 Protocol 身份。此函数检查 JSON 与身份信息的一致性，不执行 Protocol 的 Pydantic 模型校验，也不生成记录 ID 或保存草稿。

```ts
import { createRecordsAiraArchive } from '@airalogy/aira-core'

const bytes = await createRecordsAiraArchive({
  aimd: '{{var|temperature: float}}',
  protocol: { protocol_id: 'temperature-log', protocol_version: '1.0.0' },
  records: [{
    record: {
      record_id: crypto.randomUUID(),
      record_version: 1,
      data: { var: { temperature: 37.5 }, step: {}, check: {}, quiz: {} },
    },
  }],
})
```

顶层 `files: [{ path, data }]` 用于模板资源；每条记录的 `files: [{ file_id, filename, mime_type, field_path, data }]` 用于记录附件，`record.data` 中的值应引用相同的 `file_id`。附件 `data` 支持 `Blob`、字符串、`ArrayBuffer` 或 `Uint8Array`。相同内容共用一个 SHA-256 blob；没有 `data` 的附件只保留外部引用（`file_id` 或 `source_uri`），不会变成离线副本。重复的记录 ID 与版本组合会被拒绝。生成的归档包含文件哈希，可以通过 `openAiraArchive(bytes).then(archive => archive.validate())` 校验。

重新打包已经含有 `record.files` 的记录时，必须显式传入同级的 `files` 列表，并提供从原包恢复的附件内容，避免把失效的 blob 引用复制到不包含相应文件的新包中。显式传入空列表会移除这些附件关联。
