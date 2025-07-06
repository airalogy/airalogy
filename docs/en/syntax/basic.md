# Basic Syntax of an **Airalogy Protocol**

This document explains the core syntax of an Airalogy Protocol Markdown file (`protocol.aimd`) together with its companion **Airalogy Protocol Model** (`model.py`).

## 1 Adding Data Fields in AIMD

In an Airalogy Markdown (AIMD) file, you can declare three types of data fields:

| Field type | AIMD template | Typical purpose |
| - | - | - |
| **Variable**   | `{{var\|<var_id>}}` | Any research variable |
| **Step**       | `{{step\|<step_id>, <level>}}` | A procedural step |
| **Checkpoint** | `{{check\|<check_id>}}` | A critical checklist item |

Below we cover the syntax and rules for each type of data field.

### 1.1 Variable (`{{var}}`)

```aimd
{{var|<var_id>}}
```

- `<var_id>` must follow the naming rules below.

#### Naming rules for `<var_id>`

1. Must **not** start with `_`.
2. IDs that differ only by the number of underscores are treated as the same (e.g. `user_a` and `user__a` collide).
3. Otherwise follow normal Python identifier rules: letters, digits, underscore; no leading digit; no spaces.
4. A field name must be unique across **all** `var`, `step`, and `check` templates in the same protocol.

#### Example

```aimd
<!-- protocol.aimd -->
Experimenter: {{var|recorder_name}}
Experiment Number: {{var|experiment_number}}
```

#### Default data type and the *VarModel*

By default every Variable is treated as a **string**.
To enforce another type, declare a Pydantic model in `model.py`.

```python
# model.py
from pydantic import BaseModel

class VarModel(BaseModel):
    recorder_name: str
    experiment_number: int
```

##### Default values

You may assign default values for your variables:

```python
from datetime import datetime, timezone
from pydantic import BaseModel, Field

class VarModel(BaseModel):
    recorder_name: str = "ZHANG San"
    experiment_number: int = 1
    current_time: datetime = datetime.now(timezone.utc)
```

##### Extra metadata

Use `Field` for title/description and constraints.

```python
class VarModel(BaseModel):
    recorder_name: str = Field(
        default="ZHANG San",
        title="实验记录者",
        description="The person who records the experiment."
    )
```

If `title` is omitted, the UI shows the ID in *Title Case*;
if `description` is omitted, no description is shown.

##### Numeric and string constraints (examples)

```python
class VarModel(BaseModel):
    positive_int: int  = Field(gt=0)
    even_int:     int  = Field(multiple_of=2)
    short_text:   str  = Field(max_length=5)
    nmm_id:       str  = Field(pattern=r"(?i)^NMM-[0-9A-Z]{4}$")
```

##### Lists

```python
class VarModel(BaseModel):
    int_list: list[int] = [1, 2, 3]
    str_list: list[str] = ["a", "b", "c"]
```

### 1.2 Step (`{{step}}`)

```aimd
{{step|<step_id>, <level>[, check=True][, checked_message="..."]}}
```

| Parameter         | Meaning                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `<level>`         | 1, 2, or 3 (default = 1)                                         |
| `check=True`      | Render a checkbox so the user can tick completion                |
| `checked_message` | Banner text shown once the box is ticked (requires `check=True`) |

`<step_id>` follows the same naming rules as `<var_id>` and must be unique.

Example:

```aimd
{{step|prepare_sample}} A
{{step|add_buffer, 2}} A.a
{{step|incubate, 2, check=True}} Incubate the sample for 30 minutes.
{{step|finish_experiment, 1}} B
{{step|cleanup, 1, check=True, checked_message="Workspace cleaned."}} After finishing the experiment, clean up the workspace.
```

### 1.3 Checkpoint (`{{check}}`)

```aimd
{{check|<checkpoint_id>[, checked_message="..."]}}
```

- `<checkpoint_id>` follows the same naming rules.
- The UI renders a single checkbox.

Example:

```aimd
{{check|reagent_quality_check}} The reagents are of good quality.
{{check|prepare_pcr_reaction_on_ice, checked_message="Avoid condensation dripping into tubes."}} Prepare PCR reaction on ice.
```
