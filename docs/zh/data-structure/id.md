# Airalogy IDs

## Airalogy对象

在Airalogy中，我们以对象 (Object) 的方式来组织数据。在Airalogy中，我们定义了一系列的数据对象，这些对象包括：

- Airalogy Protocol
- Airalogy Record
- Airalogy User: 特指Airalogy Platform的一个用户。
- Airalogy Lab: 特指Airalogy Platform的一个实验室。
- Airalogy Project: 特指一个Airalogy Lab下的一个项目。
- Airalogy File: 特指Airalogy Platform中的一个文件。

## Airalogy ID格式

在Airalogy中，由于包含了很多种具有不同作用的数据，为了能够在Airalogy中唯一寻址一个数据，我们设计了一种ID格式，在Airalogy中，完整的ID格式如下：

```txt
airalogy.id.<type>.<...>
```

其中：

- `airalogy.id`：ID的固定前缀，用于标识这是一个Airalogy ID。
- `<type>`：ID的类型，用于标识这个ID是用于哪个对象类型的。之所以一定要有`<type>`，是为了让其充当一个命名空间的作用，以避免潜在的ID冲突。
- `...`：ID的具体内容，根据不同的对象类型，具体内容会有所不同。

### snake_case命名规则

在一些Airalogy ID中，允许用户以snake_case的形式自定义Airalogy ID的部分内容。这些自定义的snake_case字符串统一遵循以下命名标准：

- 允许字符：小写字母`a`-`z`、`_`、数字`0`-`9`。
- 只能以小写字母开头。
- 不允许连续下划线`_`，如`__`。该规则主要用于约束由于连续`_`易读性差导致的记录错误。
- 不能超过32个字符。（该设计的原因在于UUID包含32个十六进制数字，包含连字符一共36个字符，因此我们限制用户自定义ID的长度不超过32个字符，以保证ID的长度在可控范围内）

## ID for: User (global), Lab (global), Project (local)

命名规则：符合snake_case命名规则。

重名规则：

- User ID, Lab ID全局不重名。
- Project ID于Lab下不重名。
  - 因此，为了获取Airalogy中一个项目的全局唯一地址，必须要通过`<lab_id>`, `<project_id>`的2重组合来寻址。

上述ID的对应Airalogy ID格式如下：

- Airalogy User ID (global): `airalogy.id.user.<user_id>`
- Airalogy Lab ID (global): `airalogy.id.lab.<lab_id>`
- Airalogy Project ID (global): `airalogy.id.lab.<lab_id>.project.<project_id>`

### ID与Airalogy ID的对应关系

在Airalogy的各种数据结构设计中，如果我们采用类似`<type>_id`的命名方式，那么默认这个字段所储存的ID为该类目下的能够区分本类目下不同数据的ID。该设计的好处在于，ID在长度比较短的同时，并不损失其在本类目下的可区分性（因为key名体现了类目，这和传统关系型数据库的主键和ID的设计类似）。例如：

```json
{
    "lab_id": "lab_demo",
    "project_id": "project_demo"
}
```

而如果我们采用类似`airalogy_<type>_id`的命名方式，那么默认这个字段所储存的ID为Airalogy ID，对应的是一个Airalogy对象。和普通ID相比，这种设计是为了保证：

1. Airalogy ID是全局唯一的（即使在不同类目下），并且可以通过ID直接访问到对应的对象及其数据。
2. 在缺乏字段的key信息时，可以通过value（即Airalogy ID）来知晓数据对象的类目信息，并且可以通过Airalogy ID直接访问到对应的对象和数据。

```json
{
    "airalogy_lab_id": "airalogy.id.lab.lab_demo",
    "airalogy_project_id": "airalogy.id.lab.lab_demo.project.project_demo"
}
```

## Airalogy Protocol ID (global)

在Airalogy平台中，由于每个Airalogy Protocol都被管理在一个Protocol仓库（Protocol Repository）中，为此，在Airalogy平台中，索引和寻址一个Airalogy Protocol本质和索引其所在的Protocol仓库是一样的。因此，在Airalogy平台中，Airalogy Protocol及其所在的Protocol仓库共享同一个ID。

Airalogy Protocol ID的基本格式如下：

```txt
airalogy.id.lab.<lab_id>.project.<project_id>.protocol.<protocol_id>.v.<protocol_version>
```

例如：

```txt
airalogy.id.lab.lab_demo.project.project_demo.protocol.protocol_demo.v.0.0.1
```

### `<protocol_id>`

