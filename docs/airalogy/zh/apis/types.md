# Airalogy类型

`airalogy`中提供了多种内置类型。Airalogy平台原生支持这些内置类型，以方便用户在定义Airalogy Protocol Model中data fields的类型。这些内置类型通常在Airalogy平台上能够被自动解析，以提供一些额外的功能，例如基于用户的基本信息进行赋值，或自动生成独特的界面交互。

现在这些官方内置类型也被纳入了一套可插拔的类型注册表。也就是说，官方类型仍然保持稳定，但第三方包也可以在不修改 Airalogy 源码的情况下注册新的公共类型。

另见：

- [`Type Plugins`](/zh/apis/type-plugins)

## UserName

```py
from airalogy.types import UserName
from pydantic import BaseModel

class VarModel(BaseModel):
    user_name: UserName
```

定义为`UserName`类型的字段，可以在Airalogy平台上自动赋值为当前用户的用户名。

所有Research Node built-in types在生成Model JSON Schema时，均会默认附加一个额外的JSON Schema字段，`airalogy_type`，用于标识该字段的内置类型。例如，上述案例中的`VarModel` JSON Schema如下：

```json

{   
    "title": "VarModel",
    "type": "object",
    "properties": {
        "user_name": {
            "title": "User Name",
            "type": "string",
            "airalogy_type": "UserName",
        }
    },
    "required": ["user_name"]
}
```

## Current

### CurrentTime

```py
from airalogy.types import CurrentTime
from pydantic import BaseModel

class VarModel(BaseModel):
    current_time: CurrentTime
```

定义为`CurrentTime`类型的字段，可以在Airalogy平台上自动赋值为当前时间，时间所属时区为用户浏览器的时区。

### CurrentProtocolId

```py
from airalogy.types import CurrentProtocolID
from pydantic import BaseModel

class VarModel(BaseModel):
    current_protocol_id: CurrentProtocolID
```

定义为`CurrentProtocolID`类型的字段，可以在Airalogy平台上自动赋值为当前Protocol的Airalogy Protocol ID。

### CurrentRecordId

```py
from airalogy.types import CurrentRecordId
from pydantic import BaseModel

class VarModel(BaseModel):
    current_record_id: CurrentRecordId
```

定义为`CurrentRecordId`类型的字段，可以在Airalogy平台上自动赋值为当前Record的Airalogy Record ID。

## AiralogyMarkdown

```py
from airalogy.types import AiralogyMarkdown
from pydantic import BaseModel

class VarModel(BaseModel):
    content: AiralogyMarkdown
```

定义为`AiralogyMarkdown`类型的字段，可以在Airalogy平台上自动生成一个Markdown字段，用于编辑和预览Airalogy Markdown文本。Recorder 里的该字段支持源码编辑与渲染预览；预览会按 AIMD renderer 渲染 Markdown，并显示 Mermaid 图。注意，这里我们将其命名为`AiralogyMarkdown`，而非`Markdown`/`Md`，是因为Markdown有很多种变体和语法规范，我们这里显式的指定该Markdown采用Airalogy Markdown语法规范，以保证前端渲染的一致性和稳定性。

## SnakeStr

```py
from airalogy.types import SnakeStr
from pydantic import BaseModel
class VarModel(BaseModel):
    snake_case_string: SnakeStr
```

定义为`SnakeStr`类型的字段，要求字符串必须符合Python的snake_case命名规范。该类型通常用于需要遵循特定命名规范的字符串字段。

## VersionStr

```py
from airalogy.types import VersionStr
from pydantic import BaseModel
class VarModel(BaseModel):
    version: VersionStr
```

定义为`VersionStr`类型的字段，要求字符串必须符合语义化版本控制（SemVer）规范，即：`x.y.z`，其中`x`、`y`、`z`均为非负整数。该类型通常用于表示版本号。

## ProtocolId

```py
from airalogy.types import ProtocolId
from pydantic import BaseModel
class Model(BaseModel):
    protocol_id: ProtocolId
```

定义为`ProtocolId`类型的字段，要求字符串必须符合Airalogy Protocol ID规范。该规范通常用于唯一标识一个Protocol，格式为：

```
airalogy.id.lab.{lab_id}.project.{project_id}.protocol.{protocol_id}.v.{version}
```

