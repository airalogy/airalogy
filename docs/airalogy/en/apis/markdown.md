# Airalogy Markdown utilities

Airalogy ships a small helper for working with **Airalogy Markdown (AIMD)** strings. Import it via the `markdown` alias:

```python
from airalogy import markdown as aimd
```

## Extract Airalogy image IDs

Use `aimd.get_airalogy_image_ids(content: str) -> list[str]` to pull out every Airalogy File ID that appears as an image source inside an AIMD document. Supported forms:

- Standard Markdown image: `![alt](airalogy.id.file...png)`
- `fig` blocks: a `src:` line containing `airalogy.id.file...<ext>`

The function returns **unique** IDs, in the order of first appearance.

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

## Parse AIMD (Dictionary Output)

Use `aimd.parse_aimd(content: str) -> dict` to get a serializable parse result. This output is suitable for debugging, tests, or integration with other systems.

```python
from airalogy import markdown as aimd

result = aimd.parse_aimd(content)
```

Output shape (simplified):

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

Minimal example (`var` + `quiz`):

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

Example `parse_aimd` output:

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

## Parse AIMD (AST Node Output)

Use `AimdParser` when you need AST node objects for finer-grained processing.

```python
from airalogy.markdown import AimdParser

parser = AimdParser(content)
result = parser.parse()
quiz_nodes = result["templates"]["quiz"]  # list[QuizNode]
```

Difference between `AimdParser.parse()` and `parse_aimd()`:

- `AimdParser.parse()` returns node objects (richer semantic/position info)
- `parse_aimd()` returns dictionaries (easy to serialize)

## Generate Model Code (`VarModel`)

Use `aimd.generate_model(content: str) -> str` to generate Python model code directly from AIMD.

`generate_model` only generates `VarModel`.  
`quiz` templates are parsed and validated by syntax/quiz rules, but they are not emitted as a standalone Pydantic model.

Input:

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

Generated `model.py` (example):

```python
from pydantic import BaseModel

class VarModel(BaseModel):
    """Main variable model."""
    experiment_id: str
    temperature: float
```

For quiz answer storage/shape, see:

- [Quiz Syntax](../syntax/quiz.md)
- [Record Data Structure](../data-structure/record.md)
