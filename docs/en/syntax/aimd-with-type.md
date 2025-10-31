# Using Types in Airalogy Markdown

In the basic design of Airalogy Protocol, for Airalogy Fields (AFs), Airalogy Markdown (`protocol.aimd`) is primarily used to define the IDs and positions of AFs, while type information for each AF is defined in the Airalogy Protocol Model (`model.py`). This separation is intended to decouple concerns and enable comprehensive typing and validation (including multi-field constraints such as `AF1 > AF2`).

However, in real-world usage, users often don’t need complex types or cross-field validations and prefer to define AF types directly in Markdown to simplify the workflow. To that end, Airalogy Protocol introduces the ability to specify AF types in Airalogy Markdown. With this feature, a single AIMD can cover the roles of both `protocol.aimd` and `model.py`, greatly simplifying authoring. This simplification can be regarded as **syntactic sugar**.

## Simple Example

For example, to define an Airalogy Protocol that records a student’s name and age, the classic approach uses two files:

`protocol.aimd`:

```aimd
Name: {{var|name}}
Age: {{var|age}}
School: {{var|school}}
```

`model.py`:

```py
from pydantic import BaseModel

class VarModel(BaseModel):
    name: str
    age: int
    school: str
```

With the new AIMD syntactic sugar, the two files can be combined into a single `protocol.aimd`:

```aimd
Name: {{var|name: str}}
Age: {{var|age: int}}
School: {{var|school: str}}
```

In this new syntax, you add type information after the variable name with a colon (analogous to Python type annotations), such as `: str` and `: int`.

## Adding Extra Information to Airalogy Fields

In the traditional two-file approach, you can add extra information such as descriptions and default values in `model.py`:

```py
from pydantic import BaseModel, Field
class VarModel(BaseModel):
    name: str = Field(default="Unknown", title="Student Name", description="The student's full name", max_length=50)
    age: int = Field(default=0, title="Student Age", description="Age in years", ge=0)
    school: str = "School of Life Sciences"
```

With the new AIMD syntax, you can add the same metadata directly in AIMD:

```aimd
Name: {{var|name: str = "Unknown", title = "Student Name", description = "The student's full name", max_length = 50}}
Age: {{var|age: int = 0, title = "Student Age", description = "Age in years", ge = 0}}
School: {{var|school: str = "School of Life Sciences"}}
```

Airalogy will automatically translate this information into the corresponding Pydantic field definitions to enable typing and validation.

## General Structure of the `var` Syntactic Sugar

As shown above, the general structure for a `var` field in AIMD is:

```aimd
{{var|<var_id>: <var_type> = <default_value>, **kwargs}}
```

### Notes on the Syntax Design

The expression `<var_id>: <var_type> = <default_value>, **kwargs` mirrors Python’s function parameter syntax:

```py
def var(<var_id>: <var_type> = <default_value>, **kwargs):
    pass
```

Therefore, the syntax is naturally parsable. The quoting rule for `default_value` follows Python exactly: for `str` defaults, you **must** wrap the value in double quotes `""`; for `int`, `float`, `bool`, etc., no quotes are used.

### Supported Types

The types you can use in AIMD align with Python’s built-in types (e.g., `str`, `int`, `float`, `bool`, `list`, `dict`, `list[str]`, etc.). You can also use custom types defined in `airalogy.types`, such as `UserName`. As in Python, type names are **not** quoted.

### About `**kwargs`

For any `var` field, `**kwargs` generally falls into two categories: (1) **type-agnostic** common parameters such as `title` and `description`; and (2) **type-specific** parameters (for example, `str` fields can use `max_length`, `min_length`, etc.).

#### How It Works

You can think of each `var` as implicitly supporting a common kwargs schema and an additional type-specific kwargs schema. In Python notation:

```py
common_kwargs = {
    "title": Optional[str],
    "description": Optional[str],
    ...
}
```

For each concrete type, there is a dedicated kwargs schema. For example, for `str`:

```py
str_kwargs = {
    "max_length": Optional[int],
    "min_length": Optional[int],
    ...
}
```

