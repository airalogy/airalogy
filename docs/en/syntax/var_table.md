# Variable Table

A **Variable Table** lets one `{{var}}` hold a **list of sub-variables** (rows).
The list is dynamically sized, and the front-end renders it as an editable table.

## 1 AIMD Syntax

```aimd
{{var_table|<var_id>, subvars=[<subvar_id_1>, <subvar_id_2>, ...]}}
```

*Because a variable table is still a variable, data are stored under the regular `var` namespace.*

You can break the `subvars` list over multiple lines for readability:

```aimd
{{var_table|testees, subvars=[
    name,
    age
]}}
```

## 2 `model.py`

Define a nested Pydantic model for one **row**, then use a list of that model:

```python
from pydantic import BaseModel

class Testee(BaseModel):  # row schema
    name: str
    age: float

class VarModel(BaseModel):
    testees: list[Testee]  # table = list of rows
```

### Titles and Descriptions

```python
from pydantic import BaseModel, Field

class Testee(BaseModel):
    name: str  = Field(title="Name", description="Name of the testee.")
    age:  float = Field(title="Age",  description="Age of the testee.")

class VarModel(BaseModel):
    testees: list[Testee] = Field(
        title="Testees",
        description="Participants recorded in the experiment."
    )
```

`title` and `description` are optional—as with ordinary variables.

## 3 Naming Rules

- `var_id` and each `subvar_id` follow the standard variable-name rules:
  - No leading underscore.
  - No duplicated names (including variations with extra underscores).
  - Must appear somewhere in AIMD.

## 4 Assigners for Variable Tables

### 4.1 Row-level calculation (common use)

You can auto-compute one sub-variable from others **within the same row**.

**AIMD**

```aimd
{{var_table|measurements, subvars=[a, b, sum_ab]}}
```

**Model**

```python
class Measurement(BaseModel):
    a: int
    b: int
    sum_ab: int

class VarModel(BaseModel):
    measurements: list[Measurement]
```

**Assigner**

```python
from airalogy.assigner import AssignerBase, AssignerResult, assigner

class Assigner(AssignerBase):

    @assigner(
        assigned_fields  = ["measurements.sum_ab"],
        dependent_fields = ["measurements.a", "measurements.b"],
        mode="auto",
    )
    def calc_sum(dep: dict) -> AssignerResult:
        a = dep["measurements.a"]
        b = dep["measurements.b"]
        return AssignerResult(
            assigned_fields={"measurements.sum_ab": a + b}
        )
```

**Rules**

1. **Row-scoped**: each calculation uses only values from the *current* row.
2. Trigger: the front-end runs the assigner once all dependent fields in a row are filled.

### 4.2 Table-level calculation

Sometimes you need the **entire table** as input or output.

```python
class FontCfg(BaseModel):
    font_size:  int
    font_color: str

class VarModel(BaseModel):
    font_table: list[FontCfg]
    summary:    str
```

```python
class Assigner(AssignerBase):

    @assigner(
        assigned_fields  = ["summary"],
        dependent_fields = ["font_table"],
        mode="auto"
    )
    def summarise(dependent_fields: dict) -> AssignerResult:
        lines = [
            f"font_size={row['font_size']}, font_color={row['font_color']}"
            for row in dependent_fields["font_table"]
        ]
        return AssignerResult(assigned_fields={"summary": "\n".join(lines)})
```

*If you **assign** an entire table, you replace the previous table; row-level assigners are then unnecessary.*