其中`lab_id`、`project_id`、`protocol_id`符合`SnakeStr`规范，`version`符合`VersionStr`规范。

## RecordId

```py
from airalogy.types import RecordId
from pydantic import BaseModel

class VarModel(BaseModel):
    record_id: RecordId
```

定义为`RecordId`类型的字段，Airalogy平台会生成一个供用户选择历史Record的下拉框。用户选择后，该字段会被赋值为所选Record的`str`形式的ID。

## EntityRef

`EntityRef` 用于保存一个来自 connector 数据源的实体引用，例如质粒库、样本库存、LIMS 表，或另一个 Protocol 下的 Records。它是通用引用容器，Airalogy 不会把所有可能的实体类型都写死成内置类型。

```py
from airalogy.types import EntityRef
from pydantic import BaseModel

class VarModel(BaseModel):
    parent_plasmid: EntityRef | None = None
```

保存值至少包含 `entity` 和 `id`：

```json
{
  "entity": "plasmid",
  "source": "lab_plasmid_registry",
  "id": "pUC19",
  "label": "pUC19 cloning vector"
}
```

`source`、`label`、`version` 和 `snapshot` 都是可选字段。`label` 是显示缓存，不是权威关联键；缺失时 UI 应回退显示 `id`。`snapshot` 是可选 JSON 对象，用来保存更多数据源上下文。

在 AIMD 中，推荐把实体 namespace 和 connector source 写成字段 metadata：

```md
来源质粒：{{var|parent_plasmid: EntityRef | None, entity="plasmid", source="lab_plasmid_registry"}}
来源质粒列表：{{var|parent_plasmids: list[EntityRef] | None, entity="plasmid", source="lab_plasmid_registry"}}
```

对应的数据源可以通过 fenced [`connectors` 代码块](/zh/syntax/connectors) 声明。宿主应用和 recorder UI 可以用这些 metadata 提供实时搜索和选择控件，而 Python/Pydantic 仍然负责校验保存下来的引用结构。后端工具可以使用 `airalogy.connectors.EntitySourceConnector` 或 `create_entity_source_connectors_from_aimd()` 执行受支持的 `entity_source` descriptor，并从 `.env` 或部署 secret manager 注入 secret。

## ResourceRef

`ResourceRef[T]` 是 Record 中用于引用宿主库存引擎所管理资源的稳定类型。它在 `EntityRef` 的基础上增加可选的 `lot_id`、`container_id`、精确十进制 `quantity`、UCUM 兼容 `unit`、`reservation_id` 与 `booking_id`；显示用 `snapshot` 仍不是权威数据。

```md
来源：{{var|source: ResourceRef["plasmid"], resource_role="input", quantity_field="amount", container_required=True}}
用量：{{var|amount: Decimal, ge=0}}
设备：{{var|centrifuge: ResourceRef["equipment"], resource_role="equipment", booking_required=True}}
产出：{{var|sample: ResourceRef["sample"], resource_role="output"}}
```

每个 `ResourceRef` 字段都要声明 `resource_role=input|output|reference|equipment`。`quantity_field` 必须指向数值变量；`container_required` 与 `booking_required` 必须是布尔值，并且预约只适用于设备。Protocol 发布前，Python 与 npm parser 会拒绝无效的字段引用。

Recorder 接受宿主注入的 `resourceResolvers`，用于搜索资源、读取可用量与批次容器、查询设备时段及准备产出。它们只准备 Record 值；库存预约、消耗、产出创建与 Record 保存必须由宿主放在同一个事务中提交。

## FileId

在Airalogy中，允许用户自定义数据字段为`FileId`相关类型，这些数据字段的记录界面的插槽会自动显示文件上传按钮，用户可以通过点击按钮上传文件。上传的文件会被自动保存到Airalogy的文件系统中，并且会被赋予一个唯一的文件ID (type: `str`)。用户可以通过该文件ID来访问该文件。

