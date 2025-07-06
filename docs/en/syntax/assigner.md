# Assigner Syntax

## 1 What Is an *Assigner*?

In many research protocols, the value of one field can be **computed automatically** from other fields—for example, a variable (`var`), a step (`step`), or a checkpoint (`check`).
Airalogy offers a high-level feature called an **Assigner** to describe and execute these dependencies.

### 1.1 Typical Use Case

Suppose `var_3` should always equal `var_1 + var_2`.
Implementing this requires **three** files:

| File | Purpose |
| - | - |
| `protocol.aimd` | Declares the fields in AIMD syntax |
| `model.py` | Defines each field's data type (Pydantic model) |
| `assigner.py` | Contains the computation logic |

#### File 1: `protocol.aimd`

```aimd
The value of `var_1`: {{var|var_1}}
The value of `var_2`: {{var|var_2}}
The value of `var_3`: {{var|var_3}}

Note: `var_3` = `var_1` + `var_2`
```

#### File 2: `model.py`

```python
from pydantic import BaseModel

class VarModel(BaseModel):
    var_1: float
    var_2: float
    var_3: float
```

#### File 3: `assigner.py`

```python
from airalogy.assigner import (
    AssignerBase,
    AssignerResult,
    assigner,
)

class Assigner(AssignerBase):

    @assigner(
        assigned_fields=["var_3"],  # fields to assign
        dependent_fields=["var_1", "var_2"],  # fields that this function depends on
        mode="auto",  # "auto" = run whenever dependencies change
                      # "manual" = user must click "Assign" button in the UI
    )
    def calculate_var_3(dependent_fields: dict) -> AssignerResult:
        v1 = dependent_fields["var_1"]
        v2 = dependent_fields["var_2"]
        v3 = v1 + v2

        return AssignerResult(
            assigned_fields={"var_3": v3}
        )
```

> **Many-to-many is allowed**
> An Assigner can read *any* number of fields and assign *any* number of fields—across `var`, `step`, and `check` alike.

## 2 `dependent_fields` and `assigned_fields`

- Both are plain Python **dicts** whose keys are field names.
- Values follow the JSON Schema of the protocol; i.e. only JSON-serialisable types.
- For special field classes (e.g. a checkpoint) you may need to wrap the value in a helper model such as `CheckValue`.

## 3 Working with Complex Types

If a field stores a complex type (e.g. `datetime`) it is transmitted as a JSON-compatible value (usually a string).
Convert it to a native Python object before calculation, then convert back:

```python
from datetime import datetime, timedelta
from airalogy.assigner import AssignerBase, AssignerResult, assigner

class Assigner(AssignerBase):

    @assigner(
        assigned_fields=["record_time_plus_1_day"],
        dependent_fields=["record_time"],
        mode="auto",
    )
    def plus_one_day(dep: dict) -> AssignerResult:
        # JSON → Python
        t0 = datetime.fromisoformat(dep["record_time"])

        t1 = t0 + timedelta(days=1)

        # Python → JSON
        return AssignerResult(
            assigned_fields={
                "record_time_plus_1_day": t1.isoformat()
            }
        )
```

## 4 Assigners for Checkpoints

Checkpoints (`check`) can be calculated the same way, but you must return a `CheckValue`:

```python
from airalogy.assigner import AssignerBase, AssignerResult, assigner
from airalogy.models import CheckValue

class Assigner(AssignerBase):

    @assigner(
        assigned_fields=["var_1_2_sum", "check_sum_gt_10"],
        dependent_fields=["var_1", "var_2"],
        mode="auto",
    )
    def check_sum(dep: dict) -> AssignerResult:
        v1 = dep["var_1"]
        v2 = dep["var_2"]
        total = v1 + v2
        passed = total > 10

        return AssignerResult(
            assigned_fields={
                "var_1_2_sum": total,
                "check_sum_gt_10": CheckValue(
                    checked=passed,
                    annotation=f"var_1 + var_2 = {total} ({'>' if passed else '<='} 10)"
                )
            }
        )
```

> The same pattern works for `step` fields—return the helper model `StepValue`.

## Reference

| Decorator Argument | Description |
| - | - |
| `assigned_fields` | List of field names the function assigns |
| `dependent_fields` | List of field names the function depends on |
| `mode` | `"auto"` (run on change) or `"manual"` (run on button click) |

### `AssignerResult`

| Field | Type | Default | Meaning |
| - | - | - | - |
| `success` | `bool` | `True` | Whether the assignment succeeded |
| `assigned_fields` | `dict[str, Any]` | **required** | New values |
| `error_message` | `str \| None` | `None` | Reason when `success` is `False` |

## Other Assigners

- [Variable Table Assigners](./var_table.md)
