# Variable Table

## Syntax

In Airalogy Protocol, there is a special recording pattern where the value of one `{{var}}` is a **list**, and each element of that list is itself a **sub-variable object**. The list is typically variable-length. In this case, the front end renders the variable **as a table** instead of a single input. To support this, you can declare a **Variable Table** by adding a `subvars` parameter to the `var` template.

Basic syntax:

```aimd
{{var|<var_id>, subvars=[<subvar_id_1>, <subvar_id_2>, ...]}}
```

When there are many `subvars`, you can split them across multiple lines for readability:

```aimd
{{var|<var_id>, subvars=[
    <subvar_id_1>, 
    <subvar_id_2>, 
    ...
]
}}
```

Example:

```aimd
<!-- File: protocol.aimd -->

{{var|testees, subvars=[name, age]}}
```

This renders on the front end as a table:

| name           | age            |
| -------------- | -------------- |
| [to_be_filled] | [to_be_filled] |

```py
# File: model.py

from pydantic import BaseModel

class Testee(BaseModel):
    # Testee is an intermediate class used to enable nested models.
    # Its name can in fact be arbitrary, as long as it matches the class
    # referenced inside the list type in VarModel. By convention, we use
    # the PascalCase singular form of the corresponding var_id.
    name: str
    age: float

class VarModel(BaseModel):
    testees: list[Testee]
    # 'testees' corresponds to the 'testees' in AIMD above and is constrained
    # to be a list of Testee.
```

### Titles and Descriptions for Variable Table / Sub Variables

As with ordinary variables, you can add `title` and `description` to the `var` itself and to each sub-variable.

Do this by adding `Field` metadata in `VarModel`. For example:

```py
# File: model.py

from pydantic import BaseModel, Field

class Testee(BaseModel):
    name: str  = Field(title="Name", description="The name of the testee.")
    age:  float = Field(title="Age",  description="The age of the testee.")

class VarModel(BaseModel):
    testees: list[Testee] = Field(title="Testees", description="The testees of the experiment.")
```

`title` and `description` are optional. You may provide neither, both, or only some of them. When present, they will be shown in the UI.

## Assigner for Variable Table

### Compute some Sub Variables from other Sub Variables

In real protocols, values of certain sub-variables in a Variable Table can be derived from others. To support such dependency-based auto-calculation, you can use an **Assigner**.

For example, suppose the value of `var_1_2_sum` in `var_1` should be computed from `var_1` and `var_2`. You can implement this with three files:

**File 1: AIMD**

```aimd
<!-- File: protocol.aimd -->

{{var|var_1, subvars=[var_1, var_2, var_1_2_sum]}}
```

**File 2: Model**

```py
# File: model.py

from pydantic import BaseModel

class VarTable1(BaseModel):
    var_1: int
    var_2: int
    var_1_2_sum: int

class VarModel(BaseModel):
    var_1: list[VarTable1]
```

**File 3: Assigner**

```py
# File: assigner.py

from airalogy.assigner import AssignerResult, assigner

@assigner(
    assigned_fields=[
        "var_1.var_1_2_sum",
    ],
    dependent_fields=[
        "var_1.var_1",
        "var_1.var_2",
    ],  # When a Variable Table participates in an Assigner, the names in
        # assigned_fields and dependent_fields must be prefixed with the
        # Variable Table name and may refer to AT MOST ONE Variable Table.
        # Cross-table calculations are not allowed.
    mode="auto",
)
def calculate_var_1(dependent_fields: dict) -> AssignerResult:
    v1 = dependent_fields["var_1.var_1"]
    v2 = dependent_fields["var_1.var_2"]

    v_sum = v1 + v2

    return AssignerResult(
        assigned_fields={
            "var_1.var_1_2_sum": v_sum,
        },
    )
```

**Notes when using a Variable Table Assigner:**

1. **Row independence.** Each row’s data are independent, so the Assigner’s logic must compute **per row**. Rows must not affect each other.
2. **Row-level trigger.** Because users typically fill the table row by row, the front end listens for completion of all `dependent_fields` **within a row** and triggers the Assigner only for that row to compute its `assigned_fields`. Other rows are not computed until their dependencies are complete.

### Using the entire Variable Table as a dependent field

A common use for Variable Tables is **batch configuration**. For example, you might use a Variable Table to set multiple chart-drawing parameters. You can take the **entire Variable Table** as a single dependent field and compute a summary result.

`model.py`:

```py
class VarTable1(BaseModel):
    font_size: int
    font_color: str

class VarModel(BaseModel):
    var_table_1: list[VarTable1]
    font_config_summary: str
```

If the table data are:

| font_size | font_color |
| --------- | ---------- |
| 12        | red        |
| 14        | blue       |

the corresponding JSON looks like:

```json
{
  "var_table_1": [
    { "font_size": 12, "font_color": "red" },
    { "font_size": 14, "font_color": "blue" }
  ]
}
```

Then we can write an Assigner to compute `font_config_summary`:

`assigner.py`:

```py
from airalogy.assigner import AssignerResult, assigner

@assigner(
    assigned_fields=[
        "font_config_summary",
    ],
    dependent_fields=[
        "var_table_1",
    ],
    mode="auto",
)
def calculate_font_config_summary(dependent_fields: dict) -> AssignerResult:
    font_config_summary = "\n".join(
        f"font_size: {row['font_size']}, font_color: {row['font_color']}"
        for row in dependent_fields["var_table_1"]
    )
    return AssignerResult(
        assigned_fields={"font_config_summary": font_config_summary}
    )
```

You can also make a **Variable Table** itself an **assigned field** (returned by the Assigner). In that case, **each run replaces the entire table** rather than a single row. If the table already has data, it will be overwritten. When a whole-table assignment is used, **row-level assigners are not supported** at the same time, because returning the entire table enables you to include any row-level logic within the full-table computation itself.