```py
from airalogy.types import (
    # Image file types
    FileIdPNG, FileIdJPG, FileIdSVG, FileIdWEBP, FileIdTIFF,
    # Video file types
    FileIdMP4,
    # Audio file types
    FileIdMP3,
    # Document file types
    FileIdAIMD, FileIdMD, FileIdTXT,
    FileIdCSV, FileIdJSON,
    FileIdDOCX,FileIdXLSX, FileIdPPTX, 
    FileIdPDF,
    FileIdDna # SnapGene软件常用的`.dna`文件类型
)
from pydantic import BaseModel

class VarModel(BaseModel):
    png_file_id: FileIdPNG
    jpg_file_id: FileIdJPG
    svg_file_id: FileIdSVG
    webp_file_id: FileIdWEBP
    tiff_file_id: FileIdTIFF
    mp4_file_id: FileIdMP4
    mp3_file_id: FileIdMP3
    aimd_file_id: FileIdAIMD
    md_file_id: FileIdMD
    txt_file_id: FileIdTXT
    csv_file_id: FileIdCSV
    json_file_id: FileIdJSON
    docx_file_id: FileIdDOCX
    xlsx_file_id: FileIdXLSX
    pptx_file_id: FileIdPPTX
    pdf_file_id: FileIdPDF
    dna_file_id: FileIdDna
```

## IgnoreStr

以`IgnoreStr`类型定义的`var`字段，其在Airalogy平台记录界面可以填写任意字符串，该字符串可以被传入Assigner，但在保存该Airalogy Record时，该字段的值会被忽略，以空字符串代替。

该类型通常应用于管理一些需要被Assigner调用的机密信息，但不希望被保存在Airalogy Record中的场景，如API Key等。

```py

from airalogy.types import IgnoreStr

from pydantic import BaseModel
    api_key: IgnoreStr
```

## 编程语言相关代码字符串 (Code Strings)

### CodeStr, PyStr, JsStr, TsStr, JsonStr, TomlStr, YamlStr

```py
from airalogy.types import CodeStr, PyStr, JsStr, TsStr, JsonStr, TomlStr, YamlStr
from pydantic import BaseModel

class VarModel(BaseModel):
    generic_code: CodeStr
    python_code: PyStr
    javascript_code: JsStr
    typescript_code: TsStr
    json_str: JsonStr
    toml_str: TomlStr
    yaml_str: YamlStr
```

定义为`CodeStr`类型的字段，可以在Airalogy平台上自动生成一个通用 Monaco 代码编辑器，用于编辑不指定语言的代码或结构化文本。定义为`PyStr`等语言专用类型的字段，会使用对应语言的语法高亮。该Field的值以`str`形式存储。

## ATCG

`ATCG` 是用于管理DNA序列的内置类型。该类型只允许包含A、T、C、G四个字母的字符串，若包含其他字符会抛出校验错误。

```py
from airalogy.types import ATCG
from pydantic import BaseModel

class VarModel(BaseModel):
    dna_seq: ATCG
```

定义为 `ATCG` 类型的字段，只能输入有效的DNA序列。该类型还提供 `.complement()` 方法用于获取互补链（A<->T, C<->G）：

```py
seq = ATCG("ATCG")
print(seq.complement())  # 输出: TAGC
```

使用 `ATCG` 的模型生成的JSON Schema如下：

```json
{
  "title": "VarModel",
  "type": "object",
  "properties": {
    "dna_seq": {
      "title": "Dna Seq",
      "type": "string",
      "airalogy_type": "ATCG",
      "pattern": "^[ATCG]*$"
    }
  },
  "required": ["dna_seq"]
}
```

## `DNASequence`

`DNASequence` 是 Airalogy 提供的结构化 DNA 内置类型，用于可编辑的 DNA 序列数据。与只保存原始字符串的 `ATCG` 不同，`DNASequence` 会保存：

- 可选的人类可读序列名称
- 标准化后的序列文本
- 拓扑结构（`linear` / `circular`）
- 与 GenBank 对齐子集兼容的 annotation 列表

```python
from airalogy.types import DNASequence
from pydantic import BaseModel

class VarModel(BaseModel):
    plasmid: DNASequence
```

其保存值是如下结构的 JSON 对象：

```json
{
  "format": "airalogy_dna_v1",
  "name": "pUC19",
  "sequence": "ATGCGTNNNATGC",
  "topology": "circular",
  "annotations": [
    {
      "id": "feat_lacz",
      "name": "lacZ CDS",
      "type": "CDS",
      "strand": 1,
      "color": "#2563eb",
      "segments": [
        {
          "start": 121,
          "end": 980,
          "partial_start": false,
          "partial_end": false
        }
      ],
      "qualifiers": [
        { "key": "gene", "value": "lacZ" },
        { "key": "product", "value": "beta-galactosidase" },
        { "key": "note", "value": "Reporter CDS" }
      ]
    }
  ]
}
```

