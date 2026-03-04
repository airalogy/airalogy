# Airalogy Markdown 工具

Airalogy 提供了一个用于处理 **Airalogy Markdown（AIMD）** 字符串的小工具，可以通过 `markdown` 别名导入：

```python
from airalogy import markdown as aimd
```

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
    "assigner": []
  }
}
```

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
