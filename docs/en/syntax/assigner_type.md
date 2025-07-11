# Assigner Assignments Must Satisfy JSON Schema Type Constraints

When an **Assigner** populates Fields, the values it assigns **must** match the JSON Schema type defined for the corresponding data field in `model.py`, and they must be representable in JSON (e.g., as strings, numbers, booleans, etc.).

A clear example is Python’s `timedelta` class.

`protocol.aimd`:

```aimd
Seconds：{{var|seconds}}
Represent the above value in `duration` format: {{var|duration}}
```

`model.py`:

```python
from datetime import timedelta
from pydantic import BaseModel

class TimeModel(BaseModel):
    seconds: int
    duration: timedelta
```

If we want an Assigner to convert `seconds` into `duration`, we must ensure that the value assigned to `duration` follows the JSON Schema format.

Because `timedelta` is represented in JSON Schema as a `duration` string (e.g., `P1DT2H30M` for 1 day 2 hours 30 minutes, `PT1H30M` for 1 hour 30 minutes), we first convert the `timedelta` to an ISO 8601 string.

`assigner.py` (safe implementation):

```python
from datetime import timedelta
from airalogy.iso import timedelta_to_iso

class Assigner(AssignerBase):
    @assigner(
        assigned_fields=["duration"],
        dependent_fields=["seconds"],
        mode="auto",
    )
    def convert_seconds_to_duration(dependent_fields: dict) -> AssignerResult:
        seconds = dependent_fields["seconds"]
        duration = timedelta(seconds=seconds)
        return AssignerResult(
            assigned_fields={
                "duration": timedelta_to_iso(duration),
            },
        )
```

Incorrect (unsafe) implementation that may fail JSON Schema validation:

```python
@assigner(
    assigned_fields=["duration"],
    dependent_fields=["seconds"],
    mode="auto",
)
def convert_seconds_to_duration(dependent_fields: dict) -> AssignerResult:
    seconds = dependent_fields["seconds"]
    duration = timedelta(seconds=seconds)
    return AssignerResult(
        assigned_fields={
            "duration": duration,  # Unsafe: direct timedelta assignment will likely violate JSON Schema
        },
    )
```

## `airalogy.iso` Module

The `airalogy.iso` module provides handy helpers for converting common Python complex types to ISO strings.

### `timedelta_to_iso`

Convert a `timedelta` object to an ISO 8601 string.

```python
from datetime import timedelta
from airalogy.iso import timedelta_to_iso

timedelta_obj = timedelta(days=1, hours=2, minutes=30)
iso_string = timedelta_to_iso(timedelta_obj)
print(iso_string)  # Output: P1DT2H30M
```