它不是对 GenBank flatfile 的一比一镜像，而是 Airalogy 内部更适合编辑的 canonical model，同时保留了足够的 GenBank 对齐能力，便于后续导入导出：

- 特征位置使用 `segments[]` 表达
- 模糊或不完整边界通过 `partial_start` / `partial_end` 保存
- GenBank 限定词使用可编辑的 `key` / `value` 行保存

当你希望前端直接编辑序列和 annotation 时，使用 `DNASequence`。如果你只是想上传或引用原始 SnapGene `.dna` 文件，则使用 `FileIdDNA`。

`DNASequence` 是唯一支持的公开类型名。在 AIMD、Python 模型和面向用户的文档中都应统一使用 `DNASequence`。

## Observation 观测类型

`Observation[T]` 用于把一个具体类型的观测值与采集时间、接收时间和结构化来源一起保存。它既可用于 Collector 生成的数据，也可用于需要审计来源的手工回退：

```python
from airalogy.types import Observation
from pydantic import BaseModel


class VarModel(BaseModel):
    temperature: Observation[float] | None = None
    temperature_log: list[Observation[float]] | None = None
```

Collector 观测需要 `source.kind="collector"`，并同时提供 `connector` 和 `collector`；手工观测需要 `source.kind="manual"`，并提供 `collector` 和 `reason`。`observed_at` 和 `received_at` 必须使用带时区的时间。

`ObservationSeriesRef[T]` 用于描述文件化的观测序列，`file_id`、`source_uri` 和 `blob_id` 中至少需要一个稳定载荷引用。当前模型已可用于 schema 和 Record 校验，Collector 的文件化写入属于下一阶段运行时。详见 [Collector 语法与运行时](/zh/syntax/collectors)。

## 血型枚举类型

`BloodType` 是用于常见 ABO 与 Rh 血型取值的内置枚举类型。

```py
from airalogy.types import BloodType
from pydantic import BaseModel


class SampleModel(BaseModel):
    blood_type: BloodType | None = None
```

纯 ABO 取值包括 `"A"`、`"B"`、`"AB"` 和 `"O"`。`"A+"`、`"A-"` 这类组合值表示同时记录了 ABO 血型和 Rh 阳性或 Rh 阴性状态。仅记录 Rh 因子时，也可以使用 `"Rh+"` 和 `"Rh-"`。

在 AIMD 中直接使用公开类型名即可：

```md
血型：{{var|blood_type: BloodType | None}}
```

## 中国常用枚举类

`airalogy.types.chinese` 中内置了若干个在中国业务场景中常用的枚举字段，可用于快速构建人口统计信息相关的数据模型。

```py
from airalogy.types import (
    ChineseEthnicGroup,
    ChineseProvinceLevelRegion,
    ChineseGender,
    ChineseMaritalStatus,
    ChineseEducationLevel,
)
from pydantic import BaseModel


class DemographicModel(BaseModel):
    ethnic_group: ChineseEthnicGroup
    province: ChineseProvinceLevelRegion
    gender: ChineseGender
    marital_status: ChineseMaritalStatus
    education_level: ChineseEducationLevel
```

### ChineseEthnicGroup

使用中国国务院公布的 56 个法定民族（如“汉族”“藏族”“维吾尔族”等）作为可选值。该枚举类型通常用于要求用户明确选择其民族的场景。

### ChineseProvinceLevelRegion

涵盖当前 34 个省级行政区（23 个省、5 个自治区、4 个直辖市、2 个特别行政区），枚举值为“北京”“广东”“新疆”“香港”等。适合需要采集常住地或户籍所在省份的字段。

### ChineseGender

固定取值为“男”或“女”，可用来快速生成符合中国居民登记习惯的性别选择字段。

### ChineseMaritalStatus

包含“未婚”“已婚”“丧偶”“离婚”“再婚”五种状态，可用于婚姻状况调查或表单。

### ChineseEducationLevel

覆盖“无学历”“小学”“初中”“高中”“中专”“大专”“本科”“硕士”“博士”九档文化程度，使模型在采集教育背景时保持一致的描述方式。
