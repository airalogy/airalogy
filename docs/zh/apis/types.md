# Airalogy类型

`airalogy`中提供了多种内置类型。Airalogy平台原生支持这些内置类型，以方便用户在定义Airalogy Protocol Model中data fields的类型。这些内置类型通常在Airalogy平台上能够被自动解析，以提供一些额外的功能，例如基于用户的基本信息进行赋值，或自动生成独特的界面交互。

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

## CurrentTime

```py
from airalogy.types import CurrentTime
from pydantic import BaseModel

class VarModel(BaseModel):
    current_time: CurrentTime
```

定义为`CurrentTime`类型的字段，可以在Airalogy平台上自动赋值为当前时间，时间所属时区为用户浏览器的时区。

## AiralogyMarkdown

```py
from airalogy.types import AiralogyMarkdown
from pydantic import BaseModel

class VarModel(BaseModel):
    content: AiralogyMarkdown
```

定义为`AiralogyMarkdown`类型的字段，可以在Airalogy平台上自动生成一个Markdown编辑器，用于编辑Airalogy Markdown文本。注意，这里我们将其命名为`AiralogyMarkdown`，而非`Markdown`/`Md`，是因为Markdown有很多种变体和语法规范，我们这里显式的指定该Markdown采用Airalogy Markdown语法规范，以保证前端渲染的一致性和稳定性。

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

### PyStr, JsStr, TsStr

```py
from airalogy.types import PyStr, JsStr, TsStr
from pydantic import BaseModel

class VarModel(BaseModel):
    python_code: PyStr
    javascript_code: JsStr
    typescript_code: TsStr
```

定义为`PyStr`类型的字段，可以在Airalogy平台上自动生成一个Python代码编辑器，用于编辑Python代码。该编辑器会提供语法高亮等功能。该Field的值以`str`形式存储。

其他编程语言相关字符串类型类似。

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