`<protocol_id>`是用于在`protocol`命名空间下唯一标识一个Protocol的ID，符合snake_case命名规则。

### `<protocol_version>`

由于一个Protocol可能会随着应用发生持续更新。因此Airalogy Protocol ID的设计还需要考虑到版本的问题。

`<protocol_version>`的格式须满足以下要求：

- 必须为`x.y.z`，其中：`x`, `y`, `z`必须为非负整数。
- 可以并不是连续的，例如：`0.0.1` -> `0.1.0` -> `1.0.0`是合法的。这取决于用户对Protocol的版本控制策略。如果用户没有指定新版本的版本号，则Airalogy Platform在更新Protocol时通常会自动通过自增`z`来生成新版本，例如：`0.0.1` -> `0.0.2`。

### 针对数据库的字段优化

为了方便在数据库中存储和快速索引，我们在储存Airalogy Protocol ID时，通常会联合使用5个字段：

- `airalogy_protocol_id`: 用于储存完整的Airalogy Protocol ID，该ID在全球唯一，因此可以作为全球唯一的索引。
- `lab_id`: 用于储存Lab ID的部分，该字段在`airalogy.id.lab`命名空间下唯一。
- `project_id`: 用于储存Project ID的部分，该字段在`airalogy.id.lab.<lab_id>.project`命名空间下唯一。
- `protocol_id`: 用于储存Protocol ID的部分，该字段在`airalogy.id.lab.<lab_id>.project.<project_id>.protocol`命名空间下唯一。
- `protocol_version`: 用于储存Protocol版本号的部分，该版本号在该Protocol ID命名空间下唯一。

例如：

```json
{
    "airalogy_protocol_id": "airalogy.id.lab.lab_demo.project.project_demo.protocol.protocol_demo.v.0.0.1",
    "lab_id": "lab_demo",
    "project_id": "project_demo",
    "protocol_id": "protocol_demo",
    "protocol_version": "0.0.1"
}
```

### 内部ID

在Airalogy Platform数据底层，每个Airalogy Protocol也会被自动分配一个内部ID（被称为Protocol UUID, `protocol_uuid`），该ID是一个UUID，不与Lab、Project等信息相关联（因此该ID是全局唯一的，并且即使当Lab/Project等信息发生变化时，该ID仍然保持不变）。该ID通常不会直接展现给用户，但会作为一个内部ID用于全局索引。该ID的格式如下：

```txt
airalogy.id.protocol.<protocol_uuid>.v.<protocol_version>
```

## Airalogy Record ID (global)

Airalogy Record由于是应用Airalogy Protocol的产物，因此其ID并不支持自定义，而是自动由Airalogy Platform生成的。其ID格式统一如下：

```txt
airalogy.id.record.<record_id>.v.<record_version>
```

其中：

- `<record_id>`: 是用于在`record`命名空间下唯一标识一个Record的ID。为UUID形式，为Airalogy Platform自动生成，用户不可指定。
- `<record_version>`: 在Airalogy Platform中，Airalogy Record也可能会因为用户的二次编辑而发生变化，而产生新版本。为此，我们需要在Record ID中添加一个版本号来标识Record的版本。其为一个正整数，为Airalogy Platform自动生成（通过连续自增），用户不可指定。

例如：

```txt
airalogy.id.record.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.v.1
```

### 针对数据库的字段优化

为了方便在数据库中存储和快速索引，我们在储存Airalogy Record ID时，和Airalogy Protocol ID类似，通常会联合使用3个字段。例如：

```json
{
    "airalogy_record_id": "airalogy.id.record.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.v.1",
    "record_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "record_version": 1
}
```

## Airalogy ID for: File (global)

```text
airalogy.id.file.<uuid>.<file_extension>
```

通过UUID赋予File全局唯一的ID。添加`file_extension`是为了方便约束File的格式。另一方面，这可以保证我们以ID作为文件名下载的File是可以直接打开的。

Supported `file_extension`:

- Image:
  - `png`
  - `jpg`
  - `svg`
  - `webp`
  - `tiff`: 该格式在各种实验照片（如共聚焦显微镜照片）中常见。
- Video:
  - `mp4`
- Audio:
  - `mp3`
- File:
  - `txt`
  - `md`
  - `remd`
  - `csv`
  - `tsv`
  - `json`
  - `yml`
  - `pdf`
  - `docx`
  - `xlsx`
  - `pptx`

## Airalogy ID for: Discussion (global)

```text
airalogy.id.discussion.<uuid>
```

## Airalogy ID for: Chat Session (global)

```text
airalogy.id.chat.<uuid>
```
