# Airalogy Types

`airalogy` offers a set of built-in data types that the platform understands natively. When you define data fields in an **Airalogy Protocol Model** with these types, the platform can automatically parse them and provide extra features—such as auto-filling values from a user’s profile or rendering specialised UI controls.

## `UserName`

```python
from airalogy.types import UserName
from pydantic import BaseModel

class VarModel(BaseModel):
    user_name: UserName
```

A field declared as `UserName` is automatically populated with the current user’s login name.

All built-in types add an extra JSON-Schema attribute—`airalogy_type`—to indicate the specific Airalogy type. The schema for the class above is therefore:

```json
{
  "title": "VarModel",
  "type": "object",
  "properties": {
    "user_name": {
      "title": "User Name",
      "type": "string",
      "airalogy_type": "UserName"
    }
  },
  "required": ["user_name"]
}
```

## `CurrentTime`

```python
from airalogy.types import CurrentTime
from pydantic import BaseModel

class VarModel(BaseModel):
    current_time: CurrentTime
```

`CurrentTime` is automatically filled with the current time in the user’s browser time-zone.

## `AiralogyMarkdown`

```python
from airalogy.types import AiralogyMarkdown
from pydantic import BaseModel

class VarModel(BaseModel):
    content: AiralogyMarkdown
```

Fields of type `AiralogyMarkdown` render a Markdown editor that supports **Airalogy Markdown**, the platform’s own dialect. Using a distinct name avoids confusion with the many Markdown variants and guarantees consistent rendering.

## SnakeStr

```python
from airalogy.types import SnakeStr
from pydantic import BaseModel
class VarModel(BaseModel):
    snake_case_string: SnakeStr
```

A field declared as `SnakeStr` requires the string to follow Python's snake_case naming convention. This type is typically used for string fields that need to adhere to specific naming standards.

## VersionStr

```python
from airalogy.types import VersionStr
from pydantic import BaseModel
class VarModel(BaseModel):
    version: VersionStr
```

A field declared as `VersionStr` requires the string to conform to Semantic Versioning (SemVer) standards, formatted as `x.y.z`, where `x`, `y`, and `z` are non-negative integers. This type is commonly used to represent version numbers.

## ProtocolId

```python
from airalogy.types import ProtocolId
from pydantic import BaseModel
class Model(BaseModel):
    protocol_id: ProtocolId
```

A field declared as `ProtocolId` requires the string to follow the Airalogy Protocol ID format, which is typically used to uniquely identify a Protocol. The format is:

```
airalogy.id.lab.{lab_id}.project.{project_id}.protocol.{protocol_id}.v.{version}
```

where `lab_id`, `project_id`, and `protocol_id` must conform to the `SnakeStr` format, and `version` must conform to the `VersionStr` format.

## `RecordId`

```python
from airalogy.types import RecordId
from pydantic import BaseModel

class VarModel(BaseModel):
    record_id: RecordId
```

Declaring a field as `RecordId` produces a dropdown that lets the user pick an existing Record; the field is then set to that Record’s string ID.

## `FileId*` Types

When a field uses any `FileId*` type, the UI shows an upload button. The uploaded file is stored in Airalogy’s file system and assigned a unique string ID.

```python
from airalogy.types import (
    # Images
    FileIdPNG, FileIdJPG, FileIdSVG, FileIdWEBP, FileIdTIFF,
    # Video
    FileIdMP4,
    # Audio
    FileIdMP3,
    # Documents
    FileIdAIMD, FileIdMD, FileIdTXT,
    FileIdCSV, FileIdJSON,
    FileIdDOCX, FileIdXLSX, FileIdPPTX,
    FileIdPDF,
    FileIdDna  # SnapGene's .dna file type
)
from pydantic import BaseModel

class VarModel(BaseModel):
    png_file_id:  FileIdPNG
    jpg_file_id:  FileIdJPG
    svg_file_id:  FileIdSVG
    webp_file_id: FileIdWEBP
    tiff_file_id: FileIdTIFF
    mp4_file_id:  FileIdMP4
    mp3_file_id:  FileIdMP3
    aimd_file_id: FileIdAIMD
    md_file_id:   FileIdMD
    txt_file_id:  FileIdTXT
    csv_file_id:  FileIdCSV
    json_file_id: FileIdJSON
    docx_file_id: FileIdDOCX
    xlsx_file_id: FileIdXLSX
    pptx_file_id: FileIdPPTX
    pdf_file_id:  FileIdPDF
    dna_file_id:  FileIdDna
```

## `IgnoreStr`

`IgnoreStr` fields accept any string, pass it to the Assigner, **but** store an empty string in the saved Record.
Use this for secrets such as API keys that you need at runtime but do not want persisted.

```python
from airalogy.types import IgnoreStr
from pydantic import BaseModel

class VarModel(BaseModel):
    api_key: IgnoreStr
```

## Code-String Types

### `PyStr`, `JsStr`, `TsStr`

```python
from airalogy.types import PyStr, JsStr, TsStr
from pydantic import BaseModel

class VarModel(BaseModel):
    python_code:     PyStr
    javascript_code: JsStr
    typescript_code: TsStr
```

Each of these types renders a language-specific code editor with syntax highlighting.
The field value is stored as a plain string.

## `ATCG`

`ATCG` is a built-in type for managing DNA sequences. It only allows strings containing the four letters A, T, C, and G. Any other character will raise a validation error.

```python
from airalogy.types import ATCG
from pydantic import BaseModel

class VarModel(BaseModel):
    dna_seq: ATCG
```

A field declared as `ATCG` will only accept valid DNA sequences. The type also provides a `.complement()` method to get the complementary DNA strand (A<->T, C<->G):

```python
seq = ATCG("ATCG")
print(seq.complement())  # Output: TAGC
```

The JSON-Schema for a model using `ATCG` will include:

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
