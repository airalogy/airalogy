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

## Defining a Var Table with Sub Vars in AIMD

In some scenarios, we need a composite field (a **Var Table**) that contains multiple sub-fields (**Sub Vars**). For example, we want to record multiple students, each with a name and age. With the classic approach:

`protocol.aimd`:

```aimd
Student List: {{var|students, subvars=[name, age]}}
```

`model.py`:

```py
from pydantic import BaseModel, Field

class Student(BaseModel):
    name: str = Field(title="Student Name", description="The student's full name", max_length=50)
    age: int = Field(title="Student Age", description="Age in years", ge=0)

class VarModel(BaseModel):
    students: list[Student] = Field(title="Student List", description="Record each student's name and age")
```

With the AIMD typing sugar, we can write everything directly in `protocol.aimd` as follows:

```aimd
{{var|students: list[Student], 
    title="Student Information",
    description="Record each student's name and age",
    subvars=[
        var(
            name: str = "ZHANG San",
            title="Student Name",
            description="The student's full name",
            max_length=50
        ),
        var(
            age: int = 18,
            title="Student Age",
            description="Age in years",
            ge=0
        )
    ]
}}
```

If each subvar does not need extra metadata, you can use a shorter sugar:

```aimd
{{var|students: list[Student], subvars=[name: str = "ZHANG San", age: int = 18]}}
```

Additional notes:

1. The order of Sub Vars affects the column order in the UI. In the example above, `name` appears before `age`.
2. If the main `var` has no explicit type, Airalogy will default it to `list[xxx]`, where `xxx` is an auto-constructed PascalCase Pydantic model name based on the `subvars`. In the example above, the type would default to `list[NameAge]`, where `NameAge` is formed from the subvar IDs `name` and `age`.

## General Structure and Rationale of the `var` Syntactic Sugar

In AIMD, the general structure of a `var` is:

```aimd
{{var|<var_id>: <var_type> = <default_value>, **kwargs}}
```

Conceptually, this syntax sugar is equivalent to an abstract Python function call:

```py
def var(<var_id>: <var_type> = <default_value>, **kwargs):
    pass
```

This makes the syntax naturally parsable. The quoting rule for `default_value` follows Python exactly: for strings, you **must** use double quotes `""`; for `int`, `float`, `bool`, etc., no quotes are used.

### Nested `var` with `subvars`

When we write:

```aimd
{{var|students, subvars=[name, age]}}
```

or

```aimd
{{var|students, subvars=[name: str, age: int]}}
```

or

```aimd
{{var|students, subvars=[name: str = "ZHANG San", age: int = 18]}}
```

each `subvar` is, in essence, a strictly-formed syntactic sugar that can be viewed as a call to `var(...)`. After desugaring, we have:

```aimd
{{var|students, subvars=[
    var(name: str = "ZHANG San"),
    var(age: int = 18)
]}}
```

On this basis, we can define types and parameters for both the main `var` and each `subvar`:

```aimd
{{var|students,
    title="Student Information",
    description="Record each student's name and age",
    subvars=[
        var(
             name: str = "ZHANG San",
             title="Student Name",
             description="The student's full name",
             max_length=50
        ),
        var(
            age: int = 18,
            title="Student Age",
            description="Age in years",
            ge=0
        )
    ]
}}
```

Since `var` calls are recursive when used with `subvars`, in principle you can define arbitrarily nested `var` types.

### Supported Types

The types supported in AIMD match Python’s built-in types (`str`, `int`, `float`, `bool`, `list`, `dict`, `list[str]`, etc.). Custom types defined in `airalogy.types` (e.g., `UserName`) are also supported. As in Python, **type names are not quoted**.

### Notes on `**kwargs`

For any `var`, `**kwargs` falls into two categories: (1) type-agnostic parameters such as `title`, `description`, etc.; and (2) type-specific parameters (e.g., for `str`, `max_length`, `min_length`, etc.).

#### Syntax Principle

You can understand this as each `var` having a default set of common parameters:

```py
common_kwargs = {
    "title": Optional[str],
    "description": Optional[str],
    ...
}
```

Each concrete type has its own type-specific parameter set. For `str`, for example:

```py
str_kwargs = {
    "max_length": Optional[int],
    "min_length": Optional[int],
    ...
}
```

The final parameter set for a `str`-typed `var` is the merge of the two:

```py
var_str_kwargs = {
    **common_kwargs,
    **str_kwargs,
}
```

Thus, in AIMD, a `str`-typed `var` supports all parameters included in `var_str_kwargs`:

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
