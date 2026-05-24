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

## Aggregation and Override Principle

When `protocol.aimd` and `model.py` coexist, the field set of `data.var` is still defined by AIMD. AIMD typing sugar first generates a base `VarModel`; same-name fields in `model.py` override the generated AIMD fields; fields that exist only in AIMD keep their AIMD-generated types. `model.py` cannot define extra `VarModel` fields that do not appear in AIMD.

The following patterns are allowed:

1. A field is typed only in AIMD and is not repeated in `model.py`.
2. A field is positioned and identified in AIMD without a type, and `model.py` defines its final type.

Airalogy does not require AIMD and `model.py` to contain exactly the same field set, but every field in `model.py::VarModel` must be a declared AIMD `var`. The default check also rejects explicit type conflicts on the same field: if AIMD explicitly declares `age: int` but `model.py::VarModel` declares `age` as `str`, that is an error.

For example, this Protocol is valid:

`protocol.aimd`:

```aimd
Sample: {{var|sample_id: str}}
Age: {{var|age}}
```

`model.py`:

```py
from pydantic import BaseModel

class VarModel(BaseModel):
    age: int
```

The final `data.var` validator contains `sample_id: str` and `age: int`. `sample_id` comes from AIMD, and `age` is overridden by `model.py` instead of using AIMD's default string type.

This Protocol, however, is invalid:

`protocol.aimd`:

```aimd
Sample: {{var|sample_id: str}}
```

`model.py`:

```py
from pydantic import BaseModel

class VarModel(BaseModel):
    sample_id: str
    operator_id: str
```

`airalogy check protocol.aimd` reports this incompatibility because `operator_id` is not an AIMD `var`. If this field should be recorded, declare it in AIMD first. If it is only import source data, runtime metadata, or backend state, it usually belongs in `metadata` or another dedicated structure instead of `data.var`.

This same-name explicit type conflict is also invalid:

`protocol.aimd`:

```aimd
Age: {{var|age: int}}
```

`model.py`:

```py
from pydantic import BaseModel

class VarModel(BaseModel):
    age: str
```

`airalogy check protocol.aimd` reports the conflict because AIMD explicitly declares `age` as `int` while `VarModel` declares it as `str`. Batch import runs the same compatibility check before importing records, then validates `data.var` with the aggregated model.

For richer Pydantic constraints, keep the base type aligned and add constraints in `model.py`:

```py
from pydantic import BaseModel, Field

class VarModel(BaseModel):
    age: int = Field(ge=0, title="Age")
```
