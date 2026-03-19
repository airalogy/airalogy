# Airalogy Type Plugins

`airalogy.types` now has an explicit type registry for two reasons:

- Airalogy official built-in types should keep one stable, documented contract.
- Third-party labs or apps should be able to add new AIMD type tokens without forking Airalogy.

The design is intentionally explicit. AIMD does **not** dynamically import arbitrary type names from protocol text. A type only becomes available when it is registered.

## Why This Matters

The type system is no longer limited to a fixed official list.

- Official built-ins still work exactly as before.
- `generate_model()` can now import registered external types from their own Python modules.
- Community or private lab types can evolve independently and later be adopted by Airalogy with the same descriptor shape.

## Registry API

Airalogy exposes `AiralogyTypeDescriptor` plus registry helpers in `airalogy.types.registry`.

```python
from airalogy.types.registry import (
    AiralogyTypeDescriptor,
    register_airalogy_type,
)

register_airalogy_type(
    AiralogyTypeDescriptor(
        type_name="MicroscopeCapture",
        import_from="my_lab_airalogy.types",
        storage_kind="structured",
        ui_kind="microscope-capture",
    )
)
```

Once registered, AIMD can use the type token directly:

```aimd
{{var|capture: MicroscopeCapture}}
```

And `generate_model()` will emit:

```python
from my_lab_airalogy.types import MicroscopeCapture
```

`import_from` is not a special reserved value. It is a real Python module path string.

For example:

- `import_from="my_lab_airalogy.types"` means Airalogy will later generate `from my_lab_airalogy.types import MicroscopeCapture`
- if your type lives in a different module, `import_from` should point to that module instead

In other words, it answers:

> Which Python module should this AIMD type token be imported from?

## Recommended Code Layout

Yes, this should be documented explicitly. Otherwise users learn that a type can be registered but still do not know where the implementation and registration code should live.

The recommended split is:

- Official Airalogy built-ins:
  keep the actual type implementations under `airalogy/src/airalogy/types/`.
  Keep the registration wiring in `airalogy/src/airalogy/types/__init__.py`.
- Third-party packages:
  keep the actual domain types in your own package module.
  Keep the Airalogy plugin entry in a separate `plugin.py` or `airalogy_plugin.py`.

A good third-party package shape looks like:

```text
my_lab_airalogy/
  __init__.py
  types.py
  plugin.py
```

Where:

- `types.py` contains the real Pydantic model, `Annotated[...]` type, or custom class
- `plugin.py` exposes a small entry such as `get_airalogy_types()`

Example:

```python
# my_lab_airalogy/types.py
from pydantic import BaseModel

class MicroscopeCapture(BaseModel):
    exposure_ms: int
    channel: str
```

```python
# my_lab_airalogy/plugin.py
from airalogy.types.registry import AiralogyTypeDescriptor

def get_airalogy_types():
    return [
        AiralogyTypeDescriptor(
            type_name="MicroscopeCapture",
            import_from="my_lab_airalogy.types",
            storage_kind="structured",
            ui_kind="microscope-capture",
        )
    ]
```

Two rules matter here:

- `import_from` should point to the real module that exports the type symbol, not to the registry itself
- `plugin.py` should only publish descriptors; keep the actual domain model in the type module

## Plugin Discovery

Installed Python packages can also publish type descriptors through entry points under the `airalogy.types` group.

Example `pyproject.toml`:

```toml
[project.entry-points."airalogy.types"]
microscope = "my_lab_airalogy.plugin:get_airalogy_types"
```

The target may return:

- one `AiralogyTypeDescriptor`
- an iterable of descriptors
- a callable that accepts the registry and registers types directly

Airalogy loads these entry points through `discover_airalogy_type_plugins()` and also resolves them automatically when the type registry is queried.

## Contract

A type descriptor answers one core question:

> When AIMD contains token `X`, which Python symbol should Airalogy treat as the canonical type?

The descriptor carries:

- `type_name`: the public AIMD / Python type token
- `import_from`: the module used by model generation
- `storage_kind`: high-level payload shape such as scalar, structured, or file-id
- `ui_kind`: frontend-facing semantic hint for recorder/editor integrations
- `schema_extra`: optional metadata for richer tooling

## Scope

The Airalogy registry does not define frontend widgets by itself. It defines the canonical backend contract. Recorder/editor plugins in the `aimd` repository should use the same public type names so backend schema and frontend interaction stay aligned.

See the AIMD docs for the frontend half of this design:

- [`Type Plugins`](https://airalogy.github.io/aimd/en/packages/type-plugins)