The final kwargs for a `str`-typed `var` is the merge of the two:

```py
var_str_kwargs = {
    **common_kwargs,
    **str_kwargs,
}
```

Accordingly, in AIMD, a `str`-typed `var` accepts any parameter contained in `var_str_kwargs`:

```aimd
{{var|<var_id>: str, **var_str_kwargs}}
```

## Overwrite Principle

Because AF type and parameter information can be defined in both AIMD and `model.py`, Airalogy follows these overwrite rules when both are present:

1. Definitions in `model.py` take precedence over those in AIMD.
2. If an AF is not defined in `model.py`, the AIMD definition is used.
3. If an AF **is** defined in `model.py`, that definition completely overwrites the AIMD definition, including the type and all parameter information.

### Rationale

To render the correct Field Input Boxes for each AF in the Airalogy Protocol Recording Interface, we essentially build an **Airalogy Field JSON Schema** from the protocol. When AIMD and `model.py` coexist, Airalogy first constructs an initial JSON Schema from AIMD, then overwrites it with definitions from `model.py`, producing the final JSON Schema.

For example:

`protocol.aimd`:

```aimd
Name: {{var|name: str = "Unknown", title = "Student Name", description = "The student's full name", max_length = 50}}
Age: {{var|age:: str}}
School: {{var|school: str}}
```

`model.py`:

```py
from pydantic import BaseModel, Field

class VarModel(BaseModel):
    name: str
    age: int = Field(default=18, title="Age", description="Age in years", ge=0)
```

The initial JSON Schema constructed from `protocol.aimd` would be:

```json
{
  "title": "VarModel",
  "type": "object",
  "properties": {
    "name": {
      "title": "Student Name",
      "type": "string",
      "description": "The student's full name",
      "maxLength": 50,
      "default": "Unknown"
    },
    "age": {
      "title": "age",
      "type": "string"
    },
    "school": {
      "title": "school",
      "type": "string"
    }
  }
}
```

The JSON Schema derived from `model.py` would be:

```json
{
  "title": "VarModel",
  "type": "object",
  "properties": {
    "name": {
      "title": "name",
      "type": "string"
    },
    "age": {
      "title": "Age",
      "type": "integer",
      "description": "Age in years",
      "minimum": 0,
      "default": 18
    }
  }
}
```

Since `name` and `age` are defined again in `model.py`, these two AFs overwrite the corresponding AIMD definitions. The final JSON Schema is:

```json
{
  "title": "VarModel",
  "type": "object",
  "properties": {
    "name": {
      "title": "name",
      "type": "string"
    },
    "age": {
      "title": "Age",
      "type": "integer",
      "description": "Age in years",
      "minimum": 0,
      "default": 18
    },
    "school": {
      "title": "school",
      "type": "string"
    }
  }
}
```

Note that in the final JSON Schema above, `name` no longer has `description` or `maxLength` because they were overwritten by the definition in `model.py`.

You can also think of this as: Airalogy first generates a preliminary Pydantic model from AIMD and then overwrites it using definitions from `model.py` to produce the final Pydantic model, from which the JSON Schema is generated.

From AIMD, the preliminary Pydantic model would be:

```py
from pydantic import BaseModel, Field
class VarModel(BaseModel):
    name: str = Field(
        default="Unknown", title="Student Name", description="The student's full name", max_length=50
    )
    age: str
    school: str
```

From `model.py`, the Pydantic model is:

```py
from pydantic import BaseModel, Field
class VarModel(BaseModel):
    name: str
    age: int = Field(default=18, title="Age", description="Age in years", ge=0)
```

The final Pydantic model becomes:

```py
from pydantic import BaseModel, Field
class VarModel(BaseModel):
    name: str
    age: int = Field(default=18, title="Age", description="Age in years", ge=0)
    school: str
```

You can then call `VarModel.model_json_schema()` to obtain the final JSON Schema.

#### Future Features

For semantic clarity and atomicity, we do **not** recommend redefining the same AF in both `model.py` and `protocol.aimd`. In future versions, we plan to add warnings for this behavior to help users avoid potential misuse.
