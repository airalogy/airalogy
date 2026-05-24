# airalogy-engine (Python)

[![PyPI version](https://img.shields.io/pypi/v/airalogy-engine?label=PyPI)](https://pypi.org/project/airalogy-engine/)
[![Python versions](https://img.shields.io/pypi/pyversions/airalogy-engine)](https://pypi.org/project/airalogy-engine/)

Airalogy protocol execution sandbox for Python. Run protocol packages (`parse`, `assign`, `validate`) inside a secure [BoxLite](https://github.com/boxlite-ai/boxlite) sandbox.

## Installation

```bash
pip install airalogy-engine
```

## Sandbox Image

The engine runs protocol code in a BoxLite sandbox. You can use either a **remote Docker image** or a **local OCI rootfs directory**.

### Remote Image

```python
from airalogy_engine import AiralogyEngine

engine = AiralogyEngine(image="numbcoder/airalogy-engine:0.1")
result = await engine.parse_protocol(protocol_path)
```

### Local OCI Rootfs (Recommended)

Build and export the image locally for faster, offline execution:

```bash
docker build -t airalogy-engine:latest ../../runtime/airalogy-engine-image
docker save airalogy-engine:latest -o airalogy-engine-image.tar
mkdir airalogy-engine-image
tar -xf airalogy-engine-image.tar -C airalogy-engine-image
```

Then use `rootfs_path`:

```python
from airalogy_engine import AiralogyEngine

engine = AiralogyEngine(rootfs_path="./airalogy-engine-image")
result = await engine.parse_protocol(protocol_path)
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
        rootfs_path=rootfs_path,
        boxlite_home="/tmp/airalogy-engine-worker-1",
    )

    # 1. Parse the protocol
    result = await engine.parse_protocol(protocol_path, env_vars={"API_KEY": "xxx"})
    print(result["data"]["meta_data"])
    print(result["data"]["json_schema"])

    # 2. Assign a variable
    result = await engine.assign_variable(
        protocol_path,
        var_name="duration",
        dependent_data={"seconds": 3600},
        env_vars={"API_KEY": "xxx"},
    )
    print(result["data"])

    # 3. Validate variables
    result = await engine.validate_variables(
        protocol_path,
        variables={"seconds": 60, "duration": "PT1M"},
    )
    print(result["data"])

    await engine.close()

asyncio.run(main())
```

You can also use the engine as an async context manager:

```python
async with AiralogyEngine(rootfs_path=rootfs_path, boxlite_home="/tmp/worker-1") as engine:
    result = await engine.parse_protocol(protocol_path)
```

## API

| API | Description |
|---|---|
| `AiralogyEngine(boxlite_home=None, image=None, rootfs_path=None, timeout=300, memory_mib=512, cpus=1)` | Create an engine bound to one BoxLite runtime home and sandbox configuration |
| `engine.parse_protocol(protocol_path, env_vars=None, timeout=None, debug=False, log_file="protocol_debug.log")` | Parse a protocol and return schema, metadata, fields |
| `engine.assign_variable(protocol_path, var_name, dependent_data, env_vars=None, timeout=None, debug=False, log_file="protocol_debug.log")` | Assign a variable using assigner functions |
| `engine.validate_variables(protocol_path, variables, env_vars=None, timeout=None, debug=False, log_file="protocol_debug.log")` | Validate variable values against the protocol model |
| `await engine.close()` | Release this engine's BoxLite runtime reference |

All engine methods are `async` and return a `dict` with `success`, `message`, and `data` keys.

**Engine parameters**:
- `boxlite_home`: BoxLite runtime home directory. Use a distinct value for each OS process when running multiple workers.
- `image`: Remote Docker image name (e.g., `"numbcoder/airalogy-engine:0.1"`).
- `rootfs_path`: Path to a local OCI rootfs directory (overrides `image`).
- `timeout`: Execution timeout in seconds (default: 300). The sandboxed process will be killed once it times out.
- `memory_mib`: Memory limit in MiB (default: 512).
- `cpus`: CPU limit (default: 1).

## Concurrency

Use one `AiralogyEngine` instance per worker process and run concurrent operations through that object:

```python
engine = AiralogyEngine(rootfs_path=rootfs_path, boxlite_home="/tmp/worker-1")

results = await asyncio.gather(
    engine.parse_protocol(protocol_a),
    engine.parse_protocol(protocol_b),
)
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
uv run pytest tests/ -v --sandbox-mode=image --sandbox-image=numbcoder/airalogy-engine:0.1
```
