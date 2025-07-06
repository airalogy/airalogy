# Data Models in Airalogy

In Airalogy, the term **“Model”** refers to a data model—a Python class that inherits from `pydantic.BaseModel` and defines a specific data structure.

All public models can be imported through a single entry point, for example:

```python
from airalogy.models import CheckValue
```

## Built-in Models

### `CheckValue`

A small schema used for **Airalogy Checkpoints**.

```python
from pydantic import BaseModel

class CheckValue(BaseModel):
    checked: bool
    annotation: str
```

```python
from airalogy.models import CheckValue   # standard import path
```

### `StepValue`

Similar to `CheckValue`, but the `checked` flag can be `None`, allowing a step to remain “unchecked.”

```python
from pydantic import BaseModel

class StepValue(BaseModel):
    checked: bool | None
    annotation: str
```

```python
from airalogy.models import StepValue
```

## How Models Differ from Built-in Types

Airalogy also ships a set of **built-in field types**—for example `UserName`, `CurrentTime`, `AiralogyMarkdown`, and others. These types control UI behaviour on the platform (auto-filling, special widgets, etc.) and are therefore grouped under the dedicated module `airalogy.built_in_types`:

```python
from airalogy.built_in_types import UserName
```

You can freely combine built-in types with ordinary Pydantic models:

```python
# model.py
from pydantic import BaseModel
from airalogy.built_in_types import UserName

class VarModel(BaseModel):
    user_name: UserName
```

By contrast, **regular models** such as `CheckValue` or `StepValue` exist purely to validate and manipulate data within Airalogy’s Python runtime—they do not influence how the recording interface is rendered.

### Example: Using a Model Inside an Assigner

```python
# assigner.py
from airalogy.assigner import (
    AssignerBase,
    AssignerResult,
    assigner,
)
from airalogy.models import CheckValue

class Assigner(AssignerBase):

    @assigner(
        assigned_fields=["a_gt_b"],
        dependent_fields=["a", "b"],   # both floats
        mode="auto",
    )
    def check_a_gt_b(dependent_fields: dict) -> AssignerResult:
        a = dependent_fields["a"]
        b = dependent_fields["b"]
        result = a > b
        return AssignerResult(
            assigned_fields={
                "a_gt_b": CheckValue(
                    checked=result,
                    annotation="a > b"
                )
            }
        )
```

In this snippet, `CheckValue` enforces a consistent structure for the data that the Assigner returns, while any UI-related fields (e.g. `UserName`) would be handled elsewhere in the protocol.
