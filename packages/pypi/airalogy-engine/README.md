# airalogy-engine (Python)

[![PyPI version](https://img.shields.io/pypi/v/airalogy-engine?label=PyPI)](https://pypi.org/project/airalogy-engine/)
[![Python versions](https://img.shields.io/pypi/pyversions/airalogy-engine)](https://pypi.org/project/airalogy-engine/)

Airalogy protocol execution sandbox for Python. Run protocol packages (`parse`, `assign`, `validate`) inside a secure [BoxLite](https://github.com/boxlite-ai/boxlite) sandbox, and execute AIMD workflow transition assignments across protocol Records.

## Installation

```bash
pip install airalogy-engine
```

## Sandbox Image

The engine runs protocol code in a BoxLite sandbox. You can use either a **remote Docker image** or a **local OCI rootfs directory**.

### Remote Image

```python
from airalogy_engine import AiralogyEngine

engine = AiralogyEngine(
    protocol_path="/path/to/your/protocol",
    image="numbcoder/airalogy-engine:latest",
)
result = await engine.parse_protocol()
```

### Local OCI Rootfs (Recommended)

Build and export the image locally for faster, offline execution:

```bash
cd packages/runtime/airalogy-engine-image
docker build -t airalogy-engine:latest .
docker save airalogy-engine:latest -o airalogy-engine-image.tar
mkdir airalogy-engine-image
tar -xf airalogy-engine-image.tar -C airalogy-engine-image
```

Then use `rootfs_path`:

```python
from airalogy_engine import AiralogyEngine

engine = AiralogyEngine(
    protocol_path="/path/to/your/protocol",
    rootfs_path="./airalogy-engine-image",
)
result = await engine.parse_protocol()
```

> If neither `image` nor `rootfs_path` is provided, the engine falls back to the default remote image `numbcoder/airalogy-engine:latest`.

## Usage

```python
import asyncio
from airalogy_engine import AiralogyEngine

async def main():
    protocol_path = "/path/to/your/protocol"
    rootfs_path = "/path/to/airalogy-engine-image"  # or use image="..." instead
    engine = AiralogyEngine(
        protocol_path=protocol_path,
        rootfs_path=rootfs_path,
        boxlite_home="/tmp/airalogy-engine-worker-1",
    )

    # 1. Parse the protocol
    result = await engine.parse_protocol(env_vars={"API_KEY": "xxx"})
    print(result["data"]["meta_data"])
    print(result["data"]["json_schema"])

    # 2. Assign a variable
    result = await engine.assign_variable(
        var_name="duration",
        dependent_data={"seconds": 3600},
        env_vars={"API_KEY": "xxx"},
    )
    print(result["data"])

    # 3. Validate variables
    result = await engine.validate_variables(
        variables={"seconds": 60, "duration": "PT1M"},
    )
    print(result["data"])

    # 4. Import records from a file inside the protocol directory
    result = await engine.import_records(input_filename="records.json")
    print(result["data"]["records"])

    # 5. Apply a verified Protocol migration in the sandbox. No host secrets
    # or environment variables are injected into this action.
    result = await engine.migrate_schema(
        data={"var": {"old_name": "pUC19"}},
        manifest={
            "version": "airalogy.migration.v1",
            "from": "1.0.0",
            "to": "2.0.0",
            "operations": [
                {"op": "rename", "from": "var.old_name", "to": "var.name"},
            ],
        },
    )
    print(result["data"]["data"])

    await engine.close()

asyncio.run(main())
```

You can also use the engine as an async context manager:

```python
async with AiralogyEngine(
    protocol_path=protocol_path,
    rootfs_path=rootfs_path,
    boxlite_home="/tmp/worker-1",
) as engine:
    result = await engine.parse_protocol()
```

## Workflow Usage

`AiralogyWorkflowEngine` executes fenced `workflow` definitions from a `workflow.aimd` file. It resolves `transition.inputs`, runs workflow-level Python assigners, exposes outputs under `${transition_id.outputs.key}`, and applies `transition.assign` into target Record drafts. It does not persist Records or create Record versions; callers should save returned Record drafts through their platform or database layer.

```python
import asyncio
from airalogy_engine import AiralogyWorkflowEngine

async def main():
    engine = AiralogyWorkflowEngine(
        workflow_path="/path/to/workflow.aimd",
        rootfs_path="/path/to/airalogy-engine-image",
    )
    result = await engine.run(
        records={
            "measurement": {"data": {"var": {"raw_data": [1, 2, 3]}}},
            "literature_review": {"data": {"var": {"summary": "known background"}}},
        },
    )
    print(result["data"]["records"]["analysis"])
    print(result["data"]["transition_outputs"])
    await engine.close()

asyncio.run(main())
```

For local tests or trusted scripts, pass `assigner_runtime="local"` to execute workflow assigners in the host Python process instead of BoxLite.

## API

| API | Description |
|---|---|
| `AiralogyEngine(protocol_path, boxlite_home=None, image=None, rootfs_path=None, timeout=300, memory_mib=512, cpus=1, auto_stop=True)` | Create an engine bound to one protocol path, BoxLite runtime home, and sandbox configuration |
| `AiralogyWorkflowEngine(workflow_path, workflow_id=None, assigner_runtime="sandbox", boxlite_home=None, image=None, rootfs_path=None, timeout=300, memory_mib=512, cpus=1, auto_stop=True)` | Create an engine bound to one `workflow.aimd` file or directory and sandbox configuration for workflow-level assigners |
| `engine.parse_protocol(env_vars=None, timeout=None, debug=False, log_file="protocol_debug.log")` | Parse the engine protocol and return schema, metadata, fields |
| `engine.assign_variable(var_name, dependent_data, env_vars=None, timeout=None, debug=False, log_file="protocol_debug.log")` | Assign a variable using assigner functions |
| `engine.validate_variables(variables, env_vars=None, timeout=None, debug=False, log_file="protocol_debug.log")` | Validate variable values against the protocol model |
| `engine.import_records(input_filename, input_format="auto", allow_extra_var_fields=False, require_complete_quiz=False, include_template_defaults=True, validate_model_sync=True, env_vars=None, timeout=None, debug=False, log_file="protocol_debug.log")` | Import a protocol-local JSON/JSONL/CSV/TSV file into Airalogy record JSON objects |
| `engine.migrate_schema(data, manifest, timeout=None, debug=False, log_file="protocol_debug.log")` | Apply declarative migration rules and an optional hash-verified pure transform inside the sandbox, without network access or injected secrets |
| `workflow_engine.run(records, transition_ids=None, transition_outputs=None, node_iterations=None, max_passes=1, env_vars=None, timeout=None, debug=False, log_file="workflow_debug.log")` | Execute workflow transitions in declaration order and return Record drafts, transition outputs, skipped transitions, attempts, and node iteration counters |
| `workflow_engine.run_transition(transition_id, records, transition_outputs=None, node_iterations=None, env_vars=None, timeout=None, debug=False, log_file="workflow_debug.log")` | Execute one workflow transition and return updated Record drafts |
| `engine.box_status()` | Return the current BoxLite `BoxStateInfo`, or `None` when the engine has no current box |
| `await engine.stop()` | Stop this engine's current box without closing the engine |
| `await engine.close()` | Stop this engine's current box and release its BoxLite runtime reference |

All engine methods are `async` and return a `dict` with `success`, `message`, and `data` keys.

**Engine parameters**:
- `protocol_path`: Protocol package directory. It must contain `protocol.aimd` and is mounted writable at `/home/airalogy/protocols/protocol` inside the sandbox.
- `boxlite_home`: BoxLite runtime home directory. Use a distinct value for each OS process when running multiple workers.
- `image`: Remote Docker image name (e.g., `"numbcoder/airalogy-engine:0.1"`).
- `rootfs_path`: Path to a local OCI rootfs directory (overrides `image`).
- `timeout`: Execution timeout in seconds (default: 300). The sandboxed process will be killed once it times out.
- `memory_mib`: Memory limit in MiB (default: 512).
- `cpus`: CPU limit (default: 1).
- `auto_stop`: Stop the box after each command when `True` (default). Set to `False` to keep one running box until `stop()` or `close()`.

## Concurrency

Use one `AiralogyEngine` instance per protocol and worker process. Concurrent async operations through one engine run on its current box:

```python
engine = AiralogyEngine(
    protocol_path=protocol_path,
    rootfs_path=rootfs_path,
    boxlite_home="/tmp/worker-1",
    auto_stop=False,
)

results = await asyncio.gather(
    engine.parse_protocol(),
    engine.validate_variables({"seconds": 60, "duration": "PT1M"}),
)

await engine.stop()
```

BoxLite locks each runtime home per OS process. Two independent processes must not share the same `boxlite_home` or default `~/.boxlite`; give each process a distinct directory, for example `/tmp/airalogy-worker-1` and `/tmp/airalogy-worker-2`.

## Testing

```bash
cd python
uv sync

# Default: local OCI rootfs mode
uv run pytest tests/ -v

# Custom rootfs path
uv run pytest tests/ -v --sandbox-mode=rootfs --rootfs-path=../../runtime/airalogy-engine-image/airalogy-engine-image

# Remote image mode
uv run pytest tests/ -v --sandbox-mode=image --sandbox-image=numbcoder/airalogy-engine:latest
```
