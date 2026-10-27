# Basic Syntax of an **Airalogy Protocol**

This document explains the core syntax of an Airalogy Protocol Markdown file (`protocol.aimd`) together with its companion **Airalogy Protocol Model** (`model.py`).

## 1 Adding Data Fields in AIMD

In an Airalogy Markdown (AIMD) file, you can declare three types of data fields:

- **Field type: Variable**  
  - **AIMD template:** `{{var|<var_id>}}`  
- **Typical purpose:** Any research variable
- **Field type: Step**  
  - **AIMD template:** `{{step|<step_id>, <level>}}`  
  - **Typical purpose:** A procedural step
- **Field type: Checkpoint**  
  - **AIMD template:** `{{check|<check_id>}}`  
  - **Typical purpose:** A critical checklist item

Below we cover the syntax and rules for each type of data field.

### 1.1 Variable

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
{{step|<step_id>, <level>[, title="<title>"][, duration="<duration>"][, timer="elapsed|countdown|both"][, check=True][, checked_message="..."]}}
```

| Parameter         | Meaning                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `<level>`         | 1, 2, or 3 (default = 1)                                         |
| `title`           | Optional human-facing step name in single or double quotes; supports Unicode, commas and escaped quotes. Leading/trailing whitespace is trimmed; an empty title is omitted. |
| `duration`        | Expected step duration, using compact units like `30s`, `10m`, `1h30m`, or `2d4h` |
| `timer`           | Recorder timer display mode: `elapsed` (default), `countdown`, or `both` |
| `check=True`      | Render a checkbox so the user can tick completion                |
| `checked_message` | Banner text shown once the box is ticked (requires `check=True`) |

`<step_id>` follows the same naming rules as `<var_id>` and must be unique.

Titles may repeat; they do not change IDs, numbering, references, or Record keys. Text following a step marker on the same line remains body content and is not inferred as a title. Source line breaks and visual wrapping do not alter this rule. Existing title-free steps remain valid.

```aimd
{{step|dilute_and_mix, title="Dilute and mix", check=True, duration="2m"}}

Add water dropwise to the mark, stopper, then mix by inversion.

Actual volume: {{var|actual_volume: float, title="Actual volume mL"}}
```

Recorder displays the step number and title prominently, with the ID in smaller type when field details are shown. Compact display hides the ID, not the title; title-free steps use the number as their primary label. There is no need for a duplicate Markdown heading. Visual insertion generates a unique ID and makes the name optional; edit instructions directly in the document. Advanced settings allow adjusting a new ID before insertion; existing step IDs are read-only in the settings dialog so title edits cannot break records. Intentional ID migrations must explicitly update source references, Records and Collector bindings.

Example:

```aimd
{{step|prepare_sample}} A
{{step|add_buffer, 2}} A.a
{{step|incubate, 2, duration="30m", timer="countdown", check=True}} Incubate the sample for 30 minutes.
{{step|finish_experiment, 1}} B
{{step|cleanup, 1, check=True, checked_message="Workspace cleaned."}} After finishing the experiment, clean up the workspace.
```

When `duration` is provided, Airalogy preserves the original string and also normalizes it internally to milliseconds for downstream estimation and UI use.
When `timer="countdown"` or `timer="both"` is provided, the recorder can use `duration` as the countdown target and switch to overtime once the remaining time reaches zero.

### 1.3 Checkpoint (`{{check}}`)

```aimd
{{check|<checkpoint_id>[, title="..."][, checked_message="..."]}}
```

- `<checkpoint_id>` follows the same naming rules.
- The UI renders a single checkbox.
- `title` is an optional quoted, human-readable name. Single and double quotes, commas, Unicode and escaped quotes are supported; surrounding whitespace is trimmed and a blank title is treated as absent. Titles may repeat and do not change the stable ID or Record key.

Example:

```aimd
{{check|reagent_quality_check}} The reagents are of good quality.
{{check|safety_ready, title="Protective equipment"}} Confirm gloves and eye protection before proceeding.
{{check|prepare_pcr_reaction_on_ice, checked_message="Avoid condensation dripping into tubes."}} Prepare PCR reaction on ice.
```

The title is a short label; subsequent Markdown remains the detailed check instructions and is never inferred as a title. Both styles above remain valid. Visual insertion generates an ID and makes the name optional. Existing IDs stay read-only in the settings dialog; changing the title preserves checked state and notes. Detailed display shows the title with a smaller ID; compact display hides the ID, not the title.

### 1.4 AIMD-looking text inside string parameters

Content wrapped in single or double quotes inside an AIMD template parameter is treated as a plain string. This means `{{var|...}}`, `{{ref_var|...}}`, commas, and `}}` inside `checked_message`, `title`, `description`, and similar string parameters are preserved as literal text and are not parsed or rendered as nested AIMD templates.

```aimd
{{check|reading_stable, checked_message="Reading unstable after {{ref_var|stable_wait_s}} s; check electrode and sample temperature."}} Confirm pH reading is stable.
```

In this example, the `checked_message` value is the literal string `Reading unstable after {{ref_var|stable_wait_s}} s; check electrode and sample temperature.`. If the variable reference should be rendered as AIMD content, put it in the surrounding AIMD body instead:

```aimd
{{check|reading_stable, checked_message="Reading unstable; check electrode and sample temperature."}} Confirm pH reading is stable after {{ref_var|stable_wait_s}} s.
```
