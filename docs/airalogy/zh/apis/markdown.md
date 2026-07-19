# Airalogy Markdown 工具

Airalogy 提供了一个用于处理 **Airalogy Markdown（AIMD）** 字符串的小工具，可以通过 `markdown` 别名导入：

```python
from airalogy import markdown as aimd
```

## 审阅标记

Airalogy Markdown 内容可以包含 CriticMarkup 风格的审阅标记，用于文档修订和批注流程。Python helper 会把这些标记当作普通 Markdown 文本处理；`@airalogy/aimd-renderer`、recorder 预览和 Airalogy Reader 等前端 renderer 会把它们显示成语义化审阅标注。

| 用途 | AIMD 源码 |
| --- | --- |
| 添加 | `{++新增文字++}` |
| 删除 | `{--删除文字--}` |
| 替换 | `{~~旧表述~>新表述~~}` |
| 注释 | `{>>审阅备注<<}` |
| 高亮 | `{==重点文字==}` |

行内代码和 fenced 代码块会保留 CriticMarkup 原始文本。完整语法规则见[审阅标记语法](../syntax/review-marks.md)。

## 提取 Airalogy 图片 ID

使用 `aimd.get_airalogy_image_ids(content: str) -> list[str]` 自动扫描 AIMD 文本中的图片引用，并提取所有 Airalogy 文件 ID。支持的写法：

- 标准 Markdown 图片：`![alt](airalogy.id.file...png)`
- `fig` 代码块：`src:` 行包含 `airalogy.id.file...<ext>`

返回值为去重后的 ID 列表，按首次出现的顺序排列。

````python
from airalogy import markdown as aimd

content = """
![First](airalogy.id.file.123e4567-e89b-12d3-a456-426614174000.png)
```fig
id: fig_3
src: airalogy.id.file.ffffffff-1111-2222-3333-444444444444.tif
```
"""

ids = aimd.get_airalogy_image_ids(content)
# ["airalogy.id.file.123e4567-e89b-12d3-a456-426614174000.png",
#  "airalogy.id.file.ffffffff-1111-2222-3333-444444444444.tif"]
````

## 解析 AIMD（字典结构）

使用 `aimd.parse_aimd(content: str) -> dict` 获取可序列化的解析结果。该结构适合用于调试、测试或与其他系统交互。

```python
from airalogy import markdown as aimd

result = aimd.parse_aimd(content)
```

返回结构（示意）：

```json
{
  "templates": {
    "var": [],
    "quiz": [],
    "step": [],
    "check": [],
    "ref_var": [],
    "ref_step": [],
    "ref_fig": [],
    "cite": [],
    "refs": [],
    "assigner": [],
    "connectors": []
  }
}
```

Fenced `refs` 代码块会按 BibTeX 解析到 `templates.refs`。每个条目包含 `id`、`entry_type`、`raw`、标准化 `fields`，以及 `title`、`author`、`year`、`doi`、`url` 等常用展示字段。

Fenced `connectors` 代码块会解析到 `templates.connectors`，作为 connector metadata。Parser 会校验声明，但不会拉取 descriptor、不调用 endpoint，也不会读取 secret。

最小案例（`var` + `quiz`）：

````aimd
{{var|experiment_id: str}}

```quiz
id: quiz_choice_single_1
type: choice
mode: single
stem: Which option is correct?
options:
  - key: A
    text: Option A
  - key: B
    text: Option B
answer: A
```
````

对应 `parse_aimd` 输出示例：

```json
{
  "templates": {
    "var": [
      {
        "start_line": 1,
        "end_line": 1,
        "start_col": 1,
        "end_col": 25,
        "name": "experiment_id",
        "type_annotation": "str"
      }
    ],
    "quiz": [
      {
        "id": "quiz_choice_single_1",
        "type": "choice",
        "mode": "single",
        "stem": "Which option is correct?",
        "options": [
          { "key": "A", "text": "Option A" },
          { "key": "B", "text": "Option B" }
        ],
        "answer": "A"
      }
    ]
  }
}
```

## 解析 AIMD（AST 节点结构）

使用 `AimdParser` 可获取 AST 节点对象，适合做更细粒度的程序化处理。

```python
from airalogy.markdown import AimdParser

parser = AimdParser(content)
result = parser.parse()
quiz_nodes = result["templates"]["quiz"]  # list[QuizNode]
```

`AimdParser.parse()` 与 `parse_aimd()` 的差异：

- `AimdParser.parse()` 返回节点对象（保留更完整的语义与位置信息）
- `parse_aimd()` 返回字典（更容易序列化）

## 生成模型代码（`VarModel`）

使用 `aimd.generate_model(content: str) -> str` 可以从 AIMD 直接生成 Python 模型代码。

`generate_model` 仅生成 `VarModel`。  
`quiz` 模板会被解析并做语法/题目规则校验，但不会生成为独立的 Pydantic 模型。

输入：

````aimd
{{var|experiment_id: str}}
{{var|temperature: float}}

```quiz
id: quiz_choice_single_1
type: choice
mode: single
stem: Which catalyst is used?
options:
  - key: A
    text: Catalyst A
  - key: B
    text: Catalyst B
```
````

生成的 `model.py`（示意）：

```python
from pydantic import BaseModel

class VarModel(BaseModel):
    """Main variable model."""
    experiment_id: str
    temperature: float
```

关于 quiz 作答的存储结构与字段类型，请参考：

- [题目语法](../syntax/quiz.md)
- [Record 数据结构](../data-structure/record.md)
